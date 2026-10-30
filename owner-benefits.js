'use strict';
(()=>{
 const $=s=>document.querySelector(s),w=window.NebulaWorkspace,section=$('#owner-limit-gifts');if(!section||!w)return;let version=0;
 async function access(){const v=++version;section.hidden=true;if(!w.account?.emailVerified)return;try{const r=await w.api('/developer/access');if(v===version)section.hidden=!r.owner;}catch{}}
 $('#owner-reset-expiry').value=new Date(Date.now()+86400000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('#owner-reset-form').onsubmit=async e=>{e.preventDefault();const v=version,b=e.submitter;b.disabled=true;try{const r=await w.api('/developer-platform/reset',{method:'POST',body:JSON.stringify({email:$('#owner-reset-email').value.trim(),scope:$('#owner-reset-scope').value,expiresAt:new Date($('#owner-reset-expiry').value).getTime()})});if(v===version)$('#owner-reset-status').textContent='Gifted a temporary '+r.gift.scope+' reset until '+new Date(r.gift.expiresAt).toLocaleString()+'.';}catch(e){if(v===version)$('#owner-reset-status').textContent=e.code==='ACCOUNT_NOT_FOUND'?'No account was found for that email.':'The gift could not be saved. Check the email and expiry.';}finally{b.disabled=false;}};
 window.addEventListener('nebula:account-change',()=>{section.hidden=true;$('#owner-reset-status').textContent='';access();});access();
})();
