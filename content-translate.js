// =====================================================================
// content-translate.js — Hindi translation engine with literary
// post-processing for novel reading.
// Flow: Extract page → Translate full text → Store in chrome.storage.local
//       → Read from storage using a single Hindi voice
// Supports free Google Translate + optional Google Cloud API key.
// Depends on: content-config.js, content-extract.js
// =====================================================================

// Translation cache: keyed by page URL
if (typeof __anprTranslateCache === 'undefined') {
  var __anprTranslateCache = new Map();
}

// Hindi voice — locked to one voice for the entire reading session
if (typeof __anprCachedHindiVoice === 'undefined') {
  var __anprCachedHindiVoice = null;
}
if (typeof __anprCachedHindiGender === 'undefined') {
  var __anprCachedHindiGender = null;
}

// ---------- Full Page Translation + Storage ----------

// Main entry: translate entire page, store in chrome.storage.local, return translated chunks
async function anprTranslateFullChapter(paragraphs) {
  if (!Array.isArray(paragraphs) || !paragraphs.length) return paragraphs;

  // Use page URL as storage key
  const pageUrl = location.href;
  const storageKey = 'anpr_hindi_' + _anprHashCode(pageUrl);

  // 1. Check chrome.storage.local first
  try {
    const stored = await new Promise((resolve) => {
      chrome.storage?.local.get([storageKey], (data) => {
        resolve(data && data[storageKey] ? data[storageKey] : null);
      });
    });
    if (stored && Array.isArray(stored.chunks) && stored.chunks.length > 0) {
      console.debug('[ANPR][Translate] Loaded Hindi text from chrome.storage.local (' + stored.chunks.length + ' chunks)');
      updateStatus('Loaded Hindi translation from cache. Reading...');
      return stored.chunks;
    }
  } catch (e) {
    console.debug('[ANPR][Translate] Storage read failed:', e);
  }

  // 2. Check in-memory cache
  if (__anprTranslateCache.has(storageKey)) {
    console.debug('[ANPR][Translate] Using in-memory cached translation');
    return __anprTranslateCache.get(storageKey);
  }

  // 3. Translate the full page text
  updateStatus('Translating entire chapter to Hindi... Please wait.');

  const translated = [];

  // Translate in batches (~4500 chars per batch for Google Translate free limit)
  const MAX_BATCH_CHARS = 4500;
  let batch = [];
  let batchLen = 0;
  let batchCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = (paragraphs[i] || '').trim();
    if (!para) continue;

    if (batchLen + para.length > MAX_BATCH_CHARS && batch.length > 0) {
      batchCount++;
      updateStatus('Translating to Hindi... (' + batchCount + ' batches done)');
      const batchText = batch.join('\n\n');
      const result = await _anprTranslateBatch(batchText);
      if (result) {
        const parts = result.split(/\n\n/).map(p => p.trim()).filter(Boolean);
        translated.push(...parts);
      } else {
        translated.push(...batch); // fallback to English
      }
      batch = [];
      batchLen = 0;
    }

    batch.push(para);
    batchLen += para.length;
  }

  // Translate remaining batch
  if (batch.length > 0) {
    batchCount++;
    updateStatus('Translating to Hindi... (final batch)');
    const batchText = batch.join('\n\n');
    const result = await _anprTranslateBatch(batchText);
    if (result) {
      const parts = result.split(/\n\n/).map(p => p.trim()).filter(Boolean);
      translated.push(...parts);
    } else {
      translated.push(...batch);
    }
  }

  const cleaned = translated.filter(t => t && t.trim());
  if (cleaned.length === 0) return paragraphs;

  // 4. Store in chrome.storage.local for reading from storage (not website)
  try {
    const storageData = {};
    storageData[storageKey] = { chunks: cleaned, url: pageUrl, timestamp: Date.now() };
    chrome.storage?.local.set(storageData, () => {
      console.debug('[ANPR][Translate] Saved Hindi translation to chrome.storage.local');
    });
  } catch (e) {
    console.debug('[ANPR][Translate] Storage write failed:', e);
  }

  // 5. Also cache in memory
  __anprTranslateCache.set(storageKey, cleaned);

  updateStatus('Translation complete! Starting Hindi reading...');
  return cleaned;
}

// Simple hash function for creating storage keys
function _anprHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ---------- Translation API ----------

async function _anprTranslateBatch(text) {
  if (!text || !text.trim()) return null;
  try {
    const apiKey = __anprTranslateApiKey;
    let result = null;
    if (apiKey) {
      result = await _anprTranslateCloud(text, apiKey);
    }
    if (!result) {
      result = await _anprTranslateFree(text);
    }
    return result;
  } catch (e) {
    console.warn('[ANPR][Translate] Batch translation failed:', e);
    return null;
  }
}

async function _anprTranslateFree(text) {
  try {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encoded}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      let result = '';
      for (const segment of data[0]) {
        if (Array.isArray(segment) && segment[0]) {
          result += segment[0];
        }
      }
      return result.trim() || null;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Free API error:', e);
  }
  return null;
}

async function _anprTranslateCloud(text, apiKey) {
  try {
    const resp = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'hi', format: 'text' })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.data && data.data.translations && data.data.translations[0]) {
      return data.data.translations[0].translatedText || null;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Cloud API error:', e);
  }
  return null;
}

// ---------- Hindi Literary Post-Processing ----------

if (typeof __anprDialogueVerbIdx === 'undefined') {
  var __anprDialogueVerbIdx = 0;
}

function anprHindiPostProcess(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;

  // 1. Punctuation: . → purna viram (।)
  t = t.replace(/\.(\s|$)/g, '\u0964$1');
  t = t.replace(/\s+\u0964/g, '\u0964');
  t = t.replace(/\u0964(?=\S)/g, '\u0964 ');

  // 2. Dialogue enhancement: vary "said" translations
  const saidVariants = [
    '\u092C\u094B\u0932\u093E', '\u0915\u0939\u093E', '\u092A\u0941\u0915\u093E\u0930\u093E',
    '\u092C\u094B\u0932\u0940', '\u0915\u0939\u0924\u0947 \u0939\u0941\u090F',
    '\u0938\u0941\u0928\u093E\u092F\u093E', '\u092C\u0924\u093E\u092F\u093E',
  ];
  t = t.replace(/\u0928\u0947 \u0915\u0939\u093E/g, () => {
    const v = saidVariants[__anprDialogueVerbIdx % saidVariants.length];
    __anprDialogueVerbIdx++;
    return '\u0928\u0947 ' + v;
  });

  // 3. Narrative flow connectors
  t = t.replace(/\bAnd then\b/gi, '\u0914\u0930 \u092B\u093F\u0930');
  t = t.replace(/\bSuddenly\b/gi, '\u0905\u091A\u093E\u0928\u0915');
  t = t.replace(/\bHowever\b/gi, '\u0932\u0947\u0915\u093F\u0928');
  t = t.replace(/\bMeanwhile\b/gi, '\u0907\u0938\u0940 \u092C\u0940\u091A');
  t = t.replace(/\bTherefore\b/gi, '\u0907\u0938\u0932\u093F\u090F');
  t = t.replace(/\bNevertheless\b/gi, '\u092B\u093F\u0930 \u092D\u0940');
  t = t.replace(/\bAt that moment\b/gi, '\u0924\u092D\u0940');
  t = t.replace(/\bIn the end\b/gi, '\u0905\u0902\u0924 \u092E\u0947\u0902');

  // 4. Remove leftover English articles/modals GT sometimes leaves
  t = t.replace(/\b(the|a|an|is|was|were|are|been|being|have|has|had|do|does|did)\b/gi, '');
  t = t.replace(/\b(shall|should|would|could|might|must|may|can|will)\b/gi, '');

  // 5. Clean up spacing
  t = t.replace(/\s{2,}/g, ' ').trim();

  // 6. Fix quotation mark spacing
  t = t.replace(/"\s*/g, '"');
  t = t.replace(/\s*"/g, '"');

  // 7. Thought variations
  t = t.replace(/\u0938\u094B\u091A\u093E/g, () => {
    const vars = ['\u0938\u094B\u091A\u093E', '\u0935\u093F\u091A\u093E\u0930 \u0915\u093F\u092F\u093E', '\u092E\u0928 \u092E\u0947\u0902 \u0938\u094B\u091A\u093E'];
    return vars[Math.floor(Math.random() * vars.length)];
  });

  return t;
}

function anprHindiPostProcessAll(paragraphs) {
  __anprDialogueVerbIdx = 0;
  return paragraphs.map(p => anprHindiPostProcess(p));
}

// ---------- Hindi Voice Selection ----------

function anprPickHindiVoice(gender) {
  // Return cached voice if gender matches
  if (__anprCachedHindiVoice && __anprCachedHindiGender === gender) {
    return __anprCachedHindiVoice;
  }

  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];

    // Log all available voices for debugging
    console.debug('[ANPR][Voice] Total voices available:', voices.length);

    const hindiVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('hi') || lang === 'hi-in';
    });

    console.debug('[ANPR][Voice] Hindi voices:', hindiVoices.map(v =>
      '  ' + v.name + ' [' + v.lang + '] local=' + v.localService
    ));

    if (!hindiVoices.length) {
      // No Hindi voices — try to find any voice that has "hindi" in the name
      const fallbackHindi = voices.filter(v => /hindi/i.test(v.name));
      if (fallbackHindi.length) {
        console.debug('[ANPR][Voice] Using fallback Hindi voice:', fallbackHindi[0].name);
        __anprCachedHindiVoice = fallbackHindi[0];
        __anprCachedHindiGender = gender;
        return fallbackHindi[0];
      }
      console.warn('[ANPR][Voice] No Hindi voices found at all');
      return null;
    }

    const preferredGender = gender || __anprHindiVoiceGender || 'female';
    console.debug('[ANPR][Voice] Looking for gender:', preferredGender);

    // If only one Hindi voice exists, just use it regardless of gender
    if (hindiVoices.length === 1) {
      console.debug('[ANPR][Voice] Only 1 Hindi voice available, using it:', hindiVoices[0].name);
      __anprCachedHindiVoice = hindiVoices[0];
      __anprCachedHindiGender = gender;
      return hindiVoices[0];
    }

    // Score voices for gender + quality
    const scored = hindiVoices.map(v => {
      let score = 0;
      const name = (v.name || '').toLowerCase();

      // Gender matching — Edge voices: "Swara" = female, "Madhur" = male
      // Chrome voices may use different naming
      const isFemaleVoice = /swara|female|woman|stree|mahila|neerja|sapna/i.test(name);
      const isMaleVoice = /madhur|male|man|purus|hemant|kalpesh/i.test(name);

      if (preferredGender === 'male') {
        if (isMaleVoice) score += 15;
        else if (isFemaleVoice) score -= 10;
        else score += 0; // unknown gender, neutral
      } else {
        if (isFemaleVoice) score += 15;
        else if (isMaleVoice) score -= 10;
        else score += 0;
      }

      // Quality: prefer natural/neural/online voices
      if (/neural|natural|premium|online/i.test(name)) score += 5;
      if (!v.localService) score += 3;
      if (/microsoft/i.test(name)) score += 2;

      return { voice: v, score, name: v.name };
    });

    scored.sort((a, b) => b.score - a.score);
    console.debug('[ANPR][Voice] Scored:', scored.map(s => s.name + ' = ' + s.score));

    const best = scored[0];
    if (best) {
      console.debug('[ANPR][Voice] SELECTED:', best.name, 'score:', best.score, 'for gender:', preferredGender);
      __anprCachedHindiVoice = best.voice;
      __anprCachedHindiGender = gender;
      return best.voice;
    }
  } catch (e) {
    console.warn('[ANPR][Voice] Selection error:', e);
  }
  return null;
}

function anprResetHindiVoiceCache() {
  __anprCachedHindiVoice = null;
  __anprCachedHindiGender = null;
}

function anprEnsureVoicesLoaded() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 3000);
  });
}

// ---------- Utility ----------

function anprClearTranslateCache() {
  try { __anprTranslateCache.clear(); } catch {}
  anprResetHindiVoiceCache();
  // Also clear stored translations from chrome.storage.local
  try {
    chrome.storage?.local.get(null, (all) => {
      const keys = Object.keys(all || {}).filter(k => k.startsWith('anpr_hindi_'));
      if (keys.length) chrome.storage.local.remove(keys);
    });
  } catch {}
}
