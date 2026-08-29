"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const $ = (id) => document.getElementById(id);
  let activeAccountId = "";
  let administrator = null;
  const token = () => sessionStorage.getItem(TAB_LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || "";
  const saveToken = (value) => { sessionStorage.setItem(TAB_LOGIN_KEY, value); };
  const clearToken = () => { sessionStorage.removeItem(TAB_LOGIN_KEY); localStorage.removeItem(LOGIN_KEY); };
  const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const request = async (path, method = "GET", body) => {
    const headers = {"Content-Type": "application/json"};
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(API + path, {method, headers,
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"});
    const result = await response.json().catch(() => ({error: "Invalid server response."}));
    if (!response.ok || result.ok === false) {
      const error = new Error(result.error || "Request failed."); error.status = response.status; throw error;
    }
    return result;
  };
  const flash = (id, text, kind = "") => { $(id).textContent = text; $(id).className = `message ${kind}`; };
  const date = (value) => value ? new Date(value).toLocaleString() : "—";
  const revealDashboard = (me) => {
    administrator = me.administrator;
    $("admin-login-panel").classList.add("hidden");
    $("admin-dashboard").classList.remove("hidden");
    $("admin-signout").classList.remove("hidden");
    $("admin-identity").textContent = `${administrator.displayName} · ${administrator.role}`;
  };
  const verify = async () => {
    if (!token()) return;
    try { revealDashboard(await request("/api/admin/me")); await refreshQueues(); }
    catch (error) { if (error.status === 401) clearToken(); flash("admin-login-message", error.message, "error"); }
  };
  $("admin-login-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const login = await request("/api/login", "POST", {username: $("admin-username").value,
        pin: $("admin-pin").value, clientDescription: navigator.userAgent});
      saveToken(login.loginToken);
      revealDashboard(await request("/api/admin/me"));
      await refreshQueues();
    } catch (error) { clearToken(); flash("admin-login-message", error.message, "error"); }
  };
  $("admin-signout").onclick = async () => { try { await request("/api/logout", "POST"); } catch (error) {} clearToken(); location.reload(); };
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.onclick = () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.add("hidden"));
    $(`admin-tab-${button.dataset.adminTab}`).classList.remove("hidden");
  });

  const renderAccount = async (summary) => {
    activeAccountId = summary.accountId;
    const result = await request(`/api/admin/accounts/${encodeURIComponent(activeAccountId)}`);
    const account = result.account;
    $("admin-account-detail").classList.remove("hidden");
    $("admin-account-id").textContent = account.accountId;
    $("admin-account-name").textContent = account.username;
    $("admin-account-status").textContent = account.accountStatus;
    $("admin-account-trust").textContent = `Trust ${account.trustScore}`;
    $("admin-account-points").textContent = `${account.pointBalance} points`;
    $("account-status-select").value = account.accountStatus;
    $("account-status-reason").value = account.statusReason || "";
    $("account-trust-score").value = account.trustScore;
    $("admin-network-history").innerHTML = account.networkHistory.length ? `<div class="admin-table">${account.networkHistory.map((item) => `<div><code>${escapeHtml(item.networkPrefix)}</code><span>${escapeHtml(item.client)}</span><small>${escapeHtml(date(item.lastUsedAt))}${item.revoked ? " · revoked" : ""}</small></div>`).join("")}</div>` : "<p>No network history recorded yet.</p>";
    $("admin-point-history").innerHTML = account.recentPointTransactions.length ? `<div class="admin-table">${account.recentPointTransactions.map((item) => `<div><strong>${item.amount > 0 ? "+" : ""}${escapeHtml(item.amount)}</strong><span>${escapeHtml(item.type)}</span><small>${escapeHtml(item.reason || date(item.createdAt))}</small></div>`).join("")}</div>` : "<p>No point history recorded.</p>";
  };
  $("account-search-form").onsubmit = async (event) => {
    event.preventDefault();
    try { const result = await request("/api/admin/accounts/search", "POST", {username: $("account-search-username").value}); await renderAccount(result.account); flash("account-search-message", "Account loaded.", "success"); }
    catch (error) { flash("account-search-message", error.message, "error"); }
  };
  $("account-status-form").onsubmit = async (event) => {
    event.preventDefault(); if (!activeAccountId) return;
    try { const status = $("account-status-select").value; const endValue = $("account-status-end").value;
      await request(`/api/admin/accounts/${encodeURIComponent(activeAccountId)}/status`, "POST", {status, reason: $("account-status-reason").value, endsAt: status === "SUSPENDED" && endValue ? new Date(endValue).getTime() : null});
      flash("admin-account-message", "Account status updated and audited.", "success"); await renderAccount({accountId: activeAccountId});
    } catch (error) { flash("admin-account-message", error.message, "error"); }
  };
  $("account-trust-form").onsubmit = async (event) => { event.preventDefault(); if (!activeAccountId) return;
    try { await request(`/api/admin/accounts/${encodeURIComponent(activeAccountId)}/trust`, "POST", {trustScore: Number($("account-trust-score").value), reason: $("account-trust-reason").value}); flash("admin-account-message", "Trust score updated and audited.", "success"); await renderAccount({accountId: activeAccountId}); }
    catch (error) { flash("admin-account-message", error.message, "error"); }
  };
  $("account-points-form").onsubmit = async (event) => { event.preventDefault(); if (!activeAccountId) return;
    try { await request(`/api/admin/accounts/${encodeURIComponent(activeAccountId)}/points`, "POST", {amount: Number($("account-points-amount").value), reason: $("account-points-reason").value}); $("account-points-form").reset(); flash("admin-account-message", "Point balance updated and audited.", "success"); await renderAccount({accountId: activeAccountId}); }
    catch (error) { flash("admin-account-message", error.message, "error"); }
  };

  const renderTickets = (tickets) => {
    $("ticket-count").textContent = tickets.filter((item) => item.status === "PENDING").length;
    $("admin-ticket-list").innerHTML = tickets.length ? tickets.map((ticket) => `<article class="admin-queue-card"><header><div><span>${escapeHtml(ticket.category)} · ${escapeHtml(ticket.username || "")}</span><h3>${escapeHtml(ticket.subject)}</h3></div><strong>${escapeHtml(ticket.status)}</strong></header><p>${escapeHtml(ticket.message)}</p><form class="admin-ticket-response" data-id="${escapeHtml(ticket.ticketId)}" data-category="${escapeHtml(ticket.category)}"><textarea maxlength="2000" required placeholder="Response to the user">${escapeHtml(ticket.adminResponse || "")}</textarea><select>${ticket.category === "CONNECTION_CODE_REPLACEMENT" ? "<option>PENDING</option><option>APPROVED</option><option>DECLINED</option>" : "<option>PENDING</option><option>ANSWERED</option><option>CLOSED</option>"}</select><button>Save response</button></form></article>`).join("") : `<p class="admin-empty">No support tickets.</p>`;
  };
  const renderChats = (chats) => {
    $("chat-count").textContent = chats.length;
    $("admin-chat-list").innerHTML = chats.length ? chats.map((chat) => `<article class="admin-queue-card"><header><div><span>${escapeHtml(chat.username)} · ${escapeHtml(date(chat.updatedAt))}</span><h3>Live support chat</h3></div><strong>${escapeHtml(chat.status)}</strong></header><div class="admin-chat-thread">${chat.messages.map((item) => `<p class="${escapeHtml(item.sender.toLowerCase())}"><b>${escapeHtml(item.senderName || item.sender)}</b><br>${escapeHtml(item.message)}</p>`).join("")}</div><form class="admin-chat-response" data-id="${escapeHtml(chat.chatId)}"><input maxlength="800" placeholder="Reply as support" required><button>Send</button><button type="button" class="light-button close-admin-chat">Close chat</button></form></article>`).join("") : `<p class="admin-empty">No live chats.</p>`;
  };
  const renderAppeals = (appeals) => {
    $("appeal-count").textContent = appeals.length;
    $("admin-appeal-list").innerHTML = appeals.length ? appeals.map((appeal) => `<article class="admin-queue-card"><header><div><span>${escapeHtml(appeal.username)} · ${escapeHtml(appeal.restrictionStatus)}</span><h3>${escapeHtml(appeal.subject)}</h3></div><strong>${escapeHtml(appeal.status)}</strong></header><p>${escapeHtml(appeal.message)}</p>${appeal.status === "PENDING" ? `<form class="admin-appeal-response" data-id="${escapeHtml(appeal.appealId)}"><textarea maxlength="2000" minlength="10" placeholder="Decision explanation" required></textarea><select><option value="DENIED">Deny appeal</option><option value="APPROVED">Approve appeal</option></select><label><input type="checkbox" class="restore-account"> Restore account access when approved</label><button>Submit decision</button></form>` : `<p class="admin-decision"><b>Decision:</b> ${escapeHtml(appeal.adminResponse)}</p>`}</article>`).join("") : `<p class="admin-empty">No appeals.</p>`;
  };
  const renderOld = (tickets, chats, appeals) => {
    const records = [
      ...tickets.map((item) => ({type: "Ticket", status: item.status,
        title: item.subject, username: item.username, detail: item.adminResponse || item.message,
        updatedAt: item.updatedAt})),
      ...chats.map((item) => ({type: "Chat", status: item.status,
        title: item.messages[0]?.message || "Support conversation", username: item.username,
        detail: item.messages[item.messages.length - 1]?.message || "Chat closed.",
        updatedAt: item.updatedAt})),
      ...appeals.map((item) => ({type: "Appeal", status: item.status,
        title: item.subject, username: item.username, detail: item.adminResponse || item.message,
        updatedAt: item.updatedAt})),
    ].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    $("old-count").textContent = records.length;
    $("admin-old-list").innerHTML = records.length ? records.map((record) =>
      `<article class="admin-queue-card old-record"><header><div><span>${escapeHtml(record.type)} · ${escapeHtml(record.username || "")} · ${escapeHtml(date(record.updatedAt))}</span><h3>${escapeHtml(record.title)}</h3></div><strong>${escapeHtml(record.status)}</strong></header><p>${escapeHtml(record.detail)}</p></article>`).join("") :
      `<p class="admin-empty">No completed support records.</p>`;
  };
  async function refreshQueues() {
    const [tickets, chats, appeals] = await Promise.all([request("/api/admin/support/tickets"), request("/api/admin/support/chats"), request("/api/admin/appeals")]);
    const activeTickets = tickets.tickets.filter((item) => ["PENDING", "APPROVED"].includes(item.status));
    const activeChats = chats.chats.filter((item) => ["WAITING", "ACTIVE"].includes(item.status));
    const activeAppeals = appeals.appeals.filter((item) => item.status === "PENDING");
    const oldTickets = tickets.tickets.filter((item) => !["PENDING", "APPROVED"].includes(item.status));
    const oldChats = chats.chats.filter((item) => item.status === "CLOSED");
    const oldAppeals = appeals.appeals.filter((item) => item.status !== "PENDING");
    renderTickets(activeTickets);
    renderChats(activeChats);
    renderAppeals(activeAppeals);
    renderOld(oldTickets, oldChats, oldAppeals);
  }
  $("admin-ticket-list").onclick = async (event) => { const form = event.target.closest(".admin-ticket-response"); if (!form || event.target.tagName !== "BUTTON") return; event.preventDefault(); try { await request(`/api/admin/support/tickets/${encodeURIComponent(form.dataset.id)}/respond`, "POST", {response: form.querySelector("textarea").value, status: form.querySelector("select").value}); await refreshQueues(); } catch (error) { flash("admin-global-message", error.message, "error"); } };
  $("admin-chat-list").onclick = async (event) => { const form = event.target.closest(".admin-chat-response"); if (!form) return; event.preventDefault(); try { if (event.target.classList.contains("close-admin-chat")) await request(`/api/admin/support/chats/${encodeURIComponent(form.dataset.id)}/status`, "POST", {status: "CLOSED"}); else if (event.target.tagName === "BUTTON") await request(`/api/admin/support/chats/${encodeURIComponent(form.dataset.id)}/messages`, "POST", {message: form.querySelector("input").value}); else return; await refreshQueues(); } catch (error) { flash("admin-global-message", error.message, "error"); } };
  $("admin-appeal-list").onclick = async (event) => { const form = event.target.closest(".admin-appeal-response"); if (!form || event.target.tagName !== "BUTTON") return; event.preventDefault(); try { await request(`/api/admin/appeals/${encodeURIComponent(form.dataset.id)}/review`, "POST", {response: form.querySelector("textarea").value, status: form.querySelector("select").value, restoreAccount: form.querySelector(".restore-account").checked}); await refreshQueues(); } catch (error) { flash("admin-global-message", error.message, "error"); } };
  $("admin-refresh").onclick = () => refreshQueues().catch((error) => flash("admin-global-message", error.message, "error"));
  verify();
})();
