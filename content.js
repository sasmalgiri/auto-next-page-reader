// Ensure variables are not redeclared
if (typeof pageCounter === 'undefined') {
  var pageCounter = 0; // Track the current page/chapter number
}

if (typeof autoNextEnabled === 'undefined') {
  var autoNextEnabled = true; // Default auto-next to ON
}

if (typeof utterance === 'undefined') {
  var utterance; // Declare speech synthesis utterance only once
}
if (typeof preferredVoiceURI === 'undefined') {
  var preferredVoiceURI = null; // Persist chosen voice
}

if (typeof remainingText === 'undefined') {
  var remainingText = ''; // Track remaining text for the forward functionality
}

if (typeof extractedContent === 'undefined') {
  var extractedContent = ''; // Store the extracted content for potential file creation
}

if (typeof isReading === 'undefined') {
  var isReading = false; // Track if reading is ongoing
}

if (typeof autoReadEnabled === 'undefined') {
  var autoReadEnabled = true; // Default auto-read to ON
}
if (typeof ttsRate === 'undefined') {
  var ttsRate = 0.8;
}
if (typeof ttsPitch === 'undefined') {
  var ttsPitch = 1.0;
}
if (typeof ttsAutoLang === 'undefined') {
  var ttsAutoLang = true;
}

if (typeof userStoppedReading === 'undefined') {
  var userStoppedReading = false; // Track if the user manually stopped reading
}

// Block ads on the page
function blockAds() {
  try {
    const adSelectors = [
      '[id*="ad"]',
      '[class*="ad"]',
      'iframe[src*="ads"]',
      'iframe[src*="adprovider"]',
      'div[class*="ad"]',
      'script[src*="ads"]',
      'script[src*="marphezis"]',
      'script[src*="tracking"]',
    ];
    adSelectors.forEach((selector) => {
      const ads = document.querySelectorAll(selector);
      ads.forEach((ad) => {
        ad.remove();
        console.log('Removed ad:', ad);
      });
    });
  } catch (error) {
    console.error('Error while removing ads:', error);
  }
}
// Initialize only once to avoid duplicate listeners when the content script is injected multiple times
if (!window.__AutoNextReaderInitialized) {
  window.__AutoNextReaderInitialized = true;
  blockAds();

  // Load persisted toggles so behavior is consistent across pages
  try {
    chrome.storage?.local.get(['autoNextEnabled', 'autoReadEnabled'], (data) => {
      if (typeof data.autoNextEnabled === 'boolean') {
        autoNextEnabled = data.autoNextEnabled;
      }
      if (typeof data.autoReadEnabled === 'boolean') {
        autoReadEnabled = data.autoReadEnabled;
      }
    });
    chrome.storage?.local.get(['ttsRate', 'ttsPitch', 'ttsAutoLang'], (data) => {
      if (typeof data.ttsRate === 'number') ttsRate = data.ttsRate;
      if (typeof data.ttsPitch === 'number') ttsPitch = data.ttsPitch;
      if (typeof data.ttsAutoLang === 'boolean') ttsAutoLang = data.ttsAutoLang;
    });
  } catch (e) {
    // storage may be unavailable in some contexts; ignore
  }
}

// Function to extract the main content using Readability.js and apply text filters
function extractMainContent() {
  let doc = document.cloneNode(true); // Clone the document to avoid modifying the live page
  let reader = new Readability(doc);
  let article = reader.parse(); // Parse the document using Readability.js
  let content = article ? article.textContent : ''; // Get the clean article content

  if (content) {
    content = applyTextFilters(content); // Apply extra filters to the content
    extractedContent = content; // Store the extracted content for later use
  }

  return content;
}

// Function to apply extra filters: remove specific unwanted phrases, special characters, links, repetitive words, and tips
function applyTextFilters(text) {
  try {
    // 1. Remove specific unwanted phrases
    const phrasesToIgnore = [
      "Novel Bin Read light novel, web novel, korean novel and chinese novel online for free.",
      "You can find hundreds of english translated light novel, web novel, korean novel and chinese novel which are daily updated!",
      "Read novels online, read light novel online, read online free, free light novel online."
    ];
    phrasesToIgnore.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      text = text.replace(regex, '');
    });

  // 2. Remove only control/zero-width characters; keep all Unicode letters and most punctuation for global languages
  // Remove zero-width and BOM
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Remove other control characters except newlines and tabs
  text = text.replace(/[\u0000-\u001F\u007F]/g, (m) => (m === "\n" || m === "\t" ? m : " "));

    // 3. Remove links and URLs
    text = text.replace(/https?:\/\/\S+|www\.\S+/g, ""); // Remove URLs
    text = text.replace(/\b(?:http|https|www)\b\S*/gi, ""); // Extra check for isolated web references

    // 4. Remove continuous repetitive words (best-effort, Unicode friendly)
    try {
      text = text.replace(/(\b)([\p{L}]+)(?:\s+\2\b)+/giu, "$1$2");
    } catch (_) {
      // Fallback for environments without Unicode property escapes
      text = text.replace(/\b(\w+)\b(?:\s+\1\b)+/gi, "$1");
    }

    // 5. Remove any instructional phrases like "TIP", "Note", etc.
    text = text.replace(/\b(?:TIP|Note|Hint|Reminder):?\b.*?(?:\.|\n|$)/gi, ""); // Removes lines starting with TIP, Note, Hint

    // 6. Trim excessive whitespace
    return text.trim().replace(/\s\s+/g, ' '); // Collapse multiple spaces into one
  } catch (error) {
    console.error("Error during content filtering:", error);
    return text; // Return unmodified text if filtering fails
  }
}

// Function to handle the text-to-speech
function startSpeech(text, rate = null, pitch = null, opts = {}) {
  try {
    if (utterance) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
    }

    // Set remaining text for forward button
    if (text) {
      remainingText = text;
    }

    utterance = new SpeechSynthesisUtterance(remainingText);
    // Determine language & voice
    const langToUse = (opts.lang) || (ttsAutoLang ? detectPageLanguage() : 'en-US') || 'en-US';
    utterance.lang = langToUse;
    // Choose a matching voice if available
    const voices = window.speechSynthesis.getVoices();
    if (opts.voiceURI) preferredVoiceURI = opts.voiceURI;
    let chosen = null;
    if (preferredVoiceURI) {
      chosen = voices.find(v => v.voiceURI === preferredVoiceURI);
    }
    if (!chosen && langToUse) {
      chosen = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langToUse.toLowerCase().slice(0,2)));
    }
    if (chosen) utterance.voice = chosen;

    // Rate & pitch: use provided or stored defaults
    utterance.rate = (typeof rate === 'number' ? rate : ttsRate);
    utterance.pitch = (typeof pitch === 'number' ? pitch : ttsPitch);

    utterance.onend = () => {
      if (!userStoppedReading) {
        isReading = false; // Update the status to not reading
        if (autoNextEnabled) {
          console.log("Chapter reading complete. Proceeding to the next chapter...");
          tryNextChapter(); // Try to reach the next chapter
        }
      }
    };

    utterance.onboundary = (event) => {
      if (event.name === "word") {
        // Update remainingText from the word boundary event
        remainingText = remainingText.substring(event.charIndex);
      }
    };

    // If voices aren't loaded yet, wait for them once
    if (window.speechSynthesis.getVoices().length === 0) {
      const once = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', once);
        try { if (isReading) { /* already started */ } else { window.speechSynthesis.speak(utterance); } } catch {}
      };
      window.speechSynthesis.addEventListener('voiceschanged', once);
    }
    window.speechSynthesis.speak(utterance);
    isReading = true; // Update the status to reading
    userStoppedReading = false; // Reset the user stopped flag
  } catch (error) {
    console.error('Error during speech synthesis:', error);
  }
}

function detectPageLanguage() {
  try {
    const htmlLang = document.documentElement.getAttribute('lang');
    if (htmlLang && /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(htmlLang)) return htmlLang;
    const metaLang = document.querySelector('meta[http-equiv="content-language" i]')?.content;
    if (metaLang) return metaLang.split(',')[0].trim();
    return navigator.language || 'en-US';
  } catch { return 'en-US'; }
}

// Function to stop speech synthesis
function stopSpeech() {
  try {
    if (utterance && isReading) {
      userStoppedReading = true; // Set the flag to indicate user stopped the reading
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      isReading = false; // Update the status to not reading
      console.log("User stopped the reading. Auto-next will not proceed.");
    }
  } catch (error) {
    console.error("Error while stopping speech synthesis:", error);
  }
}

// Function to skip forward in the text
function skipForward() {
  try {
    if (remainingText) {
      const skipAmount = 300; // Increase skipping to provide a better forward experience
      remainingText = remainingText.substring(skipAmount).trim();

      if (remainingText) {
        console.log('Skipping forward in the text...');
        startSpeech(remainingText); // Restart speech synthesis with the remaining text
      } else {
        console.log('No more text to skip.');
      }
    }
  } catch (error) {
    console.error('Error during forward skipping:', error);
  }
}

// Function to simulate a mouse click on the next chapter button
function clickNextChapterButton() {
  try {
    // Select the next chapter button using its id and class
    const nextButton = document.querySelector('a#next_chap.btn-success');

    // If the button is found and has a valid href attribute, simulate a click
    if (nextButton && nextButton.href) {
      console.log('Simulating a mouse click on the next chapter button:', nextButton.href);
      
      // Create a mouse click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });

      // Dispatch the click event on the button
      nextButton.dispatchEvent(clickEvent);
      return true;
    } else {
      console.log('Next chapter button not found.');
    }
  } catch (error) {
    console.error('Error while clicking the next chapter button:', error);
  }
  return false;
}

// Function to attempt going to the next chapter using multiple methods
function tryNextChapter() {
  if (autoNextEnabled && !isReading) {
    console.log('Attempting all methods to reach the next chapter...');
    
    // Attempt to click the next chapter button first
    if (clickNextChapterButton()) {
      console.log('Successfully clicked the next chapter button.');
    } else if (tryIncrementalUrl()) {
      console.log('Next chapter found by incrementing the URL');
    } else if (checkForRelNext()) {
      console.log("Next chapter found via rel='next'");
    } else if (findNextLinkByText()) {
      console.log('Next chapter link found by text');
    } else {
      console.log('Failed to go to the next chapter using all methods.');
    }
  }
}

// Automatically start reading and attempting to go to the next chapter when loaded
function autoStartReadingOnNextChapter() {
  window.addEventListener('load', () => {
    if (autoReadEnabled) {
      console.log("Page loaded. Starting auto-read...");
      const text = extractMainContent();
      if (text) {
        startSpeech(text); // Start reading the new chapter
      } else {
        console.log("No content found to read.");
      }
    }
  });
}

// Automatically start the auto next chapter and auto-read process (guarded)
if (window.__AutoNextReaderInitialized) {
  autoStartReadingOnNextChapter();
}

// Keyboard shortcut to stop and resume reading with Ctrl + `
if (!window.__AutoNextReaderKeydownBound) {
  window.__AutoNextReaderKeydownBound = true;
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === '`') {
      if (isReading) {
        stopSpeech(); // Stop reading
      } else if (!isReading && remainingText) {
        startSpeech(remainingText); // Resume reading from where it stopped
      }
    }
  });
}

// Check for rel="next" in links
function checkForRelNext() {
  try {
    const nextRelLink = document.querySelector('a[rel="next"]');
    if (nextRelLink && nextRelLink.href) {
      console.log("Following rel='next' link:", nextRelLink.href);
      window.location.href = nextRelLink.href;
      return true;
    } else {
      console.log("No rel='next' link found.");
    }
  } catch (error) {
    console.error('Error while checking rel="next":', error);
  }
  return false;
}

// Try incrementing the chapter or page number in the URL path
function tryIncrementalUrl() {
  try {
    const currentUrl = window.location.href;
    // Common URL patterns for chapters/pages
    const patterns = [
      /(chapter[-_\/]?)(\d+)/i,
      /(ch[-_\/]?)(\d+)/i,
      /(episode[-_\/]?)(\d+)/i,
      /([?&](?:chapter|ch|ep|page)=(\d+))/i
    ];

    for (const pattern of patterns) {
      const match = currentUrl.match(pattern);
      if (match) {
        const fullMatch = match[0];
        const prefix = match[1];
        const num = parseInt(match[2]);
        if (!isNaN(num)) {
          const next = num + 1;
          let newUrl;
          if (fullMatch.startsWith('?') || fullMatch.startsWith('&')) {
            newUrl = currentUrl.replace(pattern, (m, g1, g2) => m.replace(g2, String(next)));
          } else {
            newUrl = currentUrl.replace(pattern, `${prefix}${next}`);
          }
          console.log('Attempting URL increment:', newUrl);
          window.location.href = newUrl;
          return true;
        }
      }
    }
    console.log('No incrementable chapter pattern detected in URL.');
  } catch (error) {
    console.error('Error while incrementing URL:', error);
  }
  return false;
}

// Find a likely "next" link by common text labels
function findNextLinkByText() {
  try {
    const texts = [
      'next', 'next chapter', 'next »', '»', '›', '→', '>>', '下一章', 'التالي', 'suivant'
    ];
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      const label = (a.innerText || a.textContent || '').trim().toLowerCase();
      if (!label) continue;
      if (texts.some(t => label === t || label.includes(t))) {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && a.offsetParent !== null) {
          console.log('Following next link by text:', href);
          a.click();
          return true;
        }
      }
    }
  } catch (e) {
    console.error('Error while finding next link by text:', e);
  }
  return false;
}

// Handle messages from the popup
if (!window.__AutoNextReaderMsgBound) {
  window.__AutoNextReaderMsgBound = true;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === 'toggleAutoNext') {
        autoNextEnabled = message.autoNextEnabled;
        sendResponse({ autoNextEnabled });
      } else if (message.action === 'toggleAutoRead') {
        autoReadEnabled = message.autoReadEnabled;
        sendResponse({ autoReadEnabled });
      } else if (message.action === 'startSpeech') {
        const text = extractMainContent();
        if (text) {
          startSpeech(text, message.rate, message.pitch, { lang: message.lang, voiceURI: message.voiceURI, autoLang: message.autoLang });
        }
      } else if (message.action === 'skipForward') {
        skipForward(); // Skip forward in the text
      } else if (message.action === 'stopSpeech') {
        stopSpeech(); // Stop speech from popup
      }
    } catch (error) {
      console.error("Error while handling message:", error);
    }
  });
}

// Utility function to update status in the popup
function updateStatus(message) {
  chrome.runtime.sendMessage({ action: 'updateStatus', message });
}
