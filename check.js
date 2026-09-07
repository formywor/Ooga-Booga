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

function renderProviders(online) {
  const list = byId("provider-list");
  list.replaceChildren();
  (online.providers || []).forEach((provider) => {
    const row = document.createElement("div");
    const name = document.createElement("strong");
    const result = document.createElement("span");
    name.textContent = provider.name;
    result.textContent = provider.available ? `${provider.score} / 100` : provider.reason;
    row.className = provider.available ? "provider-ready" : "provider-missing";
    row.append(name, result);
    list.appendChild(row);
  });
}

function renderHighlights(signals) {
  const output = byId("highlighted-text");
  output.replaceChildren();
  (signals || []).forEach((signal) => {
    const sentence = document.createElement("span");
    const strength = Math.max(0.08, Math.min(0.48, Number(signal.score || 0) / 200));
    sentence.style.backgroundColor = `rgba(231, 92, 108, ${strength})`;
    sentence.title = signal.reasons?.length ? signal.reasons.join(", ") : "Few local signals";
    sentence.textContent = `${signal.text} `;
    output.appendChild(sentence);
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
  const online = analysis.online || {availableCount: analysis.gemini.available ? 1 : 0,
    averageScore: analysis.gemini.available ? analysis.gemini.score : null,
    providers: [analysis.gemini]};
  byId("gemini-score").textContent = online.availableCount ? `${online.averageScore} / 100` : "Local only";
  byId("gemini-status").textContent = online.availableCount ?
    `${online.availableCount} online checker${online.availableCount === 1 ? "" : "s"} responded.` :
    "No online checker is configured or available; the improved local analysis was used.";
  byId("privacy-result").textContent = analysis.privacy;
  renderProviders(online);
  renderHighlights(analysis.style.sentenceSignals);
  renderInvisible(analysis.invisible);
  const reasons = byId("reason-list");
  reasons.replaceChildren();
  analysis.style.findings.forEach((reason) => appendReason(reasons, reason));
  if (analysis.style.repeatedPhrases.length) {
    appendReason(reasons, `Repeated wording: ${analysis.style.repeatedPhrases.map((item) => `“${item.phrase}” (${item.count} times)`).join(", ")}.`);
  }
  online.providers.filter((provider) => provider.available).forEach((provider) => {
    appendReason(reasons, `${provider.name} score: ${provider.score} / 100.`);
    (provider.reasons || []).forEach((reason) => appendReason(reasons, `${provider.name}: ${reason}`));
    (provider.counterSignals || []).forEach((reason) => appendReason(reasons, `${provider.name} counter-signal: ${reason}`));
    appendReason(reasons, provider.uncertainty);
  });
  if (!reasons.children.length) appendReason(reasons, "The available signals are weak or balanced.");
  byId("check-results").scrollIntoView({behavior: "smooth", block: "start"});
}

byId("check-text").addEventListener("input", () => {
  byId("character-count").textContent = `${byId("check-text").value.length.toLocaleString()} / 12,000`;
});

byId("improve-button").addEventListener("click", async () => {
  const button = byId("improve-button");
  const message = byId("improve-message");
  try {
    button.disabled = true;
    button.textContent = "Improving…";
    message.textContent = "Revising for clarity and natural flow…";
    message.className = "message";
    const response = await fetch(`${CHECK_API}/api/writing/improve`, {
      method: "POST", headers: {"Content-Type": "application/json"}, cache: "no-store",
      body: JSON.stringify({text: byId("check-text").value}),
    });
    const body = await response.json().catch(() => ({error: "The server returned an unreadable response."}));
    if (!response.ok || body.ok === false) throw new Error(body.error || "The writing could not be improved.");
    byId("revised-text").value = body.result.revisedText;
    const changes = byId("change-list");
    changes.replaceChildren();
    [...(body.result.changes || []), ...(body.result.warnings || [])]
        .forEach((change) => appendReason(changes, change));
    byId("improve-result").classList.remove("hidden");
    message.textContent = body.result.note;
    message.className = "message success";
  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  } finally {
    button.disabled = false;
    button.textContent = "Improve clarity";
  }
});

byId("copy-revision").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(byId("revised-text").value);
    byId("copy-revision").textContent = "Copied";
    setTimeout(() => {byId("copy-revision").textContent = "Copy revision";}, 1600);
  } catch (_error) {
    byId("revised-text").select();
    setCheckMessage("Select and copy the revision normally.", "error");
  }
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
      body: JSON.stringify({text: byId("check-text").value, useOnline: byId("use-gemini").checked}),
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
