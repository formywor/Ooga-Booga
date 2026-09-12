"use strict";
(() => {
  const page = document.body.dataset.page;
  if (page === "status") { const style = document.createElement("link"); style.rel = "stylesheet"; style.href = "/status-enhancements.css?v=20260911"; document.head.appendChild(style); }
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
    const drawChart = (history) => {
      const canvas = $("status-chart"); if (!canvas) return;
      const context = canvas.getContext("2d"); const width = canvas.width; const height = canvas.height;
      const padding = {top: 25, right: 28, bottom: 36, left: 54};
      context.clearRect(0, 0, width, height); context.fillStyle = "#0e162a"; context.fillRect(0, 0, width, height);
      const series = [{key: "api", color: "#8d7cff"}, {key: "chat", color: "#50dcc0"},
        {key: "share", color: "#54a8ff"}, {key: "projectZ", color: "#ffbd5b"}];
      const values = history.flatMap((item) => series.map((line) => Number(item.responseMilliseconds?.[line.key] || 0)));
      const maximum = Math.max(50, ...values) * 1.15;
      context.font = "12px Segoe UI"; context.strokeStyle = "#28344d"; context.fillStyle = "#8290aa"; context.lineWidth = 1;
      for (let index = 0; index <= 4; index += 1) { const y = padding.top + ((height - padding.top - padding.bottom) * index / 4);
        context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
        context.fillText(`${Math.round(maximum * (1 - index / 4))} ms`, 7, y + 4); }
      if (history.length < 2) { context.fillStyle = "#aab5c9"; context.fillText("More samples will appear as status checks are recorded.", padding.left + 15, height / 2); return; }
      series.forEach((line) => { context.beginPath(); context.strokeStyle = line.color; context.lineWidth = 3; context.lineJoin = "round";
        history.forEach((item, index) => { const x = padding.left + (width - padding.left - padding.right) * index / Math.max(1, history.length - 1);
          const y = padding.top + (height - padding.top - padding.bottom) * (1 - Number(item.responseMilliseconds?.[line.key] || 0) / maximum);
          if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); });
    };
    const load = async () => { try { const response = await fetch("https://api.scriptnovaa.com/api/status", {cache: "no-store"}); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Status unavailable");
      $("status-services").innerHTML = result.services.map((service) => `<article class="${service.status === "OPERATIONAL" ? "" : "status-problem"}"><i></i><div><b>${escapeHtml(service.name)}</b><small>${escapeHtml(service.status)}${service.responseMilliseconds === undefined ? "" : ` · ${service.responseMilliseconds} ms`}${service.detail ? ` · ${escapeHtml(service.detail)}` : ""}</small></div></article>`).join("");
      const metrics = result.metrics || {}; $("status-availability").textContent = `${Number(metrics.observedAvailabilityPercent || 0).toFixed(2)}%`;
      $("status-down-rate").textContent = `${Number(metrics.observedDownRatePercent || 0).toFixed(2)}%`; $("status-average").textContent = `${Number(metrics.averageResponseMilliseconds?.api || 0)} ms`;
      $("status-samples").textContent = String(metrics.sampleCount || 0); drawChart(result.history || []); $("status-updated").textContent = `Checked ${new Date(result.checkedAt).toLocaleString()}`;
    } catch (_) { $("status-services").innerHTML = "<article class=\"status-problem\"><i></i><div><b>Status check unavailable</b><small>The API could not be reached. Try again shortly.</small></div></article>"; } };
    $("refresh-status").onclick = load; load();
  }
  if (page === "features") {
    const target = new Date("2027-01-01T05:00:00Z").getTime(); const tick = () => { const distance = Math.max(0, target - Date.now()); const days = Math.floor(distance / 86400000); const hours = Math.floor(distance / 3600000) % 24; const minutes = Math.floor(distance / 60000) % 60; const seconds = Math.floor(distance / 1000) % 60; $("project-x-countdown").textContent = distance ? `${days}d ${hours}h ${minutes}m ${seconds}s` : "Preview window reached"; }; tick(); setInterval(tick, 1000);
  }
})();
