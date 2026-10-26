/* Session engine: media and observations are ephemeral, never chat history. */
(function(root){
 'use strict';
 const normalize=s=>String(s||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 class Session{
  constructor(adapters){this.a=adapters;this.epoch=0;this.active=false;this.phase='stopped';this.media={camera:'not-requested',microphone:'not-requested',transcription:'off',ocr:'off'};this.seen=new Set();this.lastResponse=-Infinity;this.clock=adapters.clock||Date.now;}
  emit(message){this.a.render?.({phase:this.phase,active:this.active,media:{...this.media},message});}
  async start(settings){
   this.stop();this.history=[];this.settings={...settings};this.active=true;this.phase='starting';this.seen.clear();this.lastScene=null;this.lastResponse=-Infinity;
   const generation=this.epoch;this.a.prepare?.(settings);this.emit('Starting selected browser inputs. No physical glasses connected.');
   await Promise.allSettled([this.startCamera(generation),this.startMic(generation)]);
   if(!this.active||generation!==this.epoch)return;
   this.phase='running';this.listenPhase();this.emit(!this.settings.camera&&!this.settings.microphone?'Typed-only session. Camera and microphone were not requested.':undefined);
   this.timer=this.a.setInterval(()=>this.scan(false),settings.scanSeconds*1000);
  }
  async startCamera(generation){
   if(!this.settings.camera)return;
   this.media.camera='requesting';this.emit();
   try{const stream=await this.a.camera(this.settings.cameraDevice);if(!this.active||generation!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
    if(!stream.getVideoTracks?.().some(t=>t.readyState==='live')){stream.getTracks().forEach(t=>t.stop());throw Object.assign(Error('Camera has no live track'),{code:'busy'});}
    this.stream=stream;stream.getVideoTracks()[0].addEventListener?.('ended',()=>{if(generation===this.epoch){this.media.camera='stopped';this.a.video?.(null);this.emit('Camera track ended. Check the selected camera; microphone-only use can continue.');}});this.media.camera='active';this.a.video?.(stream);this.emit();
   }catch(e){if(generation===this.epoch){this.media.camera=e.code||'unsupported';this.emit(e.message||'Camera unavailable. Typed input still works.');}}
  }
  async startMic(generation){
   if(!this.settings.microphone)return;
   this.media.microphone='requesting';this.emit();
   try{
    const stream=await this.a.microphone(this.settings.microphoneDevice);
    if(generation!==this.epoch||!this.active){stream.getTracks().forEach(t=>t.stop());return;}
    const track=stream.getAudioTracks?.().find(t=>t.readyState==='live');if(!track){stream.getTracks().forEach(t=>t.stop());throw Object.assign(Error('Microphone has no live track'),{code:'busy'});}
    this.micStream=stream;track.addEventListener?.('ended',()=>{if(generation===this.epoch){this.media.microphone='stopped';this.media.transcription='off';this.recognitionFailed=true;this.stopMeter?.();try{this.rec?.abort();}catch{}this.emit('Microphone track ended. Check the selected input; camera/typed use can continue.');}});this.media.microphone='active';this.stopMeter=this.a.meter?.(stream);this.emit();
    if(!this.a.recognition){this.media.transcription='unsupported';this.emit('Microphone capture is active, but speech transcription is unavailable. Type your question.');return;}
    this.installRecognition(generation);
   }catch(e){if(generation===this.epoch){if(this.micStream){this.media.transcription='unavailable';this.emit('Microphone capture is active, but browser transcription could not initialize. Use typed input.');}else{this.media.microphone=e.code||'unsupported';this.emit(e.message||'Microphone capture unavailable. Use typed input.');}}}
  }
  installRecognition(generation){
   if(!this.active||!this.micStream||!this.a.recognition||this.recognitionFailed)return;
   if(this.rec){this.rec.onend=this.rec.onresult=this.rec.onerror=this.rec.onstart=null;try{this.rec.abort();}catch{}}
    const rec=this.a.recognition();this.rec=rec;rec.continuous=true;rec.interimResults=true;rec.lang='en-US';
    rec.onstart=()=>{if(this.rec!==rec||generation!==this.epoch||!this.active){rec.abort();return;}this.media.transcription='active';this.listenPhase();this.emit();};
    rec.onresult=e=>{if(this.rec!==rec||generation!==this.epoch||!this.active||this.speaking||this.processing)return;if(this.settings.mode==='voice'){if(this.settings.voiceInput==='push'&&!this.pushHeld&&!this.pushReleasing)return;this.a.clearTimeout(this.turnTimer);let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)this.turnText=((this.turnText||'')+' '+t).trim();else interim+=t;}this.turnInterim=!!interim;this.a.transcript?.(((this.turnText||'')+' '+interim).trim());this.phase='listening for you to finish';this.emit();if(!interim&&!this.pushHeld)this.queueTurn();}else for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)this.hear(e.results[i][0].transcript);};
    rec.onerror=e=>{if(this.rec!==rec||generation!==this.epoch||e.error==='aborted')return;this.media.transcription=e.error||'unavailable';if(e.error!=='no-speech'){this.recognitionFailed=true;this.a.clearTimeout(this.restart);rec.onend=null;try{rec.abort();}catch{}}this.emit('Microphone capture and transcription are separate. Transcription failed: '+(e.error||'unavailable')+'. Use typed input or restart after checking browser speech settings.');};
    rec.onend=()=>{if(this.rec!==rec||generation!==this.epoch||!this.active||this.speaking||this.recognitionFailed)return;if(this.settings.mode==='voice'&&this.turnText&&!this.pushHeld&&!this.turnInterim)this.queueTurn();this.media.transcription='restarting';this.emit();this.restart=this.a.setTimeout(()=>this.beginRecognition(generation),800);};
    this.beginRecognition(generation);
  }
  beginRecognition(generation=this.epoch){
   if(generation!==this.epoch||!this.active||this.speaking||this.recognitionFailed||!this.rec||this.settings.mode==='voice'&&this.settings.voiceInput==='push'&&!this.pushHeld)return;
   try{this.rec.start(this.micStream.getAudioTracks()[0]);}catch(e){this.media.transcription='unavailable';this.recognitionFailed=true;this.emit('Browser transcription could not start. Your microphone capture may still be active; type instead.');}
  }
  queueTurn(){this.a.clearTimeout(this.turnTimer);const generation=this.epoch;this.turnTimer=this.a.setTimeout(()=>{if(generation!==this.epoch||!this.active||this.speaking||this.processing)return;const text=this.turnText?.trim();this.turnText='';this.pushReleasing=false;if(text)this.respond(text);},this.pushReleasing?350:(this.settings.silenceMs||1400));}
  pushStart(){if(!this.active||this.processing||this.speaking||this.settings.mode!=='voice'||this.settings.voiceInput!=='push')return;this.a.clearTimeout(this.turnTimer);this.turnText='';this.turnInterim=false;this.pushHeld=true;this.pushReleasing=false;this.beginRecognition();this.phase='listening - release to send';this.emit();}
  pushEnd(){if(!this.pushHeld)return;this.pushHeld=false;this.pushReleasing=true;try{this.rec?.stop();}catch{}if(!this.turnInterim)this.queueTurn();else{const g=this.epoch;this.turnTimer=this.a.setTimeout(()=>{if(g===this.epoch&&this.turnInterim){this.turnText='';this.pushReleasing=false;this.emit('Transcription did not finalize. Review the captured text and select Send.');}},4000);}}
  listenPhase(){if(!this.active||this.processing||this.speaking)return;this.phase=this.media.transcription==='active'?(this.settings.mode==='wake'?'waiting for wake phrase':this.settings.mode==='voice'&&this.settings.voiceInput==='push'?'hold to talk':'listening'):this.media.camera==='active'&&this.settings.mode==='adaptive'?'camera assistance ready':'ready for typed input';}
  async playVoice(text,settings=this.settings){
   const generation=this.epoch,speechVersion=this.speechVersion=(this.speechVersion||0)+1;this.speaking=true;this.a.clearTimeout(this.restart);try{this.rec?.abort();}catch{}if(this.active)this.phase='answering';this.emit();
   try{await this.a.speak?.(text,settings);}finally{if(generation===this.epoch&&speechVersion===this.speechVersion){this.speaking=false;if(this.active){this.listenPhase();this.installRecognition(generation);this.emit();}}}
  }
  hear(text){
   if(!this.active||this.speaking)return;let question=String(text).trim();if(!question)return;
   if(this.settings.mode==='wake'){
    const phrase=normalize(this.settings.wakePhrase),words=normalize(question),at=words.indexOf(phrase);
    if(at>=0&&(at===0||words[at-1]===' ')&&(at+phrase.length===words.length||words[at+phrase.length]===' ')){
     // Strip the phrase by word count, retaining the spoken command's content.
     question=words.slice(at+phrase.length).trim();this.armedUntil=this.clock()+12000;
     this.phase='wake phrase detected';this.emit('Wake phrase detected.');if(!question){this.phase='listening for question';this.emit('Listening for your question...');return;}
    }else if(!this.armedUntil||this.clock()>this.armedUntil)return;
    this.armedUntil=0;
   }
   this.a.transcript?.(question);
   if(this.settings.autoRespond)this.respond(question,{kind:'general',automatic:true});else this.emit('Speech captured. Review it and select Send.');
  }
  activate(){if(!this.active)return;if(!this.rec){this.emit('Type your question below. Enable supported microphone recognition for voice activation.');return;}this.armedUntil=this.clock()+12000;this.phase='listening for question';this.emit('Activated. Speak a question within 12 seconds, or type below.');}
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
    const result=await this.a.request({question,observedText,kind,responseStyle:this.settings.responseStyle,consent:true,...(this.settings.mode==='voice'?{history:this.history||[]}: {})},controller.signal);
    if(generation!==this.epoch||!this.active)return;
    this.seen.add(key);if(this.seen.size>50)this.seen.delete(this.seen.values().next().value);this.lastResponse=this.clock();this.a.answer?.(result);if(this.settings.mode==='voice'){this.history=[...(this.history||[]),{role:'user',content:question},{role:'assistant',content:result.text}].slice(-8);while(JSON.stringify(this.history).length>6000||this.history.some(m=>m.content.length>4000))this.history.splice(0,2);}
    if(this.settings.output!=='text'&&this.a.speak)await this.playVoice(result.text,this.settings);
   }catch(e){if(generation===this.epoch&&!controller.signal.aborted)this.emit(e.message||'Nebula is unavailable. Please try again.');}
   finally{if(generation===this.epoch){this.processing=false;this.controller=null;this.listenPhase();this.emit();}}
  }
  pause(){this.stop('paused');}
  stop(phase='stopped'){
   this.epoch++;this.active=false;this.phase=phase;this.controller?.abort();this.controller=null;
   this.a.clearTimeout(this.turnTimer);this.turnText='';this.turnInterim=false;this.pushHeld=false;this.pushReleasing=false;this.history=[];this.a.clearInterval(this.timer);this.a.clearTimeout(this.restart);this.timer=null;this.restart=null;
   if(this.rec){this.rec.onend=null;this.rec.onresult=null;this.rec.onerror=null;this.rec.onstart=null;try{this.rec.abort();}catch{}this.rec=null;}
   this.stopMeter?.();this.stopMeter=null;this.a.releaseMedia?.();this.micStream?.getTracks().forEach(t=>t.stop());this.micStream=null;this.recognitionFailed=false;
   this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.a.video?.(null);
   this.a.cancelSpeech?.();this.a.stopOcr?.();this.a.people?.([]);this.a.observed?.('');this.observation='';
   this.processing=false;this.scanning=false;this.speaking=false;this.armedUntil=0;this.media={camera:this.media.camera==='not-requested'?'not-requested':'stopped',microphone:this.media.microphone==='not-requested'?'not-requested':'stopped',transcription:'off',ocr:'off'};this.emit(phase==='paused'?'Paused. Camera and microphone released. Resume starts a new session.':'Stopped. Camera, microphone and pending processing released.');
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Session,normalize};else root.NebulaDevicesSession={Session,normalize};
})(typeof window!=='undefined'?window:this);
