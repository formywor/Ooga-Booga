'use strict';
((root)=>{
 const policy={
  cooldownSeconds(errorCode){return errorCode==='auth/too-many-requests'?300:60;},
  remaining(until,now=Date.now()){return Math.max(0,Math.ceil(((Number(until)||0)-now)/1000));},
  returnPath(value){try{const u=new URL(value||'https://scriptnovaa.com/');return u.origin==='https://scriptnovaa.com'&&['/','/developers','/developers/'].includes(u.pathname)?u.pathname+u.hash:'/';}catch{return '/';}},
  message(code){return ({'auth/expired-action-code':'This verification link has expired. Open your account and request a new email.','auth/invalid-action-code':'This link is invalid or has already been used. Check your account first; it may already be verified.','auth/user-disabled':'This account is unavailable. Contact support for help.','auth/too-many-requests':'Verification emails are temporarily limited. Wait a few minutes before requesting another.','auth/network-request-failed':'The connection was interrupted. Check your internet connection and try again.'})[code]||'Verification could not be completed. Return to your account to check its status or request a new link.';}
 };
 root.NebulaVerification=policy;if(typeof module!=='undefined'&&module.exports)module.exports=policy;
})(typeof window!=='undefined'?window:globalThis);
