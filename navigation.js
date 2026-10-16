'use strict';
(() => {
  // Record only known, real pages. A custom 404 must never become its own target.
  if(location.pathname==='/'||location.pathname==='/index.html'){
    try{sessionStorage.setItem('nebula.last-page',location.pathname+location.search);}catch{}
  }
})();
