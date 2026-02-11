// =====================================================================
// content-navigation.js — Next chapter/page detection and navigation.
// Handles finding next links via selectors, rel="next", URL increment,
// text scanning, and the maybeAutoNext decision logic.
// Depends on: content-config.js, content-extract.js, content-tts.js
// =====================================================================

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

// Helper: persist current settings before navigation
function __anprPersistSettingsBeforeNav() {
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
      customNextSelectors: __anprCustomNextSelectors,
      translateEnabled: __anprTranslateEnabled,
      hindiVoiceGender: __anprHindiVoiceGender,
      premiumActive: __anprPremiumActive
    });
  } catch {}
}

function maybeAutoNext() {
  const atEnd = __anprSpeechState.idx >= __anprSpeechState.chunks.length;
  console.debug('[ANPR] maybeAutoNext called.', { atEnd, ttsIdle: __anprTTSIdle, advanceLock: __anprAdvanceLock });
  if (!atEnd || !__anprTTSIdle) return;

  if (__anprSuccessfulUtterances < 1) {
    console.warn('[ANPR] Preventing auto-next: no successful utterances this chapter.');
    updateStatus('Speech failed; staying on this chapter.');
    __anprAdvanceLock = false; __anprSpeechState.reading = false; return;
  }

  if (__anprAdvanceLock) return;
  __anprAdvanceLock = true;
  __anprSpeechState.reading = false;

  if (__ANPR_MODE__ === 'infinite') {
    __anprPhase = 'nudging';
    if (!__anprAppendNudged) {
      __anprAppendNudged = true;
      window.scrollBy({ top: 600, behavior: 'smooth' });
    }
    __anprPhase = 'waiting_append';
    continueInfiniteReading();
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
      __anprPersistSettingsBeforeNav();
    } catch (e) {
      console.error('[ANPR] Failed to set autostart flag:', e);
    }
    setTimeout(() => {
      window.location.href = next;
    }, 50);
  } else {
    console.log('[ANPR] No href found, trying other methods...');
    try {
      sessionStorage.setItem('autostart_reader', '1');
      console.log('[ANPR] Set autostart_reader flag in sessionStorage');
      __anprPersistSettingsBeforeNav();
    } catch (e) {
      console.error('[ANPR] Failed to set autostart flag:', e);
    }
    setTimeout(() => {
      const ok = tryNextChapter();
      if (ok) {
        console.log('[ANPR] Navigating via tryNextChapter().');
      } else {
        console.warn('[ANPR] Could not find a next chapter link.');
        setTimeout(() => { __anprAdvanceLock = false; __anprPhase = 'reading'; }, 1200);
      }
    }, 50);
  }
}

// Function to simulate a mouse click on the next chapter button
function clickNextChapterButton() {
  try {
    const selectors = [
      'a#next_chap', '#next_chap', 'a#next', '#next', 'a#nextchapter', '#nextchapter', '.nextchap', '.next_chap', '.chr-nav-right a',
      'a[rel="next"]', '.next a', '.nav-next a', '.btn-next a', '.next-chap', '.next-chapter a'
    ];
    let nextButton = null;
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
      const before = location.href;
      console.log('Clicking next button (no reliable href)');
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      nextButton.dispatchEvent(clickEvent);
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

    if (clickNextChapterButton()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      __anprPersistSettingsBeforeNav();
      console.log('Successfully clicked the next chapter button.');
      return true;
    } else if (tryIncrementalUrl()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      __anprPersistSettingsBeforeNav();
      console.log('Next chapter found by incrementing the URL');
      return true;
    } else if (checkForRelNext()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      __anprPersistSettingsBeforeNav();
      console.log("Next chapter found via rel='next'");
      return true;
    } else if (findNextLinkByText()) {
      try { sessionStorage.setItem('autostart_reader', '1'); } catch {}
      __anprPersistSettingsBeforeNav();
      console.log('Next chapter link found by text');
      return true;
    } else {
      console.log('Failed to go to the next chapter using all methods.');
      return false;
    }
  }
  return false;
}

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
