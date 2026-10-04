"use strict";
(() => {
const API="https://api.scriptnovaa.com/api/property-security",$=id=>document.getElementById(id),core=PropertySecurityCore;
let key="",config=null,model=null,armed=false,audio=null,siren=null,voiceCamera=null,voiceUntil=0,loopBusy=false;
let configs=[];try{configs=JSON.parse(localStorage.getItem("propertySecurityCameras")||"[]");}catch{}
if(!Array.isArray(configs))configs=[];configs=configs.slice(0,12).filter(c=>/^[a-z0-9-]{1,48}$/.test(c.id));
const cameras=new Map();
function log(t){const line=document.createElement("div");line.textContent=new Date().toLocaleTimeString()+" · "+t;$("log").prepend(line);while($("log").children.length>80)$("log").lastChild.remove();}
function error(e){log(e.message||String(e));$("status").textContent=e.message||String(e);}
async function request(path,body,method=body?"POST":"GET"){if(!key)throw Error("Connect the dashboard first.");const r=await fetch(API+path,{method,headers:{Authorization:"Bearer "+key,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw Error(j.error||"API request failed");return j;}
function save(){localStorage.setItem("propertySecurityCameras",JSON.stringify(configs));}
function say(text,camera=null){voiceCamera=camera;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;voiceUntil=Date.now()+Math.max(1200,text.length*85);speechSynthesis.speak(u);}
function stopSiren(){if(siren){siren.osc.stop();siren=null;}}
function startSiren(){if(siren||!audio||audio.state!=="running")return;const osc=audio.createOscillator(),gain=audio.createGain();gain.gain.value=.12;osc.type="sine";osc.connect(gain).connect(audio.destination);osc.start();siren={osc,gain,startedAt:Date.now()};}
function disarm(){armed=false;stopSiren();speechSynthesis.cancel();for(const c of cameras.values())c.state={phase:"idle",since:Date.now()};$("arm").textContent="Arm system";$("status").textContent="Disarmed";}
async function enableSound(){audio=audio||new AudioContext();await audio.resume();}
$("sound").onclick=async()=>{try{await enableSound();say("Security speaker test. Audio is ready.");}catch(e){error(e);}};
$("silence").onclick=()=>{disarm();log("System silenced and disarmed.");};
$("arm").onclick=async()=>{try{if(armed){disarm();return;}await enableSound();if(document.hidden)throw Error("Keep the dashboard visible to arm.");if(![...cameras.values()].some(c=>c.pc?.connectionState==="connected"))throw Error("Connect a camera before arming.");armed=true;$("arm").textContent="Disarm system";$("status").textContent="Armed · Person detection active";log("System armed.");}catch(e){error(e);}};
$("connect").onclick=async()=>{try{disarm();for(const c of cameras.values())close(c);key=$("key").value.trim();config=await request("/config");$("key").value="";$("status").textContent="Loading person detector…";model=model||await cocoSsd.load({base:"lite_mobilenet_v2"});$("arm").disabled=false;$("status").textContent="Connected · Disarmed";$("network").textContent=config.relayConfigured?"TURN relay configured for cellular connections.":"Direct Wi-Fi connections available. Cellular may fail until a TURN relay is configured.";await refreshClips();}catch(e){key="";$("arm").disabled=true;error(e);}};
function field(label,type,value){const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type=type;i.value=value;l.append(i);return [l,i];}
function close(c){c.pc?.close();c.pc=null;c.video.srcObject=null;c.lastFrame=0;c.state={phase:"idle",since:Date.now()};c.status.textContent="Disconnected";if(![...cameras.values()].some(v=>v.state.phase==="alarm"))stopSiren();}
function render(){
  for(const c of cameras.values())close(c);cameras.clear();$("cameras").replaceChildren();$("cameraSelect").replaceChildren(new Option("All cameras",""));
  for(const cfg of configs){
    const card=document.createElement("article");card.className="card";const title=document.createElement("h2");title.textContent=cfg.name+" · "+cfg.location;card.append(title);
    const status=document.createElement("span");status.className="badge";status.textContent="Disconnected";card.append(status);
    const stage=document.createElement("div");stage.className="stage";const video=document.createElement("video");video.autoplay=true;video.muted=true;video.playsInline=true;const overlay=document.createElement("canvas");stage.append(video,overlay);card.append(stage);
    const row=document.createElement("div");row.className="row";
    const response=document.createElement("select");response.setAttribute("aria-label","Detection response");response.add(new Option("Record only","record"));response.add(new Option("Warn → countdown → alarm","alarm"));response.value=cfg.response;
    row.append(response);const [gl,g]=field("Warning grace (seconds)","number",cfg.grace);g.min=1;g.max=60;const [cl,n]=field("Countdown (seconds)","number",cfg.countdown);n.min=1;n.max=30;row.append(gl,cl);card.append(row);
    const zone=document.createElement("div");zone.className="zone";const inputs={};for(const k of ["x","y","w","h"]){const [l,i]=field({x:"Zone left %",y:"Zone top %",w:"Width %",h:"Height %"}[k],"number",Math.round(cfg.zone[k]*100));i.min=k==="w"||k==="h"?1:0;i.max=100;inputs[k]=i;zone.append(l);}card.append(zone);
    const c={cfg,card,video,overlay,status,pc:null,state:{phase:"idle",since:Date.now()},lastFrame:0,frameWatch:null,recording:false,lastRecord:0,lastCount:-1};cameras.set(cfg.id,c);
    function change(){disarm();cfg.response=response.value;cfg.grace=Math.min(60,Math.max(1,Number(g.value)||5));cfg.countdown=Math.min(30,Math.max(1,Number(n.value)||3));for(const k of ["x","y","w","h"])cfg.zone[k]=Math.min(1,Math.max(k==="w"||k==="h"?.01:0,(Number(inputs[k].value)||0)/100));cfg.zone.w=Math.min(cfg.zone.w,1-cfg.zone.x);cfg.zone.h=Math.min(cfg.zone.h,1-cfg.zone.y);if(cfg.zone.w<=0||cfg.zone.h<=0){cfg.zone={x:0,y:0,w:1,h:1};for(const k in inputs)inputs[k].value=cfg.zone[k]*100;}save();}
    for(const i of [response,g,n,...Object.values(inputs)])i.onchange=change;
    const buttons=document.createElement("div");buttons.className="row";
    const pair=document.createElement("button");pair.textContent="Pair phone";pair.onclick=async()=>{try{const j=await request("/pair",{cameraId:cfg.id});const payload=btoa(unescape(encodeURIComponent(JSON.stringify({id:cfg.id,name:cfg.name,location:cfg.location,token:j.token,iceServers:j.iceServers}))));$("pairPanel").hidden=false;$("pairLink").value=location.origin+"/camerainput#"+payload;}catch(e){error(e);}};
    const connect=document.createElement("button");connect.textContent="Connect / reconnect";connect.onclick=()=>connectCamera(c).catch(error);
    const rec=document.createElement("button");rec.textContent="Record test clip";rec.onclick=()=>record(c).catch(error);
    const remove=document.createElement("button");remove.textContent="Remove";remove.onclick=()=>{disarm();configs=configs.filter(v=>v.id!==cfg.id);save();render();};buttons.append(pair,connect,rec,remove);card.append(buttons);$("cameras").append(card);$("cameraSelect").add(new Option(cfg.name+" · "+cfg.location,cfg.id));
  }
}
$("add").onclick=()=>{if(configs.length>=12){error(Error("Maximum 12 camera slots for this prototype."));return;}const name=$("cameraName").value.trim(),place=$("customLocation").value.trim()||$("location").value;if(!name)return;disarm();configs.push({id:"cam-"+crypto.randomUUID().replaceAll("-","").slice(0,16),name,location:place,response:place==="Garage"?"alarm":"record",grace:5,countdown:3,zone:{x:0,y:0,w:1,h:1}});save();render();};
$("cameraSelect").onchange=()=>{for(const [id,c]of cameras)c.card.hidden=!!$("cameraSelect").value&&id!==$("cameraSelect").value;};
$("copyPair").onclick=()=>navigator.clipboard.writeText($("pairLink").value).catch(error);
async function gather(pc){await new Promise(resolve=>{if(pc.iceGatheringState==="complete")return resolve();const t=setTimeout(done,10000);function done(){clearTimeout(t);pc.removeEventListener("icegatheringstatechange",check);resolve();}function check(){if(pc.iceGatheringState==="complete")done();}pc.addEventListener("icegatheringstatechange",check);});}
async function connectCamera(c){
 if(!config)throw Error("Connect the dashboard first.");disarm();close(c);const pc=new RTCPeerConnection({iceServers:config.iceServers});c.pc=pc;const generation=crypto.randomUUID().replaceAll("-","");
 c.status.textContent="Waiting for phone…";pc.addTransceiver("video",{direction:"recvonly"});pc.ontrack=e=>{c.video.srcObject=e.streams[0]||new MediaStream([e.track]);c.video.play().catch(error);if(c.video.requestVideoFrameCallback){const watch=()=>{if(c.pc!==pc)return;c.lastFrame=Date.now();c.video.requestVideoFrameCallback(watch);};c.video.requestVideoFrameCallback(watch);}else c.video.ontimeupdate=()=>{c.lastFrame=Date.now();};};
 pc.onconnectionstatechange=()=>{c.status.textContent=pc.connectionState;if(["failed","disconnected","closed"].includes(pc.connectionState)){c.state={phase:"idle",since:Date.now()};if(voiceCamera===c.cfg.id)speechSynthesis.cancel();if(![...cameras.values()].some(v=>v.state.phase==="alarm"))stopSiren();log(c.cfg.name+" disconnected; alarm cancelled.");}};
 await pc.setLocalDescription(await pc.createOffer());await gather(pc);if(c.pc!==pc)return;await request("/signal/"+c.cfg.id,{generation,description:pc.localDescription.toJSON()});
 for(let i=0;i<50&&c.pc===pc;i++){const j=await request("/signal/"+c.cfg.id);if(c.pc!==pc)return;if(j.signal?.generation===generation&&j.signal.answer){await pc.setRemoteDescription(j.signal.answer);return;}await new Promise(r=>setTimeout(r,1500));}
 if(c.pc===pc){close(c);throw Error("Phone did not answer. Open its pairing link, start the camera, then reconnect.");}
}
async function record(c){
 if(c.recording)return;if(!c.video.srcObject||c.pc?.connectionState!=="connected")throw Error("Camera is not connected.");if(!window.MediaRecorder)throw Error("This browser cannot record clips.");
 const mime=["video/webm;codecs=vp8","video/webm","video/mp4"].find(v=>MediaRecorder.isTypeSupported(v));if(!mime)throw Error("No compatible recording format.");
 c.recording=true;const chunks=[];let total=0;let recorder,timer;try{const data=await new Promise((resolve,reject)=>{recorder=new MediaRecorder(c.video.srcObject,{mimeType:mime,videoBitsPerSecond:320000});recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>850000&&recorder.state==="recording")recorder.stop();}};recorder.onerror=()=>reject(Error("Clip recording failed."));recorder.onstop=()=>{clearTimeout(timer);const blob=new Blob(chunks,{type:mime});if(blob.size>config.maxClipBytes||!blob.size)return reject(Error("Clip could not fit the 1 MB limit. Lower camera resolution."));const reader=new FileReader();reader.onerror=()=>reject(Error("Clip encoding failed."));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);};recorder.start(500);timer=setTimeout(()=>{if(recorder.state==="recording")recorder.stop();},8000);});await request("/clips",{cameraId:c.cfg.id,location:c.cfg.location,data});log("Clip saved · "+c.cfg.location);await refreshClips();}finally{clearTimeout(timer);if(recorder?.state==="recording")recorder.stop();c.recording=false;}
}
async function refreshClips(){const j=await request("/clips");for(const v of $("clips").querySelectorAll("video"))if(v.dataset.url)URL.revokeObjectURL(v.dataset.url);$("clips").replaceChildren();for(const meta of j.clips){const row=document.createElement("div");row.className="clip";const text=document.createElement("span");text.textContent=meta.location+" · "+new Date(meta.createdAt).toLocaleString();const play=document.createElement("button");play.textContent="Play / download";play.onclick=async()=>{try{const {clip}=await request("/clips/"+meta.id);const blob=await(await fetch(clip.data)).blob(),url=URL.createObjectURL(blob);const v=document.createElement("video");v.controls=true;v.playsInline=true;v.src=url;v.dataset.url=url;const a=document.createElement("a");a.href=url;a.download="security-"+meta.id+(blob.type.includes("mp4")?".mp4":".webm");a.textContent="Download";row.append(v,a);play.disabled=true;}catch(e){error(e);}};const del=document.createElement("button");del.textContent="Delete";del.onclick=async()=>{try{await request("/clips/"+meta.id,null,"DELETE");await refreshClips();}catch(e){error(e);}};row.append(text,play,del);$("clips").append(row);}if(!j.clips.length)$("clips").textContent="No saved clips yet.";}
$("refreshClips").onclick=()=>refreshClips().catch(error);
async function tick(){if(loopBusy||!model)return;loopBusy=true;try{
 for(const c of cameras.values()){
  let connected=c.pc?.connectionState==="connected"&&c.video.readyState>=2&&Date.now()-c.lastFrame<4000;const ctx=c.overlay.getContext("2d");c.overlay.width=c.video.videoWidth||640;c.overlay.height=c.video.videoHeight||360;const w=c.overlay.width,h=c.overlay.height,z=c.cfg.zone;ctx.strokeStyle="#38e1c0";ctx.lineWidth=3;ctx.strokeRect(z.x*w,z.y*h,z.w*w,z.h*h);
  let present=false;if(connected){const predictions=await model.detect(c.video,10,.65);for(const p of predictions.filter(v=>v.class==="person")){const hit=core.inside(p.bbox,w,h,z);present=present||hit;ctx.strokeStyle=hit?"#ff6878":"#cbd5e1";ctx.strokeRect(...p.bbox);}}
  if(!cameras.has(c.cfg.id))continue;connected=connected&&c.pc?.connectionState==="connected"&&Date.now()-c.lastFrame<4000;c.state=core.step(c.state,{present,armed,connected,now:Date.now(),grace:c.cfg.grace,countdown:c.cfg.countdown,response:c.cfg.response});
  if(c.state.event==="warn"){say("Warning. Please leave the "+c.cfg.location+" immediately.",c.cfg.id);log("Person detected · "+c.cfg.location);if(Date.now()-c.lastRecord>20000){c.lastRecord=Date.now();record(c).catch(error);}}
  if(c.state.event==="record"){log("Person detected · "+c.cfg.location);record(c).catch(error);}
  if(c.state.event==="cancel"&&voiceCamera===c.cfg.id)speechSynthesis.cancel();
  if(c.state.phase==="countdown"){const left=Math.max(1,Math.ceil(c.cfg.countdown-(Date.now()-c.state.since)/1000));if(left!==c.lastCount){c.lastCount=left;say(String(left),c.cfg.id);}}else c.lastCount=-1;
  c.status.textContent=connected?(armed?c.state.phase:"Live · Disarmed"):"Disconnected / no fresh video";
 }
 const alarming=[...cameras.values()].some(c=>c.state.phase==="alarm");if(alarming)startSiren();else stopSiren();if(siren&&audio){siren.osc.frequency.setValueAtTime(700+Math.sin(Date.now()/180)*180,audio.currentTime);}
 }catch(e){disarm();error(e);}finally{loopBusy=false;}}
setInterval(()=>{
 const now=Date.now();for(const c of cameras.values()){
  if(["warning","countdown","alarm"].includes(c.state.phase)&&(!armed||c.pc?.connectionState!=="connected"||now-c.lastFrame>=4000)){
   c.state={phase:"idle",since:now};if(voiceCamera===c.cfg.id)speechSynthesis.cancel();c.status.textContent="Lost video · Alarm cancelled";
  }
  if(c.state.phase==="alarm"&&now-c.state.since>=15000)c.state={phase:"cooldown",since:now,until:now+30000};
 }
 if(![...cameras.values()].some(c=>c.state.phase==="alarm")||(siren&&now-siren.startedAt>=15000))stopSiren();
},250);
setInterval(tick,400);document.addEventListener("visibilitychange",()=>{if(document.hidden){disarm();log("Dashboard hidden; system disarmed.");}});window.addEventListener("pagehide",()=>{disarm();for(const c of cameras.values())close(c);});render();
})();
