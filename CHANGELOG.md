# Changelog

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
# Changelog

## 2.1 – 2025-11-03
- MV3 manifest polish; localized name/description/action title
- Popup UI: Start/Stop, Auto Read/Next, Skip Forward, new TTS controls (rate/pitch/auto-language)
- Content script: Unicode‑safe text filtering; auto language detection; voice selection; duplicate‑listener guards
- Improved Auto‑Next: tries site button, URL patterns, rel=next, and next‑link text
- Removed unused background script
- Added PRIVACY.md and THIRD_PARTY_NOTICES.md
