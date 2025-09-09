class OptionsManager {
  constructor() {
    this.settings = {};
    this.expansions = new Map();
    this.corrections = new Map();
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.renderAll();
  }

  async loadData() {
    const data = await chrome.storage.sync.get(['settings', 'expansions', 'corrections']);
    this.settings = data.settings || {};
    this.expansions = new Map(Object.entries(data.expansions || {}));
    this.corrections = new Map(Object.entries(data.corrections || {}));
  }

  renderAll() {
    this.renderSettings();
    this.renderList('expansions', this.expansions, document.getElementById('expansions-list'));
    this.renderList('corrections', this.corrections, document.getElementById('corrections-list'));
  }

  renderSettings() {
    document.querySelectorAll('#settings-form [data-setting]').forEach(element => {
      const key = element.dataset.setting;
      if (typeof this.settings[key] !== 'undefined') {
        if (element.type === 'checkbox') {
          element.checked = this.settings[key];
        } else {
          element.value = this.settings[key];
        }
      }
    });
    const excludedSitesEl = document.getElementById('excluded-sites');
    if (excludedSitesEl && this.settings.excludedSites) {
        excludedSitesEl.value = this.settings.excludedSites.join('\n');
    }
  }

  renderList(type, map, container) {
    container.innerHTML = '';
    if (map.size === 0) {
      container.innerHTML = `<p>Nenhum item encontrado.</p>`;
      return;
    }
    for (const [key, value] of map.entries()) {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span class="item-key">${key}</span>
        <span class="item-value">${value}</span>
        <button class="delete-btn" data-type="${type}" data-key="${key}">Excluir</button>
      `;
      container.appendChild(item);
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelector('.tabs').addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-link')) {
        document.querySelectorAll('.tab-link').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(e.target.dataset.tab).classList.add('active');
      }
    });

    // Settings changes
    document.getElementById('settings-form').addEventListener('change', this.handleSettingChange.bind(this));
    document.getElementById('excluded-sites').addEventListener('change', this.handleSettingChange.bind(this));

    // Add buttons
    document.getElementById('add-expansion-btn').addEventListener('click', this.handleAdd.bind(this, 'expansions'));
    document.getElementById('add-correction-btn').addEventListener('click', this.handleAdd.bind(this, 'corrections'));

    // Delete buttons (event delegation)
    document.querySelector('.container').addEventListener('click', this.handleDelete.bind(this));

    // Import/Export
    document.getElementById('export-btn').addEventListener('click', this.exportData.bind(this));
    document.getElementById('import-file').addEventListener('change', this.importData.bind(this));
  }

  async handleSettingChange(e) {
    const key = e.target.dataset.setting;
    let value;
    if (e.target.type === 'checkbox') {
      value = e.target.checked;
    } else if (e.target.tagName === 'TEXTAREA') {
        value = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    else {
      value = e.target.value;
    }
    this.settings[key] = value;
    await chrome.storage.sync.set({ settings: this.settings });
  }

  async handleAdd(type) {
    let key, value, keyInput, valueInput;
    if (type === 'expansions') {
      keyInput = document.getElementById('new-expansion-abbr');
      valueInput = document.getElementById('new-expansion-text');
    } else {
      keyInput = document.getElementById('new-correction-wrong');
      valueInput = document.getElementById('new-correction-correct');
    }
    key = keyInput.value.trim();
    value = valueInput.value.trim();

    if (key && value) {
      this[type].set(key, value);
      await chrome.storage.sync.set({ [type]: Object.fromEntries(this[type]) });
      this.renderList(type, this[type], document.getElementById(`${type}-list`));
      keyInput.value = '';
      valueInput.value = '';
    }
  }

  async handleDelete(e) {
    if (e.target.classList.contains('delete-btn')) {
      const { type, key } = e.target.dataset;
      if (this[type].has(key)) {
        this[type].delete(key);
        await chrome.storage.sync.set({ [type]: Object.fromEntries(this[type]) });
        this.renderList(type, this[type], document.getElementById(`${type}-list`));
      }
    }
  }

  async exportData() {
    const dataToExport = {
      settings: this.settings,
      expansions: Object.fromEntries(this.expansions),
      corrections: Object.fromEntries(this.corrections),
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-expander-backup-${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm('Isso substituirá suas configurações e dados atuais. Deseja continuar?')) {
          if (data.settings) await chrome.storage.sync.set({ settings: data.settings });
          if (data.expansions) await chrome.storage.sync.set({ expansions: data.expansions });
          if (data.corrections) await chrome.storage.sync.set({ corrections: data.corrections });
          await this.loadData();
          this.renderAll();
          alert('Dados importados com sucesso!');
        }
      } catch (error) {
        alert('Erro ao importar arquivo. Verifique se o formato é JSON válido.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  }
}

new OptionsManager();
