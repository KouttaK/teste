class TextExpander {
  constructor() {
    this.settings = {};
    this.expansions = new Map();
    this.corrections = new Map();
    this.triggerKeys = [' ', 'Enter', 'Tab'];
    this.boundHandleKeyUp = null;

    this.init();
  }

  async init() {
    if (this.boundHandleKeyUp) {
      this.detachEventListeners();
    }

    try {
      await this.loadSettings();

      if (!this.settings.enabled) {
        console.log('Expansor de Texto: Extensão desativada.');
        return;
      }

      if (this.shouldRunOnCurrentSite()) {
        await this.loadExpansions();
        await this.loadCorrections();
        this.updateTriggerKeys();
        this.attachEventListeners();
        console.log('Expansor de Texto: Ativo neste site.');
      } else {
        console.log('Expansor de Texto: Desativado para este site.');
      }
    } catch (error) {
      console.error('Expansor de Texto: Erro na inicialização.', error);
    }
  }

  async loadSettings() {
    const data = await chrome.storage.sync.get('settings');
    this.settings = data.settings || {};
  }

  async loadExpansions() {
    const data = await chrome.storage.sync.get('expansions');
    if (data.expansions) {
      this.expansions = new Map(Object.entries(data.expansions));
    }
  }

  async loadCorrections() {
    const data = await chrome.storage.sync.get('corrections');
    if (data.corrections) {
      this.corrections = new Map(Object.entries(data.corrections));
    }
  }

  updateTriggerKeys() {
    const mode = this.settings.expansionMode;
    if (mode === 'any') {
      this.triggerKeys = [' ', 'Enter', 'Tab'];
    } else {
      this.triggerKeys = [mode.charAt(0).toUpperCase() + mode.slice(1)];
    }
  }

  shouldRunOnCurrentSite() {
    const hostname = window.location.hostname;
    const { includedSites, excludedSites } = this.settings;

    if (includedSites && includedSites.length > 0) {
      return includedSites.some(site => hostname.includes(site.toLowerCase()));
    }

    if (excludedSites && excludedSites.length > 0) {
      return !excludedSites.some(site => hostname.includes(site.toLowerCase()));
    }

    return true;
  }

  attachEventListeners() {
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    document.addEventListener('keyup', this.boundHandleKeyUp, true);
  }

  detachEventListeners() {
    document.removeEventListener('keyup', this.boundHandleKeyUp, true);
    this.boundHandleKeyUp = null;
  }

  handleKeyUp(event) {
    if (!this.isValidInput(event.target)) return;

    if (this.triggerKeys.includes(event.key)) {
      this.processText(event.target);
    }
  }

  isValidInput(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase() || '';

    if (element.isContentEditable) return true;
    if (tagName === 'textarea') return true;
    if (tagName === 'input' && this.settings.enabledInputTypes?.includes(inputType)) return true;

    return false;
  }

  processText(element) {
    const text = element.isContentEditable ? element.textContent : element.value;
    const cursorPos = element.isContentEditable ? window.getSelection().getRangeAt(0).startOffset : element.selectionStart;

    const wordMatch = this.getWordBeforeCursor(text, cursorPos);
    if (!wordMatch) return;

    const { word, startPos } = wordMatch;
    const lookupWord = this.settings.caseSensitive ? word : word.toLowerCase();

    if (this.settings.correctionEnabled) {
      const corrected = this.corrections.get(lookupWord);
      if (corrected) {
        const replacement = this.applyCase(word, corrected);
        this.replaceText(element, startPos, cursorPos, replacement);
        this.recordStat('correction');
        return;
      }
    }

    if (this.settings.expansionEnabled) {
      const expanded = this.expansions.get(lookupWord);
      if (expanded) {
        const replacement = this.applyCase(word, expanded);
        this.replaceText(element, startPos, cursorPos, replacement);
        this.recordStat('expansion');
        return;
      }
    }
  }

  getWordBeforeCursor(text, cursorPos) {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const startPos = lastSpaceIndex + 1;
    const word = textBeforeCursor.substring(startPos);

    if (word) {
      return { word, startPos };
    }
    return null;
  }

  applyCase(originalWord, replacement) {
    if (!this.settings.preserveCase) return replacement;

    const isUpperCase = originalWord === originalWord.toUpperCase();
    const isCapitalized = originalWord.charAt(0) === originalWord.charAt(0).toUpperCase();

    if (isUpperCase && originalWord.length > 1) {
      return replacement.toUpperCase();
    }
    if (isCapitalized) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  replaceText(element, startPos, endPos, replacement) {
    if (element.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(element.firstChild, startPos);
      range.setEnd(element.firstChild, endPos);
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      selection.collapseToEnd();
    } else {
      const originalValue = element.value;
      const newValue = originalValue.substring(0, startPos) + replacement + originalValue.substring(endPos);
      element.value = newValue;

      const newCursorPos = startPos + replacement.length;
      element.focus();
      element.setSelectionRange(newCursorPos, newCursorPos);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async recordStat(type) {
    const { stats } = await chrome.storage.sync.get('stats');
    const today = new Date().toDateString();

    if (stats.lastResetDate !== today) {
      stats.expansionsToday = 0;
      stats.correctionsToday = 0;
      stats.lastResetDate = today;
    }

    if (type === 'expansion') {
      stats.expansionsToday++;
      stats.totalExpansions++;
    } else if (type === 'correction') {
      stats.correctionsToday++;
      stats.totalCorrections++;
    }

    await chrome.storage.sync.set({ stats });
  }
}

const textExpander = new TextExpander();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settingsUpdated') {
    textExpander.init();
    sendResponse({ status: 'ok' });
  }
  return true; // Keep the message channel open for async response
});
