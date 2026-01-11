# Changelog

## 2.6.19 — 2026-01-11
- UI Simplification: Streamlined popup interface to focus on core features
- Removed advanced voice controls from main popup for cleaner UX
- All TTS features remain functional with smart defaults in background
- Simplified interface: 6 essential buttons only (Start, Stop, Skip, 3 toggles)
- Advanced users can still access full settings via "Important Settings" button

## 2.6.18 — 2026-01-11
- Verification: Comprehensive code review confirming all project goals are properly implemented
- Documentation: Added future-proof customization guide (FUTURE_PROOF.md)
- Documentation: Privacy practices documentation (PRIVACY_PRACTICES_SNIPPET.md)
- Stability: All core features verified working (content extraction, TTS, auto-navigation)
- Quality: No bugs or critical issues found in codebase review
- Production-ready build with full error recovery and resilience features

## 2.5.0 — 2025-11-12
- Future-proof config: Added storage-based overrides (`customIgnorePhrases`, `customNextSelectors`). Merges with built-in base lists for filtering and next-chapter detection without code updates.
- Text filtering now uses merged ignore phrases (base + custom) for both bulk removal and per-line suppression.
- Version bump for release packaging.

## 2.5.1 — 2025-11-12
- Filtering: Stronger code-like detection (CSS/HTML/JSON-like lines, base64/minified blobs, symbol density). Drops more ad/promo boilerplate and tech fragments.

## 2.5.2 — 2025-11-12
- Filtering: Footer suppression (skip elements inside footer/nav/aside + trailing copyright/privacy/terms lines). Expanded ignore list (privacy policy, terms of service, all rights reserved, contact us).

## 2.5.3 — 2025-11-12
- Filtering: Added `strictFiltering` toggle (default OFF). Relaxed mode preserves italics/short asides while still removing ads/promo and nav labels. Turn ON for maximum code/ad suppression.

## 2.5.4 — 2025-11-12
- Navigation: Fixed potential recursion/stack growth in next-chapter scan by removing heavy `closest()` checks on every anchor; limit search scope to main content container.
- Safety: Prevent misidentifying previous chapter as next (filters anchors containing prev/previous). Ensure chapter number monotonic increase (skip if next <= current).

## 2.5.5 — 2025-11-12
- Speech: Eliminated synchronous recursion in `anprSpeakNext` (use async setTimeout). Skips empty chunks; adds consecutive error guard (max 8) to prevent stack overflow RangeError.

## 2.5.6 — 2025-11-12
- Speech: Additional hardening. Guard while `speechSynthesis.speaking/pending`; defer `speak()` via setTimeout; cap utterances per chapter (default 600). Resets counters on new chapter.

## 2.5.7 — 2025-11-12
- Background: Host ignore list in webNavigation handler to avoid any activity on common ad/tracker domains.

## 2.5.8 — 2025-11-12
- Speech Recovery: Prevent auto-next when a chapter yields only TTS errors (no successful utterances). Adds recovery routine (rebuild chunks with relaxed filtering + rotate voice) triggered after 5 consecutive early errors.
- Error Handling: Distinguishes failure-before-any-speech vs. mid-chapter failures; only considers auto-navigation after successful speech or after recovery attempts exhausted.
- Safety: If recovery fails and nothing was spoken, reader stops on current chapter (status message shown) instead of skipping content silently.

## 2.5.9 — 2025-11-12
- Session: Content script now handshakes with background to acquire tabId and actively registers an auto session on start. This ensures background finds the session after navigation and re-injects reliably.

## 2.6.0 — 2025-11-12
- Looping Fix: Cleared residual `remainingText` on infinite-mode end; guarded empty `startSpeech`; enhanced `skipForward` to trigger next chapter if end reached.
## 2.6.1 — 2025-11-12
- Hotfix: Adjusted `startSpeech` empty-text guard to apply only in infinite mode. Chapter mode no longer short-circuits when no text argument is provided.

## 2.6.2 — 2025-11-12
- Footer Filtering: Stronger footer/container skipping and trailing line stripping (copyright/site-info/contentinfo, domain-like short lines, NovelBin boilerplate) to stop reading footers.
- Auto-start Robustness: When background triggers `startSpeech` but text isn’t ready yet, content now starts chapter mode and observes the DOM until paragraphs are ready (ensures it actually begins reading).

## 2.6.3 — 2025-11-12
- Hotfix: Resolved regression where reading could fail to start.
	- Loosened readiness criteria for chapter start (start with fewer/shorter paragraphs).
	- If a start payload includes text in chapter mode, pre-seed chunks and read immediately.
	- Added fallback to Readability extraction when DOM-built chunks are empty.

## 2.6.4 — 2025-11-17
- Duplicate sentence fix: Removed rapid rescheduling while TTS is still speaking to prevent repeating the same chunk.
- Omit early headers: Skip leading translator/credits and chapter header lines (e.g., "Chapter 123: Title") so they aren’t read.
- Persist settings across pages: Before navigation, save all key parameters (AutoNext/AutoRead/AutoScroll, TTS rate/pitch/autoLang, preferred voice, strict filtering, custom phrases/selectors) so the next page restores them reliably.

## 2.6.5 — 2025-11-17
- Free voice improvements: Prefer natural/online voices automatically and add a voice Preview button in the popup.
	- New popup setting: "Prefer natural/online voices" (on by default). No API keys needed; uses browser speechSynthesis voices (Edge online voices supported).
	- Voice picker sorting now prefers neural/natural/premium names, then online voices, then language match.
	- Voice preview plays a short sample without interrupting current reading.

## 2.6.6 — 2025-11-17
- One-click best voices: Added "Pick Best Voices" to auto-select best female and male favorites using the same natural/online/language heuristics. If favorites aren’t set, we auto-pick them on load.
- Persistence: Auto-read / auto-next flags persisted immediately before navigation to ensure correct state after page change.
- Adapters: Introduced `__ANPR_ADAPTERS__` map (webnovel, novelbin, wuxiaworld) powering selector-based extraction and next-link preference.
- Navigation: `clickNextChapterButton` now consults adapter-specific `nextLinkSelector` first.
- Cleanup: Removed duplicate `u.onstart` assignment; minor logging adjustments.
- Safety: Additional voice rotation & recovery retained from 2.5.x for early TTS failures.

## 2.6.7 — 2025-11-17
- Voice naturalness: Added two new toggles in the popup and content engine support:
	- Natural preset: gentle tuning of rate/pitch to a natural range and small pauses between paragraphs.
	- Dynamic prosody: light, punctuation-aware modulation (questions/exclamations/dialogue) for more expressive delivery.
- Persistence: Both toggles persist across pages and are saved before auto-navigation.
- Live updates: Content reacts to storage changes so toggling during a session takes effect on subsequent utterances.

## 2.6.8 — 2025-11-17
- Dialogue alternation: Optional "Alternate voices in dialogue" toggle. Quoted/dialogue-prefixed lines alternate between best female and male favorites for a dramatized effect.
- Length-based pacing: Dynamic modulation slows long (>160 chars) chunks slightly and speeds up very short (<60 chars) ones for more natural rhythm.
- Integrated with existing Natural Preset / Dynamic Prosody; per‑utterance tuning merged.
- Storage: New `dialogueAlternate` flag persisted across pages; uses previously stored `femaleVoiceURI` and `maleVoiceURI` when present.

## 2.6.9 — 2025-11-17
- Instant Start: New popup toggle `Instant start on popup open` (`instantStartEnabled`). When enabled, opening the popup immediately begins reading using a fast provisional extraction.
- Progressive Loading: First 1–2 paragraphs start speaking instantly; remaining chapter paragraphs are appended seamlessly once gathered (no restart or overlap).
- Voice Upgrade Hook: Infrastructure for deferred voice switching mid‑session (`upgradeVoice` pending message) — future enhancements can promote to a higher quality voice after initial start.
- Popup Wiring: Checkbox persists in `chrome.storage.local` and triggers a `fastStart` message after voice list initialization.
- Content Script: Added `fastStart` handler, progressive chunk buffering (`__anprProgressive`, `__anprPendingChunks`), and deferred voice application logic.
- Maintains existing auto‑next guards and recovery logic; progressive mode exits automatically once full chunk list is appended.
- Version bump for release packaging.

## 2.6.10 — 2025-11-24 (Debug/Instrumentation Build)
- TTS Error Diagnostics: Added structured logging (onstart/onend/onerror JSON meta) capturing chunk index, length, voice URI, rate, pitch, counters, and recovery attempts.
- Adaptive Chunk Splitting: Automatically re-splits an oversized failing first chunk (>220 chars, ≥2 consecutive early errors, no successes yet) into ~120‑char sub‑chunks and retries before recovery.
- Enhanced Recovery Routine: Normalizes chunk list (splits >600 chars; merges very short fragments), rotates voices prioritizing online natural/neural voices, tracks failing voice URIs to avoid immediate reuse; falls back cleanly if all voices fail.
- Voice Failure Tracking: Maintains per‑chapter set of failing voice URIs to improve subsequent recovery selection.
- Popup Messaging Hardening: Reinjection + retry logic for content script messaging; guards against unsupported internal pages (chrome://, edge://, about:) and provides clear user‑facing fallback errors.
- Safety Guards: All new logic wrapped in try/catch; recovery attempt limit retained; no changes to production feature flags.
- Version bump (2.6.10) for debug distribution ZIP packaging.

## 2.6.11 — 2025-11-24 (Hotfix)
- Fixed critical syntax corruption in `anprFindNextHref` that mixed voice recovery code into next-link detection, causing `Unexpected token '||'` and preventing content script initialization on some NovelBin chapters.
- Restored clean next-link heuristic order: `<link rel="next">` > site-specific selectors > configured selectors > textual/rel pattern fallbacks.
- Ensures navigation logic no longer interferes with voice recovery; removes stray undefined references (`backupChunks`, `voices`).
- Included in new production ZIP.

## 2.6.12 — 2025-11-24 (Resilience Build)
- TTS Error Typing: Normalizes error codes (`not-allowed`, `interrupted`, `network`, `service-unavailable`, `synthesis-failed`, `audio-error`, `unknown`) for clearer diagnostics.
- Backoff Strategy: Introduces exponential retry delay (base 180ms, factor 1.6, capped at 1200ms) after >2 consecutive errors to reduce engine hammering.
- Adaptive Self-Test: One-time micro test utterances run after the second consecutive early failure with no successful speech, probing available voices for viability.
- Debug Logging Flag: Storage key `anprDebugLogging` toggles verbose instrumentation; minimal logging retained for first few errors when off.
- Voice Failure Memory: Retains per-chapter failing voice URIs and avoids immediate reuse; clears only when all voices exhausted.
- Maintains previous recovery improvements (chunk normalization, adaptive split) and next-link fix from 2.6.11.
- Production-safe: All new logic wrapped in try/catch; no change to user-facing defaults unless debug flag enabled.
- Version bump for packaging.

## 2.4.8 — 2025-11-12
- Background: Only log main-frame navigations (reduces console spam from ad/analytics iframes).
- Filtering: Expanded ignore phrases (sponsored, donate, login to comment, report chapter, etc.) and stricter boilerplate/ad removal; drops symbol-heavy junk lines.
- Navigation labels suppression from 2.4.7 retained.

## 2.4.7 — 2025-11-12
- Filtering: Suppress standalone navigation labels ("Previous Chapter", "Next Chapter", and bare "Chapter N") so they are not spoken.
- Version bump only; builds include prior ad/code filtering.

## 2.4.6 — 2025-11-12
- Filtering: Skip ad/tracker boilerplate and code-like lines (heuristics for JS/CSS tokens and symbol ratios). Reduces reading of ads/codes on chapter pages.
- NovelBin: Ignore ad/sponsor/cookie/footer elements by class/id and hidden nodes when building paragraphs.

## 2.4.5 — 2025-11-12
- NovelBin: Improved next‑chapter detection (`#next_chap`, `.nextchap`, `.chr-nav-right a`, and more). Smarter paragraph collection on NovelBin (`div` blocks included, UI-noise skipped).
- Chapter start guards: Don’t navigate when no paragraphs are ready; observe DOM and retry until text appears.

## 2.4.4 — 2025-11-11
- Reliability: Added fallback auto-start loop (10s window) for slow‑loading/hidden tabs; visibilitychange recovery if speech stops while minimized.
- Chapter Mode: Ensures isReading is set at start; prevents stalls after navigation.
- Robustness: Extra logging and retry path complements background session persistence from 2.4.3.

## 2.4.3 — 2025-11-11
- Persistence: Background service worker now reloads active reading sessions after restart (minimized/unfocused resilience).
- StartSpeech sends full TTS settings + voice URI with retries.
- Logging: Detailed navigation + autostart tracing in background and content.

## 2.4.2 — 2025-11-11
- Timing: Increased post‑navigation autostart delay; added 50ms write‑after flag before redirect.
- Voice: Preferred voice now applied in chapter mode.
- Diagnostics: Expanded console tracing for maybeAutoNext and SPA URL changes.

## 2.4.1 — 2025-11-11
- Fixes: Debounced skipForward; self‑link avoidance; paragraph‑per‑utterance for chapter sites; infinite mode retained for webnovel.com.
- Autostart: sessionStorage flag + load/pageshow handlers; SPA history hook.

## 2.4 — 2025-11-04
- Auto Read continues automatically after Auto Next Chapter. Added background service worker that re-injects and starts reading on the next page once you grant the site permission at Start.
- Infinite scroll (webnovel.com) no longer stops. Detects site as infinite mode, scrolls to load more, diffs new content, and keeps reading. Saves/restore progress.
- UX: Popup controls now target the original reading tab even if the popup is opened on a different tab.

## 2.3 — 2025-11-04
- Feature: Auto‑scroll while reading (popup and in‑page overlay toggles). Helps trigger lazy/infinite loading on long chapters.
- Extraction: Improved handling for Webnovel and similar sites with dynamic content; largest‑text fallback; UI noise filtering.
- Demo: In‑page overlay (Ctrl+Shift+O) for Start/Stop/Skip and TTS controls; updated recording guide.
- Assets: Generator includes promo sizes (440×280, 1400×560) and centered HQ export.

## 2.2 — 2025-11-04
- On‑demand injection (removed content_scripts) to minimize host access and speed review.
- Popup now injects Readability.js then content.js on action.
- Packaging: Built fresh 2.2 ZIPs for Chrome and Edge.

## 2.1 — 2025-11-04
- TTS controls for rate/pitch; auto‑language detection and voice matching.
- i18n for manifest fields; privacy and third‑party notices; donation link and options page.
- Next‑chapter heuristics; Unicode‑safe text filtering.

## 2.1 – 2025-11-03
- MV3 manifest polish; localized name/description/action title
- Popup UI: Start/Stop, Auto Read/Next, Skip Forward, new TTS controls (rate/pitch/auto-language)
- Content script: Unicode‑safe text filtering; auto language detection; voice selection; duplicate‑listener guards
- Improved Auto‑Next: tries site button, URL patterns, rel=next, and next‑link text
- Removed unused background script
- Added PRIVACY.md and THIRD_PARTY_NOTICES.md
