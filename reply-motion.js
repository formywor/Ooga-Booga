'use strict';
(()=>{
 const reduced=()=>document.documentElement.dataset.reduceMotion==='true'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function reveal(element,{startAt=performance.now(),duration=1200,onFrame,onDone}={}){
  if(reduced()||document.hidden){onDone?.();return null;}
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),parts=[];let node,total=0;
  while((node=walker.nextNode())){if(node.parentElement.closest('pre,code,table,button'))continue;const chars=Array.from(node.textContent);parts.push({node,chars,start:total});total+=chars.length;}
  if(!total){onDone?.();return null;}
  let frame=0,finished=false;const originalBusy=element.getAttribute('aria-busy');
  const finish=()=>{if(finished)return;finished=true;cancelAnimationFrame(frame);for(const p of parts)p.node.textContent=p.chars.join('');element.classList.remove('reply-typing');if(originalBusy===null)element.removeAttribute('aria-busy');else element.setAttribute('aria-busy',originalBusy);onDone?.();};
  const tick=()=>{
   if(!element.isConnected){cancelAnimationFrame(frame);return;}
   const progress=Math.min(1,Math.max(0,(performance.now()-startAt)/duration));
   if(progress>=1||reduced()||document.hidden){finish();return;}
   const count=Math.ceil(total*progress);for(const p of parts)p.node.textContent=p.chars.slice(0,Math.max(0,Math.min(p.chars.length,count-p.start))).join('');
   onFrame?.();frame=requestAnimationFrame(tick);
  };
  element.classList.add('reply-typing');element.setAttribute('aria-busy','true');frame=requestAnimationFrame(tick);return finish;
 }
 window.NebulaReplyMotion={reveal,reduced};
})();
