# Chrome Web Store: Privacy Practices Snippet

Use this text in the “Justification for webNavigation” field on the Privacy Practices tab:

Auto Next Page Reader uses webNavigation only to detect when navigation completes in the tab where you clicked Start, so it can automatically resume reading on the next page/chapter. While a reading session is active, the background script listens for main‑frame navigation completion and re‑injects the reader into the new page.

Scope and safeguards:
- Limited to the origin you granted at runtime (optional host permissions). Other sites/tabs are not monitored.
- No analytics, tracking, or external transmissions. We do not store or send your URLs or browsing history.
- All processing (content extraction and text‑to‑speech) happens locally in your browser.

This permission exists solely to provide the hands‑free “auto‑next chapter” feature the user requested.
