const DEFAULT_SETTINGS = {
  enabled: true,
  expansionMode: 'space', // 'space', 'tab', 'enter', 'any'
  correctionEnabled: true,
  expansionEnabled: true,
  excludedSites: [],
  includedSites: [], // Se vazio, funciona em todos
  autoCorrectDelay: 0, // ms de delay
  showNotifications: true,
  caseSensitive: false,
  preserveCase: true, // Mantém maiúscula/minúscula original
  maxExpansionLength: 1000,
  enabledInputTypes: ['text', 'textarea', 'email', 'search'],
  shortcuts: {
    toggle: 'Ctrl+Shift+E',
    openSettings: 'Ctrl+Shift+S'
  }
};

const initialStats = {
  expansionsToday: 0,
  correctionsToday: 0,
  totalExpansions: 0,
  totalCorrections: 0,
  lastResetDate: new Date().toDateString()
};

// Quando a extensão é instalada ou atualizada
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Inicializa as configurações, dados e estatísticas no chrome.storage
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    await chrome.storage.sync.set({ stats: initialStats });

    try {
      // Carrega expansões do arquivo JSON local
      const expansionsResponse = await fetch(chrome.runtime.getURL('data/expansions.json'));
      if (!expansionsResponse.ok) {
        throw new Error(`HTTP error! status: ${expansionsResponse.status}`);
      }
      const expansionsData = await expansionsResponse.json();
      await chrome.storage.sync.set({ expansions: expansionsData });

      // Carrega correções do arquivo JSON local
      const correctionsResponse = await fetch(chrome.runtime.getURL('data/corrections.json'));
      if (!correctionsResponse.ok) {
        throw new Error(`HTTP error! status: ${correctionsResponse.status}`);
      }
      const correctionsData = await correctionsResponse.json();
      await chrome.storage.sync.set({ corrections: correctionsData });

      console.log('Expansor de Texto: Dados iniciais carregados com sucesso.');

    } catch (error) {
      console.error('Expansor de Texto: Falha ao carregar dados iniciais.', error);
    }
  }
});

// Listener para abrir a página de opções a partir de um atalho ou de outra parte da extensão
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_options_page') {
    chrome.runtime.openOptionsPage();
  }
});
