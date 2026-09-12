"use strict";

(() => {
  if (!requireLogin()) return;
  const chatFixes = document.createElement("link"); chatFixes.rel = "stylesheet"; chatFixes.href = "/chat-fixes.css?v=20260912"; document.head.appendChild(chatFixes);
  const state = {profile: null, mode: "public", threadId: "", other: null,
    poll: null, presencePoll: null, loading: false, lastTypingAt: 0, lastActivityAt: Date.now(),
    translationCache: new Map(), translationSource: new Map(), translationPending: new Set(), translationUnavailable: false};
  const avatarSymbols = {nova: "S", orbit: "◉", pixel: "◆", bolt: "ϟ", wave: "≋", game: "✦"};
  const avatar = (id, name) => avatarSymbols[id] || String(name || "S").charAt(0).toUpperCase();
  const avatarMarkup = (image, id, name) => image ? `<img src="${escapeHtml(image)}" alt="">` : escapeHtml(avatar(id, name));
  const draftKey = () => `scriptnovaaChatDraft:${state.mode}:${state.threadId || "public"}`;
  function connection(ok) { const node = $("connection-state"); node.textContent = ok ? "Connected" : "Connection lost"; node.classList.toggle("lost", !ok); }
  const badges = (items) => (items || []).map((badge) =>
    `<span class="community-badge badge-${escapeHtml(String(badge).toLowerCase())}">${escapeHtml(badge)}</span>`).join("");
  const time = (value) => new Date(Number(value || 0)).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});

  function replaceMessages(html) {
    const box = $("community-messages");
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    const oldHeight = box.scrollHeight;
    box.innerHTML = html;
    if (distanceFromBottom < 100 || oldHeight <= box.clientHeight) box.scrollTop = box.scrollHeight;
    else box.scrollTop += box.scrollHeight - oldHeight;
  }

  function translationTarget() {
    const configured = String(state.profile?.chatLanguage || "AUTO");
    return configured === "AUTO" ? String(navigator.language || "en").slice(0, 10) : configured;
  }

  async function translateVisible() {
    if (state.translationUnavailable || state.profile?.autoTranslateChat === false || /^en(?:-|$)/i.test(translationTarget())) return;
    const nodes = [...document.querySelectorAll("[data-translation-key]")].filter((node) => {
      const key = node.dataset.translationKey; return !state.translationCache.has(key) && !state.translationPending.has(key);
    }).slice(0, 12);
    if (!nodes.length) return;
    const keys = nodes.map((node) => node.dataset.translationKey); keys.forEach((key) => state.translationPending.add(key));
    try {
      const result = await request("/api/community/translate", "POST", {targetLanguage: translationTarget(),
        texts: keys.map((key) => state.translationSource.get(key) || "")});
      if (!result.available) { state.translationUnavailable = true; return; }
      keys.forEach((key, index) => state.translationCache.set(key, result.translations[index]));
      document.querySelectorAll("[data-translation-key]").forEach((node) => {
        const translated = state.translationCache.get(node.dataset.translationKey); if (!translated) return;
        node.querySelector(".message-text").innerHTML = escapeHtml(translated).replace(/\n/g, "<br>");
        node.querySelector(".show-original").classList.remove("hidden"); node.dataset.showing = "translated";
      });
    } catch (_) {} finally { keys.forEach((key) => state.translationPending.delete(key)); }
  }

  function messageText(key, original, suffix = "") {
    state.translationSource.set(key, original); const translated = state.translationCache.get(key); const shown = translated || original;
    return `<p class="translatable" data-translation-key="${escapeHtml(key)}" data-showing="${translated ? "translated" : "original"}"><span class="message-text">${escapeHtml(shown).replace(/\n/g, "<br>")}</span>${suffix}<button type="button" class="show-original${translated ? "" : " hidden"}" data-action="translation">${translated ? "See original" : "See original"}</button></p>`;
  }

  function applyChatPause(until, profile = state.profile) {
    const expires = Number(until || 0); if (expires <= Date.now()) return false;
    const textarea = $("community-text"); const button = $("community-compose").querySelector("button");
    textarea.disabled = true; button.disabled = true;
    textarea.placeholder = `Chat paused until ${new Date(expires).toLocaleString()}`;
    message("community-message", `Chat is paused until ${new Date(expires).toLocaleString()}.`, "error");
    const panel = $("chat-ban-panel"); panel.classList.remove("hidden");
    $("chat-ban-detail").textContent = `${profile?.chatBanReason || "A chat safety restriction is active."} Access is paused until ${new Date(expires).toLocaleString()}.`;
    const buy = $("buy-chat-unban"); const canPay = profile?.paidChatUnbanAllowed === true;
    const affordable = profile?.paidChatUnbanAffordable === true;
    buy.classList.toggle("hidden", !canPay); buy.disabled = canPay && !affordable;
    buy.textContent = affordable ? `Restore for ${Number(profile?.chatUnbanFee || 8)} points` : `Need ${Number(profile?.chatUnbanFee || 8)} points to restore`;
    $("chat-ban-title").textContent = canPay ? "Restore access now or submit an appeal." : "This restriction requires an administrator review.";
    return true;
  }

  function renderPublic(messages) {
    replaceMessages(messages.length ? messages.map((item) => `
      <article class="community-message-row${item.accountId === state.profile.accountId ? " mine" : ""}">
        <div class="community-message-avatar">${avatarMarkup(item.avatarImage, item.avatarId, item.displayName)}</div>
        <div><header><strong>${escapeHtml(item.displayName)} <em class="presence ${escapeHtml(String(item.presence || "OFFLINE").toLowerCase())}"></em></strong><span>@${escapeHtml(item.username)}</span>${badges(item.badges)}<time>${escapeHtml(time(item.createdAt))}</time></header>${item.deleted ? "<p><i>Message deleted</i></p>" : messageText(`public:${item.messageId}`, item.text, item.editedAt ? " <small>(edited)</small>" : "")}${item.deleted ? "" : `<div class="message-actions">${item.accountId === state.profile.accountId ? `<button data-action="edit" data-scope="PUBLIC" data-message="${escapeHtml(item.messageId)}" data-text="${escapeHtml(item.text)}">Edit</button><button data-action="delete" data-scope="PUBLIC" data-message="${escapeHtml(item.messageId)}">Delete</button>` : `<button data-action="report" data-scope="PUBLIC" data-message="${escapeHtml(item.messageId)}">Report</button><button data-action="mute" data-user="${escapeHtml(item.username)}">Mute</button><button data-action="block" data-user="${escapeHtml(item.username)}">Block</button>`}</div>`}</div>
      </article>`).join("") : `<p class="community-empty">It is quiet here. Start the conversation.</p>`); translateVisible();
  }

  function renderPrivate(messages) {
    replaceMessages(messages.length ? messages.map((item) => {
      const mine = item.senderAccountId === state.profile.accountId;
      const read = mine && Object.keys(item.readBy || {}).some((accountId) => accountId !== item.senderAccountId);
      return `<article class="private-message ${mine ? "mine" : "theirs"}"><div class="community-message-avatar">${avatarMarkup(item.senderAvatarImage, item.senderAvatarId, item.senderDisplayName)}</div><div><header><strong>${escapeHtml(item.senderDisplayName || item.senderUsername)}</strong>${badges(item.senderBadges)}<time>${escapeHtml(time(item.createdAt))}</time></header>${item.deleted ? "<p><i>Message deleted</i></p>" : messageText(`private:${state.threadId}:${item.messageId}`, item.text, item.editedAt ? " <small>(edited)</small>" : "")}${item.deleted ? "" : `<div class="message-actions"><button data-action="report" data-scope="PRIVATE" data-message="${escapeHtml(item.messageId)}">Report</button>${mine ? `<button data-action="edit" data-scope="PRIVATE" data-message="${escapeHtml(item.messageId)}" data-text="${escapeHtml(item.text)}">Edit</button><button data-action="delete" data-scope="PRIVATE" data-message="${escapeHtml(item.messageId)}">Delete</button>` : `<button data-action="mute" data-user="${escapeHtml(item.senderUsername)}">Mute</button><button data-action="block" data-user="${escapeHtml(item.senderUsername)}">Block</button>`}</div>`}${mine ? `<small class="read-receipt">${read ? "READ" : "SENT"}</small>` : ""}</div></article>`;
    }).join("") : `<p class="community-empty">Start a private conversation with ${escapeHtml(state.other?.displayName || "this user")}.</p>`); translateVisible();
  }

  async function loadPublic() {
    if (state.loading || state.mode !== "public") return;
    state.loading = true;
    try {
      const result = await request("/api/community/public");
      renderPublic(result.messages);
      $("community-typing").textContent = result.typingLabel || "";
      if (state.mode === "public") $("channel-description").textContent = result.slowModeSeconds ? `Messages disappear after 48 hours · ${result.slowModeSeconds}s slow mode` : "Messages disappear automatically after 48 hours.";
      connection(true);
    } catch (error) { connection(false); message("community-message", error.message, "error"); }
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
      connection(true);
    } catch (error) { connection(false); message("community-message", error.message, "error"); }
    finally { state.loading = false; }
  }

  async function loadThreads() {
    try {
      const result = await request("/api/community/private");
      $("dm-list").innerHTML = result.threads.length ? result.threads.map((thread) => `
        <button type="button" data-thread="${escapeHtml(thread.threadId)}" data-name="${escapeHtml(thread.other.displayName)}" data-user="${escapeHtml(thread.other.username)}" class="dm-person${thread.threadId === state.threadId ? " active" : ""}">
          <span>${avatarMarkup(thread.other.avatarImage, thread.other.avatarId, thread.other.displayName)}</span><div><b>${escapeHtml(thread.other.displayName)} <em class="presence ${escapeHtml(String(thread.other.presence?.state || "OFFLINE").toLowerCase())}"></em></b><small>${escapeHtml(thread.preview || `@${thread.other.username}`)}</small></div>${thread.unread ? "<i></i>" : ""}
        </button>`).join("") : `<p class="community-empty-small">No private messages yet.</p>`;
      document.querySelectorAll("[data-thread]").forEach((button) => button.addEventListener("click", () => {
        openThread(button.dataset.thread, {displayName: button.dataset.name, username: button.dataset.user});
      }));
      const unread = result.threads.find((thread) => thread.unread);
      if (unread && state.profile?.browserNotifications && "Notification" in window && Notification.permission === "granted") {
        const key = `scriptnovaaNotified:${unread.threadId}:${unread.preview}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          new Notification(`Message from ${unread.other.displayName}`, {body: unread.preview || "Open ScriptNovaa Chat to read it."});
        }
      }
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
    $("community-text").value = localStorage.getItem(draftKey()) || "";
    loadThreads(); loadPublic(); startPolling();
  }

  function openThread(threadId, other) {
    state.mode = "private"; state.threadId = threadId; state.other = other;
    $("open-public").classList.remove("active");
    $("channel-symbol").textContent = "@"; $("channel-title").textContent = other.displayName;
    $("channel-description").textContent = `Private conversation with @${other.username} · administrators can review messages`;
    $("community-text").placeholder = `Message ${other.displayName}`;
    $("community-text").value = localStorage.getItem(draftKey()) || "";
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
      $("admin-command-guide").classList.toggle("hidden", !(state.profile.badges || []).includes("ADMIN"));
      applyChatPause(state.profile.chatBannedUntil, state.profile);
      $("community-text").value = localStorage.getItem(draftKey()) || "";
      await request("/api/community/presence", "POST", {state: "ONLINE"});
      await Promise.all([loadThreads(), loadPublic()]);
      startPolling();
      state.presencePoll = setInterval(async () => {
        try { const idle = Date.now() - state.lastActivityAt > 60000; await request("/api/community/presence", "POST", {state: document.hidden || idle ? "IDLE" : "ONLINE"}); connection(true); }
        catch (_) { connection(false); }
      }, 30000);
    } catch (error) { message("community-message", error.message, "error"); }
  }

  $("open-public").addEventListener("click", openPublic);
  $("community-refresh").addEventListener("click", () => state.mode === "public" ? loadPublic() : loadPrivate());
  $("buy-chat-unban").addEventListener("click", async () => {
    const fee = Number(state.profile?.chatUnbanFee || 8);
    if (!confirm(`Use ${fee} points to restore chat access? This does not erase moderation records.`)) return;
    try {
      $("buy-chat-unban").disabled = true;
      const result = await request("/api/community/unban-purchase", "POST", {});
      message("chat-unban-message", `Chat access restored. Your balance is ${result.pointBalance} points.`, "success");
      setTimeout(() => location.reload(), 900);
    } catch (error) { message("chat-unban-message", error.message, "error"); $("buy-chat-unban").disabled = false; }
  });
  $("community-text").addEventListener("input", () => { state.lastActivityAt = Date.now(); localStorage.setItem(draftKey(), $("community-text").value); sendTyping(); });
  $("community-text").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const form = $("community-compose");
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));
  });
  $("community-compose").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("community-text").value.trim();
    if (!text) return;
    try {
      $("community-compose").querySelector("button").disabled = true;
      if (state.mode === "public" && text.startsWith("/")) {
        const result = await request("/api/admin/community/command", "POST", {command: text});
        message("community-message", result.message, "success");
      } else if (state.mode === "public") await request("/api/community/public/messages", "POST", {text});
      else await request(`/api/community/private/${encodeURIComponent(state.threadId)}/messages`, "POST", {text});
      $("community-text").value = "";
      $("community-text").focus();
      localStorage.removeItem(draftKey());
      state.mode === "public" ? await loadPublic() : await loadPrivate();
      $("community-messages").scrollTop = $("community-messages").scrollHeight;
    } catch (error) {
      message("community-message", error.message, "error");
      if (error.code === "CHAT_BANNED") {
        const match = String(error.message).match(/until\s+([^.]*(?:\.\d+)?Z)/i);
        applyChatPause(match ? Date.parse(match[1]) : Date.now() + 2 * 86400000);
      }
    } finally { if (!$("community-text").disabled) $("community-compose").querySelector("button").disabled = false; }
  });

  $("community-messages").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    try {
      const action = button.dataset.action;
      if (action === "translation") {
        const node = button.closest("[data-translation-key]"); const key = node.dataset.translationKey;
        const translated = state.translationCache.get(key); const original = state.translationSource.get(key) || "";
        const showOriginal = node.dataset.showing === "translated"; node.querySelector(".message-text").innerHTML = escapeHtml(showOriginal ? original : translated).replace(/\n/g, "<br>");
        node.dataset.showing = showOriginal ? "original" : "translated"; button.textContent = showOriginal ? "Show translation" : "See original"; return;
      } else if (["block", "mute"].includes(action)) {
        if (!confirm(`${action === "block" ? "Block" : "Mute"} @${button.dataset.user}?`)) return;
        await request(`/api/community/relationships/${encodeURIComponent(button.dataset.user)}`, "POST", {action: action.toUpperCase()});
      } else if (action === "report") {
        const reason = prompt("Briefly explain the safety concern:"); if (!reason) return;
        await request("/api/community/messages/report", "POST", {scope: button.dataset.scope, threadId: state.threadId, messageId: button.dataset.message, reason});
        message("community-message", "Message reported to ScriptNovaa Safety.", "success"); return;
      } else if (action === "edit") {
        const text = prompt("Edit your message (within two minutes):", button.dataset.text || ""); if (!text) return;
        const path = button.dataset.scope === "PRIVATE" ? `/api/community/private/${encodeURIComponent(state.threadId)}/messages/${encodeURIComponent(button.dataset.message)}` : `/api/community/public/messages/${encodeURIComponent(button.dataset.message)}`;
        await request(path, "PATCH", {text});
      } else if (action === "delete") {
        if (!confirm("Delete this message?")) return;
        const path = button.dataset.scope === "PRIVATE" ? `/api/community/private/${encodeURIComponent(state.threadId)}/messages/${encodeURIComponent(button.dataset.message)}` : `/api/community/public/messages/${encodeURIComponent(button.dataset.message)}`;
        await request(path, "DELETE");
      }
      state.mode === "public" ? await loadPublic() : await loadPrivate();
    } catch (error) { message("community-message", error.message, "error"); }
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
          <button type="button" data-start-user="${escapeHtml(user.username)}"><span>${avatarMarkup(user.avatarImage, user.avatarId, user.displayName)}</span><div><b>${escapeHtml(user.displayName)} <em class="presence ${escapeHtml(String(user.presence?.state || "OFFLINE").toLowerCase())}"></em></b><small>@${escapeHtml(user.username)} ${escapeHtml((user.badges || []).join(" · "))}</small></div></button>`).join("") : "<p>No users found.</p>";
      document.querySelectorAll("[data-start-user]").forEach((button) => button.addEventListener("click", async () => {
        try {
          const started = await request("/api/community/private/start", "POST", {username: button.dataset.startUser});
          dialog.close(); openThread(started.threadId, started.other);
        } catch (error) { message("community-message", error.message, "error"); }
      }));
    } catch (error) { $("dm-search-results").textContent = error.message; }
  });
  ["pointerdown", "keydown", "mousemove"].forEach((name) => window.addEventListener(name, () => { state.lastActivityAt = Date.now(); }, {passive: true}));
  window.addEventListener("pagehide", () => { if (state.poll) clearInterval(state.poll); if (state.presencePoll) clearInterval(state.presencePoll); request("/api/community/presence", "POST", {state: "OFFLINE"}).catch(() => {}); });
  initialize();
})();
