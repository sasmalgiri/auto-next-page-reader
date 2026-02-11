(function(){
  const urlInput = document.getElementById('supportUrl');
  const statusEl = document.getElementById('status');

  function isValidUrl(url){
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch { return false; }
  }

  // Load existing
  chrome.storage.sync.get(['supportUrl'], (data) => {
    if (typeof data.supportUrl === 'string' && data.supportUrl.length > 0) {
      urlInput.value = data.supportUrl;
    }
  });

  document.getElementById('save').addEventListener('click', () => {
    const val = urlInput.value.trim();
    if (!isValidUrl(val)) {
      statusEl.textContent = 'Please enter a valid URL (https://...)';
      statusEl.className = 'hint err';
      return;
    }
    chrome.storage.sync.set({ supportUrl: val }, () => {
      statusEl.textContent = 'Saved';
      statusEl.className = 'hint ok';
      setTimeout(() => { statusEl.textContent = ''; }, 1500);
    });
  });

  // ---------- Premium License Key ----------
  const premiumInput = document.getElementById('premiumKey');
  const premiumStatus = document.getElementById('premiumStatus');

  chrome.storage.sync.get(['premiumKey'], (data) => {
    if (typeof data.premiumKey === 'string' && data.premiumKey) {
      premiumInput.value = data.premiumKey;
      premiumStatus.textContent = 'Premium active';
      premiumStatus.className = 'hint ok';
    }
  });

  document.getElementById('activatePremium').addEventListener('click', () => {
    const key = premiumInput.value.trim();
    if (!key) {
      premiumStatus.textContent = 'Please enter a license key.';
      premiumStatus.className = 'hint err';
      return;
    }
    chrome.storage.sync.set({ premiumKey: key }, () => {
      chrome.storage.local.set({ premiumActive: true }, () => {
        premiumStatus.textContent = 'Premium activated!';
        premiumStatus.className = 'hint ok';
        setTimeout(() => { premiumStatus.textContent = 'Premium active'; }, 2000);
      });
    });
  });

  // ---------- Google Cloud Translation API Key ----------
  const apiKeyInput = document.getElementById('translateApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  chrome.storage.sync.get(['translateApiKey'], (data) => {
    if (typeof data.translateApiKey === 'string' && data.translateApiKey) {
      apiKeyInput.value = data.translateApiKey;
      apiKeyStatus.textContent = 'API key saved';
      apiKeyStatus.className = 'hint ok';
    }
  });

  document.getElementById('saveApiKey').addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      chrome.storage.sync.set({ translateApiKey: '' }, () => {
        apiKeyStatus.textContent = 'API key cleared (using free endpoint)';
        apiKeyStatus.className = 'hint ok';
        setTimeout(() => { apiKeyStatus.textContent = ''; }, 2000);
      });
      return;
    }
    chrome.storage.sync.set({ translateApiKey: key }, () => {
      apiKeyStatus.textContent = 'API key saved';
      apiKeyStatus.className = 'hint ok';
      setTimeout(() => { apiKeyStatus.textContent = 'API key saved'; }, 1500);
    });
  });
})();
