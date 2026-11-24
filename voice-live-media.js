(function (root) {
  'use strict';
  const $ = s => document.querySelector(s);
  const dialog = $('#voice-chat');
  const video = $('#voice-live-preview');
  let stream = null;
  let source = '';
  let generation = 0;

  function showStatus(message) {
    const el = $('#voice-live-status');
    if (el) el.textContent = message;
  }

  function render() {
    const shared = Boolean(stream);
    $('#voice-live-panel').hidden = !shared;
    const stage = $('#voice-stage');
    if (stage) stage.dataset.live = String(shared);
    $('#voice-share-screen').hidden = source === 'screen';
    $('#voice-share-camera').hidden = source === 'camera';
    $('#voice-stop-sharing').hidden = !shared;
    $('#voice-live-panel').dataset.source = source || '';
  }

  function stop(message = 'Live view is off. Nothing is being shared.') {
    generation++;
    const old = stream;
    stream = null;
    source = '';
    old?.getTracks().forEach(track => track.stop());
    if (video) video.srcObject = null;
    render();
    showStatus(message);
  }

  async function begin(kind) {
    stop('Requesting permission…');
    const ticket = generation;
    if (!root.isSecureContext || !navigator.mediaDevices) {
      showStatus('Live sharing needs a secure browser tab. Use the upload or photo option instead.');
      return;
    }
    try {
      const next = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 12, max: 20 } }, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, frameRate: { ideal: 15, max: 24 } }, audio: false });
      if (ticket !== generation || !dialog.open) {
        next.getTracks().forEach(track => track.stop());
        return;
      }
      const track = next.getVideoTracks()[0];
      if (!track) {
        next.getTracks().forEach(t => t.stop());
        throw new Error(kind === 'screen' ? 'No screen was selected.' : 'No camera video is available.');
      }
      stream = next;
      source = kind;
      video.srcObject = next;
      render();
      await video.play().catch(() => {});
      track.addEventListener('ended', () => {
        if (stream === next) stop(kind === 'screen' ? 'Screen sharing ended. Live view is off.' : 'Camera stopped. Live view is off.');
      }, { once: true });
      showStatus(kind === 'screen'
        ? 'Screen preview is local. Say “can you see this?” to send one still frame.'
        : 'Camera preview is local. Say “can you see this?” to send one still frame.');
    } catch (error) {
      if (ticket !== generation) return;
      stop(error.name === 'NotAllowedError' ? 'Sharing was cancelled or permission was not granted. Nothing was sent.' : error.message || 'Live sharing could not start.');
    }
  }

  function asksToInspect(text) {
    return /\b(?:can you see (?:this|that|my screen)|look at this|look at my screen|what do you see|what(?:'s| is) on (?:the )?screen|check this out|describe what you see|take a look at this)\b/i.test(text || '');
  }

  async function captureForRequest(text) {
    if (!asksToInspect(text)) return { triggered: false, attached: false };
    if (root.NebulaCallMedia?.images.length) return { triggered: true, attached: true };
    if (!stream || !video?.videoWidth || !video.videoHeight) return { triggered: true, attached: false };
    const width = video.videoWidth;
    const height = video.videoHeight;
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.76);
    const label = source === 'screen' ? 'Shared screen snapshot' : 'Shared camera snapshot';
    await root.NebulaCallMedia.addSnapshot(data, label);
    showStatus('One still frame was attached to this request. The live preview itself stays on your device.');
    return { triggered: true, attached: true };
  }

  $('#voice-share-screen').addEventListener('click', () => begin('screen'));
  $('#voice-share-camera').addEventListener('click', () => begin('camera'));
  $('#voice-stop-sharing').addEventListener('click', () => stop());
  dialog.addEventListener('close', () => stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stop('Sharing stopped because the tab was hidden.'); });
  root.addEventListener('pagehide', () => stop());
  root.NebulaLiveMedia = { stop, captureForRequest, asksToInspect, get active() { return Boolean(stream); } };
  render();
})(window);
