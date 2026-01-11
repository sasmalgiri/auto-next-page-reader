# Privacy Policy

This extension operates entirely on your device. It does not collect, transmit, sell, or share any personal or sensitive user data.

- No analytics or telemetry
- No network requests to third‑party servers
- Uses browser storage (chrome.storage.local) to remember simple UI state like whether Auto Read/Auto Next were enabled

If you publish this extension, include a link to this policy in your store listing and describe why permissions are needed:
- activeTab, scripting: inject the reader into the current page after user action
- storage: remember your toggles
 - webNavigation: resume reading after a navigation on sites you chose
 - optional host permissions: the extension asks only for the origin you start on, not <all_urls>

## Why we request webNavigation

We use the browser's webNavigation API only for one purpose: to reliably resume reading on the next page after a navigation completes in a tab where you explicitly started a reading session.

Details:
- When you click Start, a per‑tab session is created. While that session is active, the background script listens for main‑frame navigation completion on that same tab.
- If the URL matches the origin you granted (requested via optional host permissions) the extension injects the reader into the new page and starts reading automatically. This enables hands‑free “auto‑next chapter”.
- We do not use webNavigation to monitor other tabs or origins, nor do we store or transmit your browsing history. No URLs are sent anywhere.

Data handling:
- All processing (content extraction and text‑to‑speech) runs locally in your browser.
- The extension does not collect or transmit personal or sensitive data.
- Only simple preferences (e.g., Auto Next, Auto Read, TTS rate/pitch, voice choice) are stored locally using chrome.storage.

Scope limitation:
- The extension requests optional host permissions at runtime for the current site only, and only after you click Start.
- The session ends when you click Stop or close the tab; the listener is removed.
