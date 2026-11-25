import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getDatabase,ref,onChildAdded} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),card=document.getElementById('speech'),api='https://api.scriptnovaa.com';
if(!token||!/^[a-f0-9]{64}$/.test(token)){document.body.textContent='Invalid Nebula overlay link.';throw new Error('invalid overlay link');}
let queue=Promise.resolve();
async function availableVoices(synth){let list=synth.getVoices();if(list.length)return list;await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',finish);resolve();},timer=setTimeout(finish,1200);synth.addEventListener('voiceschanged',finish,{once:true});});return synth.getVoices();}
try{
 const response=await fetch(api+'/v1/tts/overlay/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error('The overlay link expired or was revoked.');
 const {firebase,voice={}}=await response.json(),app=initializeApp(firebase,'nebula-tts-'+token.slice(0,8)),db=getDatabase(app);
 onChildAdded(ref(db,'nebulaTtsOverlay/v1/'+token+'/queue'),snapshot=>{
  const item=snapshot.val();if(!item||item.expiresAt<=Date.now()||typeof item.text!=='string')return;
  queue=queue.then(async()=>{
   if(item.expiresAt<=Date.now())return;
   card.textContent=item.text;card.classList.add('show');
   const synth=window.speechSynthesis,voices=await availableVoices(synth);
   await new Promise(resolve=>{
    const utterance=new SpeechSynthesisUtterance(item.text);
    const selected=voices.find(v=>voice.voiceURI&&v.voiceURI===voice.voiceURI)||(voice.voiceName&&voices.find(v=>v.name===voice.voiceName&&(!voice.voiceLang||v.lang===voice.voiceLang)));
    if(selected){utterance.voice=selected;utterance.lang=selected.lang;}else if(voice.voiceLang)utterance.lang=voice.voiceLang;
    utterance.rate=Math.min(1.5,Math.max(.6,Number(voice.voiceRate)||1));utterance.volume=Math.min(1,Math.max(0,Number.isFinite(voice.voiceVolume)?voice.voiceVolume:1));
    let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};
    utterance.onend=done;utterance.onerror=done;const timer=setTimeout(done,Math.min(20000,Math.max(3000,item.text.length*90)));
    try{synth.resume();synth.speak(utterance);}catch{done();}
   });
   card.classList.remove('show');
   await fetch(api+'/v1/tts/overlay/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,eventId:snapshot.key})}).catch(()=>{});
  }).catch(()=>{});
 });
}catch(error){card.textContent=error.message||'Nebula voice overlay unavailable.';card.classList.add('show');}
