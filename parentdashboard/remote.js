/* Visible, bounded remote control. Escape always remains a local exit. */
'use strict';
window.ScriptNovaaRemote = (() => {
  const byId=id=>document.getElementById(id);
  let api,report,device=null,chain=Promise.resolve(),lastMove=0,lastScroll=0,lastFrame='',generation=0,lastBrowser='';
  const panel=byId('remote-view'),image=byId('remote-screen'),keyboard=byId('remote-keyboard');
  function send(command){
    if(!device||device.remote.until<=Date.now()/1000)return;
    const id=device.id,epoch=generation;
    chain=chain.catch(()=>{}).then(()=>{if(epoch===generation&&device?.id===id&&device.remote.until>Date.now()/1000)return api('remote/command',{device:id,command});}).catch(e=>report(e.message));
  }
  function enhanced(){const v=(device?.version||'0.2.0').split('.').map(Number);return v[0]>0||v[1]>2||(v[1]===2&&v[2]>=1);}
  function point(e){const r=image.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
  function clear(){generation++;device=null;keyboard.checked=false;panel.hidden=true;image.removeAttribute('src');lastFrame='';lastBrowser='';byId('browser-tabs').replaceChildren();byId('browser-preview').textContent='';if(document.fullscreenElement===panel)document.exitFullscreen().catch(()=>{});}
  async function stop(){if(!device)return clear();const id=device.id;generation++;keyboard.checked=false;try{await api('remote/stop',{device:id});clear();}catch(e){report('Could not stop remotely: '+e.message+' The session still expires automatically.');}}
  function open(d){generation++;device=d;panel.hidden=false;keyboard.checked=false;byId('remote-name').textContent=d.name;panel.focus();update([d]);}
  function update(devices){
    if(!device)return;
    const current=devices.find(d=>d.id===device.id);
    if(!current||!(current.remote.until>Date.now()/1000)){clear();return;}
    device=current;
    byId('remote-countdown').textContent='Session ends in '+Math.max(0,Math.ceil((device.remote.until-Date.now()/1000)/60))+' min';
    const fresh=device.frame?.expires>Date.now()/1000;
    byId('remote-status').textContent=fresh?'Connected · screen updates about every 1–2 seconds':'Waiting for a fresh screen…';
    image.hidden=!fresh;
    if(fresh && lastFrame!==device.frame.data){image.src='data:image/jpeg;base64,'+device.frame.data;lastFrame=device.frame.data;}
    byId('remote-upgrade').hidden=enhanced();
    renderBrowser(device.browser);
  }
  function renderBrowser(result){
    if(!result||result.expires<=Date.now()/1000||lastBrowser===result.id)return;
    lastBrowser=result.id;byId('browser-status').textContent=result.error||result.message||'Browser response received.';
    if(result.tabs){byId('browser-tabs').replaceChildren();for(const tab of result.tabs){
      const row=document.createElement('div'),label=document.createElement('p');label.textContent=(tab.active?'Active · ':'')+(tab.audible?'Playing audio · ':'')+tab.title+' — '+tab.url;row.append(label);
      for(const [label,type] of [['Read page preview','preview_tab'],['Close tab','close_tab']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{byId('browser-status').textContent='Requesting '+label.toLowerCase()+'…';send({type,tab:tab.id,browser:tab.browser});};row.append(button);}byId('browser-tabs').append(row);
    }}
    if(result.preview)byId('browser-preview').textContent=result.preview.title+'\n'+result.preview.url+'\n\n'+result.preview.text;
  }
  byId('browser-refresh').onclick=()=>{byId('browser-status').textContent='Requesting open tabs… Requires child app and extension 0.3.5.';send({type:'tabs'});};
  image.addEventListener('click',e=>{send({type:'click',...point(e)});panel.focus();});
  image.addEventListener('contextmenu',e=>{e.preventDefault();if(enhanced())send({type:'click',button:'right',...point(e)});panel.focus();});
  // A normal double click generates two ordered clicks, preserving normal click behavior.
  image.addEventListener('mousemove',e=>{if(keyboard.checked&&Date.now()-lastMove>400){lastMove=Date.now();send({type:'move',...point(e)});}});
  image.addEventListener('wheel',e=>{if(!keyboard.checked)return;e.preventDefault();if(Date.now()-lastScroll>250){lastScroll=Date.now();send({type:'scroll',amount:e.deltaY>0?-3:3});}},{passive:false});
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){keyboard.checked=false;return;}
    if(!keyboard.checked||e.target.tagName==='INPUT'||e.target.tagName==='BUTTON'||e.target.tagName==='SELECT')return;
    if(e.repeat)return;
    const keys={Enter:'enter',Tab:'tab',Backspace:'backspace',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',' ':'space'};
    if((e.ctrlKey||e.metaKey)&&enhanced()&&['a','c','v','x','z','y'].includes(e.key.toLowerCase())){e.preventDefault();send({type:'hotkey',key:e.key.toLowerCase()});}
    else if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&keys[e.key]){e.preventDefault();send({type:'key',key:keys[e.key]});}
    else if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&/^[\x20-\x7e]$/.test(e.key)){e.preventDefault();send({type:'text',text:e.key});}
  });
  keyboard.onchange=()=>{if(keyboard.checked)panel.focus();};
  byId('remote-fullscreen').onclick=()=>{if(document.fullscreenElement===panel)document.exitFullscreen().catch(e=>report(e.message));else panel.requestFullscreen().catch(()=>report('Full screen is unavailable in this browser. The large remote view still works.'));};
  byId('remote-close').onclick=()=>{keyboard.checked=false;panel.hidden=true;if(document.fullscreenElement===panel)document.exitFullscreen().catch(()=>{});};
  byId('remote-stop').onclick=stop;
  const savedZoom=localStorage.getItem('scriptnovaaFamilyZoom')==='actual'?'actual':'fit';byId('remote-zoom').value=savedZoom;byId('remote-stage').classList.toggle('actual-size',savedZoom==='actual');
  byId('remote-zoom').onchange=e=>{localStorage.setItem('scriptnovaaFamilyZoom',e.target.value);byId('remote-stage').classList.toggle('actual-size',e.target.value==='actual');};
  byId('remote-type').onclick=()=>{const value=byId('remote-text').value;if(!/^[\x20-\x7e]{0,300}$/.test(value))return report('Typing currently supports up to 300 English/ASCII characters.');send({type:'text',text:value});byId('remote-text').value='';};
  panel.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>send({type:'key',key:b.dataset.key}));
  panel.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>send({type:'scroll',amount:Number(b.dataset.scroll)}));
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==panel)keyboard.checked=false;});
  return{init:(a,r)=>{api=a;report=message=>{byId('remote-status').textContent=message;r(message);};},open,update,clear,stop,get active(){return !!device&&!panel.hidden;}};
})();
