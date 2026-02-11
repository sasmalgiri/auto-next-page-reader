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
  if (__anprDidEngineSelfTest) return;
  __anprDidEngineSelfTest = true;
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    const short = 'Test.';
    const candidates = [];
    for (const v of vs) {
      if (!v) continue;
      const score = (/neural|natural|premium/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 2) + (/^en/i.test(v.lang) ? 1 : 0);
      candidates.push({ v, score });
    }
    candidates.sort((a,b)=>b.score - a.score);
    const top = candidates.slice(0, Math.min(4, candidates.length));
    for (const { v } of top) {
      await new Promise(res => {
        try {
          const u = new SpeechSynthesisUtterance(short);
          u.voice = v;
          u.rate = 1; u.pitch = 1;
          let finished = false;
          u.onstart = () => { anprLogDebug('[ANPR][SelfTest] start', v.voiceURI); };
          u.onend = () => { if (!finished) { finished = true; anprLogDebug('[ANPR][SelfTest] success', v.voiceURI); res(); } };
          u.onerror = (err) => { if (!finished) { finished = true; anprLogDebug('[ANPR][SelfTest] error', v.voiceURI, err?.error || err?.type); res(); } };
          window.speechSynthesis.speak(u);
        } catch { res(); }
      });
    }
  } catch (e) { anprLogDebug('[ANPR][SelfTest] failed', e); }
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

  // If another utterance is still marked as speaking, wait and retry
  try {
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      setTimeout(anprSpeakNext, 50);
      return;
    }
  } catch {}

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

  const s = __anprSpeechState.chunks[__anprSpeechState.idx];

  // If Hindi translation is enabled and premium is active, translate before speaking
  if (__anprTranslateEnabled && __anprPremiumActive && typeof anprTranslateChunk === 'function') {
    _anprSpeakWithTranslation(s);
    return;
  }

  _anprSpeakChunk(s);
}

// Internal: speak a chunk after optional translation
async function _anprSpeakWithTranslation(originalText) {
  try {
    const translated = await anprTranslateChunk(originalText);
    let textToSpeak = originalText;
    let hindiVoice = null;
    let langOverride = null;

    if (translated && translated !== originalText) {
      textToSpeak = (typeof anprHindiPostProcess === 'function') ? anprHindiPostProcess(translated) : translated;
      hindiVoice = (typeof anprPickHindiVoice === 'function') ? anprPickHindiVoice(__anprHindiVoiceGender) : null;
      langOverride = 'hi-IN';
    }

    if (__anprSpeechState.cancel) return;
    _anprSpeakChunk(textToSpeak, hindiVoice, langOverride);
  } catch (e) {
    console.warn('[ANPR][Translate] Translation error, falling back to original:', e);
    if (!__anprSpeechState.cancel) _anprSpeakChunk(originalText);
  }
}

function _anprSpeakChunk(s, forceVoice, forceLang) {
  const u = new SpeechSynthesisUtterance(s);
  let voiceForChunk = forceVoice || null;
  const tuned = __anprTuneProsody(s, (__anprSpeechState.rate || ttsRate || 0.8), (__anprSpeechState.pitch || ttsPitch || 1.0));
  u.rate = tuned.rate; u.pitch = tuned.pitch; u.volume = 1;
  if (voiceForChunk) u.voice = voiceForChunk;
  if (forceLang) u.lang = forceLang;

  u.onstart = () => {
    try {
      __anprTTSIdle = false; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances++;
      __anprLastUtteranceTs = Date.now();
      __anprLastStartTs = __anprLastUtteranceTs;
      console.debug('[ANPR][TTS] onstart', {
        idx: __anprSpeechState.idx,
        total: __anprSpeechState.chunks.length,
        len: (s||'').length,
        voice: voiceForChunk && voiceForChunk.voiceURI,
        rate: u.rate,
        pitch: u.pitch
      });
    } catch {}
  };
  u.onboundary = () => {
    try {
      __anprLastBoundaryTs = Date.now();
      const ratio = (__anprSpeechState.idx + 1) / Math.max(1, __anprSpeechState.chunks.length);
      const rect = __anprSpeechState.container.getBoundingClientRect();
      const y = window.scrollY + rect.top + ratio * rect.height;
      anprSmoothScrollTo(y);
    } catch {}
  };
  u.onend = () => {
    __anprTTSIdle = true;
    if (__anprReadingLock) { __anprReadingLock = false; return; }
    __anprSpeechState.idx++;
    __anprLastUtteranceTs = Date.now();
    console.debug('[ANPR][TTS] onend', {
      idx: __anprSpeechState.idx,
      total: __anprSpeechState.chunks.length,
      consecutiveErrors: __anprConsecutiveSpeakErrors
    });
    const gap = (__anprNaturalPreset || __anprDynamicProsody) ? (tuned.pauseAfterMs || 0) : 0;
    setTimeout(anprSpeakNext, gap);
  };
  u.onerror = (e) => {
    __anprTTSIdle = true;
    if (__anprReadingLock) { __anprReadingLock = false; return; }
    __anprConsecutiveSpeakErrors++;
    const errorType = anprMapTTSError(e);

    if (errorType === 'interrupted' && !__anprLastBoundaryTs) {
      if (!__anprInterruptedRetryFlag) {
        __anprInterruptedRetryFlag = true;
        console.debug('[ANPR][TTS] interrupted without boundary; retrying same chunk before advancing');
        setTimeout(anprSpeakNext, 80);
        return;
      }
    }
    __anprLastErrorMeta = {
      idx: __anprSpeechState.idx,
      total: __anprSpeechState.chunks.length,
      len: (s||'').length,
      voice: voiceForChunk && voiceForChunk.voiceURI,
      rate: u.rate,
      pitch: u.pitch,
      error: e && (e.error || e.type || 'unknown'),
      errorType,
      consecutiveErrors: __anprConsecutiveSpeakErrors,
      successfulUtterances: __anprSuccessfulUtterances,
      recoveryAttempts: __anprErrorRecoveryAttempts
    };
    if (__anprDebugLogging) {
      console.warn('[ANPR][TTS] onerror', __anprLastErrorMeta);
      try { console.debug('[ANPR][TTS] ERROR_META_JSON ' + JSON.stringify(__anprLastErrorMeta)); } catch {}
    } else if (__anprConsecutiveSpeakErrors <= 3) {
      console.warn('[ANPR][TTS] onerror', errorType, 'chunkLen=', (s||'').length);
    }
    __anprLastUtteranceTs = Date.now();
    // Handle not-allowed: often autoplay/user-gesture policy
    try {
      const errStr = String(errorType || (e && (e.error || e.type)) || '').toLowerCase();
      if (errStr.includes('not-allowed') || errStr.includes('notallowed')) {
        try { window.speechSynthesis && window.speechSynthesis.resume(); } catch {}
        if (__anprSuccessfulUtterances === 0) {
          const cur = __anprSpeechState.chunks[__anprSpeechState.idx] || '';
          if (typeof cur === 'string' && cur.length >= 200) {
            const re = anprNormalizeChunks([cur], { maxLen: 160, minMergeLen: 40, hardSplitLen: 500 });
            if (Array.isArray(re) && re.length) {
              __anprSpeechState.chunks.splice(__anprSpeechState.idx, 1, ...re);
            }
          }
        }
        setTimeout(anprSpeakNext, 120);
        return;
      }
    } catch {}
    if (__anprSuccessfulUtterances === 0 && __anprConsecutiveSpeakErrors >= 2) {
      try { anprEngineSelfTest(); } catch {}
    }
    try {
      if (errorType !== 'interrupted' && voiceForChunk && voiceForChunk.voiceURI) {
        __anprFailedVoiceURIs.add(voiceForChunk.voiceURI);
      }
    } catch {}
    if (errorType === 'interrupted') {
      __anprConsecutiveSpeakErrors = Math.max(0, __anprConsecutiveSpeakErrors - 1);
    }
    // Adaptive re-splitting for large first chunk failures
    const shouldAdaptiveResplit = (errorType !== 'interrupted' && __anprSuccessfulUtterances === 0 && __anprConsecutiveSpeakErrors >= 2 && typeof s === 'string' && s.length > 220);
    if (shouldAdaptiveResplit) {
      try {
        const sub = anprSplitChunks(s, 120).filter(x => x && x.trim().length);
        if (sub.length >= 2) {
          console.debug('[ANPR][TTS] Adaptive re-splitting large failing chunk', { originalLen: s.length, newPieces: sub.length });
          __anprSpeechState.chunks.splice(__anprSpeechState.idx, 1, sub[0]);
          for (let i = 1; i < sub.length; i++) __anprSpeechState.chunks.splice(__anprSpeechState.idx + i, 0, sub[i]);
          __anprConsecutiveSpeakErrors = 0;
          setTimeout(anprSpeakNext, 0);
          return;
        }
      } catch (adE) {
        console.debug('[ANPR][TTS] Adaptive re-split failed', adE);
      }
    }
    __anprSpeechState.idx++;
    if (__anprConsecutiveSpeakErrors > 4) {
      if (__anprSuccessfulUtterances === 0) {
        const recovered = anprAttemptErrorRecovery();
        if (recovered) return;
        if (__anprSpeechState.idx >= __anprSpeechState.chunks.length) {
          console.warn('[ANPR] Speech failed for entire chapter; blocking auto-next.');
          updateStatus('Speech engine failed on this chapter. Not auto-navigating.');
          __anprAdvanceLock = false; __anprSpeechState.reading = false; return;
        }
      } else if (__anprConsecutiveSpeakErrors > 8) {
        console.warn('[ANPR] Too many speech errors after some progress; considering navigation.');
        if (__anprSpeechState.idx >= __anprSpeechState.chunks.length) { maybeAutoNext(); return; }
      }
    }
    const backoffDelay = (__anprConsecutiveSpeakErrors > 2)
      ? Math.min(1200, __anprErrorBackoffBase * Math.pow(1.6, __anprConsecutiveSpeakErrors - 2))
      : 0;
    const delay = errorType === 'interrupted' ? 0 : backoffDelay;
    setTimeout(anprSpeakNext, delay);
  };

  try {
    if (!s || (typeof s === 'string' && s.trim().length === 0)) {
      __anprSpeechState.idx++;
      setTimeout(anprSpeakNext, 0);
      return;
    }
    __anprSpeakAttempts++;
    if (__anprSpeakAttempts > __anprMaxUtterances) {
      console.warn('[ANPR] Utterance cap reached for this chapter, attempting auto-next.');
      __anprSpeechState.idx = __anprSpeechState.chunks.length;
      setTimeout(maybeAutoNext, 0);
      return;
    }
    setTimeout(() => {
      try {
        console.debug('[ANPR][TTS] speak attempt', {
          idx: __anprSpeechState.idx,
          total: __anprSpeechState.chunks.length,
          len: (s||'').length,
          voice: voiceForChunk && voiceForChunk.voiceURI,
          rate: u.rate,
          pitch: u.pitch,
          recoveryAttempts: __anprErrorRecoveryAttempts,
          consecutiveErrors: __anprConsecutiveSpeakErrors,
          successfulUtterances: __anprSuccessfulUtterances
        });
        window.speechSynthesis.speak(u);
      } catch (e2) {
        __anprConsecutiveSpeakErrors++; __anprSpeechState.idx++;
        __anprLastErrorMeta = { immediateThrow: true, error: String(e2) };
        console.warn('[ANPR][TTS] immediate speak throw', __anprLastErrorMeta);
        setTimeout(anprSpeakNext, 0);
      }
    }, 0);
  } catch (e) {
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
        const idleTooLong = (now - __anprLastUtteranceTs) > 3500;
        const engineBusy = window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending);
        const stuckOnFirst = __anprSuccessfulUtterances === 0 && (now - __anprLastUtteranceTs) > 5000;
        const noBoundaryProgress = __anprLastStartTs && (__anprLastBoundaryTs < __anprLastStartTs);
        const speakingStuck = engineBusy && !atEnd && __anprLastStartTs && (now - __anprLastStartTs) > 4200 && (__anprLastUtteranceTs === __anprLastStartTs) && noBoundaryProgress;
        if (!engineBusy && !atEnd && idleTooLong) {
          console.debug('[ANPR][Watchdog] Flow stall detected; attempting resume speak.', {
            idx: __anprSpeechState.idx,
            total: __anprSpeechState.chunks.length,
            idleMs: now - __anprLastUtteranceTs
          });
          try { speechSynthesis.resume(); } catch {}
          setTimeout(anprSpeakNext, 40);
        }
        else if (speakingStuck) {
          __anprStuckCycles++;
          console.debug('[ANPR][Watchdog] Speaking stuck detected (no boundary/end).', {
            idx: __anprSpeechState.idx,
            chunkPreview: (__anprSpeechState.chunks[__anprSpeechState.idx]||'').slice(0,120),
            msSinceStart: now - __anprLastStartTs,
            stuckCycles: __anprStuckCycles
          });
          if (__anprStuckCycles >= 2) {
            try {
              const voices = speechSynthesis.getVoices();
              if (voices && voices.length) {
                const cur = __anprSpeechState.voice;
                let idxV = voices.findIndex(v => v === cur);
                if (idxV < 0) idxV = 0;
                const next = voices[(idxV + 1) % voices.length];
                if (next && next !== cur) {
                  __anprSpeechState.voice = next;
                  __anprStuckCycles = 0;
                  console.debug('[ANPR][Watchdog] Rotating voice to', next.voiceURI);
                }
              }
            } catch {}
          }
          anprInstrumentedCancel('watchdog-speaking-stuck');
          setTimeout(anprSpeakNext, 90);
        }
        if (stuckOnFirst && __anprSpeechState.idx < (__anprSpeechState.chunks.length||0)) {
          const cur = __anprSpeechState.chunks[__anprSpeechState.idx];
          if (typeof cur === 'string' && cur.length > 160) {
            console.debug('[ANPR][Watchdog] Hard re-splitting first stuck chunk.', { originalLen: cur.length });
            try {
              const finer = anprNormalizeChunks([cur], { maxLen: 140, minMergeLen: 40, hardSplitLen: 400 });
              if (Array.isArray(finer) && finer.length) {
                __anprSpeechState.chunks.splice(__anprSpeechState.idx, 1, ...finer);
                __anprConsecutiveSpeakErrors = 0; __anprLastUtteranceTs = now;
                setTimeout(anprSpeakNext, 60);
              }
            } catch {}
          }
        }
        if (atEnd && idleTooLong && __anprAdvanceLock) {
          console.debug('[ANPR][Watchdog] Releasing stale advance lock.');
          __anprAdvanceLock = false; maybeAutoNext();
        }
      } catch {}
    }, 900);
  } catch {}
}
function anprStopFlowWatchdog() { try { if (__anprFlowWatchdog) { clearInterval(__anprFlowWatchdog); __anprFlowWatchdog = null; } } catch {} }

// ---------- Chapter reader start/stop ----------

function startChapterReader(opts = {}) {
  if (__anprAdvanceLock) { return; }
  if (__anprSpeechState.reading) {
    console.debug('[ANPR] Duplicate start ignored; already reading.');
    return;
  }
  try { anprInstrumentedCancel('chapter-start'); } catch {}
  __anprSpeechState.cancel = false;
  __anprSpeechState.reading = true;
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
          anprSpeakNext();
          return;
        }
      }
    } catch {}
    updateStatus('Waiting for readable content…');
    startAutoStartRetryLoop('chapter-empty');
    anprObserveContentUntilReady();
    return;
  }
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
      if (utterance) {
        try { anprInstrumentedCancel('infinite-restart'); } catch {}
      }
      if (text) remainingText = text;
      utterance = new SpeechSynthesisUtterance(remainingText);
      try { if (text) { __anprLastTextLen = text.length; saveInfiniteProgress(); } } catch {}
      const langToUse = (opts.lang) || (ttsAutoLang ? detectPageLanguage() : 'en-US') || 'en-US';
      utterance.lang = langToUse;
      utterance.rate = (typeof rate === 'number' ? rate : ttsRate);
      utterance.pitch = (typeof pitch === 'number' ? pitch : ttsPitch);
      utterance.onend = () => {
        if (!userStoppedReading) {
          isReading = false; stopAutoScroll(); remainingText = '';
          continueInfiniteReading();
        }
      };
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          remainingText = remainingText.substring(event.charIndex);
        }
      };
      if (window.speechSynthesis.getVoices().length === 0) {
        const once = () => { window.speechSynthesis.removeEventListener('voiceschanged', once); try { if (!isReading) window.speechSynthesis.speak(utterance); } catch {} };
        window.speechSynthesis.addEventListener('voiceschanged', once);
      }
      window.speechSynthesis.speak(utterance);
      isReading = true; userStoppedReading = false; if (autoScrollWhileReading) startAutoScroll();
    } else {
      // Chapter mode
      userStoppedReading = false;
      const opts2 = { rate: (typeof rate === 'number' ? rate : ttsRate), pitch: (typeof pitch === 'number' ? pitch : ttsPitch) };
      try { __anprReadingLock = true; window.speechSynthesis.cancel(); } catch {}
      __anprSpeechState.cancel = false; __anprSpeechState.reading = true; isReading = true;
      __anprSpeechState.rate = opts2.rate; __anprSpeechState.pitch = opts2.pitch;
      anprStartFlowWatchdog();
      try { __anprSpeechState.voice = null; } catch {}
      __anprSpeechState.container = anprPickContentContainer();
      const provided = (typeof text === 'string' ? text.trim() : '');
      if (provided && provided.length > 120) {
        const parts = provided.includes('\n\n') ? provided.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean) : anprSplitChunks(provided, 220);
        __anprSpeechState.chunks = parts; __anprSpeechState.idx = 0;
        __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances = 0; __anprErrorRecoveryAttempts = 0;
        anprSpeakNext();
      } else {
        startChapterReader(opts2);
      }
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
      try { __anprReadingLock = true; window.speechSynthesis.cancel(); __anprTTSIdle = true; } catch {}
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
