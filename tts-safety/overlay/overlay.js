import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getDatabase,ref,onChildAdded} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),card=document.getElementById('speech'),api='https://api.scriptnovaa.com';
if(!token||!/^[a-f0-9]{64}$/.test(token)){document.body.textContent='Invalid Nebula overlay link.';throw new Error('invalid overlay link');}
let queue=Promise.resolve();
async function availableVoices(synth){let list=synth.getVoices();if(list.length)return list;await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',finish);resolve();},timer=setTimeout(finish,1200);synth.addEventListener('voiceschanged',finish,{once:true});});return synth.getVoices();}
function speakOnce(synth,text,voiceChoice,rate,volume){return new Promise(resolve=>{const utterance=new SpeechSynthesisUtterance(text);if(voiceChoice){utterance.voice=voiceChoice;utterance.lang=voiceChoice.lang;}utterance.rate=rate;utterance.volume=volume;let finished=false;const done=ok=>{if(finished)return;finished=true;clearTimeout(timer);resolve(ok);};utterance.onend=()=>done(true);utterance.onerror=()=>done(false);const timer=setTimeout(()=>done(false),Math.min(20000,Math.max(3000,text.length*90)));try{synth.resume();synth.speak(utterance);}catch{done(false);}});}
async function speakWithFallback(synth,text,voices,settings){const selected=voices.find(v=>settings.voiceURI&&v.voiceURI===settings.voiceURI)||(settings.voiceName&&voices.find(v=>v.name===settings.voiceName&&(!settings.voiceLang||v.lang===settings.voiceLang)));const sameLanguage=settings.voiceLang&&voices.find(v=>v.lang.toLowerCase()===settings.voiceLang.toLowerCase()&&v!==selected),choices=[];if(selected)choices.push(selected);if(sameLanguage&&sameLanguage!==selected)choices.push(sameLanguage);choices.push(null);const rate=Math.min(1.5,Math.max(.6,Number(settings.voiceRate)||1)),volume=Math.min(1,Math.max(0,Number.isFinite(settings.voiceVolume)?settings.voiceVolume:1));for(const voiceChoice of choices)if(await speakOnce(synth,text,voiceChoice,rate,volume))return true;return false;}
try{
 const response=await fetch(api+'/v1/tts/overlay/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error('The overlay link expired or was revoked.');
 const {firebase,voice={}}=await response.json(),app=initializeApp(firebase,'nebula-tts-'+token.slice(0,8)),db=getDatabase(app);
 onChildAdded(ref(db,'nebulaTtsOverlay/v1/'+token+'/queue'),snapshot=>{
  const item=snapshot.val();if(!item||item.expiresAt<=Date.now()||typeof item.text!=='string')return;
  queue=queue.then(async()=>{
   if(item.expiresAt<=Date.now())return;
   card.textContent=item.text;card.classList.add('show');
   const synth=window.speechSynthesis,voices=await availableVoices(synth);
   const spoken=await speakWithFallback(synth,item.text,voices,voice);
   card.classList.remove('show');
   if(!spoken){card.textContent='Speech playback failed. Check the browser-source audio and selected voice.';card.classList.add('show');await new Promise(resolve=>setTimeout(resolve,3500));card.classList.remove('show');}
   await fetch(api+'/v1/tts/overlay/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,eventId:snapshot.key})}).catch(()=>{});
  }).catch(()=>{});
 });
}catch(error){card.textContent=error.message||'Nebula voice overlay unavailable.';card.classList.add('show');}
