import { isVerifiedSong } from '../utils/songValidation.js';
/**
 * History Service for ReelSong
 * Stores up to 100 identified songs in chrome.storage.local
 */

const HISTORY_KEY = 'reelsong_history_v2';
const MAX_HISTORY = 100;

export const historyService = {
  async getHistory() {
    try {
      const data = await chrome.storage.local.get(HISTORY_KEY);
      return (Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : []).filter(isVerifiedSong);
    } catch (err) {
      console.warn('[ReelSong History] Error reading history:', err);
      return [];
    }
  },

  async addSong(song) {
    if (!isVerifiedSong(song)) return;

    try {
      const history = await this.getHistory();

      // Normalize song object
      const songItem = {
        id: song.id || `${song.title}_${song.artist || ''}_${Date.now()}`.replace(/\s+/g, '_').toLowerCase(),
        title: song.title,
        artist: song.artist || 'Unknown Artist',
        album: song.album || null,
        artwork: song.artwork || null,
        source: song.source,
        verified: song.verified,
        provider: song.provider,
        reelUrl: song.reelUrl || null,
        links: song.links || {},
        identifiedAt: song.recognizedAt || Date.now()
      };

      // Filter out duplicate if same song identified recently
      const filtered = history.filter(item => {
        const sameTitle = item.title.toLowerCase() === songItem.title.toLowerCase();
        const sameArtist = (item.artist || '').toLowerCase() === (songItem.artist || '').toLowerCase();
        return !(sameTitle && sameArtist);
      });

      // Prepend newest song and limit to MAX_HISTORY
      const updated = [songItem, ...filtered].slice(0, MAX_HISTORY);

      await chrome.storage.local.set({ [HISTORY_KEY]: updated });
      return songItem;
    } catch (err) {
      console.warn('[ReelSong History] Error adding song to history:', err);
    }
  },

  async removeSong(songId) {
    try {
      const history = await this.getHistory();
      const updated = history.filter(item => item.id !== songId);
      await chrome.storage.local.set({ [HISTORY_KEY]: updated });
      return updated;
    } catch (err) {
      console.warn('[ReelSong History] Error removing song from history:', err);
      return [];
    }
  },

  async clearHistory() {
    try {
      await chrome.storage.local.remove(HISTORY_KEY);
    } catch (err) {
      console.warn('[ReelSong History] Error clearing history:', err);
    }
  }
};

