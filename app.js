"use strict";

const API = "https://api.scriptnovaa.com";
const LOGIN_KEY = "scriptnovaaLoginToken";
const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
const RECOVERY_DISPLAY_KEY = "scriptnovaaPendingRecoveryCode";
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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
    if (result.gate?.type === "RESTRICTION") {
      location.replace(`/${String(result.gate.status || "banned").toLowerCase()}`);
    } else if (result.gate?.type === "RECOVERY_CONFIRMATION" &&
        location.pathname.replace(/\.html$/i, "") !== "/support") {
      location.replace("/backup-code");
    }
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    error.code = result.code || "";
    error.gate = result.gate || null;
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
    const result = await request("/api/account/gate");
    if (result.gate?.type === "RECOVERY_CONFIRMATION") {
      location.replace("/backup-code");
    } else if (result.gate?.type === "RESTRICTION") {
      location.replace(`/${String(result.gate.status || "banned").toLowerCase()}`);
    } else {
      location.replace("/tokens");
    }
  } catch (error) {
    if (error.status === 401) clearLogin();
  }
}

function bindSignup() {
  redirectSignedInUser();
  const referral = new URLSearchParams(location.search).get("ref");
  if (referral) $("signup-ref").value = referral;
  $("signup-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      if ($("signup-pin").value !== $("signup-pin-confirm").value) {
        throw new Error("The two PIN entries do not match.");
      }
      const button = event.submitter || $("signup-form").querySelector("button");
      button.disabled = true;
      button.textContent = "Creating your account…";
      const result = await request("/api/signup", "POST", {
        username: $("signup-user").value,
        pin: $("signup-pin").value,
        referralUsername: $("signup-ref").value,
        clientDescription: navigator.userAgent,
      });
      saveLogin(result.loginToken);
      sessionStorage.setItem(RECOVERY_DISPLAY_KEY, result.recoveryCode);
      location.replace("/backup-code");
    } catch (error) {
      message("signup-message", error.message, "error");
      const button = $("signup-form").querySelector("button");
      button.disabled = false;
      button.textContent = "Create account";
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
      if (result.gate?.type === "RECOVERY_CONFIRMATION") {
        location.replace("/backup-code");
      } else if (result.gate?.type === "RESTRICTION") {
        location.replace(`/${String(result.gate.status || "banned").toLowerCase()}`);
      } else {
        location.replace("/tokens");
      }
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
        clientDescription: navigator.userAgent,
      });
      clearLogin();
      saveLogin(result.loginToken);
      sessionStorage.setItem(RECOVERY_DISPLAY_KEY, result.newRecoveryCode);
      location.replace("/backup-code");
    } catch (error) {
      message("recovery-message", error.message, "error");
    }
  };
}

let limitedOfferClock = null;
let tokenConfiguration = null;
function renderTokenOptions() {
  if (!tokenConfiguration) return;
  const isZ = $("token-product")?.value === "z";
  const options = isZ ? tokenConfiguration.projectZ?.tokenOptions || [] : tokenConfiguration.tokenOptions;
  const previous = $("duration").value;
  $("duration").innerHTML = options.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
  if (options.some((item) => item.id === previous)) $("duration").value = previous;
  $("create-token").disabled = options.length === 0;
  if ($("product-notice")) $("product-notice").textContent = isZ ?
    "Z tokens work only in Project Z on your connected computer. Direct internet; no VPN or FAST surcharge. Two unused tokens maximum across both products." :
    "Share tokens work only in Share Browser. Two unused tokens maximum across both products.";
}

function showDeviceWelcome(account) {
  const welcome = $("device-welcome");
  if (!welcome) return;
  welcome.classList.toggle("hidden", !account.deviceSetupNoticePending);
}

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
    $("device").className = account.registeredComputer ?
      "stat device-connected" : "stat";
    showDeviceWelcome(account);
    tokenConfiguration = config;
    renderTokenOptions();
    showLimitedOffer(config, account);
    $("token-list").innerHTML = tokenResult.tokens.length ?
      `<table><thead><tr><th>Token</th><th>Duration</th><th>Status</th><th>Action</th></tr></thead><tbody>${
        tokenResult.tokens.map((token) => {
          const duration = (token.product === "z" ? "Project Z · " : "Share · ") + (token.durationLabel || `${token.durationHours}h`);
          const displayToken = token.displayToken || "";
          const action = displayToken ?
            `<button class="copy-token light-button" data-token="${escapeHtml(displayToken)}">Copy token</button>` :
            "";
          return `<tr><td><code>${escapeHtml(displayToken || "Hidden after use")}</code></td><td>${escapeHtml(duration)}</td><td>${escapeHtml(token.status)}</td><td>${action}</td></tr>`;
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

async function detectAdBlocker() {
  const bait = document.createElement("div");
  bait.className = "adsbox ad-banner ad-unit sponsored-ad";
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;";
  document.body.appendChild(bait);
  await new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
  const baitStyle = getComputedStyle(bait);
  const baitBlocked =
    bait.offsetHeight === 0 ||
    bait.offsetWidth === 0 ||
    baitStyle.display === "none" ||
    baitStyle.visibility === "hidden";
  bait.remove();

  let networkBlocked = false;
  try {
    await fetch(`https://nap5k.com/tag.min.js?check=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    networkBlocked = true;
  }
  return baitBlocked || networkBlocked;
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
    showDeviceWelcome(result.account);
    return result.account;
  } catch (error) {
    if (error.status === 401 || /Authentication/i.test(error.message)) {
      clearLogin();
      location.replace("/signin");
    }
    return false;
  }
}

function bindTokens() {
  if ($("token-product")) {
    $("token-product").value = new URLSearchParams(location.search).get("product") === "z" ? "z" : "share";
    $("token-product").onchange = renderTokenOptions;
  }
  loadTokens();
  const savedRedirectNotice =
    sessionStorage.getItem("scriptnovaaRedirectNotice");
  if (savedRedirectNotice) {
    sessionStorage.removeItem("scriptnovaaRedirectNotice");
    message("redirect-message", savedRedirectNotice, "error");
  }
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
        $("create-pairing").classList.add("hidden");
        $("pairing-support").classList.remove("hidden");
        message("pairing-message",
            "That connection code expired. Submit a replacement request through Support.");
        return;
      }
      const refreshedAccount = await refreshAccountStatus();
      if (refreshedAccount?.registeredComputer) {
        stopPairingPoll();
        $("pairing-result").classList.add("hidden");
        $("create-pairing").classList.add("hidden");
        $("pairing-support").classList.remove("hidden");
        message("pairing-message",
            "Connected! The launcher saves this connection across updates and restarts.",
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
    $("create-pairing").classList.add("hidden");
    $("pairing-support").classList.remove("hidden");
    if (announcement) {
      message("pairing-message", announcement, "success");
    }
    beginPairingPoll(pairing.expiresAt);
  };
  const displayPairingState = (result) => {
    if (result.pairing) {
      displayPairing(result.pairing,
          "Your original connection code was restored. It cannot be changed.");
      return;
    }
    $("pairing-result").classList.add("hidden");
    if (result.canGenerate && result.migrationAvailable) {
      $("create-pairing").classList.remove("hidden");
      $("create-pairing").textContent = "Generate launcher-update code";
      $("pairing-support").classList.add("hidden");
      message("pairing-message",
          "Your computer was connected with an older launcher. Generate this one update code so the new launcher can remember the connection.");
      return;
    }
    if (result.registeredComputer) {
      $("create-pairing").classList.add("hidden");
      $("pairing-support").classList.remove("hidden");
      message("pairing-message",
          "Your computer is connected. Share Browser will remember it after launcher updates.",
          "success");
      return;
    }
    if (result.canGenerate) {
      $("create-pairing").classList.remove("hidden");
      $("create-pairing").textContent =
        result.replacementRequest?.status === "APPROVED" ?
          "Generate approved connection code" : "Generate connection code";
      $("pairing-support").classList.add("hidden");
      if (result.replacementRequest?.status === "APPROVED") {
        message("pairing-message",
            "Your replacement request was approved. You may generate one new code.",
            "success");
      }
      return;
    }
    $("create-pairing").classList.add("hidden");
    $("pairing-support").classList.remove("hidden");
    const requestStatus = result.replacementRequest?.status;
    if (requestStatus === "PENDING") {
      message("pairing-message",
          "Your replacement-code request is pending review.");
    } else if (requestStatus === "DECLINED") {
      message("pairing-message",
          "Your replacement-code request was declined. Read the response on Support.",
          "error");
    } else {
      message("pairing-message",
          "Connection codes cannot be changed automatically. Request another through Support.");
    }
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
      .then(displayPairingState)
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
        product: $("token-product")?.value || "share",
      });
      message("token-message",
          `${result.product === "z" ? "Project Z" : "Share Browser"} · ${result.durationLabel} token created:\n${result.token}`, "success");
      await loadTokens();
    } catch (error) {
      message("token-message", error.message, "error");
    } finally {
      $("create-token").disabled = false;
    }
  };
  $("select-limited-token").onclick = () => {
    if ($("token-product")) $("token-product").value = "share";
    renderTokenOptions();
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
      const adBlockDetected = await detectAdBlocker();
      const attempt = await request("/api/redirect/start", "POST", {
        campaignId: "monetag-direct-11435374",
        adBlockDetected,
      });
      await syncRewards();
      const redirectNotice = attempt.rewardEligible === false ?
        (attempt.notice ||
          "Redirect didn't count because an ad blocker was detected.") :
        "Sponsored page opened. Return after the displayed claim time to collect 0.5 point.";
      if (adWindow) {
        adWindow.opener = null;
        adWindow.location = attempt.redirectUrl;
        message("redirect-message", redirectNotice,
            attempt.rewardEligible === false ? "error" : "success");
      } else {
        if (attempt.rewardEligible === false) {
          sessionStorage.setItem(
              "scriptnovaaRedirectNotice",
              redirectNotice,
          );
        }
        location.href = attempt.redirectUrl;
      }
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
      $("create-pairing").disabled = true;
      const result = await request("/api/device/pairing/start", "POST");
      displayPairing(result,
          "Enter this code in Share Browser. It works once and expires in 10 minutes.");
    } catch (error) {
      message("pairing-message", error.message, "error");
    } finally {
      $("create-pairing").disabled = false;
    }
  };
  $("copy-pairing").onclick = (event) =>
    window.ScriptNovaaSite.copyWithFeedback(
        event.currentTarget,
        $("pairing-code").textContent,
    );
  $("copy-referral").onclick = (event) =>
    window.ScriptNovaaSite.copyWithFeedback(
        event.currentTarget,
        `https://scriptnovaa.com/signup?ref=${encodeURIComponent($("referral").textContent)}`,
    );
  $("token-list").onclick = (event) => {
    const button = event.target.closest(".copy-token");
    if (!button) return;
    window.ScriptNovaaSite.copyWithFeedback(button, button.dataset.token);
  };
  $("dismiss-device-welcome").onclick = async () => {
    $("device-welcome").classList.add("hidden");
    try {
      await request("/api/account/device-welcome/acknowledge", "POST");
    } catch (error) {
      // The notice can safely reappear if acknowledgement could not be saved.
    }
  };
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

function bindSupport() {
  if (!requireLogin()) return;
  let ticketPoll = null;
  const categoryNames = {
    CONNECTION_CODE_REPLACEMENT: "Connection code replacement",
    BROWSER_PROBLEM: "Share Browser problem",
    ACCOUNT_ACCESS: "Account access",
    POINTS_OR_REWARDS: "Points or sponsored rewards",
    REFERRAL_PROBLEM: "Referral problem",
    DEVELOPER_PROGRAM: "ScriptNova Developer Program",
    OTHER: "Other",
  };
  const statusNames = {
    PENDING: "Pending",
    APPROVED: "Approved",
    DECLINED: "Declined",
    FULFILLED: "Code generated",
    ANSWERED: "Answered",
    CLOSED: "Closed",
  };

  const renderTickets = (tickets) => {
    if (!tickets.length) {
      $("ticket-list").innerHTML =
        "<p class=\"empty-claims\">You have not submitted any support tickets.</p>";
      return;
    }
    $("ticket-list").innerHTML = `<div class="ticket-stack">${
      tickets.map((ticket) => {
        const statusValue = statusNames[ticket.status] ? ticket.status : "PENDING";
        const response = ticket.adminResponse ?
          `<p class="ticket-response"><strong>ScriptNovaa response:</strong><br>${escapeHtml(ticket.adminResponse)}</p>` :
          "";
        const approvedAction =
          ticket.category === "CONNECTION_CODE_REPLACEMENT" &&
          statusValue === "APPROVED" && !ticket.replacementConsumedAt ?
            "<div class=\"ticket-approved-action\"><a class=\"button\" href=\"/tokens\">Generate approved code</a></div>" :
            "";
        return `<article class="ticket-card">
          <div>
            <span class="ticket-meta">${escapeHtml(categoryNames[ticket.category] || ticket.category)} • ${escapeHtml(new Date(ticket.createdAt).toLocaleString())}</span>
            <h3>${escapeHtml(ticket.subject)}</h3>
            <p>${escapeHtml(ticket.message)}</p>
          </div>
          <span class="ticket-status ${statusValue.toLowerCase()}">${escapeHtml(statusNames[statusValue])}</span>
          ${response}
          ${approvedAction}
        </article>`;
      }).join("")
    }</div>`;
  };

  const loadTickets = async () => {
    try {
      const result = await request("/api/support/tickets");
      renderTickets(result.tickets);
      message("ticket-list-message", "");
    } catch (error) {
      if (error.status === 401 || /Authentication/i.test(error.message)) {
        clearLogin();
        location.replace("/signin");
        return;
      }
      message("ticket-list-message", error.message, "error");
    }
  };

  $("support-category").onchange = () => {
    if ($("support-category").value === "CONNECTION_CODE_REPLACEMENT" &&
        !$("support-subject").value.trim()) {
      $("support-subject").value = "Request another connection code";
    }
  };
  $("support-category").onchange();
  const requestedCategory =
    new URLSearchParams(location.search).get("category");
  if (requestedCategory === "DEVELOPER_PROGRAM") {
    $("support-category").value = requestedCategory;
    if (!$("support-subject").value.trim()) {
      $("support-subject").value = "Developer Program beta application";
    }
  }

  $("support-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      $("submit-ticket").disabled = true;
      const result = await request("/api/support/tickets", "POST", {
        category: $("support-category").value,
        subject: $("support-subject").value,
        message: $("support-message").value,
      });
      message("support-message-result",
          `Ticket submitted. Status: ${statusNames[result.ticket.status] || result.ticket.status}.`,
          "success");
      $("support-form").reset();
      $("support-category").onchange();
      await loadTickets();
    } catch (error) {
      message("support-message-result", error.message, "error");
    } finally {
      $("submit-ticket").disabled = false;
    }
  };
  $("refresh-tickets").onclick = loadTickets;
  $("support-signout").onclick = async () => {
    try {
      await request("/api/logout", "POST");
    } catch (error) {
      // Local sign-out still completes if the network is unavailable.
    }
    clearLogin();
    location.replace("/");
  };
  loadTickets();
  ticketPoll = setInterval(loadTickets, 15000);
  window.addEventListener("pagehide", () => {
    if (ticketPoll) clearInterval(ticketPoll);
  });
}

const page = document.body.dataset.page;
if (page === "signup") bindSignup();
if (page === "signin") bindSignin();
if (page === "recovery") bindRecovery();
if (page === "tokens") bindTokens();
if (page === "support") bindSupport();
