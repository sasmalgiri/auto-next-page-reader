// =====================================================================
// content-config.js — Global state, configuration, site profiles, and
// low-level utility functions shared by every other content module.
// Loaded FIRST via chrome.scripting.executeScript.
// =====================================================================

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

if (typeof __anprSpeakAttempts === 'undefined') {
  var __anprSpeakAttempts = 0; // per-chapter utterance attempts
}
if (typeof __anprMaxUtterances === 'undefined') {
  var __anprMaxUtterances = 600; // hard cap to avoid pathological loops
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

// Translation feature globals (premium)
if (typeof __anprTranslateEnabled === 'undefined') { var __anprTranslateEnabled = false; }
if (typeof __anprTranslateApiKey === 'undefined') { var __anprTranslateApiKey = null; }
if (typeof __anprHindiVoiceGender === 'undefined') { var __anprHindiVoiceGender = 'female'; }
if (typeof __anprHindiVoiceURI === 'undefined') { var __anprHindiVoiceURI = null; }
if (typeof __anprPremiumActive === 'undefined') { var __anprPremiumActive = false; }

// Flow watchdog state
if (typeof __anprLastUtteranceTs === 'undefined') { var __anprLastUtteranceTs = 0; }
if (typeof __anprFlowWatchdog === 'undefined') { var __anprFlowWatchdog = null; }

// ---------- Low-level utility functions ----------

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
    // Load translation/premium settings
    chrome.storage?.local.get(['translateEnabled', 'hindiVoiceGender', 'hindiVoiceURI', 'premiumActive'], (td) => {
      if (typeof td.translateEnabled === 'boolean') __anprTranslateEnabled = td.translateEnabled;
      if (typeof td.hindiVoiceGender === 'string') __anprHindiVoiceGender = td.hindiVoiceGender;
      if (typeof td.hindiVoiceURI === 'string') __anprHindiVoiceURI = td.hindiVoiceURI;
      if (typeof td.premiumActive === 'boolean') __anprPremiumActive = td.premiumActive;
    });
    chrome.storage?.sync?.get(['translateApiKey', 'premiumKey'], (sd) => {
      if (typeof sd.translateApiKey === 'string' && sd.translateApiKey) __anprTranslateApiKey = sd.translateApiKey;
      if (typeof sd.premiumKey === 'string' && sd.premiumKey) __anprPremiumActive = true;
    });
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
