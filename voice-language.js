(function(root){'use strict';
 const speechLanguage=(text,input='en-US')=>/[\u0600-\u06ff]/.test(text)?'ar-SA':input;
 function selectVoice(voices,{uri='',language='en-US',mobile=false}={}){const group=language.split('-')[0].toLowerCase(),matching=voices.filter(v=>v.lang.toLowerCase().split('-')[0]===group);return matching.find(v=>v.voiceURI===uri)||(mobile&&group==='en'?matching.find(v=>/\bDaniel\b/i.test(v.name)):null)||matching.find(v=>v.localService)||matching[0]||null;}
 const api={speechLanguage,selectVoice};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NebulaVoiceLanguage=api;
})(typeof window==='undefined'?{}:window);
