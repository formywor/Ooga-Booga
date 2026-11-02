'use strict';
(()=>{
 const key='scriptnovaaFamilyAccountV1',session='scriptnovaaFamilySessionV1';
 const read=()=>{try{return localStorage.getItem(key)||sessionStorage.getItem(key)||JSON.parse(localStorage.getItem(session)||sessionStorage.getItem(session)||'null')?.token||'';}catch{return '';}};
 window.ScriptNovaaAuth={token:read,save(token,remember){localStorage.removeItem(key);sessionStorage.removeItem(key);(remember?localStorage:sessionStorage).setItem(key,token);},clear(){localStorage.removeItem(key);sessionStorage.removeItem(key);}};
})();
