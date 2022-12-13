document.addEventListener('DOMContentLoaded', async () => {
  // Elementos
  const elements = {
    enabled: document.getElementById('enabled'),
    delay: document.getElementById('delay'),
    delayValue: document.getElementById('delayValue'),
    api: document.getElementById('api'),
    autoDetect: document.getElementById('autoDetect'),
    cacheEnabled: document.getElementById('cacheEnabled'),
    googleApiKey: document.getElementById('googleApiKey'),
    deeplApiKey: document.getElementById('deeplApiKey'),
    saveApiKeys: document.getElementById('saveApiKeys'),
    apiStatus: document.getElementById('apiStatus'),
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory')
  };
  
  // Carrega configurações
  const { settings } = await chrome.storage.local.get(['settings']);
  if (settings) {
    elements.enabled.checked = settings.enabled;
    elements.delay.value = settings.delay / 1000;
    elements.delayValue.textContent = settings.delay / 1000;
    elements.api.value = settings.api;
    elements.autoDetect.checked = settings.autoDetect;
    elements.cacheEnabled.checked = settings.cacheEnabled;
    elements.googleApiKey.value = settings.apiKeys?.google || '';
    elements.deeplApiKey.value = settings.apiKeys?.deepl || '';
  }
  
  // Navegação por abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      
      // Carrega histórico quando abre a aba
      if (tab.dataset.tab === 'history') {
        loadHistory();
      }
    });
  });
  
  // Listeners de configuração
  elements.enabled.addEventListener('change', updateSettings);
  elements.api.addEventListener('change', updateSettings);
  elements.autoDetect.addEventListener('change', updateSettings);
  elements.cacheEnabled.addEventListener('change', updateSettings);
  
  elements.delay.addEventListener('input', (e) => {
    elements.delayValue.textContent = e.target.value;
    updateSettings();
  });
  
  // Salvar API Keys
  elements.saveApiKeys.addEventListener('click', async () => {
    const settings = await chrome.storage.local.get(['settings']);
    settings.settings.apiKeys = {
      google: elements.googleApiKey.value,
      deepl: elements.deeplApiKey.value
    };
    
    await chrome.storage.local.set({ settings: settings.settings });
    
    // Mostra status
    elements.apiStatus.style.display = 'block';
    elements.apiStatus.className = 'status';
    elements.apiStatus.textContent = '✓ Chaves salvas com sucesso!';
    
    setTimeout(() => {
      elements.apiStatus.style.display = 'none';
    }, 3000);
    
    updateSettings();
  });
  
  // Limpar histórico
  elements.clearHistory.addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      await chrome.storage.local.set({ history: [] });
      loadHistory();
    }
  });
  
  // Atualiza configurações
  async function updateSettings() {
    const settings = {
      enabled: elements.enabled.checked,
      delay: parseFloat(elements.delay.value) * 1000,
      api: elements.api.value,
      autoDetect: elements.autoDetect.checked,
      cacheEnabled: elements.cacheEnabled.checked,
      apiKeys: {
        google: elements.googleApiKey.value,
        deepl: elements.deeplApiKey.value
      }
    };
    
    // Salva e envia para content script
    await chrome.storage.local.set({ settings });
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      // Só envia a mensagem se estivermos em uma aba válida (não em chrome://)
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'updateSettings', settings });
      }
    } catch (error) {
      // Ignora o erro "Receiving end does not exist" que ocorre em páginas
      // como chrome://extensions, o que é um comportamento esperado.
      if (!error.message.includes('Receiving end does not exist')) {
        console.error("Erro ao enviar mensagem para o content script:", error);
      }
    }
  }
  
  // Carrega histórico
  async function loadHistory() {
    const { history = [] } = await chrome.storage.local.get(['history']);
    
    if (history.length === 0) {
      elements.historyList.innerHTML = '<p style="text-align: center; color: #666;">Nenhuma tradução ainda</p>';
      return;
    }
    
    elements.historyList.innerHTML = history.map(item => {
      const date = new Date(item.timestamp);
      const timeAgo = getTimeAgo(date);
      
      return `
        <div class="history-item">
          <div class="original">${escapeHtml(item.original)}</div>
          <div class="translated">${escapeHtml(item.translated)}</div>
          <div class="meta">${timeAgo} • ${item.api.toUpperCase()}</div>
        </div>
      `;
    }).join('');
  }
  
  // Helpers
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'agora mesmo';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});