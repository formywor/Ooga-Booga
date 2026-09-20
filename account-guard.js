"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const LOGIN_EXPIRY_KEY = "scriptnovaaLoginExpiresAt";
  const remembered = window.ScriptNovaaAuth.token();
  
  sessionStorage.removeItem(TAB_LOGIN_KEY);
  const token = remembered;
  if (!token) return;

  const path = location.pathname.replace(/\.html$/i, "").replace(/\/$/, "") || "/";
  const recoveryExempt = new Set(["/backup-code", "/support"]);
  const restrictionPages = new Set(["/suspended", "/banned", "/terminated"]);

  fetch(`${API}/api/account/gate`, {
    headers: {Authorization: `Bearer ${token}`},
    cache: "no-store",
  }).then(async (response) => {
    if (response.status === 401) {
      if (window.ScriptNovaaAuth.token() !== token) return null;
      sessionStorage.removeItem(TAB_LOGIN_KEY);
      window.ScriptNovaaAuth.clear(token);
      window.dispatchEvent(new Event("scriptnovaa-auth-changed"));
      return null;
    }
    return response.json();
  }).then((result) => {
    if (!result?.ok) return;
    const gate = result.gate || {type: "CLEAR"};
    if (result.account?.pinUpgradeRequired &&
        !sessionStorage.getItem("scriptnovaaPinUpgradePromptShown")) {
      sessionStorage.setItem("scriptnovaaPinUpgradePromptShown", "true");
      const notice = document.createElement("aside");
      notice.className = "security-login-toast";
      notice.innerHTML = "<span class=\"system-badge\">SECURITY</span><strong>Your current PIN is too short. Change it to 7–14 digits.</strong><a href=\"/settings#pin-security\">Change PIN</a><button type=\"button\" aria-label=\"Dismiss\">×</button>";
      notice.querySelector("button").onclick = () => notice.remove();
      document.body.appendChild(notice);
    }
    if (gate.type === "RECOVERY_CONFIRMATION" && !recoveryExempt.has(path)) {
      location.replace("/backup-code");
      return;
    }
    if (gate.type === "RESTRICTION") {
      const destination = `/${String(gate.status || "BANNED").toLowerCase()}`;
      if (path !== destination && path !== "/support") location.replace(destination);
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
