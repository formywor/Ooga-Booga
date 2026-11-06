'use strict';
(()=>{
 const $=selector=>document.querySelector(selector);
 const labels={website:'Website',api:'Developer API',open:'Nebula Open'};
 const scopeLabel=scopes=>scopes.map(scope=>labels[scope]).join(' + ');
 const date=time=>new Date(time).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
 window.NebulaResetForm=(form,api,status,accountVersion)=>{
  const audience=form.elements.namedItem('audience'),email=form.elements.namedItem('email'),expiry=form.elements.namedItem('expiresAt');
  const update=()=>{email.closest('label').hidden=audience.value!=='email';email.required=audience.value==='email';email.disabled=!email.required;};
  audience.onchange=update;update();
  const tomorrow=new Date(Date.now()+86400000);
  expiry.value=new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,16);
  form.onsubmit=async event=>{
   event.preventDefault();
   const button=event.submitter||form.querySelector('[type=submit]'),version=accountVersion(),fields=new FormData(form),scopes=fields.getAll('scope');
   if(!scopes.length){status('Choose at least one allowance to reset.');return;}
   button.disabled=true;
   try{
    const {gift}=await api('/developer-platform/reset-offers',{method:'POST',body:JSON.stringify({audience:audience.value,email:email.disabled?undefined:email.value.trim(),scopes,expiresAt:new Date(expiry.value).getTime()})});
    if(version===accountVersion())status(scopeLabel(gift.scopes)+' reset offered. Recipients can use it in Usage before '+date(gift.expiresAt)+'.');
   }catch(error){
    if(version===accountVersion())status(({ACCOUNT_NOT_FOUND:'No account was found for that email.',RESET_OFFER_LIMIT:'The active gift limit has been reached.'})[error.code]||'The gift could not be saved. Check the audience and expiration.');
   }finally{button.disabled=false;}
  };
 };

 const w=window.NebulaWorkspace,section=$('#owner-limit-gifts'),inbox=$('#reset-gifts');
 if(!w||!section||!inbox)return;
 let version=0;
 async function access(){
  const current=++version;
  section.hidden=true;
  if(!w.account?.emailVerified)return;
  try{const result=await w.api('/developer/access');if(current===version)section.hidden=!result.owner;}catch{}
 }
 window.NebulaResetForm($('#owner-reset-form'),w.api,text=>{$('#owner-reset-status').textContent=text;},()=>version);
 const list=$('#reset-gift-list'),message=$('#reset-gift-status');
 const pending=new Set(),redeemed=new Set();
 function render(gifts){
  list.replaceChildren();
  for(const gift of gifts){
   if(gift.expiresAt<=Date.now()||redeemed.has(gift.id))continue;
   const row=document.createElement('li'),description=document.createElement('div'),title=document.createElement('strong'),expiry=document.createElement('small'),button=document.createElement('button');
   title.textContent=scopeLabel(gift.scopes)+' reset';
   expiry.textContent='Expires '+date(gift.expiresAt);
   button.type='button';button.textContent='Use reset';
   button.setAttribute('aria-label','Use '+title.textContent);
   button.disabled=pending.has(gift.id);
   description.append(title,expiry);row.append(description,button);list.append(row);
   button.onclick=async()=>{
    const current=version;
    button.disabled=true;pending.add(gift.id);message.textContent='';
    try{
     const result=await w.api('/reset-gifts',{method:'POST',body:JSON.stringify({id:gift.id})});
     if(current!==version)return;
     redeemed.add(gift.id);render(gifts);
     message.textContent=scopeLabel(result.scopes)+' allowance reset.';
     await w.refreshUsage();
    }catch(error){
     if(current===version)message.textContent=error.code==='RESET_NOT_AVAILABLE'?'This reset expired or no longer matches your account.':'Could not use the reset. Try again.';
    }finally{if(current===version){pending.delete(gift.id);button.disabled=false;}}
   };
  }
  if(!list.children.length){const empty=document.createElement('li');empty.className='field-help';empty.textContent='No resets available.';list.append(empty);}
 }
 window.addEventListener('nebula:usage',event=>{
  inbox.hidden=!w.account;
  render(event.detail?.resetGifts||[]);
 });
 window.addEventListener('nebula:account-change',()=>{
  inbox.hidden=!w.account;pending.clear();redeemed.clear();render([]);message.textContent='';$('#owner-reset-status').textContent='';access();
 });
 access();
})();
