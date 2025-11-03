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
})();
