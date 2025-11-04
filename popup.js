let autoNextEnabled = true; // Default is ON
let isSpeaking = false; // Track if the speech is currently speaking
let activeTabId = null; // Track the tab ID where reading was initiated
let autoReadEnabled = true; // Default is ON
let ttsRate = 0.8;
let ttsPitch = 1.0;
let ttsAutoLang = true;

// Toggle auto-read feature
document.getElementById('toggleAutoRead').addEventListener('click', async () => {
    autoReadEnabled = !autoReadEnabled;
    const status = autoReadEnabled ? "Auto Read ON" : "Auto Read OFF";
    document.getElementById('toggleAutoRead').innerText = status;

    try {
    await sendMessageToTab('toggleAutoRead', { autoReadEnabled });
    chrome.storage.local.set({ autoReadEnabled });
    updateStatus(`Auto Read is now ${status}.`);
    } catch (error) {
        console.error('Failed to toggle auto-read:', error);
    }
});



// Restore state when popup is reopened
document.addEventListener('DOMContentLoaded', async () => {
  chrome.storage.local.get(['isSpeaking', 'autoNextEnabled', 'activeTabId', 'autoReadEnabled', 'ttsRate', 'ttsPitch', 'ttsAutoLang'], (data) => {
    isSpeaking = data.isSpeaking || false;
    autoNextEnabled = data.autoNextEnabled ?? true;
    activeTabId = data.activeTabId || null;
    autoReadEnabled = data.autoReadEnabled ?? true;
    ttsRate = typeof data.ttsRate === 'number' ? data.ttsRate : 0.8;
    ttsPitch = typeof data.ttsPitch === 'number' ? data.ttsPitch : 1.0;
    ttsAutoLang = typeof data.ttsAutoLang === 'boolean' ? data.ttsAutoLang : true;

    // Update UI based on the stored state
    if (isSpeaking) {
      updateStatus('Reading in progress...');
      toggleControls('start');
    } else {
      updateStatus('Ready to start...');
      toggleControls('stop');
    }
    document.getElementById('toggle').innerText = autoNextEnabled ? "Auto Next ON" : "Auto Next OFF";
    document.getElementById('toggleAutoRead').innerText = autoReadEnabled ? "Auto Read ON" : "Auto Read OFF";

    // Initialize TTS controls
    const rateEl = document.getElementById('rate');
    const pitchEl = document.getElementById('pitch');
    const rateVal = document.getElementById('rateVal');
    const pitchVal = document.getElementById('pitchVal');
    const autoLangEl = document.getElementById('autoLang');
    rateEl.value = String(ttsRate);
    pitchEl.value = String(ttsPitch);
    rateVal.textContent = String(ttsRate);
    pitchVal.textContent = String(ttsPitch);
    autoLangEl.checked = !!ttsAutoLang;
  });

  // Prime on-demand scripts in the active tab so overlay/hotkeys work immediately after opening the popup.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['Readability.js', 'content.js'] });
    }
  } catch (e) {
    // Likely missing file URL access or restricted page; will inject again on Start
    console.debug('Pre-injection skipped:', e?.message || e);
  }
});

// Helper function to inject content script if it's not loaded and send messages to content script
async function sendMessageToTab(action, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Only allow actions if the current tab matches the activeTabId
  if (activeTabId !== null && tab.id !== activeTabId) {
    console.error('Attempting to control a different tab. Action aborted.');
    return;
  }

  // Inject scripts on-demand (Readability first, then content script)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['Readability.js', 'content.js']
    });
  } catch (err) {
    console.error('Failed to inject content script:', err);
  }

  return chrome.tabs.sendMessage(tab.id, { action, ...data });
}

// Open important settings guide
document.getElementById('settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
});

// Open support/donation page (configurable in Options, with a sensible default)
const defaultSupportUrl = 'https://buymeacoffee.com/sasmalgiric';
let supportUrlCache = defaultSupportUrl;
chrome.storage.sync.get(['supportUrl'], (data) => {
  if (typeof data.supportUrl === 'string' && data.supportUrl) {
    supportUrlCache = data.supportUrl;
  }
});
document.getElementById('support').addEventListener('click', () => {
  const url = supportUrlCache;
  if (url && /^https?:\/\//i.test(url)) {
    chrome.tabs.create({ url });
  } else {
    // If not configured, open the options page to set it up
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  }
});

// Start reading aloud
document.getElementById('start').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab.id; // Set active tab ID when reading starts
    chrome.storage.local.set({ activeTabId });

    if (!isSpeaking) {
      // Ensure latest TTS values are used
      const rateEl = document.getElementById('rate');
      const pitchEl = document.getElementById('pitch');
      const autoLangEl = document.getElementById('autoLang');
      ttsRate = parseFloat(rateEl.value);
      ttsPitch = parseFloat(pitchEl.value);
      ttsAutoLang = !!autoLangEl.checked;
      chrome.storage.local.set({ ttsRate, ttsPitch, ttsAutoLang });

      await sendMessageToTab('startSpeech', { rate: ttsRate, pitch: ttsPitch, autoLang: ttsAutoLang });
      updateStatus('Reading started...');
      isSpeaking = true;
      chrome.storage.local.set({ isSpeaking });
      toggleControls('start');
    }
  } catch (error) {
    console.error('Failed to start speech:', error);
  }
});

// Stop reading
document.getElementById('stop').addEventListener('click', async () => {
  try {
    if (isSpeaking && activeTabId !== null) {
      await sendMessageToTab('stopSpeech');
    }
  } catch (error) {
    console.error('Failed to stop speech in tab:', error);
  } finally {
    isSpeaking = false;
    chrome.storage.local.set({ isSpeaking, activeTabId: null });
    activeTabId = null;
    updateStatus('Reading stopped.');
    toggleControls('stop');
  }
});

// Toggle auto-next feature
document.getElementById('toggle').addEventListener('click', async () => {
  autoNextEnabled = !autoNextEnabled;
  const status = autoNextEnabled ? "Auto Next ON" : "Auto Next OFF";
  document.getElementById('toggle').innerText = status;

  try {
    await sendMessageToTab('toggleAutoNext', { autoNextEnabled });
    chrome.storage.local.set({ autoNextEnabled });
    updateStatus(`Auto Next is now ${status}.`);
  } catch (error) {
    console.error('Failed to toggle auto next:', error);
  }
});

// Update the status message for better UX feedback
function updateStatus(message) {
  document.getElementById('status').innerText = message;
}

// Listen for status updates from the content script while the popup is open
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'updateStatus' && msg.message) {
    updateStatus(msg.message);
  }
});

// Skip forward in the text
document.getElementById('forward').addEventListener('click', async () => {
  try {
    if (activeTabId !== null) {
      await sendMessageToTab('skipForward');
      updateStatus('Skipped forward...');
    }
  } catch (error) {
    console.error('Failed to skip forward:', error);
  }
});

// Persist TTS control changes
document.getElementById('rate').addEventListener('input', (e) => {
  ttsRate = parseFloat(e.target.value);
  document.getElementById('rateVal').textContent = String(ttsRate);
});
document.getElementById('rate').addEventListener('change', () => {
  chrome.storage.local.set({ ttsRate });
});
document.getElementById('pitch').addEventListener('input', (e) => {
  ttsPitch = parseFloat(e.target.value);
  document.getElementById('pitchVal').textContent = String(ttsPitch);
});
document.getElementById('pitch').addEventListener('change', () => {
  chrome.storage.local.set({ ttsPitch });
});
document.getElementById('autoLang').addEventListener('change', (e) => {
  ttsAutoLang = !!e.target.checked;
  chrome.storage.local.set({ ttsAutoLang });
});

// Enable/disable buttons based on the current state
function toggleControls(action) {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const forwardButton = document.getElementById('forward');

  if (action === 'start') {
    startButton.disabled = true;
    stopButton.disabled = false;
    forwardButton.disabled = false;
  } else if (action === 'stop') {
    startButton.disabled = false;
    stopButton.disabled = true;
    forwardButton.disabled = true;
  }
}
