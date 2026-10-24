const base=(window.MOVIE_API_ORIGIN||'').replace(/\/$/,'');
const $=id=>document.getElementById(id),video=$('movie');let state=null,receivedAt=0,joined=false,source='',blocked=false,lastSuccess=0;
const time=n=>{n=Math.ceil(Math.max(0,n));return [Math.floor(n/3600)||null,Math.floor(n/60)%60,n%60].filter(x=>x!==null).map(x=>String(x).padStart(2,'0')).join(':');};
function cover(title,message,join=false){$('cover').hidden=false;$('cover-title').textContent=title;$('cover-message').textContent=message;$('join').hidden=!join;}
function render(){
  if(!state)return;
  const elapsed=Math.max(0,(performance.now()-receivedAt)/1000),left=Math.max(0,state.remaining-(state.running?elapsed:0));
  $('timer').textContent=time(left);$('timer').classList.toggle('zero',left===0);
  if(Date.now()-lastSuccess>4000){video.pause();cover('Connection interrupted','Playback is paused while we reconnect.');$('connection').textContent='Reconnecting…';return;}
  if(!state.movie){video.pause();cover('A new story is coming','The host hasn’t added a movie yet.');$('play-status').textContent='Waiting for the host';return;}
  if(left<=0){video.pause();cover('Let’s keep the story going',state.message);$('play-status').textContent='Paused · Waiting for gifts';return;}
  if(!state.running){video.pause();cover('A quick intermission','The host has paused the movie. We’ll be back soon.');$('play-status').textContent='Paused by host';return;}
  if(video.ended){cover('That’s a wrap','Thanks for watching. The host can add another movie.');return;}
  if(!joined||blocked){video.pause();cover('Your seat is ready','Tap below to join the shared movie session.',true);return;}
  $('cover').hidden=true;$('play-status').textContent='Now playing · In sync with the room';
  const target=state.position+Math.min(elapsed,state.remaining);
  if(video.readyState>=1&&Math.abs(video.currentTime-target)>1.5)video.currentTime=target;
  if(video.paused&&!video.ended)video.play().catch(()=>{blocked=true;render();});
}
async function poll(){try{const r=await fetch(base+'/movie-api/state',{cache:'no-store',signal:AbortSignal.timeout(3500)});if(!r.ok)throw Error();const s=await r.json();state=s;receivedAt=performance.now();lastSuccess=Date.now();$('connection').textContent='Connected to movie night';$('title').textContent=s.movie?.title||'Movie night, together.';
  const next=s.movie?.url||'';if(next!==source){source=next;if(source){video.src=source.startsWith('/')?base+source:source;video.load();}else{video.removeAttribute('src');video.load();}$('player-error').textContent='';}
  $('rules').replaceChildren(...s.rules.map(rule=>{const row=document.createElement('div');row.className='rule';const label=document.createElement('span');label.textContent=rule.label;const value=document.createElement('strong');value.textContent=rule.action==='toggle'?'Pause / resume':`+${rule.seconds}s`;row.append(label,value);return row;}));render();
}catch{if(!state)cover('Connecting to movie night','The movie service is unavailable. Retrying…');}finally{setTimeout(poll,750);}}
$('join').onclick=()=>{joined=true;blocked=false;video.play().then(render).catch(()=>{blocked=true;render();});};
$('sound').onclick=()=>{video.muted=!video.muted;$('sound').textContent=video.muted?'Sound off':'Sound on';};
$('fullscreen').onclick=()=>{$('screen').requestFullscreen?.().catch(()=>{});};
video.addEventListener('error',()=>{$('player-error').textContent='This movie could not be played. The host may need to convert the MKV to H.264/AAC MP4 or check the movie URL.';});
video.addEventListener('ended',()=>{cover('That’s a wrap','Thanks for watching. The host can add another movie.');});
setInterval(render,100);poll();
