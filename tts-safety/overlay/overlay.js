import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getDatabase,ref,onChildAdded} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),card=document.getElementById('speech'),api='https://api.scriptnovaa.com';
if(!token||!/^[a-f0-9]{64}$/.test(token)){document.body.textContent='Invalid Nebula overlay link.';throw new Error('invalid overlay link');}
let queue=Promise.resolve();
try{
 const response=await fetch(api+'/v1/tts/overlay/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error('The overlay link expired or was revoked.');
 const {firebase}=await response.json(),app=initializeApp(firebase,'nebula-tts-'+token.slice(0,8)),db=getDatabase(app);
 onChildAdded(ref(db,'nebulaTtsOverlay/v1/'+token+'/queue'),snapshot=>{
  const item=snapshot.val();if(!item||item.expiresAt<=Date.now()||typeof item.text!=='string')return;
  queue=queue.then(async()=>{
   if(item.expiresAt<=Date.now())return;
   card.textContent=item.text;card.classList.add('show');
   await new Promise(resolve=>{
    const utterance=new SpeechSynthesisUtterance(item.text);utterance.rate=1;utterance.onend=resolve;utterance.onerror=resolve;
    window.speechSynthesis.speak(utterance);setTimeout(resolve,Math.min(20000,Math.max(3000,item.text.length*90)));
   });
   card.classList.remove('show');
   await fetch(api+'/v1/tts/overlay/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,eventId:snapshot.key})}).catch(()=>{});
  }).catch(()=>{});
 });
}catch(error){card.textContent=error.message||'Nebula voice overlay unavailable.';card.classList.add('show');}
