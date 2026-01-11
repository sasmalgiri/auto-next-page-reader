// Ensure variables are not redeclared
if (typeof pageCounter === 'undefined') {
  var pageCounter = 0; // Track the current page/chapter number
}

if (typeof autoNextEnabled === 'undefined') {
  var autoNextEnabled = true; // Default auto-next to ON
}
if (typeof __anprTabId === 'undefined') {
  var __anprTabId = null;
}
function __anprAcquireTabId() {
  try {
    if (__anprTabId != null) return;
    chrome.runtime.sendMessage({ type: 'anprHandshake' }, (resp) => {
      if (resp && resp.ok && typeof resp.tabId === 'number') {
        __anprTabId = resp.tabId;
        // Optionally persist if needed later
      }
    });
  } catch {}
}
__anprAcquireTabId();

if (typeof utterance === 'undefined') {
  var utterance; // Declare speech synthesis utterance only once
}
// Voice preference removed; always use browser default voice.
if (typeof preferredVoiceURI === 'undefined') { var preferredVoiceURI = null; }

if (typeof remainingText === 'undefined') {
  var remainingText = ''; // Track remaining text for the forward functionality
}

if (typeof extractedContent === 'undefined') {
  var extractedContent = ''; // Store the extracted content for potential file creation
}

if (typeof isReading === 'undefined') {
  var isReading = false; // Track if reading is ongoing
}

if (typeof autoReadEnabled === 'undefined') {
  var autoReadEnabled = true; // Default auto-read to ON
}
if (typeof ttsRate === 'undefined') {
  var ttsRate = 0.8;
}
if (typeof ttsPitch === 'undefined') {
  var ttsPitch = 1.0;
}
if (typeof ttsAutoLang === 'undefined') {
  var ttsAutoLang = true;
}
// Natural voice preference removed (simplified voice handling)
if (typeof __anprPreferNatural === 'undefined') { var __anprPreferNatural = false; }
if (typeof __anprNaturalPreset === 'undefined') {
  var __anprNaturalPreset = true;
}
if (typeof __anprDynamicProsody === 'undefined') {
  var __anprDynamicProsody = true;
}
// Dialogue voice alternation removed
if (typeof __anprDialogueAlternate === 'undefined') { var __anprDialogueAlternate = false; }
if (typeof __anprDialogueTurn === 'undefined') { var __anprDialogueTurn = 0; }
if (typeof __anprFemaleFav === 'undefined') { var __anprFemaleFav = null; }
if (typeof __anprMaleFav === 'undefined') { var __anprMaleFav = null; }
if (typeof autoScrollWhileReading === 'undefined') {
  var autoScrollWhileReading = false; // Optional continuous auto-scroll while speaking
}
if (typeof __autoScrollRAF === 'undefined') {
  var __autoScrollRAF = null; // rAF id for auto-scroll loop
}

// Site-aware reading mode
if (typeof __ANPR_MODE__ === 'undefined') {
  var __ANPR_MODE__ = /(^|\.)webnovel\.com$/i.test(location.hostname) ? 'infinite' : 'chapter';
}
// Future-proof base configuration & user overrides
if (typeof __ANPR_EXT_CONFIG__ === 'undefined') {
  var __ANPR_EXT_CONFIG__ = {
    version: 'fp-1',
    ignorePhrasesBase: [
      // Site boilerplate / ads / prompts
      'novelbin.com', 'novelbin', 'Novel Bin', 'Advertisement', 'Advertisements', 'Ad block', 'Disable adblock', 'cookie', 'GDPR', 'sponsored',
      'donate', 'report chapter', 'rate this chapter', 'login to comment', 'continue reading on', 'power stone', 'gift coin', 'share this chapter',
      'error report', 'chapter comments', 'reading app', 'support us', 'join discord', 'discord.gg', 'buy premium', 'unlock full chapter',
      'subscribe', 'earn points', 'bonus chapter', 'display options', 'table of contents', 'previous chapter', 'next chapter', 'loading ads',
      'download app', 'reading list', 'add to library', 'send gift', 'support author', 'report error', 'privacy policy', 'terms of service', 'all rights reserved', 'contact us'
    ],
    nextSelectorsBase: [
      'a#next_chap', '#next_chap', 'a#next', '#next', 'a#nextchapter', '#nextchapter',
      '.nextchap', '.next_chap', '.chr-nav-right a', 'a[rel="next"]', '.next a', '.nav-next a', '.btn-next a',
      '.next-chap', '.next-chapter a'
    ]
  };
}
// Site adapter map for structured overrides (content & navigation behavior)
if (typeof __ANPR_ADAPTERS__ === 'undefined') {
  var __ANPR_ADAPTERS__ = {
    'webnovel.com': {
      contentSelector: '#chapter-content',
      paragraphSelector: 'div#chapter-content p, div.chapter-content p',
      nextLinkSelector: 'a[rel="next"], .next-chapter a',
      isInfinite: true
    },
    'novelbin.com': {
      contentSelector: '#chr-content',
      paragraphSelector: '#chr-content p, #chr-content div',
      nextLinkSelector: 'a#next_chap, .nextchap, .chr-nav-right a',
      isInfinite: false
    },
    'wuxiaworld.com': {
      contentSelector: '#chapter-content',
      paragraphSelector: '#chapter-content p',
      nextLinkSelector: 'a[rel="next"], .next a',
      isInfinite: false
    }
  };
}
if (typeof __anprCustomIgnorePhrases === 'undefined') var __anprCustomIgnorePhrases = [];
if (typeof __anprCustomNextSelectors === 'undefined') var __anprCustomNextSelectors = [];
if (typeof __anprStrictFiltering === 'undefined') var __anprStrictFiltering = false; // relaxed by default
try {
  chrome.storage?.local.get(['customIgnorePhrases','customNextSelectors','strictFiltering','naturalPreset','dynamicProsody'], (d) => {
    if (Array.isArray(d.customIgnorePhrases)) __anprCustomIgnorePhrases = d.customIgnorePhrases.filter(x=>typeof x==='string');
    if (Array.isArray(d.customNextSelectors)) __anprCustomNextSelectors = d.customNextSelectors.filter(x=>typeof x==='string');
    if (typeof d.strictFiltering === 'boolean') __anprStrictFiltering = d.strictFiltering;
    if (typeof d.naturalPreset === 'boolean') __anprNaturalPreset = d.naturalPreset;
    if (typeof d.dynamicProsody === 'boolean') __anprDynamicProsody = d.dynamicProsody;
  });
} catch {}
// Site profiles: prefer known content selectors per site, fallback stays in place
if (typeof __ANPR_SITE_PROFILES__ === 'undefined') {
  var __ANPR_SITE_PROFILES__ = [
    {
      hosts: ['novelbin.com', 'novelbin.me', 'novel-bin.com'],
      contentSelectors: ['#chr-content', '.chr-c', '.chapter-content', '.reading-content', 'article.reading__content', 'article']
      // next link detection relies on rel=next or link text scanning below
    },
    {
      hosts: ['webnovel.com'],
      contentSelectors: ['#chapter-content', 'div.chapter-content', 'article', 'main article']
    },
    {
      hosts: ['wuxiaworld.com'],
      contentSelectors: ['#chapter-content', '.chapter-content', 'article']
    },
    {
      hosts: ['lightnovelpub.com', 'lnpub.org', 'lightnovelpub.vip'],
      contentSelectors: ['.chapter-content', '#chapter-content', 'article']
    },
    {
      hosts: ['boxnovel.com', 'boxnovel.org'],
      contentSelectors: ['#chr-content', '.chr-c', '.chapter-content', 'article']
    }
  ];
}
function __anprGetSiteProfile() {
  try {
    const host = location.hostname.replace(/^www\./, '').toLowerCase();
    return __ANPR_SITE_PROFILES__.find(p => p.hosts.some(h => host === h || host.endsWith('.' + h))) || null;
  } catch { return null; }
}
// Internal speech engine state (chapter mode with chunking)
if (typeof __anprSpeechState === 'undefined') {
  var __anprSpeechState = {
    container: null,
    chunks: [],
    idx: 0,
    cancel: false,
    reading: false,
    voice: null,
    rate: 0.8,
    pitch: 1.0,
    lastBoundaryTime: 0,
  };
}
// Progressive (instant start) support state
if (typeof __anprProgressive === 'undefined') { var __anprProgressive = false; }
if (typeof __anprPendingChunks === 'undefined') { var __anprPendingChunks = []; }
if (typeof __anprPendingVoiceURI === 'undefined') { var __anprPendingVoiceURI = null; }
// Advance guard to prevent repeated end-of-chapter loops
if (typeof __anprAdvanceLock === 'undefined') {
  var __anprAdvanceLock = false;
}
// Track last extracted text length to compute deltas for infinite scroll
if (typeof __anprLastTextLen === 'undefined') {
  var __anprLastTextLen = 0;
}
// Persisted progress key for infinite pages
if (typeof __anprProgKey === 'undefined') {
  var __anprProgKey = `anpr:prog:${location.host}${location.pathname}`;
}
if (typeof __anprParaIndex === 'undefined') {
  var __anprParaIndex = 0; // Number of paragraphs already read in infinite mode
}
// Simple state machine flags
if (typeof __anprPhase === 'undefined') {
  var __anprPhase = 'reading'; // 'reading' | 'navigating' | 'nudging' | 'waiting_append'
}
if (typeof __anprTTSIdle === 'undefined') {
  var __anprTTSIdle = true;
}
if (typeof __anprAppendNudged === 'undefined') {
  var __anprAppendNudged = false; // one-time nudge for infinite mode
}
if (typeof __anprSkipLock === 'undefined') {
  var __anprSkipLock = false; // debounce skip forward
}
if (typeof __anprReadingLock === 'undefined') {
  var __anprReadingLock = false; // suppress onend increment after manual cancel/skip
}
if (typeof __anprConsecutiveSpeakErrors === 'undefined') {
  var __anprConsecutiveSpeakErrors = 0; // guard against rapid error loops
}
// Track successful utterances in current chapter to avoid auto-next when nothing was read
if (typeof __anprSuccessfulUtterances === 'undefined') {
  var __anprSuccessfulUtterances = 0;
}
// Recovery attempt counter when early utterances fail
if (typeof __anprErrorRecoveryAttempts === 'undefined') {
  var __anprErrorRecoveryAttempts = 0;
}
// Index to rotate fallback voices if initial voice causes errors
if (typeof __anprRecoveryVoiceIndex === 'undefined') {
  var __anprRecoveryVoiceIndex = 0;
}
// Last speech error metadata for diagnostics
if (typeof __anprLastErrorMeta === 'undefined') {
  var __anprLastErrorMeta = null;
}
// Track voice URIs that produced errors for current chapter to avoid immediate reuse
if (typeof __anprFailedVoiceURIs === 'undefined') {
  var __anprFailedVoiceURIs = new Set();
}
// Debug logging toggle (can be enabled via chrome.storage.local.set({ anprDebugLogging: true }))
if (typeof __anprDebugLogging === 'undefined') {
  var __anprDebugLogging = false;
  try { chrome.storage?.local.get(['anprDebugLogging'], d => { if (typeof d.anprDebugLogging === 'boolean') __anprDebugLogging = d.anprDebugLogging; }); } catch {}
}
// Backoff base (ms) for consecutive errors
if (typeof __anprErrorBackoffBase === 'undefined') { var __anprErrorBackoffBase = 180; }
// Flag to ensure we only run one micro self-test per chapter
if (typeof __anprDidEngineSelfTest === 'undefined') { var __anprDidEngineSelfTest = false; }

// Instrumentation & enhanced stall diagnostics
if (typeof __anprCancelEvents === 'undefined') {
  var __anprCancelEvents = [];
  var __anprLastBoundaryTs = 0;
  var __anprLastStartTs = 0;
  var __anprStuckCycles = 0;
  var __anprInterruptedRetryFlag = false;
}

function anprInstrumentedCancel(reason) {
  try {
    __anprCancelEvents.push({
      t: Date.now(),
      reason,
      idx: __anprSpeechState && __anprSpeechState.idx,
      speaking: !!(speechSynthesis && speechSynthesis.speaking),
      pending: !!(speechSynthesis && speechSynthesis.pending)
    });
    if (__anprDebugLogging) console.debug('[ANPR][INST] cancel()', reason, __anprCancelEvents[__anprCancelEvents.length - 1]);
  } catch {}
  try { __anprReadingLock = true; speechSynthesis.cancel(); } catch {}
  setTimeout(() => { __anprReadingLock = false; }, 140);
}

function anprLogDebug(...args) { try { if (__anprDebugLogging) console.debug(...args); } catch {} }

function anprMapTTSError(e) {
  try {
    const code = (e && (e.error || e.type)) || 'unknown';
    // Normalize common Web Speech API error patterns
    if (/not.?allowed/i.test(code)) return 'not-allowed';
    if (/interrupted/i.test(code)) return 'interrupted';
    if (/audio.?busy|audio.?error/i.test(code)) return 'audio-error';
    if (/network/i.test(code)) return 'network';
    if (/service.?unavailable|service.?error/i.test(code)) return 'service-unavailable';
    if (/synth(es)?is/i.test(code)) return 'synthesis-failed';
    return code.toLowerCase();
  } catch { return 'unknown'; }
}

async function anprEngineSelfTest() {
  if (__anprDidEngineSelfTest) return;
  __anprDidEngineSelfTest = true;
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    const short = 'Test.';
    const candidates = [];
    for (const v of vs) {
      if (!v) continue;
      // Prefer English natural/neural first
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
    if (__anprErrorRecoveryAttempts >= 2) return false; // limit recovery cycles
    __anprErrorRecoveryAttempts++;
    console.warn('[ANPR] Attempting speech error recovery #' + __anprErrorRecoveryAttempts, {
      lastError: __anprLastErrorMeta,
      successfulUtterances: __anprSuccessfulUtterances,
      consecutiveErrors: __anprConsecutiveSpeakErrors,
      speakAttempts: __anprSpeakAttempts,
      currentIdx: (__anprSpeechState && __anprSpeechState.idx),
      totalChunks: (__anprSpeechState && __anprSpeechState.chunks && __anprSpeechState.chunks.length) || 0
    });
    // Rebuild chunks using a simpler bulk extraction path (fallback to whole container text)
    const container = (__anprSpeechState && __anprSpeechState.container) || anprPickContentContainer();
    let raw = '';
    try { raw = (container && container.innerText) ? container.innerText.trim() : ''; } catch {}
    if (!raw || raw.length < 40) {
      // Try Readability as secondary
      try { raw = extractMainContent(); } catch {}
    }
    if (!raw) return false;
    // Temporarily relax filtering for recovery to keep more natural lines
    const strictPrev = __anprStrictFiltering;
    try { __anprStrictFiltering = false; } catch {}
    raw = applyTextFilters(raw);
    try { __anprStrictFiltering = strictPrev; } catch {}
    const backupChunks = anprSplitChunks(raw, 180).filter(c => c && c.trim().length > 0);
    if (backupChunks.length < 3) {
      // If split on sentence punctuation produced too few chunks, fallback to paragraph split
      const paras = raw.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0 && p.length < 7000);
      if (paras.length > backupChunks.length) {
        backupChunks.splice(0, backupChunks.length, ...paras);
      }
    }
    if (!backupChunks.length) return false;
    __anprSpeechState.chunks = backupChunks; // overwrite with recovery set
    __anprSpeechState.idx = 0;
    __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances = 0;
    // Voice rotation removed (simplified voice handling)
    try { __anprSpeechState.voice = null; } catch {}
    updateStatus('Recovering speech engine…');
    setTimeout(anprSpeakNext, 120); // slight delay
    return true;
  } catch (e) {
    console.warn('[ANPR] Recovery failed:', e);
    return false;
  }
}
if (typeof __anprSpeakAttempts === 'undefined') {
  var __anprSpeakAttempts = 0; // per-chapter utterance attempts
}
if (typeof __anprMaxUtterances === 'undefined') {
  var __anprMaxUtterances = 600; // hard cap to avoid pathological loops
}

// Collect paragraphs for infinite reading mode (webnovel.com specific first, then generic)
function collectInfiniteParagraphs() {
  const host = location.hostname.replace(/^www\./, '').toLowerCase();
  let containers = [];
  try {
    if (host.includes('webnovel.com')) {
      containers = [
        document.querySelector('#chapter-content'),
        document.querySelector('div.chapter-content'),
        document.querySelector('article'),
        document.querySelector('main article'),
      ].filter(Boolean);
    }
    if (!containers.length) {
      containers = [
        document.querySelector('article'),
        document.querySelector('main'),
        document.querySelector('div[role="article"]'),
      ].filter(Boolean);
    }
  } catch {}

  let paras = [];
  for (const c of containers) {
    const ps = Array.from(c.querySelectorAll('p, div'))
      .map(n => (n.innerText || n.textContent || '').trim())
      .filter(t => t && t.length > 0);
    paras.push(...ps);
  }
  // Fallback to largest block split by paragraphs if needed
  if (paras.length < 3) {
    const txt = extractMainContent();
    if (txt) {
      paras = txt.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    }
  }
  // Filter UI-noise lines using existing filters best-effort
  paras = paras.map(p => applyTextFilters(p)).filter(Boolean);
  return paras;
}

if (typeof userStoppedReading === 'undefined') {
  var userStoppedReading = false; // Track if the user manually stopped reading
}
if (typeof __anprDidPreloadScroll === 'undefined') {
  var __anprDidPreloadScroll = false; // One-time gentle auto-scroll to trigger lazy/infinite loads
}

// Overlay UI (for demo/recording)
if (typeof overlayVisible === 'undefined') {
  var overlayVisible = false;
}
if (typeof overlayRoot === 'undefined') {
  var overlayRoot = null;
}

// Block ads on the page
function blockAds() {
  try {
    const adSelectors = [
      '[id*="ad"]',
      '[class*="ad"]',
      'iframe[src*="ads"]',
      'iframe[src*="adprovider"]',
      'div[class*="ad"]',
      'script[src*="ads"]',
      'script[src*="marphezis"]',
      'script[src*="tracking"]',
    ];
    adSelectors.forEach((selector) => {
      const ads = document.querySelectorAll(selector);
      ads.forEach((ad) => {
        ad.remove();
        console.log('Removed ad:', ad);
      });
    });
  } catch (error) {
    console.error('Error while removing ads:', error);
  }
}
// Initialize only once to avoid duplicate listeners when the content script is injected multiple times
if (!window.__AutoNextReaderInitialized) {
  window.__AutoNextReaderInitialized = true;
  blockAds();

  // Load persisted toggles so behavior is consistent across pages
  try {
    chrome.storage?.local.get(['autoNextEnabled', 'autoReadEnabled', 'autoScrollWhileReading'], (data) => {
      if (typeof data.autoNextEnabled === 'boolean') {
        autoNextEnabled = data.autoNextEnabled;
      }
      if (typeof data.autoReadEnabled === 'boolean') {
        autoReadEnabled = data.autoReadEnabled;
      }
      if (typeof data.autoScrollWhileReading === 'boolean') {
        autoScrollWhileReading = data.autoScrollWhileReading;
      }
    });
    chrome.storage?.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang', 'naturalPreset', 'dynamicProsody'], (data) => {
      if (typeof data.ttsRate === 'number') ttsRate = data.ttsRate;
      if (typeof data.ttsPitch === 'number') ttsPitch = data.ttsPitch;
      if (typeof data.ttsAutoLang === 'boolean') ttsAutoLang = data.ttsAutoLang;
      if (typeof data.naturalPreset === 'boolean') __anprNaturalPreset = data.naturalPreset;
      if (typeof data.dynamicProsody === 'boolean') __anprDynamicProsody = data.dynamicProsody;
    });
    // Preferred voice restoration removed (simplified voice handling)
    // Restore scroll position for infinite pages to resume where left off
    if (__ANPR_MODE__ === 'infinite') {
      try {
        chrome.storage?.local.get([__anprProgKey], (d) => {
          const prog = d && d[__anprProgKey];
          if (prog && typeof prog.y === 'number' && prog.y > 0) {
            window.scrollTo({ top: prog.y, behavior: 'instant' });
            __anprLastTextLen = typeof prog.len === 'number' ? prog.len : 0;
            if (typeof prog.paraIndex === 'number') __anprParaIndex = prog.paraIndex;
          }
        });
      } catch {}
    }
  } catch (e) {
    // storage may be unavailable in some contexts; ignore
  }
}

// Function to extract the main content using Readability.js and apply text filters
function extractMainContent() {
  // 1) Try Readability first
  let content = '';
  try {
    const doc = document.cloneNode(true);
    const reader = new Readability(doc);
    const article = reader.parse();
    content = article ? (article.textContent || '') : '';
  } catch {}

  // 2) If too short or empty, try site-specific and generic fallbacks
  if (!content || content.trim().length < 400) {
    const host = location.hostname.replace(/^www\./, '').toLowerCase();
    let alt = '';
    // Adapter-based site-specific selector preference
    const adapter = (__ANPR_ADAPTERS__ && __ANPR_ADAPTERS__[host]) || null;
    if (adapter && adapter.contentSelector) {
      alt = collectTextFromSelectors([adapter.contentSelector]);
    }
    // Secondary broader attempt if adapter produced insufficient text
    if ((!alt || alt.trim().length < 400) && adapter && adapter.paragraphSelector) {
      alt = collectTextFromSelectors([adapter.paragraphSelector]);
    }

    // Generic: pick the largest text block from visible containers
    if (!alt || alt.trim().length < 400) {
      alt = findLargestTextBlock();
    }

    if (alt && alt.trim().length >= (content ? Math.max(400, content.length) : 400)) {
      content = alt;
    }
  }

  if (content) {
    content = applyTextFilters(content);
    extractedContent = content;
  }
  return content;
}

// Helper: gather text from multiple selectors (concatenate <p> text where possible)
function collectTextFromSelectors(selectors) {
  try {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      // Prefer paragraphs
      const ps = Array.from(el.querySelectorAll('p, div'))
        .map(n => (n.innerText || n.textContent || '').trim())
        .filter(t => t && t.length > 0);
      if (ps.length) return ps.join('\n\n');
      const raw = (el.innerText || el.textContent || '').trim();
      if (raw) return raw;
    }
  } catch {}
  return '';
}

// Helper: find the visible element with the largest amount of readable text
function findLargestTextBlock() {
  try {
    const blacklist = new Set(['SCRIPT','STYLE','NOSCRIPT','NAV','ASIDE','FOOTER','HEADER','FORM','BUTTON']);
    let bestEl = null;
    let bestLen = 0;
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!(el instanceof HTMLElement)) continue;
      if (blacklist.has(el.tagName)) continue;
      if (el.offsetParent === null) continue; // hidden
      const text = (el.innerText || el.textContent || '').trim();
      if (!text) continue;
      const len = text.replace(/\s+/g,' ').length;
      if (len > bestLen) {
        bestLen = len;
        bestEl = el;
      }
    }
    if (bestEl) {
      // Prefer joining paragraph-like children to avoid nav text
      const chunks = Array.from(bestEl.querySelectorAll('p, div, li'))
        .map(n => (n.innerText || n.textContent || '').trim())
        .filter(Boolean);
      if (chunks.length >= 2) return chunks.join('\n\n');
      return (bestEl.innerText || bestEl.textContent || '').trim();
    }
  } catch {}
  return '';
}

// Function to apply extra filters: remove specific unwanted phrases, special characters, links, repetitive words, and tips
function applyTextFilters(text) {
  try {
    // 1. Remove specific unwanted phrases
  const phrasesToIgnore = (__ANPR_EXT_CONFIG__.ignorePhrasesBase||[]).concat(__anprCustomIgnorePhrases||[]);
    for (const phrase of phrasesToIgnore) {
      if (!phrase || typeof phrase !== 'string') continue;
      try {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
        text = text.replace(regex, '');
      } catch {}
    }

  // 2. Remove only control/zero-width characters; keep all Unicode letters and most punctuation for global languages
  // Remove zero-width and BOM
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Remove other control characters except newlines and tabs
  text = text.replace(/[\u0000-\u001F\u007F]/g, (m) => (m === "\n" || m === "\t" ? m : " "));

    // 3. Remove links and URLs
    text = text.replace(/https?:\/\/\S+|www\.\S+/g, ""); // Remove URLs
    text = text.replace(/\b(?:http|https|www)\b\S*/gi, ""); // Extra check for isolated web references

    // 4. Remove continuous repetitive words (best-effort, Unicode friendly)
    try {
      text = text.replace(/(\b)([\p{L}]+)(?:\s+\2\b)+/giu, "$1$2");
    } catch (_) {
      // Fallback for environments without Unicode property escapes
      text = text.replace(/\b(\w+)\b(?:\s+\1\b)+/gi, "$1");
    }

    // 5. Remove any instructional/UX phrases and site UI noise
    const uiPhrases = [
      'TIP', 'Note', 'Hint', 'Reminder',
      'COMMENT', 'SEND GIFT', 'Table Of Contents', 'Display Options', 'Bonus Chapter',
      'Paragraph comment feature is now on the Web', 'GOT IT', 'Add to library', 'Creators\' Thoughts'
    ];
    for (const p of uiPhrases) {
      const r = new RegExp(`^.*${p}.*$`, 'gim');
      text = text.replace(r, '');
    }

    // 5b. Remove standalone small vote/count numbers commonly injected in Webnovel paragraphs
    text = text.replace(/(^|\s)(\d{1,2})(?=\s|$)/g, (m, a, b) => {
      const n = parseInt(b, 10);
      return n <= 24 ? (a || '') : m; // keep larger numbers; drop small isolated counts (likely votes)
    });

    // 5c. Remove code/script-like lines or ad/tracker boilerplate
    const looksLikeCode = (line) => {
      const l = line.trim();
      if (!l) return false;
      // obvious code tokens or CSS/JS/HTML fragments
      if (/(?:^|\s)(?:var|let|const|function|return|class|import|export|try|catch|finally|new)\b/.test(l)) return true;
      if (/(document\.|window\.|console\.|JSON\.|Promise\.|setTimeout\(|setInterval\(|addEventListener\(|querySelector(All)?\()/i.test(l)) return true;
      if (/<\/?[a-z][^>]*>/i.test(l)) return true; // HTML tags
      // CSS properties or rules
      if (/(?:\{|\})\s*$/.test(l)) return true; // lines ending with block braces
      if (/(?:^|\s)(color|background|margin|padding|display|position|z-index|font(-size|-family|-weight)?|border|width|height)\s*:/i.test(l)) return true;
      if (/^\s*\.[A-Za-z0-9_-]+\s*\{|^\s*#[A-Za-z0-9_-]+\s*\{/.test(l)) return true; // CSS selectors
      // JSON-like structures
      if (/"[A-Za-z0-9_\-]+"\s*:\s*("[^"]*"|\d+|\{|\[)/.test(l)) return true;
      // Base64 or minified blobs
      if (/[A-Za-z0-9+/]{40,}={0,2}/.test(l)) return true;
      // many symbols, low letter ratio
      const letters = (l.match(/[\p{L}0-9]/gu) || []).length;
      const symbols = (l.match(/[;{}()=<>:&*_$#@`~^\[\]|\\]/g) || []).length;
      const ratio = letters / Math.max(1, l.length);
      if (symbols >= 3 && ratio < 0.55) return true;
      // long token without sentence punctuation
      if (l.length > 200 && !/[\.。！？!?…]/.test(l)) return true;
      // multiple CSS-like declarations on one line
      if (/:[^;]{1,50};\s*\w+\s*:/g.test(l)) return true;
      return false;
    };
    const mergedIgnore = phrasesToIgnore.map(p=>String(p).toLowerCase());
    const adRegex = /(advertis|sponsor|donat|subscribe|unlock|premium|cookie|gdpr|gift|power stone|share this chapter|report chapter|error report|chapter comments|support (us|author)|join discord|discord\.gg|bonus chapter)/i;
    // Relaxed vs strict filtering modes
    const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    let resultLines;
    if (!__anprStrictFiltering) {
      // RELAXED: keep almost everything except explicit ads/promo/nav labels and ignore phrases
      resultLines = lines.filter(s => {
        const lower = s.toLowerCase();
        if (mergedIgnore.some(p => lower.includes(p))) return false;
        if (adRegex.test(s)) return false;
        if (/<\/?[a-z][^>]*>/i.test(s)) return false; // drop HTML-taggy lines even in relaxed
        if (/^\s*(previous|prev)\s+chapter\s*$/i.test(s)) return false;
        if (/^\s*next\s+chapter\s*$/i.test(s)) return false;
        if (/^\s*chapter\s+\d+\s*$/i.test(s)) return false;
        // short domain-like boilerplate
        const domainLike = /\b[a-z0-9][a-z0-9-]{1,63}\.(?:com|net|org|io|app|site|vip|me|xyz|top|info|shop|online)\b/i;
        if (s.length < 90 && domainLike.test(s)) return false;
        // Keep italic/emphasis lines even if short
        return true;
      });
    } else {
      // STRICT: previous advanced heuristics (simplified a bit)
      const domainLike = /\b[a-z0-9][a-z0-9-]{1,63}\.(?:com|net|org|io|app|site|vip|me|xyz|top|info|shop|online)\b/i;
      resultLines = lines
        .filter(s => { const letters=(s.match(/[\p{L}]/gu)||[]).length; return (s.length - letters)/Math.max(1,s.length) < 0.6; })
        .filter(s => !looksLikeCode(s))
        .filter(s => !adRegex.test(s))
        .filter(s => !mergedIgnore.some(p => s.toLowerCase().includes(p)))
        .filter(s => { if (domainLike.test(s) && s.length < 90) return false; return true; })
        .filter(s => !/^\s*(previous|prev)\s+chapter\s*$/i.test(s))
        .filter(s => !/^\s*next\s+chapter\s*$/i.test(s))
        .filter(s => !/^\s*chapter\s+\d+\s*$/i.test(s))
        .filter(s => { const letters=(s.match(/[\p{L}]/gu)||[]).length; return letters/Math.max(1,s.length) > 0.30; });
    }
    text = resultLines.join('\n');

    // 6. Trim excessive whitespace
    // 7. Normalize whitespace but keep paragraph breaks
    text = text.replace(/[\t\r]+/g, ' ');
    text = text.replace(/\u00A0/g, ' ');
    // collapse more than two newlines to two
    text = text.replace(/\n{3,}/g, '\n\n');
    // collapse 2+ spaces
    return text.trim().replace(/ {2,}/g, ' ');
  } catch (error) {
    console.error("Error during content filtering:", error);
    return text; // Return unmodified text if filtering fails
  }
}

// ---------- Chapter mode reader (chunked) ----------
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

function anprPickContentContainer() {
  const profile = __anprGetSiteProfile();
  const sels = (profile?.contentSelectors || []).concat(['#chr-content', '.chr-c', '.chapter-content', '.reading-content', '.reading__content', 'article', '.container', '#chapter-content']);
  let best = null, bestLen = 0;
  try {
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach(el => {
        const len = (el.innerText || '').length;
        if (len > bestLen) { best = el; bestLen = len; }
      });
    }
    if (!best) {
      document.querySelectorAll('div,article,section,main').forEach(el => {
        const len = (el.innerText || '').length;
        if (len > bestLen) { best = el; bestLen = len; }
      });
    }
  } catch {}
  return best || document.body;
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
        // First split on sentence boundaries, then hard slice fallback
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
        buffer = seg; // hold for possible merge with next
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
      if (/^["'“‘\-–—]/.test(t) || /[“”«»]/.test(t)) { r -= 0.03; p += 0.01; }
    }
    // Length-based modulation for additional natural feel
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

function anprFindNextHref() {
  try {
    const host = location.hostname.replace(/^www\./, '').toLowerCase();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.offsetParent === null) return false;
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    };
    const extractChapterNumber = (u) => {
      try {
        const m = String(u).match(/chapter[-_\/]?(\d+)/i);
        return m ? parseInt(m[1], 10) : null;
      } catch { return null; }
    };
    let a = document.querySelector('link[rel="next"]');
    const root = anprPickContentContainer() || document;
    const anchors = Array.from(root.querySelectorAll('a[href]')).filter(el => {
      if (!isVisible(el)) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      if (el.classList && el.classList.contains('disabled')) return false;
      const txt = (el.textContent || '').toLowerCase();
      if (/\b(prev|previous)\b/.test(txt)) return false;
      return true;
    });
    // NovelBin specific selectors
    if (!a && host.includes('novelbin')) {
      a = document.querySelector('a#next_chap, #next_chap, .chr-nav-right a, .nextchap, .next_chap, .next-chapter a')
        || document.querySelector('a[rel="next"]');
    }
    // Configurable selectors
    if (!a) {
      const profileSelectors = (__ANPR_EXT_CONFIG__.nextSelectorsBase || []).concat(__anprCustomNextSelectors || []);
      for (const sel of profileSelectors) {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) { a = el; break; }
      }
    }
    // Text/rel pattern fallbacks
    if (!a) {
      a = anchors.find(x => /^\s*(next|next\s*»|»|›|→)\s*$/i.test(x.textContent || ''))
        || anchors.find(x => /\bnext\b/i.test(x.textContent || ''))
        || anchors.find(x => (x.rel || '').toLowerCase() === 'next');
    }
    const href = a && (a.href || a.getAttribute('href'));
    if (!href) return null;
    try {
      const cur = new URL(location.href);
      const nxt = new URL(href, location.href);
      if (cur.origin === nxt.origin && cur.pathname === nxt.pathname && cur.search === nxt.search) return null;
      const curN = extractChapterNumber(cur.href);
      const nxtN = extractChapterNumber(nxt.href);
      if (curN != null && nxtN != null && nxtN <= curN) return null;
    } catch {}
    return href;
  } catch { return null; }
}

function anprCollectParagraphsForCurrentSite(container) {
  try {
    const host = location.hostname.replace(/^www\./,'').toLowerCase();
    // For NovelBin and similar sites, paragraphs may be in divs not just <p>
    const baseSelector = host.includes('novelbin') ? 'p, div' : 'p';
    let out = [];
    const nodes = Array.from(container.querySelectorAll(baseSelector));
    for (const n of nodes) {
      if (!(n instanceof HTMLElement)) continue;
      const cls = (n.className||'') + ' ' + (n.id||'');
      // Skip nav / comment / gift / button areas
  if (/\b(ad|ads|advert|sponsor|promo|nav|breadcrumb|comment|gift|button|share|cookie|gdpr|footer|header|tip|notice|alert|related|popular|pagination|copyright)\b/i.test(cls)) continue;
      if (n.getAttribute('aria-hidden') === 'true') continue;
      // Skip if inside footer/nav/aside or known footer containers
  if (n.closest('footer, .footer, #footer, nav, aside, .site-footer, .page-footer, .bottom-bar, .global-footer, [role="contentinfo"], .site-info, .copyright')) continue;
      const cs = getComputedStyle(n);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      const t = (n.innerText || '').replace(/\u00A0/g, ' ').replace(/\r/g, '').replace(/\s*\n\s*/g, '\n').trim();
      if (t && t.length > 1 && t.length < 7000) out.push(applyTextFilters(t));
      if (out.length >= 60) break; // sanity cap
    }
    // If too few, fallback to splitting whole container
    if (out.length < 3) {
      const raw = (container.innerText || '').trim();
      if (raw && raw.length > 50) {
        const parts = raw.split(/\n{2,}/).map(s => applyTextFilters(s.trim())).filter(Boolean);
        if (parts.length > out.length) out = parts;
      }
    }
    // Remove leading translator/credits and chapter header lines (first few only)
    const headerPattern = /^\s*(?:chapter|ch\.)\s*(?:\d+|[ivxlcdm]+)(?:\s*[:\-–—].*)?$/i;
    const translatePattern = /(translated\s+by|translator|translation|edited\s+by|editor|proofread(?:er|ing)?)/i;
    let guard = 0;
    while (out.length && guard < 3) {
      guard++;
      const first = (out[0] || '').trim();
      if (!first) { out.shift(); continue; }
      if (headerPattern.test(first) || translatePattern.test(first)) { out.shift(); continue; }
      break;
    }
    // Remove trailing boilerplate/footer-like lines from the end
    const footerPattern = /(copyright|all rights reserved|privacy policy|terms of (use|service)|contact us|bookmark|powered by|novel\s*-?bin|novelbin|read latest (chapter|chapters)|report (chapter|error)|login to comment|share this chapter|add to library)/i;
    const domainLike = /\b[a-z0-9][a-z0-9-]{1,63}\.(?:com|net|org|io|app|site|vip|me|xyz|top|info|shop|online)\b/i;
    while (out.length) {
      const last = out[out.length - 1];
      const short = last && last.length <= 80;
      if (footerPattern.test(last) || (short && domainLike.test(last))) { out.pop(); continue; }
      break;
    }
    // Deduplicate adjacent identicals (defensive)
    const dedup = [];
    for (const t of out) { if (!dedup.length || dedup[dedup.length - 1] !== t) dedup.push(t); }
    return dedup;
  } catch { return []; }
}

function anprBuildFromDOM() {
  __anprSpeechState.container = anprPickContentContainer();
  // Build paragraphs (one utterance per paragraph) for stability and precise skipping
  const paras = anprCollectParagraphsForCurrentSite(__anprSpeechState.container);
  __anprSpeechState.chunks = paras;
  __anprSpeechState.idx = 0;
}

// Observe the content container and (re)start chapter reader once paragraphs appear
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
    // Also poll in case site uses virtualized renders without DOM mutations
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

function anprSpeakNext() {
  if (__anprSpeechState.cancel) return;

  // If another utterance is still marked as speaking, wait and retry
  try {
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      // Engine still busy; reschedule check after a short delay
      setTimeout(anprSpeakNext, 50);
      return;
    }
  } catch {}

  // Finished currently buffered subset
  if (__anprSpeechState.idx >= __anprSpeechState.chunks.length) {
    // Progressive continuation: append pending chunks then continue seamlessly
    if (__anprProgressive && __anprPendingChunks && __anprPendingChunks.length) {
      __anprSpeechState.chunks.push(...__anprPendingChunks);
      __anprPendingChunks = [];
      __anprProgressive = false; // switch off progressive mode after full set loaded
      setTimeout(anprSpeakNext, 0);
      return;
    }
    // Guard: if we had zero chunks, content likely not ready yet; don't navigate
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
  const u = new SpeechSynthesisUtterance(s);
  // Simplified: do not set u.voice, use browser default.
  let voiceForChunk = null;
  const tuned = __anprTuneProsody(s, (__anprSpeechState.rate || ttsRate || 0.8), (__anprSpeechState.pitch || ttsPitch || 1.0));
  u.rate = tuned.rate; u.pitch = tuned.pitch; u.volume = 1;

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
    // Advance to the next chunk after successful completion
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

    // Special handling for repeated 'interrupted' with no progress: treat as phantom cancel and re-speak same chunk once before advancing
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
    // Handle not-allowed: often autoplay/user-gesture policy. Try resume and smaller chunk retry.
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
    // If early repeated errors with no successes, run a one-time engine self-test
    if (__anprSuccessfulUtterances === 0 && __anprConsecutiveSpeakErrors >= 2) {
      try { anprEngineSelfTest(); } catch {}
    }
    // For non-interrupted errors, remember failing voice to deprioritize in recovery rotation
    try {
      if (errorType !== 'interrupted' && voiceForChunk && voiceForChunk.voiceURI) {
        __anprFailedVoiceURIs.add(voiceForChunk.voiceURI);
      }
    } catch {}
    // Treat 'interrupted' as a soft error (likely cancel/preemption). Do not escalate counters.
    if (errorType === 'interrupted') {
      __anprConsecutiveSpeakErrors = Math.max(0, __anprConsecutiveSpeakErrors - 1);
    }
    // Adaptive re-splitting for large first chunk failures before any success
    const shouldAdaptiveResplit = (errorType !== 'interrupted' && __anprSuccessfulUtterances === 0 && __anprConsecutiveSpeakErrors >= 2 && typeof s === 'string' && s.length > 220);
    if (shouldAdaptiveResplit) {
      try {
        const sub = anprSplitChunks(s, 120).filter(x => x && x.trim().length);
        if (sub.length >= 2) {
          console.debug('[ANPR][TTS] Adaptive re-splitting large failing chunk', { originalLen: s.length, newPieces: sub.length });
          // Replace current chunk with first piece; insert remaining immediately after
          __anprSpeechState.chunks.splice(__anprSpeechState.idx, 1, sub[0]);
          for (let i = 1; i < sub.length; i++) __anprSpeechState.chunks.splice(__anprSpeechState.idx + i, 0, sub[i]);
          // Reset error counter for fresh attempt on smaller piece
          __anprConsecutiveSpeakErrors = 0;
          setTimeout(anprSpeakNext, 0);
          return;
        }
      } catch (adE) {
        console.debug('[ANPR][TTS] Adaptive re-split failed', adE);
      }
    }
    // Skip this chunk and try the next; if too many consecutive errors, abort chapter
    __anprSpeechState.idx++;
    if (__anprConsecutiveSpeakErrors > 4) {
      // If we have not spoken anything successfully yet, attempt recovery BEFORE considering navigation
      if (__anprSuccessfulUtterances === 0) {
        const recovered = anprAttemptErrorRecovery();
        if (recovered) return; // recovery will restart speaking
        // If recovery failed and still no successes, do NOT auto-next; stop reading for safety
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
    // Apply exponential backoff after repeated errors to avoid hammering engine
    const backoffDelay = (__anprConsecutiveSpeakErrors > 2)
      ? Math.min(1200, __anprErrorBackoffBase * Math.pow(1.6, __anprConsecutiveSpeakErrors - 2))
      : 0;
    const delay = errorType === 'interrupted' ? 0 : backoffDelay;
    setTimeout(anprSpeakNext, delay);
  };

  try {
    // If chunk is empty or too short after filtering, skip without recursing immediately
    if (!s || (typeof s === 'string' && s.trim().length === 0)) {
      __anprSpeechState.idx++;
      setTimeout(anprSpeakNext, 0);
      return;
    }
    // Hard cap attempts to prevent stack/loop issues
    __anprSpeakAttempts++;
    if (__anprSpeakAttempts > __anprMaxUtterances) {
      console.warn('[ANPR] Utterance cap reached for this chapter, attempting auto-next.');
      __anprSpeechState.idx = __anprSpeechState.chunks.length;
      setTimeout(maybeAutoNext, 0);
      return;
    }
    // Defer the actual speak to break any synchronous event chains
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

// Flow watchdog: restart speaking if stalled (engine idle, not at end, no speech for >3.5s)
if (typeof __anprLastUtteranceTs === 'undefined') { var __anprLastUtteranceTs = 0; }
if (typeof __anprFlowWatchdog === 'undefined') { var __anprFlowWatchdog = null; }
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
        // Refined speaking-stuck detection: started but no boundary/end/error progress
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
          // Rotate voice after 2 stuck cycles
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
        // First-chunk hard adaptive re-split if completely stuck before any success
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
        // Safety: if at end but engine idle and advance lock stuck >2s, release it
        if (atEnd && idleTooLong && __anprAdvanceLock) {
          console.debug('[ANPR][Watchdog] Releasing stale advance lock.');
          __anprAdvanceLock = false; maybeAutoNext();
        }
      } catch {}
    }, 900);
  } catch {}
}
function anprStopFlowWatchdog() { try { if (__anprFlowWatchdog) { clearInterval(__anprFlowWatchdog); __anprFlowWatchdog = null; } } catch {} }


function maybeAutoNext() {
  // Only auto-advance when at end AND TTS truly finished
  const atEnd = __anprSpeechState.idx >= __anprSpeechState.chunks.length;
  console.debug('[ANPR] maybeAutoNext called.', { atEnd, ttsIdle: __anprTTSIdle, advanceLock: __anprAdvanceLock });
  if (!atEnd || !__anprTTSIdle) return;

  // Safeguard: if no successful utterances occurred in this chapter, do not auto-navigate.
  if (__anprSuccessfulUtterances < 1) {
    console.warn('[ANPR] Preventing auto-next: no successful utterances this chapter.');
    updateStatus('Speech failed; staying on this chapter.');
    __anprAdvanceLock = false; __anprSpeechState.reading = false; return;
  }

  if (__anprAdvanceLock) return;
  __anprAdvanceLock = true;
  __anprSpeechState.reading = false;

  if (__ANPR_MODE__ === 'infinite') {
    // Infinite append: nudge once then continueInfiniteReading to await new content
    __anprPhase = 'nudging';
    if (!__anprAppendNudged) {
      __anprAppendNudged = true;
      window.scrollBy({ top: 600, behavior: 'smooth' });
    }
    __anprPhase = 'waiting_append';
    // let the existing infinite logic pick up
    continueInfiniteReading();
    // release lock so future passages can proceed if needed
    setTimeout(() => { __anprAdvanceLock = false; __anprPhase = 'reading'; }, 2500);
    return;
  }

  // Chapter/page mode
  if (!autoNextEnabled) { 
    console.log('[ANPR] Auto Next is disabled, not navigating.');
    __anprAdvanceLock = false; 
    return; 
  }
  __anprPhase = 'navigating';
  const next = anprFindNextHref();
  if (next) {
    console.log('[ANPR] Found next href via anprFindNextHref:', next);
    try { 
      sessionStorage.setItem('autostart_reader', '1'); 
      console.log('[ANPR] Set autostart_reader flag in sessionStorage');
      // Persist latest settings before navigation so next page honors them
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          naturalPreset: __anprNaturalPreset,
          dynamicProsody: __anprDynamicProsody,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
    } catch (e) {
      console.error('[ANPR] Failed to set autostart flag:', e);
    }
    // Small delay to ensure flag is written
    setTimeout(() => {
      window.location.href = next;
    }, 50);
  } else {
    console.log('[ANPR] No href found, trying other methods...');
    try { 
      sessionStorage.setItem('autostart_reader', '1'); 
      console.log('[ANPR] Set autostart_reader flag in sessionStorage');
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          naturalPreset: __anprNaturalPreset,
          dynamicProsody: __anprDynamicProsody,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
    } catch (e) {
      console.error('[ANPR] Failed to set autostart flag:', e);
    }
    // Small delay before trying navigation
    setTimeout(() => {
      const ok = tryNextChapter();
      if (ok) {
        console.log('[ANPR] Navigating via tryNextChapter().');
      } else {
        console.warn('[ANPR] Could not find a next chapter link.');
        // couldn't navigate; release lock after short delay so user can retry
        setTimeout(() => { __anprAdvanceLock = false; __anprPhase = 'reading'; }, 1200);
      }
    }, 50);
  }
}

function startChapterReader(opts = {}) {
  if (__anprAdvanceLock) { return; }
  // Prevent duplicate starts that can cancel current speech and restart from the beginning
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
  // Voice selection removed; always let browser choose default
  try { __anprSpeechState.voice = null; } catch {}
  anprBuildFromDOM();
  // reset per-chapter counters
  __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0;
  __anprSuccessfulUtterances = 0; __anprErrorRecoveryAttempts = 0; // reset recovery counters per chapter
  // Ensure background session registered (so reinjection happens after navigation)
  try {
    if (autoNextEnabled && chrome?.runtime?.id) {
      const originPattern = location.origin + '/*';
      if (__anprTabId == null) { __anprAcquireTabId(); }
      // Defer registration slightly if tabId not yet known
      const doReg = () => {
        if (typeof __anprTabId === 'number') {
          chrome.runtime.sendMessage({ type: 'startAutoSession', tabId: __anprTabId, originPattern, mode: 'chapter' }, () => {});
        } else {
          // fallback: attempt again soon
          setTimeout(doReg, 200);
        }
      };
      doReg();
    }
  } catch {}
  // If nothing is ready yet, try a one-shot fallback extraction; else wait/observe
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

// Wait for content readiness (helpful for dynamic sites)
async function waitForReadableContent(timeoutMs = 3000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const txt = extractMainContent();
    if (txt && txt.length > 300) return txt;
    last = txt || last;
    // If content seems sparse and we haven't tried yet, gently auto-scroll to trigger lazy loading
    if (!__anprDidPreloadScroll && (last || '').length < 400) {
      try { await autoScrollFor(1200); __anprDidPreloadScroll = true; } catch {}
    }
    await new Promise(r => setTimeout(r, 140));
  }
  return last; // return best effort
}

// Gently scroll the page to help trigger infinite/lazy load content
function autoScrollFor(durationMs = 1200) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const now = performance.now();
      const t = now - start;
      // ease-out scroll steps
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

// Function to handle the text-to-speech
function startSpeech(text, rate = null, pitch = null, opts = {}) {
  try {
    // Guard against empty input only for infinite mode; chapter mode builds chunks itself
    if (__ANPR_MODE__ === 'infinite' && (!text || (typeof text === 'string' && text.trim().length === 0))) {
      console.warn('[ANPR] No text to speak (infinite mode); aborting startSpeech.');
      return;
    }
    // If this is an infinite-scroll site, keep existing flow
    if (__ANPR_MODE__ === 'infinite') {
      if (utterance) {
        try { anprInstrumentedCancel('infinite-restart'); } catch {}
      }
        // replaced above with instrumented cancel; keep logic sequence intact
      if (text) remainingText = text;
      utterance = new SpeechSynthesisUtterance(remainingText);
      try { if (text) { __anprLastTextLen = text.length; saveInfiniteProgress(); } } catch {}
      const langToUse = (opts.lang) || (ttsAutoLang ? detectPageLanguage() : 'en-US') || 'en-US';
      utterance.lang = langToUse;
      // Voice selection removed; rely on browser default voice
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
      // Chapter mode: if text provided, pre-seed chunks immediately; else build from DOM
      userStoppedReading = false;
      const opts2 = { rate: (typeof rate === 'number' ? rate : ttsRate), pitch: (typeof pitch === 'number' ? pitch : ttsPitch) };
      // Prepare speech state
      try { __anprReadingLock = true; window.speechSynthesis.cancel(); } catch {}
      __anprSpeechState.cancel = false; __anprSpeechState.reading = true; isReading = true;
      __anprSpeechState.rate = opts2.rate; __anprSpeechState.pitch = opts2.pitch;
      anprStartFlowWatchdog();
      // Voice selection removed
      try { __anprSpeechState.voice = null; } catch {}
      // Pick a container for scrolling context
      __anprSpeechState.container = anprPickContentContainer();
      // If caller provided text, use it directly to build chunks (avoid aggressive filters)
      const provided = (typeof text === 'string' ? text.trim() : '');
      if (provided && provided.length > 120) {
        const parts = provided.includes('\n\n') ? provided.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean) : anprSplitChunks(provided, 220);
        __anprSpeechState.chunks = parts; __anprSpeechState.idx = 0;
        __anprSpeakAttempts = 0; __anprConsecutiveSpeakErrors = 0; __anprSuccessfulUtterances = 0; __anprErrorRecoveryAttempts = 0;
        anprSpeakNext();
      } else {
        // Fallback to DOM-driven chapter reader
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

// Function to stop speech synthesis
function stopSpeech() {
  try {
    if (__ANPR_MODE__ === 'chapter') {
      userStoppedReading = true;
      stopChapterReader();
      isReading = false; // keep popup state consistent
      stopAutoScroll();
      console.log('User stopped the reading.');
    } else if (utterance && isReading) {
      userStoppedReading = true; // Set the flag to indicate user stopped the reading
      anprInstrumentedCancel('stop-infinite'); // Stop any ongoing speech
      isReading = false; // Update the status to not reading
        // instrumented cancel already handles readingLock lifecycle
      stopAutoScroll();
      console.log("User stopped the reading. Auto-next will not proceed.");
    }
  } catch (error) {
    console.error("Error while stopping speech synthesis:", error);
  }
}

// Auto-scroll loop to support infinite/lazy loading while reading
function startAutoScroll() {
  if (__autoScrollRAF) return; // already running
  const speedPxPerSec = 40; // gentle speed
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

// Save simple progress for infinite pages (scroll position + text length snapshot)
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

    const deadline = Date.now() + 20000; // up to ~20s trying
    while (Date.now() < deadline && !userStoppedReading) {
      // Try paragraph-based delta first
      const paras = collectInfiniteParagraphs();
      if (paras.length > __anprParaIndex) {
        const nextChunk = paras.slice(__anprParaIndex).join('\n\n').trim();
        __anprParaIndex = paras.length; // mark them as consumed
        __anprLastTextLen += nextChunk.length;
        saveInfiniteProgress();
        if (nextChunk) {
          startSpeech(nextChunk);
          return;
        }
      }

      // Else try gentle scrolling and wait for more content to load
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

// Function to skip forward in the text
function skipForward() {
  try {
    if (__anprSkipLock) return;
    __anprSkipLock = true; setTimeout(() => { __anprSkipLock = false; }, 350);
    if (__ANPR_MODE__ === 'chapter') {
      const total = __anprSpeechState.chunks.length || 0;
      const idx = __anprSpeechState.idx || 0;
      // Guard: block manual forward at the final chunk to avoid overshoot and loops
      if (total > 0 && idx >= total - 1) {
        updateStatus('End of chapter');
        return;
      }
      // Skip one chunk ahead
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
        userStoppedReading = false; // treat as natural end
        isReading = false; stopAutoScroll();
        // Trigger next chapter if appropriate
        if (autoNextEnabled) {
          try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
          // Persist latest flags before navigation for reliability
          try { chrome.storage?.local.set({ autoReadEnabled, autoNextEnabled }); } catch {}
          tryNextChapter();
        }
      }
    }
  } catch (error) {
    console.error('Error during forward skipping:', error);
  }
}

// Debugging helper: log current reader state
function __anprLogState(tag = 'state') {
  try {
    const mode = __ANPR_MODE__;
    const idx = __anprSpeechState.idx;
    const last = (__anprSpeechState.chunks?.length || 0) - 1;
    const nearEnd = last >= 0 && idx >= last;
    console.debug('[ANPR]', tag, { mode, idx, last, nearEnd, ttsIdle: __anprTTSIdle, phase: __anprPhase, advanceLock: __anprAdvanceLock });
  } catch {}
}

// Function to simulate a mouse click on the next chapter button
function clickNextChapterButton() {
  try {
    // Prefer multiple selectors commonly used across sites
    const selectors = [
      // NovelBin variants first
      'a#next_chap', '#next_chap', 'a#next', '#next', 'a#nextchapter', '#nextchapter', '.nextchap', '.next_chap', '.chr-nav-right a',
      // Generic
      'a[rel="next"]', '.next a', '.nav-next a', '.btn-next a', '.next-chap', '.next-chapter a'
    ];
    let nextButton = null;
    // Adapter preferred selector
    try {
      const host = location.hostname.replace(/^www\./,'').toLowerCase();
      const adapter = (__ANPR_ADAPTERS__ && __ANPR_ADAPTERS__[host]) || null;
      if (adapter && adapter.nextLinkSelector) {
        const el = document.querySelector(adapter.nextLinkSelector);
        if (el) nextButton = el;
      }
    } catch {}
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.offsetParent === null) return false;
      const st = getComputedStyle(el);
      return st.visibility !== 'hidden' && st.display !== 'none';
    };
    if (!nextButton) {
      for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) { nextButton = el; break; }
      }
    }
    if (nextButton) {
      // If there is a direct href and it is not the same page, prefer hard navigation
      const rawHref = nextButton.getAttribute && nextButton.getAttribute('href');
      if (rawHref) {
        try {
          const cur = new URL(location.href);
          const nxt = new URL(rawHref, location.href);
          if (!(cur.origin === nxt.origin && cur.pathname === nxt.pathname && cur.search === nxt.search)) {
            console.log('Navigating via next button href:', nxt.href);
            window.location.href = nxt.href;
            return true;
          }
        } catch {}
      }

      // Fallback: dispatch a click and verify navigation actually occurs
      const before = location.href;
      console.log('Clicking next button (no reliable href)');
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      nextButton.dispatchEvent(clickEvent);
      // After a short delay, if still on the same page, release advance lock to avoid deadlock
      setTimeout(() => {
        if (location.href === before) {
          console.debug('Click did not navigate; releasing advance lock or trying href fallback');
          try {
            const h = nextButton.getAttribute && nextButton.getAttribute('href');
            if (h) {
              const url = new URL(h, location.href);
              const cur2 = new URL(location.href);
              if (!(url.origin === cur2.origin && url.pathname === cur2.pathname && url.search === cur2.search)) {
                window.location.href = url.href; return;
              }
            }
          } catch {}
          // As last resort, clear lock so other strategies can try
          if (typeof __anprAdvanceLock !== 'undefined') __anprAdvanceLock = false;
        }
      }, 1200);
      return true;
    }
    console.log('Next chapter button not found.');
  } catch (error) {
    console.error('Error while clicking the next chapter button:', error);
  }
  return false;
}

// Function to attempt going to the next chapter using multiple methods
function tryNextChapter() {
  if (autoNextEnabled && !isReading) {
    console.log('Attempting all methods to reach the next chapter...');
    
    // Attempt to click the next chapter button first
    if (clickNextChapterButton()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          naturalPreset: __anprNaturalPreset,
          dynamicProsody: __anprDynamicProsody,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
      console.log('Successfully clicked the next chapter button.');
      return true;
    } else if (tryIncrementalUrl()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          naturalPreset: __anprNaturalPreset,
          dynamicProsody: __anprDynamicProsody,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
      console.log('Next chapter found by incrementing the URL');
      return true;
    } else if (checkForRelNext()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
      console.log("Next chapter found via rel='next'");
      return true;
    } else if (findNextLinkByText()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      try {
        chrome.storage?.local.set({
          autoReadEnabled,
          autoNextEnabled,
          autoScrollWhileReading,
          ttsRate,
          ttsPitch,
          ttsAutoLang,
          voiceURI: preferredVoiceURI,
          strictFiltering: __anprStrictFiltering,
          customIgnorePhrases: __anprCustomIgnorePhrases,
          customNextSelectors: __anprCustomNextSelectors
        });
      } catch {}
      console.log('Next chapter link found by text');
      return true;
    } else {
      console.log('Failed to go to the next chapter using all methods.');
      return false;
    }
  }
  return false;
}

// Automatically start reading and attempting to go to the next chapter when loaded
function autoStartReadingOnNextChapter() {
  const handleAutoStart = (event) => {
    console.debug(`[ANPR] handleAutoStart triggered by '${event.type}' event.`);
    // If we arrived via our auto-next, autostart regardless of popup state
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
      // Increased delay to ensure DOM is ready and voices are loaded
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
      }, 800); // Increased from 400ms to 800ms
      return;
    }

    if (autoReadEnabled) {
      console.log("[ANPR] Page loaded. AutoRead is ON, starting read...");
      setTimeout(() => {
        const text = extractMainContent();
        if (text) {
          console.log('[ANPR] Content extracted, starting speech...');
          startSpeech(text); // Start reading the new chapter
        } else {
          console.log("[ANPR] No content found to read. Starting retry loop.");
          startAutoStartRetryLoop('autoRead');
        }
      }, 500);
    } else {
      console.log('[ANPR] AutoRead is OFF, not starting automatically.');
    }
  };

  window.addEventListener('load', handleAutoStart);
  // Also handle pageshow (BFCache or late paint) similarly
  window.addEventListener('pageshow', handleAutoStart);
}

// Automatically start the auto next chapter and auto-read process (guarded)
if (window.__AutoNextReaderInitialized) {
  autoStartReadingOnNextChapter();
}

// Watchdog: if speech pauses while tab is inactive/minimized, attempt resume
if (!window.__ANPR_ResumeWatchdog) {
  window.__ANPR_ResumeWatchdog = setInterval(() => {
    try {
      if (!userStoppedReading && typeof speechSynthesis !== 'undefined') {
        if (speechSynthesis.paused && isReading) {
          speechSynthesis.resume();
        }
      }
    } catch {}
  }, 2000);
  try { document.addEventListener('visibilitychange', () => { try { if (!userStoppedReading) speechSynthesis.resume(); } catch {} }); } catch {}
}

// Retry loop: if autostart flag or autoReadEnabled is set but content wasn't ready, retry a few times
function startAutoStartRetryLoop(reason='retry') {
  try {
    if (window.__ANPR_AutoStartLoop) return;
    let attempts = 0; const maxAttempts = 14; // ~7s at 500ms
    window.__ANPR_AutoStartLoop = setInterval(async () => {
      attempts++;
      if (isReading || __anprSpeechState.reading) { clearInterval(window.__ANPR_AutoStartLoop); window.__ANPR_AutoStartLoop = null; return; }
      let shouldAuto = false;
      try { shouldAuto = sessionStorage.getItem('autostart_reader') === '1'; } catch {}
      if (!shouldAuto && !autoReadEnabled) { clearInterval(window.__ANPR_AutoStartLoop); window.__ANPR_AutoStartLoop = null; return; }
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

    // On URL change, re-init reading if auto-start is desired
    const onUrlChange = () => {
      console.debug('[ANPR] SPA URL change detected.');
      // Clear any advance lock from previous page
      try { __anprAdvanceLock = false; } catch {}
      let shouldAutoStart = false;
      try {
        const flag = sessionStorage.getItem('autostart_reader');
        console.debug('[ANPR] SPA: Checked sessionStorage for autostart_reader flag:', flag);
        shouldAutoStart = flag === '1';
      } catch (e) {
        console.error('[ANPR] SPA: Error reading sessionStorage:', e);
      }
      if (!shouldAutoStart && !autoReadEnabled) {
        console.debug('[ANPR] SPA: No autostart flag and AutoRead is OFF. Aborting.');
        return;
      }
      // Consume autostart flag if present
      if (shouldAutoStart) { try { sessionStorage.removeItem('autostart_reader'); } catch {} }
      // Small delay to let DOM update
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
  });
} catch {}

// Robust fallback auto-start scheduler: retries for up to 10s if autostart flag or autoReadEnabled present but content not ready
try {
  (function autoStartFallbackLoop() {
    if (window.__ANPR_FallbackStarted) return; window.__ANPR_FallbackStarted = true;
    const t0 = Date.now();
    const interval = setInterval(async () => {
      if (userStoppedReading) { clearInterval(interval); return; }
      const age = Date.now() - t0;
      let flag = false;
      try { flag = sessionStorage.getItem('autostart_reader') === '1'; } catch {}
      if (!flag && !autoReadEnabled) {
        if (age > 10000) clearInterval(interval);
        return;
      }
      // If already reading, stop fallback
      if (__anprSpeechState.reading || isReading) { clearInterval(interval); return; }
      // Attempt extraction
      const txt = await waitForReadableContent(2500);
      if (txt && txt.length > 200) {
        if (flag) { try { sessionStorage.removeItem('autostart_reader'); } catch {} }
        console.log('[ANPR] Fallback auto-start engaging…');
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
      // Attempt recovery only if we had been reading
      if (!__anprSpeechState.reading && isReading && !userStoppedReading) {
        console.log('[ANPR] Visibility change: attempting speech recovery…');
        startChapterReader({ rate: ttsRate, pitch: ttsPitch });
      }
    }
  });
} catch {}

// Keyboard shortcut to stop and resume reading with Ctrl + ``
if (!window.__AutoNextReaderKeydownBound) {
  window.__AutoNextReaderKeydownBound = true;
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === '`') {
      if (isReading) {
        stopSpeech(); // Stop reading
      } else if (!isReading && remainingText) {
        startSpeech(remainingText); // Resume reading from where it stopped
        anprStartFlowWatchdog();
      }
    }
    // Show/hide on-page control overlay: Ctrl+Shift+O
    if (event.ctrlKey && event.shiftKey && (event.key === 'O' || event.key === 'o')) {
      toggleOverlay();
    }
  });
}

// Re-start if voices list gets populated late and autostart flag is pending (Chrome quirk)
try {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    try {
      if (__ANPR_MODE__ === 'chapter' && !__anprSpeechState.reading) {
        if (sessionStorage.getItem('autostart_reader') === '1') {
          sessionStorage.removeItem('autostart_reader');
          startChapterReader({ rate: ttsRate, pitch: ttsPitch });
        }
      }
    } catch {}
  });
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

// Check for rel="next" in links
function checkForRelNext() {
  try {
    const nextRelLink = document.querySelector('a[rel="next"]');
    if (nextRelLink && nextRelLink.href) {
      console.log("Following rel='next' link:", nextRelLink.href);
      window.location.href = nextRelLink.href;
      return true;
    } else {
      console.log("No rel='next' link found.");
    }
  } catch (error) {
    console.error('Error while checking rel="next":', error);
  }
  return false;
}

// Try incrementing the chapter or page number in the URL path
function tryIncrementalUrl() {
  try {
    const currentUrl = window.location.href;
    // Common URL patterns for chapters/pages
    const patterns = [
      /(chapter[-_\/]?)(\d+)/i,
      /(ch[-_\/]?)(\d+)/i,
      /(episode[-_\/]?)(\d+)/i,
      /([?&](?:chapter|ch|ep|page)=(\d+))/i
    ];

    for (const pattern of patterns) {
      const match = currentUrl.match(pattern);
      if (match) {
        const fullMatch = match[0];
        const prefix = match[1];
        const num = parseInt(match[2]);
        if (!isNaN(num)) {
          const next = num + 1;
          let newUrl;
          if (fullMatch.startsWith('?') || fullMatch.startsWith('&')) {
            newUrl = currentUrl.replace(pattern, (m, g1, g2) => m.replace(g2, String(next)));
          } else {
            newUrl = currentUrl.replace(pattern, `${prefix}${next}`);
          }
          console.log('Attempting URL increment:', newUrl);
          window.location.href = newUrl;
          return true;
        }
      }
    }
    console.log('No incrementable chapter pattern detected in URL.');
  } catch (error) {
    console.error('Error while incrementing URL:', error);
  }
  return false;
}

// Find a likely "next" link by common text labels
function findNextLinkByText() {
  try {
    const texts = [
      'next', 'next chapter', 'next »', '»', '›', '→', '>>', '下一章', 'التالي', 'suivant'
    ];
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      const label = (a.innerText || a.textContent || '').trim().toLowerCase();
      if (!label) continue;
      if (texts.some(t => label === t || label.includes(t))) {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && a.offsetParent !== null) {
          console.log('Following next link by text:', href);
          a.click();
          return true;
        }
      }
    }
  } catch (e) {
    console.error('Error while finding next link by text:', e);
  }
  return false;
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
        (async () => {
          if (__ANPR_MODE__ === 'infinite') {
            // Try unread paragraphs first
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
            // If nothing unread yet, wait and try again
            const text2 = await waitForReadableContent(3500);
            if (text2) {
              const delta = text2.slice(__anprLastTextLen).trim();
              __anprLastTextLen = text2.length;
              const startTxt = delta || text2; // best-effort
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
                  // Proactively start the chapter reader that builds from DOM and observes changes
                  startChapterReader({ rate: message.rate, pitch: message.pitch, voiceURI: message.voiceURI });
                  anprObserveContentUntilReady();
                }
          }
        })();
      } else if (message.action === 'skipForward') {
        skipForward(); // Skip forward in the text
      } else if (message.action === 'stopSpeech') {
        stopSpeech(); // Stop speech from popup
      } else if (message.action === 'getVoices') {
        // Return available voices; if not ready, wait for voiceschanged once
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
            try { sendResponse({ voices: buildPayload() }); } catch { /* ignore */ }
          };
          window.speechSynthesis.addEventListener('voiceschanged', once);
        }
        return true; // async
      } else if (message.action === 'previewVoice') {
        try {
          // Do not interrupt if currently reading/playing
          if (__anprSpeechState.reading || isReading || window.speechSynthesis.speaking) {
            sendResponse && sendResponse({ ok: false, reason: 'busy' });
            return true;
          }
          const sample = 'This is a short voice preview.';
          const u = new SpeechSynthesisUtterance(sample);
          if (message.voiceURI) {
            const vs = window.speechSynthesis.getVoices() || [];
            const vv = vs.find(v => v.voiceURI === message.voiceURI);
            if (vv) u.voice = vv;
          }
          u.rate = typeof message.rate === 'number' ? message.rate : (ttsRate || 0.9);
          u.pitch = typeof message.pitch === 'number' ? message.pitch : (ttsPitch || 1.0);
          u.onend = () => { try { sendResponse && sendResponse({ ok: true }); } catch {} };
          window.speechSynthesis.speak(u);
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
        // Instant provisional start: speak first 1-2 paragraphs quickly, queue rest
        (async () => {
          try {
            if (__anprSpeechState.reading || isReading) { sendResponse && sendResponse({ ok:false, reason:'already-reading' }); return; }
            __anprSpeechState.cancel = false; __anprSpeechState.reading = true; isReading = true;
            __anprSpeechState.rate = ttsRate; __anprSpeechState.pitch = ttsPitch; __anprSpeechState.voice = null;
            __anprSpeechState.container = anprPickContentContainer();
            const paras = anprCollectParagraphsForCurrentSite(__anprSpeechState.container);
            if (!paras.length) {
              // Fallback to quick Readability extraction
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
      }
    } catch (error) {
      console.error("Error while handling message:", error);
    }
  });
}

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
      // Store latest settings
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
