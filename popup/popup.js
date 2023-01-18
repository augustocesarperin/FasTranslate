document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    api: document.getElementById('api'),
    googleApiKey: document.getElementById('googleApiKey'),
    deeplApiKey: document.getElementById('deeplApiKey'),
    saveApiKeys: document.getElementById('saveApiKeys'),
    apiStatus: document.getElementById('apiStatus'),
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory')
  };
  
  const { settings } = await browser.storage.local.get(['settings']);
  if (settings) {
    elements.api.value = settings.api;
    elements.googleApiKey.value = settings.apiKeys?.google || '';
    elements.deeplApiKey.value = settings.apiKeys?.deepl || '';
  }
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      
      if (tab.dataset.tab === 'history') {
        loadHistory();
      }
    });
  });
  
  elements.api.addEventListener('change', updateSettings);
  
  elements.saveApiKeys.addEventListener('click', async () => {
    const { settings: currentSettings } = await browser.storage.local.get(['settings']);
    currentSettings.apiKeys = {
      google: elements.googleApiKey.value,
      deepl: elements.deeplApiKey.value
    };
    
    await browser.storage.local.set({ settings: currentSettings });
    
    elements.apiStatus.style.display = 'block';
    elements.apiStatus.className = 'status';
    elements.apiStatus.textContent = '✓ Chaves salvas com sucesso!';
    
    setTimeout(() => {
      elements.apiStatus.style.display = 'none';
    }, 3000);
    
    updateSettings();
  });
  
  elements.clearHistory.addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      await browser.storage.local.set({ history: [] });
      loadHistory();
    }
  });
  
  async function updateSettings() {
    const { settings: oldSettings } = await browser.storage.local.get(['settings']);
    
    const settingsToSave = {
      ...oldSettings,
      api: elements.api.value,
      apiKeys: {
        google: elements.googleApiKey.value,
        deepl: elements.deeplApiKey.value
      }
    };
    
    await browser.storage.local.set({ settings: settingsToSave });
    
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await browser.tabs.sendMessage(tab.id, { action: 'updateSettings', settings: settingsToSave });
      }
    } catch (error) {
      // Ignora o erro "Receiving end does not exist" que ocorre em páginas
      // como chrome://extensions, o que é um comportamento esperado.
      if (!error.message.includes('Receiving end does not exist')) {
        // Em produção, podemos optar por não logar nada ou usar um sistema de log remoto.
      }
    }
  }
  
  async function loadHistory() {
    const { history = [] } = await browser.storage.local.get(['history']);
    
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