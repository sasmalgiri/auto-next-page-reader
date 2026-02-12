// =====================================================================
// content-translate.js — Hindi translation engine with literary
// post-processing for novel reading.
// Translates full chapter text upfront, then feeds into normal TTS loop.
// Supports free Google Translate + optional Google Cloud API key.
// Depends on: content-config.js, content-extract.js
// =====================================================================

// Translation cache: keyed by full chapter text hash
if (typeof __anprTranslateCache === 'undefined') {
  var __anprTranslateCache = new Map();
}

// Hindi voice cached reference
if (typeof __anprCachedHindiVoice === 'undefined') {
  var __anprCachedHindiVoice = null;
}
if (typeof __anprCachedHindiGender === 'undefined') {
  var __anprCachedHindiGender = null;
}

// ---------- Full Chapter Translation ----------

// Translate an array of paragraphs and return translated array
async function anprTranslateFullChapter(paragraphs) {
  if (!Array.isArray(paragraphs) || !paragraphs.length) return paragraphs;

  // Build a cache key from first+last paragraph
  const cacheKey = (paragraphs[0] || '').slice(0, 100) + '|' + paragraphs.length + '|' + (paragraphs[paragraphs.length - 1] || '').slice(0, 100);
  if (__anprTranslateCache.has(cacheKey)) {
    console.debug('[ANPR][Translate] Using cached full chapter translation');
    return __anprTranslateCache.get(cacheKey);
  }

  updateStatus('Translating chapter to Hindi...');
  const translated = [];

  // Translate in batches of paragraphs (group ~4000 chars per batch for GT free limit)
  const MAX_BATCH_CHARS = 4000;
  let batch = [];
  let batchLen = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = (paragraphs[i] || '').trim();
    if (!para) { translated.push(''); continue; }

    if (batchLen + para.length > MAX_BATCH_CHARS && batch.length > 0) {
      // Translate current batch
      const batchText = batch.join('\n\n');
      const result = await _anprTranslateBatch(batchText);
      if (result) {
        const parts = result.split(/\n\n/);
        for (const p of parts) translated.push(p.trim());
      } else {
        // Fallback: keep original
        for (const b of batch) translated.push(b);
      }
      batch = [];
      batchLen = 0;
    }

    batch.push(para);
    batchLen += para.length;
  }

  // Translate remaining batch
  if (batch.length > 0) {
    const batchText = batch.join('\n\n');
    const result = await _anprTranslateBatch(batchText);
    if (result) {
      const parts = result.split(/\n\n/);
      for (const p of parts) translated.push(p.trim());
    } else {
      for (const b of batch) translated.push(b);
    }
  }

  // Filter empty entries
  const cleaned = translated.filter(t => t && t.trim());

  if (cleaned.length > 0) {
    __anprTranslateCache.set(cacheKey, cleaned);
  }

  updateStatus('Translation complete. Reading in Hindi...');
  return cleaned.length > 0 ? cleaned : paragraphs;
}

// Translate a batch of text (may be multiple paragraphs joined by \n\n)
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

  // 1. Punctuation normalization: . at sentence ends -> purna viram (।)
  t = t.replace(/\.(\s|$)/g, '\u0964$1');

  // 2. Normalize Hindi punctuation spacing
  t = t.replace(/\s+\u0964/g, '\u0964');
  t = t.replace(/\u0964(?=\S)/g, '\u0964 ');

  // 3. Dialogue enhancement: vary "said" translations for novel touch
  const saidVariants = [
    '\u092C\u094B\u0932\u093E',  // बोला
    '\u0915\u0939\u093E',        // कहा
    '\u092A\u0941\u0915\u093E\u0930\u093E', // पुकारा
    '\u092C\u094B\u0932\u0940',  // बोली
    '\u0915\u0939\u0924\u0947 \u0939\u0941\u090F', // कहते हुए
    '\u0938\u0941\u0928\u093E\u092F\u093E', // सुनाया
    '\u092C\u0924\u093E\u092F\u093E', // बताया
  ];
  t = t.replace(/\u0928\u0947 \u0915\u0939\u093E/g, () => {
    const variant = saidVariants[__anprDialogueVerbIdx % saidVariants.length];
    __anprDialogueVerbIdx++;
    return '\u0928\u0947 ' + variant;
  });

  // 4. Narrative flow connectors: replace awkward GT conjunctions
  t = t.replace(/\bAnd then\b/gi, '\u0914\u0930 \u092B\u093F\u0930');   // और फिर
  t = t.replace(/\bSuddenly\b/gi, '\u0905\u091A\u093E\u0928\u0915');    // अचानक
  t = t.replace(/\bHowever\b/gi, '\u0932\u0947\u0915\u093F\u0928');      // लेकिन
  t = t.replace(/\bMeanwhile\b/gi, '\u0907\u0938\u0940 \u092C\u0940\u091A'); // इसी बीच
  t = t.replace(/\bTherefore\b/gi, '\u0907\u0938\u0932\u093F\u090F');    // इसलिए
  t = t.replace(/\bNevertheless\b/gi, '\u092B\u093F\u0930 \u092D\u0940'); // फिर भी
  t = t.replace(/\bAt that moment\b/gi, '\u0924\u092D\u0940');           // तभी
  t = t.replace(/\bIn the end\b/gi, '\u0905\u0902\u0924 \u092E\u0947\u0902'); // अंत में

  // 5. Remove common leftover English words GT often leaves untranslated
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

  // 8. Add emphasis particles for natural Hindi novel feel
  // "he thought" patterns → add "सोचा" variety
  t = t.replace(/\u0938\u094B\u091A\u093E/g, () => {
    const variants = ['\u0938\u094B\u091A\u093E', '\u0935\u093F\u091A\u093E\u0930 \u0915\u093F\u092F\u093E', '\u092E\u0928 \u092E\u0947\u0902 \u0938\u094B\u091A\u093E'];
    return variants[Math.floor(Math.random() * variants.length)];
  });

  return t;
}

// Apply post-processing to an array of translated paragraphs
function anprHindiPostProcessAll(paragraphs) {
  __anprDialogueVerbIdx = 0; // reset for each chapter
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
    console.debug('[ANPR][Translate] All voices:', voices.map(v => v.name + ' [' + v.lang + ']'));

    const hindiVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('hi') || lang === 'hi-in';
    });

    console.debug('[ANPR][Translate] Hindi voices found:', hindiVoices.map(v => v.name + ' [' + v.lang + '] local=' + v.localService));

    if (!hindiVoices.length) {
      console.warn('[ANPR][Translate] No Hindi voices found. Available langs:', [...new Set(voices.map(v => v.lang))]);
      return null;
    }

    // If a specific Hindi voice URI is saved, use it
    if (__anprHindiVoiceURI) {
      const saved = hindiVoices.find(v => v.voiceURI === __anprHindiVoiceURI);
      if (saved) {
        __anprCachedHindiVoice = saved;
        __anprCachedHindiGender = gender;
        return saved;
      }
    }

    const preferredGender = gender || __anprHindiVoiceGender || 'female';

    // Score voices based on quality and gender match
    const scored = hindiVoices.map(v => {
      let score = 0;
      const name = (v.name || '').toLowerCase();

      // Gender matching - use broad patterns for Edge/Chrome Hindi voices
      if (preferredGender === 'female') {
        if (/swara|female|woman|stree|mahila|\u0938\u094D\u0935\u0930\u093E|\u0938\u094D\u0924\u094D\u0930\u0940/i.test(name)) score += 10;
        if (/madhur|male|man|purus|\u092E\u093E\u0927\u0941\u0930|\u092A\u0941\u0930\u0941\u0937/i.test(name)) score -= 8;
      } else {
        if (/madhur|male|man|purus|\u092E\u093E\u0927\u0941\u0930|\u092A\u0941\u0930\u0941\u0937/i.test(name)) score += 10;
        if (/swara|female|woman|stree|mahila|\u0938\u094D\u0935\u0930\u093E|\u0938\u094D\u0924\u094D\u0930\u0940/i.test(name)) score -= 8;
      }

      // Quality indicators
      if (/neural|natural|premium|online/i.test(name)) score += 5;
      if (!v.localService) score += 3; // prefer online/neural voices
      if (/microsoft/i.test(name)) score += 2; // Edge online voices are good quality

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    console.debug('[ANPR][Translate] Hindi voice scores:', scored.map(s => s.voice.name + '=' + s.score));

    const best = scored[0];
    if (best) {
      console.debug('[ANPR][Translate] Selected Hindi voice:', best.voice.name, 'score:', best.score, 'gender:', preferredGender);
      __anprCachedHindiVoice = best.voice;
      __anprCachedHindiGender = gender;
      return best.voice;
    }
  } catch (e) {
    console.warn('[ANPR][Translate] Voice selection error:', e);
  }
  return null;
}

// Force refresh cached voice (called when gender changes)
function anprResetHindiVoiceCache() {
  __anprCachedHindiVoice = null;
  __anprCachedHindiGender = null;
}

// Ensure voices are loaded (they load async in some browsers)
function anprEnsureVoicesLoaded() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (voices.length > 0) { resolve(voices); return; }
    // Wait for voiceschanged event
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // Timeout fallback
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 2000);
  });
}

// ---------- Utility ----------

function anprClearTranslateCache() {
  try { __anprTranslateCache.clear(); } catch {}
  anprResetHindiVoiceCache();
}
