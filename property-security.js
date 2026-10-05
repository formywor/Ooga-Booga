"use strict";
(() => {
const API="https://api.scriptnovaa.com/api/property-security",$=id=>document.getElementById(id),core=PropertySecurityCore;
let key=sessionStorage.getItem("propertySecurityKey")||"",config=null,model=null,armed=localStorage.getItem("propertySecurityArmed")==="true",audio=null,siren=null,voiceCamera=null,voiceUntil=0,loopBusy=false,soundReady=false,recognition=null,recognitionCamera=null,voiceState={until:0},voiceRetry=null,voiceRetryAt=0,lastSpoken="";
const alarm=new Audio("/alarm.mp3");alarm.loop=true;alarm.preload="auto";
let voiceEnabled=localStorage.getItem("propertySecurityVoice")==="true";
function armedUI(){ $("arm").textContent=armed?"Disarm system":"Arm system";$("status").textContent=(armed?"Armed":"Disarmed")+(!config?" · Connect dashboard":!soundReady?" · Enable PC audio":" · Auto reconnect enabled");}
function saveArmed(){localStorage.setItem("propertySecurityArmed",String(armed));armedUI();}
let configs=[];try{configs=JSON.parse(localStorage.getItem("propertySecurityCameras")||"[]");}catch{}
if(!Array.isArray(configs))configs=[];configs=configs.slice(0,12).filter(c=>/^[a-z0-9-]{1,48}$/.test(c.id));
const cameras=new Map();
function log(t){const line=document.createElement("div");line.textContent=new Date().toLocaleTimeString()+" · "+t;$("log").prepend(line);while($("log").children.length>80)$("log").lastChild.remove();}
function error(e){log(e.message||String(e));$("status").textContent=e.message||String(e);}
async function request(path,body,method=body?"POST":"GET"){if(!key)throw Error("Connect the dashboard first.");const r=await fetch(API+path,{method,headers:{Authorization:"Bearer "+key,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw Error(j.error||"API request failed");return j;}
function save(){localStorage.setItem("propertySecurityCameras",JSON.stringify(configs));}
function say(text,camera=null){voiceCamera=camera;lastSpoken=text;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;voiceUntil=Date.now()+Math.max(1200,text.length*85);u.onend=()=>{voiceUntil=0;};u.onerror=()=>{voiceUntil=0;};speechSynthesis.speak(u);}
function stopSiren(){alarm.pause();alarm.currentTime=0;siren=null;}
function startSiren(){if(siren||!soundReady)return;siren={startedAt:Date.now()};alarm.volume=voiceState.until>Date.now()?.18:1;alarm.play().catch(e=>{siren=null;error(Error("Cannot play alarm.mp3. Put it at the website root and enable PC audio. "+e.message));});}
function disarm(){armed=false;saveArmed();stopSiren();speechSynthesis.cancel();for(const c of cameras.values())c.state={phase:"idle",since:Date.now()};}
async function enableSound(){audio=audio||new AudioContext();await audio.resume();soundReady=audio.state==="running";if(soundReady){try{await alarm.play();alarm.pause();alarm.currentTime=0;}catch(e){log("alarm.mp3 is missing or playback needs permission: "+e.message);}for(const c of cameras.values())if(c.stream&&!c.buffer)startBuffer(c);startVoice();}armedUI();}
function stopVoice(){clearTimeout(voiceRetry);recognitionCamera=null;const old=recognition;recognition=null;old?.abort();}
function startVoice(){
 if(!voiceEnabled||!soundReady||recognition||Date.now()<voiceRetryAt)return;
 const match=navigator.userAgent.match(/(?:Chrome|Edg)\/(\d+)/),SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR||!match||Number(match[1])<135||/Android|iPhone|iPad/.test(navigator.userAgent)){$("voiceStatus").textContent="Phone-audio recognition needs supported desktop Chrome/Edge; voice cancel unavailable.";return;}
 const c=[...cameras.values()].find(v=>v.cfg.id===$("voiceCamera").value&&v.stream?.getAudioTracks().some(t=>t.readyState==="live"));
 if(!c){$("voiceStatus").textContent="Waiting for microphone audio from the selected camera.";return;}
 const r=new SR();recognition=r;recognitionCamera=c.cfg.id;r.lang="en-US";r.continuous=true;r.interimResults=false;
 r.onresult=async event=>{for(let i=event.resultIndex;i<event.results.length;i++){if(!event.results[i].isFinal)continue;const text=event.results[i][0].transcript;if((speechSynthesis.speaking||Date.now()<voiceUntil)&&/cancel/i.test(lastSpoken))continue;
  voiceState=core.voiceStep(voiceState,text,Date.now());
  if(voiceState.event==="challenge"){say("To cancel the alarm, please say the four digit admin code.",c.cfg.id);$("voiceStatus").textContent="Listening for admin code · alarm stays armed until verified";}
  if(voiceState.event==="verify"){try{const j=await request("/voice-verify",{code:voiceState.code});if(j.valid){voiceState={until:0};disarm();say("Admin code accepted. Security system disarmed.",c.cfg.id);log("Voice admin code accepted.");}else{voiceState={until:0};say("Incorrect admin code. The security system remains armed.",c.cfg.id);}}catch(e){voiceState={until:0};error(e);}}
 }};
 r.onerror=e=>{$("voiceStatus").textContent="Voice recognition: "+e.error;if(["not-allowed","service-not-allowed","audio-capture"].includes(e.error)){voiceEnabled=false;$("voiceEnabled").checked=false;localStorage.setItem("propertySecurityVoice","false");}};
 r.onend=()=>{if(recognition!==r)return;recognition=null;recognitionCamera=null;voiceRetryAt=Date.now()+2000;voiceRetry=setTimeout(startVoice,2000);};
 try{r.start(c.stream.getAudioTracks()[0]);$("voiceStatus").textContent="Listening to "+c.cfg.name+" · say cancel, then your admin code";}catch(e){recognition=null;$("voiceStatus").textContent="Phone-audio recognition unavailable: "+e.message;}
}
function startBuffer(c){if(!audio||!c.stream)return;if(c.buffer){c.buffer.attachAudio(c.stream);return;}c.buffer=new PropertyBufferRecorder(c.video,audio,{maxBytes:config.maxClipBytes,log:log,upload:async clip=>{await request("/clips",{cameraId:c.cfg.id,location:c.cfg.location,...clip});log("Buffered clip saved · "+c.cfg.location+" · part "+clip.part);await refreshClips();}});c.buffer.lastFrame=c.lastFrame;c.buffer.attachAudio(c.stream);}
$("sound").onclick=async()=>{try{await enableSound();say("Security speaker test. Audio and recording buffer are ready.");}catch(e){error(e);}};
$("silence").onclick=()=>{disarm();log("System silenced and disarmed.");};
$("arm").onclick=async()=>{try{if(armed){disarm();return;}await enableSound();armed=true;saveArmed();log("System armed; waiting cameras reconnect automatically.");}catch(e){error(e);}};
async function connectDashboard(){try{const supplied=$("key").value.trim();if(supplied)key=supplied;if(!key)throw Error("Enter the control key.");config=await request("/config");sessionStorage.setItem("propertySecurityKey",key);$("key").value="";$("status").textContent="Loading person detector…";model=model||await cocoSsd.load({base:"mobilenet_v2"});$("arm").disabled=false;armedUI();$("network").textContent=config.relayConfigured?"TURN relay configured for cellular connections.":"Cellular may need a TURN relay. Cameras reconnect automatically.";await refreshClips();for(const c of cameras.values())c.retryAt=0;}catch(e){error(e);}}
$("connect").onclick=async()=>{await enableSound();await connectDashboard();};
$("voiceEnabled").checked=voiceEnabled;$("voiceEnabled").onchange=async()=>{voiceEnabled=$("voiceEnabled").checked;localStorage.setItem("propertySecurityVoice",String(voiceEnabled));if(!voiceEnabled)stopVoice();else{await enableSound();startVoice();}};
$("voiceCamera").onchange=()=>{localStorage.setItem("propertySecurityVoiceCamera",$("voiceCamera").value);voiceState={until:0};stopVoice();startVoice();};
function field(label,type,value){const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type=type;i.value=value;l.append(i);return [l,i];}
function close(c){c.buffer?.disconnected();c.stream=null;c.pc?.close();c.pc=null;c.video.srcObject=null;c.lastFrame=0;c.state={phase:"idle",since:Date.now()};c.status.textContent="Disconnected · retrying";if(recognitionCamera===c.cfg.id)stopVoice();if(![...cameras.values()].some(v=>v.state.phase==="alarm"))stopSiren();}
function render(){
  for(const c of cameras.values()){close(c);c.buffer?.stop();}cameras.clear();$("cameras").replaceChildren();$("cameraSelect").replaceChildren(new Option("All cameras",""));$("voiceCamera").replaceChildren();
  for(const cfg of configs){
    const card=document.createElement("article");card.className="card";const title=document.createElement("h2");title.textContent=cfg.name+" · "+cfg.location;card.append(title);
    const status=document.createElement("span");status.className="badge";status.textContent="Disconnected";card.append(status);
    const stage=document.createElement("div");stage.className="stage";const video=document.createElement("video");video.autoplay=true;video.muted=true;video.playsInline=true;const overlay=document.createElement("canvas");stage.append(video,overlay);card.append(stage);
    const row=document.createElement("div");row.className="row";
    const response=document.createElement("select");response.setAttribute("aria-label","Detection response");response.add(new Option("Record only","record"));response.add(new Option("Warn → countdown → alarm","alarm"));response.value=cfg.response;
    row.append(response);const [gl,g]=field("Warning grace (seconds)","number",cfg.grace);g.min=1;g.max=60;const [cl,n]=field("Countdown (seconds)","number",cfg.countdown);n.min=1;n.max=30;row.append(gl,cl);card.append(row);
    const zone=document.createElement("div");zone.className="zone";const inputs={};for(const k of ["x","y","w","h"]){const [l,i]=field({x:"Zone left %",y:"Zone top %",w:"Width %",h:"Height %"}[k],"number",Math.round(cfg.zone[k]*100));i.min=k==="w"||k==="h"?1:0;i.max=100;inputs[k]=i;zone.append(l);}card.append(zone);
    const c={cfg,card,video,overlay,status,pc:null,stream:null,buffer:null,track:{lastSeen:null},state:{phase:"idle",since:Date.now()},lastFrame:0,connecting:false,retryAt:0,failures:0,lastCount:-1};cameras.set(cfg.id,c);
    function change(){cfg.response=response.value;cfg.grace=Math.min(60,Math.max(1,Number(g.value)||5));cfg.countdown=Math.min(30,Math.max(1,Number(n.value)||3));for(const k of ["x","y","w","h"])cfg.zone[k]=Math.min(1,Math.max(k==="w"||k==="h"?.01:0,(Number(inputs[k].value)||0)/100));cfg.zone.w=Math.min(cfg.zone.w,1-cfg.zone.x);cfg.zone.h=Math.min(cfg.zone.h,1-cfg.zone.y);if(cfg.zone.w<=0||cfg.zone.h<=0){cfg.zone={x:0,y:0,w:1,h:1};for(const k in inputs)inputs[k].value=cfg.zone[k]*100;}save();}
    for(const i of [response,g,n,...Object.values(inputs)]){i.onchange=change;i.onblur=change;}for(const i of [response,g,n])i.oninput=change;
    const buttons=document.createElement("div");buttons.className="row";
    const pair=document.createElement("button");pair.textContent="Pair phone";pair.onclick=async()=>{try{const j=await request("/pair",{cameraId:cfg.id});const payload=btoa(unescape(encodeURIComponent(JSON.stringify({id:cfg.id,name:cfg.name,location:cfg.location,token:j.token,iceServers:j.iceServers}))));$("pairPanel").hidden=false;$("pairLink").value=location.origin+"/camerainput#"+payload;}catch(e){error(e);}};
    const connect=document.createElement("button");connect.textContent="Connect / reconnect";c.connectButton=connect;connect.onclick=()=>attempt(c);
    const rec=document.createElement("button");rec.textContent="Record test clip";rec.onclick=()=>{if(!c.buffer){error(Error("Enable PC audio and connect this camera first."));return;}c.buffer.trigger();c.buffer.event.lastSeen=Date.now();};
    const remove=document.createElement("button");remove.textContent="Remove";remove.onclick=()=>{configs=configs.filter(v=>v.id!==cfg.id);save();render();};buttons.append(pair,connect,rec,remove);card.append(buttons);$("cameras").append(card);$("cameraSelect").add(new Option(cfg.name+" · "+cfg.location,cfg.id));$("voiceCamera").add(new Option(cfg.name+" · "+cfg.location,cfg.id));
  }
 const chosen=localStorage.getItem("propertySecurityVoiceCamera");if(configs.some(c=>c.id===chosen))$("voiceCamera").value=chosen;
}
$("add").onclick=()=>{if(configs.length>=12){error(Error("Maximum 12 camera slots for this prototype."));return;}const name=$("cameraName").value.trim(),place=$("customLocation").value.trim()||$("location").value;if(!name)return;configs.push({id:"cam-"+crypto.randomUUID().replaceAll("-","").slice(0,16),name,location:place,response:place==="Garage"?"alarm":"record",grace:5,countdown:3,zone:{x:0,y:0,w:1,h:1}});save();render();};
$("cameraSelect").onchange=()=>{for(const [id,c]of cameras)c.card.hidden=!!$("cameraSelect").value&&id!==$("cameraSelect").value;};
$("copyPair").onclick=()=>navigator.clipboard.writeText($("pairLink").value).catch(error);
async function gather(pc){await new Promise(resolve=>{if(pc.iceGatheringState==="complete")return resolve();const t=setTimeout(done,10000);function done(){clearTimeout(t);pc.removeEventListener("icegatheringstatechange",check);resolve();}function check(){if(pc.iceGatheringState==="complete")done();}pc.addEventListener("icegatheringstatechange",check);});}
async function connectCamera(c){
 if(!config)throw Error("Connect the dashboard first.");close(c);const pc=new RTCPeerConnection({iceServers:config.iceServers});c.pc=pc;const generation=crypto.randomUUID().replaceAll("-","");
 c.status.textContent="Waiting for phone…";pc.addTransceiver("video",{direction:"recvonly"});pc.addTransceiver("audio",{direction:"recvonly"});pc.ontrack=e=>{if(c.pc!==pc)return;c.stream=e.streams[0]||c.stream||new MediaStream();if(!c.stream.getTracks().includes(e.track))c.stream.addTrack(e.track);c.video.srcObject=c.stream;c.video.play().catch(error);startBuffer(c);if(e.track.kind==="audio"){startVoice();return;}if(c.video.requestVideoFrameCallback){const watch=()=>{if(c.pc!==pc)return;c.lastFrame=Date.now();if(c.buffer)c.buffer.lastFrame=c.lastFrame;c.video.requestVideoFrameCallback(watch);};c.video.requestVideoFrameCallback(watch);}else c.video.ontimeupdate=()=>{c.lastFrame=Date.now();if(c.buffer)c.buffer.lastFrame=c.lastFrame;};};
 pc.onconnectionstatechange=()=>{if(c.pc!==pc)return;c.status.textContent=pc.connectionState;if(pc.connectionState==="connected"){c.connectedAt=Date.now();c.failures=0;c.retryAt=0;startBuffer(c);startVoice();}if(["failed","disconnected","closed"].includes(pc.connectionState)){c.state={phase:"idle",since:Date.now()};if(voiceCamera===c.cfg.id)speechSynthesis.cancel();if(![...cameras.values()].some(v=>v.state.phase==="alarm"))stopSiren();c.buffer?.disconnected();if(recognitionCamera===c.cfg.id)stopVoice();c.retryAt=Date.now()+2000;log(c.cfg.name+" disconnected; buffered recording will save, reconnect scheduled.");}};
 await pc.setLocalDescription(await pc.createOffer());await gather(pc);if(c.pc!==pc)return;await request("/signal/"+c.cfg.id,{generation,description:pc.localDescription.toJSON()});
 for(let i=0;i<50&&c.pc===pc;i++){const j=await request("/signal/"+c.cfg.id);if(c.pc!==pc)return;if(j.signal?.generation===generation&&j.signal.answer){await pc.setRemoteDescription(j.signal.answer);return;}await new Promise(r=>setTimeout(r,1500));}
 if(c.pc===pc){close(c);throw Error("Phone did not answer. Open its pairing link, start the camera, then reconnect.");}
}
async function attempt(c){if(c.connecting||!config)return;c.connecting=true;c.connectButton.disabled=true;c.connectButton.textContent="Connecting…";try{await connectCamera(c);const peer=c.pc;const deadline=Date.now()+25000;while(c.pc===peer&&peer&&peer.connectionState!=="connected"&&Date.now()<deadline){if(["failed","closed"].includes(peer.connectionState))throw Error("Camera transport failed; retrying automatically.");await new Promise(r=>setTimeout(r,500));}if(c.pc===peer&&peer?.connectionState!=="connected")throw Error("Camera connection timed out; retrying automatically.");}catch(e){c.failures++;c.status.textContent=e.message;}finally{c.connecting=false;c.connectButton.disabled=false;c.connectButton.textContent="Connect / reconnect";c.retryAt=Date.now()+Math.min(30000,2000*Math.pow(2,Math.min(c.failures,4)));}}
async function refreshClips(){const j=await request("/clips");for(const v of $("clips").querySelectorAll("video"))if(v.dataset.url)URL.revokeObjectURL(v.dataset.url);$("clips").replaceChildren();for(const meta of j.clips){const row=document.createElement("div");row.className="clip";const text=document.createElement("span");text.textContent=meta.location+" · "+new Date(meta.startedAt||meta.createdAt).toLocaleString()+(meta.part?" · part "+meta.part:"")+(meta.hasAudio?" · audio":"")+(meta.disconnected?" · camera offline tail":"");const play=document.createElement("button");play.textContent="Play / download";play.onclick=async()=>{try{const {clip}=await request("/clips/"+meta.id);const blob=await(await fetch(clip.data)).blob(),url=URL.createObjectURL(blob);const v=document.createElement("video");v.controls=true;v.playsInline=true;v.src=url;v.dataset.url=url;const a=document.createElement("a");a.href=url;a.download="security-"+meta.id+(blob.type.includes("mp4")?".mp4":".webm");a.textContent="Download";row.append(v,a);play.disabled=true;}catch(e){error(e);}};const del=document.createElement("button");del.textContent="Delete";del.onclick=async()=>{try{await request("/clips/"+meta.id,null,"DELETE");await refreshClips();}catch(e){error(e);}};row.append(text,play,del);$("clips").append(row);}if(!j.clips.length)$("clips").textContent="No saved clips yet.";}
$("refreshClips").onclick=()=>refreshClips().catch(error);
async function tick(){if(loopBusy||!model)return;loopBusy=true;try{
 for(const c of cameras.values()){
  let connected=c.pc?.connectionState==="connected"&&c.video.readyState>=2&&Date.now()-c.lastFrame<4000;
  const ctx=c.overlay.getContext("2d");c.overlay.width=c.video.videoWidth||640;c.overlay.height=c.video.videoHeight||360;const w=c.overlay.width,h=c.overlay.height,z=c.cfg.zone;ctx.strokeStyle="#38e1c0";ctx.lineWidth=3;ctx.strokeRect(z.x*w,z.y*h,z.w*w,z.h*h);
  let predictions=[];if(connected)predictions=await model.detect(c.video,20,.35);
  if(!cameras.has(c.cfg.id))continue;connected=connected&&c.pc?.connectionState==="connected"&&Date.now()-c.lastFrame<4000;
  if(connected)c.track=core.presence(c.track,predictions.filter(p=>p.class==="person"),{now:Date.now(),w,h,zone:z});else c.track={lastSeen:null,present:false};
  if(c.track.box){ctx.strokeStyle=c.track.raw?"#ff6878":"#ffd166";ctx.strokeRect(...c.track.box);}
  if(armed&&c.track.raw&&c.buffer){if(!c.buffer.event)c.buffer.trigger(c.track.lastSeen);else c.buffer.seen(c.track.lastSeen);}
  c.state=core.step(c.state,{present:!!c.track.present,armed,connected,now:Date.now(),grace:c.cfg.grace,countdown:c.cfg.countdown,response:c.cfg.response,warningDone:!speechSynthesis.speaking&&Date.now()>voiceUntil});
  if(c.state.event==="warn"){const messages=["Warning. You are being recorded. This is a restricted "+c.cfg.location+". Please leave immediately. An alarm will sound if you remain.","Attention. Your presence in the "+c.cfg.location+" has been detected. Video recording is active. Please exit this monitored area now.","Security warning. This "+c.cfg.location+" is restricted. Please leave the camera's view. The alarm countdown will begin if you remain."];const message=messages[(c.warnCount||0)%messages.length];c.warnCount=(c.warnCount||0)+1;if(voiceState.until<=Date.now())say(message,c.cfg.id);log("Person tracked · "+c.cfg.location);}
  if(c.state.event==="record")log("Person tracked · "+c.cfg.location);
  // A completed warning is not cut off by a brief detection miss.
  if(c.state.event==="cancel"&&voiceCamera===c.cfg.id&&(!connected||!armed))speechSynthesis.cancel();
  if(c.state.phase==="countdown"){const left=Math.max(1,Math.ceil(c.cfg.countdown-(Date.now()-c.state.since)/1000));if(left!==c.lastCount&&voiceState.until<=Date.now()){c.lastCount=left;say(String(left),c.cfg.id);}}else c.lastCount=-1;
  c.status.textContent=connected?(armed?c.state.phase+(c.track.raw?" · tracking":c.track.present?" · brief detection gap":""):"Live · Disarmed"):"Disconnected · auto reconnect";
 }
 if([...cameras.values()].some(c=>c.state.phase==="alarm")&&armed)startSiren();else stopSiren();
 }catch(e){stopSiren();log("Detection error; armed setting retained: "+e.message);}finally{loopBusy=false;}}
setInterval(()=>{
 const now=Date.now();for(const c of cameras.values()){
  const stale=c.pc?.connectionState!=="connected"||now-(c.lastFrame||c.connectedAt||0)>=4000;
  if(["warning","countdown","alarm"].includes(c.state.phase)&&(!armed||stale)){c.state={phase:"idle",since:now};if(voiceCamera===c.cfg.id)speechSynthesis.cancel();c.buffer?.disconnected(now);}
  if(c.state.phase==="alarm"&&now-c.state.since>=15000)c.state={phase:"cooldown",since:now,until:now+30000};
  if(config&&!c.connecting&&stale&&now>=c.retryAt)attempt(c);
 }
 if(![...cameras.values()].some(c=>c.state.phase==="alarm")||(siren&&now-siren.startedAt>=15000))stopSiren();
 alarm.volume=voiceState.until>now?.18:1;
 startVoice();
},1000);
setInterval(tick,250);window.addEventListener("pagehide",()=>{stopSiren();stopVoice();speechSynthesis.cancel();for(const c of cameras.values()){close(c);c.buffer?.stop();}});
render();armedUI();if(key)connectDashboard();
})();
