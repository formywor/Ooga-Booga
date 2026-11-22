(()=>{'use strict';
const $=id=>document.getElementById(id),keyField=$('bridge-key'),connect=$('bridge-connect'),disconnect=$('bridge-disconnect'),status=$('bridge-status');
const api='https://api.scriptnovaa.com/v1/tts/events',keyPattern=/^nb_tts_[a-f0-9]{24}_[a-f0-9]{64}$/;
let socket=null,key='',closedByUser=false,busy=0,sent=0,failed=0;const queue=[];
function update(message){status.textContent=message;}
function stop(clear=true){closedByUser=true;if(socket){const old=socket;socket=null;old.close();}queue.length=0;connect.disabled=false;disconnect.disabled=true;if(clear){key='';keyField.value='';}update('Disconnected. The connection key was cleared from memory.');}
async function deliver(item){busy++;try{const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,event:'chat',data:item})});if(!response.ok)throw new Error('API '+response.status);sent++;update('Connected · '+sent+' chat messages forwarded'+(failed?' · '+failed+' failed':''));}catch{failed++;update('Connected, but a chat message could not be sent to Nebula · '+sent+' sent · '+failed+' failed');}finally{busy--;pump();}}
function pump(){while(busy<4&&queue.length)void deliver(queue.shift());}
connect.addEventListener('click',()=>{
 const candidate=keyField.value.trim();if(!keyPattern.test(candidate)){update('Paste the Nebula webhook key from the setup page.');return;}
 key=candidate;closedByUser=false;sent=0;failed=0;queue.length=0;connect.disabled=true;disconnect.disabled=false;update('Connecting to TikFinity Desktop at localhost…');
 try{
  socket=new WebSocket('ws://localhost:21213/');
  socket.onopen=()=>{if(closedByUser)return;update('Connected to TikFinity Desktop. Waiting for chat messages…');};
  socket.onmessage=message=>{let payload;try{payload=JSON.parse(message.data);}catch{return;}if(payload?.event!=='chat'||!payload.data||typeof payload.data!=='object')return;if(queue.length>=250){failed++;update('The message queue is full. Pause or restart the connector before more comments arrive.');return;}queue.push(payload.data);pump();};
  socket.onerror=()=>update('Could not connect. Keep TikFinity Desktop running on this computer and allow local-network access if Chrome asks.');
  socket.onclose=()=>{socket=null;connect.disabled=false;disconnect.disabled=true;if(!closedByUser)update('TikFinity connection closed. Reopen TikFinity Desktop or reconnect to your LIVE, then try again.');};
 }catch{socket=null;connect.disabled=false;disconnect.disabled=true;key='';update('Could not connect. Keep TikFinity Desktop running on this computer and allow local-network access if Chrome asks.');}
});
disconnect.addEventListener('click',()=>stop(true));
window.addEventListener('pagehide',()=>{closedByUser=true;if(socket)socket.close();key='';queue.length=0;});
})();
