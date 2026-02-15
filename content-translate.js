// =====================================================================
// content-translate.js — Hindi translation engine (chunk-by-chunk).
// Translates one paragraph at a time. No storage. Reads simultaneously.
// Supports: Google Translate (free, no key) + Gemini API (optional key).
// Depends on: content-config.js
// =====================================================================

// In-memory translation cache (per page session, no storage)
if (typeof __anprTranslateCache === 'undefined') {
  var __anprTranslateCache = {};
}

// Pre-translated buffer: { chunkIndex: translatedText }
if (typeof __anprPreTranslated === 'undefined') {
  var __anprPreTranslated = {};
}

// Hindi voice — locked to one voice for the entire reading session
if (typeof __anprCachedHindiVoice === 'undefined') {
  var __anprCachedHindiVoice = null;
}
if (typeof __anprCachedHindiGender === 'undefined') {
  var __anprCachedHindiGender = null;
}

// Gemini API key (hardcoded default, can be overridden via popup)
if (typeof __anprGeminiApiKey === 'undefined') {
  var __anprGeminiApiKey = 'AIzaSyAejMHswTRHv1w4VTLTBs3F3hlRB8gImAU';
  try {
    chrome.storage?.local.get(['geminiApiKey'], (d) => {
      if (d && typeof d.geminiApiKey === 'string' && d.geminiApiKey.trim()) {
        __anprGeminiApiKey = d.geminiApiKey.trim();
      }
    });
  } catch {}
}

// ---------- Single Chunk Translation ----------

// Translate a single text chunk to Hindi.
// Returns translated text, or original text on failure.
async function anprTranslateChunk(text) {
  if (!text || !text.trim()) return text;
  const key = text.trim();

  // Check in-memory cache
  if (__anprTranslateCache[key]) return __anprTranslateCache[key];

  // Hard timeout: if translation takes >20s total, return original
  const doTranslate = async () => {
    let result = null;

    // Try Gemini API first if key is available
    if (__anprGeminiApiKey) {
      result = await _anprTranslateGemini(key, __anprGeminiApiKey);
    }

    // Fallback to Google Translate free API
    if (!result) {
      result = await _anprTranslateFree(key);
    }

    return result;
  };

  try {
    const result = await Promise.race([
      doTranslate(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('translate_timeout')), 20000))
    ]);

    if (result && result.trim()) {
      const processed = anprHindiPostProcess(result);
      __anprTranslateCache[key] = processed;
      return processed;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Chunk translation failed/timed out:', e.message || e);
  }

  return text; // fallback to English
}

// Pre-translate a chunk and store in buffer (called while current chunk is speaking)
async function anprPreTranslateChunk(chunkIndex, chunks) {
  if (!chunks || chunkIndex >= chunks.length) return;
  const text = chunks[chunkIndex];
  if (!text) return;
  if (__anprPreTranslated[chunkIndex]) return; // already done

  try {
    const translated = await anprTranslateChunk(text);
    __anprPreTranslated[chunkIndex] = translated;
  } catch {}
}

// Get pre-translated text for a chunk index, or null
function anprGetPreTranslated(chunkIndex) {
  return __anprPreTranslated[chunkIndex] || null;
}

// Clear pre-translation buffer (on new chapter)
function anprClearPreTranslated() {
  __anprPreTranslated = {};
}

// ---------- Google Translate Free API ----------

async function _anprTranslateFree(text) {
  try {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encoded}`;
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 10000);
    const resp = await fetch(url, { signal: ac.signal });
    clearTimeout(tid);
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

// ---------- Gemini API ----------

async function _anprTranslateGemini(text, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const prompt = `Translate the following English novel text to Hindi. Use natural, literary Hindi suitable for audiobook narration. Keep dialogue natural. Do NOT add any explanation, just output the Hindi translation:\n\n${text}`;

    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 15000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    });
    clearTimeout(tid);

    if (!resp.ok) {
      console.debug('[ANPR][Gemini] API error:', resp.status);
      return null;
    }

    const data = await resp.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.debug('[ANPR][Gemini] Translation OK, length:', (output || '').length);
    return output ? output.trim() : null;
  } catch (e) {
    console.warn('[ANPR][Gemini] Translation error:', e);
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
  ];
  t = t.replace(/\u0928\u0947 \u0915\u0939\u093E/g, () => {
    const v = saidVariants[__anprDialogueVerbIdx % saidVariants.length];
    __anprDialogueVerbIdx++;
    return '\u0928\u0947 ' + v;
  });

  // 3. Remove leftover English articles GT sometimes leaves
  t = t.replace(/\b(the|a|an|is|was|were|are)\b/gi, '');

  // 4. Clean up spacing
  t = t.replace(/\s{2,}/g, ' ').trim();

  return t;
}

// ---------- Hindi Voice Selection ----------

function anprPickHindiVoice(gender) {
  if (__anprCachedHindiVoice && __anprCachedHindiGender === gender) {
    return __anprCachedHindiVoice;
  }

  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const hindiVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('hi') || lang === 'hi-in';
    });

    if (!hindiVoices.length) {
      const fallback = voices.filter(v => /hindi/i.test(v.name));
      if (fallback.length) {
        __anprCachedHindiVoice = fallback[0];
        __anprCachedHindiGender = gender;
        return fallback[0];
      }
      return null;
    }

    if (hindiVoices.length === 1) {
      __anprCachedHindiVoice = hindiVoices[0];
      __anprCachedHindiGender = gender;
      return hindiVoices[0];
    }

    // Score for gender + quality
    const scored = hindiVoices.map(v => {
      let score = 0;
      const name = (v.name || '').toLowerCase();
      const isFemale = /swara|female|woman|neerja|sapna/i.test(name);
      const isMale = /madhur|male|man|hemant|kalpesh/i.test(name);

      if (gender === 'male') {
        if (isMale) score += 15;
        else if (isFemale) score -= 10;
      } else {
        if (isFemale) score += 15;
        else if (isMale) score -= 10;
      }

      if (/neural|natural|premium|online/i.test(name)) score += 5;
      if (!v.localService) score += 3;
      if (/microsoft/i.test(name)) score += 2;

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best) {
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

function anprClearTranslateCache() {
  try { __anprTranslateCache = {}; } catch {}
  anprClearPreTranslated();
  anprResetHindiVoiceCache();
}
