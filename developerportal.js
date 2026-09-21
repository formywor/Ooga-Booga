"use strict";
(() => {
  const el = id => document.getElementById(id), api = window.ScriptNovaaSite.accountRequest;
  const status = text => {el("portal-status").textContent = text;};
  function text(parent, tag, value) {const node = document.createElement(tag); node.textContent = value; parent.append(node); return node;}
  async function action(button, fn) {button.disabled = true; try {await fn();} catch (error) {status(error.message);} finally {button.disabled = false;}}
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
    if (data.site) {text(el("hosting-site"),"h3",`${data.site.slug}.scriptnovaa.com · ${data.site.status}`); if(data.site.reviewReason) text(el("hosting-site"),"p",data.site.reviewReason); for(const record of data.site.dns) text(el("hosting-site"),"code",`${record.type} ${record.name}\n${record.value}`); if(data.site.customDomain) text(el("hosting-site"),"p", data.site.domainVerifiedAt ? "DNS verified. Hosting and HTTPS approval are separate." : "DNS not verified yet."); el("launch-slug").value=data.site.slug;}
    el("program-admin").hidden = !data.administrator;
    if (data.site?.customDomain) {
      const help = text(el("hosting-site"), "section", "");
      text(help, "h4", "How to enter these records in Namecheap");
      text(help, "p", "The names above are full DNS names, not necessarily the Host text to paste. Namecheap adds the domain you are managing automatically. Remove that domain and its preceding dot from each Host; use @ when nothing remains. Keep the entire Value unchanged.");
      text(help, "p", "Example: while managing example.com, play.example.com uses CNAME Host play, and _scriptnovaa.play.example.com uses TXT Host _scriptnovaa.play. For example.com itself, the TXT Host is _scriptnovaa.");
      text(help, "p", "Recommended: use a subdomain such as play.example.com to keep your existing website and email unchanged. Do not add a CNAME beside A or AAAA records at the same name. Root-domain routing needs provider-specific setup; our current automated check expects a visible CNAME and cannot verify flattened ALIAS records.");
      text(help, "h4", "DNS is only the first step");
      text(help, "p", "1. Save the two records at your authoritative DNS provider and check them here. 2. ScriptNovaa staff must attach your exact hostname to the hosting service and provision HTTPS. 3. An administrator activates the reservation. 4. Start Galaxy and use Open timed site. Adding DNS alone does not upload your old website or activate hosting.");
    }
    if(data.administrator) await reviews();
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
  el("hosting-form").onsubmit=e=>{e.preventDefault();action(e.currentTarget.querySelector("button"),async()=>{await send("/api/developer/site",{slug:el("hosting-slug").value,customDomain:el("hosting-domain").value});await load();});};
  el("verify-domain").onclick=()=>action(el("verify-domain"),async()=>{await send("/api/developer/domain/verify",{});await load();});
  el("review-refresh").onclick=()=>action(el("review-refresh"),reviews);
  el("hosting-launch").onsubmit=e=>{e.preventDefault();action(e.currentTarget.querySelector("button"),async()=>{const result=await send("/api/hosting/launch",{slug:el("launch-slug").value});el("hosting-link").replaceChildren();const link=text(el("hosting-link"),"a","Open your timed site (keep this private)");link.href=result.url;link.target="_blank";link.rel="noopener noreferrer";});};
  const target=new URLSearchParams(location.search).get("site");if(target)el("launch-slug").value=target;
  load().catch(error=>{status(error.message === "SIGNED_OUT" ? "Sign in to apply and manage your space." : "The portal could not load. Check your connection and that the updated API is deployed.");el("portal-signin").hidden=false;});
})();
