"use strict";

const API = "https://api.scriptnovaa.com";
const LOGIN_KEY = "scriptnovaaLoginToken";
const REDIRECT_ATTEMPTS_KEY = "scriptnovaaRedirectAttempts";
const LEGACY_REDIRECT_ATTEMPT_KEY = "scriptnovaaRedirectAttempt";
const $ = (id) => document.getElementById(id);

async function request(path, method = "GET", body) {
  const headers = {"Content-Type": "application/json"};
  const login = localStorage.getItem(LOGIN_KEY);
  if (login) headers.Authorization = `Bearer ${login}`;
  const response = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({
    error: "The server returned an invalid response.",
  }));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "Request failed.");
  }
  return result;
}

function message(id, text, kind = "") {
  const node = $(id);
  if (!node) return;
  node.textContent = text;
  node.className = `message ${kind}`;
}

function requireLogin() {
  if (!localStorage.getItem(LOGIN_KEY)) {
    location.href = "/signin";
    return false;
  }
  return true;
}

async function redirectSignedInUser() {
  if (!localStorage.getItem(LOGIN_KEY)) return;
  try {
    await request("/api/account");
    location.replace("/tokens");
  } catch (error) {
    localStorage.removeItem(LOGIN_KEY);
  }
}

function bindSignup() {
  redirectSignedInUser();
  const referral = new URLSearchParams(location.search).get("ref");
  if (referral) $("signup-ref").value = referral;
  $("signup-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/signup", "POST", {
        username: $("signup-user").value,
        pin: $("signup-pin").value,
        referralUsername: $("signup-ref").value,
        clientDescription: navigator.userAgent,
      });
      localStorage.setItem(LOGIN_KEY, result.loginToken);
      message("signup-message",
          `Account created.\n\nSAVE THIS RECOVERY CODE:\n${result.recoveryCode}\n\nIt will not be shown again.`,
          "success");
      $("continue-tokens").classList.remove("hidden");
    } catch (error) {
      message("signup-message", error.message, "error");
    }
  };
}

function bindSignin() {
  redirectSignedInUser();
  $("signin-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/login", "POST", {
        username: $("signin-user").value,
        pin: $("signin-pin").value,
        clientDescription: navigator.userAgent,
      });
      localStorage.setItem(LOGIN_KEY, result.loginToken);
      location.replace("/tokens");
    } catch (error) {
      message("signin-message", error.message, "error");
    }
  };
}

function bindRecovery() {
  $("recovery-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/recover", "POST", {
        username: $("recovery-user").value,
        recoveryCode: $("recovery-code").value,
        newPin: $("recovery-pin").value,
      });
      localStorage.removeItem(LOGIN_KEY);
      message("recovery-message",
          `PIN reset.\n\nSAVE YOUR NEW RECOVERY CODE:\n${result.newRecoveryCode}\n\nSign in again with your new PIN.`,
          "success");
    } catch (error) {
      message("recovery-message", error.message, "error");
    }
  };
}

async function loadTokens() {
  if (!requireLogin()) return;
  try {
    const [accountResult, config, tokenResult] = await Promise.all([
      request("/api/account"),
      request("/api/public-config"),
      request("/api/tokens"),
    ]);
    const account = accountResult.account;
    $("points").textContent = account.pointBalance;
    $("pending").textContent = account.pendingPointBalance;
    $("referral").textContent = account.referralCode;
    $("device").textContent =
      account.registeredComputer ? "Registered" : "Not registered";
    $("duration").innerHTML = config.tokenOptions.map((item) =>
      `<option value="${item.hours}">${item.hours} hour${item.hours === 1 ? "" : "s"} — ${item.points} points</option>`,
    ).join("");
    $("token-list").innerHTML = tokenResult.tokens.length ?
      `<table><thead><tr><th>Token</th><th>Duration</th><th>Status</th></tr></thead><tbody>${
        tokenResult.tokens.map((token) =>
          `<tr><td><code>${token.displayToken || "Hidden after use"}</code></td><td>${token.durationHours}h</td><td>${token.status}</td></tr>`,
        ).join("")
      }</tbody></table>` :
      "<p>You have not created any tokens yet.</p>";
  } catch (error) {
    if (/Authentication/i.test(error.message)) {
      localStorage.removeItem(LOGIN_KEY);
      location.replace("/signin");
      return;
    }
    message("dashboard-message", error.message, "error");
  }
}

function getSavedAttempts() {
  try {
    const saved = JSON.parse(
        localStorage.getItem(REDIRECT_ATTEMPTS_KEY) || "[]",
    );
    if (Array.isArray(saved) && saved.length) return saved;
    const legacy = JSON.parse(
        localStorage.getItem(LEGACY_REDIRECT_ATTEMPT_KEY) || "null",
    );
    if (legacy && legacy.attemptId) {
      localStorage.removeItem(LEGACY_REDIRECT_ATTEMPT_KEY);
      localStorage.setItem(REDIRECT_ATTEMPTS_KEY, JSON.stringify([legacy]));
      return [legacy];
    }
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    localStorage.removeItem(REDIRECT_ATTEMPTS_KEY);
    return [];
  }
}

function saveAttempts(attempts) {
  localStorage.setItem(REDIRECT_ATTEMPTS_KEY, JSON.stringify(attempts));
}

function remainingText(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderPendingClaims(attempts) {
  const list = $("claim-list");
  if (!attempts.length) {
    list.innerHTML = "<p class=\"empty-claims\">No sponsored rewards are waiting to be claimed.</p>";
    return;
  }
  list.innerHTML = attempts.map((attempt, index) => {
    const wait = new Date(attempt.claimableAt).getTime() - Date.now();
    const state = wait > 0 ? `Ready in ${remainingText(wait)}` : "Ready now";
    return `<article class="claim-row">
      <div><strong>Sponsored reward ${index + 1}</strong><span>${state}</span></div>
      <button class="claim-attempt" data-attempt-id="${attempt.attemptId}">Claim 0.5 point</button>
    </article>`;
  }).join("");
}

async function loadRewardStatus() {
  const status = await request("/api/redirect/status");
  $("reward-count").textContent = `${status.openedCount} / ${status.maximumCount}`;
  $("reward-earned").textContent = `${status.earnedPoints} points`;
  return status;
}

async function refreshAccountStatus() {
  try {
    const result = await request("/api/account");
    $("points").textContent = result.account.pointBalance;
    $("pending").textContent = result.account.pendingPointBalance;
    $("device").textContent =
      result.account.registeredComputer ? "Registered" : "Not registered";
    $("device").className = result.account.registeredComputer ?
      "stat device-connected" : "stat";
  } catch (error) {
    // The normal account loader handles authentication errors.
  }
}

function bindTokens() {
  loadTokens();
  let attempts = [];
  renderPendingClaims(attempts);
  const syncRewards = async () => {
    const status = await loadRewardStatus();
    attempts = status.attempts
        .filter((attempt) => attempt.status === "OPENED")
        .map((attempt) => ({
          attemptId: attempt.attemptId,
          claimableAt: new Date(attempt.claimableAt).toISOString(),
        }));
    renderPendingClaims(attempts);
    return status;
  };
  syncRewards().catch((error) =>
    message("redirect-message", error.message, "error"));
  const claimClock = setInterval(() => renderPendingClaims(attempts), 1000);
  const accountClock = setInterval(refreshAccountStatus, 5000);
  window.addEventListener("pagehide", () => {
    clearInterval(claimClock);
    clearInterval(accountClock);
  });

  $("create-token").onclick = async () => {
    try {
      const result = await request("/api/tokens/create", "POST", {
        hours: Number($("duration").value),
      });
      message("token-message", `Token created:\n${result.token}`, "success");
      await loadTokens();
    } catch (error) {
      message("token-message", error.message, "error");
    }
  };

  $("start-redirect").onclick = async () => {
    const adWindow = window.open("about:blank", "_blank");
    try {
      $("start-redirect").disabled = true;
      message("redirect-message", "Preparing your sponsored link…");
      const attempt = await request("/api/redirect/start", "POST", {
        campaignId: "monetag-direct-11435374",
      });
      await syncRewards();
      if (adWindow) {
        adWindow.opener = null;
        adWindow.location = attempt.redirectUrl;
      } else {
        location.href = attempt.redirectUrl;
      }
      message("redirect-message",
          "Sponsored page opened. Return after the displayed claim time to collect 0.5 point.",
          "success");
    } catch (error) {
      if (adWindow) adWindow.close();
      message("redirect-message", error.message, "error");
    } finally {
      $("start-redirect").disabled = false;
    }
  };

  $("claim-list").onclick = async (event) => {
    const button = event.target.closest(".claim-attempt");
    if (!button) return;
    const attempt = attempts.find((item) =>
      item.attemptId === button.dataset.attemptId);
    if (!attempt) return;
    const wait = new Date(attempt.claimableAt).getTime() - Date.now();
    if (wait > 0) {
      message("redirect-message",
          `This reward is still being reviewed. Try again in ${remainingText(wait)}.`,
          "error");
      return;
    }
    try {
      button.disabled = true;
      const result = await request("/api/redirect/claim", "POST", {
        attemptId: attempt.attemptId,
      });
      message("redirect-message",
          `${result.awardedPoints} point added to your balance.`, "success");
      await Promise.all([loadTokens(), syncRewards()]);
    } catch (error) {
      message("redirect-message", error.message, "error");
      button.disabled = false;
    }
  };

  $("create-pairing").onclick = async () => {
    try {
      const result = await request("/api/device/pairing/start", "POST");
      const displayCode =
        `${result.pairingCode.slice(0, 5)}-${result.pairingCode.slice(5)}`;
      $("pairing-code").textContent = displayCode;
      $("pairing-expires").textContent =
        new Date(result.expiresAt).toLocaleTimeString();
      $("pairing-result").classList.remove("hidden");
      message("pairing-message",
          "Enter this code in Share Browser. It works once and expires in 10 minutes.",
          "success");
    } catch (error) {
      message("pairing-message", error.message, "error");
    }
  };
  $("copy-pairing").onclick = () =>
    navigator.clipboard.writeText($("pairing-code").textContent);
  $("copy-referral").onclick = () =>
    navigator.clipboard.writeText(
        `https://scriptnovaa.com/signup?ref=${encodeURIComponent($("referral").textContent)}`,
    );
  $("signout").onclick = async () => {
    try {
      await request("/api/logout", "POST");
    } catch (error) {
      // Local sign-out still completes if the network is unavailable.
    }
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem(REDIRECT_ATTEMPTS_KEY);
    localStorage.removeItem(LEGACY_REDIRECT_ATTEMPT_KEY);
    location.replace("/");
  };
}

const page = document.body.dataset.page;
if (page === "signup") bindSignup();
if (page === "signin") bindSignin();
if (page === "recovery") bindRecovery();
if (page === "tokens") bindTokens();
