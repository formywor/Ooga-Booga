'use strict';
(() => {
 const defaults={hideUltraNotice:false,bubbleStyle:'rounded',settingsIcon:'gear',textSize:'normal',compactChat:false,reduceMotion:false,accentColor:'violet',readingFont:'sans',workspaceView:'comfortable',showStarters:true,enterToSend:true,autoFollow:true};
 const enums={bubbleStyle:['rounded','square','minimal'],settingsIcon:['gear','sliders','spark'],textSize:['small','normal','large'],accentColor:['violet','blue','green','amber'],readingFont:['sans','serif','mono','plain'],workspaceView:['comfortable','focus','wide']};
 function sanitize(input={}){const result={};for(const [key,value] of Object.entries(defaults)){const next=input[key];result[key]=enums[key]?(enums[key].includes(next)?next:value):(typeof next==='boolean'?next:value);}return result;}
 const paths={spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',book:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4ZM12 6v15',pen:'m4 16 12-12 4 4L8 20H4v-4ZM13 7l4 4',code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',arrow:'M5 19 19 5M5 5h14v14'};
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);path.setAttribute('d',paths[name]||paths.spark);svg.append(path);return svg;}
 function patch(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const result={};for(const [key,value] of Object.entries(input)){
    if(key==='theme'){if(!['dark','dim','light','system'].includes(value))return null;}
    else if(!Object.hasOwn(defaults,key)||(enums[key]?!enums[key].includes(value):typeof value!=='boolean'))return null;
    result[key]=value;
  }return Object.keys(result).length?result:null;
 }
 window.NebulaUI=Object.freeze({patch,defaults:Object.freeze(defaults),sanitize,icon});
})();
