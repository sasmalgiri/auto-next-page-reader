// =====================================================================
// content-main.js — Initialization, message handling, auto-start logic,
// SPA hooks, event listeners, and the public API.
// Loaded LAST. Depends on all other content-*.js modules.
// =====================================================================

// Automatically start reading and attempting to go to the next chapter when loaded
function autoStartReadingOnNextChapter() {
  const handleAutoStart = (event) => {
    console.debug(`[ANPR] handleAutoStart triggered by '${event.type}' event.`);
    let shouldAutoStart = false;
    try {
      const flag = sessionStorage.getItem('autostart_reader');
      console.debug('[ANPR] Checked sessionStorage for autostart_reader flag:', flag);
      shouldAutoStart = flag === '1';
    } catch (e) {
      console.error('[ANPR] Error reading sessionStorage:', e);
    }

    if (shouldAutoStart) {
      console.log('[ANPR] Autostart flag found, starting reader...');
      try { sessionStorage.removeItem('autostart_reader'); } catch {}
      setTimeout(() => {
        const kickoff = async () => {
          console.log('[ANPR] Kickoff: Waiting for content...');
          if (__ANPR_MODE__ === 'infinite') {
            const t = await waitForReadableContent(3500);
            if (t) {
              console.log('[ANPR] Content found, starting infinite mode speech...');
              startSpeech(t);
            } else {
              console.warn('[ANPR] No content found for infinite mode. Starting retry loop.');
              startAutoStartRetryLoop('flag-infinite');
            }
          } else {
            console.log('[ANPR] Starting chapter reader...');
            startChapterReader({ rate: ttsRate, pitch: ttsPitch });
          }
        };
        kickoff();
      }, 800);
      return;
    }

    // Hindi-only: Do NOT auto-start without autostart_reader flag.
    // First reading must come from user clicking "Start Reading" (user gesture required
    // for speech synthesis, and translation needs time before speaking).
    console.log('[ANPR] No autostart flag. Waiting for user to click Start Reading.');
  };

  window.addEventListener('load', handleAutoStart);
  window.addEventListener('pageshow', handleAutoStart);
}

// Automatically start the auto next chapter and auto-read process (guarded)
if (window.__AutoNextReaderInitialized) {
  autoStartReadingOnNextChapter();
}

// Watchdog: with chrome.tts routing, no need for speechSynthesis.resume() — chrome.tts handles it
if (!window.__ANPR_ResumeWatchdog) {
  window.__ANPR_ResumeWatchdog = true; // keep flag to prevent re-init
}

// Retry loop: if autostart flag or autoReadEnabled is set but content wasn't ready, retry a few times
function startAutoStartRetryLoop(reason='retry') {
  try {
    if (window.__ANPR_AutoStartLoop) return;
    let attempts = 0; const maxAttempts = 14;
    window.__ANPR_AutoStartLoop = setInterval(async () => {
      attempts++;
      if (isReading || __anprSpeechState.reading) { clearInterval(window.__ANPR_AutoStartLoop); window.__ANPR_AutoStartLoop = null; return; }
      let shouldAuto = false;
      try { shouldAuto = sessionStorage.getItem('autostart_reader') === '1'; } catch {}
      if (!shouldAuto) { clearInterval(window.__ANPR_AutoStartLoop); window.__ANPR_AutoStartLoop = null; return; }
      if (shouldAuto) { try { sessionStorage.removeItem('autostart_reader'); } catch {} }
      const txt = await waitForReadableContent(1200);
      if (txt && txt.length > 200) {
        startSpeech(txt);
        clearInterval(window.__ANPR_AutoStartLoop);
        window.__ANPR_AutoStartLoop = null;
        return;
      }
      if (attempts >= maxAttempts) { clearInterval(window.__ANPR_AutoStartLoop); window.__ANPR_AutoStartLoop = null; }
    }, 500);
  } catch {}
}

// Hook SPA (history API) URL changes to auto-resume reading on same-page navigations
try {
  (function hookSPAUrlChanges() {
    if (window.__ANPR_SPALinkHooked) return; window.__ANPR_SPALinkHooked = true;
    const dispatch = () => {
      const ev = new Event('anpr:locationchange');
      window.dispatchEvent(ev);
    };
    const origPush = history.pushState; const origReplace = history.replaceState;
    history.pushState = function() { const ret = origPush.apply(this, arguments); try { setTimeout(dispatch, 0); } catch {} return ret; };
    history.replaceState = function() { const ret = origReplace.apply(this, arguments); try { setTimeout(dispatch, 0); } catch {} return ret; };
    window.addEventListener('popstate', () => { try { dispatch(); } catch {} });

    const onUrlChange = () => {
      console.debug('[ANPR] SPA URL change detected.');
      try { __anprAdvanceLock = false; } catch {}
      let shouldAutoStart = false;
      try {
        const flag = sessionStorage.getItem('autostart_reader');
        console.debug('[ANPR] SPA: Checked sessionStorage for autostart_reader flag:', flag);
        shouldAutoStart = flag === '1';
      } catch (e) {
        console.error('[ANPR] SPA: Error reading sessionStorage:', e);
      }
      if (!shouldAutoStart) {
        console.debug('[ANPR] SPA: No autostart flag. Hindi-only requires explicit start or auto-next.');
        return;
      }
      if (shouldAutoStart) { try { sessionStorage.removeItem('autostart_reader'); } catch {} }
      setTimeout(async () => {
        console.log('[ANPR] SPA: Starting reader after URL change.');
        try { anprInstrumentedCancel('spa-url-change'); } catch {}
        if (__ANPR_MODE__ === 'infinite') {
          __anprParaIndex = 0; __anprLastTextLen = 0; __anprAppendNudged = false;
          const t = await waitForReadableContent(3500);
          if (t) startSpeech(t);
        } else {
          startChapterReader({ rate: ttsRate, pitch: ttsPitch });
        }
      }, 350);
    };
    window.addEventListener('anpr:locationchange', onUrlChange);
  })();
} catch {}

// React to storage changes for live toggling of presets/prosody
try {
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes && 'naturalPreset' in changes) {
      __anprNaturalPreset = !!(changes.naturalPreset?.newValue);
    }
    if (changes && 'dynamicProsody' in changes) {
      __anprDynamicProsody = !!(changes.dynamicProsody?.newValue);
    }
    if (changes && 'preferNaturalVoices' in changes) {
      __anprPreferNatural = !!(changes.preferNaturalVoices?.newValue);
    }
    if (changes && 'translateEnabled' in changes) {
      __anprTranslateEnabled = !!(changes.translateEnabled?.newValue);
    }
    if (changes && 'hindiVoiceGender' in changes) {
      __anprHindiVoiceGender = changes.hindiVoiceGender?.newValue || 'female';
    }
    if (changes && 'premiumActive' in changes) {
      __anprPremiumActive = !!(changes.premiumActive?.newValue);
    }
  });
} catch {}

// Robust fallback auto-start scheduler — Hindi-only: only fires with autostart_reader flag
// (i.e. after auto-next navigation). First reading requires user gesture (Start Reading button).
try {
  (function autoStartFallbackLoop() {
    if (window.__ANPR_FallbackStarted) return; window.__ANPR_FallbackStarted = true;
    const t0 = Date.now();
    const interval = setInterval(async () => {
      if (userStoppedReading) { clearInterval(interval); return; }
      const age = Date.now() - t0;
      let flag = false;
      try { flag = sessionStorage.getItem('autostart_reader') === '1'; } catch {}
      if (!flag) {
        if (age > 10000) clearInterval(interval);
        return;
      }
      if (__anprSpeechState.reading || isReading) { clearInterval(interval); return; }
      const txt = await waitForReadableContent(2500);
      if (txt && txt.length > 200) {
        try { sessionStorage.removeItem('autostart_reader'); } catch {}
        console.log('[ANPR] Fallback auto-start engaging (auto-next chapter)…');
        startSpeech(txt);
        clearInterval(interval);
      } else if (age > 10000) {
        clearInterval(interval);
      }
    }, 800);
  })();
} catch {}

// Resume playback if tab becomes visible again and speech synthesis paused/stopped unexpectedly
try {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!__anprSpeechState.reading && isReading && !userStoppedReading) {
        console.log('[ANPR] Visibility change: attempting speech recovery…');
        startChapterReader({ rate: ttsRate, pitch: ttsPitch });
      }
    }
  });
} catch {}

// Keyboard shortcut to stop and resume reading with Ctrl + `
if (!window.__AutoNextReaderKeydownBound) {
  window.__AutoNextReaderKeydownBound = true;
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === '`') {
      if (isReading) {
        stopSpeech();
      } else if (!isReading && remainingText) {
        startSpeech(remainingText);
        anprStartFlowWatchdog();
      }
    }
    // Show/hide on-page control overlay: Ctrl+Shift+O
    if (event.ctrlKey && event.shiftKey && (event.key === 'O' || event.key === 'o')) {
      toggleOverlay();
    }
  });
}

// With chrome.tts routing, voiceschanged is less relevant, but keep autostart logic
try {
  if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      try {
        if (__ANPR_MODE__ === 'chapter' && !__anprSpeechState.reading) {
          if (sessionStorage.getItem('autostart_reader') === '1') {
            sessionStorage.removeItem('autostart_reader');
            startChapterReader({ rate: ttsRate, pitch: ttsPitch });
          }
        }
      } catch {}
    });
  }
} catch {}

// Expose lightweight test controls
try {
  window.__reader = {
    start: () => { if (__ANPR_MODE__ === 'chapter') startChapterReader({ rate: ttsRate, pitch: ttsPitch }); else (async()=>{ const t = await waitForReadableContent(2000); if (t) startSpeech(t); })(); },
    stop: () => stopSpeech(),
    nextChunk: () => { if (__ANPR_MODE__ === 'chapter') { try { anprInstrumentedCancel('api-next-chunk'); } catch {}; __anprSpeechState.idx = Math.min(__anprSpeechState.idx + 1, __anprSpeechState.chunks.length); anprSpeakNext(); } },
    prevChunk: () => { if (__ANPR_MODE__ === 'chapter') { try { anprInstrumentedCancel('api-prev-chunk'); } catch {}; __anprSpeechState.idx = Math.max(0, __anprSpeechState.idx - 1); anprSpeakNext(); } },
  };
} catch {}

// Handle chrome.tts events from background service worker
if (!window.__ANPR_TtsEventBound) {
  window.__ANPR_TtsEventBound = true;
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'anprTtsEvent') {
      const cb = __anprCurrentTtsCallbacks;
      if (!cb) return;
      switch (message.eventType) {
        case 'start':
          if (cb.onstart) cb.onstart();
          break;
        case 'end':
          if (cb.onend) cb.onend();
          break;
        case 'error':
        case 'cancelled':
          if (cb.onerror) cb.onerror(message);
          break;
        case 'word':
        case 'sentence':
          if (cb.onboundary) cb.onboundary();
          break;
      }
    }
    // Voice selection info from background
    if (message && message.type === 'anprVoiceInfo') {
      console.log('[ANPR] Voice selected by background:', message.voiceName, 'Madhur available:', message.madhurAvailable);
      if (!message.madhurAvailable && __anprTranslateEnabled) {
        const voiceName = message.voiceName || 'default';
        const isMadhur = voiceName.toLowerCase().includes('madhur');
        if (!isMadhur) {
          console.warn('[ANPR] Madhur voice NOT available! Using:', voiceName, '— Switch to Microsoft Edge for Madhur voice, or use Cloud TTS.');
          updateStatus('Using: ' + voiceName + ' (Madhur needs Edge browser or Cloud TTS)');
        }
      }
    }
  });
}

// Handle messages from the popup
if (!window.__AutoNextReaderMsgBound) {
  window.__AutoNextReaderMsgBound = true;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === 'toggleAutoNext') {
        autoNextEnabled = message.autoNextEnabled;
        sendResponse({ autoNextEnabled });
      } else if (message.action === 'toggleAutoRead') {
        autoReadEnabled = message.autoReadEnabled;
        sendResponse({ autoReadEnabled });
      } else if (message.action === 'toggleAutoScroll') {
        autoScrollWhileReading = !!message.autoScrollWhileReading;
        try { chrome.storage?.local.set({ autoScrollWhileReading }); } catch {}
        if (isReading) {
          if (autoScrollWhileReading) startAutoScroll(); else stopAutoScroll();
        }
        sendResponse({ autoScrollWhileReading });
      } else if (message.action === 'startSpeech') {
        // No primer needed — speech is routed through chrome.tts in background
        // which does NOT require user gesture activation.
        (async () => {
          if (__ANPR_MODE__ === 'infinite') {
            const paras = collectInfiniteParagraphs();
            if (paras.length > __anprParaIndex) {
              const chunk = paras.slice(__anprParaIndex).join('\n\n').trim();
              __anprParaIndex = paras.length;
              __anprLastTextLen += chunk.length;
              saveInfiniteProgress();
              if (chunk) {
                startSpeech(chunk, message.rate, message.pitch, { lang: message.lang, voiceURI: message.voiceURI, autoLang: message.autoLang });
                return;
              }
            }
            const text2 = await waitForReadableContent(3500);
            if (text2) {
              const delta = text2.slice(__anprLastTextLen).trim();
              __anprLastTextLen = text2.length;
              const startTxt = delta || text2;
              startSpeech(startTxt, message.rate, message.pitch, { lang: message.lang, voiceURI: message.voiceURI, autoLang: message.autoLang });
            } else {
              updateStatus('No readable content found. Try scrolling or toggling Reader.');
            }
          } else {
                const text = await waitForReadableContent(3500);
                if (text) {
                  startSpeech(text, message.rate, message.pitch, { lang: message.lang, voiceURI: message.voiceURI, autoLang: message.autoLang });
                } else {
                  updateStatus('No readable content found yet. Waiting for paragraphs…');
                  startChapterReader({ rate: message.rate, pitch: message.pitch, voiceURI: message.voiceURI });
                  anprObserveContentUntilReady();
                }
          }
        })();
      } else if (message.action === 'skipForward') {
        skipForward();
      } else if (message.action === 'stopSpeech') {
        stopSpeech();
      } else if (message.action === 'getVoices') {
        const buildPayload = () => {
          const vs = window.speechSynthesis.getVoices() || [];
          const genderOf = (name='') => {
            const n = String(name).toLowerCase();
            if (/\b(female|woman|girl)\b|uk english female|aria|sara|jenny|zoe|emma|samantha|victoria/.test(n)) return 'female';
            if (/\b(male|man|boy|guy)\b|uk english male|guy|daniel|george|matthew|michael|christopher|benjamin/.test(n)) return 'male';
            return 'unknown';
          };
          return vs.map(v => ({
            name: v.name,
            voiceURI: v.voiceURI,
            lang: v.lang,
            default: !!v.default,
            localService: !!v.localService,
            gender: genderOf(v.name)
          }));
        };
        const current = buildPayload();
        if (current.length > 0) {
          sendResponse({ voices: current });
        } else {
          const once = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', once);
            try { sendResponse({ voices: buildPayload() }); } catch {}
          };
          window.speechSynthesis.addEventListener('voiceschanged', once);
        }
        return true; // async
      } else if (message.action === 'previewVoice') {
        try {
          if (__anprSpeechState.reading || isReading || __anprChromeTtsSpeaking) {
            sendResponse && sendResponse({ ok: false, reason: 'busy' });
            return true;
          }
          const sample = 'This is a short voice preview.';
          chrome.runtime.sendMessage({
            type: 'anprTtsSpeak', text: sample, lang: 'en-US',
            rate: typeof message.rate === 'number' ? message.rate : (ttsRate || 0.9),
            pitch: typeof message.pitch === 'number' ? message.pitch : (ttsPitch || 1.0),
            volume: 1.0
          });
          sendResponse && sendResponse({ ok: true });
          return true;
        } catch (e) {
          try { sendResponse && sendResponse({ ok: false }); } catch {}
          return true;
        }
      } else if (message.action === 'setPreferredVoice') {
        if (typeof message.voiceURI === 'string') {
          preferredVoiceURI = message.voiceURI;
          try { chrome.storage?.local.set({ voiceURI: preferredVoiceURI }); } catch {}
        }
        sendResponse && sendResponse({ ok: true });
      } else if (message.action === 'fastStart') {
        (async () => {
          try {
            if (__anprSpeechState.reading || isReading) { sendResponse && sendResponse({ ok:false, reason:'already-reading' }); return; }
            __anprSpeechState.cancel = false; __anprSpeechState.reading = true; isReading = true;
            __anprSpeechState.rate = ttsRate; __anprSpeechState.pitch = ttsPitch; __anprSpeechState.voice = null;
            __anprSpeechState.container = anprPickContentContainer();
            const paras = anprCollectParagraphsForCurrentSite(__anprSpeechState.container);
            if (!paras.length) {
              const raw = extractMainContent();
              const parts = raw ? raw.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean) : [];
              paras.push(...parts);
            }
            if (!paras.length) { sendResponse && sendResponse({ ok:false, reason:'no-content' }); updateStatus('No content yet…'); return; }
            const head = paras.slice(0, Math.min(2, paras.length));
            __anprPendingChunks = paras.slice(head.length);
            __anprProgressive = __anprPendingChunks.length > 0;
            __anprSpeechState.chunks = head;
            __anprSpeechState.idx = 0;
            __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances = 0; __anprErrorRecoveryAttempts = 0;
            setTimeout(anprSpeakNext, 0);
            sendResponse && sendResponse({ ok:true, progressive: __anprProgressive, initialChunks: head.length });
          } catch (e) {
            console.debug('[ANPR] fastStart error:', e); sendResponse && sendResponse({ ok:false, error:String(e) });
          }
        })();
        return true; // async response
      } else if (message.action === 'upgradeVoice') {
        if (typeof message.voiceURI === 'string' && message.voiceURI) {
          __anprPendingVoiceURI = message.voiceURI;
          sendResponse && sendResponse({ ok:true });
        } else { sendResponse && sendResponse({ ok:false }); }
      } else if (message.action === 'toggleTranslate') {
        __anprTranslateEnabled = !!message.translateEnabled;
        try { chrome.storage?.local.set({ translateEnabled: __anprTranslateEnabled }); } catch {}
        if (!__anprTranslateEnabled) { try { anprClearTranslateCache(); } catch {} }
        sendResponse && sendResponse({ ok: true, translateEnabled: __anprTranslateEnabled });
      } else if (message.action === 'setGeminiApiKey') {
        if (typeof __anprGeminiApiKey !== 'undefined') {
          __anprGeminiApiKey = (message.geminiApiKey || '').trim() || null;
        }
        sendResponse && sendResponse({ ok: true });
      } else if (message.action === 'setHindiVoiceGender') {
        __anprHindiVoiceGender = message.hindiVoiceGender || 'female';
        try { chrome.storage?.local.set({ hindiVoiceGender: __anprHindiVoiceGender }); } catch {}
        try { if (typeof anprResetHindiVoiceCache === 'function') anprResetHindiVoiceCache(); } catch {}
        sendResponse && sendResponse({ ok: true });
      } else if (message.action === 'previewHindiVoice') {
        try {
          if (__anprSpeechState.reading || isReading || __anprChromeTtsSpeaking) {
            sendResponse && sendResponse({ ok: false, reason: 'busy' });
            return true;
          }
          const sample = '\u092F\u0939 \u090F\u0915 \u0939\u093F\u0902\u0926\u0940 \u0906\u0935\u093E\u091C\u093C \u0915\u093E \u0928\u092E\u0942\u0928\u093E \u0939\u0948\u0964';
          const gender = message.hindiVoiceGender || __anprHindiVoiceGender || 'male';
          chrome.runtime.sendMessage({
            type: 'anprTtsSpeak', text: sample, lang: 'hi-IN',
            rate: ttsRate || 0.9, pitch: ttsPitch || 1.0, volume: 1.0,
            gender: gender
          });
          sendResponse && sendResponse({ ok: true });
          return true;
        } catch (e) {
          sendResponse && sendResponse({ ok: false });
          return true;
        }
      } else if (message.action === 'setCloudTts') {
        // Enable/disable Google Cloud TTS and set API key + voice
        if (typeof message.enabled === 'boolean') __anprCloudTtsEnabled = message.enabled;
        if (typeof message.apiKey === 'string') __anprCloudTtsApiKey = message.apiKey || null;
        if (typeof message.voice === 'string' && message.voice) __anprCloudTtsVoice = message.voice;
        try {
          chrome.storage?.local.set({
            cloudTtsEnabled: __anprCloudTtsEnabled,
            cloudTtsApiKey: __anprCloudTtsApiKey || '',
            cloudTtsVoice: __anprCloudTtsVoice
          });
        } catch {}
        sendResponse && sendResponse({ ok: true, cloudTtsEnabled: __anprCloudTtsEnabled });
      } else if (message.action === 'previewCloudVoice') {
        try {
          if (__anprSpeechState.reading || isReading || __anprChromeTtsSpeaking) {
            sendResponse && sendResponse({ ok: false, reason: 'busy' });
            return true;
          }
          const sample = '\u092F\u0939 \u0917\u0942\u0917\u0932 \u0915\u094D\u0932\u093E\u0909\u0921 \u0928\u094D\u092F\u0942\u0930\u0932 \u0935\u0949\u0907\u0938 \u0915\u093E \u0928\u092E\u0942\u0928\u093E \u0939\u0948\u0964 \u0915\u094D\u092F\u093E \u0906\u092A\u0915\u094B \u092F\u0939 \u0906\u0935\u093E\u091C\u093C \u092A\u0938\u0902\u0926 \u0906\u0908?';
          const apiKey = message.apiKey || __anprCloudTtsApiKey;
          const voice = message.voice || __anprCloudTtsVoice || 'hi-IN-Neural2-B';
          if (!apiKey) {
            sendResponse && sendResponse({ ok: false, reason: 'no_api_key' });
            return true;
          }
          // Use Cloud TTS via background for preview
          __anprChromeTtsSpeaking = true;
          chrome.runtime.sendMessage({
            type: 'anprCloudTtsSynthesize',
            text: sample, lang: 'hi-IN', voiceName: voice,
            apiKey: apiKey, rate: ttsRate || 0.9, pitch: 0
          }, (resp) => {
            __anprChromeTtsSpeaking = false;
            if (resp && resp.ok && resp.audioContent) {
              try {
                const audio = new Audio('data:audio/mp3;base64,' + resp.audioContent);
                __anprCurrentAudio = audio;
                audio.onended = () => { __anprCurrentAudio = null; };
                audio.play().catch(() => { __anprCurrentAudio = null; });
              } catch {}
            }
          });
          sendResponse && sendResponse({ ok: true });
          return true;
        } catch (e) {
          sendResponse && sendResponse({ ok: false });
          return true;
        }
      }
    } catch (error) {
      console.error("Error while handling message:", error);
    }
  });
}
