"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const $ = (id) => document.getElementById(id);
  const token = sessionStorage.getItem(TAB_LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || "";
  if (!token) {
    location.replace("/signin");
    return;
  }
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
  const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const setMessage = (text, kind = "") => {
    $("appeal-message").textContent = text;
    $("appeal-message").className = `message ${kind}`;
  };
  const renderAppeals = (appeals) => {
    $("appeal-history").innerHTML = appeals.length ? appeals.map((appeal) => `
      <article class="appeal-card">
        <div><span>${escapeHtml(new Date(appeal.createdAt).toLocaleString())}</span>
        <h3>${escapeHtml(appeal.subject)}</h3><p>${escapeHtml(appeal.message)}</p></div>
        <strong class="appeal-status ${escapeHtml(appeal.status.toLowerCase())}">${escapeHtml(appeal.status)}</strong>
        ${appeal.adminResponse ? `<p class="appeal-response"><b>ScriptNovaa response</b><br>${escapeHtml(appeal.adminResponse)}</p>` : ""}
      </article>`).join("") : "<p>No appeals submitted.</p>";
    $("appeal-form").classList.toggle("hidden", appeals.some((item) => item.status === "PENDING"));
  };
  const load = async () => {
    const [gateResult, appealResult] = await Promise.all([
      request("/api/account/gate"), request("/api/appeals"),
    ]);
    if (gateResult.gate.type !== "RESTRICTION") {
      location.replace(gateResult.gate.type === "RECOVERY_CONFIRMATION" ? "/backup-code" : "/tokens");
      return;
    }
    const gate = gateResult.gate;
    const expected = document.body.dataset.status;
    if (gate.status !== expected) {
      location.replace(`/${String(gate.status).toLowerCase()}`);
      return;
    }
    $("restriction-username").textContent = gateResult.account.username;
    $("restriction-reason").textContent = gate.reason || "A specific reason was not published.";
    if (gate.status === "SUSPENDED" && gate.endsAt) {
      $("restriction-end-wrap").classList.remove("hidden");
      $("restriction-end").textContent = new Date(gate.endsAt).toLocaleString();
    }
    renderAppeals(appealResult.appeals);
  };
  $("appeal-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      $("submit-appeal").disabled = true;
      await request("/api/appeals", "POST", {
        subject: $("appeal-subject").value,
        message: $("appeal-explanation").value,
      });
      setMessage("Your appeal was submitted for review.", "success");
      await load();
    } catch (error) {
      setMessage(error.message, "error");
      $("submit-appeal").disabled = false;
    }
  };
  $("restriction-signout").onclick = async () => {
    try { await request("/api/logout", "POST"); } catch (error) {}
    sessionStorage.removeItem(TAB_LOGIN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    location.replace("/");
  };
  load().catch((error) => setMessage(error.message, "error"));
})();
