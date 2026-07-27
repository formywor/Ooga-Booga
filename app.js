"use strict";
const API = "https://api.scriptnovaa.com";
const LOGIN_KEY = "scriptnovaaLoginToken";
const $ = (id) => document.getElementById(id);

async function request(path, method = "GET", body) {
  const headers = {"Content-Type": "application/json"};
  const login = localStorage.getItem(LOGIN_KEY);
  if (login) headers.Authorization = `Bearer ${login}`;
  const response = await fetch(API + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({error: "The server returned an invalid response."}));
  if (!response.ok || result.ok === false) throw new Error(result.error || "Request failed.");
  return result;
}
function message(id, text, kind = "") {
  const node = $(id); if (!node) return;
  node.textContent = text; node.className = `message ${kind}`;
}
function requireLogin() {
  if (!localStorage.getItem(LOGIN_KEY)) {
    location.href = "signin.html"; return false;
  }
  return true;
}
function bindSignup() {
  const referral = new URLSearchParams(location.search).get("ref");
  if (referral) $("signup-ref").value = referral;
  $("signup-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/signup", "POST", {
        username: $("signup-user").value, pin: $("signup-pin").value,
        referralUsername: $("signup-ref").value, clientDescription: navigator.userAgent,
      });
      localStorage.setItem(LOGIN_KEY, result.loginToken);
      message("signup-message", `Account created.\n\nSAVE THIS RECOVERY CODE:\n${result.recoveryCode}\n\nIt will not be shown again.`, "success");
      $("continue-tokens").classList.remove("hidden");
    } catch (error) { message("signup-message", error.message, "error"); }
  };
}
function bindSignin() {
  $("signin-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/login", "POST", {
        username: $("signin-user").value, pin: $("signin-pin").value,
        clientDescription: navigator.userAgent,
      });
      localStorage.setItem(LOGIN_KEY, result.loginToken); location.href = "tokens.html";
    } catch (error) { message("signin-message", error.message, "error"); }
  };
}
function bindRecovery() {
  $("recovery-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/recover", "POST", {
        username: $("recovery-user").value, recoveryCode: $("recovery-code").value,
        newPin: $("recovery-pin").value,
      });
      message("recovery-message", `PIN reset.\n\nSAVE YOUR NEW RECOVERY CODE:\n${result.newRecoveryCode}`, "success");
    } catch (error) { message("recovery-message", error.message, "error"); }
  };
}
async function loadTokens() {
  if (!requireLogin()) return;
  try {
    const [accountResult, config, tokenResult] = await Promise.all([
      request("/api/account"), request("/api/public-config"), request("/api/tokens"),
    ]);
    const account = accountResult.account;
    $("points").textContent = account.pointBalance;
    $("pending").textContent = account.pendingPointBalance;
    $("referral").textContent = account.referralCode;
    $("device").textContent = account.registeredComputer ? "Registered" : "Not registered";
    $("launcher-token").textContent = localStorage.getItem(LOGIN_KEY);
    $("duration").innerHTML = config.tokenOptions.map((item) =>
      `<option value="${item.hours}">${item.hours} hour${item.hours === 1 ? "" : "s"} — ${item.points} points</option>`).join("");
    $("token-list").innerHTML = tokenResult.tokens.length
      ? `<table><thead><tr><th>Token</th><th>Duration</th><th>Status</th></tr></thead><tbody>${tokenResult.tokens.map((token) =>
        `<tr><td><code>${token.displayToken || "Hidden after use"}</code></td><td>${token.durationHours}h</td><td>${token.status}</td></tr>`).join("")}</tbody></table>`
      : "<p>You have not created any tokens yet.</p>";
  } catch (error) {
    if (/Authentication/i.test(error.message)) {
      localStorage.removeItem(LOGIN_KEY); location.href = "signin.html"; return;
    }
    message("dashboard-message", error.message, "error");
  }
}
function bindTokens() {
  loadTokens();
  $("create-token").onclick = async () => {
    try {
      const result = await request("/api/tokens/create", "POST", {hours: Number($("duration").value)});
      message("token-message", `Token created:\n${result.token}`, "success"); await loadTokens();
    } catch (error) { message("token-message", error.message, "error"); }
  };
  let attempt = null;
  $("start-redirect").onclick = async () => {
    try {
      attempt = await request("/api/redirect/start", "POST", {campaignId: "default"});
      $("claim-redirect").classList.remove("hidden");
      $("claim-time").textContent = new Date(attempt.claimableAt).toLocaleString();
      window.open(attempt.redirectUrl, "_blank", "noopener");
    } catch (error) { message("redirect-message", error.message, "error"); }
  };
  $("claim-redirect").onclick = async () => {
    try {
      const result = await request("/api/redirect/claim", "POST", {
        attemptId: attempt.attemptId, claimCode: attempt.claimCode,
      });
      message("redirect-message", `${result.awardedPoints} point added.`, "success"); await loadTokens();
    } catch (error) { message("redirect-message", error.message, "error"); }
  };
  $("copy-login").onclick = () => navigator.clipboard.writeText(localStorage.getItem(LOGIN_KEY));
  $("copy-referral").onclick = () => navigator.clipboard.writeText(
      `https://scriptnovaa.com/signup.html?ref=${encodeURIComponent($("referral").textContent)}`);
  $("signout").onclick = () => { localStorage.removeItem(LOGIN_KEY); location.href = "index.html"; };
}
const page = document.body.dataset.page;
if (page === "signup") bindSignup();
if (page === "signin") bindSignin();
if (page === "recovery") bindRecovery();
if (page === "tokens") bindTokens();
