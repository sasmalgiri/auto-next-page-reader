# Auto Next Page Reader

Chrome/Edge extension that extracts the main article text (Readability), reads it aloud via Text-to-Speech (Web Speech API), and can automatically open the next page/chapter.

## Features
- Readability-powered content extraction
- Read aloud / Text-to-Speech (rate + pitch controls; uses your browser voices)
- Auto-Read on page load (toggle)
- Auto Next chapter/page (next button, rel="next", URL increment patterns, and common “next” links)
- Skip Forward
- Keyboard: Ctrl+` to pause/resume

## Install (Chrome / Edge)
1. Download this folder to your computer.
2. Open the browser extensions page:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `Auto Next Page Reader` folder.

## Usage
- Click the extension icon to open the popup.
- Press "Start Reading" to begin.
- Use "Stop" to cancel speech; "Skip Forward" to jump ahead.
- Toggle "Auto Next" and "Auto Read" as you like.
- See "Important Settings" for quick tips.

## Support
If this helps you, consider supporting development:
https://buymeacoffee.com/sasmalgiric

## Permissions
- scripting, activeTab: inject and communicate with content scripts.
- storage: persist popup state (reading, toggles).
- <all_urls>: run the content script on pages you visit (used only locally — no data leaves your device).

## Notes
- Background onClicked injection is disabled when a popup is defined; content scripts are declared in the manifest and popup can also inject on-demand.
- If a site doesn't provide a clear next-chapter link, auto-next may not work.

## License for Readability
Readability.js is licensed under the Apache 2.0 License (header preserved in `Readability.js`).
