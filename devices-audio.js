(function(root){'use strict';
 function chunks(text,max){const out=[];let rest=text.trim();while(rest.length){let n=Math.min(max,rest.length);if(n<rest.length){const boundary=rest.lastIndexOf(' ',n);if(boundary>max/2)n=boundary;}out.push(rest.slice(0,n));rest=rest.slice(n).trimStart();}return out;}
 class Voice{
  constructor(a){this.a=a;this.epoch=0;}
  state(state,message){this.a.render(state,message);}
  stop(){this.epoch++;this.controller?.abort();this.controller=null;if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio.onended=this.audio.onerror=null;this.audio=null;}if(this.url)this.a.revoke(this.url);this.url=null;this.pending?.();this.pending=null;this.resume=null;this.state('stopped','API audio stopped.');}
  async speak(text,settings,capability){
   this.stop();const generation=this.epoch;
   if(!capability?.configured){this.state('unavailable','API voice not configured. Readable text remains available.');return;}
   if(!settings.voiceConsent){this.state('unavailable','Enable API voice consent in Privacy. Answer text will be sent to the speech provider.');return;}
   if(text.length>4000){this.state('unavailable','This answer exceeds the 4,000-character audio limit. Ask for a shorter spoken reply; the full text remains available.');return;}
   const voice=capability.voices.find(v=>v.id===settings.voice)||capability.voices[0];if(!voice){this.state('unavailable','No server-approved voice available.');return;}
   const parts=chunks(text,capability.maxCharacters);
   try{for(let i=0;i<parts.length;i++){
    if(generation!==this.epoch)return;this.state('loading',`Loading API voice ${i+1} of ${parts.length}...`);this.controller=new AbortController();
    const blob=await this.a.request({text:parts[i],voice:voice.id,consent:true},this.controller.signal);if(generation!==this.epoch)return;
    this.url=this.a.create(blob);this.audio=this.a.audio();const audio=this.audio;audio.src=this.url;audio.volume=settings.volume/100;
    await new Promise((resolve,reject)=>{
     this.pending=resolve;audio.onended=resolve;audio.onerror=()=>reject(Error('Audio playback failed. Readable text remains available.'));
     const play=()=>{if(generation!==this.epoch){resolve();return;}audio.play().then(()=>this.state('playing','Playing API voice.')).catch(e=>{if(e.name==='NotAllowedError'){this.resume=play;this.state('blocked','Autoplay blocked. Select Play to hear the API audio.');}else reject(e);});};play();
    });
    if(generation!==this.epoch)return;this.pending=null;this.resume=null;audio.onended=audio.onerror=null;audio.removeAttribute('src');audio.load();this.a.revoke(this.url);this.url=null;this.audio=null;
   }if(generation===this.epoch)this.state('stopped','API audio finished.');
   }catch(e){if(generation!==this.epoch)return;this.stop();this.state('unavailable',e.message||'API voice unavailable. Readable text remains available.');}
  }
  play(){this.resume?.();}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Voice,chunks};else root.NebulaApiVoice={Voice,chunks};
})(typeof window!=='undefined'?window:this);
