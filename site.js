"use strict";

(() => {
  const COPY_RESET_DELAY = 1800;

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

    const selected = tracks[dailyTrackIndex(tracks.length)];
    const player = document.createElement("aside");
    player.className = "daily-music";
    player.setAttribute("aria-label", "Daily music pick");
    player.innerHTML = `
      <button class="music-toggle" type="button" aria-label="Play daily music">▶</button>
      <span><small>DAILY PICK</small><strong></strong></span>
    `;
    player.querySelector("strong").textContent =
      selected.title || "ScriptNovaa daily pick";
    document.body.appendChild(player);

    const audio = new Audio(selected.src);
    audio.preload = "none";
    const button = player.querySelector("button");
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
        ".product-card,.feature,.panel,.step-card,.legal-section",
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

  window.ScriptNovaaSite = {copyWithFeedback};
  installRevealAnimations();
  installDailyMusic();
})();
