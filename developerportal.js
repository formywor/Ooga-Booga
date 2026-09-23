"use strict";
(() => {
  const el = id => document.getElementById(id), api = window.ScriptNovaaSite.accountRequest;
  const status = text => {el("portal-status").textContent = text;};
  function text(parent, tag, value) {const node = document.createElement(tag); node.textContent = value; parent.append(node); return node;}
  function localStatus(button, message) {
    let notice=button.nextElementSibling;
    if(!notice?.classList.contains("action-status")){notice=document.createElement("p");notice.className="action-status";notice.setAttribute("role","status");notice.setAttribute("aria-live","polite");button.after(notice);}
    notice.textContent=message;
    return notice;
  }
  function copyField(parent,label,value){text(parent,"p",label);text(parent,"code",value);const button=text(parent,"button",`Copy ${label}`);button.type="button";button.onclick=async()=>{try{await navigator.clipboard.writeText(value);localStatus(button,"Copied to clipboard.");button.textContent="Copied!";setTimeout(()=>{button.textContent=`Copy ${label}`;},2000);}catch{localStatus(button,"Copy was blocked by your browser. Select the text above and copy it manually.");}};}
  async function action(button, fn) {
    if(button.disabled)return;
    const form=button.closest("form"), fallback=button.closest(".portal-record")?.parentElement;
    const notice=localStatus(button,"Please wait…");button.disabled=true;
    try {notice.textContent=await fn() || "Done. Your information is up to date.";}
    catch(error){notice.textContent=error.message;}
    finally {
      button.disabled=false;
      // Keep feedback visible if a successful action hides its form or refreshes its row.
      if(form?.hidden)form.after(notice);
      else if(!notice.isConnected && fallback?.isConnected)fallback.prepend(notice);
    }
  }
  // Preserve useful API validation messages without ever rendering user HTML.
  async function send(path, body) {
    const token = window.ScriptNovaaAuth.token();
    const response = await fetch(`https://api.scriptnovaa.com${path}`, {method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token || ""}`}, body:JSON.stringify(body), cache:"no-store"});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed."); return result;
  }
  async function load() {
    const data = await api("/api/developer/portal");
    el("portal-account").hidden = false;
    status(data.hostingEnabled ? "Hosting is available. Check your site's status below; custom domains also need DNS, HTTPS and administrator activation." : "Applications are open. Managed hosting is awaiting infrastructure setup.");
    el("program-list").replaceChildren();
    for (const item of Object.values(data.requests)) {const row = text(el("program-list"), "article", ""); row.className="portal-record"; text(row,"strong",`${item.type} · ${item.status}`); text(row,"p",item.reason || "Awaiting administrator review.");}
    if (!Object.keys(data.requests).length) text(el("program-list"),"p","No applications yet.");
    el("hosting-form").hidden = Boolean(data.site); el("hosting-site").replaceChildren();
    el("verify-domain").hidden = !data.site?.customDomain;
    if (data.site) {
      text(el("hosting-site"),"h3",`${data.site.customDomain || data.site.slug+".scriptnovaa.com"} · ${data.site.status}`);
      if(data.site.reviewReason) text(el("hosting-site"),"p",data.site.reviewReason);
      if(data.site.customDomain) {
        const verified=Boolean(data.site.domainVerifiedAt);
        const awaitingReview=["PENDING","APPROVED"].includes(data.site.status);
        const message=!verified ? "DNS not verified yet. Add the records below, then click Check my DNS records."
          : awaitingReview ? "Your domain is waiting for approval from an administrator. It has passed the DNS check. Estimated review time: around 15 minutes to 2 days; this is not guaranteed. Staff will check hosting, routing and HTTPS before activation."
          : data.site.status === "ACTIVE" ? "Your domain has passed the DNS check and is approved for hosting."
          : "Your domain previously passed the DNS check, but hosting is not active. See the administrator's decision above or contact Support.";
        const notice=text(el("hosting-site"),"p",message);notice.setAttribute("role","status");
        text(el("hosting-site"),"p","HTTPS is required for managed website sessions to protect session access. A DNS check confirms domain ownership, not that hosting or its certificate is ready.");
      }
    }
    el("program-admin").hidden = !data.administrator;
    if (data.site?.customDomain) {
      const help = text(el("hosting-site"), "section", "");
      text(help, "h4", "1. Open your domain's DNS settings");
      text(help, "p", "Use the company that currently manages your nameservers—not necessarily where you bought the domain. Look for DNS records, Manage DNS or DNS zone. Do not change nameservers or unrelated website/email records.");
      text(help, "p", "Providers label fields differently: Host / Name, and Value / Content / Target. Some append your zone name automatically; others require the full DNS name. Use the matching name below, not both. TTL can stay Automatic or the provider's default.");
      for(const record of data.site.dns){const card=text(help,"article","");card.className="portal-record";text(card,"h4",`Add a ${record.type} record`);text(card,"p",`Click Add record, choose ${record.type}, then copy the fields below. Save the record.`);copyField(card,"full DNS name",record.name);if(record.host)copyField(card,"relative Host / Name",record.host);else text(card,"p","If your provider appends the zone, remove that zone and its preceding dot from the full DNS name; use @ for the zone itself. Example: _scriptnovaa.play.example.com becomes _scriptnovaa.play inside example.com.");copyField(card,record.type==="TXT"?"TXT value / Content":"CNAME target",record.value);}
      if(data.site.domainKind==="ROOT")text(help,"p","Root domain: add only the TXT ownership record for now. Contact Support for the hosting provider's exact A/AAAA or ALIAS routing records after the hostname is attached. Do not create a root CNAME or replace existing website records blindly. Ownership verification alone does not finish root-domain setup.");
      else text(help,"p","The CNAME must not coexist with A/AAAA records at the same host. If your DNS provider offers proxying, choose DNS-only for this verification. Leave other hostnames and email records alone.");
      text(help, "h4", "DNS is only the first step");
      text(help, "p", "2. Save your records, then click Check my DNS records. Updates may take time to appear. 3. Staff attach your hostname, check routing and provision HTTPS. 4. An administrator activates hosting. Adding DNS does not upload your old website or list it as a sponsor; sponsor content needs a separate review.");
    }
    if(data.administrator) await reviews();
    return data;
  }
  async function reviews() {
    const data = await api("/api/admin/program-requests");
    el("review-list").replaceChildren(); el("site-review-list").replaceChildren();
    for(const item of data.requests) {
      const row=text(el("review-list"),"article","");row.className="portal-record";
      text(row,"strong",`${item.username} · ${item.type} · ${item.status}`); text(row,"p",item.message); if(item.reason) text(row,"p",item.reason);
      if(item.status!=="PENDING") continue;
      const reason=text(row,"textarea","");reason.placeholder="Required decision reason";reason.setAttribute("aria-label","Decision reason");reason.maxLength=500;
      for(const decision of ["APPROVED","DECLINED"]) {const button=text(row,"button",decision === "APPROVED" ? "Approve" : "Decline");button.onclick=()=>action(button,async()=>{await send("/api/admin/program-review",{accountId:item.accountId,type:item.type,decision,reason:reason.value});await load();});}
    }
    for(const site of data.sites) {
      const row=text(el("site-review-list"),"article","");row.className="portal-record";
      text(row,"strong",`${site.slug}.scriptnovaa.com · ${site.status}`);text(row,"p",`${site.customDomain || "Personal subdomain"} · ${site.domainVerifiedAt ? "DNS verified" : "No custom-domain verification"}`);
      const reason=text(row,"textarea","");reason.placeholder="Required hosting decision reason";reason.setAttribute("aria-label","Hosting decision reason");reason.maxLength=500;
      const label=text(row,"label","");const check=document.createElement("input");check.type="checkbox";label.append(check,document.createTextNode(" I verified HTTPS and routing for this hostname."));
      for(const decision of ["ACTIVE","DECLINED","SUSPENDED"]) {const button=text(row,"button",decision === "ACTIVE" ? "Activate" : decision === "DECLINED" ? "Decline" : "Suspend");button.onclick=()=>action(button,async()=>{await send("/api/admin/hosting-review",{accountId:site.accountId,decision,reason:reason.value,tlsReady:check.checked});await reviews();status("Hosting decision recorded.");});}
    }
  }
  el("program-form").onsubmit=e=>{e.preventDefault();action(e.currentTarget.querySelector("button"),async()=>{await send("/api/developer/requests",{type:el("program-type").value,message:el("program-message").value});el("program-message").value="";await load();});};
  function domainChoice(){const own=el("hosting-type").value!=="SCRIPTNOVAA";el("custom-domain-fields").hidden=!own;el("hosting-domain").required=own;el("hosting-zone").required=own;el("personal-address-label").textContent=own?"Internal project name (not an extra domain)":"Your ScriptNovaa address";el("scriptnovaa-suffix").hidden=own;}
  el("hosting-type").onchange=domainChoice;domainChoice();
  el("hosting-form").onsubmit=e=>{e.preventDefault();action(e.currentTarget.querySelector("button"),async()=>{const own=el("hosting-type").value!=="SCRIPTNOVAA";await send("/api/developer/site",{slug:el("hosting-slug").value,customDomain:own?el("hosting-domain").value:"",domainKind:el("hosting-type").value,dnsZone:own?el("hosting-zone").value:""});await load();});};
  el("verify-domain").onclick=()=>action(el("verify-domain"),async()=>{await send("/api/developer/domain/verify",{});const data=await load();return ["PENDING","APPROVED"].includes(data.site?.status) ? "DNS check passed. Your domain is waiting for approval from an administrator. Estimated review time: around 15 minutes to 2 days; this is not guaranteed." : data.site?.status === "ACTIVE" ? "DNS check passed. Your domain is approved for hosting." : "DNS check passed. Hosting is not active; see the administrator decision or contact Support.";});
  el("review-refresh").onclick=()=>action(el("review-refresh"),reviews);


  load().catch(error=>{status(error.message === "SIGNED_OUT" ? "Sign in to apply and manage your space." : "The portal could not load. Check your connection and that the updated API is deployed.");el("portal-signin").hidden=false;});
})();
