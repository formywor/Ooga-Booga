"use strict";
// Keep JPEG frames and timestamped PCM in a bounded ring. Encode each saved
// segment as a complete MediaRecorder file; arbitrary WebM chunks aren't clips.
(() => {
const PRE=10000,TAIL=5000,PART=25000;
class BufferRecorder {
 constructor(video,context,{upload,log,maxBytes=1048576}){
  this.video=video;this.context=context;this.upload=upload;this.log=log;this.maxBytes=maxBytes;this.frames=[];this.audio=[];this.event=null;this.queue=[];this.busy=false;this.closed=false;this.lastFrame=0;
  this.canvas=document.createElement("canvas");this.canvas.width=480;this.canvas.height=270;this.ctx=this.canvas.getContext("2d");
  this.timer=setInterval(()=>this.capture(),200);this.nodes=[];
 }
 async attachAudio(stream){this.detachAudio();const audioRun=this.audioRun;if(!stream.getAudioTracks().length)return;
  try{await this.context.audioWorklet.addModule("/property-audio-worklet.js?v=20261004-v3");if(this.closed||this.audioRun!==audioRun)return;const source=this.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())),node=new AudioWorkletNode(this.context,"property-pcm"),mute=this.context.createGain();mute.gain.value=0;source.connect(node).connect(mute).connect(this.context.destination);node.port.onmessage=e=>{const now=Date.now();this.addAudio({time:now-e.data.length/16,samples:e.data});};this.nodes=[source,node,mute];}catch(e){this.log("Audio buffering unavailable: "+e.message);}
 }
 detachAudio(){this.audioRun=(this.audioRun||0)+1;for(const n of this.nodes){if(n.port)n.port.onmessage=null;n.disconnect();}this.nodes=[];}
 addAudio(packet){this.audio.push(packet);this.audio=this.audio.filter(p=>p.time>Date.now()-PRE-500);if(this.event)this.event.audio.push(packet);}
 async capture(){if(this.closed||this.capturing)return;const now=Date.now();
  if(this.video.readyState>=2&&this.video.videoWidth&&now-this.lastFrame<4000){
   this.capturing=true;try{this.ctx.drawImage(this.video,0,0,480,270);const blob=await new Promise(r=>this.canvas.toBlob(r,"image/jpeg",.55));if(blob&&!this.closed){const f={time:now,blob};this.frames.push(f);if(this.event)this.event.frames.push(f);}}catch(e){this.log("Frame buffering error: "+e.message);}finally{this.capturing=false;}
  }
  this.frames=this.frames.filter(f=>f.time>now-PRE-400);while(this.frames.reduce((n,f)=>n+f.blob.size,0)>2500000)this.frames.shift();
  if(this.event){const e=this.event;const end=Math.min(e.start+PART,e.lastSeen+TAIL);if(now>=end){this.finish(end);if(e.lastSeen+TAIL>end)this.beginPart(end,e.group,e.part+1,e.lastSeen,e.disconnectAt);}}
 }
 seen(now=Date.now()){if(this.event){this.event.lastSeen=now;const gap=this.event.gaps?.at(-1);if(gap&&gap.end==null)gap.end=now;}}
 trigger(now=Date.now()){
  if(this.event){this.seen(now);return;}
  const start=Math.max(now-PRE,this.frames[0]?.time||now);
  this.event={start,lastSeen:now,frames:this.frames.filter(f=>f.time>=start).slice(),audio:this.audio.filter(a=>a.time+a.samples.length/16>=start).slice(),group:crypto.randomUUID(),part:1,disconnectAt:null,gaps:[]};
  this.log("Recording event with "+Math.round((now-start)/1000)+" seconds of prior footage.");
 }
 beginPart(start,group,part,lastSeen,disconnectAt){this.event={start,group,part,lastSeen,disconnectAt,gaps:disconnectAt==null?[]:[{start:disconnectAt,end:null}],frames:this.frames.filter(f=>f.time>=start),audio:this.audio.filter(a=>a.time>=start)};}
 disconnected(now=Date.now()){if(this.event&&!this.event.gaps?.some(g=>g.end==null)){this.event.lastSeen=now;this.event.disconnectAt=this.event.disconnectAt??now;this.event.gaps.push({start:now,end:null});}this.detachAudio();}
 finish(end=Date.now()){
  const e=this.event;if(!e)return;this.event=null;e.end=end;e.frames=e.frames.filter(f=>f.time<=end);e.audio=e.audio.filter(a=>a.time<end);
  if(!e.frames.length){this.log("No buffered video available to save.");return;}
  if(this.queue.length>=8){this.log("Recording queue is full; download/save workload is exceeding this PC's capacity.");return;}
  this.queue.push(e);this.flush();
 }
 async flush(){if(this.busy)return;this.busy=true;try{while(this.queue.length){const e=this.queue.shift();try{await this.encode(e);}catch(error){this.log("Recording not uploaded: "+error.message);}}}finally{this.busy=false;}}
 async encode(e){
  if(this.context.state!=="running")throw Error("Enable PC audio to save buffered clips.");
  const mime=["video/webm;codecs=vp8,opus","video/webm","video/mp4"].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error("Browser has no supported recorder.");
  const canvas=document.createElement("canvas");canvas.width=480;canvas.height=270;const ctx=canvas.getContext("2d"),stream=canvas.captureStream(5),destination=this.context.createMediaStreamDestination();
  const duration=Math.max(.2,(e.end-e.start)/1000),samples=new Float32Array(Math.ceil(duration*16000));
  for(const a of e.audio){let start=Math.round((a.time-e.start)*16),offset=Math.max(0,-start);start=Math.max(0,start);const count=Math.min(a.samples.length-offset,samples.length-start);if(count>0)samples.set(a.samples.subarray(offset,offset+count),start);}
  const buffer=this.context.createBuffer(1,samples.length,16000);buffer.copyToChannel(samples,0);const audioSource=this.context.createBufferSource();audioSource.buffer=buffer;audioSource.connect(destination);const output=new MediaStream([...stream.getVideoTracks(),...destination.stream.getAudioTracks()]);
  const chunks=[];let rec,timer,playStart=this.context.currentTime+.1,paintBusy=false,frameIndex=-1,bitmap=null;
  const paint=async()=>{if(paintBusy)return;paintBusy=true;try{const time=e.start+(this.context.currentTime-playStart)*1000;let index=0;while(index+1<e.frames.length&&e.frames[index+1].time<=time)index++;if(index!==frameIndex){bitmap?.close();bitmap=await createImageBitmap(e.frames[index].blob);frameIndex=index;}ctx.drawImage(bitmap,0,0,480,270);if(e.gaps?.some(g=>time>=g.start&&(g.end==null||time<g.end))){ctx.fillStyle="rgba(0,0,0,.75)";ctx.fillRect(0,95,480,80);ctx.fillStyle="white";ctx.font="20px sans-serif";ctx.fillText("Camera offline · last received frame",14,137);}}finally{paintBusy=false;}}
  try{await paint();const blob=await new Promise((resolve,reject)=>{rec=new MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:160000,audioBitsPerSecond:24000});rec.ondataavailable=v=>{if(v.data.size)chunks.push(v.data);};rec.onerror=()=>reject(Error("Encoding failed."));rec.onstop=()=>resolve(new Blob(chunks,{type:mime.includes("mp4")?"video/mp4":"video/webm"}));rec.start(500);audioSource.start(playStart);timer=setInterval(()=>{paint().catch(()=>{});if(this.context.currentTime>=playStart+duration&&rec.state==="recording")rec.stop();},100);});
   const saveLocal=reason=>{const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="security-"+e.group+"-part-"+e.part+(mime.includes("mp4")?".mp4":".webm");link.textContent=reason+" · download unsaved clip";link.className="clip";(document.getElementById("unsavedClips")||document.getElementById("clips")).prepend(link);};
   if(blob.size>this.maxBytes){saveLocal("Clip exceeds API limit");return;}
   const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
   try{await this.upload({data,eventId:e.group,part:e.part,startedAt:e.start,endedAt:e.end,disconnected:e.disconnectAt!=null,hasAudio:e.audio.length>0});}catch(err){saveLocal("Upload failed");throw err;}
  }finally{clearInterval(timer);if(rec?.state==="recording")rec.stop();try{audioSource.stop();}catch{}audioSource.disconnect();bitmap?.close();output.getTracks().forEach(t=>t.stop());}
 }
 stop(){this.finish();this.closed=true;clearInterval(this.timer);this.detachAudio();}
}
window.PropertyBufferRecorder=BufferRecorder;
})();
