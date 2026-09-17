"use strict";
(async()=>{
  const button=document.getElementById('approve-link'), output=document.getElementById('link-result');
  const id=new URLSearchParams(location.search).get('id');
  try {
    if(!/^[a-f0-9]{32}$/.test(id||''))throw new Error('Open this page from Galaxy Browser.');
    const result=await request('/api/account');
    document.getElementById('link-account').textContent='Connect using '+(result.account?.username||result.username||'your signed-in account');
    button.disabled=false;
  }catch(e){output.textContent=e.message+' Sign in in this browser, then return to this tab.';}
  button.onclick=async()=>{button.disabled=true;try{
    const pairing=await request('/api/device/pairing/start','POST',{});
    await request('/api/galaxy/link/approve','POST',{id,code:pairing.pairingCode});
    output.textContent='Approved. Return to Galaxy to see the connection result.';
  }catch(e){output.textContent=e.message;button.disabled=false;}};
})();
