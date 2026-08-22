"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const $ = (id) => document.getElementById(id);
  const token = sessionStorage.getItem(TAB_LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || "";
  if (!token || !$("live-chat-panel")) return;
  let activeChat = null;
  let poll = null;
  const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const request = async (path, method = "GET", body) => {
    const response = await fetch(API + path, {
      method,
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({error: "Invalid server response."}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Request failed.");
    return result;
  };
  const notice = (text, kind = "") => {
    $("chat-message-result").textContent = text;
    $("chat-message-result").className = `message ${kind}`;
  };
  const render = (chat) => {
    activeChat = chat || null;
    $("chat-start").classList.toggle("hidden", Boolean(chat));
    $("chat-conversation").classList.toggle("hidden", !chat);
    if (!chat) return;
    $("chat-state").textContent = chat.status === "WAITING" ?
      "Waiting for an available agent" : chat.status === "ACTIVE" ?
        `Connected${chat.assignedAgentName ? ` with ${chat.assignedAgentName}` : ""}` : "Chat closed";
    $("chat-messages").innerHTML = chat.messages.length ? chat.messages.map((item) => `
      <article class="chat-bubble ${escapeHtml(item.sender.toLowerCase())}">
        <span>${escapeHtml(item.sender === "USER" ? "You" : item.senderName || "ScriptNovaa Support")} · ${escapeHtml(new Date(item.createdAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}))}</span>
        <p>${escapeHtml(item.message)}</p>
      </article>`).join("") : "<p>No messages yet.</p>";
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
    $("chat-reply-form").classList.toggle("hidden", chat.status === "CLOSED");
  };
  const load = async () => {
    const result = await request("/api/support/chat");
    const current = result.chats.find((item) => item.status !== "CLOSED") || result.chats[0] || null;
    render(current);
  };
  $("chat-start-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      $("start-chat-button").disabled = true;
      const result = await request("/api/support/chat/start", "POST", {
        message: $("chat-first-message").value,
        acceptedPolicy: $("chat-policy").checked,
      });
      render(result.chat);
      notice(result.existing ? "Your existing live chat was reopened." :
        "Chat opened. An agent may respond when available.", "success");
    } catch (error) {
      notice(error.message, "error");
      $("start-chat-button").disabled = false;
    }
  };
  $("chat-reply-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!activeChat) return;
    try {
      $("send-chat-message").disabled = true;
      await request(`/api/support/chat/${encodeURIComponent(activeChat.chatId)}/messages`, "POST", {
        message: $("chat-reply").value,
      });
      $("chat-reply").value = "";
      await load();
    } catch (error) {
      notice(error.message, "error");
    } finally {
      $("send-chat-message").disabled = false;
    }
  };
  load().catch((error) => notice(error.message, "error"));
  poll = setInterval(() => load().catch(() => {}), 10000);
  window.addEventListener("pagehide", () => clearInterval(poll));
})();
