'use strict';

const $=id=>document.getElementById(id),API='https://api.scriptnovaa.com';

const remote=window.ScriptNovaaRemote;

let reportQuery='',reportFilter='all';
let token=window.ScriptNovaaAuth?.token()||'',grant='',remoteDevice='',refreshing=false,settingsDirty=false,savingSettings=false;

const SESSION_KEY='scriptnovaaFamilySessionV1';

function forget(){localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);}

function showLogin(){grant='';remote.clear();$('dashboard').hidden=true;$('login').hidden=false;$('logout').hidden=true;}

function showDashboard(){$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;}

async function api(path,body){const r=await fetch(API+'/api/family/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'X-Family-Grant':grant},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const b=await r.json();if(!r.ok){if(r.status===401||r.status===403){forget();showLogin();}throw Error(b.error||b.message||'Request failed.');}return b;}

remote.init(api,message=>{$('message').textContent=message;});

async function action(fn){$('message').textContent='';try{await fn();}catch(e){$('message').textContent=e.message;}}

async function unlock(login){const remember=$('remember').checked;if(login){const r=await fetch(API+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value.trim(),pin:$('pin').value,clientDescription:'ScriptNovaa parent dashboard'})});const b=await r.json();if(!r.ok||!b.loginToken)throw Error(b.error||'Sign-in failed.');token=b.loginToken;window.ScriptNovaaAuth?.save(token,remember);}if(!token)throw Error('Sign in with your account first.');let b;try{b=await api('unlock',{pin:$('pin').value,remember});}finally{$('pin').value='';}grant=b.grant;forget();(remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify({token,grant,expires:b.expires}));showDashboard();await refresh();}

$('signin').onclick=()=>action(()=>unlock(true));$('unlock').onclick=()=>action(()=>unlock(false));

$('logout').onclick=()=>action(async()=>{try{await remote.stop();await api('lock',{});}finally{forget();window.ScriptNovaaAuth?.clear(token);token='';showLogin();$('devices').replaceChildren();}});

$('pair').onclick=()=>action(async()=>{$('code').textContent=(await api('pairing',{})).code;});

$('test-pair').onclick=()=>action(async()=>{$('test-code').textContent=(await api('pairing',{test:true})).code;$('message').textContent='Test code ready. Paste it into the app’s Test this PC with the website dashboard screen.';});

$('copy-test-code').onclick=()=>action(async()=>{const code=$('test-code').textContent;if(!code)throw Error('Create a test code first.');await navigator.clipboard.writeText(code);$('message').textContent='Test code copied.';});

async function saveSettings(){settingsDirty=true;if(savingSettings)return;savingSettings=true;try{do{settingsDirty=false;const automaticReview=$('automatic').checked;$('settings-status').textContent='Saving…';try{await api('settings',{automaticReview});}catch(e){settingsDirty=true;$('settings-status').textContent='Not saved — '+e.message;throw e;}}while(settingsDirty);$('settings-status').textContent='Saved to your family account.';}finally{savingSettings=false;}}

$('automatic').onchange=()=>action(saveSettings);$('save').onclick=()=>action(saveSettings);

$('refresh').onclick=()=>action(refresh);$('report-search').oninput=()=>{reportQuery=$('report-search').value.toLowerCase();action(refresh);};$('report-filter').onchange=()=>{reportFilter=$('report-filter').value;action(refresh);};

async function restore(){try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null');if(saved&&saved.token===token&&saved.expires>Date.now()/1000){grant=saved.grant;await refresh();if(grant)showDashboard();}else forget();}catch(e){$('message').textContent=e.message;}}

restore();

function text(tag,value,cls){const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;}

function button(label,fn,cls='secondary'){const n=text('button',label,cls);n.onclick=()=>action(async()=>{n.disabled=true;try{await fn();await refresh();}finally{n.disabled=false;}});return n;}

async function refresh(){if(!grant||refreshing)return;refreshing=true;try{const state=await api('state');remote.update(state.devices);if(!settingsDirty&&!savingSettings)$('automatic').checked=state.settings.automaticReview===true;const fragment=document.createDocumentFragment();

for(const d of state.devices){const card=text('section','','card'),title=text('div','','device-title');title.append(text('h3',d.name),text('span',Date.now()/1000-d.lastSeen<20?'Connected':'Offline',Date.now()/1000-d.lastSeen<20?'badge':'badge offline'));card.append(title,text('p','Screen: '+(d.status.screen||'Not reported')+'\nAudio: '+(d.status.audio||'Not reported')+'\nCaptions: '+(d.status.captions||'No completed English captions received')+'\nExtension: '+(d.status.extension?'Connected':'Not connected')+(d.status.error?'\n'+d.status.error:'')+'\nApp: '+(d.version||'Unknown')+'\nUpdates: '+(d.status.updates||'Update status not reported — install 0.3.0'),'details'));

card.append(window.ScriptNovaaControls.build(d,api,refresh,text,button));
if(d.test)card.append(text('p','Same-PC test: viewing this screen creates a mirror. Keep keyboard capture off while using this dashboard on the same PC.','small'));

card.append(button('Send connection test',()=>api('test/alert',{device:d.id})));if(d.test)card.append(button('Stop same-PC test',()=>api('test/stop',{device:d.id}),'danger'));

card.append(button('Dismiss alerts',()=>api('dismiss',{device:d.id})),button(d.remote.until>Date.now()/1000?'Stop remote assistance':'Start remote assistance',async()=>{const start=!(d.remote.until>Date.now()/1000);await api('remote/'+(start?'start':'stop'),{device:d.id});remoteDevice=start?d.id:'';if(start)remote.open({...d,remote:{until:Date.now()/1000+300},frame:null});else remote.clear();}));

if(d.remote.until>Date.now()/1000)card.append(button('Open large remote view',()=>{remoteDevice=d.id;remote.open(d);}));

const blocks=text('details','');blocks.append(text('summary',d.blocks.length+' active blocking rules'));for(const b of d.blocks){const row=text('article','');row.append(text('p',b.domain?'Whole site: '+b.domain:b.url),text('p',b.reason,'small'),button('Remove this block',()=>api('unblock',{device:d.id,key:b.key}),'danger'));blocks.append(row);}card.append(blocks);

for(const e of d.events.filter(e=>['nudity','profanity','test','needs_review'].includes(e.kind)&&(reportFilter==='all'||e.kind===reportFilter)&&[d.name,e.kind,e.url,e.detail,new Date(e.received*1000).toLocaleString()].join(' ').toLowerCase().includes(reportQuery))){const row=text('article',''),review=d.reviews[e.id];row.append(text('strong',e.kind==='needs_review'?(review?'Uncertain finding — reviewed by parent':'Needs parent review — no automatic block'):e.kind==='test'?'Connection test':e.kind==='nudity'?'Nudity alert':'Profanity alert'),text('p',e.url||'No browser page identified','small'),text('p','Why: '+e.detail,'small'),text('p',(e.methods?.length?'Checks: '+e.methods.join(' + '):'')+(e.frames?' · '+e.frames+' frames':'')+(e.monitor?' · Monitor '+e.monitor:''),'small'),text('p',new Date(e.received*1000).toLocaleString()+(review?' · '+review.message:''),'small'));if(e.kind!=='test')row.append(button(e.kind==='needs_review'?'Dismiss finding':'Approve report',()=>api('decision',{device:d.id,event:e.id,approve:true})),button(e.kind==='needs_review'?'Confirm and block':'Decline review',()=>api('decision',{device:d.id,event:e.id,approve:false})));card.append(row);}

fragment.append(card);}if(!state.devices.length)fragment.append(text('p','No computers paired yet. Create a pairing code to get started.'));$('devices').replaceChildren(fragment);

}finally{refreshing=false;}}

// Do not rebuild inputs during typing. Active remote sessions refresh more often.

setInterval(()=>{if(grant&&(remote.active||!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('#devices details[open]')))action(refresh);},2000);

