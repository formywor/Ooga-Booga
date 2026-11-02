'use strict';
window.ScriptNovaaControls={build(d,api,refresh,text,button){
 const box=text('details','');box.append(text('summary','Protection settings and temporary exceptions'));
 if(d.version.split('.').map(Number)[1]<3)box.append(text('p','Install app 0.3.0 and extension 0.3.0 to enforce these settings.','small'));
 const p=d.policy||{},q=p.quietHours||{},form=document.createElement('form');
 const inputs={};
 function field(key,label,type,value){const row=text('label',label),el=document.createElement('input');el.type=type;if(type==='checkbox')el.checked=value;else el.value=value;inputs[key]=el;row.append(el);form.append(row);return el;}
 field('screenEnabled','Visual protection','checkbox',p.screenEnabled!==false);
 field('audioEnabled','Playback speech protection','checkbox',p.audioEnabled!==false);
 field('slursEnabled','Include slur vocabulary (English)','checkbox',p.slursEnabled!==false);
 field('earlyCaptionPause','Pause before a matching upcoming subtitle (where available)','checkbox',p.earlyCaptionPause===true);
 field('blockExplicitTracks','Pause Spotify tracks labelled explicit','checkbox',p.blockExplicitTracks===true);
 form.append(text('p','Early pauses are precautionary and sent for review, not confirmed speech blocks. Subtitles must be available; protected audio cannot be extracted. Desktop Spotify can be reported, but individual-song browser blocks require the web player. App and extension 0.3.5 are required.','small'));
 field('captionsEnabled','Caption corroboration','checkbox',p.captionsEnabled!==false);
 function select(key,label,options,value){const row=text('label',label),el=document.createElement('select');for(const [v,title]of options){const n=text('option',title);n.value=v;el.append(n);}el.value=value;inputs[key]=el;row.append(el);form.append(row);}
 select('visualMode','Visual checks',[['balanced','Balanced: context-sensitive findings go to review'],['strict','Strict: repeated breast-only findings may block']],p.visualMode||'balanced');
 field('customWords','Additional blocked words (comma separated)','text',(p.customWords||[]).join(', '));
 field('allowedWords','Words to allow (comma separated)','text',(p.allowedWords||[]).join(', '));
 select('retentionDays','Keep reports',[['7','7 days'],['30','30 days'],['90','90 days']],String(p.retentionDays||30));
 field('scheduled','Schedule site restrictions','checkbox',q.enabled===true);
 field('start','Restriction starts','time',q.start||'21:00');field('end','Restriction ends','time',q.end||'07:00');
 field('timezone','Schedule time zone','text',q.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone);
 field('days','Start days (0 Sunday through 6 Saturday)','text',(q.days||[0,1,2,3,4,5,6]).join(','));
 field('domains','Scheduled sites (comma separated, for example youtube.com)','text',(q.domains||[]).join(', '));
 form.append(text('p','Content detection stays active outside these hours. Overnight schedules belong to their start day. Changes apply when this PC reconnects. Up to 200 recent reports are retained; existing blocks remain until removed.','small'));
 const save=text('button','Save this computer’s settings'),status=text('p','','small');save.type='submit';form.append(save,status);
 const list=v=>v.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;status.textContent='Saving…';try{
 const policy={screenEnabled:inputs.screenEnabled.checked,audioEnabled:inputs.audioEnabled.checked,captionsEnabled:inputs.captionsEnabled.checked,slursEnabled:inputs.slursEnabled.checked,earlyCaptionPause:inputs.earlyCaptionPause.checked,blockExplicitTracks:inputs.blockExplicitTracks.checked,visualMode:inputs.visualMode.value,customWords:list(inputs.customWords.value),allowedWords:list(inputs.allowedWords.value),retentionDays:Number(inputs.retentionDays.value),quietHours:{enabled:inputs.scheduled.checked,start:inputs.start.value,end:inputs.end.value,timezone:inputs.timezone.value.trim(),days:list(inputs.days.value).map(Number),domains:list(inputs.domains.value)}};
 await api('device/settings',{device:d.id,policy});status.textContent='Saved. Applies on the next connection.';
 }catch(e){status.textContent='Not saved: '+e.message;}finally{save.disabled=false;}};
 box.append(form);
 const exForm=document.createElement('form'),url=document.createElement('input'),minutes=document.createElement('select'),site=document.createElement('input');
 url.type='url';url.required=true;url.placeholder='https://… page or video to allow';url.setAttribute('aria-label','Address to temporarily allow');
 for(const [v,t]of [[15,'15 minutes'],[60,'1 hour'],[240,'4 hours'],[1440,'24 hours']]){const o=text('option',t);o.value=v;minutes.append(o);}minutes.setAttribute('aria-label','Exception duration');site.type='checkbox';const label=text('label','Allow the whole site');label.append(site);
 const allow=text('button','Add temporary exception'),exStatus=text('p','','small');exForm.append(url,minutes,label,allow,exStatus);
 exForm.onsubmit=async e=>{e.preventDefault();allow.disabled=true;try{await api('exception',{device:d.id,url:url.value,minutes:Number(minutes.value),site:site.checked});await refresh();}catch(e){exStatus.textContent=e.message;}finally{allow.disabled=false;}};box.append(exForm);
 for(const ex of d.exceptions||[]){const row=text('p',(ex.domain||ex.url)+' — allowed until '+new Date(ex.until*1000).toLocaleString());row.append(button('End exception',()=>api('exception/remove',{device:d.id,key:ex.key})));box.append(row);}
 return box;
}};
