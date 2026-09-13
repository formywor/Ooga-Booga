"use strict";
(() => {
  const title = document.getElementById("beta-access-title");
  const detail = document.getElementById("beta-access-detail");
  const action = document.getElementById("beta-access-action");
  const card = document.getElementById("beta-access-card");
  if (!title || !detail || !action || !card || typeof currentLogin !== "function" || !currentLogin()) return;
  request("/api/community/summary").then((result) => {
    const profile = result.profile || {};
    if (profile.betaAccess) {
      card.classList.add("active");
      title.textContent = "Beta is active";
      detail.textContent = profile.betaStatus || "Your exclusive profile tools and early-access benefits are ready.";
      action.href = "/settings";
      action.textContent = "Open Beta settings";
    } else {
      title.textContent = "Not enrolled yet";
      detail.textContent = "Beta access is granted by administrators and is included for approved ScriptNovaa developers.";
      action.href = "/developer-program";
      action.textContent = "View ways to join";
    }
  }).catch(() => {
    title.textContent = "Membership unavailable";
    detail.textContent = "We could not check your access right now. Your account has not been changed.";
    action.href = "/signin";
    action.textContent = "Sign in again";
  });
})();
