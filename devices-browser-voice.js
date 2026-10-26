(function(root){'use strict';
 class Voice{
  constructor(a){this.a=a;this.epoch=0;}
  voices(){return this.a.synth?.getVoices?.()||[];}
  stop(){this.epoch++;this.a.synth?.cancel();this.pending?.();this.pending=null;this.resume=null;this.a.render('stopped','Browser voice stopped.');}
  async speak(text,s){this.stop();const e=this.epoch,synth=this.a.synth;if(!synth||!this.a.utterance){this.a.render('unavailable','Browser speech is unavailable. Read the answer instead.');return;}
   const list=this.voices(),chosen=list.find(v=>v.voiceURI===s.voice)||list.find(v=>v.lang.toLowerCase()==='en-us'&&v.localService)||list.find(v=>v.lang.toLowerCase()==='en-us');
   const u=this.a.utterance(text);if(chosen)u.voice=chosen;u.lang=chosen?.lang||'en-US';u.volume=s.volume/100;u.rate=s.speechRate||1;
   await new Promise(resolve=>{this.pending=resolve;u.onstart=()=>{if(e===this.epoch)this.a.render('playing','Speaking with '+(chosen?.name||'browser US English default')+'.');};u.onend=()=>{if(e===this.epoch)this.a.render('stopped','Browser voice finished.');resolve();};u.onerror=()=>{if(e===this.epoch){this.resume=()=>this.speak(text,s);this.a.render('blocked','Speech could not play. Select Play to retry, or read the answer.');}resolve();};if(e===this.epoch){this.a.render('loading','Starting browser voice...');synth.speak(u);}else resolve();});if(e===this.epoch)this.pending=null;
  }
  play(){this.resume?.();}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Voice};else root.NebulaBrowserVoice={Voice};
})(typeof window!=='undefined'?window:this);
