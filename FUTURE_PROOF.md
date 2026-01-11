# Future‑Proofing: Custom Filters & Selectors

This extension lets you adjust filtering and next‑chapter detection without changing code. Use Chrome/Edge DevTools to set values in storage.

## Custom ignore phrases

Add phrases (substrings) that should be removed before reading. Matching is case‑insensitive and works anywhere in a line.

Example:

```js
chrome.storage.local.set({
  customIgnorePhrases: [
    'support us',
    'buy premium',
    'join discord',
    'unlock full chapter'
  ]
});
```

Clear them later:

```js
chrome.storage.local.set({ customIgnorePhrases: [] });
```

Notes:
- Phrases are applied both to the whole text and per line after splitting.
- The built‑in list already covers many ad/promo/boilerplate strings. Custom phrases are merged with it.

## Custom next‑chapter selectors

If a site uses a unique “Next” button selector, add it here:

```js
chrome.storage.local.set({
  customNextSelectors: [
    '.my-site .next-button',
    'a.nextChapCustom'
  ]
});
```

These are tried in order before generic heuristics.

## Code‑like content suppression

The reader automatically skips lines that look like code, CSS, HTML, JSON‑like blobs, or minified/base64 strings. Heuristics include:
- JS/CSS/HTML tokens (var/let/const/function, selectors, tags)
- JSON key:value patterns
- Lots of symbols with low letter ratio
- Very long lines without sentence punctuation
- Domain‑only or domain‑promo lines

If something still slips through, add a custom ignore phrase capturing a stable part of that line.

## Testing tips

1. Load the unpacked folder with the updated version (see manifest version).
2. Open a chapter page and the console; set your custom lists.
3. Reload the page and start reading. If a noisy line remains, copy a snippet and add it to `customIgnorePhrases`.

## Reset to defaults

```js
chrome.storage.local.remove(['customIgnorePhrases', 'customNextSelectors']);
```