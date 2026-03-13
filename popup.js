// Ordered list of content scripts to inject (dependencies first)
const CONTENT_SCRIPTS = [
  'Readability.js',
  'content-config.js',
  'content-extract.js',
  'content-translate.js',
  'content-tts.js',
  'content-navigation.js',
  'content-ui.js',
  'content-main.js'
];

let autoNextEnabled = true; // Default is ON
let isSpeaking = false; // Track if the speech is currently speaking
let activeTabId = null; // Track the tab ID where reading was initiated
let autoReadEnabled = true; // Default is ON
let ttsRate = 0.8;
let ttsPitch = 1.0;
let ttsAutoLang = true;
let autoScrollWhileReading = false;
let voiceListCache = [];
let preferNaturalVoices = true;
let selectedVoiceURI = null;
let selectedGender = 'auto';
let femaleVoiceURI = null;
let maleVoiceURI = null;
let activeVoice = 'auto';
let naturalPreset = true;
let dynamicProsody = true;
let dialogueAlternate = false;
let instantStartEnabled = false; // New flag for instant start on popup open
let translateEnabled = false; // English mode: translation off
let hindiVoiceGender = 'male'; // unused but kept for compat
let premiumActive = true;
let cloudTtsEnabled = false; // Google Cloud TTS (premium)
let cloudTtsApiKey = '';
let cloudTtsVoice = 'en-US-Neural2-J';
let selectedEnglishVoice = 'auto'; // English voice selection

// Toggle auto-read feature
document.getElementById('toggleAutoRead').addEventListener('click', async () => {
    autoReadEnabled = !autoReadEnabled;
    const status = autoReadEnabled ? "Auto Read ON" : "Auto Read OFF";
    document.getElementById('toggleAutoRead').innerText = status;

    try {
    await sendMessageToTab('toggleAutoRead', { autoReadEnabled });
    chrome.storage.local.set({ autoReadEnabled });
    updateStatus(`Auto Read is now ${status}.`);
    } catch (error) {
        console.error('Failed to toggle auto-read:', error);
    }
});



// Restore state when popup is reopened
document.addEventListener('DOMContentLoaded', async () => {
  chrome.storage.local.get(['isSpeaking', 'autoNextEnabled', 'activeTabId', 'autoReadEnabled', 'ttsRate', 'ttsPitch', 'ttsAutoLang', 'autoScrollWhileReading', 'voiceURI', 'femaleVoiceURI', 'maleVoiceURI', 'activeVoice', 'voiceGender', 'preferNaturalVoices', 'naturalPreset', 'dynamicProsody', 'dialogueAlternate', 'instantStartEnabled', 'translateEnabled', 'hindiVoiceGender', 'premiumActive'], (data) => {
    isSpeaking = data.isSpeaking || false;
    autoNextEnabled = data.autoNextEnabled ?? true;
    activeTabId = data.activeTabId || null;
    autoReadEnabled = data.autoReadEnabled ?? true;
    ttsRate = typeof data.ttsRate === 'number' ? data.ttsRate : 0.8;
    ttsPitch = typeof data.ttsPitch === 'number' ? data.ttsPitch : 1.0;
  ttsAutoLang = typeof data.ttsAutoLang === 'boolean' ? data.ttsAutoLang : true;
  autoScrollWhileReading = typeof data.autoScrollWhileReading === 'boolean' ? data.autoScrollWhileReading : false;
  selectedVoiceURI = typeof data.voiceURI === 'string' ? data.voiceURI : null;
  femaleVoiceURI = typeof data.femaleVoiceURI === 'string' ? data.femaleVoiceURI : null;
  maleVoiceURI = typeof data.maleVoiceURI === 'string' ? data.maleVoiceURI : null;
  activeVoice = typeof data.activeVoice === 'string' ? data.activeVoice : 'auto';
  selectedGender = typeof data.voiceGender === 'string' ? data.voiceGender : 'auto';
  preferNaturalVoices = typeof data.preferNaturalVoices === 'boolean' ? data.preferNaturalVoices : true;
  naturalPreset = typeof data.naturalPreset === 'boolean' ? data.naturalPreset : true;
  dynamicProsody = typeof data.dynamicProsody === 'boolean' ? data.dynamicProsody : true;
  dialogueAlternate = typeof data.dialogueAlternate === 'boolean' ? data.dialogueAlternate : false;
  instantStartEnabled = typeof data.instantStartEnabled === 'boolean' ? data.instantStartEnabled : false;
  translateEnabled = false; // Always English
  hindiVoiceGender = 'male';
  premiumActive = true;

  chrome.storage.local.set({ translateEnabled: false, premiumActive: true });

  // Load Gemini API key
  chrome.storage.local.get(['geminiApiKey'], (gd) => {
    const keyEl = document.getElementById('geminiApiKey');
    if (keyEl && gd.geminiApiKey) keyEl.value = gd.geminiApiKey;
  });

  // Load Google Cloud TTS settings
  chrome.storage.local.get(['cloudTtsEnabled', 'cloudTtsApiKey', 'cloudTtsVoice'], (cd) => {
    cloudTtsEnabled = typeof cd.cloudTtsEnabled === 'boolean' ? cd.cloudTtsEnabled : false;
    cloudTtsApiKey = typeof cd.cloudTtsApiKey === 'string' ? cd.cloudTtsApiKey : '';
    cloudTtsVoice = typeof cd.cloudTtsVoice === 'string' && cd.cloudTtsVoice ? cd.cloudTtsVoice : 'en-US-Neural2-J';
    _updateCloudTtsUI();
  });

    // Update UI based on the stored state
    if (isSpeaking) {
      updateStatus('Reading...');
      toggleControls('start');
    } else {
      updateStatus('Ready — English');
      toggleControls('stop');
    }
    document.getElementById('toggle').innerText = autoNextEnabled ? "Auto Next ON" : "Auto Next OFF";
  document.getElementById('toggleAutoRead').innerText = autoReadEnabled ? "Auto Read ON" : "Auto Read OFF";
  const asEl = document.getElementById('toggleAutoScroll');
  if (asEl) asEl.innerText = autoScrollWhileReading ? "Auto Scroll ON" : "Auto Scroll OFF";

    // Initialize TTS controls
    const rateEl = document.getElementById('rate');
    const pitchEl = document.getElementById('pitch');
    const rateVal = document.getElementById('rateVal');
    const pitchVal = document.getElementById('pitchVal');
    const autoLangEl = document.getElementById('autoLang');
    const naturalEl = document.getElementById('naturalPreset');
    const prosodyEl = document.getElementById('dynamicProsody');
    const dialogueEl = document.getElementById('dialogueAlternate');
    const instantEl = document.getElementById('instantStartEnabled');
    rateEl.value = String(ttsRate);
    pitchEl.value = String(ttsPitch);
    rateVal.textContent = String(ttsRate);
    pitchVal.textContent = String(ttsPitch);
    autoLangEl.checked = !!ttsAutoLang;
    const genderEl = document.getElementById('voiceGender');
    const activeEl = document.getElementById('activeVoice');
    const preferEl = document.getElementById('preferNaturalVoices');
    if (genderEl) genderEl.value = selectedGender;
    if (activeEl) activeEl.value = activeVoice;
    if (preferEl) preferEl.checked = !!preferNaturalVoices;
    if (naturalEl) naturalEl.checked = !!naturalPreset;
    if (prosodyEl) prosodyEl.checked = !!dynamicProsody;
    if (dialogueEl) dialogueEl.checked = !!dialogueAlternate;
    if (instantEl) instantEl.checked = !!instantStartEnabled;

    // Load saved English voice preference
    chrome.storage.local.get(['selectedEnglishVoice'], (evd) => {
      selectedEnglishVoice = evd.selectedEnglishVoice || 'auto';
    });
  });

  // Prime on-demand scripts in the active tab so overlay/hotkeys work immediately after opening the popup.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      for (const file of CONTENT_SCRIPTS) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
      }
      // Load voices from the page context and initialize selectors
      await loadAndPopulateVoices();
      // Populate English voice picker
      _populateEnglishVoices();
      // Attempt instant start (fast provisional reading) after voices are loaded
      if (!isSpeaking && instantStartEnabled && autoReadEnabled) {
        try {
          await sendMessageToTab('fastStart', { provisional: true });
          updateStatus('Instant start…');
          isSpeaking = true;
          chrome.storage.local.set({ isSpeaking });
          toggleControls('start');
        } catch (e) {
          console.debug('Instant start failed:', e?.message || e);
        }
      }
      // If we are already speaking via fastStart, send a voice upgrade once best voice is known
      if (isSpeaking && instantStartEnabled) {
        try {
          const finalVoice = await pickVoiceForStart();
          if (finalVoice) {
            await sendMessageToTab('upgradeVoice', { voiceURI: finalVoice });
            console.debug('Sent upgradeVoice for provisional session:', finalVoice);
          }
        } catch (e) { console.debug('upgradeVoice dispatch skipped:', e?.message || e); }
      }
    }
  } catch (e) {
    // Likely missing file URL access or restricted page; will inject again on Start
    console.debug('Pre-injection skipped:', e?.message || e);
  }
    // Wire preset/prosody checkbox handlers
    try {
      const naturalEl = document.getElementById('naturalPreset');
      const prosodyEl = document.getElementById('dynamicProsody');
      const dialogueEl = document.getElementById('dialogueAlternate');
      const instantEl = document.getElementById('instantStartEnabled');
      if (naturalEl) {
        naturalEl.addEventListener('change', (e) => {
          naturalPreset = !!e.target.checked;
          chrome.storage.local.set({ naturalPreset });
        });
      }
      if (prosodyEl) {
        prosodyEl.addEventListener('change', (e) => {
          dynamicProsody = !!e.target.checked;
          chrome.storage.local.set({ dynamicProsody });
        });
      }
      if (dialogueEl) {
        dialogueEl.addEventListener('change', (e) => {
          dialogueAlternate = !!e.target.checked;
          chrome.storage.local.set({ dialogueAlternate });
        });
      }
      if (instantEl) {
        instantEl.addEventListener('change', (e) => {
          instantStartEnabled = !!e.target.checked;
          chrome.storage.local.set({ instantStartEnabled });
        });
      }
    } catch {}
});

async function loadAndPopulateVoices() {
  try {
    const data = await chrome.storage.local.get(['voiceURI', 'femaleVoiceURI', 'maleVoiceURI', 'activeVoice', 'voiceGender', 'cachedVoices', 'cachedVoicesTs']);
    selectedVoiceURI = data.voiceURI || selectedVoiceURI;
    femaleVoiceURI = data.femaleVoiceURI || femaleVoiceURI;
    maleVoiceURI = data.maleVoiceURI || maleVoiceURI;
    activeVoice = data.activeVoice || activeVoice || 'auto';
    selectedGender = data.voiceGender || selectedGender || 'auto';
    const genderEl = document.getElementById('voiceGender');
    const voiceEl = document.getElementById('voice');
    const femaleEl = document.getElementById('femaleVoice');
    const maleEl = document.getElementById('maleVoice');
    const activeEl = document.getElementById('activeVoice');
    const preferEl = document.getElementById('preferNaturalVoices');
    if (genderEl) genderEl.value = selectedGender;
    if (activeEl) activeEl.value = activeVoice;
    if (preferEl) preferEl.checked = !!preferNaturalVoices;

    // Fast path: try popup's own speechSynthesis voices
    const freshPopupVoices = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
    const now = Date.now();
    const cachedAge = (typeof data.cachedVoicesTs === 'number') ? (now - data.cachedVoicesTs) : Infinity;
    const cacheValid = Array.isArray(data.cachedVoices) && data.cachedVoices.length && cachedAge < 1000 * 60 * 120; // 2h TTL

    if (freshPopupVoices && freshPopupVoices.length) {
      voiceListCache = freshPopupVoices.map(v => ({
        name: v.name,
        voiceURI: v.voiceURI,
        lang: v.lang,
        default: !!v.default,
        localService: !!v.localService,
        gender: inferGender(v.name)
      }));
      chrome.storage.local.set({ cachedVoices: voiceListCache, cachedVoicesTs: now });
    } else if (cacheValid) {
      voiceListCache = data.cachedVoices;
    } else {
      // Fallback: ask content script (may have different environment / Edge online voices ready)
      let voicesResp = null;
      try { voicesResp = await sendMessageToTab('getVoices'); } catch {}
      if (!voicesResp || !Array.isArray(voicesResp.voices) || voicesResp.voices.length === 0) {
        await new Promise(r => setTimeout(r, 600));
        try { voicesResp = await sendMessageToTab('getVoices'); } catch {}
      }
      voiceListCache = (voicesResp && voicesResp.voices) ? voicesResp.voices : [];
      if (voiceListCache.length) chrome.storage.local.set({ cachedVoices: voiceListCache, cachedVoicesTs: now });
    }

    // If still empty, attach a one-time listener to repopulate after voiceschanged
    if (!voiceListCache.length && typeof speechSynthesis !== 'undefined') {
      const once = () => {
        speechSynthesis.removeEventListener('voiceschanged', once);
        try {
          const late = speechSynthesis.getVoices() || [];
          if (late.length) {
            voiceListCache = late.map(v => ({
              name: v.name,
              voiceURI: v.voiceURI,
              lang: v.lang,
              default: !!v.default,
              localService: !!v.localService,
              gender: inferGender(v.name)
            }));
            chrome.storage.local.set({ cachedVoices: voiceListCache, cachedVoicesTs: Date.now() });
            populateVoiceSelect(voiceListCache, selectedGender, selectedVoiceURI);
            populateFavorites(voiceListCache, femaleEl, 'female', femaleVoiceURI);
            populateFavorites(voiceListCache, maleEl, 'male', maleVoiceURI);
          }
        } catch {}
      };
      try { speechSynthesis.addEventListener('voiceschanged', once); } catch {}
    }
        const naturalEl = document.getElementById('naturalPreset');
        const prosodyEl = document.getElementById('dynamicProsody');
        if (naturalEl) naturalEl.checked = !!naturalPreset;
        if (prosodyEl) prosodyEl.checked = !!dynamicProsody;
    populateVoiceSelect(voiceListCache, selectedGender, selectedVoiceURI);
    populateFavorites(voiceListCache, femaleEl, 'female', femaleVoiceURI);
    populateFavorites(voiceListCache, maleEl, 'male', maleVoiceURI);

    // Auto-pick best male/female if not set yet
    if (!femaleVoiceURI) {
      const bestF = pickBestByGender('female');
      if (bestF) {
        femaleVoiceURI = bestF.voiceURI;
        chrome.storage.local.set({ femaleVoiceURI });
        if (femaleEl) femaleEl.value = femaleVoiceURI;
      }
    }
    if (!maleVoiceURI) {
      const bestM = pickBestByGender('male');
      if (bestM) {
        maleVoiceURI = bestM.voiceURI;
        chrome.storage.local.set({ maleVoiceURI });
        if (maleEl) maleEl.value = maleVoiceURI;
      }
    }

    // Wire change handlers
    if (genderEl) {
      genderEl.onchange = () => {
        selectedGender = genderEl.value || 'auto';
        chrome.storage.local.set({ voiceGender: selectedGender });
        populateVoiceSelect(voiceListCache, selectedGender, selectedVoiceURI);
      };
    }
    if (preferEl) {
      preferEl.onchange = () => {
        preferNaturalVoices = !!preferEl.checked;
        chrome.storage.local.set({ preferNaturalVoices });
        populateVoiceSelect(voiceListCache, selectedGender, selectedVoiceURI);
      };
    }
    if (voiceEl) {
      voiceEl.onchange = async () => {
        const uri = voiceEl.value || null;
        selectedVoiceURI = uri;
        chrome.storage.local.set({ voiceURI: selectedVoiceURI });
        try { await sendMessageToTab('setPreferredVoice', { voiceURI: selectedVoiceURI }); } catch {}
      };
    }
    if (femaleEl) {
      femaleEl.onchange = () => {
        femaleVoiceURI = femaleEl.value || null;
        chrome.storage.local.set({ femaleVoiceURI });
      };
    }
    if (maleEl) {
      maleEl.onchange = () => {
        maleVoiceURI = maleEl.value || null;
        chrome.storage.local.set({ maleVoiceURI });
      };
    }
    if (activeEl) {
      activeEl.onchange = () => {
        activeVoice = activeEl.value || 'auto';
        chrome.storage.local.set({ activeVoice });
      };
    }
    const pickBtn = document.getElementById('pickBestVoices');
    if (pickBtn) {
      pickBtn.onclick = () => {
        const bestF = pickBestByGender('female');
        const bestM = pickBestByGender('male');
        if (bestF) {
          femaleVoiceURI = bestF.voiceURI;
          chrome.storage.local.set({ femaleVoiceURI });
          const femaleEl2 = document.getElementById('femaleVoice');
          if (femaleEl2) femaleEl2.value = femaleVoiceURI;
        }
        if (bestM) {
          maleVoiceURI = bestM.voiceURI;
          chrome.storage.local.set({ maleVoiceURI });
          const maleEl2 = document.getElementById('maleVoice');
          if (maleEl2) maleEl2.value = maleVoiceURI;
        }
        updateStatus('Best voices selected.');
      };
    }
  } catch (e) {
    console.debug('Voice init failed:', e?.message || e);
  }
}

function populateVoiceSelect(voices, genderFilter, selectedURI) {
  const voiceEl = document.getElementById('voice');
  if (!voiceEl) return;
  voiceEl.innerHTML = '';
  const filtered = voices.filter(v => {
    if (!genderFilter || genderFilter === 'auto') return true;
    return (v.gender || 'unknown') === genderFilter;
  });

  // Sort by: natural/neural first, then language match en*, then name
  const langPref = navigator.language?.slice(0,2)?.toLowerCase() || 'en';
  filtered.sort((a, b) => {
    const aw = /neural|natural|premium/i.test(a.name) ? 1 : 0;
    const bw = /neural|natural|premium/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    if (preferNaturalVoices) {
      const aon = a.localService ? 0 : 1; // prefer online
      const bon = b.localService ? 0 : 1;
      if (aon !== bon) return bon - aon;
    }
    const al = a.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    const bl = b.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    if (al !== bl) return bl - al;
    return a.name.localeCompare(b.name);
  });

  // Add default option
  const defOpt = document.createElement('option');
  defOpt.value = '';
  defOpt.textContent = 'Auto (best match)';
  voiceEl.appendChild(defOpt);

  // Group by gender with optgroups
  const groups = { female: [], male: [], unknown: [] };
  for (const v of filtered) { groups[v.gender || 'unknown'].push(v); }
  const order = ['female', 'male', 'unknown'];
  for (const g of order) {
    if (!groups[g].length) continue;
    const og = document.createElement('optgroup');
    og.label = g.charAt(0).toUpperCase() + g.slice(1);
    for (const v of groups[g]) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} — ${v.lang}${v.localService ? '' : ' (online)'}`;
      if (selectedURI && v.voiceURI === selectedURI) opt.selected = true;
      og.appendChild(opt);
    }
    voiceEl.appendChild(og);
  }
  voiceEl.disabled = false;
}

function inferGender(name='') {
  const n = String(name).toLowerCase();
  if (/\b(female|woman|girl)\b|aria|sara|jenny|zoe|emma|samantha|victoria|linda|amy|joanna|katy/.test(n)) return 'female';
  if (/\b(male|man|boy|guy)\b|daniel|george|matthew|michael|christopher|benjamin|brian|john|tom|stephen/.test(n)) return 'male';
  return 'unknown';
}

function populateFavorites(voices, selectEl, gender, selectedURI) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const list = voices.filter(v => (v.gender || 'unknown') === gender);
  const langPref = navigator.language?.slice(0,2)?.toLowerCase() || 'en';
  list.sort((a, b) => {
    const aw = /neural|natural|premium/i.test(a.name) ? 1 : 0;
    const bw = /neural|natural|premium/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    if (preferNaturalVoices) {
      const aon = a.localService ? 0 : 1;
      const bon = b.localService ? 0 : 1;
      if (aon !== bon) return bon - aon;
    }
    const al = a.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    const bl = b.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    if (al !== bl) return bl - al;
    return a.name.localeCompare(b.name);
  });
  // Default option
  const def = document.createElement('option');
  def.value = '';
  def.textContent = 'Auto (best match)';
  selectEl.appendChild(def);
  for (const v of list) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} — ${v.lang}${v.localService ? '' : ' (online)'}`;
    if (selectedURI && v.voiceURI === selectedURI) opt.selected = true;
    selectEl.appendChild(opt);
  }
  selectEl.disabled = false;
}

function pickBestByGender(gender) {
  const langPref = navigator.language?.slice(0,2)?.toLowerCase() || 'en';
  const list = (voiceListCache || []).filter(v => (v.gender || 'unknown') === gender);
  if (!list.length) return null;
  const sorted = list.slice().sort((a, b) => {
    const aw = /neural|natural|premium/i.test(a.name) ? 1 : 0;
    const bw = /neural|natural|premium/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    const aon = preferNaturalVoices ? (a.localService ? 0 : 1) : 0;
    const bon = preferNaturalVoices ? (b.localService ? 0 : 1) : 0;
    if (aon !== bon) return bon - aon;
    const al = a.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    const bl = b.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    if (al !== bl) return bl - al;
    return a.name.localeCompare(b.name);
  });
  return sorted[0] || null;
}

// Helper: robust message send with reinjection + retry
async function sendMessageToTab(action, data = {}) {
  let targetTabId = null;
  const pickActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  };
  // Prefer stored reading session tab
  if (activeTabId !== null) {
    try {
      const t = await chrome.tabs.get(activeTabId);
      if (t && t.id != null) targetTabId = t.id;
    } catch {
      activeTabId = null;
      try { chrome.storage?.local.set?.({ activeTabId: null }); } catch {}
    }
  }
  if (targetTabId === null) {
    const tab = await pickActiveTab();
    if (!tab || tab.id == null) throw new Error('No active tab to control');
    targetTabId = tab.id;
  }
  // Validate URL (cannot inject on chrome://, edge://, about:, extension pages)
  try {
    const tabInfo = await chrome.tabs.get(targetTabId);
    if (tabInfo && tabInfo.url && /^(chrome|edge|about):/i.test(tabInfo.url)) {
      throw new Error('Unsupported page (browser internal) – open a readable webpage first.');
    }
  } catch (e) {
    if (/Unsupported page/.test(e.message)) throw e;
  }

  const inject = async () => {
    try {
      for (const f of CONTENT_SCRIPTS) {
        await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: [f] });
      }
    } catch (err) {
      console.debug('Initial inject failed:', err?.message || err);
    }
  };

  await inject();
  const payload = { action, ...data };
  const attemptSend = async () => chrome.tabs.sendMessage(targetTabId, payload);
  try {
    return await attemptSend();
  } catch (err) {
    const msg = String(err?.message || err);
    if (/Receiving end does not exist/i.test(msg) || /Could not establish connection/i.test(msg)) {
      // Re-inject then retry once after short delay
      await inject();
      await new Promise(r => setTimeout(r, 150));
      try {
        return await attemptSend();
      } catch (err2) {
        throw new Error('Content script not responding after retry. Open a chapter page and try again.');
      }
    }
    throw err;
  }
}

// Open important settings guide
document.getElementById('settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
});

// Open support/donation page (configurable in Options, with a sensible default)
const defaultSupportUrl = 'https://buymeacoffee.com/sasmalgiric';
let supportUrlCache = defaultSupportUrl;
chrome.storage.sync.get(['supportUrl'], (data) => {
  if (typeof data.supportUrl === 'string' && data.supportUrl) {
    supportUrlCache = data.supportUrl;
  }
});
document.getElementById('support')?.addEventListener('click', () => {
  const url = supportUrlCache;
  if (url && /^https?:\/\//i.test(url)) {
    chrome.tabs.create({ url });
  } else {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  }
});

// Start reading aloud
document.getElementById('start').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Guard: internal pages (chrome://, edge://, about:) cannot be controlled
    if (!tab || !tab.url || /^(chrome|edge|about):/i.test(tab.url)) {
      updateStatus('Unsupported page. Open a readable webpage first.');
      console.debug('Start blocked: internal page', tab && tab.url);
      return;
    }
    activeTabId = tab.id; // Set active tab ID when reading starts
    chrome.storage.local.set({ activeTabId });

    if (!isSpeaking) {
      // Ensure latest TTS values are used
      const rateEl = document.getElementById('rate');
      const pitchEl = document.getElementById('pitch');
      const autoLangEl = document.getElementById('autoLang');
      ttsRate = parseFloat(rateEl.value);
      ttsPitch = parseFloat(pitchEl.value);
      ttsAutoLang = !!autoLangEl.checked;
  chrome.storage.local.set({ ttsRate, ttsPitch, ttsAutoLang });

  // Ensure current auto-scroll setting is applied first
  await sendMessageToTab('toggleAutoScroll', { autoScrollWhileReading });
  // Choose voice in priority: manual dropdown > active female/male favorite > auto best
  const voiceToUse = await pickVoiceForStart();
  await sendMessageToTab('startSpeech', { rate: ttsRate, pitch: ttsPitch, autoLang: ttsAutoLang, voiceURI: voiceToUse });
      updateStatus('Reading started...');
      isSpeaking = true;
      chrome.storage.local.set({ isSpeaking });
      toggleControls('start');

      // If Auto Next and Auto Read are both enabled, request host permission and start a background session
      if (autoNextEnabled && autoReadEnabled && tab && tab.url) {
        try {
          const originPattern = (() => {
            try {
              const u = new URL(tab.url);
              return `${u.protocol}//${u.hostname}/*`;
            } catch { return null; }
          })();
          if (originPattern) {
            // Request optional host permission for this origin (user gesture context)
            await chrome.permissions.request({ origins: [originPattern] });
            const mode = /(^|\.)webnovel\.com$/i.test(new URL(tab.url).hostname) ? 'infinite' : 'chapter';
            await chrome.runtime.sendMessage({ type: 'startAutoSession', tabId: tab.id, originPattern, mode });
          }
        } catch (e) {
          console.debug('Session permission/start skipped:', e?.message || e);
        }
      }
    }
  } catch (error) {
    console.error('Failed to start speech:', error);
    const msg = String(error?.message || error || '');
    if (/Unsupported page/i.test(msg)) {
      updateStatus('Unsupported page. Open a readable webpage first.');
    } else {
      updateStatus('Failed to start speech. Try reloading the page.');
    }
  }
});

// Stop reading
document.getElementById('stop').addEventListener('click', async () => {
  try {
    if (isSpeaking && activeTabId !== null) {
      await sendMessageToTab('stopSpeech');
    }
  } catch (error) {
    console.error('Failed to stop speech in tab:', error);
  } finally {
    try { if (activeTabId !== null) await chrome.runtime.sendMessage({ type: 'stopAutoSession', tabId: activeTabId }); } catch {}
    isSpeaking = false;
    chrome.storage.local.set({ isSpeaking, activeTabId: null });
    activeTabId = null;
    updateStatus('Reading stopped.');
    toggleControls('stop');
  }
});

// Toggle auto-next feature
document.getElementById('toggle').addEventListener('click', async () => {
  autoNextEnabled = !autoNextEnabled;
  const status = autoNextEnabled ? "Auto Next ON" : "Auto Next OFF";
  document.getElementById('toggle').innerText = status;

  try {
    await sendMessageToTab('toggleAutoNext', { autoNextEnabled });
    chrome.storage.local.set({ autoNextEnabled });
    updateStatus(`Auto Next is now ${status}.`);
  } catch (error) {
    console.error('Failed to toggle auto next:', error);
  }
});

// Toggle auto-scroll while reading
document.getElementById('toggleAutoScroll')?.addEventListener('click', async () => {
  autoScrollWhileReading = !autoScrollWhileReading;
  const status = autoScrollWhileReading ? "Auto Scroll ON" : "Auto Scroll OFF";
  document.getElementById('toggleAutoScroll').innerText = status;
  try {
    await sendMessageToTab('toggleAutoScroll', { autoScrollWhileReading });
    chrome.storage.local.set({ autoScrollWhileReading });
    updateStatus(`Auto Scroll is now ${status}.`);
  } catch (error) {
    console.error('Failed to toggle auto scroll:', error);
  }
});

// Update the status message for better UX feedback
function updateStatus(message) {
  document.getElementById('status').innerText = message;
}

async function pickVoiceForStart() {
  // 1) Explicit manual selection
  if (selectedVoiceURI) return selectedVoiceURI;

  // 2) Active choice
  if (activeVoice === 'female' && femaleVoiceURI) return femaleVoiceURI;
  if (activeVoice === 'male' && maleVoiceURI) return maleVoiceURI;

  // 3) Auto: prefer gender dropdown if set and favorite exists
  if (selectedGender === 'female' && femaleVoiceURI) return femaleVoiceURI;
  if (selectedGender === 'male' && maleVoiceURI) return maleVoiceURI;

  // 4) Auto best by language + "neural"/"natural" preference
  const langPref = navigator.language?.slice(0,2)?.toLowerCase() || 'en';
  const voices = voiceListCache || [];
  const sorted = voices.slice().sort((a, b) => {
    const aw = /neural|natural|premium/i.test(a.name) ? 1 : 0;
    const bw = /neural|natural|premium/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    if (preferNaturalVoices) {
      const aon = a.localService ? 0 : 1;
      const bon = b.localService ? 0 : 1;
      if (aon !== bon) return bon - aon;
    }
    const al = a.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    const bl = b.lang?.toLowerCase().startsWith(langPref) ? 1 : 0;
    if (al !== bl) return bl - al;
    return a.name.localeCompare(b.name);
  });
  return (sorted[0] && sorted[0].voiceURI) || null;
}

// Preview selected voice with a short sample without altering reading state
document.getElementById('previewVoice').addEventListener('click', async () => {
  try {
    const voiceURI = document.getElementById('voice')?.value || selectedVoiceURI || (await pickVoiceForStart());
    if (!voiceURI) return;
    await sendMessageToTab('previewVoice', { voiceURI, rate: ttsRate, pitch: ttsPitch });
  } catch (e) {
    console.debug('Preview failed:', e?.message || e);
  }
});

// Listen for status updates from the content script while the popup is open
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'updateStatus' && msg.message) {
    updateStatus(msg.message);
  }
});

// Skip forward in the text
document.getElementById('forward').addEventListener('click', async () => {
  try {
    if (activeTabId !== null) {
      await sendMessageToTab('skipForward');
      updateStatus('Skipped forward...');
    }
  } catch (error) {
    console.error('Failed to skip forward:', error);
  }
});

// Persist TTS control changes
document.getElementById('rate').addEventListener('input', (e) => {
  ttsRate = parseFloat(e.target.value);
  document.getElementById('rateVal').textContent = String(ttsRate);
});
document.getElementById('rate').addEventListener('change', () => {
  chrome.storage.local.set({ ttsRate });
});
document.getElementById('pitch').addEventListener('input', (e) => {
  ttsPitch = parseFloat(e.target.value);
  document.getElementById('pitchVal').textContent = String(ttsPitch);
});
document.getElementById('pitch').addEventListener('change', () => {
  chrome.storage.local.set({ ttsPitch });
});
document.getElementById('autoLang').addEventListener('change', (e) => {
  ttsAutoLang = !!e.target.checked;
  chrome.storage.local.set({ ttsAutoLang });
});

// ---------- English Voice Picker ----------

function _populateEnglishVoices() {
  const selectEl = document.getElementById('englishVoice');
  if (!selectEl) return;
  selectEl.innerHTML = '';

  // Auto option
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = 'Auto (Best Available)';
  selectEl.appendChild(autoOpt);

  // Filter English voices and sort by quality
  const enVoices = (voiceListCache || []).filter(v => {
    const lang = (v.lang || '').toLowerCase();
    return lang.startsWith('en');
  });

  // Score and sort: natural/neural first, online preferred, then by name
  enVoices.sort((a, b) => {
    const aScore = _englishVoiceScore(a);
    const bScore = _englishVoiceScore(b);
    if (aScore !== bScore) return bScore - aScore;
    return a.name.localeCompare(b.name);
  });

  // Group: Best voices first, then others
  const best = enVoices.filter(v => _englishVoiceScore(v) >= 10);
  const rest = enVoices.filter(v => _englishVoiceScore(v) < 10);

  if (best.length) {
    const og = document.createElement('optgroup');
    og.label = 'Best Voices';
    for (const v of best) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} — ${v.lang}${v.localService ? '' : ' (online)'}`;
      if (selectedEnglishVoice === v.voiceURI) opt.selected = true;
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }
  if (rest.length) {
    const og = document.createElement('optgroup');
    og.label = 'Other Voices';
    for (const v of rest) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} — ${v.lang}${v.localService ? '' : ' (online)'}`;
      if (selectedEnglishVoice === v.voiceURI) opt.selected = true;
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }

  if (selectedEnglishVoice === 'auto') selectEl.value = 'auto';
}

function _englishVoiceScore(v) {
  let score = 0;
  const name = (v.name || '').toLowerCase();
  // Natural/Neural voices are best
  if (/natural|neural|premium/i.test(name)) score += 20;
  // Online voices tend to be higher quality
  if (!v.localService) score += 5;
  // Prefer en-US
  if ((v.lang || '').toLowerCase().startsWith('en-us')) score += 3;
  // Known high-quality names (Edge/Chrome)
  if (/\b(aria|jenny|guy|davis|andrew|ava|brian|emma|ryan)\b/i.test(name)) score += 10;
  if (/\b(microsoft|google)\b/i.test(name)) score += 2;
  return score;
}

// English voice change handler
document.getElementById('englishVoice')?.addEventListener('change', async (e) => {
  selectedEnglishVoice = e.target.value || 'auto';
  chrome.storage.local.set({ selectedEnglishVoice });
  // Also set as the preferred voice for TTS
  const voiceURI = selectedEnglishVoice === 'auto' ? null : selectedEnglishVoice;
  selectedVoiceURI = voiceURI;
  chrome.storage.local.set({ voiceURI: voiceURI });
  try { await sendMessageToTab('setPreferredVoice', { voiceURI }); } catch {}
  const voiceName = selectedEnglishVoice === 'auto' ? 'Auto' : e.target.options[e.target.selectedIndex]?.textContent || selectedEnglishVoice;
  updateStatus('Voice: ' + voiceName);
});

// Preview voice button
document.getElementById('previewVoiceBtn')?.addEventListener('click', async () => {
  try {
    const voiceURI = selectedEnglishVoice === 'auto' ? (await pickVoiceForStart()) : selectedEnglishVoice;
    if (!voiceURI) { updateStatus('No voice selected.'); return; }
    await sendMessageToTab('previewVoice', { voiceURI, rate: ttsRate, pitch: ttsPitch });
    updateStatus('Previewing voice...');
  } catch (e) {
    console.debug('Preview failed:', e?.message || e);
    updateStatus('Preview failed. Open a webpage first.');
  }
});

// Refresh voices button
document.getElementById('refreshVoices')?.addEventListener('click', async () => {
  updateStatus('Refreshing voices...');
  // Clear cache to force fresh fetch
  chrome.storage.local.remove(['cachedVoices', 'cachedVoicesTs']);
  voiceListCache = [];
  try {
    await loadAndPopulateVoices();
    _populateEnglishVoices();
    updateStatus('Voices refreshed: ' + voiceListCache.length + ' found.');
  } catch (e) {
    updateStatus('Failed to refresh voices.');
  }
});

// ---------- Gemini API Key ----------
document.getElementById('geminiApiKey')?.addEventListener('change', (e) => {
  const key = (e.target.value || '').trim();
  chrome.storage.local.set({ geminiApiKey: key });
  // Also push to content script immediately
  try { sendMessageToTab('setGeminiApiKey', { geminiApiKey: key }); } catch {}
  updateStatus(key ? 'Gemini API key saved. Will use Gemini for translation.' : 'Gemini key cleared. Using Google Translate (free).');
});

// ---------- Google Cloud TTS Controls ----------

function _updateCloudTtsUI() {
  const engineEl = document.getElementById('voiceEngine');
  const controlsEl = document.getElementById('cloudVoiceControls');
  const voiceEl = document.getElementById('cloudVoice');
  const keyEl = document.getElementById('cloudTtsApiKey');
  if (engineEl) engineEl.value = cloudTtsEnabled ? 'cloud' : 'browser';
  if (controlsEl) controlsEl.style.display = cloudTtsEnabled ? 'block' : 'none';
  if (voiceEl) voiceEl.value = cloudTtsVoice;
  if (keyEl && cloudTtsApiKey) keyEl.value = cloudTtsApiKey;
}

document.getElementById('voiceEngine')?.addEventListener('change', async (e) => {
  const isCloud = e.target.value === 'cloud';
  cloudTtsEnabled = isCloud;
  chrome.storage.local.set({ cloudTtsEnabled });
  _updateCloudTtsUI();
  // Push to content script
  try {
    await sendMessageToTab('setCloudTts', {
      enabled: cloudTtsEnabled,
      apiKey: cloudTtsApiKey,
      voice: cloudTtsVoice
    });
  } catch (err) { console.debug('setCloudTts failed:', err); }
  updateStatus(isCloud ? 'Google Cloud Neural voice enabled (premium).' : 'Browser TTS (free) selected.');
});

document.getElementById('cloudVoice')?.addEventListener('change', async (e) => {
  cloudTtsVoice = e.target.value || 'en-US-Neural2-J';
  chrome.storage.local.set({ cloudTtsVoice });
  try {
    await sendMessageToTab('setCloudTts', {
      enabled: cloudTtsEnabled,
      apiKey: cloudTtsApiKey,
      voice: cloudTtsVoice
    });
  } catch {}
});

document.getElementById('cloudTtsApiKey')?.addEventListener('change', async (e) => {
  cloudTtsApiKey = (e.target.value || '').trim();
  chrome.storage.local.set({ cloudTtsApiKey });
  try {
    await sendMessageToTab('setCloudTts', {
      enabled: cloudTtsEnabled,
      apiKey: cloudTtsApiKey,
      voice: cloudTtsVoice
    });
  } catch {}
  updateStatus(cloudTtsApiKey ? 'Cloud TTS API key saved.' : 'Cloud TTS key cleared.');
});

document.getElementById('previewCloudVoice')?.addEventListener('click', async () => {
  if (!cloudTtsApiKey) {
    updateStatus('Enter a Google Cloud API key first.');
    return;
  }
  try {
    await sendMessageToTab('previewCloudVoice', {
      apiKey: cloudTtsApiKey,
      voice: cloudTtsVoice
    });
    updateStatus('Playing Cloud Neural voice preview...');
  } catch (e) {
    console.debug('Cloud preview failed:', e);
    updateStatus('Cloud voice preview failed. Check your API key.');
  }
});

// Enable/disable buttons based on the current state
function toggleControls(action) {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const forwardButton = document.getElementById('forward');

  if (action === 'start') {
    startButton.disabled = true;
    stopButton.disabled = false;
    forwardButton.disabled = false;
  } else if (action === 'stop') {
    startButton.disabled = false;
    stopButton.disabled = true;
    forwardButton.disabled = true;
  }
}
