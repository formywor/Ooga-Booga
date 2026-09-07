"use strict";

const CHECK_API = "https://api.scriptnovaa.com";
const byId = (id) => document.getElementById(id);

function setCheckMessage(text, kind = "") {
  const node = byId("check-message");
  node.textContent = text;
  node.className = `message ${kind}`;
}

function verdictLabel(value) {
  return {MORE_AI_LIKE: "More AI-like patterns", MORE_HUMAN_LIKE: "More human-like patterns",
    MIXED_OR_UNCERTAIN: "Mixed or uncertain",
    NOT_ENOUGH_TEXT: "Not enough text for a useful estimate"}[value] || "Mixed or uncertain";
}

function appendReason(list, text) {
  if (!text) return;
  const item = document.createElement("li");
  item.textContent = text;
  list.appendChild(item);
}

function renderInvisible(invisible) {
  byId("invisible-count").textContent = String(invisible.total);
  byId("invisible-summary").textContent = invisible.detected ?
    `${invisible.zeroWidthCount} zero-width, tag, invisible, or private-use characters need review.` :
    "No suspicious invisible Unicode characters were found.";
  const detail = byId("invisible-detail");
  detail.classList.toggle("hidden", !invisible.detected);
  if (!invisible.detected) return;
  byId("watermark-warning").textContent = invisible.possibleEncodedWatermark ?
    "A cluster of invisible characters could encode hidden data or a watermark. It could also come from legitimate formatting, so inspect the source before deciding." :
    "These characters can be legitimate, but they are normally invisible and deserve inspection.";
  const list = byId("character-list");
  list.replaceChildren();
  Object.entries(invisible.counts).forEach(([name, count]) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const number = document.createElement("strong");
    label.textContent = name;
    number.textContent = `× ${count}`;
    row.append(label, number);
    list.appendChild(row);
  });
}

function renderResult(analysis) {
  byId("check-results").classList.remove("hidden");
  byId("score-value").textContent = analysis.verdict === "NOT_ENOUGH_TEXT" ? "?" : String(analysis.score);
  byId("score-ring").style.setProperty("--score", `${analysis.score * 3.6}deg`);
  byId("verdict").textContent = verdictLabel(analysis.verdict);
  byId("confidence").textContent = `${analysis.confidence.toLowerCase()} confidence · ${analysis.style.wordCount} words examined`;
  byId("disclaimer").textContent = analysis.disclaimer;
  byId("style-score").textContent = `${analysis.style.score} / 100`;
  byId("style-summary").textContent = analysis.style.findings.length ? analysis.style.findings[0] : "No strong style pattern stood out.";
  byId("word-count").textContent = String(analysis.style.wordCount);
  byId("text-stats").textContent = `${analysis.style.sentenceCount} sentences · ${analysis.style.averageSentenceWords} average words per sentence`;
  byId("gemini-score").textContent = analysis.gemini.available ? `${analysis.gemini.score} / 100` : "Not used";
  byId("gemini-status").textContent = analysis.gemini.available ? `Separate model assessment using ${analysis.gemini.model}.` : analysis.gemini.reason;
  byId("privacy-result").textContent = analysis.privacy;
  renderInvisible(analysis.invisible);
  const reasons = byId("reason-list");
  reasons.replaceChildren();
  analysis.style.findings.forEach((reason) => appendReason(reasons, reason));
  if (analysis.style.repeatedPhrases.length) {
    appendReason(reasons, `Repeated wording: ${analysis.style.repeatedPhrases.map((item) => `“${item.phrase}” (${item.count} times)`).join(", ")}.`);
  }
  if (analysis.gemini.available) {
    analysis.gemini.reasons.forEach((reason) => appendReason(reasons, `Gemini: ${reason}`));
    analysis.gemini.counterSignals.forEach((reason) => appendReason(reasons, `Counter-signal: ${reason}`));
    appendReason(reasons, analysis.gemini.uncertainty);
  }
  if (!reasons.children.length) appendReason(reasons, "The available signals are weak or balanced.");
  byId("check-results").scrollIntoView({behavior: "smooth", block: "start"});
}

byId("check-text").addEventListener("input", () => {
  byId("character-count").textContent = `${byId("check-text").value.length.toLocaleString()} / 12,000`;
});

byId("paste-button").addEventListener("click", async () => {
  try {
    byId("check-text").value = await navigator.clipboard.readText();
    byId("check-text").dispatchEvent(new Event("input"));
    setCheckMessage("Text pasted.", "success");
  } catch (_error) {
    setCheckMessage("Clipboard access was unavailable. Paste into the box normally.", "error");
  }
});

byId("clear-button").addEventListener("click", () => {
  byId("check-text").value = "";
  byId("check-text").dispatchEvent(new Event("input"));
  byId("check-results").classList.add("hidden");
  setCheckMessage("");
});

byId("check-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("analyze-button");
  try {
    button.disabled = true;
    button.textContent = "Analyzing…";
    setCheckMessage("Running the writing and invisible-character checks…");
    const response = await fetch(`${CHECK_API}/api/writing/check`, {
      method: "POST", headers: {"Content-Type": "application/json"}, cache: "no-store",
      body: JSON.stringify({text: byId("check-text").value, useGemini: byId("use-gemini").checked}),
    });
    const result = await response.json().catch(() => ({error: "The server returned an unreadable response."}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "The analysis could not be completed.");
    renderResult(result.analysis);
    setCheckMessage("Analysis complete.", "success");
  } catch (error) {
    setCheckMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Analyze writing";
  }
});
