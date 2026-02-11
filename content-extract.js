// =====================================================================
// content-extract.js — Content extraction, text filtering, and DOM
// selection helpers. Depends on content-config.js (globals & adapters).
// =====================================================================

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
      if (/(?:^|\s)(?:var|let|const|function|return|class|import|export|try|catch|finally|new)\b/.test(l)) return true;
      if (/(document\.|window\.|console\.|JSON\.|Promise\.|setTimeout\(|setInterval\(|addEventListener\(|querySelector(All)?\()/i.test(l)) return true;
      if (/<\/?[a-z][^>]*>/i.test(l)) return true; // HTML tags
      if (/(?:\{|\})\s*$/.test(l)) return true;
      if (/(?:^|\s)(color|background|margin|padding|display|position|z-index|font(-size|-family|-weight)?|border|width|height)\s*:/i.test(l)) return true;
      if (/^\s*\.[A-Za-z0-9_-]+\s*\{|^\s*#[A-Za-z0-9_-]+\s*\{/.test(l)) return true;
      if (/"[A-Za-z0-9_\-]+"\s*:\s*("[^"]*"|\d+|\{|\[)/.test(l)) return true;
      if (/[A-Za-z0-9+/]{40,}={0,2}/.test(l)) return true;
      const letters = (l.match(/[\p{L}0-9]/gu) || []).length;
      const symbols = (l.match(/[;{}()=<>:&*_$#@`~^\[\]|\\]/g) || []).length;
      const ratio = letters / Math.max(1, l.length);
      if (symbols >= 3 && ratio < 0.55) return true;
      if (l.length > 200 && !/[\.。！？!?…]/.test(l)) return true;
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
        if (/<\/?[a-z][^>]*>/i.test(s)) return false;
        if (/^\s*(previous|prev)\s+chapter\s*$/i.test(s)) return false;
        if (/^\s*next\s+chapter\s*$/i.test(s)) return false;
        if (/^\s*chapter\s+\d+\s*$/i.test(s)) return false;
        const domainLike = /\b[a-z0-9][a-z0-9-]{1,63}\.(?:com|net|org|io|app|site|vip|me|xyz|top|info|shop|online)\b/i;
        if (s.length < 90 && domainLike.test(s)) return false;
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
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim().replace(/ {2,}/g, ' ');
  } catch (error) {
    console.error("Error during content filtering:", error);
    return text; // Return unmodified text if filtering fails
  }
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

function anprCollectParagraphsForCurrentSite(container) {
  try {
    const host = location.hostname.replace(/^www\./,'').toLowerCase();
    const baseSelector = host.includes('novelbin') ? 'p, div' : 'p';
    let out = [];
    const nodes = Array.from(container.querySelectorAll(baseSelector));
    for (const n of nodes) {
      if (!(n instanceof HTMLElement)) continue;
      const cls = (n.className||'') + ' ' + (n.id||'');
      if (/\b(ad|ads|advert|sponsor|promo|nav|breadcrumb|comment|gift|button|share|cookie|gdpr|footer|header|tip|notice|alert|related|popular|pagination|copyright)\b/i.test(cls)) continue;
      if (n.getAttribute('aria-hidden') === 'true') continue;
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
  const paras = anprCollectParagraphsForCurrentSite(__anprSpeechState.container);
  __anprSpeechState.chunks = paras;
  __anprSpeechState.idx = 0;
}
