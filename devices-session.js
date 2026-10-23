/* Session engine: media and observations are ephemeral, never chat history. */
(function(root){
 'use strict';
 const normalize=s=>String(s||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 class Session{
  constructor(adapters){this.a=adapters;this.epoch=0;this.active=false;this.phase='stopped';this.media={camera:'off',microphone:'off',ocr:'off'};this.seen=new Set();this.lastResponse=-Infinity;this.clock=adapters.clock||Date.now;}
  emit(message){this.a.render?.({phase:this.phase,active:this.active,media:{...this.media},message});}
  async start(settings){
   this.stop();this.settings={...settings};this.active=true;this.phase='running';this.seen.clear();this.lastScene=null;this.lastResponse=-Infinity;
   const generation=this.epoch;this.emit('Browser session active. No physical glasses connected.');
   await Promise.allSettled([this.startCamera(generation),this.startMic(generation)]);
   if(!this.active||generation!==this.epoch)return;
   this.timer=this.a.setInterval(()=>this.scan(false),settings.scanSeconds*1000);
  }
  async startCamera(generation){
   if(!this.settings.camera)return;
   this.media.camera='requesting';this.emit();
   try{const stream=await this.a.camera();if(!this.active||generation!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;this.media.camera='on';this.a.video?.(stream);this.emit();
   }catch{if(generation===this.epoch){this.media.camera='unavailable or denied';this.emit('Camera unavailable or permission denied. Typed input and samples still work.');}}
  }
  async startMic(generation){
   if(!this.settings.microphone)return;
   if(!this.a.recognition){this.media.microphone='unsupported';this.emit('Speech recognition unavailable. Use Activate and typed input.');return;}
   try{
    const rec=this.a.recognition();this.rec=rec;rec.continuous=true;rec.interimResults=false;rec.lang='en-US';
    rec.onstart=()=>{if(generation===this.epoch&&this.active){this.media.microphone='listening';this.emit();}};
    rec.onresult=e=>{if(generation!==this.epoch||!this.active)return;for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)this.hear(e.results[i][0].transcript);};
    rec.onerror=e=>{if(generation!==this.epoch||e.error==='aborted')return;this.media.microphone=e.error||'unavailable';if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){rec.onend=null;rec.abort();}this.emit('Microphone recognition unavailable. You can type instead.');};
    rec.onend=()=>{if(generation!==this.epoch||!this.active||this.speaking)return;this.restart=this.a.setTimeout(()=>{if(generation===this.epoch&&this.active)try{rec.start();}catch{}},800);};
    this.media.microphone='starting';rec.start();this.emit();
   }catch{this.media.microphone='unsupported or denied';this.emit('Speech unavailable. Use typed input.');}
  }
  hear(text){
   if(!this.active||this.speaking)return;let question=String(text).trim();if(!question)return;
   if(this.settings.mode==='wake'){
    const phrase=normalize(this.settings.wakePhrase),words=normalize(question),at=words.indexOf(phrase);
    if(at>=0&&(at===0||words[at-1]===' ')&&(at+phrase.length===words.length||words[at+phrase.length]===' ')){
     // Strip the phrase by word count, retaining the spoken command's content.
     question=words.slice(at+phrase.length).trim();this.armedUntil=this.clock()+12000;
     if(!question){this.emit('Listening for your question...');return;}
    }else if(!this.armedUntil||this.clock()>this.armedUntil)return;
    this.armedUntil=0;
   }
   this.a.transcript?.(question);
   if(this.settings.autoRespond)this.respond(question,{kind:'general',automatic:true});else this.emit('Speech captured. Review it and select Send.');
  }
  activate(){if(!this.active)return;if(!this.rec){this.emit('Type your question below. Enable supported microphone recognition for voice activation.');return;}this.armedUntil=this.clock()+12000;this.emit('Activated. Speak a question within 12 seconds, or type below.');}
  async scan(manual=false){
   if(!this.active||this.scanning)return;
   if(!this.stream){if(manual)this.emit('Enable the camera and start a session to read visible text.');return;}
   if(manual&&!this.settings.ocr){this.emit('Enable local text reading in Listening modes first.');return;}
   if(this.settings.mode!=='adaptive'&&!manual)return;
   const generation=this.epoch;this.scanning=true;
   try{
    const frame=this.a.frame();if(!frame)return;
    if(this.settings.people&&this.a.detectPeople){try{const boxes=await this.a.detectPeople(frame);if(generation!==this.epoch)return;this.a.people?.(boxes.map(x=>({boundingBox:x.boundingBox,name:'Unknown person'})));}catch{this.a.people?.([]);this.emit('Local face detection unavailable. No identity matching was attempted.');}}
    if(!this.settings.ocr||!this.settings.questions&&!this.settings.menus)return;
    const fingerprint=this.a.fingerprint(frame);if(!manual&&fingerprint===this.lastScene)return;this.lastScene=fingerprint;
    this.media.ocr='processing locally';this.emit();
    const result=await this.a.ocr(frame,generation);if(generation!==this.epoch||!this.active)return;
    this.media.ocr='ready';const text=String(result.text||'').trim();
    if(result.confidence<70||text.length<12){this.a.observed?.('');this.emit('Text is unclear. Move closer or provide a clearer view; no answer was guessed.');return;}
    this.observation=text.slice(0,10000);this.a.observed?.(this.observation);
    const kind=this.a.kind?.()||(this.settings.questions?'question':'menu');
    if(kind==='question'&&!this.settings.questions||kind==='menu'&&!this.settings.menus){this.emit('Selected assistance feature is disabled.');return;}
    if(this.settings.autoRespond)await this.respond(kind==='question'?'Read this visible question and its choices. Answer only if enough information is clear.':'Explain this menu and its listed prices. Ask for the place name if needed.',{kind,observedText:this.observation,automatic:!manual});
    else this.emit('Text read locally. Review the observation, then select Send.');
   }catch(e){if(generation===this.epoch){this.media.ocr='unavailable';this.lastScene=null;this.emit(e.message||'Local recognition unavailable. Type or paste the visible text instead.');}}
   finally{if(generation===this.epoch){this.scanning=false;this.emit();}}
  }
  async respond(question,{kind='general',observedText='',automatic=false}={}){
   if(!this.active){this.emit('Start a browser session first.');return;}
   if(!this.settings.cloudText){this.emit('Enable sending text to Nebula in Privacy before requesting a live answer.');return;}
   const key=normalize(question)+'|'+normalize(observedText);
   if(this.processing)return;
   if(automatic&&(this.seen.has(key)||this.clock()-this.lastResponse<this.settings.cooldownSeconds*1000))return;
   const generation=this.epoch;this.processing=true;this.phase='processing';const controller=new AbortController();this.controller=controller;this.emit();
   try{
    const result=await this.a.request({question,observedText,kind,responseStyle:this.settings.responseStyle,consent:true},controller.signal);
    if(generation!==this.epoch||!this.active)return;
    this.seen.add(key);if(this.seen.size>50)this.seen.delete(this.seen.values().next().value);this.lastResponse=this.clock();this.a.answer?.(result);
    if(this.settings.output!=='text'&&this.a.speak){this.speaking=true;this.rec?.abort();try{await this.a.speak(result.text,this.settings);}finally{if(generation===this.epoch)this.speaking=false;if(generation===this.epoch&&this.active&&this.rec)try{this.rec.start();}catch{}}}
   }catch(e){if(generation===this.epoch&&!controller.signal.aborted)this.emit(e.message||'Nebula is unavailable. Please try again.');}
   finally{if(generation===this.epoch){this.processing=false;this.controller=null;this.phase='running';this.emit();}}
  }
  pause(){this.stop('paused');}
  stop(phase='stopped'){
   this.epoch++;this.active=false;this.phase=phase;this.controller?.abort();this.controller=null;
   this.a.clearInterval(this.timer);this.a.clearTimeout(this.restart);this.timer=null;this.restart=null;
   if(this.rec){this.rec.onend=null;this.rec.onresult=null;this.rec.onerror=null;this.rec.onstart=null;try{this.rec.abort();}catch{}this.rec=null;}
   this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.a.video?.(null);
   this.a.cancelSpeech?.();this.a.stopOcr?.();this.a.people?.([]);this.a.observed?.('');this.observation='';
   this.processing=false;this.scanning=false;this.speaking=false;this.armedUntil=0;this.media={camera:'off',microphone:'off',ocr:'off'};this.emit(phase==='paused'?'Paused. Camera and microphone released. Resume starts a new session.':'Stopped. Camera, microphone and pending processing released.');
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Session,normalize};else root.NebulaDevicesSession={Session,normalize};
})(typeof window!=='undefined'?window:this);
