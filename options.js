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

  // ---------- Premium License Key (Gumroad) ----------
  // TODO: Replace with your actual Gumroad product permalink
  const GUMROAD_PRODUCT_ID = 'YOUR_GUMROAD_PRODUCT_PERMALINK';

  const premiumInput = document.getElementById('premiumKey');
  const premiumStatus = document.getElementById('premiumStatus');
  const activateBtn = document.getElementById('activatePremium');
  const deactivateBtn = document.getElementById('deactivatePremium');

  // Load existing license state
  chrome.storage.sync.get(['premiumKey', 'premiumValidatedAt', 'premiumEmail'], (data) => {
    if (typeof data.premiumKey === 'string' && data.premiumKey) {
      premiumInput.value = data.premiumKey;
      if (data.premiumValidatedAt) {
        const date = new Date(data.premiumValidatedAt).toLocaleDateString();
        premiumStatus.textContent = `Premium active (validated ${date})${data.premiumEmail ? ' — ' + data.premiumEmail : ''}`;
        premiumStatus.className = 'hint ok';
        if (deactivateBtn) deactivateBtn.style.display = 'inline-block';
      }
    }
  });

  async function verifyGumroadLicense(licenseKey) {
    try {
      const resp = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `product_id=${encodeURIComponent(GUMROAD_PRODUCT_ID)}&license_key=${encodeURIComponent(licenseKey)}&increment_uses_count=true`
      });
      if (!resp.ok) return { success: false, error: 'Network error (' + resp.status + ')' };
      const data = await resp.json();
      if (data.success) {
        return {
          success: true,
          email: data.purchase?.email || null,
          productName: data.purchase?.product_name || null,
          refunded: !!data.purchase?.refunded,
          disputed: !!data.purchase?.disputed,
          uses: data.uses || 0
        };
      }
      return { success: false, error: data.message || 'Invalid license key' };
    } catch (e) {
      return { success: false, error: 'Could not reach Gumroad. Check your internet connection.' };
    }
  }

  activateBtn.addEventListener('click', async () => {
    const key = premiumInput.value.trim();
    if (!key) {
      premiumStatus.textContent = 'Please enter a license key.';
      premiumStatus.className = 'hint err';
      return;
    }

    premiumStatus.textContent = 'Verifying with Gumroad...';
    premiumStatus.className = 'hint';
    activateBtn.disabled = true;

    const result = await verifyGumroadLicense(key);
    activateBtn.disabled = false;

    if (result.success && !result.refunded && !result.disputed) {
      const now = Date.now();
      chrome.storage.sync.set({
        premiumKey: key,
        premiumValidatedAt: now,
        premiumEmail: result.email || ''
      }, () => {
        chrome.storage.local.set({ premiumActive: true }, () => {
          premiumStatus.textContent = `Premium activated! ${result.email ? '(' + result.email + ')' : ''}`;
          premiumStatus.className = 'hint ok';
          if (deactivateBtn) deactivateBtn.style.display = 'inline-block';
        });
      });
    } else if (result.refunded) {
      premiumStatus.textContent = 'This license has been refunded.';
      premiumStatus.className = 'hint err';
      chrome.storage.local.set({ premiumActive: false });
    } else if (result.disputed) {
      premiumStatus.textContent = 'This license is under dispute.';
      premiumStatus.className = 'hint err';
      chrome.storage.local.set({ premiumActive: false });
    } else {
      premiumStatus.textContent = result.error || 'Invalid license key.';
      premiumStatus.className = 'hint err';
    }
  });

  // Deactivate premium
  if (deactivateBtn) {
    deactivateBtn.addEventListener('click', () => {
      chrome.storage.sync.remove(['premiumKey', 'premiumValidatedAt', 'premiumEmail']);
      chrome.storage.local.set({ premiumActive: false });
      premiumInput.value = '';
      premiumStatus.textContent = 'Premium deactivated.';
      premiumStatus.className = 'hint';
      deactivateBtn.style.display = 'none';
    });
  }

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
