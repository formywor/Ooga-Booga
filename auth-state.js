"use strict";
(() => {
  const KEY = "scriptnovaaAuthV2";
  function record() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw !== null) return JSON.parse(raw) || {};
      // Read-only migration: never delete another tab's in-progress login.
      return {token: localStorage.getItem("scriptnovaaLoginToken") || "", expiresAt: Number(localStorage.getItem("scriptnovaaLoginExpiresAt") || 0)};
    } catch {return {};}
  }
  function token() {const value=record();return typeof value.token === "string" && Number(value.expiresAt)>Date.now() ? value.token : "";}
  function save(value, remember=false) {
    if(typeof value!=="string" || !value) throw new Error("The server did not return a valid login. Please try again.");
    localStorage.setItem(KEY, JSON.stringify({token:value,expiresAt:Date.now()+(remember?30:1)*86400000}));
    sessionStorage.removeItem("scriptnovaaTabLoginToken");
  }
  function clear(expected) {
    if(expected !== undefined && token() !== expected) return false;
    // Keep a tombstone so old cached tabs cannot resurrect a legacy login.
    localStorage.setItem(KEY,JSON.stringify({token:"",expiresAt:0}));
    localStorage.removeItem("scriptnovaaLoginToken");localStorage.removeItem("scriptnovaaLoginExpiresAt");
    sessionStorage.removeItem("scriptnovaaTabLoginToken");return true;
  }
  window.ScriptNovaaAuth={token,save,clear,key:KEY};
  window.addEventListener("storage", event=>{if(event.key===KEY || event.key===null) location.reload();});
})();
