(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NebulaAuthPolicy=api;})(typeof window!=='undefined'?window:this,function(){
 'use strict';const WINDOW=15*60*1000;
 function remaining(state,now=Date.now()){return Math.max(0,Math.ceil(((Number(state?.until)||0)-now)/1000));}
 function failed(state,now=Date.now(),providerLimited=false){const recent=state&&now-state.started<WINDOW?state:{started:now,count:0};const count=Math.min(50,(Number(recent.count)||0)+1);return {started:recent.started,count,until:providerLimited||count>=5?now+WINDOW:0};}
 function passwordIssue(value){if(typeof value!=='string'||value.length<12)return 'Use at least 12 characters. A longer passphrase is easier to remember.';if(value.length>128)return 'Use no more than 128 characters.';if(/^(.)\1+$/.test(value)||/^(?:password|1234567890|qwerty|letmein|welcome|abcdefgh)[0-9!@#$]*$/i.test(value))return 'Choose a less predictable password or a longer passphrase.';return '';}
 function resetCode(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&!['443',''].includes(u.port)||!['scriptnovaa.com','share-browser-7091c.firebaseapp.com'].includes(u.hostname)||u.searchParams.get('mode')!=='resetPassword')return '';const code=u.searchParams.get('oobCode');return code&&code.length<=2048?code:'';}catch{return '';}}
 return {remaining,failed,passwordIssue,resetCode};
});
