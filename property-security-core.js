"use strict";
(function(scope){
  function inside(box,w,h,z) {const x=(box[0]+box[2]/2)/w,y=(box[1]+box[3])/h;return x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h;}
  function step(s,{present,armed,connected,now,grace,countdown,response}) {
    if(!armed||!connected)return {phase:"idle",since:now,until:0,event:["warning","countdown","alarm"].includes(s.phase)?"cancel":""};
    if(s.phase==="cooldown")return now<s.until?{...s,event:""}:{phase:"idle",since:now,event:""};
    if(!present)return {phase:"idle",since:now,until:0,event:s.phase==="idle"?"":"cancel"};
    if(s.phase==="idle")return {phase:"confirm",since:now,event:""};
    if(s.phase==="confirm"&&now-s.since>=1000)return response==="record"?{phase:"cooldown",since:now,until:now+20000,event:"record"}:{phase:"warning",since:now,event:"warn"};
    if(s.phase==="warning"&&now-s.since>=grace*1000)return {phase:"countdown",since:now,event:"countdown"};
    if(s.phase==="countdown"&&now-s.since>=countdown*1000)return {phase:"alarm",since:now,event:"alarm"};
    if(s.phase==="alarm"&&now-s.since>=15000)return {phase:"cooldown",since:now,until:now+30000,event:"cancel"};
    return {...s,event:""};
  }
  const api={inside,step};if(typeof module!=="undefined"&&module.exports)module.exports=api;else scope.PropertySecurityCore=api;
})(typeof window!=="undefined"?window:globalThis);
