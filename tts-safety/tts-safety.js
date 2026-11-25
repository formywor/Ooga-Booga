(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('tts-status'),button=$('tts-create');
const api='https://api.scriptnovaa.com';
const keySlot='nebulaTtsApiKey.v1',overlaySlot='nebulaTtsOverlayUrl.v1';
function keepCredentials(key,url){try{sessionStorage.setItem(keySlot,key);sessionStorage.setItem(overlaySlot,url);}catch{}}
function clearCredentials(){try{sessionStorage.removeItem(keySlot);sessionStorage.removeItem(overlaySlot);sessionStorage.removeItem('nebulaTtsWasConnected.v1');}catch{}}
async function restoreCredentials(){let key='',url='';try{key=sessionStorage.getItem(keySlot)||'';url=sessionStorage.getItem(overlaySlot)||'';}catch{}if(!/^nb_tts_[a-f0-9]{24}_[a-f0-9]{64}$/.test(key)||!url)return;let check=null;try{check=await fetch(api+'/v1/tts/usage',{headers:{Authorization:'Bearer '+key}});}catch{}if(check?.status===401){clearCredentials();return;}$('tts-key').value=key;$('tts-overlay-url').value=url;$('tts-credentials').hidden=false;button.hidden=true;status.textContent=check?.ok?'Your connection was restored after refreshing this tab. Both private values are ready to copy.':'Your saved connection was restored. Nebula could not verify it right now, but your saved values are still available.';}
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const input=$(b.dataset.copy);try{await navigator.clipboard.writeText(input.value);b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200);}catch{input.select();document.execCommand('copy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200);}}));
button?.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Creating a private connection…';
 try{
  let installationId=localStorage.getItem('nebulaTtsInstallId');if(!installationId){installationId=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem('nebulaTtsInstallId',installationId);}
  const response=await fetch(api+'/v1/tts/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({installationId})});
  const data=await response.json();if(!response.ok)throw new Error(data.code||'SETUP_FAILED');
  $('tts-key').value=data.apiKey;$('tts-overlay-url').value=data.overlayUrl;$('tts-credentials').hidden=false;button.hidden=true;clearCredentials();keepCredentials(data.apiKey,data.overlayUrl);
  status.textContent='Connection created. Values are saved in this tab so a refresh will not lose them. Copy them into TikFinity and your browser source.';
 }catch(error){status.textContent=error.message==='SETUP_BURST_LIMIT'?'A lot of connections were created just now. Wait about a minute and try again.':'Could not create the connection. Please try again shortly.';button.disabled=false;}
});
$('tts-test')?.addEventListener('click',async event=>{
 const testButton=event.currentTarget,apiKey=$('tts-key').value;
 if(!apiKey)return;
 testButton.disabled=true;status.textContent='Sending a harmless test message to your overlay…';
 try{
  const response=await fetch(api+'/v1/tts/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey,event:'chat',data:{username:'Nebula test',comment:'This is a harmless Nebula TTS connection test.'}})});
  const result=await response.json();if(!response.ok)throw new Error('HTTP '+response.status+' · '+(typeof result.code==='string'?result.code:'UNKNOWN_ERROR'));
  status.textContent='Test queued. Check that your overlay speaks the harmless test message.';
 }catch(error){status.textContent=error instanceof TypeError?'Could not reach Nebula’s API. Check your connection and retry.':'Test failed: '+error.message+'.';}
 finally{testButton.disabled=false;}
});
 $('tts-revoke')?.addEventListener('click',async()=>{const apiKey=$('tts-key').value;if(!apiKey||!confirm('Revoke this key and disconnect its voice overlay? This cannot be undone.'))return;try{const response=await fetch(api+'/v1/tts/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey})});if(!response.ok)throw new Error('REVOKE_FAILED');clearCredentials();$('tts-credentials').hidden=true;button.hidden=false;button.disabled=false;status.textContent='Connection revoked. Create a new one when you are ready.';}catch{status.textContent='Could not revoke the connection. Retry or use the revoke API from your saved key.';}});
void restoreCredentials().catch(()=>{});
})();
