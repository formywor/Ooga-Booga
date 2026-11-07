import {API,publicUrl,safeUrl,mask,writes,sessionAllows,boundedResult} from './protocol.mjs';
let busy=false,timer=null,lastFinishedTask=null;
const storageReady=Promise.all([chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
const connectionFields=['deviceId','token','name','code','pairExpires','expiresAt','enabled','paired','grantedOrigins','protocolVersion'];
async function state(){await storageReady;const saved=(await chrome.storage.local.get('pc')).pc;if(saved){const runtime=(await chrome.storage.session.get('pcRuntime')).pcRuntime;return {...saved,tabs:[],selectedTab:null,seen:{},network:[],...(runtime?.deviceId===saved.deviceId?runtime:{})};}return (await chrome.storage.session.get('pc')).pc;}
async function writeState(pc){await storageReady;if(pc.protocolVersion<2){await chrome.storage.session.set({pc});return;}const saved=Object.fromEntries(connectionFields.filter(k=>pc[k]!==undefined).map(k=>[k,pc[k]]));await chrome.storage.local.set({pc:saved});await chrome.storage.session.set({pcRuntime:{deviceId:pc.deviceId,tabs:pc.tabs||[],selectedTab:pc.selectedTab??null,seen:pc.seen||{},network:pc.network||[],error:pc.error||null}});await chrome.storage.session.remove('pc');}
let updateQueue=Promise.resolve();
const mutate=fn=>{const next=updateQueue.then(async()=>{const old=await state(),pc=fn(old);if(pc)await writeState(pc);return pc;});updateQueue=next.catch(()=>{});return next;};
async function api(path,body,s){const r=await fetch(API+path,{credentials:'omit',redirect:'error',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(s?.token?{Authorization:'Bearer '+s.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok)throw Error(d.code||'PC_UNAVAILABLE');return d;}
async function badge(text,color='#7c55c7'){await chrome.action.setBadgeText({text});await chrome.action.setBadgeBackgroundColor({color});}
async function stop(){trafficRows=[];clearTimeout(trafficTimer);trafficTimer=null;const s=await state();clearTimeout(timer);await chrome.alarms.clear('nebula-pc');if(s?.enabled){await mutate(old=>old?{...old,enabled:false,token:null,network:[],seen:{},tabs:[],error:'PC_STOPPED'}:old);for(const id of s.tabs||[])await chrome.scripting.executeScript({target:{tabId:id},func:()=>globalThis.__nebulaPc?.stop()}).catch(()=>{});if(s.token)await api('/agent/'+s.deviceId+'/stop',{},s).catch(()=>{});if(s.grantedOrigins)await chrome.permissions.remove({origins:s.grantedOrigins}).catch(()=>{});}await badge('');}
async function allowed(tabId,s,observed){if(!(s.tabs||[]).includes(tabId))throw Error('PC_TAB_NOT_APPROVED');const tab=observed||await chrome.tabs.get(tabId).catch(()=>null);if(!tab)throw Error('PC_TAB_NOT_APPROVED');const u=publicUrl(tab.pendingUrl||tab.url);if(!sessionAllows(u.href,s.grantedOrigins)||!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('PC_SITE_PERMISSION_REQUIRED');return tab;}
async function readyTab(tabId,s,signal,timeoutMs=10000){
 const deadline=Date.now()+timeoutMs;
 do{
  signal?.throwIfAborted();
  if(!s.tabs.includes(tabId))throw Error('PC_TAB_NOT_APPROVED');
  const tab=await chrome.tabs.get(tabId).catch(()=>null);
  if(!tab)throw Error('PC_TAB_NOT_APPROVED');
  if(!tab.pendingUrl&&tab.status!=='loading')return allowed(tabId,s,tab);
  await new Promise(resolve=>setTimeout(resolve,250));
 }while(Date.now()<deadline);
 throw Error('PC_PAGE_LOAD_TIMEOUT');
}
async function content(tabId,command,signal){signal?.throwIfAborted();await chrome.scripting.executeScript({target:{tabId},files:['content.js'],world:'ISOLATED'});signal?.throwIfAborted();const r=await chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',func:command=>globalThis.__nebulaPc.run(command),args:[command]});const result=r[0]?.result;if(!result?.ok)throw Error(result?.error||'PC_ACTION_FAILED');return result;}
async function execute(job,s,signal){signal?.throwIfAborted();const a=job.args||{};if((writes(job.action)||job.action==='close_tab')&&!job.approvedAt)throw Error('PC_APPROVAL_REQUIRED');await api('/agent/'+s.deviceId+'/validate',{jobId:job.id,lease:job.lease},s);signal?.throwIfAborted();
 if(job.action==='open_tabs'){
  if(!Number.isInteger(a.count)||a.count<1||a.count>8)throw Error('INVALID_PC_ACTION');
  let opened=0;
  for(let i=0;i<a.count;i++){
   signal?.throwIfAborted();
   const current=await state();
   if(!current?.enabled||current.token!==s.token)break;
   try{await chrome.tabs.create({active:i===a.count-1});opened++;}catch{break;}
  }
  return {opened};
 }
 if(job.action==='tabs'){const tabs=[];for(const id of s.tabs||[]){try{const t=await allowed(id,s);tabs.push({tabId:id,title:mask(t.title||''),url:safeUrl(t.url),selected:id===s.selectedTab});}catch{}}return {tabs};}
 if(job.action==='navigate'){const u=publicUrl(a.url);if(!sessionAllows(u.href,s.grantedOrigins)||!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('PC_SITE_PERMISSION_REQUIRED');const selected=a.newTab||s.selectedTab==null?null:await allowed(s.selectedTab,s).catch(error=>{if(!['PC_TAB_NOT_APPROVED','PC_SITE_PERMISSION_REQUIRED','PC_URL_BLOCKED'].includes(error.message))throw error;return null;});
  let tabId;
  if(a.newTab||!selected){
   const existing=(await Promise.all(s.tabs.map(id=>chrome.tabs.get(id).catch(()=>null)))).filter(Boolean);
   if(existing.length>=8)throw Error('PC_TAB_LIMIT');
   const tab=await chrome.tabs.create({url:u.href,active:true});
   tabId=tab.id;
   const updated=await mutate(old=>old?.enabled&&old.token===s.token?{...old,tabs:[...new Set([...old.tabs.filter(id=>existing.some(t=>t.id===id)||!s.tabs.includes(id)),tabId])],selectedTab:tabId}:old);
   if(!updated?.enabled||updated.token!==s.token)throw Error('PC_STOPPED');
   s=updated;
  }else{
   tabId=selected.id;await chrome.tabs.update(tabId,{url:u.href,active:true});
  }
  const tab=await readyTab(tabId,s,signal);
  return {tabId,url:safeUrl(tab.url),readyState:'complete',notice:'The browser finished loading. Inspect the page for its current controls.'};}
 const tabId=a.tabId??s.selectedTab;signal?.throwIfAborted();
 if(!['wait_for_page','inspect','find_text'].includes(job.action))await allowed(tabId,s);if(job.action==='close_tab'){await chrome.tabs.remove(tabId);const remaining=(s.tabs||[]).filter(id=>id!==tabId);await mutate(old=>old?.enabled&&old.token===s.token?{...old,tabs:remaining,selectedTab:old.selectedTab===tabId?null:old.selectedTab}:old);return {closed:true,tabId,notice:'The approved tab was closed. This does not prove any earlier form was submitted.'};}
 if(job.action==='reload'){await chrome.tabs.reload(tabId);const tab=await readyTab(tabId,s,signal);return {tabId,url:safeUrl(tab.url),readyState:'complete',reloaded:true};}
 if(job.action==='select_tab'){await chrome.tabs.update(tabId,{active:true});s.selectedTab=tabId;await mutate(old=>old?.enabled&&old.token===s.token?{...old,selectedTab:tabId}:old);return {selectedTab:tabId};}
 if(job.action==='wait_for_page'){
  const timeout=a.timeoutMs||6000,until=Date.now()+timeout;
  await readyTab(tabId,s,signal,timeout);
  let result;
  do{
   result=await content(tabId,{action:'page_status',args:{}},signal);
   if(!a.text||result.text.toLowerCase().includes(a.text.toLowerCase()))return {tabId,...result,matched:true};
   await new Promise(resolve=>setTimeout(resolve,500));
  }while(Date.now()<until);
  return {tabId,...result,matched:false,notice:'The page loaded, but the requested text did not appear.'};
 }
 if(job.action==='inspect'||job.action==='inspect_form'||job.action==='find_text')await readyTab(tabId,s,signal);
 if(writes(job.action)||job.action==='hover'){
  await chrome.tabs.update(tabId,{active:true});
  const current=await mutate(old=>old?.enabled&&old.token===s.token?{...old,selectedTab:tabId}:old);
  if(!current?.enabled||current.token!==s.token)throw Error('PC_STOPPED');
  signal?.throwIfAborted();
 }
 const result=await content(tabId,job,signal);if(['inspect','inspect_form'].includes(job.action)){const latest=await state();result.tabId=tabId;result.network=(latest?.network||[]).filter(n=>n.tabId===tabId).slice(-40);result.networkNotice='Only requests observed since connection and allowed by Chrome permissions. No headers or bodies. This is your signed-in browser traffic, not other users or hidden server calls.';}return result;
}
async function executeBounded(job,s){const control=new AbortController();let timeout;try{return await Promise.race([execute(job,s,control.signal),new Promise((_,reject)=>{timeout=setTimeout(()=>{control.abort();reject(Error('PC_ACTION_TIMEOUT'));},20000);})]);}finally{clearTimeout(timeout);}}
async function poll(){if(busy)return;busy=true;let s=await state();try{if(!s?.enabled||!s.token)return;if(!s.paired){const status=await api('/agent/'+s.deviceId+'/status',undefined,s);if(!status.paired)return;s={...s,paired:true,expiresAt:status.expiresAt};await mutate(old=>old?.enabled&&old.token===s.token?{...old,paired:true,expiresAt:status.expiresAt}:old);}if(Date.now()>=s.expiresAt){await stop();return;}for(const [id,prior]of Object.entries(s.seen||{})){if(prior.pendingDelivery){try{await api('/agent/'+s.deviceId+'/result',{jobId:id,lease:prior.lease,result:prior.result||null,error:prior.error||null},s);await mutate(old=>old?.token===s.token?{...old,seen:{...old.seen,[id]:{...prior,pendingDelivery:false}}}:old);}catch{}}}const d=await api('/agent/'+s.deviceId+'/poll',{},s);await badge('ON');
 if(d.task&&['finished','canceled'].includes(d.task.status)&&d.task.id!==lastFinishedTask){
  for(const tabId of s.tabs||[])await chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',func:()=>globalThis.__nebulaPc?.finish()}).catch(()=>{});
  lastFinishedTask=d.task.id;
 }
 if(d.task&&['active','waiting'].includes(d.task.status))lastFinishedTask=null;
 if(!d.job)return;const job=d.job,seen=s.seen||{};
  if(seen[job.id]){const prior=seen[job.id];await api('/agent/'+s.deviceId+'/result',{jobId:job.id,lease:job.lease,result:prior.result||null,error:prior.result?null:prior.error||'PC_ACTION_INTERRUPTED'},s);return;}
  seen[job.id]={attemptedAt:Date.now()};await mutate(old=>old?.enabled&&old.token===s.token?{...old,seen:{...old.seen,[job.id]:seen[job.id]}}:old);let result=null,error=null;try{result=boundedResult(await executeBounded(job,{...s,seen}));}catch(e){error=/^[A-Z_]{1,70}$/.test(e.message)?e.message:'PC_ACTION_FAILED';}
  s=await state();if(!s?.enabled)return;s.seen={...s.seen,[job.id]:{result,error,lease:job.lease,pendingDelivery:true}};s.seen=Object.fromEntries(Object.entries(s.seen).slice(-120));await mutate(old=>old?.enabled&&old.token===s.token?{...old,seen:s.seen}:old);await api('/agent/'+s.deviceId+'/result',{jobId:job.id,lease:job.lease,result,error},s);await mutate(old=>old?.token===s.token?{...old,seen:{...old.seen,[job.id]:{result,error,lease:job.lease,pendingDelivery:false}}}:old);
 }catch(e){if((await state())?.enabled&&s?.token===(await state())?.token){if(['PC_SESSION_EXPIRED','UNAUTHORIZED'].includes(e.message)){await stop();return;}await mutate(old=>old?.enabled&&old.token===s.token?{...old,error:e.message}:old);await badge('!', '#ac6733');}}
 finally{busy=false;clearTimeout(timer);if((await state())?.enabled)timer=setTimeout(poll,4000);}}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{if(sender.id!==chrome.runtime.id)return;if(sender.tab){if(m.type==='STOP')stop().then(()=>respond({ok:true}));return true;}const task=async()=>{
 if(m.type==='STOP'){await stop();return {ok:true};}if(m.type==='STATE'){const s=await state();return s?{enabled:s.enabled,paired:s.paired,name:s.name,code:s.code,expiresAt:s.expiresAt,error:s.error}:{enabled:false};}
 if(m.type==='USE_TAB'){
  const current=await state();
  if(!current?.enabled||!current.paired||Date.now()>=current.expiresAt)throw Error('PC_SESSION_EXPIRED');
  const tab=await chrome.tabs.get(m.tabId),u=publicUrl(tab.url);
  if(!sessionAllows(u.href,current.grantedOrigins)||!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('PC_SITE_PERMISSION_REQUIRED');
  const active=(await Promise.all(current.tabs.map(id=>chrome.tabs.get(id).catch(()=>null)))).filter(Boolean);
  const next=await mutate(old=>{
   if(!old?.enabled||old.token!==current.token)return old;
   const tabs=old.tabs.filter(id=>active.some(t=>t.id===id)||!current.tabs.includes(id));
   if(!tabs.includes(tab.id)&&tabs.length>=8)throw Error('PC_TAB_LIMIT');
   return {...old,tabs:[...new Set([...tabs,tab.id])],selectedTab:tab.id,error:null};
  });
  if(!next?.enabled||next.token!==current.token)throw Error('PC_STOPPED');
  return {ok:true};
 }
 if(m.type==='START'){if((await state())?.enabled)throw Error('PC_ALREADY_CONNECTED');await stop();const p=await api('/pair/start',{name:m.name||'My computer',protocolVersion:5});const pc={...p,name:m.name||'My computer',enabled:true,paired:false,selectedTab:m.tabId,tabs:[m.tabId],grantedOrigins:m.origins,seen:{},network:[]};await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await writeState(pc);await chrome.alarms.create('nebula-pc',{periodInMinutes:.5});poll();return {code:p.code};}throw Error('INVALID_INPUT');};task().then(respond).catch(e=>respond({error:e.message}));return true;});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='nebula-pc')poll();});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='complete')state().then(async s=>{if(s?.enabled&&s.paired&&s.tabs.includes(id)&&Date.now()<s.expiresAt){try{await allowed(id,s);await chrome.scripting.executeScript({target:{tabId:id},files:['content.js'],world:'ISOLATED'});}catch{}}});});
let trafficRows=[],trafficTimer=null;
async function traffic(d,error){trafficRows.push({tabId:d.tabId,url:safeUrl(d.url),method:d.method,status:d.statusCode||null,error:error?'REQUEST_FAILED':null,time:new Date(d.timeStamp).toISOString(),notice:'Authenticated browser context; response bodies and headers not captured.'});trafficRows=trafficRows.slice(-80);if(trafficTimer!==null)return;trafficTimer=setTimeout(async()=>{trafficTimer=null;const rows=trafficRows;trafficRows=[];await mutate(old=>old?.enabled&&old.paired&&Date.now()<old.expiresAt?{...old,network:[...(old.network||[]),...rows.filter(row=>old.tabs.includes(row.tabId))].slice(-80)}:old);},500);}

chrome.webRequest.onCompleted.addListener(d=>{traffic(d,false);},{urls:['https://*/*']});chrome.webRequest.onErrorOccurred.addListener(d=>{traffic(d,true);},{urls:['https://*/*']});

async function reconnect(){const s=await state();if(s?.enabled){if(s.expiresAt&&s.expiresAt<=Date.now()){await stop();return;}if(s.paired&&s.protocolVersion>=2&&s.protocolVersion<5){try{await api('/agent/'+s.deviceId+'/upgrade',{protocolVersion:5},s);await mutate(old=>old?.enabled&&old.token===s.token?{...old,protocolVersion:5}:old);}catch{}}await chrome.alarms.create('nebula-pc',{periodInMinutes:.5});poll();}}
chrome.runtime.onStartup.addListener(reconnect);reconnect();
