# Microsoft Edge Add-ons Listing Content

Title: Auto Next Page Reader

Short description (max ~80 chars):
Read aloud (Text-to-Speech) and automatically open the next page/chapter.

Full description:
Auto Next Page Reader extracts the main content from web pages and reads it aloud using your browser’s built‑in Text‑to‑Speech. When a chapter finishes, it can automatically open the next one.

Highlights
- Readability‑powered content extraction
- Auto‑Next to the following page/chapter (button → URL pattern → rel=next → next‑link text)
- Works entirely offline; no data leaves your device
- Adjustable rate and pitch; auto‑detects language/voice
- Keyboard: Ctrl + ` to pause/resume

How it works
- The extension runs on the current page to extract readable text and send it to Text‑to‑Speech.
- Auto‑Next looks for site “next” buttons, common chapter URL patterns, and standard rel="next" links.

Permissions rationale
- activeTab, scripting: Inject the reading logic into the current page when you use the extension
- storage: Remember your settings (Auto Read/Next, rate, pitch, language choice)
 - webNavigation: Detect main‑frame navigation completion in the same tab to auto‑resume reading on the next page

Privacy
- No analytics or telemetry
- No network calls to third‑party servers
- All processing happens locally in your browser
- See PRIVACY.md for details

Justification for webNavigation
- Purpose: keep reading across pages by triggering auto‑start after navigation completes in the tab where you started.
- Scope: limited to the granted origin (optional host permissions) and to that tab’s session; other sites/tabs aren’t monitored.
- Data: no browsing history is collected or transmitted.

Support the project
- If this extension helps you, consider supporting: https://buymeacoffee.com/sasmalgiric

Credits
- Includes Readability.js (Apache 2.0). See THIRD_PARTY_NOTICES.md

Screenshots (1280×800, 3–5 images)
1) Popup with Start/Stop, Auto Next, Auto Read, and TTS controls
2) A page being read aloud (status message visible)
3) Auto‑Next moving to the next chapter on a site with clear navigation
4) A non‑English article demonstrating language auto‑detection

Keywords
read aloud, text to speech, text-to-speech, TTS, auto next, next chapter, next page, reader, accessibility, language, voice
