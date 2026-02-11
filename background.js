// Background service worker to keep auto-reading across navigations
// Maintains per-tab sessions and injects scripts on subsequent pages.

const activeSessions = new Map(); // tabId -> { originPattern, mode }
const SESSIONS_KEY = 'anpr:sessions:v1';

// Ordered list of content scripts to inject (dependencies first)
const CONTENT_SCRIPTS = [
  'Readability.js',
  'content-config.js',
  'content-extract.js',
  'content-translate.js',
  'content-tts.js',
  'content-navigation.js',
  'content-ui.js',
  'content-main.js'
];

async function saveSessions() {
  try {
    const obj = {};
    for (const [tid, sess] of activeSessions.entries()) obj[tid] = sess;
    await chrome.storage?.local.set?.({ [SESSIONS_KEY]: obj });
  } catch {}
}

async function loadSessions() {
  try {
    const d = await chrome.storage?.local.get?.([SESSIONS_KEY]);
    const obj = (d && d[SESSIONS_KEY]) || {};
    activeSessions.clear();
    for (const k of Object.keys(obj)) {
      const tid = Number(k);
      if (!Number.isNaN(tid) && obj[k] && obj[k].originPattern) {
        activeSessions.set(tid, { originPattern: obj[k].originPattern, mode: obj[k].mode || 'chapter' });
      }
    }
  } catch {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg && msg.type === 'anprHandshake') {
      // Provide tabId back to content script for session registration
      if (sender && typeof sender.tab?.id === 'number') {
        sendResponse && sendResponse({ ok: true, tabId: sender.tab.id });
      } else {
        sendResponse && sendResponse({ ok: false });
      }
      return true;
    }
    if (msg && msg.type === 'startAutoSession') {
      const { tabId, originPattern, mode } = msg;
      if (typeof tabId === 'number' && originPattern) {
        activeSessions.set(tabId, { originPattern, mode: mode || 'chapter' });
        saveSessions();
        sendResponse && sendResponse({ ok: true });
      } else {
        sendResponse && sendResponse({ ok: false, error: 'invalid_args' });
      }
      return true;
    }
    if (msg && msg.type === 'stopAutoSession') {
      const { tabId } = msg;
      if (typeof tabId === 'number') {
        activeSessions.delete(tabId);
        saveSessions();
        sendResponse && sendResponse({ ok: true });
      } else {
        sendResponse && sendResponse({ ok: false, error: 'invalid_args' });
      }
      return true;
    }
  } catch (e) {
    console.warn('background.onMessage error:', e);
  }
});

// Helper to check if a URL matches an origin pattern like https://example.com/*
function urlMatchesOrigin(url, originPattern) {
  try {
    const u = new URL(url);
    const origin = new URL(originPattern.replace('/*', '/'));
    return u.protocol === origin.protocol && u.hostname.endsWith(origin.hostname);
  } catch {
    return false;
  }
}

// On navigation complete: if the tab is in a session and URL matches, inject and auto-start
chrome.webNavigation.onCompleted.addListener(async (details) => {
  try {
    const { tabId, url, frameId } = details;
    // Only act + log for main frame to avoid noise from ad/analytics iframes
    if (frameId !== 0) return;
    // Host ignore list: skip known ad / tracking / analytics domains entirely
    const IGNORE_HOSTS = [
      'doubleclick.net','googlesyndication.com','google-analytics.com','googletagmanager.com','adnxs.com','ads.pubmatic.com',
      'rubiconproject.com','criteo.com','taboola.com','outbrain.com','advertising.com','moatads.com','infolinks.com','revcontent.com',
      'adkernel.com','scorecardresearch.com','quantserve.com','yieldlove.com','openx.net','bidswitch.net','medialytics.com'
    ];
    try {
      const h = new URL(url).hostname.replace(/^www\./,'').toLowerCase();
      if (IGNORE_HOSTS.some(dom => h === dom || h.endsWith('.'+dom))) {
        return; // silently ignore navigation on these hosts
      }
    } catch {}
    console.debug(`[ANPR BG] main-frame navigation: tabId=${tabId}, url=${url}`);
    let session = activeSessions.get(tabId);
    if (!session) {
      await loadSessions();
      session = activeSessions.get(tabId);
    }
    if (!session) {
      console.debug('[ANPR BG] No active session for this tab after reload.');
      return;
    }
    if (!urlMatchesOrigin(url, session.originPattern)) {
      console.debug('[ANPR BG] URL does not match session origin. Ending session.');
      activeSessions.delete(tabId);
      return;
    }

    console.log('[ANPR BG] Active session found, injecting scripts...');
    // Try to inject readability + content, then kick off reading if auto-read is enabled in content
    try {
      for (const file of CONTENT_SCRIPTS) {
        await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
      }
      console.log('[ANPR BG] Scripts injected successfully.');
    } catch (e) {
      console.warn('[ANPR BG] Injection after navigation failed:', e && e.message ? e.message : e);
      return;
    }

    // Ask content to start speech (it will honor stored settings and auto-read toggle)
    // Wait a bit to ensure content script is fully loaded
    setTimeout(async () => {
      try {
        console.log('[ANPR BG] Sending startSpeech message to content script.');
        // Get stored TTS settings to pass along
        const settings = await chrome.storage.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang', 'voiceURI']);
        await chrome.tabs.sendMessage(tabId, { 
          action: 'startSpeech',
          rate: settings.ttsRate || 0.8,
          pitch: settings.ttsPitch || 1.0,
          autoLang: settings.ttsAutoLang !== false,
          voiceURI: settings.voiceURI || null
        });
        console.log('[ANPR BG] startSpeech message sent successfully.');
      } catch (e) {
        console.warn('[ANPR BG] First attempt to send startSpeech failed, retrying shortly.', e);
        // Content may not be ready yet; retry once more
        setTimeout(() => {
          console.log('[ANPR BG] Retrying startSpeech message.');
          chrome.storage.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang', 'voiceURI'], (settings) => {
            chrome.tabs.sendMessage(tabId, { 
              action: 'startSpeech',
              rate: settings.ttsRate || 0.8,
              pitch: settings.ttsPitch || 1.0,
              autoLang: settings.ttsAutoLang !== false,
              voiceURI: settings.voiceURI || null
            }).catch((err) => {
              console.error('[ANPR BG] Retry of startSpeech also failed.', err);
            });
          });
        }, 1000); // Increased retry delay
      }
    }, 500); // Initial delay before first attempt
  } catch (e) {
    console.error('[ANPR BG] onCompleted handler error:', e);
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeSessions.delete(tabId);
  saveSessions();
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info && info.status === 'loading' && activeSessions.has(tabId)) {
    // Keep the session record; no-op.
  }
});

chrome.runtime.onStartup?.addListener(() => { loadSessions(); });
chrome.runtime.onInstalled?.addListener(() => { loadSessions(); });
