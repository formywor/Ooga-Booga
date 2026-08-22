"use strict";

(() => {
  const API = "https://api.scriptnovaa.com";
  const LOGIN_KEY = "scriptnovaaLoginToken";
  const TAB_LOGIN_KEY = "scriptnovaaTabLoginToken";
  const RECOVERY_DISPLAY_KEY = "scriptnovaaPendingRecoveryCode";
  const $ = (id) => document.getElementById(id);
  const token = sessionStorage.getItem(TAB_LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || "";
  if (!token) {
    location.replace("/signin");
    return;
  }

  let recoveryCode = sessionStorage.getItem(RECOVERY_DISPLAY_KEY) || "";
  const show = () => {
    $("backup-code-value").textContent = recoveryCode || "Code is no longer available in this tab";
    $("download-backup").disabled = !recoveryCode;
    $("copy-backup").disabled = !recoveryCode;
    $("missing-backup").classList.toggle("hidden", Boolean(recoveryCode));
  };
  const request = async (path, body) => {
    const response = await fetch(API + path, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({error: "Invalid server response."}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Request failed.");
    return result;
  };
  const setMessage = (text, kind = "") => {
    $("backup-message").textContent = text;
    $("backup-message").className = `message ${kind}`;
  };

  $("copy-backup").onclick = async () => {
    if (!recoveryCode) return;
    await navigator.clipboard.writeText(recoveryCode);
    $("copy-backup").textContent = "Copied";
    $("copy-backup").classList.add("copied-button");
  };
  $("download-backup").onclick = () => {
    if (!recoveryCode) return;
    const contents = [
      "SCRIPTNOVAA ACCOUNT BACKUP CODE",
      "",
      recoveryCode,
      "",
      "Keep this file private. Anyone with this code and your username may reset your PIN.",
      "ScriptNovaa Support will never ask you to send this code in a ticket or live chat.",
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([contents], {type: "text/plain;charset=utf-8"}));
    link.download = "ScriptNovaa-backup-code.txt";
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    $("download-backup").textContent = "Downloaded";
    $("download-backup").classList.add("copied-button");
  };
  $("saved-backup").onchange = () => {
    $("confirm-backup").disabled = !$("saved-backup").checked || !recoveryCode;
  };
  $("confirm-backup").onclick = async () => {
    try {
      $("confirm-backup").disabled = true;
      await request("/api/account/recovery/acknowledge", {saved: true});
      sessionStorage.removeItem(RECOVERY_DISPLAY_KEY);
      recoveryCode = "";
      location.replace("/tokens");
    } catch (error) {
      setMessage(error.message, "error");
      $("confirm-backup").disabled = false;
    }
  };
  $("regenerate-backup-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await request("/api/account/recovery/regenerate", {
        pin: $("regenerate-pin").value,
      });
      recoveryCode = result.recoveryCode;
      sessionStorage.setItem(RECOVERY_DISPLAY_KEY, recoveryCode);
      $("regenerate-pin").value = "";
      setMessage("A replacement backup code was created. Your previous code no longer works.", "success");
      show();
    } catch (error) {
      setMessage(error.message, "error");
    }
  };
  show();
})();
