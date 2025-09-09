document.addEventListener('DOMContentLoaded', async () => {
  // Elementos da UI
  const enableToggle = document.getElementById('enableToggle');
  const expansionCountEl = document.getElementById('expansionCount');
  const correctionCountEl = document.getElementById('correctionCount');
  const addExpansionBtn = document.getElementById('addExpansion');
  const openSettingsBtn = document.getElementById('openSettings');
  const currentDomainEl = document.getElementById('currentDomain');
  const toggleSiteBtn = document.getElementById('toggleSite');

  // Carrega dados e inicializa a UI
  const { settings, stats } = await chrome.storage.sync.get(['settings', 'stats']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Atualiza o toggle principal
  if (settings && typeof settings.enabled !== 'undefined') {
    enableToggle.checked = settings.enabled;
  }

  // Atualiza as estatísticas
  if (stats) {
    expansionCountEl.textContent = stats.expansionsToday || 0;
    correctionCountEl.textContent = stats.correctionsToday || 0;
  }

  // Listener para o toggle principal
  enableToggle.addEventListener('change', async () => {
    settings.enabled = enableToggle.checked;
    await chrome.storage.sync.set({ settings });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
    }
  });

  // Listeners para os botões de ação
  addExpansionBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Lógica para o site atual
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      currentDomainEl.textContent = hostname;

      const isExcluded = settings.excludedSites.includes(hostname);

      const updateButtonState = (excluded) => {
        if (excluded) {
          toggleSiteBtn.textContent = 'Ativar neste Site';
          toggleSiteBtn.classList.add('btn-toggle-disabled');
        } else {
          toggleSiteBtn.textContent = 'Desativar neste Site';
          toggleSiteBtn.classList.remove('btn-toggle-disabled');
        }
      };

      updateButtonState(isExcluded);

      toggleSiteBtn.addEventListener('click', async () => {
        let excludedSites = settings.excludedSites || [];
        const currentHostname = new URL(tab.url).hostname;
        const siteIndex = excludedSites.indexOf(currentHostname);

        if (siteIndex > -1) {
          excludedSites.splice(siteIndex, 1);
          updateButtonState(false);
        } else {
          excludedSites.push(currentHostname);
          updateButtonState(true);
        }

        settings.excludedSites = excludedSites;
        await chrome.storage.sync.set({ settings });

        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
        }
      });
    } catch (e) {
        // This can happen on pages like 'chrome://extensions' where content scripts can't run
        document.querySelector('.current-site').style.display = 'none';
    }
  } else {
    document.querySelector('.current-site').style.display = 'none';
  }
});
