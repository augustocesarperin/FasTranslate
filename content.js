class SmartTranslator {
  constructor() {
    this.settings = {
      enabled: true,
      delay: 1500,
      api: 'deepl',
      autoDetect: true,
      cacheEnabled: true,
      minTextLength: 10,
      apiKeys: {
        google: '',
        deepl: ''
      }
    };
    
    this.cache = new Map();
    this.typingTimer = null;
    this.currentField = null;
    this.originalText = '';
    this.isTranslating = false;
    
    this.init();
  }
  
  async init() {
    const saved = await browser.storage.local.get(['settings']);
    if (saved.settings) {
      this.settings = { ...this.settings, ...saved.settings };
    }
    
    this.attachListeners();
    
    this.createIndicator();
  }
  
  async translateText(text) {
    if (this.settings.cacheEnabled && this.cache.has(text)) {
      return this.cache.get(text);
    }

    try {
      const response = await browser.runtime.sendMessage({
        action: 'translate',
        text: text,
        settings: this.settings
      });

      if (response.success) {
        const translated = response.translated;
        if (this.settings.cacheEnabled) {
          this.cache.set(text, translated);
          if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }
        return translated;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      this.showError('Erro na tradução. Verifique as configurações.');
      throw error;
    }
  }
  
  detectLanguage(text) {
    const portuguesePatterns = {
      words: /\b(que|não|com|para|por|uma|são|está|isso|então|mas|bem|ainda|quando|muito|já|também|só|depois|mesmo|antes|dois|grande|ainda|qualquer|coisa|sempre|entre|outro|havia|fazer|nosso|seus|quem|você|este|seu|nossa|tudo|eles|elas|essa|num|numa|pelo|pela|isso|aquilo|aqui|nós)\b/gi,
      endings: /[çãõáéíóúâêôà]/g,
      structures: /\b(da|do|das|dos|na|no|nas|nos)\b/g
    };
    
    const matches = {
      words: (text.match(portuguesePatterns.words) || []).length,
      endings: (text.match(portuguesePatterns.endings) || []).length,
      structures: (text.match(portuguesePatterns.structures) || []).length
    };
    
    const score = matches.words * 2 + matches.endings + matches.structures;
    const wordCount = text.split(/\s+/).length;
    
    return score / wordCount > 0.3;
  }
  
  createIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'translation-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #2196F3;
      color: white;
      border-radius: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    document.body.appendChild(indicator);
    this.indicator = indicator;
  }
  
  showIndicator(text) {
    this.indicator.textContent = text;
    this.indicator.style.opacity = '1';
    setTimeout(() => {
      this.indicator.style.opacity = '0';
    }, 2000);
  }
  
  showError(message) {
    this.indicator.textContent = '❌ ' + message;
    this.indicator.style.background = '#f44336';
    this.indicator.style.opacity = '1';
    setTimeout(() => {
      this.indicator.style.opacity = '0';
      this.indicator.style.background = '#2196F3';
    }, 3000);
  }
  
  async forceTranslate(field) {
    if (!this.settings.enabled || this.isTranslating) return;
    
    const text = this.getFieldText(field);
    if (!text) return;

    try {
      this.isTranslating = true;
      this.originalText = text;
      
      this.showIndicator('Traduzindo...');
      const translated = await this.translateText(text);
      this.setFieldText(field, translated);
      this.saveToHistory(text, translated);
      this.showIndicator('✓ Traduzido');
    } catch (error) {
    } finally {
      this.isTranslating = false;
    }
  }
  
  getFieldText(field) {
    if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
      return field.value;
    } else if (field.contentEditable === 'true') {
      return field.innerText;
    }
    return '';
  }
  
  setFieldText(field, text) {
    if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      field.value = text;
      field.setSelectionRange(start, end);
    } else if (field.contentEditable === 'true') {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const offset = range.startOffset;
      
      field.innerText = text;
      
      try {
        const newRange = document.createRange();
        newRange.setStart(field.firstChild || field, Math.min(offset, text.length));
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } catch (e) {
      }
    }
    
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  async saveToHistory(original, translated) {
    const history = await browser.storage.local.get(['history']) || { history: [] };
    history.history = history.history || [];
    
    history.history.unshift({
      original,
      translated,
      timestamp: new Date().toISOString(),
      api: this.settings.api
    });
    
    history.history = history.history.slice(0, 50);
    
    await browser.storage.local.set({ history: history.history });
  }
  
  attachListeners() {
    document.addEventListener('focusin', (e) => {
      if (this.isTextField(e.target)) {
        this.currentField = e.target;
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z' && this.currentField && this.originalText) {
        e.preventDefault();
        this.setFieldText(this.currentField, this.originalText);
        this.showIndicator('↶ Desfeito');
      }
    });
  }
  
  isTextField(element) {
    return element.tagName === 'TEXTAREA' || 
           element.tagName === 'INPUT' || 
           element.contentEditable === 'true';
  }
}

const translator = new SmartTranslator();

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'updateSettings':
      translator.settings = { ...translator.settings, ...request.settings };
      browser.storage.local.set({ settings: translator.settings });
      break;
      
    case 'getHistory':
      browser.storage.local.get(['history']).then(sendResponse);
      return true;
      
    case 'toggle-translation':
      translator.settings.enabled = !translator.settings.enabled;
      translator.showIndicator(translator.settings.enabled ? '✓ Tradução Ativada' : '✗ Tradução Desativada');
      browser.storage.local.set({ settings: translator.settings });
      break;
      
    case 'translate-now':
      if (translator.currentField) {
        translator.forceTranslate(translator.currentField);
      }
      break;
  }
});
