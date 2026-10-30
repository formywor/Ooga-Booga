'use strict';
(async()=>{
 const $=id=>document.getElementById(id),policy=window.NebulaVerification,params=new URLSearchParams(location.search),code=params.get('oobCode'),mode=params.get('mode'),next=policy.returnPath(params.get('continueUrl'));
 // Action codes never remain in the address bar, referrers or app logs.
 history.replaceState(null,'','/verify/');$('verify-open').href=next;
 const say=(title,text)=>{$('verify-title').textContent=title;$('verify-message').textContent=text;};
 try{
  const r=await fetch('https://api.scriptnovaa.com/api/nebula/auth/config',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const config=await r.json();
  const [appModule,sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]);
  const auth=sdk.getAuth(appModule.getApps().find(a=>a.name==='nebula-web')||appModule.initializeApp(config.firebase,'nebula-web'));await auth.authStateReady();
  if(code){if(mode!=='verifyEmail'||code.length>2048)throw Object.assign(Error(),{code:'auth/invalid-action-code'});await sdk.applyActionCode(auth,code);say('Email verified.','Your email address is confirmed. Return to Nebula to continue. Your account access will refresh when you return.');}
  else if(!auth.currentUser){say('Return to your account.','Open the newest verification link in your email, then return to Nebula. If you have already used it, sign in and choose Check verification from your account menu.');}
  if(auth.currentUser){await sdk.reload(auth.currentUser);if(auth.currentUser.emailVerified){await auth.currentUser.getIdToken(true);say('Email verified.','You’re ready to use your verified account. Open Nebula or your developer workspace to continue.');}else if(!code)say('One more step.','Check your inbox and spam folder for the newest verification email. After opening its link, return to your account and choose Check verification.');}
 }catch(error){say('Let’s check that link.',policy.message(error.code));}
 finally{$('verify-actions').hidden=false;}
})();
