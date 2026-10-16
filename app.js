'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const KEY = 'nebula.workspace.v1';
  const SETTINGS_KEY = 'nebula.settings.v1';
  const MAX_CHATS = 100;
  const API = 'https://api.scriptnovaa.com/api/nebula';
  const DATA_KEY = 'nebula.data-token.v1';
  let archivedView = false, menuId = null, deleteChatId = null;
  let dataToken = '';
  try { dataToken = localStorage.getItem(DATA_KEY) || ''; } catch {}
  if (!/^[a-f0-9]{64}$/.test(dataToken)) { dataToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''); try { localStorage.setItem(DATA_KEY,dataToken); } catch {} }
  let chats = [], activeId = null, settings = { improve: false, theme: 'dark' };
  let pending = null, renameId = null, storageFailed = false;
  const validMessage = m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 100000;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(stored)) chats = stored.filter(c => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages)).slice(0, MAX_CHATS).map(c => ({ id: c.id, title: c.title.slice(0, 100), updated: Number(c.updated) || 0, archived: c.archived === true, messages: c.messages.filter(validMessage).slice(-200).map(m => ({...m, trainingEligible: m.trainingEligible === true, id: typeof m.id === 'string' ? m.id : crypto.randomUUID()})) }));
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (saved && typeof saved === 'object') settings = { improve: saved.improve === true, theme: ['dark','light','system'].includes(saved.theme) ? saved.theme : 'dark' };
    // Rewrite old settings so legacy developer fields are removed.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { storageFailed = true; settings.improve = false; }
  function saveChats() {
    try { localStorage.setItem(KEY, JSON.stringify(chats)); storageFailed = false; }
    catch { storageFailed = true; notice('Browser storage is unavailable or full. Export your chats to keep a copy.'); }
  }
  function current() { return chats.find(c => c.id === activeId); }
  function notice(text, connectionLink = false) {
    const el = $('#notice'); el.textContent = text;
    if (connectionLink) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Settings'; b.onclick = openSettings; el.append(' ', b); }
  }
  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
  }
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  function updateConnection(verified = false) {
    $('#connection-label').textContent = verified ? 'Nebula AI' : 'Early access';
    $('#connection-button').classList.toggle('verified', verified);
    $('#footnote-status').textContent = settings.improve ? 'Sharing for future training is on. Change in settings.' : 'Your chats are not shared for training.';
  }
  function closeSidebar() { $('.sidebar').classList.remove('open'); $('.scrim').hidden = true; $('#sidebar-toggle').setAttribute('aria-expanded','false'); }
  $('#sidebar-toggle').onclick = () => { const open = !$('.sidebar').classList.contains('open'); $('.sidebar').classList.toggle('open', open); $('.scrim').hidden = !open; $('#sidebar-toggle').setAttribute('aria-expanded',String(open)); };
  $('.scrim').onclick = closeSidebar;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newChat(); } });
  function newChat() { abort(); archivedView = false; activeId = null; $('#prompt').value = ''; resize(); notice(''); render(); closeSidebar(); $('#prompt').focus(); }
  $('.new-chat').onclick = newChat;
  function renderHistory() {
    const nav = $('#conversations'); nav.replaceChildren();
    const query = $('#search').value.toLowerCase().trim();
    const filtered = [...chats].sort((a,b) => b.updated-a.updated).filter(c => Boolean(c.archived) === archivedView).filter(c => c.title.toLowerCase().includes(query) || c.messages.some(m => m.content.toLowerCase().includes(query)));
    $('#chat-count').textContent = String(chats.filter(c => !c.archived).length);
    $('#archive-count').textContent = String(chats.filter(c => c.archived).length);
    $('#archive-view').firstChild.textContent = archivedView ? 'Back to conversations ' : 'Archived chats ';
    $('#archive-view').setAttribute('aria-pressed',String(archivedView));
    if (!filtered.length) { const p = document.createElement('p'); p.className = 'empty-history'; p.textContent = query ? 'No conversations found.' : archivedView ? 'No archived chats yet.' : 'A fresh start. Your conversations will appear here.'; nav.append(p); }
    for (const c of filtered) {
      const row = document.createElement('div'); row.className = 'chat-row' + (c.id === activeId ? ' active' : '');
      const select = document.createElement('button'); select.className = 'chat-select'; select.textContent = c.title; select.title = c.title; select.setAttribute('aria-current', c.id === activeId ? 'true' : 'false');
      select.onclick = () => { if(activeId !== c.id) abort(); activeId = c.id; notice(''); render(); closeSidebar(); };
      const rename = document.createElement('button'); rename.className = 'row-action'; rename.textContent = '✎'; rename.setAttribute('aria-label', `Rename ${c.title}`); rename.onclick = () => { renameId = c.id; $('#chat-name').value = c.title; $('#rename-dialog').showModal(); $('#chat-name').select(); };
      const archive = document.createElement('button'); archive.className = 'row-action'; archive.textContent = c.archived ? '\u21a9' : '\u25a3'; archive.title = c.archived ? 'Restore chat' : 'Archive chat'; archive.setAttribute('aria-label', `${c.archived ? 'Restore' : 'Archive'} ${c.title}`); archive.onclick = () => toggleArchive(c);
      row.addEventListener('contextmenu', e => { e.preventDefault(); openChatMenu(c,e.clientX,e.clientY); });
      select.addEventListener('keydown', e => { if(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const box=select.getBoundingClientRect(); openChatMenu(c,box.left,box.bottom); } });
      row.append(select, rename, archive); nav.append(row);
    }
  }
  function renderContent(el, text) {
    const blocks = text.split(/(```[\s\S]*?```)/g);
    for (const block of blocks) {
      if (!block) continue;
      if (block.startsWith('```') && block.endsWith('```')) { const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = block.slice(3,-3).replace(/^[a-zA-Z0-9_+#.-]*\n/, ''); pre.append(code); el.append(pre); }
      else { const p = document.createElement('p'); p.textContent = block; el.append(p); }
    }
  }
  function render() {
    renderHistory();
    const c = current(), thread = $('#thread'); thread.replaceChildren();
    $('#welcome').hidden = Boolean(c && c.messages.length); thread.hidden = !$('#welcome').hidden;
    document.title = c ? `${c.title} · Nebula AI` : 'Nebula AI';
    if (c) c.messages.forEach((m, index) => {
      const article = document.createElement('article'); article.className = `message message-${m.role}`;
      const header = document.createElement('div'); header.className = 'message-header';
      if (m.role === 'assistant') { const img = document.createElement('img'); img.src = 'nebula.svg'; img.alt = ''; header.append(img); }
      header.append(m.role === 'user' ? 'You' : 'Nebula');
      const content = document.createElement('div'); content.className = 'message-content'; renderContent(content, m.content);
      const footer = document.createElement('div'); footer.className = 'message-footer';
      const copy = document.createElement('button'); copy.textContent = 'Copy'; copy.onclick = async () => { try { await navigator.clipboard.writeText(m.content); copy.textContent = 'Copied'; } catch { notice('Copy is unavailable in this browser. Select the message text to copy it.'); } }; footer.append(copy);
      if (m.role === 'user' && index === c.messages.length - 1) { const retry = document.createElement('button'); retry.textContent = 'Send to model'; retry.disabled = Boolean(pending); retry.onclick = () => requestReply(c); footer.append(retry); }
      article.append(header,content,footer); thread.append(article);
    });
    $('#stop').hidden = !pending;
    $('#send').disabled = Boolean(pending) || !$('#prompt').value.trim();
    $('#prompt').disabled = Boolean(pending);
    requestAnimationFrame(() => { $('#scroll-area').scrollTop = $('#scroll-area').scrollHeight; });
  }
  function resize() { const p = $('#prompt'); p.style.height = 'auto'; p.style.height = Math.min(p.scrollHeight,170) + 'px'; $('#char-count').textContent = p.value.length > 14000 ? `${p.value.length}/16000` : ''; $('#send').disabled = Boolean(pending) || !p.value.trim(); }
  $('#prompt').addEventListener('input', resize);
  $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); $('#composer').requestSubmit(); } });
  $('.suggestions').addEventListener('click', e => { const b = e.target.closest('button[data-prompt]'); if(b) { $('#prompt').value = b.dataset.prompt; resize(); $('#prompt').focus(); } });
  $('#search').addEventListener('input', renderHistory);
  $('#composer').addEventListener('submit', e => {
    e.preventDefault(); if (pending) return;
    const text = $('#prompt').value.trim(); if (!text) return;
    let c = current();
    if (!c) {
      if(chats.length >= MAX_CHATS) { notice('You have 100 conversations. Export or delete a chat before starting another.'); return; }
      c = { id: crypto.randomUUID(), title: text.slice(0,52), updated: Date.now(), messages: [], archived: false }; chats.push(c); activeId = c.id;
    }
    if(c.messages.length >= 200) { notice('This conversation is full. Start a new conversation to continue.'); return; }
    c.messages.push({role:'user',content:text, id:crypto.randomUUID(), trainingEligible:settings.improve}); c.archived = false; archivedView = false; c.updated = Date.now(); $('#prompt').value = ''; resize(); saveChats(); render(); requestReply(c);
  });
  function abort() { if(pending) { pending.controller.abort(); pending = null; } }
  $('#stop').onclick = () => { abort(); notice('Request stopped. Your message is saved; you can send it again.'); render(); $('#prompt').focus(); };
  async function requestReply(c) {
    if(pending || !c.messages.length) return;
    const request = { controller: new AbortController(), chatId:c.id }; pending = request; render(); notice('Nebula is thinking…');
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; request.controller.abort(); }, 90000);
    try {
      const response = await fetch(API + '/chat', { method:'POST', credentials:'omit', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify({messages:c.messages.map(({role,content}) => ({role,content})), training:{enabled:settings.improve && c.messages.at(-1).trainingEligible === true, consentVersion:1, token:dataToken, chatId:c.id, turnId:c.messages.at(-1).id}}), signal:request.controller.signal });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : {};
      if(!response.ok) {
        const messages = { MODEL_NOT_READY:'Nebula is not ready to reply yet. Your message is saved in this browser.', RATE_LIMITED:'You have sent too many messages. Please try again shortly.', INVALID_INPUT:'This conversation is too long to send. Try starting a new chat.' };
        throw new Error((messages[data.code] || 'Nebula is temporarily unavailable. Please try again later.') + (data.trainingSaved ? ' Your new message was also contributed for future training.' : ''));
      }
      const reply = data.reply;
      if(typeof reply !== 'string' || !reply.trim() || reply.length > 100000) throw new Error('Nebula could not finish this reply. Please try again.');
      if(pending !== request) return;
      c.messages.push({role:'assistant',content:reply,id:crypto.randomUUID(),trainingEligible:false}); c.updated = Date.now(); saveChats(); updateConnection(true); notice(storageFailed ? 'Reply received, but browser storage is full. Export your chats to keep a copy.' : settings.improve && c.messages.at(-2).trainingEligible && !data.trainingSaved ? 'Your reply is ready. This turn was not saved for training.' : '');
    } catch(e) {
      if(pending !== request) return;
      updateConnection(false);
      notice(timeout ? 'The model took too long to respond. Your message is saved; try again.' : e.name === 'AbortError' ? 'Request stopped.' : e instanceof TypeError ? 'Nebula could not be reached. Check your connection and try again.' : e.message, true);
    } finally { clearTimeout(timer); if(pending === request) { pending = null; render(); $('#prompt').focus(); } }
  }
  function openSettings() { $('#improve').checked = settings.improve; $('#theme').value = settings.theme; $('#settings-error').textContent = ''; if(!$('#settings').open) $('#settings').showModal(); }
  $('#settings-button').onclick = openSettings; $('#connection-button').onclick = openSettings;
  $('#close-settings').onclick = () => $('#settings').close();
  $('#settings-form').onsubmit = e => {
    e.preventDefault();
    if(pending) { $('#settings-error').textContent = 'Stop the current reply before changing your data preferences.'; return; }
    settings = {improve:$('#improve').checked,theme:$('#theme').value}; applyTheme(); updateConnection();
    try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); }
    catch { notice('Settings applied for this session. Browser storage is unavailable.'); $('#settings').close(); return; }
    $('#settings').close(); notice(settings.improve ? 'Sharing is on for new messages. Contributions are reviewed before future model training.' : 'Sharing is off. New messages will not be saved for model training.');
  };
  function toggleArchive(c) {
    c.archived = !c.archived;
    if(c.archived && activeId === c.id) { abort(); activeId = null; }
    if(!c.archived) { archivedView = false; activeId = c.id; }
    saveChats(); render(); notice(c.archived ? 'Chat archived. Find it in Archived chats.' : 'Chat restored.');
  }
  $('#archive-view').onclick = () => { archivedView = !archivedView; $('#search').value = ''; renderHistory(); };
  function closeChatMenu() { $('#chat-menu').hidden = true; }
  function openChatMenu(c,x,y) {
    menuId = c.id; const menu=$('#chat-menu'); menu.hidden=false;
    $('#menu-archive').textContent = c.archived ? 'Restore chat' : 'Archive chat';
    menu.style.left = Math.max(8,Math.min(x,innerWidth-185))+'px'; menu.style.top = Math.max(8,Math.min(y,innerHeight-150))+'px'; $('#menu-archive').focus();
  }
  document.addEventListener('click',e => { if(!e.target.closest('#chat-menu')) closeChatMenu(); });
  document.addEventListener('keydown',e => { if(e.key === 'Escape') closeChatMenu(); });
  $('#chat-menu').addEventListener('keydown',e => {
    if(!['ArrowDown','ArrowUp','Tab'].includes(e.key)) return;
    if(e.key === 'Tab') {closeChatMenu(); return;}
    e.preventDefault(); const items=Array.from($('#chat-menu').querySelectorAll('button')); const i=items.indexOf(document.activeElement); items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  });
  $('#menu-archive').onclick = () => { const c=chats.find(c=>c.id===menuId); if(c)toggleArchive(c); closeChatMenu(); };
  $('#menu-rename').onclick = () => { const c=chats.find(c=>c.id===menuId); if(c) { renameId=c.id; $('#chat-name').value=c.title; $('#rename-dialog').showModal(); $('#chat-name').select(); } closeChatMenu(); };
  $('#menu-delete').onclick = () => {deleteChatId=menuId;closeChatMenu();$('#delete-chat-dialog').showModal();};
  $('#cancel-delete-chat').onclick = () => $('#delete-chat-dialog').close();
  $('#confirm-delete-chat').onclick = () => {if(activeId===deleteChatId){abort();activeId=null;}chats=chats.filter(c=>c.id!==deleteChatId);saveChats();render();$('#delete-chat-dialog').close();notice('Conversation deleted from this browser.');};
  $('#delete-training').onclick = () => {$('#delete-training-error').textContent='';$('#delete-training-dialog').showModal();};
  $('#cancel-delete-training').onclick = () => $('#delete-training-dialog').close();
  $('#confirm-delete-training').onclick = async () => {
    if(pending) {$('#delete-training-error').textContent='Stop the current reply before deleting shared data.';return;}
    const button=$('#confirm-delete-training');button.disabled=true;
    try {
      const response=await fetch(API+'/training',{method:'DELETE',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:dataToken}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('Your shared data could not be deleted right now. Please try again.');
      settings.improve=false;
      dataToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
      try{localStorage.setItem(DATA_KEY,dataToken);localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}
      updateConnection();$('#delete-training-dialog').close();$('#settings').close();notice('Your stored training contributions have been deleted and sharing is off. Completed model training cannot be reversed.');
    } catch {$('#delete-training-error').textContent='Your shared data could not be deleted right now. Please try again.';}
    finally {button.disabled=false;}
  };
  $('#export').onclick = () => {
    const data = JSON.stringify({app:'Nebula AI',version:1,exportedAt:new Date().toISOString(),conversations:chats},null,2);
    const url = URL.createObjectURL(new Blob([data],{type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = `nebula-conversations-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  $('#clear').onclick = () => $('#confirm-dialog').showModal();
  $('#cancel-clear').onclick = () => $('#confirm-dialog').close();
  $('#confirm-clear').onclick = () => { abort(); chats = []; activeId = null; saveChats(); render(); $('#confirm-dialog').close(); $('#settings').close(); notice(storageFailed ? 'Chats cleared for this session, but browser storage could not be updated.' : 'All conversations deleted from this browser.'); };
  $('#cancel-rename').onclick = () => $('#rename-dialog').close();
  $('#rename-form').onsubmit = e => { e.preventDefault(); const title = $('#chat-name').value.trim(); if(!title) return; const c = chats.find(c => c.id === renameId); if(c) { c.title = title; saveChats(); render(); } $('#rename-dialog').close(); };
  applyTheme(); updateConnection(); render();
  if(storageFailed) notice('Some saved data could not be loaded. Chats may only persist for this session. Export important conversations.');
})();
