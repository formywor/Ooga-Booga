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
        ".product-card,.feature,.panel,.step-card,.legal-section,.developer-card,.revenue-card,.roadmap-line article",
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
