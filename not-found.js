'use strict';
(() => {
  // An allowlist avoids open redirects, missing-page loops, and unsafe history.back().
  const safe = value => {
    try {
      if(!value)return null;const url=new URL(value,location.origin);
      if(url.origin!==location.origin||!['/','/index.html'].includes(url.pathname))return null;
      if(url.href===location.href)return null;
      return url.pathname+url.search;
    }catch{return null;}
  };
  let previous=null;try{previous=safe(sessionStorage.getItem('nebula.last-page'));}catch{}
  const destination=previous||safe(document.referrer)||'/';
  const link=document.getElementById('return-link');link.href=destination;
  setTimeout(()=>location.replace(destination),900);
})();
