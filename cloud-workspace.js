(()=>{'use strict';
 const $=s=>document.querySelector(s),w=window.NebulaWorkspace;
 let busy=false,owner=w.account?.uid||null,controller=null,lastResult=null;
 const errors={DNS_NOT_FOUND:'This hostname was not found in DNS. Check the spelling and whether the www subdomain exists.',DNS_TIMEOUT:'The website DNS lookup timed out.',SOURCE_TIMEOUT:'The website did not respond before the time limit.',SOURCE_CONNECTION_FAILED:'The connection to this website failed.',TLS_UNAVAILABLE:'The HTTPS certificate or connection could not be verified.',REDIRECT_LIMIT:'The website redirected too many times.',REDIRECT_LOOP:'The website returned a redirect loop.',PUBLIC_URL_BLOCKED:'Only approved public network addresses can be inspected.',INVALID_PUBLIC_URL:'Enter a public HTTPS URL without credentials.',CLOUD_BROWSER_UNAVAILABLE:'Rendered browsing could not start.',PLAN_LIMIT:'Your allowance is used. Open Usage for the reset time.',ACCOUNT_TIER_REQUIRED:'This inspection requires D2 access through the owner account or an active invitation.',DUPLICATE_TURN:'This action was already submitted. Refresh the workspace to check its saved result.'};
 const status=text=>$('#cloud-environment-status').textContent=text;
 function download(value,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 function show(result){
  lastResult=result;$('#cloud-export-report').disabled=false;const out=$('#cloud-environment-results');out.replaceChildren();
  const title=document.createElement('p');title.textContent=result.fallbackUsed?'Source-only recovery succeeded. JavaScript, console and live API activity were not inspected.':result.mode==='rendered-public-page'?'Rendered page inspection completed.':'Public-source analysis completed.';out.append(title);
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy report';copy.onclick=()=>navigator.clipboard.writeText(JSON.stringify(result,null,2)).catch(()=>status('Select the report to copy it.'));out.append(copy);
  for(const [key,value]of Object.entries(result)){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=key;details.open=['stdout','text','title','exitCode','stderr','notice','error','message'].includes(key);pre.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);details.append(summary,pre);out.append(details);}
 }
 async function refresh(){
  if(!w.account){status('Sign in to open your workspace.');return;}const uid=w.account.uid;
  try{const d=await w.api('/cloud/environment');if(w.account?.uid!==uid)return;
   status(d.enabled?'Workspace connected. Page analysis and comparison are ready; rendered inspection has source-only recovery.':'Cloud environment is being connected.');
   $('#cloud-run-code').disabled=!d.enabled;$('#cloud-inspect-page').disabled=!d.enabled||!(d.liveBrowser||d.sourceFallback);$('#cloud-analyze-page').disabled=!d.enabled||!d.pageAnalysis;$('#cloud-compare-pages').disabled=!d.enabled||!d.pageComparison;
   const list=$('#cloud-file-list');list.replaceChildren();
   for(const file of d.files||[]){const b=document.createElement('button');b.type='button';b.textContent=file.path;b.onclick=()=>{$('#cloud-file-path').value=file.path;$('#cloud-code').value=file.content;};list.append(b);}
   for(const h of (d.history||[]).slice(0,6)){const details=document.createElement('details'),title=document.createElement('summary'),pre=document.createElement('pre');title.textContent=h.kind+' · '+(h.status||'completed')+' · '+new Date(h.createdAt).toLocaleString();pre.textContent=JSON.stringify(h.result,null,2);details.append(title,pre);list.append(details);}
  }catch{status('Workspace could not connect. Your account is still signed in. Try Open workspace again.');}
 }
 async function run(kind){
  if(busy||!w.account)return;const url=$('#cloud-page-url').value.trim(),secondUrl=$('#cloud-second-url').value.trim();
  if(kind!=='code'&&(!url||kind==='compare'&&!secondUrl)){status('Enter '+(kind==='compare'?'both public HTTPS page URLs.':'a public HTTPS page URL.'));return;}
  busy=true;controller=new AbortController();const actionController=controller,uid=w.account.uid;$('#cloud-stop-action').hidden=false;
  status(kind==='inspect'?'Opening the page. A source-only fallback is available if rendering cannot start…':kind==='code'?'Running in your isolated environment…':'Reading public page information…');
  try{const body=kind==='code'?{kind,language:$('#cloud-code-language').value,code:$('#cloud-code').value}:{kind,url,...(kind==='compare'?{secondUrl}:{})};
   const d=await w.api('/cloud/environment/run',{method:'POST',signal:AbortSignal.any([actionController.signal,AbortSignal.timeout(65000)]),headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});
   if(w.account?.uid!==uid)return;show(d.result);status('Finished · '+(d.creditsUsed??4)+' credit'+((d.creditsUsed??4)===1?'':'s')+' used'+(d.result.fallbackUsed?' · source-only recovery.':'.'));await w.refreshUsage();
  }catch(e){if(w.account?.uid===uid)status(actionController.signal.aborted?'Action stopped. Refresh the workspace to check whether a result was saved.':(errors[e.code]||'This action could not finish.')+(e.code?' ('+e.code+')':''));}
  finally{busy=false;controller=null;$('#cloud-stop-action').hidden=true;}
 }
 $('#cloud-workspace-refresh').onclick=refresh;$('#cloud-run-code').onclick=()=>run('code');$('#cloud-inspect-page').onclick=()=>run('inspect');$('#cloud-analyze-page').onclick=()=>run('analyze');$('#cloud-compare-pages').onclick=()=>run('compare');
 $('#cloud-stop-action').onclick=()=>controller?.abort();
 $('#cloud-export-report').onclick=()=>{if(lastResult)download(JSON.stringify({exportedAt:new Date().toISOString(),result:lastResult},null,2),'nebula-cloud-report.json');};
 $('#cloud-save-file').onclick=async()=>{try{await w.api('/cloud/environment/file',{method:'POST',body:JSON.stringify({path:$('#cloud-file-path').value,content:$('#cloud-code').value})});await refresh();status('File saved to your account workspace.');}catch(e){status(e.code==='CLOUD_FILE_LIMIT'?'Workspace limit: 20 files and 500 KB total. Download a copy.':'Use a simple file name and keep files under 100 KB.');}};
 $('#cloud-download-file').onclick=()=>download($('#cloud-code').value,$('#cloud-file-path').value.split('/').at(-1)||'nebula-code.txt');
 window.addEventListener('nebula:account-change',()=>{const next=w.account?.uid||null;if(next===owner)return;owner=next;controller?.abort();lastResult=null;$('#cloud-export-report').disabled=true;$('#cloud-code').value='';$('#cloud-file-path').value='';$('#cloud-file-list').replaceChildren();$('#cloud-environment-results').replaceChildren();status('');});
})();
