// =====================================================================
// content-translate.js — Hindi translation engine with literary
// post-processing for novel reading.
// Supports free Google Translate + optional Google Cloud API key.
// Depends on: content-config.js, content-extract.js
// =====================================================================

// Translation cache to avoid re-translating on pause/resume/skip-back
if (typeof __anprTranslateCache === 'undefined') {
  var __anprTranslateCache = new Map();
}

// ---------- Translation API ----------

async function anprTranslateChunk(text, config) {
  if (!text || typeof text !== 'string' || !text.trim()) return text;

  const trimmed = text.trim();
  // Check cache first
  if (__anprTranslateCache.has(trimmed)) {
    return __anprTranslateCache.get(trimmed);
  }

  try {
    let translated = null;
    const apiKey = (config && config.apiKey) || __anprTranslateApiKey;

    if (apiKey) {
      // Google Cloud Translation API v2
      translated = await _anprTranslateCloud(trimmed, apiKey);
    }

    if (!translated) {
      // Free Google Translate fallback
      translated = await _anprTranslateFree(trimmed);
    }

    if (translated && translated !== trimmed) {
      __anprTranslateCache.set(trimmed, translated);
      return translated;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Translation failed:', e);
  }
  return text; // fallback to original
}

async function _anprTranslateFree(text) {
  try {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encoded}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    // Response format: [[["translated","original",...],...],...]
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
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'hi',
        format: 'text'
      })
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

// Dialogue verb rotation counter
if (typeof __anprDialogueVerbIdx === 'undefined') {
  var __anprDialogueVerbIdx = 0;
}

function anprHindiPostProcess(text) {
  if (!text || typeof text !== 'string') return text;

  let t = text;

  // 1. Punctuation normalization: . at sentence ends -> purna viram
  t = t.replace(/\.(\s|$)/g, '\u0964$1');

  // 2. Normalize Hindi punctuation spacing
  t = t.replace(/\s+\u0964/g, '\u0964');
  t = t.replace(/\u0964(?=\S)/g, '\u0964 ');

  // 3. Dialogue enhancement: vary "said" translations
  const saidVariants = [
    '\u092C\u094B\u0932\u093E', // बोला
    '\u0915\u0939\u093E',       // कहा
    '\u092A\u0941\u0915\u093E\u0930\u093E', // पुकारा
    '\u092C\u094B\u0932\u0940', // बोली
    '\u0915\u0939\u0924\u0947 \u0939\u0941\u090F', // कहते हुए
  ];
  // Replace repeated "ने कहा" with varied forms
  t = t.replace(/\u0928\u0947 \u0915\u0939\u093E/g, () => {
    const variant = saidVariants[__anprDialogueVerbIdx % saidVariants.length];
    __anprDialogueVerbIdx++;
    return '\u0928\u0947 ' + variant;
  });

  // 4. Narrative flow connectors: fix awkward GT conjunctions
  t = t.replace(/\bAnd then\b/gi, '\u0914\u0930 \u092B\u093F\u0930'); // और फिर
  t = t.replace(/\bSuddenly\b/gi, '\u0905\u091A\u093E\u0928\u0915'); // अचानक
  t = t.replace(/\bHowever\b/gi, '\u0932\u0947\u0915\u093F\u0928');   // लेकिन
  t = t.replace(/\bMeanwhile\b/gi, '\u0907\u0938\u0940 \u092C\u0940\u091A'); // इसी बीच
  t = t.replace(/\bTherefore\b/gi, '\u0907\u0938\u0932\u093F\u090F');  // इसलिए
  t = t.replace(/\bNevertheless\b/gi, '\u092B\u093F\u0930 \u092D\u0940'); // फिर भी

  // 5. Remove common leftover English words that GT often leaves untranslated
  const leftoverPatterns = [
    /\b(the|a|an|is|was|were|are|been|being|have|has|had|do|does|did)\b/gi,
    /\b(shall|should|would|could|might|must|may|can|will)\b/gi,
  ];
  for (const pat of leftoverPatterns) {
    t = t.replace(pat, '');
  }

  // 6. Clean up multiple spaces
  t = t.replace(/\s{2,}/g, ' ').trim();

  // 7. Fix common GT artifacts with quotation marks
  t = t.replace(/"\s*/g, '"');
  t = t.replace(/\s*"/g, '"');

  return t;
}

// ---------- Hindi Voice Selection ----------

function anprPickHindiVoice(gender) {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const hindiVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('hi') || lang === 'hi-in';
    });

    if (!hindiVoices.length) {
      console.warn('[ANPR][Translate] No Hindi voices found');
      return null;
    }

    // If a specific Hindi voice URI is saved, use it
    if (__anprHindiVoiceURI) {
      const saved = hindiVoices.find(v => v.voiceURI === __anprHindiVoiceURI);
      if (saved) return saved;
    }

    const preferredGender = gender || __anprHindiVoiceGender || 'female';

    // Score voices based on quality and gender match
    const scored = hindiVoices.map(v => {
      let score = 0;
      const name = (v.name || '').toLowerCase();

      // Gender matching
      if (preferredGender === 'female') {
        if (/swara|female|woman|girl|\u0938\u094D\u0935\u0930\u093E/i.test(name)) score += 10;
        if (/madhur|male|man|boy|\u092E\u093E\u0927\u0941\u0930/i.test(name)) score -= 5;
      } else {
        if (/madhur|male|man|boy|\u092E\u093E\u0927\u0941\u0930/i.test(name)) score += 10;
        if (/swara|female|woman|girl|\u0938\u094D\u0935\u0930\u093E/i.test(name)) score -= 5;
      }

      // Quality indicators
      if (/neural|natural|premium|online/i.test(name)) score += 5;
      if (!v.localService) score += 3; // prefer online/neural voices
      if (/microsoft/i.test(name)) score += 2; // Edge online voices are good quality

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best) {
      console.debug('[ANPR][Translate] Selected Hindi voice:', best.voice.name, 'score:', best.score);
      return best.voice;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Voice selection error:', e);
  }
  return null;
}

// ---------- Utility ----------

function anprClearTranslateCache() {
  try { __anprTranslateCache.clear(); } catch {}
}
