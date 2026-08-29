"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const SPEECH_KEY = "scriptnovaaSupportReadAloud";
  const $ = (id) => document.getElementById(id);
  const token = sessionStorage.getItem(TAB_LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || "";
  if (!token || !$("live-chat-panel")) return;

  let activeChat = null;
  let poll = null;
  let firstLoad = true;
  const knownMessageIds = new Set();
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
  const speechAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const speak = (text) => {
    if (!speechAvailable || !$("chat-read-aloud").checked) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };
  const statusText = (chat) => chat.status === "ASSISTANT" ?
    "ScriptNovaa Assistant is ready" : chat.status === "WAITING" ?
      "Waiting for an available representative" : chat.status === "ACTIVE" ?
        `Connected${chat.assignedAgentName ? ` with ${chat.assignedAgentName}` : " to support"}` :
        "Chat closed";
  const messageHtml = (item) => `
    <article class="chat-bubble ${escapeHtml(item.sender.toLowerCase())}">
      <span>${escapeHtml(item.sender === "USER" ? "You" : item.senderName || "ScriptNovaa Support")} · ${escapeHtml(new Date(item.createdAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}))}</span>
      <p>${escapeHtml(item.message)}</p>
    </article>`;
  const renderPastChats = (chats) => {
    const closed = chats.filter((chat) => chat.status === "CLOSED");
    $("past-chat-count").textContent = closed.length;
    $("past-chat-list").innerHTML = closed.length ? closed.map((chat) => `
      <details class="past-chat-card">
        <summary><span>Closed ${escapeHtml(new Date(chat.updatedAt).toLocaleString())}</span><strong>${escapeHtml(chat.messages[0]?.message || "Support conversation")}</strong></summary>
        <div class="past-chat-thread">${chat.messages.map(messageHtml).join("")}</div>
      </details>`).join("") : "<p class=\"empty-claims\">No past chats yet.</p>";
  };
  const renderActiveChat = (chat, announceNew = false) => {
    activeChat = chat || null;
    $("chat-start").classList.toggle("hidden", Boolean(chat));
    $("chat-conversation").classList.toggle("hidden", !chat);
    if (!chat) return;
    $("chat-state").textContent = statusText(chat);
    $("chat-messages").innerHTML = chat.messages.length ?
      chat.messages.map(messageHtml).join("") : "<p>No messages yet.</p>";
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
    $("chat-reply-form").classList.toggle("hidden", chat.status === "CLOSED");
    $("transfer-chat").classList.toggle("hidden", chat.status !== "ASSISTANT");
    if (announceNew) {
      const newReply = [...chat.messages].reverse().find((item) =>
        !knownMessageIds.has(item.messageId) && ["ASSISTANT", "AGENT"].includes(item.sender));
      if (newReply) speak(newReply.message);
    }
    chat.messages.forEach((item) => knownMessageIds.add(item.messageId));
  };
  const load = async (announceNew = true) => {
    const result = await request("/api/support/chat");
    const current = result.chats.find((item) => item.status !== "CLOSED") || null;
    const previouslyOpen = activeChat;
    renderActiveChat(current, announceNew && !firstLoad);
    renderPastChats(result.chats);
    if (previouslyOpen && !current &&
        result.chats.some((item) => item.chatId === previouslyOpen.chatId && item.status === "CLOSED")) {
      notice("This chat was closed. You can start a new conversation now.", "success");
    }
    firstLoad = false;
  };

  $("chat-read-aloud").checked = localStorage.getItem(SPEECH_KEY) === "true";
  if (!speechAvailable) {
    $("chat-read-aloud").disabled = true;
    $("chat-read-aloud").parentElement.title = "Read aloud is not supported by this browser.";
  }
  $("chat-read-aloud").onchange = () => {
    localStorage.setItem(SPEECH_KEY, String($("chat-read-aloud").checked));
    if (!$("chat-read-aloud").checked && speechAvailable) window.speechSynthesis.cancel();
  };
  $("toggle-past-chats").onclick = () => {
    const opening = $("past-chat-list").classList.contains("hidden");
    $("past-chat-list").classList.toggle("hidden", !opening);
    $("toggle-past-chats").setAttribute("aria-expanded", String(opening));
  };
  $("chat-start-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      $("start-chat-button").disabled = true;
      const result = await request("/api/support/chat/start", "POST", {
        message: $("chat-first-message").value,
        acceptedPolicy: $("chat-policy").checked,
      });
      renderActiveChat(result.chat, true);
      notice(result.existing ? "Your current conversation is already open." :
        "The ScriptNovaa Assistant reviewed your question.", "success");
    } catch (error) {
      notice(error.message, "error");
    } finally {
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
      await load(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      $("send-chat-message").disabled = false;
    }
  };
  $("transfer-chat").onclick = async () => {
    if (!activeChat) return;
    try {
      $("transfer-chat").disabled = true;
      await request(`/api/support/chat/${encodeURIComponent(activeChat.chatId)}/transfer`, "POST", {});
      await load(true);
      notice("Transfer requested. You may keep adding details while you wait.", "success");
    } catch (error) {
      notice(error.message, "error");
    } finally {
      $("transfer-chat").disabled = false;
    }
  };
  $("close-chat").onclick = async () => {
    if (!activeChat) return;
    try {
      $("close-chat").disabled = true;
      await request(`/api/support/chat/${encodeURIComponent(activeChat.chatId)}/close`, "POST", {});
      activeChat = null;
      $("chat-first-message").value = "";
      $("chat-policy").checked = false;
      await load(false);
      notice("Chat closed. You can start a new conversation now.", "success");
    } catch (error) {
      notice(error.message, "error");
    } finally {
      $("close-chat").disabled = false;
    }
  };

  load(false).catch((error) => notice(error.message, "error"));
  poll = setInterval(() => load(true).catch(() => {}), 10000);
  window.addEventListener("pagehide", () => {
    clearInterval(poll);
    if (speechAvailable) window.speechSynthesis.cancel();
  });
})();
