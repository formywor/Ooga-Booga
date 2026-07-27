"use strict";

const API = "https://api.scriptnovaa.com";
const LOGIN_KEY = "scriptnovaaLoginToken";
const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
const $ = (id) => document.getElementById(id);

function currentLogin() {
  const tabLogin = sessionStorage.getItem(TAB_LOGIN_KEY);
  if (tabLogin) return tabLogin;
  const persistentLogin = localStorage.getItem(LOGIN_KEY) || "";
  if (persistentLogin) sessionStorage.setItem(TAB_LOGIN_KEY, persistentLogin);
  return persistentLogin;
}

function saveLogin(loginToken) {
  sessionStorage.setItem(TAB_LOGIN_KEY, loginToken);
  localStorage.setItem(LOGIN_KEY, loginToken);
}

function clearLogin() {
  const tabLogin = sessionStorage.getItem(TAB_LOGIN_KEY);
  sessionStorage.removeItem(TAB_LOGIN_KEY);
  if (!tabLogin || localStorage.getItem(LOGIN_KEY) === tabLogin) {
    localStorage.removeItem(LOGIN_KEY);
  }
}

async function request(path, method = "GET", body) {
  const headers = {"Content-Type": "application/json"};
  const login = currentLogin();
  if (login) headers.Authorization = `Bearer ${login}`;
  const response = await fetch(API + path, {
    method,
    headers,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({
    error: "The server returned an invalid response.",
  }));
  if (!response.ok || result.ok === false) {
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
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
  if (!currentLogin()) {
    location.href = "/signin";
    return false;
  }
  return true;
}

async function redirectSignedInUser() {
  if (!currentLogin()) return;
  try {
    await request("/api/account");
    location.replace("/tokens");
  } catch (error) {
    clearLogin();
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
      saveLogin(result.loginToken);
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
      saveLogin(result.loginToken);
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
      clearLogin();
      message("recovery-message",
          `PIN reset.\n\nSAVE YOUR NEW RECOVERY CODE:\n${result.newRecoveryCode}\n\nSign in again with your new PIN.`,
          "success");
    } catch (error) {
      message("recovery-message", error.message, "error");
    }
  };
}

let limitedOfferClock = null;

function showLimitedOffer(config, account) {
  const offer = $("limited-offer");
  if (!offer) return;
  if (limitedOfferClock) {
    clearInterval(limitedOfferClock);
    limitedOfferClock = null;
  }
  if (!config.limitedOffer?.active || account.limitedFreeTokenClaimed) {
    offer.classList.add("hidden");
    return;
  }
  const endsAt = new Date(config.limitedOffer.endsAt).getTime();
  const update = () => {
    const remaining = Math.max(0, endsAt - Date.now());
    if (!remaining) {
      offer.classList.add("hidden");
      clearInterval(limitedOfferClock);
      limitedOfferClock = null;
      return;
    }
    const totalMinutes = Math.floor(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    $("limited-countdown").textContent = `${days}d ${hours}h ${minutes}m`;
  };
  offer.classList.remove("hidden");
  update();
  limitedOfferClock = setInterval(update, 60000);
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
      `<option value="${item.id}">${item.label}</option>`,
    ).join("");
    showLimitedOffer(config, account);
    $("token-list").innerHTML = tokenResult.tokens.length ?
      `<table><thead><tr><th>Token</th><th>Duration</th><th>Status</th></tr></thead><tbody>${
        tokenResult.tokens.map((token) => {
          const duration = token.durationLabel || `${token.durationHours}h`;
          return `<tr><td><code>${token.displayToken || "Hidden after use"}</code></td><td>${duration}</td><td>${token.status}</td></tr>`;
        }).join("")
      }</tbody></table>` :
      "<p>You have not created any tokens yet.</p>";
  } catch (error) {
    if (/Authentication/i.test(error.message)) {
      clearLogin();
      location.replace("/signin");
      return;
    }
    message("dashboard-message", error.message, "error");
  }
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
    return result.account.registeredComputer;
  } catch (error) {
    if (error.status === 401 || /Authentication/i.test(error.message)) {
      clearLogin();
      location.replace("/signin");
    }
    return false;
  }
}

function bindTokens() {
  loadTokens();
  let attempts = [];
  let pairingPoll = null;
  const stopPairingPoll = () => {
    if (pairingPoll) clearInterval(pairingPoll);
    pairingPoll = null;
  };
  const beginPairingPoll = (expiresAtValue) => {
    stopPairingPoll();
    const expiresAt = new Date(expiresAtValue).getTime();
    pairingPoll = setInterval(async () => {
      if (Date.now() >= expiresAt) {
        stopPairingPoll();
        $("pairing-result").classList.add("hidden");
        $("create-pairing").textContent = "Generate connection code";
        message("pairing-message",
            "That connection code expired. Generate another code when you are ready.");
        return;
      }
      if (await refreshAccountStatus()) {
        stopPairingPoll();
        $("pairing-result").classList.add("hidden");
        $("create-pairing").textContent = "Generate another code";
        message("pairing-message",
            "Connected! This computer is registered to your account.",
            "success");
      }
    }, 10000);
  };
  const displayPairing = (pairing, announcement) => {
    const displayCode =
      `${pairing.pairingCode.slice(0, 5)}-${pairing.pairingCode.slice(5)}`;
    $("pairing-code").textContent = displayCode;
    $("pairing-expires").textContent =
      new Date(pairing.expiresAt).toLocaleTimeString();
    $("pairing-result").classList.remove("hidden");
    $("create-pairing").textContent = "Generate another code";
    if (announcement) {
      message("pairing-message", announcement, "success");
    }
    beginPairingPoll(pairing.expiresAt);
  };
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
  request("/api/device/pairing/current")
      .then((result) => {
        if (result.pairing) {
          displayPairing(result.pairing,
              "Your active connection code was restored from your account.");
        }
      })
      .catch((error) => {
        if (error.status !== 401) {
          message("pairing-message", error.message, "error");
        }
      });
  const claimClock = setInterval(() => renderPendingClaims(attempts), 1000);
  window.addEventListener("pagehide", () => {
    clearInterval(claimClock);
    stopPairingPoll();
    if (limitedOfferClock) clearInterval(limitedOfferClock);
  });

  $("create-token").onclick = async () => {
    try {
      $("create-token").disabled = true;
      const result = await request("/api/tokens/create", "POST", {
        optionId: $("duration").value,
      });
      message("token-message",
          `${result.durationLabel} token created:\n${result.token}`, "success");
      await loadTokens();
    } catch (error) {
      message("token-message", error.message, "error");
    } finally {
      $("create-token").disabled = false;
    }
  };
  $("select-limited-token").onclick = () => {
    $("duration").value = "free-4m-2026";
    $("token-creator").scrollIntoView({behavior: "smooth", block: "center"});
    message("token-message",
        "Your free four-minute token is selected. Press Create token to claim it.",
        "success");
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
      displayPairing(result,
          "Enter this code in Share Browser. It works once and expires in 10 minutes.");
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
    clearLogin();
    location.replace("/");
  };
}

const page = document.body.dataset.page;
if (page === "signup") bindSignup();
if (page === "signin") bindSignin();
if (page === "recovery") bindRecovery();
if (page === "tokens") bindTokens();
