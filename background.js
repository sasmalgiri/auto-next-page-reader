// Background service worker to keep auto-reading across navigations
// Maintains per-tab sessions and injects scripts on subsequent pages.

const activeSessions = new Map(); // tabId -> { originPattern, mode }
const SESSIONS_KEY = 'anpr:sessions:v1';

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

async function saveSessions() {
  try {
    const obj = {};
    for (const [tid, sess] of activeSessions.entries()) obj[tid] = sess;
    await chrome.storage?.local.set?.({ [SESSIONS_KEY]: obj });
  } catch {}
}

async function loadSessions() {
  try {
    const d = await chrome.storage?.local.get?.([SESSIONS_KEY]);
    const obj = (d && d[SESSIONS_KEY]) || {};
    activeSessions.clear();
    for (const k of Object.keys(obj)) {
      const tid = Number(k);
      if (!Number.isNaN(tid) && obj[k] && obj[k].originPattern) {
        activeSessions.set(tid, { originPattern: obj[k].originPattern, mode: obj[k].mode || 'chapter' });
      }
    }
  } catch {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    // --- chrome.tts speech routing (no user gesture needed) ---
    if (msg && msg.type === 'anprTtsSpeak') {
      const tabId = sender?.tab?.id;
      if (typeof tabId !== 'number') { sendResponse({ ok: false }); return true; }
      try { chrome.tts.stop(); } catch {}
      const opts = {
        lang: msg.lang || 'hi-IN',
        rate: typeof msg.rate === 'number' ? msg.rate : 0.8,
        pitch: typeof msg.pitch === 'number' ? msg.pitch : 1.0,
        volume: typeof msg.volume === 'number' ? msg.volume : 1.0,
        enqueue: false,
        onEvent: (event) => {
          try {
            chrome.tabs.sendMessage(tabId, {
              type: 'anprTtsEvent',
              eventType: event.type,
              charIndex: event.charIndex || 0,
              errorMessage: event.errorMessage || null
            });
          } catch {}
        }
      };
      // For Hindi: ALWAYS let background pick the voice — ignore any voiceName from content script
      const isHindiLang = (opts.lang || '').toLowerCase().startsWith('hi');
      if (!isHindiLang && msg.voiceName) opts.voiceName = msg.voiceName;

      const doSpeak = (finalOpts) => {
        console.log('[ANPR BG] doSpeak called with voiceName:', finalOpts.voiceName, 'lang:', finalOpts.lang);
        try {
          chrome.tts.speak(msg.text || '', finalOpts, () => {
            if (chrome.runtime.lastError) {
              console.warn('[ANPR BG] TTS error:', chrome.runtime.lastError.message);
              try {
                chrome.tabs.sendMessage(tabId, {
                  type: 'anprTtsEvent', eventType: 'error',
                  errorMessage: chrome.runtime.lastError.message
                });
              } catch {}
            }
          });
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      };

      if (isHindiLang) {
        // ALWAYS select Hindi voice for Hindi content — search ALL voices for Madhur/Swara
        const gender = msg.gender || 'male';
        chrome.tts.getVoices((voices) => {
          const allVoices = voices || [];
          console.log('[ANPR BG] === ALL AVAILABLE VOICES (' + allVoices.length + ') ===');
          allVoices.forEach((v, i) => {
            console.log(`[ANPR BG] Voice[${i}]: name="${v.voiceName}" lang="${v.lang}" remote=${v.remote}`);
          });

          // Step 1: Search ALL voices for "madhur" or "swara" by name (regardless of lang)
          const preferredName = gender === 'male' ? 'madhur' : 'swara';
          const exactMatch = allVoices.find(v => (v.voiceName || '').toLowerCase().includes(preferredName));
          if (exactMatch) {
            opts.voiceName = exactMatch.voiceName;
            console.log('[ANPR BG] Found preferred voice by name:', opts.voiceName);
            _notifyVoiceSelected(tabId, opts.voiceName, true);
            doSpeak(opts);
            return;
          }

          // Step 2: Search Hindi-filtered voices with gender scoring
          const hindiVoices = allVoices.filter(v => {
            const lang = (v.lang || '').toLowerCase().replace('_', '-');
            return lang.startsWith('hi') || lang === 'hi-in';
          });
          console.log('[ANPR BG] Hindi voices found:', hindiVoices.length, hindiVoices.map(v => v.voiceName));

          if (hindiVoices.length > 0) {
            const scored = hindiVoices.map(v => {
              let score = 0;
              const name = (v.voiceName || '').toLowerCase();
              const isFemale = /swara|female|woman|neerja|sapna/i.test(name);
              const isMale = /madhur|male|man|hemant|kalpesh/i.test(name);
              if (gender === 'male') {
                if (isMale) score += 15;
                else if (isFemale) score -= 10;
              } else {
                if (isFemale) score += 15;
                else if (isMale) score -= 10;
              }
              if (/natural|neural|premium/i.test(name)) score += 5;
              return { voice: v, score };
            });
            scored.sort((a, b) => b.score - a.score);
            if (scored[0]) {
              opts.voiceName = scored[0].voice.voiceName;
              console.log('[ANPR BG] Hindi voice by scoring:', opts.voiceName, 'score:', scored[0].score);
            }
            // Check if Madhur was NOT found — notify user
            const hasMadhur = allVoices.some(v => (v.voiceName || '').toLowerCase().includes('madhur'));
            _notifyVoiceSelected(tabId, opts.voiceName, hasMadhur);
            doSpeak(opts);
            return;
          }

          // Step 3: No Hindi voices at all — use whatever is available
          console.warn('[ANPR BG] No Hindi voices found in chrome.tts!');
          _notifyVoiceSelected(tabId, null, false);
          doSpeak(opts);
        });
      } else {
        doSpeak(opts);
      }
      return true;
    }
    if (msg && msg.type === 'anprTtsStop') {
      try { chrome.tts.stop(); } catch {}
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === 'anprTtsGetVoices') {
      chrome.tts.getVoices((voices) => { sendResponse({ voices: voices || [] }); });
      return true;
    }

    // --- Google Cloud TTS synthesis (premium neural voices) ---
    if (msg && msg.type === 'anprCloudTtsSynthesize') {
      const { text, lang, voiceName, apiKey, rate, pitch } = msg;
      if (!apiKey || !text) { sendResponse({ ok: false, error: 'missing_params' }); return true; }
      (async () => {
        try {
          const ac = new AbortController();
          const tid = setTimeout(() => ac.abort(), 20000);
          const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ac.signal,
            body: JSON.stringify({
              input: { text },
              voice: { languageCode: lang || 'hi-IN', name: voiceName || 'hi-IN-Neural2-B' },
              audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: typeof rate === 'number' ? rate : 1.0,
                pitch: typeof pitch === 'number' ? pitch : 0,
                volumeGainDb: 0
              }
            })
          });
          clearTimeout(tid);
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            console.warn('[ANPR BG] Cloud TTS error:', resp.status, errText.slice(0, 200));
            sendResponse({ ok: false, error: `API ${resp.status}` });
            return;
          }
          const data = await resp.json();
          if (data && data.audioContent) {
            sendResponse({ ok: true, audioContent: data.audioContent });
          } else {
            sendResponse({ ok: false, error: 'no_audio_content' });
          }
        } catch (e) {
          console.warn('[ANPR BG] Cloud TTS fetch error:', e);
          sendResponse({ ok: false, error: String(e) });
        }
      })();
      return true;
    }

    if (msg && msg.type === 'anprHandshake') {
      // Provide tabId back to content script for session registration
      if (sender && typeof sender.tab?.id === 'number') {
        sendResponse && sendResponse({ ok: true, tabId: sender.tab.id });
      } else {
        sendResponse && sendResponse({ ok: false });
      }
      return true;
    }
    if (msg && msg.type === 'startAutoSession') {
      const { tabId, originPattern, mode } = msg;
      if (typeof tabId === 'number' && originPattern) {
        activeSessions.set(tabId, { originPattern, mode: mode || 'chapter' });
        saveSessions();
        sendResponse && sendResponse({ ok: true });
      } else {
        sendResponse && sendResponse({ ok: false, error: 'invalid_args' });
      }
      return true;
    }
    if (msg && msg.type === 'stopAutoSession') {
      const { tabId } = msg;
      if (typeof tabId === 'number') {
        activeSessions.delete(tabId);
        saveSessions();
        sendResponse && sendResponse({ ok: true });
      } else {
        sendResponse && sendResponse({ ok: false, error: 'invalid_args' });
      }
      return true;
    }
  } catch (e) {
    console.warn('background.onMessage error:', e);
  }
});

// Notify content script which voice was selected (for UI feedback)
function _notifyVoiceSelected(tabId, voiceName, madhurAvailable) {
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'anprVoiceInfo',
      voiceName: voiceName || 'default',
      madhurAvailable: !!madhurAvailable
    });
  } catch {}
}

// Helper to check if a URL matches an origin pattern like https://example.com/*
function urlMatchesOrigin(url, originPattern) {
  try {
    const u = new URL(url);
    const origin = new URL(originPattern.replace('/*', '/'));
    return u.protocol === origin.protocol && u.hostname.endsWith(origin.hostname);
  } catch {
    return false;
  }
}

// On navigation complete: if the tab is in a session and URL matches, inject and auto-start
chrome.webNavigation.onCompleted.addListener(async (details) => {
  try {
    const { tabId, url, frameId } = details;
    // Only act + log for main frame to avoid noise from ad/analytics iframes
    if (frameId !== 0) return;
    // Host ignore list: skip known ad / tracking / analytics domains entirely
    const IGNORE_HOSTS = [
      'doubleclick.net','googlesyndication.com','google-analytics.com','googletagmanager.com','adnxs.com','ads.pubmatic.com',
      'rubiconproject.com','criteo.com','taboola.com','outbrain.com','advertising.com','moatads.com','infolinks.com','revcontent.com',
      'adkernel.com','scorecardresearch.com','quantserve.com','yieldlove.com','openx.net','bidswitch.net','medialytics.com'
    ];
    try {
      const h = new URL(url).hostname.replace(/^www\./,'').toLowerCase();
      if (IGNORE_HOSTS.some(dom => h === dom || h.endsWith('.'+dom))) {
        return; // silently ignore navigation on these hosts
      }
    } catch {}
    console.debug(`[ANPR BG] main-frame navigation: tabId=${tabId}, url=${url}`);
    let session = activeSessions.get(tabId);
    if (!session) {
      await loadSessions();
      session = activeSessions.get(tabId);
    }
    if (!session) {
      console.debug('[ANPR BG] No active session for this tab after reload.');
      return;
    }
    if (!urlMatchesOrigin(url, session.originPattern)) {
      console.debug('[ANPR BG] URL does not match session origin. Ending session.');
      activeSessions.delete(tabId);
      return;
    }

    console.log('[ANPR BG] Active session found, injecting scripts...');
    // Try to inject readability + content, then kick off reading if auto-read is enabled in content
    try {
      for (const file of CONTENT_SCRIPTS) {
        await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
      }
      console.log('[ANPR BG] Scripts injected successfully.');
    } catch (e) {
      console.warn('[ANPR BG] Injection after navigation failed:', e && e.message ? e.message : e);
      return;
    }

    // Ask content to start speech (it will honor stored settings and auto-read toggle)
    // Wait a bit to ensure content script is fully loaded
    setTimeout(async () => {
      try {
        console.log('[ANPR BG] Sending startSpeech message to content script.');
        // Get stored TTS settings to pass along
        const settings = await chrome.storage.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang', 'voiceURI']);
        await chrome.tabs.sendMessage(tabId, { 
          action: 'startSpeech',
          rate: settings.ttsRate || 0.8,
          pitch: settings.ttsPitch || 1.0,
          autoLang: settings.ttsAutoLang !== false,
          voiceURI: settings.voiceURI || null
        });
        console.log('[ANPR BG] startSpeech message sent successfully.');
      } catch (e) {
        console.warn('[ANPR BG] First attempt to send startSpeech failed, retrying shortly.', e);
        // Content may not be ready yet; retry once more
        setTimeout(() => {
          console.log('[ANPR BG] Retrying startSpeech message.');
          chrome.storage.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang', 'voiceURI'], (settings) => {
            chrome.tabs.sendMessage(tabId, { 
              action: 'startSpeech',
              rate: settings.ttsRate || 0.8,
              pitch: settings.ttsPitch || 1.0,
              autoLang: settings.ttsAutoLang !== false,
              voiceURI: settings.voiceURI || null
            }).catch((err) => {
              console.error('[ANPR BG] Retry of startSpeech also failed.', err);
            });
          });
        }, 1000); // Increased retry delay
      }
    }, 500); // Initial delay before first attempt
  } catch (e) {
    console.error('[ANPR BG] onCompleted handler error:', e);
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeSessions.delete(tabId);
  saveSessions();
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info && info.status === 'loading' && activeSessions.has(tabId)) {
    // Keep the session record; no-op.
  }
});

chrome.runtime.onStartup?.addListener(() => {
  loadSessions();
  // Diagnostic: log all available TTS voices on startup
  try {
    chrome.tts.getVoices((voices) => {
      console.log('[ANPR BG] === STARTUP: ALL TTS VOICES ===');
      (voices || []).forEach((v, i) => {
        console.log(`[ANPR BG] Voice[${i}]: name="${v.voiceName}" lang="${v.lang}" remote=${v.remote}`);
      });
      const hindiVoices = (voices || []).filter(v => (v.voiceName || '').toLowerCase().includes('hindi') || (v.lang || '').toLowerCase().startsWith('hi'));
      console.log('[ANPR BG] Hindi voices:', hindiVoices.map(v => v.voiceName));
      const madhur = (voices || []).find(v => (v.voiceName || '').toLowerCase().includes('madhur'));
      console.log('[ANPR BG] Madhur voice:', madhur ? madhur.voiceName : 'NOT FOUND');
    });
  } catch {}
});
chrome.runtime.onInstalled?.addListener(() => {
  loadSessions();
  try {
    chrome.tts.getVoices((voices) => {
      console.log('[ANPR BG] === INSTALLED: ALL TTS VOICES ===');
      (voices || []).forEach((v, i) => {
        console.log(`[ANPR BG] Voice[${i}]: name="${v.voiceName}" lang="${v.lang}" remote=${v.remote}`);
      });
      const madhur = (voices || []).find(v => (v.voiceName || '').toLowerCase().includes('madhur'));
      console.log('[ANPR BG] Madhur voice:', madhur ? madhur.voiceName : 'NOT FOUND');
    });
  } catch {}
});
