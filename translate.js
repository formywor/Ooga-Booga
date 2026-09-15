"use strict";

(() => {
  if (!requireLogin()) return;
  const setLocked = (until) => {
    const date = new Date(Number(until || 0));
    $("scriptnova-language-run").disabled = true;
    $("scriptnova-language-input").disabled = true;
    message("scriptnova-language-message", `Translation tools are unavailable until ${date.toLocaleString()}.`, "error");
  };
  request("/api/community/translation-access").then((result) => {
    if (!result.allowed) setLocked(result.blockedUntil);
  }).catch((error) => message("scriptnova-language-message", error.message, "error"));
  $("scriptnova-language-run").onclick = async () => {
    try {
      $("scriptnova-language-run").disabled = true;
      const result = await request("/api/community/scriptnova-language", "POST", {
        action: $("scriptnova-language-action").value,
        text: $("scriptnova-language-input").value,
      });
      $("scriptnova-language-output").value = result.output || "";
      message("scriptnova-language-message", "Translation complete.", "success");
    } catch (error) { message("scriptnova-language-message", error.message, "error"); }
    finally { if (!$("scriptnova-language-input").disabled) $("scriptnova-language-run").disabled = false; }
  };
  $("scriptnova-language-copy").onclick = async () => {
    if (!$("scriptnova-language-output").value) return;
    await navigator.clipboard.writeText($("scriptnova-language-output").value);
    $("scriptnova-language-copy").textContent = "Copied";
    setTimeout(() => { $("scriptnova-language-copy").textContent = "Copy result"; }, 1400);
  };
})();
