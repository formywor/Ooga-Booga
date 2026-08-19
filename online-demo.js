"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const BROWSER_KEY = "scriptnovaaOnlineDemoBrowserId";
  const SESSION_KEY = "scriptnovaaOnlineDemoSession";
  const $ = (id) => document.getElementById(id);
  let countdown = null;
  let statusCheck = null;
  let session = null;

  function randomId() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function browserId() {
    let value = localStorage.getItem(BROWSER_KEY);
    if (!value) {
      value = randomId();
      localStorage.setItem(BROWSER_KEY, value);
    }
    return value;
  }

  async function api(path, body) {
    const response = await fetch(API + path, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({
      ok: false,
      error: "The demo service returned an invalid response.",
    }));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Demo request failed.");
    return result;
  }

  function remaining(expiresAt) {
    const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderPage(page, query = "") {
    const content = $("demo-content");
    const pages = {
      welcome: `<div class="demo-page demo-welcome"><span class="demo-eyebrow">SHARE BROWSER ONLINE</span><h2>Welcome to your private demo.</h2><p>Explore the interface without installing anything. This preview never acts as a proxy and cannot bypass a school, workplace, or network policy.</p><div class="demo-quick-grid"><button data-demo-page="privacy"><strong>Privacy center</strong><span>See the protected session design</span></button><button data-demo-page="school"><strong>School-friendly use</strong><span>Learn what the demo does and does not do</span></button><button data-demo-page="developer"><strong>Developer Program</strong><span>Preview ways to build with ScriptNova</span></button></div></div>`,
      privacy: `<div class="demo-page"><span class="demo-eyebrow">PRIVACY CENTER</span><h2>A clean session by design.</h2><p>The installed Share Browser launches a separately managed Chrome or Edge session. The online demo stores only a random browser identifier and limited hashed network data needed to enforce the trial.</p><ul class="demo-checks"><li>No password collection in this demo</li><li>No browsing proxy or IP-changing service</li><li>No access to your normal browser profile</li><li>Trial data is limited to access control and abuse prevention</li></ul></div>`,
      school: `<div class="demo-page"><span class="demo-eyebrow">RESPONSIBLE USE</span><h2>Designed to explain, not evade.</h2><p>Students can use this preview to understand Share Browser and ScriptNovaa. It does not unblock websites, change an IP address, or override school filters. Always follow school and network rules.</p><div class="demo-policy-card"><strong>Shared school networks</strong><p>The service allows several browser trials from one network while still limiting automated or excessive use.</p></div></div>`,
      developer: `<div class="demo-page"><span class="demo-eyebrow">SCRIPTNOVA DEVELOPER PROGRAM</span><h2>Your name. Your rules. Your browser.</h2><p>The beta program is being developed for approved creators who want a branded ScriptNova browser or an approved ScriptNova experience on their own domain.</p><a class="button" href="/developer-program">Open the Developer Program page</a></div>`,
      search: `<div class="demo-page"><span class="demo-eyebrow">SAFE DEMO SEARCH</span><h2>Results for “${escapeHtml(query)}”</h2><p>This is a product-interface preview, not a live search proxy.</p><div class="demo-results"><article><small>scriptnovaa.com</small><h3>Share Browser by ScriptNovaa</h3><p>The official page for the privacy-focused HTA browser launcher.</p></article><article><small>scriptnovaa.com/scriptnova</small><h3>What is ScriptNova?</h3><p>Learn about ScriptNova, ScriptNovaa, Share Browser, and the platform roadmap.</p></article></div></div>`,
    };
    content.innerHTML = pages[page] || pages.welcome;
    content.querySelectorAll("[data-demo-page]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.demoPage));
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
    })[character]);
  }

  function navigate(value) {
    if (!session) return;
    const clean = String(value || "").trim();
    $("demo-address").value = clean.startsWith("scriptnova://") ? clean : `scriptnova://${clean}`;
    if (["welcome", "privacy", "school", "developer"].includes(clean)) renderPage(clean);
    else renderPage("search", clean.replace(/^scriptnova:\/\//, ""));
  }

  function expireDemo() {
    session = null;
    sessionStorage.removeItem(SESSION_KEY);
    clearInterval(countdown);
    clearInterval(statusCheck);
    $("demo-timer").textContent = "00:00";
    $("demo-stage").classList.add("demo-expired");
    $("demo-content").innerHTML = `<div class="demo-page demo-ended"><span class="demo-eyebrow">DEMO COMPLETE</span><h2>Your ten-minute preview has ended.</h2><p>Download Share Browser or create a ScriptNovaa account when you are ready for the full experience.</p><div class="product-actions"><a class="button" href="/share-browser">Get Share Browser</a><a class="button alt" href="/signup">Create account</a></div></div>`;
  }

  function activate(result) {
    session = {
      trialId: result.trialId,
      trialSecret: result.trialSecret,
      expiresAt: new Date(result.expiresAt).getTime(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    $("demo-gate").classList.add("hidden");
    $("demo-stage").classList.remove("hidden", "demo-expired");
    renderPage("welcome");
    const update = () => {
      $("demo-timer").textContent = remaining(session.expiresAt);
      if (Date.now() >= session.expiresAt) expireDemo();
    };
    update();
    countdown = setInterval(update, 1000);
    statusCheck = setInterval(async () => {
      try {
        const status = await api("/api/demo/status", session);
        if (!status.active) expireDemo();
      } catch (error) {
        $("demo-status").textContent = "Connection check delayed";
      }
    }, 30000);
  }

  async function start() {
    const button = $("start-online-demo");
    try {
      button.disabled = true;
      $("demo-message").textContent = "Preparing your private demo…";
      const result = await api("/api/demo/start", {browserId: browserId()});
      activate(result);
    } catch (error) {
      $("demo-message").textContent = error.message;
      $("demo-message").className = "message error";
    } finally {
      button.disabled = false;
    }
  }

  $("start-online-demo").addEventListener("click", start);
  $("demo-home").addEventListener("click", () => navigate("welcome"));
  $("demo-back").addEventListener("click", () => navigate("welcome"));
  $("demo-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("demo-address").value.replace(/^scriptnova:\/\//, "");
    navigate(value || "welcome");
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (saved?.trialId && saved?.trialSecret && Number(saved.expiresAt) > Date.now()) {
      activate(saved);
    }
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
  }
})();
