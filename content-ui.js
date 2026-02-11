// =====================================================================
// content-ui.js — On-page overlay UI, status updates, and keyboard
// shortcuts for controlling the reader without the popup.
// Depends on: content-config.js, content-tts.js
// =====================================================================

// Utility function to update status in the popup
function updateStatus(message) {
  chrome.runtime.sendMessage({ action: 'updateStatus', message });
  try {
    const s = overlayRoot?.querySelector?.('#anpr_status');
    if (s) s.textContent = message;
  } catch {}
}

// Build a lightweight in-page overlay for recording/demo
function buildOverlay() {
  if (overlayRoot) return overlayRoot;
  const root = document.createElement('div');
  overlayRoot = root;
  root.id = 'anpr_overlay';
  Object.assign(root.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
    background: 'linear-gradient(135deg, #5b8cff, #7a5cff)', color: '#fff',
    boxShadow: '0 10px 30px rgba(15,18,38,0.25)', borderRadius: '12px',
    width: '320px', padding: '12px', font: '13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
  });
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
      <strong style="font-size:14px;display:flex;align-items:center;gap:6px;">📖 Auto Next Page Reader</strong>
      <button id="anpr_close" style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">×</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
      <button id="anpr_start" style="flex:1 1 auto;background:#00b67a;color:#fff;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:600;">Start</button>
      <button id="anpr_stop" style="flex:1 1 auto;background:#c62828;color:#fff;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;" disabled>Stop</button>
      <button id="anpr_skip" style="flex:1 1 100%;background:#ffffff26;color:#fff;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;">Skip Forward</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:6px;">
      <button id="anpr_toggle_next" style="flex:1 1 50%;background:#ffffff26;color:#fff;border:none;border-radius:8px;padding:6px 8px;cursor:pointer;">Auto Next: ON</button>
      <button id="anpr_toggle_read" style="flex:1 1 50%;background:#ffffff26;color:#fff;border:none;border-radius:8px;padding:6px 8px;cursor:pointer;">Auto Read: ON</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:6px;">
      <button id="anpr_toggle_scroll" style="flex:1 1 100%;background:#ffffff26;color:#fff;border:none;border-radius:8px;padding:6px 8px;cursor:pointer;">Auto Scroll: OFF</button>
    </div>
    <div style="background:#ffffff1a;border-radius:8px;padding:8px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <label style="min-width:36px">Rate</label>
        <input id="anpr_rate" type="range" min="0.5" max="1.5" step="0.1" value="0.8" style="flex:1"/>
        <span id="anpr_rate_val">0.8</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <label style="min-width:36px">Pitch</label>
        <input id="anpr_pitch" type="range" min="0.5" max="2" step="0.1" value="1.0" style="flex:1"/>
        <span id="anpr_pitch_val">1.0</span>
      </div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:6px;"><input id="anpr_autolang" type="checkbox" checked/> Auto‑detect language</label>
    </div>
    <div id="anpr_status" style="font-size:12px;opacity:0.95;">Ready… (Ctrl+Shift+O to toggle)</div>
  `;
  document.documentElement.appendChild(root);

  // Wiring
  const qs = (sel)=>root.querySelector(sel);
  const btnStart = qs('#anpr_start');
  const btnStop = qs('#anpr_stop');
  const btnSkip = qs('#anpr_skip');
  const btnClose = qs('#anpr_close');
  const btnNext = qs('#anpr_toggle_next');
  const btnRead = qs('#anpr_toggle_read');
  const btnScroll = qs('#anpr_toggle_scroll');
  const rateEl = qs('#anpr_rate');
  const pitchEl = qs('#anpr_pitch');
  const rateVal = qs('#anpr_rate_val');
  const pitchVal = qs('#anpr_pitch_val');
  const autoLangEl = qs('#anpr_autolang');

  // Initialize UI from current state
  btnNext.textContent = `Auto Next: ${autoNextEnabled ? 'ON' : 'OFF'}`;
  btnRead.textContent = `Auto Read: ${autoReadEnabled ? 'ON' : 'OFF'}`;
  btnScroll.textContent = `Auto Scroll: ${autoScrollWhileReading ? 'ON' : 'OFF'}`;
  rateEl.value = String(ttsRate);
  pitchEl.value = String(ttsPitch);
  rateVal.textContent = String(ttsRate);
  pitchVal.textContent = String(ttsPitch);
  autoLangEl.checked = !!ttsAutoLang;
  btnStop.disabled = !isReading;

  btnStart.onclick = async () => {
    const text = await waitForReadableContent(3500);
    if (text) {
      ttsRate = parseFloat(rateEl.value); ttsPitch = parseFloat(pitchEl.value); ttsAutoLang = !!autoLangEl.checked;
      try { chrome.storage?.local.set({ ttsRate, ttsPitch, ttsAutoLang }); } catch {}
      startSpeech(text, ttsRate, ttsPitch, { autoLang: ttsAutoLang });
      updateStatus('Reading started…');
      btnStart.disabled = true; btnStop.disabled = false;
    } else {
      updateStatus('No readable content found yet. Try scrolling or reload.');
    }
  };
  btnStop.onclick = () => { stopSpeech(); updateStatus('Reading stopped.'); btnStart.disabled = false; btnStop.disabled = true; };
  btnSkip.onclick = () => { skipForward(); updateStatus('Skipped forward…'); };
  btnClose.onclick = () => toggleOverlay(false);
  btnNext.onclick = () => { autoNextEnabled = !autoNextEnabled; btnNext.textContent = `Auto Next: ${autoNextEnabled ? 'ON' : 'OFF'}`; try{chrome.storage?.local.set({autoNextEnabled});}catch{} };
  btnRead.onclick = () => { autoReadEnabled = !autoReadEnabled; btnRead.textContent = `Auto Read: ${autoReadEnabled ? 'ON' : 'OFF'}`; try{chrome.storage?.local.set({autoReadEnabled});}catch{} };
  btnScroll.onclick = () => {
    autoScrollWhileReading = !autoScrollWhileReading;
    btnScroll.textContent = `Auto Scroll: ${autoScrollWhileReading ? 'ON' : 'OFF'}`;
    try { chrome.storage?.local.set({ autoScrollWhileReading }); } catch {}
    if (isReading) { if (autoScrollWhileReading) startAutoScroll(); else stopAutoScroll(); }
  };
  rateEl.oninput = () => { rateVal.textContent = String(parseFloat(rateEl.value)); };
  rateEl.onchange = () => { ttsRate = parseFloat(rateEl.value); try{chrome.storage?.local.set({ttsRate});}catch{} };
  pitchEl.oninput = () => { pitchVal.textContent = String(parseFloat(pitchEl.value)); };
  pitchEl.onchange = () => { ttsPitch = parseFloat(pitchEl.value); try{chrome.storage?.local.set({ttsPitch});}catch{} };
  autoLangEl.onchange = () => { ttsAutoLang = !!autoLangEl.checked; try{chrome.storage?.local.set({ttsAutoLang});}catch{} };

  return root;
}

function toggleOverlay(force) {
  if (!overlayRoot) buildOverlay();
  const show = typeof force === 'boolean' ? force : !overlayVisible;
  overlayRoot.style.display = show ? 'block' : 'none';
  overlayVisible = show;
}
