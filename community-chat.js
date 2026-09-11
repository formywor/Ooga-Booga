"use strict";

(() => {
  if (!requireLogin()) return;
  const state = {profile: null, mode: "public", threadId: "", other: null,
    poll: null, loading: false, lastTypingAt: 0};
  const badges = (items) => (items || []).map((badge) =>
    `<span class="community-badge badge-${escapeHtml(String(badge).toLowerCase())}">${escapeHtml(badge)}</span>`).join("");
  const time = (value) => new Date(Number(value || 0)).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});

  function renderPublic(messages) {
    $("community-messages").innerHTML = messages.length ? messages.map((item) => `
      <article class="community-message-row${item.accountId === state.profile.accountId ? " mine" : ""}">
        <div class="community-message-avatar">${escapeHtml(item.displayName.charAt(0).toUpperCase())}</div>
        <div><header><strong>${escapeHtml(item.displayName)}</strong><span>@${escapeHtml(item.username)}</span>${badges(item.badges)}<time>${escapeHtml(time(item.createdAt))}</time></header><p>${escapeHtml(item.text).replace(/\n/g, "<br>")}</p></div>
      </article>`).join("") : `<p class="community-empty">It is quiet here. Start the conversation.</p>`;
  }

  function renderPrivate(messages) {
    $("community-messages").innerHTML = messages.length ? messages.map((item) => {
      const mine = item.senderAccountId === state.profile.accountId;
      const read = mine && Object.keys(item.readBy || {}).some((accountId) => accountId !== item.senderAccountId);
      return `<article class="private-message ${mine ? "mine" : "theirs"}"><div><header><strong>${escapeHtml(item.senderDisplayName || item.senderUsername)}</strong>${badges(item.senderBadges)}<time>${escapeHtml(time(item.createdAt))}</time></header><p>${escapeHtml(item.text).replace(/\n/g, "<br>")}</p>${mine ? `<small class="read-receipt">${read ? "READ" : "SENT"}</small>` : ""}</div></article>`;
    }).join("") : `<p class="community-empty">Start a private conversation with ${escapeHtml(state.other?.displayName || "this user")}.</p>`;
  }

  async function loadPublic() {
    if (state.loading || state.mode !== "public") return;
    state.loading = true;
    try {
      const result = await request("/api/community/public");
      renderPublic(result.messages);
      $("community-typing").textContent = result.typingLabel || "";
    } catch (error) { message("community-message", error.message, "error"); }
    finally { state.loading = false; }
  }

  async function loadPrivate() {
    if (state.loading || state.mode !== "private" || !state.threadId) return;
    state.loading = true;
    try {
      const result = await request(`/api/community/private/${encodeURIComponent(state.threadId)}/messages`);
      renderPrivate(result.messages);
      $("community-typing").textContent = result.typingLabel || "";
      await request(`/api/community/private/${encodeURIComponent(state.threadId)}/read`, "POST", {});
      loadThreads();
    } catch (error) { message("community-message", error.message, "error"); }
    finally { state.loading = false; }
  }

  async function loadThreads() {
    try {
      const result = await request("/api/community/private");
      $("dm-list").innerHTML = result.threads.length ? result.threads.map((thread) => `
        <button type="button" data-thread="${escapeHtml(thread.threadId)}" data-name="${escapeHtml(thread.other.displayName)}" data-user="${escapeHtml(thread.other.username)}" class="dm-person${thread.threadId === state.threadId ? " active" : ""}">
          <span>${escapeHtml(thread.other.displayName.charAt(0).toUpperCase())}</span><div><b>${escapeHtml(thread.other.displayName)}</b><small>${escapeHtml(thread.preview || `@${thread.other.username}`)}</small></div>${thread.unread ? "<i></i>" : ""}
        </button>`).join("") : `<p class="community-empty-small">No private messages yet.</p>`;
      document.querySelectorAll("[data-thread]").forEach((button) => button.addEventListener("click", () => {
        openThread(button.dataset.thread, {displayName: button.dataset.name, username: button.dataset.user});
      }));
    } catch (error) { message("community-message", error.message, "error"); }
  }

  function startPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = setInterval(() => state.mode === "public" ? loadPublic() : loadPrivate(), 5000);
  }

  function openPublic() {
    state.mode = "public"; state.threadId = ""; state.other = null;
    $("open-public").classList.add("active");
    $("channel-symbol").textContent = "#"; $("channel-title").textContent = "public";
    $("channel-description").textContent = "Messages disappear automatically after 48 hours.";
    $("community-text").placeholder = "Message #public";
    loadThreads(); loadPublic(); startPolling();
  }

  function openThread(threadId, other) {
    state.mode = "private"; state.threadId = threadId; state.other = other;
    $("open-public").classList.remove("active");
    $("channel-symbol").textContent = "@"; $("channel-title").textContent = other.displayName;
    $("channel-description").textContent = `Private conversation with @${other.username} · administrators can review messages`;
    $("community-text").placeholder = `Message ${other.displayName}`;
    loadThreads(); loadPrivate(); startPolling();
  }

  async function sendTyping() {
    const now = Date.now();
    if (now - state.lastTypingAt < 4000) return;
    state.lastTypingAt = now;
    try {
      if (state.mode === "public") await request("/api/community/public/typing", "POST", {typing: true});
      else if (state.threadId) await request(`/api/community/private/${encodeURIComponent(state.threadId)}/typing`, "POST", {typing: true});
    } catch (error) {}
  }

  async function initialize() {
    try {
      const summary = await request("/api/community/summary");
      state.profile = summary.profile;
      await Promise.all([loadThreads(), loadPublic()]);
      startPolling();
    } catch (error) { message("community-message", error.message, "error"); }
  }

  $("open-public").addEventListener("click", openPublic);
  $("community-refresh").addEventListener("click", () => state.mode === "public" ? loadPublic() : loadPrivate());
  $("community-text").addEventListener("input", sendTyping);
  $("community-compose").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("community-text").value.trim();
    if (!text) return;
    try {
      $("community-compose").querySelector("button").disabled = true;
      if (state.mode === "public") await request("/api/community/public/messages", "POST", {text});
      else await request(`/api/community/private/${encodeURIComponent(state.threadId)}/messages`, "POST", {text});
      $("community-text").value = "";
      state.mode === "public" ? await loadPublic() : await loadPrivate();
      $("community-messages").scrollTop = $("community-messages").scrollHeight;
    } catch (error) { message("community-message", error.message, "error"); }
    finally { $("community-compose").querySelector("button").disabled = false; }
  });

  const dialog = $("new-dm-dialog");
  $("new-dm-button").addEventListener("click", () => {
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  });
  $("dm-search-button").addEventListener("click", async () => {
    try {
      const query = $("dm-search").value.trim();
      const result = await request(`/api/community/users?query=${encodeURIComponent(query)}`);
      $("dm-search-results").innerHTML = result.users.length ? result.users.map((user) => `
        <button type="button" data-start-user="${escapeHtml(user.username)}"><span>${escapeHtml(user.displayName.charAt(0).toUpperCase())}</span><div><b>${escapeHtml(user.displayName)}</b><small>@${escapeHtml(user.username)} ${escapeHtml((user.badges || []).join(" · "))}</small></div></button>`).join("") : "<p>No users found.</p>";
      document.querySelectorAll("[data-start-user]").forEach((button) => button.addEventListener("click", async () => {
        try {
          const started = await request("/api/community/private/start", "POST", {username: button.dataset.startUser});
          dialog.close(); openThread(started.threadId, started.other);
        } catch (error) { message("community-message", error.message, "error"); }
      }));
    } catch (error) { $("dm-search-results").textContent = error.message; }
  });
  window.addEventListener("pagehide", () => { if (state.poll) clearInterval(state.poll); });
  initialize();
})();
