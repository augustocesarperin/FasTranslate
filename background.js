if (typeof importScripts === 'function') {
  importScripts('lib/browser-polyfill.js');
}

async function translateWithGoogle(text, apiKey) {
  if (!apiKey) throw new Error('Google API key não configurada');
  
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'pt',
      target: 'en',
      format: 'text'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Translate API error: ${error.error.message}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

async function translateWithDeepL(text, apiKey) {
  const isFree = !apiKey.endsWith(":fx");
  const apiUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      text: text,
      source_lang: 'PT',
      target_lang: 'EN'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL API error: ${error}`);
  }
  
  const data = await response.json();
  return data.translations[0].text;
}

async function translateWithMyMemory(text) {
  const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt|en`);
  if (!response.ok) {
    throw new Error('MyMemory API error');
  }
  const data = await response.json();
  return data.responseData.translatedText;
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, settings } = request;

    (async () => {
      try {
        let translated;
        switch (settings.api) {
          case 'google':
            translated = await translateWithGoogle(text, settings.apiKeys.google);
            break;
          case 'deepl':
            if (!settings.apiKeys.deepl) {
              translated = await translateWithMyMemory(text);
            } else {
              translated = await translateWithDeepL(text, settings.apiKeys.deepl);
            }
            break;
          default:
            translated = await translateWithMyMemory(text);
        }
        sendResponse({ success: true, translated });
      } catch (error) {
        // Silently fail or handle error appropriately for production
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
});

browser.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-translation" || command === "translate-now") {
    browser.tabs.sendMessage(tab.id, { action: command });
  }
});
