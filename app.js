"use strict";

const API = "https://api.scriptnovaa.com";
const LOGIN_KEY = "scriptnovaaLoginToken";
const REDIRECT_ATTEMPT_KEY = "scriptnovaaRedirectAttempt";
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
    location.href = "signin.html";
    return false;
  }
  return true;
}

async function redirectSignedInUser() {
  if (!localStorage.getItem(LOGIN_KEY)) return;
  try {
    await request("/api/account");
    location.replace("tokens.html");
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
      location.replace("tokens.html");
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
    $("launcher-token").textContent = localStorage.getItem(LOGIN_KEY);
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
      location.replace("signin.html");
      return;
    }
    message("dashboard-message", error.message, "error");
  }
}

function getSavedAttempt() {
  try {
    return JSON.parse(localStorage.getItem(REDIRECT_ATTEMPT_KEY) || "null");
  } catch (error) {
    localStorage.removeItem(REDIRECT_ATTEMPT_KEY);
    return null;
  }
}

function saveAttempt(attempt) {
  if (attempt) {
    localStorage.setItem(REDIRECT_ATTEMPT_KEY, JSON.stringify(attempt));
  } else {
    localStorage.removeItem(REDIRECT_ATTEMPT_KEY);
  }
}

function updateClaimState(attempt) {
  const button = $("claim-redirect");
  if (!attempt) {
    button.classList.add("hidden");
    $("claim-time").textContent = "No reward waiting";
    return;
  }
  const claimable = new Date(attempt.claimableAt).getTime();
  button.classList.remove("hidden");
  button.disabled = Date.now() < claimable;
  $("claim-time").textContent = new Date(claimable).toLocaleString();
}

function bindTokens() {
  loadTokens();
  let attempt = getSavedAttempt();
  updateClaimState(attempt);
  const claimClock = setInterval(() => updateClaimState(attempt), 1000);
  window.addEventListener("pagehide", () => clearInterval(claimClock));

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
      attempt = await request("/api/redirect/start", "POST", {
        campaignId: "monetag-direct-11435374",
      });
      saveAttempt(attempt);
      updateClaimState(attempt);
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

  $("claim-redirect").onclick = async () => {
    if (!attempt) return;
    try {
      const result = await request("/api/redirect/claim", "POST", {
        attemptId: attempt.attemptId,
        claimCode: attempt.claimCode,
      });
      attempt = null;
      saveAttempt(null);
      updateClaimState(null);
      message("redirect-message",
          `${result.awardedPoints} point added to your balance.`, "success");
      await loadTokens();
    } catch (error) {
      message("redirect-message", error.message, "error");
    }
  };

  $("copy-login").onclick = () =>
    navigator.clipboard.writeText(localStorage.getItem(LOGIN_KEY));
  $("copy-referral").onclick = () =>
    navigator.clipboard.writeText(
        `https://scriptnovaa.com/signup.html?ref=${encodeURIComponent($("referral").textContent)}`,
    );
  $("signout").onclick = async () => {
    try {
      await request("/api/logout", "POST");
    } catch (error) {
      // Local sign-out still completes if the network is unavailable.
    }
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem(REDIRECT_ATTEMPT_KEY);
    location.replace("index.html");
  };
}

const page = document.body.dataset.page;
if (page === "signup") bindSignup();
if (page === "signin") bindSignin();
if (page === "recovery") bindRecovery();
if (page === "tokens") bindTokens();
