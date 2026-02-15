// =====================================================================
// content-tts.js — Text-to-Speech engine: chunking, prosody tuning,
// speech synthesis, flow watchdog, error recovery, auto-scroll, and
// infinite/chapter reading helpers.
// Depends on: content-config.js, content-extract.js
// =====================================================================

// ---------- Chunking & prosody ----------

function anprPickVoice() {
  // Simplified: return null to let browser use its default voice.
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (__anprDebugLogging) {
      try { console.debug('[ANPR][Voices] Available voices:', voices.map(v=>({uri:v.voiceURI,name:v.name,lang:v.lang,local:v.localService}))); } catch {}
    }
  } catch {}
  return null;
}

function anprSplitChunks(text, maxLen = 180) {
  const parts = (text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.?!…])\s+/);
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    if (p.length <= maxLen) out.push(p);
    else {
      for (let i = 0; i < p.length; i += maxLen) out.push(p.slice(i, i + maxLen));
    }
  }
  return out;
}

// Normalize a chunk list: split overly long, merge adjacent very short for natural flow
function anprNormalizeChunks(chunks, { maxLen = 220, minMergeLen = 50, hardSplitLen = 600 } = {}) {
  try {
    const out = [];
    for (const c of chunks) {
      const t = (c || '').trim();
      if (!t) continue;
      if (t.length > hardSplitLen) {
        const prelim = anprSplitChunks(t, maxLen);
        for (const p of prelim) {
          if (p.length > hardSplitLen) {
            for (let i = 0; i < p.length; i += maxLen) out.push(p.slice(i, i + maxLen));
          } else out.push(p);
        }
      } else if (t.length > maxLen) {
        const parts = anprSplitChunks(t, maxLen);
        out.push(...parts);
      } else {
        out.push(t);
      }
    }
    // Merge adjacent too-short pieces to reduce choppiness
    const merged = [];
    let buffer = '';
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      if (buffer) {
        const combined = buffer + ' ' + seg;
        if (combined.length <= maxLen && (buffer.length < minMergeLen || seg.length < minMergeLen)) {
          buffer = combined;
          continue;
        } else {
          merged.push(buffer);
          buffer = seg;
        }
      } else if (seg.length < minMergeLen && i + 1 < out.length) {
        buffer = seg;
      } else {
        merged.push(seg);
      }
    }
    if (buffer) merged.push(buffer);
    return merged;
  } catch (e) {
    console.debug('[ANPR] normalizeChunks failed', e);
    return chunks;
  }
}

function __anprClamp(n, min, max) {
  try { return Math.max(min, Math.min(max, n)); } catch { return n; }
}

function __anprTuneProsody(text, rate, pitch) {
  try {
    let r = typeof rate === 'number' ? rate : 0.9;
    let p = typeof pitch === 'number' ? pitch : 1.0;
    let pauseAfterMs = 0;
    const t = String(text || '').trim();
    if (__anprNaturalPreset) {
      r = __anprClamp(r, 0.9, 1.05);
      p = __anprClamp(p, 0.95, 1.15);
      pauseAfterMs = /[\.。！？!?…]$/.test(t) ? 160 : 110;
    }
    if (__anprDynamicProsody && t) {
      if (/[\?？]/.test(t)) { p += 0.05; r -= 0.02; }
      else if (/[!！]/.test(t)) { p += 0.03; r += 0.03; }
      if (/^["'"'\-–—]/.test(t) || /[""«»]/.test(t)) { r -= 0.03; p += 0.01; }
    }
    const len = t.length;
    if (len > 160) { r -= 0.05; }
    else if (len < 60) { r += 0.03; }
    r = __anprClamp(r, 0.7, 1.3);
    p = __anprClamp(p, 0.7, 2.0);
    return { rate: r, pitch: p, pauseAfterMs };
  } catch { return { rate, pitch, pauseAfterMs: 0 }; }
}

function anprSmoothScrollTo(y) {
  try { window.scrollTo({ top: Math.max(0, y - 100), behavior: 'smooth' }); }
  catch { window.scrollTo(0, Math.max(0, y - 100)); }
}

// ---------- Engine self-test & error recovery ----------

async function anprEngineSelfTest() {
  // Self-test not needed with chrome.tts routing (no user gesture issues)
  __anprDidEngineSelfTest = true;
}

function anprAttemptErrorRecovery() {
  try {
    if (__anprErrorRecoveryAttempts >= 2) return false;
    __anprErrorRecoveryAttempts++;
    console.warn('[ANPR] Attempting speech error recovery #' + __anprErrorRecoveryAttempts, {
      lastError: __anprLastErrorMeta,
      successfulUtterances: __anprSuccessfulUtterances,
      consecutiveErrors: __anprConsecutiveSpeakErrors,
      speakAttempts: __anprSpeakAttempts,
      currentIdx: (__anprSpeechState && __anprSpeechState.idx),
      totalChunks: (__anprSpeechState && __anprSpeechState.chunks && __anprSpeechState.chunks.length) || 0
    });
    const container = (__anprSpeechState && __anprSpeechState.container) || anprPickContentContainer();
    let raw = '';
    try { raw = (container && container.innerText) ? container.innerText.trim() : ''; } catch {}
    if (!raw || raw.length < 40) {
      try { raw = extractMainContent(); } catch {}
    }
    if (!raw) return false;
    const strictPrev = __anprStrictFiltering;
    try { __anprStrictFiltering = false; } catch {}
    raw = applyTextFilters(raw);
    try { __anprStrictFiltering = strictPrev; } catch {}
    const backupChunks = anprSplitChunks(raw, 180).filter(c => c && c.trim().length > 0);
    if (backupChunks.length < 3) {
      const paras = raw.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0 && p.length < 7000);
      if (paras.length > backupChunks.length) {
        backupChunks.splice(0, backupChunks.length, ...paras);
      }
    }
    if (!backupChunks.length) return false;
    __anprSpeechState.chunks = backupChunks;
    __anprSpeechState.idx = 0;
    __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances = 0;
    try { __anprSpeechState.voice = null; } catch {}
    updateStatus('Recovering speech engine…');
    setTimeout(anprSpeakNext, 120);
    return true;
  } catch (e) {
    console.warn('[ANPR] Recovery failed:', e);
    return false;
  }
}

// ---------- Content readiness observer ----------

function anprObserveContentUntilReady(timeoutMs = 12000) {
  try {
    if (window.__ANPR_ContentObserverActive) return;
    const container = anprPickContentContainer();
    let done = false; window.__ANPR_ContentObserverActive = true;
    const finish = () => { if (!done) { done = true; window.__ANPR_ContentObserverActive = false; try { obs.disconnect(); } catch {} clearInterval(tick); } };
    const obs = new MutationObserver(() => {
      try {
        const paras = anprCollectParagraphsForCurrentSite(container);
        const totalLen = Array.isArray(paras) ? paras.join('\n').length : 0;
        if (paras && (paras.length >= 2 || (paras.length >= 1 && totalLen >= 160) || ((paras[0]||'').length > 120))) {
          finish();
          startChapterReader({ rate: ttsRate, pitch: ttsPitch });
        }
      } catch {}
    });
    try { obs.observe(container || document.body, { childList: true, subtree: true, characterData: true }); } catch {}
    const t0 = Date.now();
    const tick = setInterval(() => {
      if (Date.now() - t0 > timeoutMs) { finish(); return; }
      const paras = anprCollectParagraphsForCurrentSite(container);
      const totalLen = Array.isArray(paras) ? paras.join('\n').length : 0;
      if (paras && (paras.length >= 2 || (paras.length >= 1 && totalLen >= 160) || ((paras[0]||'').length > 120))) {
        finish();
        startChapterReader({ rate: ttsRate, pitch: ttsPitch });
      }
    }, 600);
  } catch {}
}

// ---------- Core TTS speak loop ----------

function anprSpeakNext() {
  if (__anprSpeechState.cancel) return;

  // If background chrome.tts is still speaking, wait and retry
  if (__anprChromeTtsSpeaking) {
    setTimeout(anprSpeakNext, 50);
    return;
  }

  // Finished currently buffered subset
  if (__anprSpeechState.idx >= __anprSpeechState.chunks.length) {
    if (__anprProgressive && __anprPendingChunks && __anprPendingChunks.length) {
      __anprSpeechState.chunks.push(...__anprPendingChunks);
      __anprPendingChunks = [];
      __anprProgressive = false;
      setTimeout(anprSpeakNext, 0);
      return;
    }
    if (!__anprSpeechState.chunks || __anprSpeechState.chunks.length === 0) {
      console.debug('[ANPR] No chunks available yet; deferring navigate and retrying content readiness.');
      __anprAdvanceLock = false; __anprPhase = 'reading';
      startAutoStartRetryLoop('empty-chunks');
      anprObserveContentUntilReady();
      return;
    }
    maybeAutoNext();
    return;
  }

  const idx = __anprSpeechState.idx;
  const s = __anprSpeechState.chunks[idx];
  const hindiVoice = (__anprTranslateEnabled && __anprSpeechState._hindiVoice) ? __anprSpeechState._hindiVoice : null;

  // --- Translate-and-read simultaneously ---
  if (__anprTranslateEnabled && typeof anprTranslateChunk === 'function') {
    // Check if we have a pre-translated version
    const preTranslated = (typeof anprGetPreTranslated === 'function') ? anprGetPreTranslated(idx) : null;

    if (preTranslated) {
      // Already translated — speak immediately
      console.debug('[ANPR][TTS] Using pre-translated chunk', idx);
      _anprSpeakChunk(preTranslated, hindiVoice, 'hi-IN');
      // Pre-translate the next chunk while this one speaks
      if (typeof anprPreTranslateChunk === 'function') {
        anprPreTranslateChunk(idx + 1, __anprSpeechState.chunks);
        anprPreTranslateChunk(idx + 2, __anprSpeechState.chunks);
      }
    } else {
      // Not pre-translated — translate now, then speak
      updateStatus('Translating paragraph ' + (idx + 1) + '...');
      anprTranslateChunk(s).then(translated => {
        if (__anprSpeechState.cancel) return;
        console.debug('[ANPR][TTS] Translated chunk', idx, ':', (translated || '').slice(0, 60));
        updateStatus('Speaking paragraph ' + (idx + 1) + ' in Hindi...');
        _anprSpeakChunk(translated || s, hindiVoice, 'hi-IN');
        // Pre-translate upcoming chunks
        if (typeof anprPreTranslateChunk === 'function') {
          anprPreTranslateChunk(idx + 1, __anprSpeechState.chunks);
          anprPreTranslateChunk(idx + 2, __anprSpeechState.chunks);
        }
      }).catch((err) => {
        // Translation failed — speak in English
        console.warn('[ANPR][TTS] Translation failed, falling back to English:', err);
        updateStatus('Translation failed, reading English...');
        _anprSpeakChunk(s, null, null);
      });
    }
    return;
  }

  // No translation — speak English directly
  _anprSpeakChunk(s, hindiVoice, hindiVoice ? 'hi-IN' : null);
}

function _anprSpeakChunk(s, forceVoice, forceLang) {
  if (!s || (typeof s === 'string' && s.trim().length === 0)) {
    __anprSpeechState.idx++;
    setTimeout(anprSpeakNext, 0);
    return;
  }
  __anprSpeakAttempts++;
  if (__anprSpeakAttempts > __anprMaxUtterances) {
    console.warn('[ANPR] Utterance cap reached, attempting auto-next.');
    __anprSpeechState.idx = __anprSpeechState.chunks.length;
    setTimeout(maybeAutoNext, 0);
    return;
  }

  const voiceName = forceVoice ? (forceVoice.name || forceVoice.voiceName || null) : null;
  const tuned = __anprTuneProsody(s, (__anprSpeechState.rate || ttsRate || 0.8), (__anprSpeechState.pitch || ttsPitch || 1.0));

  // Store callbacks so the anprTtsEvent message listener can dispatch to them
  __anprCurrentTtsCallbacks = {
    onstart: () => {
      try {
        __anprTTSIdle = false; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances++;
        __anprLastUtteranceTs = Date.now();
        __anprLastStartTs = __anprLastUtteranceTs;
        console.debug('[ANPR][TTS] onstart', { idx: __anprSpeechState.idx, total: __anprSpeechState.chunks.length, len: (s||'').length, voice: voiceName });
      } catch {}
    },
    onboundary: () => {
      try {
        __anprLastBoundaryTs = Date.now();
        const ratio = (__anprSpeechState.idx + 1) / Math.max(1, __anprSpeechState.chunks.length);
        const rect = __anprSpeechState.container && __anprSpeechState.container.getBoundingClientRect();
        if (rect) {
          const y = window.scrollY + rect.top + ratio * rect.height;
          anprSmoothScrollTo(y);
        }
      } catch {}
    },
    onend: () => {
      __anprTTSIdle = true;
      __anprChromeTtsSpeaking = false;
      if (__anprReadingLock) { __anprReadingLock = false; return; }
      __anprSpeechState.idx++;
      __anprLastUtteranceTs = Date.now();
      console.debug('[ANPR][TTS] onend', { idx: __anprSpeechState.idx, total: __anprSpeechState.chunks.length });
      const gap = (__anprNaturalPreset || __anprDynamicProsody) ? (tuned.pauseAfterMs || 0) : 0;
      setTimeout(anprSpeakNext, gap);
    },
    onerror: (e) => {
      __anprTTSIdle = true;
      __anprChromeTtsSpeaking = false;
      if (__anprReadingLock) { __anprReadingLock = false; return; }
      __anprConsecutiveSpeakErrors++;
      const errMsg = (e && e.errorMessage) || 'unknown';
      console.warn('[ANPR][TTS] onerror', errMsg, 'chunkLen=', (s||'').length);
      __anprLastUtteranceTs = Date.now();
      __anprSpeechState.idx++;
      if (__anprConsecutiveSpeakErrors > 4 && __anprSuccessfulUtterances === 0) {
        const recovered = anprAttemptErrorRecovery();
        if (recovered) return;
        if (__anprSpeechState.idx >= __anprSpeechState.chunks.length) {
          updateStatus('Speech engine failed. Not auto-navigating.');
          __anprAdvanceLock = false; __anprSpeechState.reading = false; return;
        }
      }
      const backoff = (__anprConsecutiveSpeakErrors > 2)
        ? Math.min(1200, __anprErrorBackoffBase * Math.pow(1.6, __anprConsecutiveSpeakErrors - 2)) : 0;
      setTimeout(anprSpeakNext, backoff);
    }
  };

  // Send speech to background service worker via chrome.tts (no user gesture needed)
  __anprChromeTtsSpeaking = true;
  console.debug('[ANPR][TTS] sending to background', { idx: __anprSpeechState.idx, len: (s||'').length, voice: voiceName, lang: forceLang });
  try {
    chrome.runtime.sendMessage({
      type: 'anprTtsSpeak',
      text: s,
      lang: forceLang || 'en-US',
      rate: tuned.rate,
      pitch: tuned.pitch,
      volume: 1.0,
      voiceName: voiceName || undefined
    }, (resp) => {
      if (chrome.runtime.lastError || (resp && !resp.ok)) {
        console.warn('[ANPR][TTS] Background speak failed:', chrome.runtime.lastError?.message || resp?.error);
        __anprChromeTtsSpeaking = false;
        __anprConsecutiveSpeakErrors++;
        __anprSpeechState.idx++;
        setTimeout(anprSpeakNext, 200);
      }
    });
  } catch (e) {
    __anprChromeTtsSpeaking = false;
    __anprConsecutiveSpeakErrors++;
    __anprSpeechState.idx++;
    setTimeout(anprSpeakNext, 0);
  }
}

// ---------- Flow watchdog ----------

function anprStartFlowWatchdog() {
  try {
    if (__anprFlowWatchdog) return;
    __anprFlowWatchdog = setInterval(() => {
      try {
        if (!__anprSpeechState.reading || __anprSpeechState.cancel) return;
        const now = Date.now();
        const atEnd = __anprSpeechState.idx >= (__anprSpeechState.chunks?.length || 0);
        const engineBusy = __anprChromeTtsSpeaking;

        // With chrome.tts: if engine is busy (onstart fired), let it finish.
        // chrome.tts voices often don't fire word/boundary events, so we can't
        // use boundary progress as a stuck signal. Give up to 60s per chunk.
        if (engineBusy && __anprLastStartTs && (now - __anprLastStartTs) > 60000) {
          console.warn('[ANPR][Watchdog] Chunk speaking for >60s, forcing next.');
          anprInstrumentedCancel('watchdog-timeout-60s');
          __anprSpeechState.idx++;
          setTimeout(anprSpeakNext, 100);
          return;
        }

        // If engine is NOT busy and NOT at end and idle too long, nudge next chunk
        const idleTooLong = !engineBusy && (now - __anprLastUtteranceTs) > 5000;
        if (!engineBusy && !atEnd && idleTooLong) {
          console.debug('[ANPR][Watchdog] Flow stall (idle, not speaking); nudging.', {
            idx: __anprSpeechState.idx,
            total: __anprSpeechState.chunks.length,
            idleMs: now - __anprLastUtteranceTs
          });
          setTimeout(anprSpeakNext, 40);
        }

        if (atEnd && !engineBusy && (now - __anprLastUtteranceTs) > 5000 && __anprAdvanceLock) {
          console.debug('[ANPR][Watchdog] Releasing stale advance lock.');
          __anprAdvanceLock = false; maybeAutoNext();
        }
      } catch {}
    }, 900);
  } catch {}
}
function anprStopFlowWatchdog() { try { if (__anprFlowWatchdog) { clearInterval(__anprFlowWatchdog); __anprFlowWatchdog = null; } } catch {} }

// ---------- Chapter reader start/stop ----------

async function startChapterReader(opts = {}) {
  if (__anprAdvanceLock) { return; }
  if (__anprSpeechState.reading) {
    console.debug('[ANPR] Duplicate start ignored; already reading.');
    return;
  }
  try { anprInstrumentedCancel('chapter-start'); } catch {}
  __anprSpeechState.cancel = false;
  __anprSpeechState.reading = true;
  __anprSpeechState._hindiVoice = null; // reset Hindi voice
  anprStartFlowWatchdog();
  try { isReading = true; } catch {}
  __anprSpeechState.rate = typeof opts.rate === 'number' ? opts.rate : ttsRate;
  __anprSpeechState.pitch = typeof opts.pitch === 'number' ? opts.pitch : ttsPitch;
  try { __anprSpeechState.voice = null; } catch {}
  anprBuildFromDOM();
  __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0;
  __anprSuccessfulUtterances = 0; __anprErrorRecoveryAttempts = 0;
  // Ensure background session registered
  try {
    if (autoNextEnabled && chrome?.runtime?.id) {
      const originPattern = location.origin + '/*';
      if (__anprTabId == null) { __anprAcquireTabId(); }
      const doReg = () => {
        if (typeof __anprTabId === 'number') {
          chrome.runtime.sendMessage({ type: 'startAutoSession', tabId: __anprTabId, originPattern, mode: 'chapter' }, () => {});
        } else {
          setTimeout(doReg, 200);
        }
      };
      doReg();
    }
  } catch {}
  if (!__anprSpeechState.chunks || __anprSpeechState.chunks.length === 0) {
    try {
      const fallback = extractMainContent();
      if (fallback && fallback.trim().length > 160) {
        const parts = fallback.includes('\n\n') ? fallback.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)
                                              : anprSplitChunks(fallback, 220);
        if (parts.length) {
          __anprSpeechState.chunks = parts;
          __anprSpeechState.idx = 0;
        }
      }
    } catch {}
    if (!__anprSpeechState.chunks || __anprSpeechState.chunks.length === 0) {
      updateStatus('Waiting for readable content\u2026');
      startAutoStartRetryLoop('chapter-empty');
      anprObserveContentUntilReady();
      return;
    }
  }

  // --- Hindi: Pick voice, clear pre-translation buffer ---
  if (__anprTranslateEnabled) {
    try {
      if (typeof anprEnsureVoicesLoaded === 'function') await anprEnsureVoicesLoaded();
      const hindiVoice = (typeof anprPickHindiVoice === 'function') ? anprPickHindiVoice(__anprHindiVoiceGender) : null;
      __anprSpeechState._hindiVoice = hindiVoice;
      if (hindiVoice) console.debug('[ANPR][Hindi] Voice ready:', hindiVoice.name);
      if (typeof anprClearPreTranslated === 'function') anprClearPreTranslated();

      // Pre-translate the first 2 chunks in background while primer speaks
      if (typeof anprPreTranslateChunk === 'function') {
        anprPreTranslateChunk(0, __anprSpeechState.chunks);
        anprPreTranslateChunk(1, __anprSpeechState.chunks);
      }
    } catch (e) {
      console.debug('[ANPR][Hindi] Voice/pre-translate setup:', e);
    }
  }

  // Start the speak loop (each chunk translates inline before speaking)
  anprSpeakNext();
}

function stopChapterReader() {
  __anprSpeechState.cancel = true;
  __anprSpeechState.reading = false;
  anprStopFlowWatchdog();
  try { anprInstrumentedCancel('chapter-stop'); } catch {}
}

// ---------- Content readiness wait ----------

async function waitForReadableContent(timeoutMs = 3000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const txt = extractMainContent();
    if (txt && txt.length > 300) return txt;
    last = txt || last;
    if (!__anprDidPreloadScroll && (last || '').length < 400) {
      try { await autoScrollFor(1200); __anprDidPreloadScroll = true; } catch {}
    }
    await new Promise(r => setTimeout(r, 140));
  }
  return last;
}

// Gently scroll the page to help trigger infinite/lazy load content
function autoScrollFor(durationMs = 1200) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const now = performance.now();
      const t = now - start;
      const dy = Math.max(1, Math.round((1 - Math.min(1, t / durationMs)) * 24));
      window.scrollBy(0, dy);
      if (t < durationMs) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

// ---------- High-level speech control ----------

function startSpeech(text, rate = null, pitch = null, opts = {}) {
  try {
    if (__ANPR_MODE__ === 'infinite' && (!text || (typeof text === 'string' && text.trim().length === 0))) {
      console.warn('[ANPR] No text to speak (infinite mode); aborting startSpeech.');
      return;
    }
    if (__ANPR_MODE__ === 'infinite') {
      try { anprInstrumentedCancel('infinite-restart'); } catch {}
      if (text) remainingText = text;
      try { if (text) { __anprLastTextLen = text.length; saveInfiniteProgress(); } } catch {}
      const langToUse = (opts.lang) || (ttsAutoLang ? detectPageLanguage() : 'en-US') || 'en-US';
      const useRate = (typeof rate === 'number' ? rate : ttsRate);
      const usePitch = (typeof pitch === 'number' ? pitch : ttsPitch);
      // Route through chrome.tts via background (no user gesture needed)
      __anprCurrentTtsCallbacks = {
        onstart: () => { __anprTTSIdle = false; },
        onboundary: () => {},
        onend: () => {
          __anprChromeTtsSpeaking = false; __anprTTSIdle = true;
          if (!userStoppedReading) {
            isReading = false; stopAutoScroll(); remainingText = '';
            continueInfiniteReading();
          }
        },
        onerror: () => {
          __anprChromeTtsSpeaking = false; __anprTTSIdle = true;
          console.warn('[ANPR][TTS] Infinite mode speech error');
        }
      };
      __anprChromeTtsSpeaking = true;
      try {
        chrome.runtime.sendMessage({
          type: 'anprTtsSpeak', text: remainingText,
          lang: langToUse, rate: useRate, pitch: usePitch, volume: 1.0
        });
      } catch (e) { __anprChromeTtsSpeaking = false; }
      isReading = true; userStoppedReading = false; if (autoScrollWhileReading) startAutoScroll();
    } else {
      // Chapter mode — always use startChapterReader for proper Hindi translation support
      userStoppedReading = false;
      const opts2 = { rate: (typeof rate === 'number' ? rate : ttsRate), pitch: (typeof pitch === 'number' ? pitch : ttsPitch) };
      try { __anprReadingLock = true; anprInstrumentedCancel('chapter-restart'); } catch {}
      // Reset state so startChapterReader doesn't think we're already reading
      __anprSpeechState.cancel = false; __anprSpeechState.reading = false; isReading = false;
      startChapterReader(opts2);
    }
  } catch (error) {
    console.error('Error during speech synthesis:', error);
  }
}

function detectPageLanguage() {
  try {
    const htmlLang = document.documentElement.getAttribute('lang');
    if (htmlLang && /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(htmlLang)) return htmlLang;
    const metaLang = document.querySelector('meta[http-equiv="content-language" i]')?.content;
    if (metaLang) return metaLang.split(',')[0].trim();
    return navigator.language || 'en-US';
  } catch { return 'en-US'; }
}

function stopSpeech() {
  try {
    if (__ANPR_MODE__ === 'chapter') {
      userStoppedReading = true;
      stopChapterReader();
      isReading = false;
      stopAutoScroll();
      console.log('User stopped the reading.');
    } else if (utterance && isReading) {
      userStoppedReading = true;
      anprInstrumentedCancel('stop-infinite');
      isReading = false;
      stopAutoScroll();
      console.log("User stopped the reading. Auto-next will not proceed.");
    }
  } catch (error) {
    console.error("Error while stopping speech synthesis:", error);
  }
}

// ---------- Auto-scroll loop ----------

function startAutoScroll() {
  if (__autoScrollRAF) return;
  const speedPxPerSec = 40;
  let lastTs = performance.now();
  const loop = (ts) => {
    if (!isReading) { __autoScrollRAF = null; return; }
    const dt = Math.max(0, Math.min(100, ts - lastTs));
    lastTs = ts;
    const dy = (speedPxPerSec * dt) / 1000;
    window.scrollBy(0, dy);
    __autoScrollRAF = requestAnimationFrame(loop);
  };
  __autoScrollRAF = requestAnimationFrame(loop);
}

function stopAutoScroll() {
  if (__autoScrollRAF) {
    cancelAnimationFrame(__autoScrollRAF);
    __autoScrollRAF = null;
  }
}

// ---------- Infinite mode helpers ----------

function saveInfiniteProgress() {
  try {
    const data = { y: Math.round(window.scrollY || document.documentElement.scrollTop || 0), len: __anprLastTextLen, paraIndex: __anprParaIndex, t: Date.now() };
    chrome.storage?.local.set?.({ [__anprProgKey]: data });
  } catch {}
}

async function continueInfiniteReading() {
  try {
    if (userStoppedReading) return;
    updateStatus('Looking for more content…');
    saveInfiniteProgress();

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !userStoppedReading) {
      const paras = collectInfiniteParagraphs();
      if (paras.length > __anprParaIndex) {
        const nextChunk = paras.slice(__anprParaIndex).join('\n\n').trim();
        __anprParaIndex = paras.length;
        __anprLastTextLen += nextChunk.length;
        saveInfiniteProgress();
        if (nextChunk) {
          startSpeech(nextChunk);
          return;
        }
      }
      await autoScrollFor(1000);
      const txt = await waitForReadableContent(2500);
      if (txt && txt.length > (__anprLastTextLen + 80)) {
        const delta = txt.slice(__anprLastTextLen).trim();
        __anprLastTextLen = txt.length;
        if (delta) {
          startSpeech(delta);
          return;
        }
      }
    }
    updateStatus('No more content found.');
  } catch (e) {
    console.warn('continueInfiniteReading error:', e);
  }
}

// ---------- Skip forward ----------

function skipForward() {
  try {
    if (__anprSkipLock) return;
    __anprSkipLock = true; setTimeout(() => { __anprSkipLock = false; }, 350);
    if (__ANPR_MODE__ === 'chapter') {
      const total = __anprSpeechState.chunks.length || 0;
      const idx = __anprSpeechState.idx || 0;
      if (total > 0 && idx >= total - 1) {
        updateStatus('End of chapter');
        return;
      }
      try { __anprReadingLock = true; anprInstrumentedCancel('skip-forward'); __anprTTSIdle = true; } catch {}
      __anprSpeechState.idx = Math.min(idx + 1, total);
      anprSpeakNext();
    } else if (remainingText) {
      const skipAmount = 300;
      remainingText = remainingText.substring(skipAmount).trim();
      if (remainingText) {
        console.log('[ANPR] Skipping forward in the text...');
        startSpeech(remainingText);
      } else {
        console.log('[ANPR] Skipped to end of text.');
        remainingText = '';
        userStoppedReading = false;
        isReading = false; stopAutoScroll();
        if (autoNextEnabled) {
          try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
          try { chrome.storage?.local.set({ autoReadEnabled, autoNextEnabled }); } catch {}
          tryNextChapter();
        }
      }
    }
  } catch (error) {
    console.error('Error during forward skipping:', error);
  }
}

// Debugging helper
function __anprLogState(tag = 'state') {
  try {
    const mode = __ANPR_MODE__;
    const idx = __anprSpeechState.idx;
    const last = (__anprSpeechState.chunks?.length || 0) - 1;
    const nearEnd = last >= 0 && idx >= last;
    console.debug('[ANPR]', tag, { mode, idx, last, nearEnd, ttsIdle: __anprTTSIdle, phase: __anprPhase, advanceLock: __anprAdvanceLock });
  } catch {}
}
