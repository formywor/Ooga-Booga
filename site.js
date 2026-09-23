"use strict";

(() => { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/beta-features.css?v=20260913-notifications"; document.head.appendChild(link); })();

(() => {
  if (window.top !== window.self) {
    try { window.top.location = window.self.location.href; } catch (error) {
      document.documentElement.innerHTML = "<head><title>ScriptNovaa</title></head><body><p>This ScriptNovaa page cannot be displayed inside another website.</p></body>";
    }
    return;
  }
  const COPY_RESET_DELAY = 1800;
  const CONTINUITY_NOTICE_KEY = "scriptnovaaContinuityNoticeDismissedAt";
  const CONTINUITY_NOTICE_DELAY = 2 * 24 * 60 * 60 * 1000;

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) throw new Error("Copy failed.");
  }

  async function copyWithFeedback(button, value) {
    if (!button) return;
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    try {
      await copyText(value);
      button.textContent = "Copied!";
      button.classList.add("copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("copied");
      }, COPY_RESET_DELAY);
    } catch (error) {
      button.textContent = "Copy failed";
      window.setTimeout(() => {
        button.textContent = original;
      }, COPY_RESET_DELAY);
    }
  }

  function dailyTrackIndex(trackCount) {
    const today = new Date();
    const dayKey = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
    ) / 86400000;
    return Math.abs(Math.floor(dayKey)) % trackCount;
  }

  async function installDailyMusic() {
    let tracks = [{title: "ScriptNovaa daily pick", src: "/music.mp3"}];
    let songDetails = [];
    try {
      const response = await fetch("/music/playlist.json", {cache: "no-store"});
      if (response.ok) {
        const playlist = await response.json();
        const validTracks = Array.isArray(playlist.tracks) ?
          playlist.tracks.filter((track) =>
            track && typeof track.src === "string" && track.src.startsWith("/")) :
          [];
        if (validTracks.length) tracks = validTracks;
      }
    } catch (error) {
      // The single music.mp3 fallback remains available.
    }
    try {
      const response = await fetch("/music/song-details.json", {cache: "no-store"});
      if (response.ok) {
        const detailsFile = await response.json();
        songDetails = Array.isArray(detailsFile.tracks) ?
          detailsFile.tracks.filter((track) =>
            track && typeof track.src === "string") :
          [];
      }
    } catch (error) {
      // Song information is optional.
    }

    const selected = tracks[dailyTrackIndex(tracks.length)];
    const selectedDetails =
      songDetails.find((track) => track.src === selected.src) || {};
    const dock = document.createElement("div");
    dock.className = "music-dock";
    const player = document.createElement("aside");
    player.className = "daily-music";
    player.setAttribute("aria-label", "Daily music pick");
    player.innerHTML = `
      <button class="music-toggle" type="button" aria-label="Play daily music">▶</button>
      <span><small>DAILY PICK</small><strong></strong></span>
    `;
    player.querySelector("strong").textContent =
      selectedDetails.title || selected.title || "ScriptNovaa daily pick";

    const tools = document.createElement("div");
    tools.className = "music-tools";
    tools.innerHTML = `
      <button class="music-tool music-repeat" type="button" aria-pressed="false">↻ Repeat off</button>
      <button class="music-tool music-info" type="button" aria-expanded="false">ⓘ Song info</button>
    `;

    const details = document.createElement("section");
    details.className = "music-details hidden";
    details.setAttribute("aria-label", "Song information");
    const detailRows = [
      ["Artist", selectedDetails.artist],
      ["Album", selectedDetails.album],
      ["Released", selectedDetails.releaseDate],
      ["Copyright", selectedDetails.copyright],
    ].filter(([, value]) => value);
    const detailsTitle = document.createElement("h3");
    detailsTitle.textContent =
      selectedDetails.title || selected.title || "ScriptNovaa daily pick";
    details.appendChild(detailsTitle);
    detailRows.forEach(([label, value]) => {
      const row = document.createElement("p");
      const labelNode = document.createElement("strong");
      labelNode.textContent = `${label}: `;
      row.appendChild(labelNode);
      row.appendChild(document.createTextNode(String(value)));
      details.appendChild(row);
    });
    if (selectedDetails.description) {
      const description = document.createElement("p");
      description.className = "music-description";
      description.textContent = selectedDetails.description;
      details.appendChild(description);
    }
    if (!detailRows.length && !selectedDetails.description) {
      const unavailable = document.createElement("p");
      unavailable.textContent =
        "More information about this daily pick will be added soon.";
      details.appendChild(unavailable);
    }
    if (typeof selectedDetails.link === "string" &&
        /^https:\/\//i.test(selectedDetails.link)) {
      const link = document.createElement("a");
      link.href = selectedDetails.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Official song page";
      details.appendChild(link);
    }

    dock.appendChild(details);
    dock.appendChild(tools);
    dock.appendChild(player);
    document.body.appendChild(dock);

    const audio = new Audio(selected.src);
    audio.preload = "none";
    const button = player.querySelector("button");
    const repeatButton = tools.querySelector(".music-repeat");
    const infoButton = tools.querySelector(".music-info");
    let repeatEnabled = false;
    try {
      repeatEnabled =
        localStorage.getItem("scriptnovaaMusicRepeat") === "true";
    } catch (error) {
      // Repeat still works for the current page when storage is unavailable.
    }
    const showRepeatState = () => {
      audio.loop = repeatEnabled;
      repeatButton.textContent =
        repeatEnabled ? "↻ Repeat on" : "↻ Repeat off";
      repeatButton.classList.toggle("active", repeatEnabled);
      repeatButton.setAttribute("aria-pressed", String(repeatEnabled));
    };
    showRepeatState();
    repeatButton.addEventListener("click", () => {
      repeatEnabled = !repeatEnabled;
      try {
        localStorage.setItem(
            "scriptnovaaMusicRepeat",
            String(repeatEnabled),
        );
      } catch (error) {
        // The setting simply will not persist in a restricted browser.
      }
      showRepeatState();
    });
    infoButton.addEventListener("click", () => {
      const willOpen = details.classList.contains("hidden");
      details.classList.toggle("hidden", !willOpen);
      infoButton.classList.toggle("active", willOpen);
      infoButton.setAttribute("aria-expanded", String(willOpen));
    });
    button.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          await audio.play();
          button.textContent = "Ⅱ";
          button.setAttribute("aria-label", "Pause daily music");
          player.classList.add("playing");
        } else {
          audio.pause();
          button.textContent = "▶";
          button.setAttribute("aria-label", "Play daily music");
          player.classList.remove("playing");
        }
      } catch (error) {
        player.querySelector("strong").textContent =
          "Music will be available soon";
      }
    });
    audio.addEventListener("ended", () => {
      button.textContent = "▶";
      player.classList.remove("playing");
    });
  }

  function installRevealAnimations() {
    const elements = document.querySelectorAll(
    ".product-card,.feature,.panel,.step-card,.legal-section,.developer-card,.revenue-card,.roadmap-line article,.authority-main,.authority-facts,.school-grid article,.developer-requirement-list article",
    );
    elements.forEach((element) => element.classList.add("reveal-ready"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("revealed"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      });
    }, {threshold: 0.08});
    elements.forEach((element) => observer.observe(element));
  }

  function installContinuityNotice() {
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(CONTINUITY_NOTICE_KEY) || 0);
    } catch (error) {
      // The notice remains available when browser storage is restricted.
    }
    if (Date.now() - dismissedAt < CONTINUITY_NOTICE_DELAY) return;
    const notice = document.createElement("aside");
    notice.className = "continuity-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `
      <div class="continuity-icon" aria-hidden="true">S</div>
      <div><span class="system-badge">SYSTEM UPDATE</span>
      <strong>Thank you for using ScriptNovaa.</strong>
      <p>We are preparing a backup domain to help keep ScriptNovaa available if heavy traffic interrupts this domain. Keep using <b>scriptnovaa.com</b> as the official address unless we announce otherwise here.</p></div>
      <button type="button" aria-label="Dismiss this update">&times;</button>
    `;
    notice.querySelector("button").addEventListener("click", () => {
      try {
        localStorage.setItem(CONTINUITY_NOTICE_KEY, String(Date.now()));
      } catch (error) {
        // Dismissal lasts for this page when storage is unavailable.
      }
      notice.classList.add("continuity-leaving");
      window.setTimeout(() => notice.remove(), 220);
    });
    const header = document.querySelector(".site-header");
    if (header) header.insertAdjacentElement("afterend", notice);
    else document.body.prepend(notice);
  }

  function storedLoginToken() {
    return window.ScriptNovaaAuth.token();
  }

  async function accountRequest(path, options = {}) {
    const token = storedLoginToken();
    if (!token) throw new Error("SIGNED_OUT");
    const response = await fetch(`https://api.scriptnovaa.com${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401 && storedLoginToken() === token) {
      window.ScriptNovaaAuth.clear(token);
      window.dispatchEvent(new Event("scriptnovaa-auth-changed"));
    }
    if (!response.ok) throw new Error("ACCOUNT_UNAVAILABLE");
    return response.json();
  }

  function installPrivacyShield(profile) {
    if (!profile || profile.privacyMode === false) return;
    const sensitivePages = new Set([
      "/account", "/settings", "/chat", "/tokens", "/support", "/notifications",
    ]);
    const cleanPath = window.location.pathname.replace(/\.html$/, "");
    if (!sensitivePages.has(cleanPath)) return;

    const shield = document.createElement("div");
    shield.className = "privacy-shield";
    shield.setAttribute("aria-hidden", "true");
    shield.innerHTML = `
      <div class="privacy-shield-mark">S</div>
      <strong>Privacy Mode</strong>
      <p>Sensitive content is hidden while this page is inactive.</p>
      <button type="button">Show my screen</button>
    `;
    document.body.appendChild(shield);
    let manuallyHidden = false;
    const show = (manual = false) => {
      manuallyHidden = manual || manuallyHidden;
      shield.classList.add("active");
      shield.setAttribute("aria-hidden", "false");
    };
    const hide = () => {
      if (manuallyHidden) return;
      shield.classList.remove("active");
      shield.setAttribute("aria-hidden", "true");
    };
    let possibleViewingSignal = "";
    window.addEventListener("blur", () => { possibleViewingSignal = "This tab lost focus"; show(false); });
    window.addEventListener("focus", () => { hide(); showPossibleViewingNotice(possibleViewingSignal); possibleViewingSignal = ""; });
    window.addEventListener("beforeprint", () => { possibleViewingSignal = "A print or capture-style browser event occurred"; show(false); });
    window.addEventListener("afterprint", () => { hide(); showPossibleViewingNotice(possibleViewingSignal); possibleViewingSignal = ""; });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { possibleViewingSignal = "This page became hidden"; show(false); }
      else { hide(); showPossibleViewingNotice(possibleViewingSignal); possibleViewingSignal = ""; }
    });
    shield.querySelector("button").addEventListener("click", () => {
      manuallyHidden = false;
      hide();
    });
    window.ScriptNovaaPrivacy = {hideScreen: () => show(true)};
    let lastInteraction = Date.now();
    ["pointerdown", "keydown", "touchstart", "mousemove"].forEach((eventName) =>
      window.addEventListener(eventName, () => { lastInteraction = Date.now(); }, {passive: true}));
    window.setInterval(() => {
      if (!shield.classList.contains("active") && Date.now() - lastInteraction > 3 * 60 * 1000) show(false);
    }, 15000);

    function showPossibleViewingNotice(signal) {
      if (!signal || document.querySelector(".privacy-watch-notice")) return;
      const warningKey = "scriptnovaaPrivacyWarningDismissedV2";
      try { if (localStorage.getItem(warningKey) === "true") return; } catch (error) {}
      const warning = document.createElement("aside");
      warning.className = "privacy-watch-notice";
      warning.setAttribute("role", "status");
      warning.innerHTML = `
        <span class="privacy-watch-icon">●</span>
        <div><span class="system-badge">PRIVACY MODE · POSSIBLE VIEWING</span>
        <strong></strong>
        <p>${signal}. ScriptNovaa cannot detect screen recording with certainty. This is a cautious warning based only on a browser-visible signal.</p></div>
        <a href="/settings">Settings</a>
        <button type="button" aria-label="Dismiss privacy notice">&times;</button>
      `;
      warning.querySelector("strong").textContent =
        `${profile.displayName || profile.username}, we think this page may have been viewed while inactive.`;
      warning.querySelector("button").addEventListener("click", () => {
        try { localStorage.setItem(warningKey, "true"); } catch (error) {}
        warning.classList.add("continuity-leaving");
        window.setTimeout(() => warning.remove(), 220);
      });
      document.body.appendChild(warning);
    }
  }

  function installProfileMenu() {
    const nav = document.querySelector(".site-header .nav");
    if (!nav || nav.querySelector(".profile-menu-shell")) return;
    const shell = document.createElement("div");
    shell.className = "profile-menu-shell";
    shell.innerHTML = `
      <button class="profile-menu-button" type="button" aria-label="Open account menu" aria-expanded="false">
        <span>?</span><i class="profile-unread hidden">0</i>
      </button>
      <div class="profile-menu" hidden>
        <header><span class="profile-menu-avatar">S</span><div><strong>My Account</strong><small>Checking account…</small></div></header>
        <a href="/account"><b>My Account</b><small>Profile, badges and quick links</small></a>
        <a href="/settings"><b>Settings</b><small>Display and privacy controls</small></a>
        <a href="/chat"><b>Chat</b><span class="menu-new">NEW</span><small>Public chat and private messages</small></a>
        <a href="/notifications"><b>Notifications</b><span class="profile-notification-count"></span><small>Security and chat updates</small></a>
        <a href="/features"><b>Features</b><small>Explore ScriptNovaa</small></a>
        <a href="/developerportal"><b>Developer portal</b><small>Applications and managed hosting</small></a>
        <a href="/beta"><b>Beta</b><span class="menu-new">BETA</span><small>Early access and profile rewards</small></a>
        <a href="/status"><b>Status</b><small>Check ScriptNovaa services</small></a>
        <a href="/safety"><b>Safety</b><small>Chat rules and reporting</small></a>
        <a href="/support"><b>Support</b><small>Tickets and live help</small></a>
        <a href="/terms"><b>Terms of Use</b><small>Community and product rules</small></a>
        <button class="profile-hide-screen" type="button"><b>Hide my screen</b><small>Turn on the Privacy Mode shield</small></button>
      </div>
    `;
    nav.appendChild(shell);
    const button = shell.querySelector(".profile-menu-button");
    const menu = shell.querySelector(".profile-menu");
    const toggle = () => {
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
    };
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
    });
    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!shell.contains(event.target)) {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
    shell.querySelector(".profile-hide-screen").addEventListener("click", () => {
      menu.hidden = true;
      if (window.ScriptNovaaPrivacy) window.ScriptNovaaPrivacy.hideScreen();
    });

    const token = storedLoginToken();
    if (!token) {
      shell.classList.add("signed-out-profile");
      button.querySelector("span").textContent = "S";
      menu.innerHTML = `<a href="/signin"><b>Sign in</b><small>Open your ScriptNovaa account</small></a>
        <a href="/signup"><b>Create account</b><small>Join ScriptNovaa</small></a>
        <a href="/features"><b>Features</b><small>See what is available</small></a>
        <a href="/beta"><b>Beta</b><small>See early-access benefits</small></a>
        <a href="/terms"><b>Terms of Use</b></a>`;
      return;
    }
    const securityWarning = sessionStorage.getItem("scriptnovaaSecurityWarning");
    if (securityWarning) {
      sessionStorage.removeItem("scriptnovaaSecurityWarning");
      const notice = document.createElement("aside"); notice.className = "security-login-toast";
      notice.innerHTML = `<span class="system-badge">SECURITY</span><strong></strong><a href="/account">Review activity</a><button type="button" aria-label="Dismiss">×</button>`;
      notice.querySelector("strong").textContent = securityWarning;
      notice.querySelector("button").onclick = () => notice.remove(); document.body.appendChild(notice);
    }
    accountRequest("/api/community/summary").then((result) => {
      const profile = result.profile;
      const avatarSymbols = {nova: "S", orbit: "◉", pixel: "◆", bolt: "ϟ", wave: "≋", game: "✦", prism: "◇", comet: "☄", signal: "⌁", crown: "♛", ghost: "◌", crystal: "⬡"};
      const initial = avatarSymbols[profile.avatarId] || String(profile.displayName || profile.username || "S").charAt(0).toUpperCase();
      const picture = profile.avatarImage ? `<img src="${String(profile.avatarImage).replace(/"/g, "&quot;")}" alt="">` : initial;
      button.querySelector("span").innerHTML = picture;
      shell.querySelector(".profile-menu-avatar").innerHTML = picture;
      shell.querySelector(".profile-menu header strong").textContent = profile.displayName;
      shell.querySelector(".profile-menu header small").textContent = `@${profile.username}`;
      const notificationCount = Number(result.notificationCount || 0);
      shell.querySelector(".profile-notification-count").textContent = notificationCount ? String(notificationCount) : "";
      if (notificationCount && profile.browserNotifications && "Notification" in window && Notification.permission === "granted") {
        accountRequest("/api/notifications").then((response) => {
          const latest = (response.notifications || []).find((item) => !item.readAt);
          if (!latest) return;
          const shownKey = `scriptnovaaShownNotification:${profile.accountId}`;
          if (localStorage.getItem(shownKey) === latest.notificationId) return;
          const popup = new Notification(latest.title || "ScriptNovaa update", {body: latest.message || "Open ScriptNovaa to review this update.", icon: "/favicon.png", tag: `scriptnovaa-${latest.notificationId}`});
          popup.onclick = () => { window.focus(); location.href = "/notifications"; };
          localStorage.setItem(shownKey, latest.notificationId);
        }).catch(() => {});
      }
      shell.dataset.accent = profile.accent;
      const unread = shell.querySelector(".profile-unread");
      if (result.unreadCount > 0) {
        unread.textContent = result.unreadCount > 9 ? "9+" : String(result.unreadCount);
        unread.classList.remove("hidden");
      }
      installPrivacyShield(profile);
    }).catch(() => accountRequest("/api/account").then((result) => {
      const username = result.account?.username || "My Account";
      const initial = String(username).charAt(0).toUpperCase();
      button.querySelector("span").textContent = initial;
      shell.querySelector(".profile-menu-avatar").textContent = initial;
      shell.querySelector(".profile-menu header strong").textContent = username;
      shell.querySelector(".profile-menu header small").textContent = "Community profile temporarily unavailable";
    }).catch(() => {
      shell.querySelector(".profile-menu header small").textContent = "Account check unavailable. Try again shortly.";
    }));
  }

  function installMobileNavigation() {
    document.querySelectorAll(".site-header .nav").forEach((nav) => {
      const links = nav.querySelector(":scope > .nav-links");
      if (!links || nav.querySelector(".mobile-nav-toggle")) return;
      nav.classList.add("nav-enhanced");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-nav-toggle";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
      button.innerHTML = "<span></span><span></span><span></span>";
      nav.insertBefore(button, links);
      const close = () => {
        nav.classList.remove("mobile-open");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Open navigation");
      };
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = !nav.classList.contains("mobile-open");
        nav.classList.toggle("mobile-open", open);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      });
      links.addEventListener("click", (event) => {
        if (event.target.closest("a")) close();
      });
      document.addEventListener("click", (event) => {
        if (!nav.contains(event.target)) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    });
  }

  // Keep navigation consistent on every page, including pages restored from history.
  function syncAccountLinks() {
    const signedIn = Boolean(storedLoginToken());
    document.querySelectorAll('a[href="/signin"], a[href="/signup"], a[data-account-link]').forEach((link) => {
      if (link.closest(".profile-menu") || !link.closest(".site-header, .hero, .hero-actions")) return;
      if (!link.dataset.accountLink) {
        link.dataset.accountLink = link.getAttribute("href");
        link.dataset.accountLabel = link.textContent;
      }
      link.setAttribute("href", signedIn ? (link.dataset.accountLink === "/signin" ? "/account" : "/tokens") : link.dataset.accountLink);
      link.textContent = signedIn ? (link.dataset.accountLink === "/signin" ? "My Account" : "My tokens") : link.dataset.accountLabel;
    });
  }
  let navigationToken = storedLoginToken();
  function checkAccountChange() {
    const nextToken = storedLoginToken();
    if (nextToken !== navigationToken) {
      // Reload account-bound content as well, never keep the previous user's data visible.
      location.reload();
      return;
    }
    syncAccountLinks();
  }
  window.addEventListener("pageshow", checkAccountChange);
  window.addEventListener("scriptnovaa-auth-changed", checkAccountChange);
  window.setInterval(checkAccountChange, 30000);
  window.ScriptNovaaSite = {copyWithFeedback, accountRequest};
  // A sandboxed sponsor embed must not display account controls from its parent.
  if (window.top === window.self) {
    let websiteNotice, websiteNoticeBusy = false;
    async function refreshWebsiteNotice() {
      if (websiteNoticeBusy || document.hidden) return;
      if (!storedLoginToken()) {websiteNotice?.remove(); websiteNotice=null; return;}
      websiteNoticeBusy=true;
      try {
        const {session}=await accountRequest("/api/website/session");
        websiteNotice?.remove(); websiteNotice=null;
        if(session){
          websiteNotice=document.createElement("aside");websiteNotice.className="panel";websiteNotice.setAttribute("aria-label","Active website session");
          const label=document.createElement("p");label.textContent=`You have an active session: ${session.sponsor.name}.`;
          const visit=document.createElement("a");visit.href="/sponsors";visit.textContent="Visit your site";
          const end=document.createElement("button");end.type="button";end.textContent="End session";end.style.marginLeft="16px";
          end.onclick=async()=>{end.disabled=true;try{await accountRequest("/api/website/session/end",{method:"POST",body:JSON.stringify({sessionId:session.id})});websiteNotice?.remove();websiteNotice=null;}catch{end.disabled=false;label.textContent="Could not end the website session. Please try again.";}};
          websiteNotice.append(label,visit,end);(document.querySelector("main")||document.body).prepend(websiteNotice);
        }
      } catch {websiteNotice?.remove();websiteNotice=null;} finally {websiteNoticeBusy=false;}
    }
    refreshWebsiteNotice();setInterval(refreshWebsiteNotice,60000);
    document.addEventListener("visibilitychange",refreshWebsiteNotice);
  }
  syncAccountLinks();
  installMobileNavigation();
  installProfileMenu();
  installContinuityNotice();
  installRevealAnimations();
  if (document.body.dataset.noMusic !== "true") installDailyMusic();
})();
