'use strict';
(() => {
  const API='https://api.scriptnovaa.com/api/nebula';
  const $=selector=>document.querySelector(selector);
  let sdk,auth,config,initPromise,account=null,mode='signin',busy=false,recaptcha=null,confirmation=null,lastSync=null,syncInFlight=null,revision=0;
  let authState='restoring',retryTimer=null,retryCount=0,tokenFlight=null;
  function tokenFor(user,force=false,signal){if(!tokenFlight||tokenFlight.uid!==user.uid){const entry={uid:user.uid};entry.promise=Promise.resolve().then(()=>user.getIdToken(force)).finally(()=>{if(tokenFlight===entry)tokenFlight=null;});tokenFlight=entry;}const task=tokenFlight.promise,deadline=AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])]);return new Promise((resolve,reject)=>{const cancel=()=>reject(signal?.aborted?signal.reason:Object.assign(Error('Account connection timed out. Please retry.'),{code:'auth/network-request-failed'}));if(deadline.aborted){cancel();return;}deadline.addEventListener('abort',cancel,{once:true});task.then(resolve,reject).finally(()=>deadline.removeEventListener('abort',cancel));});}
  function state(value){authState=value;showAccount();window.dispatchEvent(new CustomEvent('nebula:auth-state',{detail:{status:value}}));}
  const appleDevice=/Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform||navigator.platform||navigator.userAgent);
  function feedback(text,error=false){$('#auth-feedback').textContent=text;$('#auth-feedback').classList.toggle('auth-error',error);}
  function setBusy(value){busy=value;$('#account-dialog').setAttribute('aria-busy',String(value));for(const id of ['auth-email-submit','auth-google','auth-apple','open-phone','send-sms','verify-sms','account-signout','send-verification'])$('#'+id).disabled=value||!auth;}
  function emit(){window.dispatchEvent(new CustomEvent('nebula:account-change',{detail:{account}}));}
  function showAccount(){
    $('#signed-out-panel').hidden=Boolean(account);$('#signed-in-panel').hidden=!account;
    $('#account-label').textContent=account?.displayName||(authState==='restoring'?'Restoring your account…':authState==='unavailable'?'Reconnect account':auth?.currentUser?'Account connection paused':'Sign in to Nebula');
    $('#account-caption').textContent=account?(account.email||account.phoneNumber||'Signed in'):'Your own space';
    $('#account-avatar').textContent=(account?.displayName||'N').slice(0,1).toUpperCase();
    if(account){$('#account-identity').textContent=account.email||account.phoneNumber||account.displayName;$('#account-provider').textContent=({password:'Email account','google.com':'Signed in with Google','apple.com':'Signed in with Apple',phone:'Signed in with phone'})[account.provider]||'Signed in to Nebula';$('#account-training-state').textContent=account.improve?'On':'Off';$('#verification-state').textContent=account.provider==='password'?(account.emailVerified?'Email verified':'Verify your email to help protect your account.'):'Your identity is verified by your sign-in provider.';$('#send-verification').hidden=account.provider!=='password'||account.emailVerified;}
  }
  const friendly=error=>({
    'nebula/session-rejected':'Your sign-in could not be verified. Try again or use another account.',
    'nebula/account-unavailable':'Your sign-in succeeded, but Nebula cannot load your account right now. Please try again shortly.',
    'nebula/rate-limited':'Too many account requests. Please wait a moment and try again.',
    'auth/invalid-credential':'That email or password did not work. Try again.',
    'auth/wrong-password':'That email or password did not work. Try again.',
    'auth/user-not-found':'That email or password did not work. Try again.',
    'auth/email-already-in-use':'An account already uses this email. Sign in or reset your password.',
    'auth/invalid-email':'Enter a valid email address.',
    'auth/weak-password':'Choose a stronger password with at least 8 characters.',
    'auth/password-does-not-meet-requirements':'Choose a stronger password that meets the account requirements.',
    'auth/popup-closed-by-user':'The sign-in window was closed. You can try again.',
    'auth/popup-blocked':'Your browser blocked the sign-in window. Allow popups for this site and try again.',
    'auth/account-exists-with-different-credential':'This email uses another sign-in method. Use that method to continue.',
    'auth/invalid-phone-number':'Use your full phone number, including the country code.',
    'auth/invalid-verification-code':'That code did not work. Check the SMS and try again.',
    'auth/code-expired':'That code has expired. Request a new one.',
    'auth/captcha-check-failed':'Please complete the verification challenge again.',
    'auth/too-many-requests':'Too many attempts. Please wait and try again.',
    'auth/quota-exceeded':'Phone sign-in is temporarily unavailable. Try another method.',
    'auth/network-request-failed':'Check your connection and try again.',
    'auth/operation-not-allowed':'This sign-in method is temporarily unavailable. Try another method.',
    'auth/unauthorized-domain':'Sign-in is temporarily unavailable on this address.',
    'auth/user-disabled':'This account is unavailable. Please contact the site owner.',
  })[error?.code]||'Sign-in could not be completed. Please try again.';
  function accountFailure(error){state('unavailable');feedback(friendly(error),true);clearTimeout(retryTimer);if(auth?.currentUser&&retryCount<3){const delay=[5000,15000,45000][retryCount++];retryTimer=setTimeout(()=>{if(auth?.currentUser&&!document.hidden)acceptUser(auth.currentUser).catch(accountFailure);},delay);}$('#retry-auth').hidden=false;$('#reset-signin').hidden=!auth?.currentUser;}
  async function acceptUser(user){
    if(!user){clearTimeout(retryTimer);retryCount=0;state('signedout');revision++;lastSync=null;syncInFlight=null;account=null;showAccount();emit();$('#reset-signin').hidden=true;return;}
    if(account&&account.uid!==user.uid){account=null;lastSync=null;showAccount();emit();}
    if(syncInFlight?.uid===user.uid)return syncInFlight.promise;
    state('loading');const version=++revision;
    const promise=(async()=>{
      let token=await tokenFor(user);
      if(lastSync?.token===token&&account?.uid===user.uid){state('ready');return;}
      const load=token=>fetch(API+'/account',{headers:{Authorization:'Bearer '+token},credentials:'omit',signal:AbortSignal.timeout(20000)});
      let response=await load(token);
      // Refresh once. Observer callbacks share syncInFlight, preventing retry loops.
      if(response.status===401){token=await tokenFor(user,true);if(version!==revision||auth.currentUser?.uid!==user.uid)return;response=await load(token);}
      if(!response.ok)throw Object.assign(new Error('Account unavailable'),{code:response.status===401?'nebula/session-rejected':response.status===429?'nebula/rate-limited':'nebula/account-unavailable'});
      const data=await response.json();
      if(!data.account||data.account.uid!==user.uid)throw Object.assign(new Error('Account unavailable'),{code:'nebula/account-unavailable'});
      if(version!==revision||auth.currentUser?.uid!==user.uid)return;
      clearTimeout(retryTimer);retryCount=0;lastSync={token};account=data.account;state('ready');emit();feedback('You are signed in.');$('#auth-password').value='';$('#retry-auth').hidden=true;$('#reset-signin').hidden=true;
      if($('#account-dialog').open)$('#account-dialog').close();
    })();
    const sync={uid:user.uid,promise};syncInFlight=sync;
    try{await promise;}catch(e){if(version===revision)lastSync=null;throw e;}
    finally{if(syncInFlight===sync)syncInFlight=null;}
  }
  async function initialize(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      const response=await fetch(API+'/auth/config',{credentials:'omit',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Sign-in unavailable');
      config=await response.json();
      if(!config.firebase?.apiKey||!config.firebase?.authDomain||!config.providers)throw new Error('Sign-in unavailable');
      const [appModule,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]);
      sdk=authModule;auth=sdk.getAuth(appModule.getApps?.().find(a=>a.name==='nebula-web')||appModule.initializeApp(config.firebase,'nebula-web'));
      sdk.useDeviceLanguage(auth);
      await sdk.setPersistence(auth,sdk.browserLocalPersistence);
      $('#auth-google').hidden=!config.providers.google;$('#auth-apple').hidden=!config.providers.apple||!appleDevice;$('#open-phone').hidden=!config.providers.phone;$('#email-auth-form').hidden=!config.providers.email;$('#email-divider').hidden=!config.providers.email;
      sdk.onIdTokenChanged(auth,user=>{acceptUser(user).catch(accountFailure);});
      setBusy(false);$('#retry-auth').hidden=true;return auth;
    })().catch(e=>{initPromise=null;throw e;});
    return initPromise;
  }
  async function run(action){if(busy)return;setBusy(true);feedback('');try{await initialize();setBusy(true);await action();}catch(e){if(e.code?.startsWith('nebula/'))accountFailure(e);else feedback(friendly(e),true);}finally{setBusy(false);}}
  function showMethods(){
    $('#phone-auth-form').hidden=true;$('#code-auth-form').hidden=true;
    $('.social-providers').hidden=false;$('.auth-tabs').hidden=false;
    $('#email-auth-form').hidden=config?.providers.email===false;$('#email-divider').hidden=config?.providers.email===false;
    $('#open-phone').hidden=config?.providers.phone!==true;
    if(recaptcha){recaptcha.clear();recaptcha=null;}
    confirmation=null;$('#auth-code').value='';
  }
  function setMode(next){mode=next;$('#auth-signin-tab').classList.toggle('selected',mode==='signin');$('#auth-signup-tab').classList.toggle('selected',mode==='signup');$('#auth-signin-tab').setAttribute('aria-pressed',String(mode==='signin'));$('#auth-signup-tab').setAttribute('aria-pressed',String(mode==='signup'));$('#auth-email-submit').textContent=mode==='signup'?'Create account':'Sign in';$('#auth-password').autocomplete=mode==='signup'?'new-password':'current-password';$('#auth-password').minLength=mode==='signup'?8:1;$('#password-help').hidden=mode!=='signup';$('#forgot-password').hidden=mode==='signup';feedback('');}
  $('#account-button').onclick=async()=>{showAccount();$('#account-dialog').showModal();if(!auth){feedback('Getting sign-in ready...');try{await initialize();feedback('');}catch{feedback('Sign-in is temporarily unavailable. You can keep using your guest workspace.',true);$('#retry-auth').hidden=false;}}};
  $('#close-account').onclick=()=>$('#account-dialog').close();
  $('#account-dialog').addEventListener('close',()=>{$('#auth-password').value='';$('#auth-code').value='';if(recaptcha){recaptcha.clear();recaptcha=null;}showMethods();});
  $('#retry-auth').onclick=async()=>{if(busy)return;setBusy(true);feedback('Trying again...');try{await initialize();setBusy(true);if(auth.currentUser)await acceptUser(auth.currentUser);else feedback('Choose a sign-in method.');$('#retry-auth').hidden=true;}catch(e){accountFailure(e);}finally{setBusy(false);}};
  $('#reset-signin').onclick=()=>run(async()=>{await sdk.signOut(auth);lastSync=null;account=null;showAccount();$('#reset-signin').hidden=true;$('#retry-auth').hidden=true;feedback('Choose a sign-in method to continue.');});
  $('#auth-signin-tab').onclick=()=>setMode('signin');$('#auth-signup-tab').onclick=()=>setMode('signup');
  $('#toggle-password').onclick=()=>{const input=$('#auth-password');input.type=input.type==='password'?'text':'password';$('#toggle-password').textContent=input.type==='password'?'Show':'Hide';$('#toggle-password').setAttribute('aria-label',input.type==='password'?'Show password':'Hide password');};
  $('#email-auth-form').onsubmit=e=>{e.preventDefault();run(async()=>{const email=$('#auth-email').value.trim(),password=$('#auth-password').value;try{const result=mode==='signup'?await sdk.createUserWithEmailAndPassword(auth,email,password):await sdk.signInWithEmailAndPassword(auth,email,password);if(mode==='signup')await sdk.sendEmailVerification(result.user).catch(()=>{});await acceptUser(result.user);}finally{$('#auth-password').value='';}});};
  $('#forgot-password').onclick=()=>run(async()=>{const email=$('#auth-email').value.trim();if(!email||!$('#auth-email').checkValidity()){feedback('Enter your email address above first.',true);$('#auth-email').focus();return;}try{await sdk.sendPasswordResetEmail(auth,email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}feedback('If that email has an account, a password reset message is on its way.');});
  async function social(provider){const result=await sdk.signInWithPopup(auth,provider);await acceptUser(result.user);}
  $('#auth-google').onclick=()=>run(()=>{const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return social(provider);});
  $('#auth-apple').onclick=()=>run(()=>{const provider=new sdk.OAuthProvider('apple.com');provider.addScope('email');provider.addScope('name');return social(provider);});
  $('#open-phone').onclick=()=>{showMethods();$('.social-providers').hidden=true;$('.auth-tabs').hidden=true;$('#email-auth-form').hidden=true;$('#email-divider').hidden=true;$('#open-phone').hidden=true;$('#phone-auth-form').hidden=false;feedback('');$('#auth-phone').focus();};
  $('#phone-back').onclick=showMethods;
  $('#phone-auth-form').onsubmit=e=>{e.preventDefault();run(async()=>{const phone=$('#auth-phone').value.replace(/[\s()-]/g,'');if(!/^\+[1-9][0-9]{7,14}$/.test(phone)||!$('#sms-consent').checked){feedback('Enter a phone number with its country code and accept the SMS notice.',true);return;}try{if(recaptcha)recaptcha.clear();recaptcha=new sdk.RecaptchaVerifier(auth,'phone-recaptcha',{size:'normal'});await recaptcha.render();confirmation=await sdk.signInWithPhoneNumber(auth,phone,recaptcha);$('#phone-auth-form').hidden=true;$('#code-auth-form').hidden=false;$('#sms-destination').textContent='Enter the six-digit code sent to '+phone.replace(/.(?=.{4})/g,'*');feedback('Verification code sent.');$('#auth-code').focus();}catch(e){if(recaptcha){recaptcha.clear();recaptcha=null;}throw e;}});};
  $('#code-auth-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!confirmation)throw Error('No verification pending');const result=await confirmation.confirm($('#auth-code').value.trim());await acceptUser(result.user);});};
  $('#change-phone').onclick=()=>{confirmation=null;$('#auth-code').value='';$('#phone-auth-form').hidden=false;$('#code-auth-form').hidden=true;if(recaptcha){recaptcha.clear();recaptcha=null;}feedback('');};
  $('#account-signout').onclick=()=>run(async()=>{await sdk.signOut(auth);account=null;showAccount();$('#account-dialog').close();feedback('');});
  $('#send-verification').onclick=()=>run(async()=>{if(auth.currentUser){await sdk.sendEmailVerification(auth.currentUser);feedback('Verification email sent. Check your inbox.');}});
  window.NebulaAuth={
    get restoring(){return authState==='restoring'||!!auth?.currentUser&&account?.uid!==auth.currentUser.uid;},get status(){return authState;},
    async retry(){await initialize();if(auth.currentUser)await acceptUser(auth.currentUser);},
    async resetPassword(){if(!auth?.currentUser?.email||account?.provider!=='password')throw Error('Use your sign-in provider to manage your password.');try{await sdk.sendPasswordResetEmail(auth,auth.currentUser.email);}catch(e){if(e.code!=='auth/user-not-found')throw Error('Password reset is unavailable. Please try again.');}},
    async signOut(){if(auth)await sdk.signOut(auth);account=null;showAccount();emit();},
    async authorizedFetch(url,options={}){
      // An unavailable authentication service must not prevent deliberate guest use.
      if(initPromise)try{await initPromise;}catch{}
      options.signal?.throwIfAborted();
      const user=auth?.currentUser;const headers=new Headers(options.headers||{});
      if(user){if(!account||account.uid!==user.uid){await acceptUser(user);if(!account||account.uid!==user.uid)throw Error('Your account is reconnecting. Open your account to retry.');}let token;try{token=await tokenFor(user,false,options.signal);}catch(e){if(e.name==='AbortError')throw e;if(e.code==='auth/network-request-failed'){accountFailure(e);throw Object.assign(Error('Your account connection is paused. Please retry shortly.'),{code:'AUTH_UNAVAILABLE'});}throw e;}options.signal?.throwIfAborted();if(auth.currentUser?.uid!==user.uid)throw Error('Your account changed. Please try again.');headers.set('Authorization','Bearer '+token);}
      return fetch(url,{...options,headers});
    },
    async savePreferences(patch){
      if(!account||!auth?.currentUser)throw Error('Sign in required');
      const user=auth.currentUser;const response=await window.NebulaAuth.authorizedFetch(API+'/account',{method:'PATCH',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(typeof patch==='boolean'?{improve:patch}:patch),signal:AbortSignal.timeout(15000)});
      if(!response.ok||auth.currentUser?.uid!==user.uid)throw Error('Preferences unavailable');const data=await response.json();account=data.account;showAccount();window.dispatchEvent(new CustomEvent('nebula:account-change',{detail:{account}}));return account;
    },
    updatePreferenceView(improve){if(account){account.improve=improve;showAccount();window.dispatchEvent(new CustomEvent('nebula:account-change',{detail:{account}}));}},
  };
  window.addEventListener('online',()=>{if(auth?.currentUser&&authState==='unavailable')acceptUser(auth.currentUser).catch(accountFailure);});
  setMode('signin');showAccount();initialize().catch(accountFailure);
})();
