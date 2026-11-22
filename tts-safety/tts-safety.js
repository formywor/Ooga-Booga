(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('tts-status'),button=$('tts-create');
const api='https://api.scriptnovaa.com';
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const input=$(b.dataset.copy);try{await navigator.clipboard.writeText(input.value);b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200);}catch{input.select();document.execCommand('copy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200);}}));
button?.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Creating a private connection…';
 try{
  let installationId=localStorage.getItem('nebulaTtsInstallId');if(!installationId){installationId=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem('nebulaTtsInstallId',installationId);}
  const response=await fetch(api+'/v1/tts/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({installationId})});
  const data=await response.json();if(!response.ok)throw new Error(data.code||'SETUP_FAILED');
  $('tts-key').value=data.apiKey;$('tts-overlay-url').value=data.overlayUrl;$('tts-credentials').hidden=false;button.hidden=true;
  status.textContent='Connection created. Copy both values now; the webhook key will not be shown again.';
 }catch(error){status.textContent=error.message==='ANONYMOUS_SETUP_LIMIT'?'Too many setup attempts from this network today. Try again tomorrow.':'Could not create the connection. Please try again shortly.';button.disabled=false;}
});
$('tts-test')?.addEventListener('click',async event=>{
 const testButton=event.currentTarget,apiKey=$('tts-key').value;
 if(!apiKey)return;
 testButton.disabled=true;status.textContent='Sending a harmless test message to your overlay…';
 try{
  const response=await fetch(api+'/v1/tts/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey,event:'chat',data:{username:'Nebula test',comment:'This is a harmless Nebula TTS connection test.'}})});
  const result=await response.json();if(!response.ok)throw new Error(result.code||'TEST_FAILED');
  status.textContent='Test queued. Check that your overlay speaks the harmless test message.';
 }catch{status.textContent='The test could not be queued. Check the connection and try again.';}
 finally{testButton.disabled=false;}
});
$('tts-revoke')?.addEventListener('click',async()=>{const apiKey=$('tts-key').value;if(!apiKey||!confirm('Revoke this key and disconnect its voice overlay? This cannot be undone.'))return;try{const response=await fetch(api+'/v1/tts/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey})});if(!response.ok)throw new Error('REVOKE_FAILED');$('tts-credentials').hidden=true;button.hidden=false;button.disabled=false;status.textContent='Connection revoked. Create a new one when you are ready.';}catch{status.textContent='Could not revoke the connection. Retry or use the revoke API from your saved key.';}});
})();
