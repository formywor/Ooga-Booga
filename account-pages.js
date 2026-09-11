"use strict";
(() => {
  if (!requireLogin()) return;
  const avatarSymbols = {nova: "S", orbit: "◉", pixel: "◆", bolt: "ϟ", wave: "≋", game: "✦"};
  const badges = (items) => (items || []).map((badge) => `<span class="community-badge badge-${escapeHtml(badge.toLowerCase())}">${escapeHtml(badge)}</span>`).join("");
  const when = (value) => value ? new Date(Number(value)).toLocaleString() : "Unknown";
  const pin = (promptText) => window.prompt(promptText || "Enter your current PIN to continue:") || "";

  async function loadAccount() {
    try {
      const accountResult = await request("/api/account");
      const account = accountResult.account;
      $("account-display-name").textContent = account.username;
      $("account-username").textContent = `@${account.username}`;
      $("account-avatar").textContent = account.username.charAt(0).toUpperCase();
      $("account-points").textContent = Number(account.pointBalance || 0).toLocaleString();
      $("account-computer").textContent = account.registeredComputer ? "Connected" : "Not connected";
      try {
        const summary = await request("/api/community/summary"); const profile = summary.profile;
        $("account-display-name").textContent = profile.displayName;
        $("account-username").textContent = `@${profile.username}${profile.bio ? ` · ${profile.bio}` : ""}`;
        $("account-avatar").textContent = avatarSymbols[profile.avatarId] || profile.displayName.charAt(0).toUpperCase();
        $("account-avatar").dataset.accent = profile.accent;
        $("account-badges").innerHTML = badges(profile.badges) || "<span class=\"community-badge\">MEMBER</span>";
        $("account-created").textContent = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Member";
        $("account-unread").textContent = String(summary.unreadCount || 0);
      } catch (ignored) {
        $("account-created").textContent = "Member"; $("account-unread").textContent = "—";
        message("account-page-message", "Your account loaded. Community details are temporarily unavailable.");
      }
    } catch (error) { $("account-display-name").textContent = "Account unavailable"; message("account-page-message", error.message, "error"); }
  }

  async function loadSecurity() {
    try {
      const result = await request("/api/account/security");
      $("security-sessions").innerHTML = result.sessions.length ? result.sessions.map((session) => `<article class="security-row"><div><b>${escapeHtml(session.client)}${session.current ? " · THIS SESSION" : ""}</b><small>${escapeHtml(session.network)} · active ${escapeHtml(when(session.lastUsedAt))}</small></div><button type="button" class="secondary revoke-session" data-session="${escapeHtml(session.sessionId)}">Revoke</button></article>`).join("") : "<p>No active website sessions.</p>";
      $("security-activity").innerHTML = result.recentActivity.length ? result.recentActivity.map((item) => `<li><b>${escapeHtml(String(item.type || "ACTIVITY").replace(/_/g, " "))}</b><span>${escapeHtml(when(item.createdAt))}</span></li>`).join("") : "<li>No recent activity yet.</li>";
      $("security-alerts").innerHTML = result.alerts.length ? result.alerts.map((alert) => `<article class="security-alert${alert.readAt ? " read" : ""}"><b>${escapeHtml(alert.title || "Security alert")}</b><p>${escapeHtml(alert.message || "")}</p><small>${escapeHtml(when(alert.createdAt))}</small></article>`).join("") : "<p>No unusual-login alerts.</p>";
      $("remove-computer").disabled = !result.device;
      document.querySelectorAll(".revoke-session").forEach((button) => button.onclick = async () => {
        const currentPin = pin("Enter your PIN to revoke this signed-in session:"); if (!currentPin) return;
        try { const response = await request(`/api/account/security/sessions/${encodeURIComponent(button.dataset.session)}/revoke`, "POST", {pin: currentPin}); if (response.currentSessionRevoked) { clearLogin(); location.replace("/signin"); } else await loadSecurity(); }
        catch (error) { message("security-message", error.message, "error"); }
      });
    } catch (error) { message("security-message", error.message, "error"); }
  }

  async function loadSettings() {
    try {
      const result = await request("/api/profile/me"); const p = result.profile;
      $("settings-display-name").value = p.displayName; $("settings-bio").value = p.bio || ""; $("settings-accent").value = p.accent;
      $("settings-avatar").value = p.avatarId || "nova"; $("settings-privacy").checked = p.privacyMode !== false;
      $("settings-dms").checked = p.allowDirectMessages !== false; $("settings-last-active").checked = p.showLastActive === true;
      $("settings-notifications").checked = p.browserNotifications === true; $("bio-count").textContent = $("settings-bio").value.length;
    } catch (error) { message("settings-message", error.message, "error"); }
    $("settings-bio").oninput = () => { $("bio-count").textContent = $("settings-bio").value.length; };
    $("profile-settings-form").onsubmit = async (event) => { event.preventDefault(); try {
      $("save-profile").disabled = true; await request("/api/profile/me", "PATCH", {displayName: $("settings-display-name").value,
        bio: $("settings-bio").value, accent: $("settings-accent").value, avatarId: $("settings-avatar").value,
        privacyMode: $("settings-privacy").checked, allowDirectMessages: $("settings-dms").checked,
        showLastActive: $("settings-last-active").checked, browserNotifications: $("settings-notifications").checked});
      message("settings-message", "Your settings were saved.", "success");
    } catch (error) { message("settings-message", error.message, "error"); } finally { $("save-profile").disabled = false; } };
    $("test-privacy").onclick = () => window.ScriptNovaaPrivacy?.hideScreen();
    $("settings-signout").onclick = async () => { try { await request("/api/logout", "POST"); } catch (_) {} clearLogin(); location.replace("/"); };
    const loadRelationships = async () => { try { const result = await request("/api/community/relationships"); $("relationship-list").innerHTML = result.relationships.length ? result.relationships.map((item) => `<div class="security-row"><div><b>${escapeHtml(item.profile?.displayName || "User")}</b><small>@${escapeHtml(item.profile?.username || "unknown")} · ${escapeHtml(item.kind)}</small></div><button type="button" class="secondary undo-relationship" data-user="${escapeHtml(item.profile?.username || "")}" data-action="${item.kind === "BLOCKED" ? "UNBLOCK" : "UNMUTE"}">${item.kind === "BLOCKED" ? "Unblock" : "Unmute"}</button></div>`).join("") : "<p>You have not blocked or muted anyone.</p>"; document.querySelectorAll(".undo-relationship").forEach((button) => button.onclick = async () => { try { await request(`/api/community/relationships/${encodeURIComponent(button.dataset.user)}`, "POST", {action: button.dataset.action}); await loadRelationships(); } catch (error) { message("settings-message", error.message, "error"); } }); } catch (error) { $("relationship-list").textContent = error.message; } };
    loadRelationships();
  }

  if (document.body.dataset.page === "account") {
    loadAccount(); loadSecurity();
    $("signout-everywhere").onclick = async () => { const currentPin = pin("Enter your PIN to sign out every device:"); if (!currentPin) return; try { await request("/api/account/security/signout-all", "POST", {pin: currentPin}); clearLogin(); location.replace("/signin"); } catch (error) { message("security-message", error.message, "error"); } };
    $("remove-computer").onclick = async () => { const currentPin = pin("Enter your PIN to remove the connected computer:"); if (!currentPin) return; try { await request("/api/account/security/device/remove", "POST", {pin: currentPin}); message("security-message", "The computer was removed. A newly approved connection code is required to reconnect.", "success"); await Promise.all([loadAccount(), loadSecurity()]); } catch (error) { message("security-message", error.message, "error"); } };
    $("change-recovery").onclick = async () => { const currentPin = pin("Enter your PIN to replace your recovery code:"); if (!currentPin) return; try { const result = await request("/api/account/security/recovery/rotate", "POST", {pin: currentPin}); sessionStorage.setItem(RECOVERY_DISPLAY_KEY, result.recoveryCode); location.replace("/backup-code"); } catch (error) { message("security-message", error.message, "error"); } };
  }
  if (document.body.dataset.page === "settings") loadSettings();
})();
