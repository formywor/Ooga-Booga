y"use strict";

(() => {
  if (!requireLogin()) return;
  const badgeHtml = (badges) => (badges || []).map((badge) =>
    `<span class="community-badge badge-${escapeHtml(badge.toLowerCase())}">${escapeHtml(badge)}</span>`).join("");

  async function loadAccount() {
    try {
      const [summary, account] = await Promise.all([
        request("/api/community/summary"), request("/api/account"),
      ]);
      const profile = summary.profile;
      $("account-display-name").textContent = profile.displayName;
      $("account-username").textContent = `@${profile.username}${profile.bio ? ` · ${profile.bio}` : ""}`;
      $("account-avatar").textContent = profile.displayName.charAt(0).toUpperCase();
      $("account-avatar").dataset.accent = profile.accent;
      $("account-badges").innerHTML = badgeHtml(profile.badges) || "<span class=\"community-badge\">MEMBER</span>";
      $("account-points").textContent = Number(account.account.pointBalance || 0).toLocaleString();
      $("account-computer").textContent = account.account.registeredComputer ? "Connected" : "Not connected";
      $("account-created").textContent = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Member";
      $("account-unread").textContent = String(summary.unreadCount || 0);
    } catch (error) { message("account-page-message", error.message, "error"); }
  }

  async function loadSettings() {
    try {
      const result = await request("/api/profile/me");
      $("settings-display-name").value = result.profile.displayName;
      $("settings-bio").value = result.profile.bio || "";
      $("settings-accent").value = result.profile.accent;
      $("settings-privacy").checked = result.profile.privacyMode !== false;
      $("bio-count").textContent = $("settings-bio").value.length;
    } catch (error) { message("settings-message", error.message, "error"); }
    $("settings-bio").addEventListener("input", () => {
      $("bio-count").textContent = $("settings-bio").value.length;
    });
    $("profile-settings-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        $("save-profile").disabled = true;
        await request("/api/profile/me", "PATCH", {
          displayName: $("settings-display-name").value,
          bio: $("settings-bio").value,
          accent: $("settings-accent").value,
          privacyMode: $("settings-privacy").checked,
        });
        message("settings-message", "Your settings were saved.", "success");
      } catch (error) { message("settings-message", error.message, "error"); }
      finally { $("save-profile").disabled = false; }
    });
    $("test-privacy").addEventListener("click", () => {
      if (window.ScriptNovaaPrivacy) window.ScriptNovaaPrivacy.hideScreen();
      else message("settings-message", "Turn on and save Privacy Mode first, then reload this page.", "error");
    });
    $("settings-signout").addEventListener("click", async () => {
      try { await request("/api/logout", "POST"); } catch (error) {}
      clearLogin();
      location.replace("/");
    });
  }

  if (document.body.dataset.page === "account") loadAccount();
  if (document.body.dataset.page === "settings") loadSettings();
})();
