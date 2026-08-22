"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const token = sessionStorage.getItem(TAB_LOGIN_KEY) ||
    localStorage.getItem(LOGIN_KEY) || "";
  if (!token) return;

  const path = location.pathname.replace(/\.html$/i, "").replace(/\/$/, "") || "/";
  const recoveryExempt = new Set(["/backup-code", "/support"]);
  const restrictionPages = new Set(["/suspended", "/banned", "/terminated"]);

  fetch(`${API}/api/account/gate`, {
    headers: {Authorization: `Bearer ${token}`},
    cache: "no-store",
  }).then(async (response) => {
    if (response.status === 401) {
      sessionStorage.removeItem(TAB_LOGIN_KEY);
      if (localStorage.getItem(LOGIN_KEY) === token) localStorage.removeItem(LOGIN_KEY);
      return null;
    }
    return response.json();
  }).then((result) => {
    if (!result?.ok) return;
    const gate = result.gate || {type: "CLEAR"};
    if (gate.type === "RECOVERY_CONFIRMATION" && !recoveryExempt.has(path)) {
      location.replace("/backup-code");
      return;
    }
    if (gate.type === "RESTRICTION") {
      const destination = `/${String(gate.status || "BANNED").toLowerCase()}`;
      if (path !== destination) location.replace(destination);
      return;
    }
    if (gate.type === "CLEAR" && (path === "/backup-code" || restrictionPages.has(path))) {
      location.replace("/tokens");
    }
  }).catch(() => {
    // Individual private pages still validate every request with the API.
    // A network failure never grants access; it only avoids a redirect loop.
  });
})();
