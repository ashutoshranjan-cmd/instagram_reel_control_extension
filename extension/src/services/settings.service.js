/**
 * Settings service for ReelSong
 */

const SETTINGS_KEY = 'reelsong_settings';

const DEFAULT_SETTINGS = {
  autoIdentify: false,
  theme: 'system', // 'system' | 'dark' | 'light'
  sampleDuration: 10, // 8 | 10 | 12 seconds
  backendUrl: 'http://localhost:5050',
  youtubeClientId: '',
  youtubePlaylistId: ''
};

let writeQueue = Promise.resolve();

export const settingsService = {
  async getSettings() {
    try {
      const data = await chrome.storage.local.get(SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}), autoIdentify: false };
    } catch (err) {
      console.warn('[ReelSong Settings] Error reading settings:', err);
      return DEFAULT_SETTINGS;
    }
  },

  updateSettings(newSettings) {
    const pending = writeQueue.catch(() => {}).then(async () => {
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
      return updated;
    });
    writeQueue = pending;
    return pending;
  }
};
