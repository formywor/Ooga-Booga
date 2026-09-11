"use strict";
(() => {
  const page = document.body.dataset.page;
  if (page === "notifications") {
    if (!requireLogin()) return;
    const load = async () => { try { const result = await request("/api/notifications");
      $("notification-list").innerHTML = result.notifications.length ? result.notifications.map((item) => `<article class="notification-card${item.readAt ? " read" : ""}"><span>${escapeHtml(String(item.type || "UPDATE").replace(/_/g, " "))}</span><h2>${escapeHtml(item.title || "ScriptNovaa update")}</h2><p>${escapeHtml(item.message || "")}</p><small>${new Date(Number(item.createdAt || 0)).toLocaleString()}</small></article>`).join("") : "<p class=\"empty-claims\">You have no notifications.</p>";
    } catch (error) { message("notifications-message", error.message, "error"); } };
    $("mark-notifications-read").onclick = async () => { try { await request("/api/notifications/read", "POST", {}); await load(); } catch (error) { message("notifications-message", error.message, "error"); } };
    $("enable-browser-notifications").onclick = async () => { if (!("Notification" in window)) return message("notifications-message", "This browser does not support notifications.", "error"); const permission = await Notification.requestPermission(); message("notifications-message", permission === "granted" ? "Browser notifications are enabled on this device." : "Browser notifications remain off.", permission === "granted" ? "success" : "error"); };
    load();
  }
  if (page === "status") {
    const load = async () => { try { const response = await fetch("https://api.scriptnovaa.com/api/status", {cache: "no-store"}); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Status unavailable");
      $("status-services").innerHTML = result.services.map((service) => `<article><i></i><div><b>${escapeHtml(service.name)}</b><small>${escapeHtml(service.status)}${service.responseMilliseconds === undefined ? "" : ` · ${service.responseMilliseconds} ms`}</small></div></article>`).join(""); $("status-updated").textContent = `Checked ${new Date(result.checkedAt).toLocaleString()}`;
    } catch (_) { $("status-services").innerHTML = "<article class=\"status-problem\"><i></i><div><b>Status check unavailable</b><small>The API could not be reached. Try again shortly.</small></div></article>"; } };
    $("refresh-status").onclick = load; load();
  }
  if (page === "features") {
    const target = new Date("2027-01-01T05:00:00Z").getTime(); const tick = () => { const distance = Math.max(0, target - Date.now()); const days = Math.floor(distance / 86400000); const hours = Math.floor(distance / 3600000) % 24; const minutes = Math.floor(distance / 60000) % 60; const seconds = Math.floor(distance / 1000) % 60; $("project-x-countdown").textContent = distance ? `${days}d ${hours}h ${minutes}m ${seconds}s` : "Preview window reached"; }; tick(); setInterval(tick, 1000);
  }
})();
