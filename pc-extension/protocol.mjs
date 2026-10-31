export const API='https://api.scriptnovaa.com/api/nebula/pc';
export function publicUrl(value){let u;try{u=new URL(value);}catch{throw Error('PC_URL_BLOCKED');}if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||/(?:^|\.)scriptnovaa\.com$/.test(u.hostname)||/^(?:localhost|.*\.(?:local|internal)|(?:\d{1,3}\.){3}\d{1,3}|\[.*\])$/.test(u.hostname)||[...u.searchParams.keys()].some(k=>/^(?:token|key|api_key|password|secret|code|access_token)$/i.test(k)))throw Error('PC_URL_BLOCKED');return u;}
export function safeUrl(value){try{const u=new URL(value);return mask(u.origin+u.pathname);}catch{return '';}}
export function mask(value){return String(value).replace(/\b(?:gsk_|hf_|sk-|AIza|AQ\.|nb_live_)[A-Za-z0-9_-]{18,}\b/g,'[credential hidden]').replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,'[token hidden]').replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,'[private key hidden]');}
export const writes=action=>['click','type','press','select_option','set_checked'].includes(action);

export function sessionAllows(value,origins=[]){const u=publicUrl(value);return origins.includes('https://*/*')||origins.includes(u.origin+'/*');}

export function boundedResult(value){
 const walk=(v,k='')=>typeof v==='string'?mask(v).slice(0,k==='text'?10000:1200):Array.isArray(v)?v.slice(0,80).map(x=>walk(x)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).slice(0,40).map(([key,x])=>[key,walk(x,key)])):v;
 const result=walk(value),bytes=()=>new TextEncoder().encode(JSON.stringify(result)).length;let trimmed=false;
 for(const k of ['network','scripts','forms','errors','elements'])while(bytes()>40000&&result[k]?.length){result[k].pop();trimmed=true;}
 while(bytes()>40000&&result.text?.length){result.text=result.text.slice(0,Math.floor(result.text.length/2));trimmed=true;}
 if(trimmed)result.truncated=true;if(bytes()>42000)throw Error('PC_RESULT_TOO_LARGE');return result;
}
