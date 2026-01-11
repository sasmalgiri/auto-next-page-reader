# Store Listing Content

Title
Auto Next Page Reader

Item summary (≤132 chars)
Read aloud (Text‑to‑Speech) and auto‑open the next chapter/page. Start/Stop/Skip, auto‑language, rate/pitch controls. Works offline.

Item description
Auto Next Page Reader speaks the main content of any page using your browser’s built‑in Text‑to‑Speech. When the page finishes, it can automatically open the next page/chapter on reading sites—so you can keep listening hands‑free.

Why you’ll like it
- Readability‑powered text extraction for clear, clutter‑free narration
- Start / Stop / Skip forward controls in a compact popup
- Auto‑Next via next button, URL chapter numbers, rel=next, or link text
- Auto‑detects language; picks a suitable voice when available
- Adjustable speech rate and pitch; quick keyboard resume (Ctrl + `)
- Private by design: runs locally, no analytics or data sharing
 - NEW: Optional Auto‑scroll while reading to trigger lazy/infinite content on long chapters

How it works
- On‑demand: when you click Start, the extension extracts readable text and speaks it.
- Auto‑Next: after finishing, it looks for next‑page patterns and opens the next chapter when found.
 - Dynamic pages: if a site loads text on scroll, Auto‑scroll (optional) helps fetch content while you listen.

Permissions (minimal)
- activeTab, scripting — inject the reader only into the tab you act on
- storage — remember your preferences (Auto Read/Next, rate/pitch, language)
 - webNavigation — resume reading on the next page after a navigation completes in the tab where you started

Privacy
- No telemetry or user tracking; no data leaves your device
- See Privacy Policy: https://github.com/sasmalgiri/auto-next-page-reader/blob/main/PRIVACY.md

Justification for webNavigation
- Used only to detect main‑frame navigation completion in the same tab where you clicked Start, so the reader can auto‑resume on the next chapter.
- Scoped by optional host permissions: we ask for the current site origin at runtime; other sites/tabs are not monitored.
- No URLs or browsing data are sent to any server; no analytics.

Support the project
Buy Me a Coffee: https://buymeacoffee.com/sasmalgiric

Screenshots (1280×800 recommended; up to 5)
1) Popup UI: Start/Stop/Skip, Auto Next/Auto Read, and TTS sliders
2) In‑page reading: status showing “Reading in progress…”
3) Auto‑Next: example site where the next chapter opens
4) Language auto‑detect: a non‑English article speaking in the correct voice
5) Options page: custom Support link

Promotional images
- Small promo tile: 440×280
- Marquee image (optional, for featuring): 1400×560

Keywords
read aloud, text to speech, text-to-speech, TTS, auto next, next chapter, next page, reader, accessibility, language, voice
