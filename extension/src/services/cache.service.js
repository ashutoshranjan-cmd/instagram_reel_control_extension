import { isVerifiedSong } from '../utils/songValidation.js';
/**
 * Cache service for ReelSong
 * Prevents redundant recognition API calls and metadata re-extraction.
 * Suggested TTL: 24 hours.
 */

const CACHE_PREFIX = 'reelsong_cache_v2_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const cacheService = {
  async get(reelKey) {
    if (!reelKey) return null;
    const storageKey = `${CACHE_PREFIX}${reelKey}`;
    try {
      const data = await chrome.storage.local.get(storageKey);
      const entry = data[storageKey];
      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.timestamp > TTL_MS) {
        await chrome.storage.local.remove(storageKey);
        return null;
      }
      return isVerifiedSong(entry.result) ? entry.result : null;
    } catch (err) {
      console.warn('[ReelSong Cache] Error reading cache:', err);
      return null;
    }
  },

  async set(reelKey, result) {
    if (!reelKey || !isVerifiedSong(result)) return;
    const storageKey = `${CACHE_PREFIX}${reelKey}`;
    try {
      await chrome.storage.local.set({
        [storageKey]: {
          reelKey,
          result,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      console.warn('[ReelSong Cache] Error saving cache:', err);
    }
  },

  async clear() {
    try {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter(k => k.startsWith('reelsong_cache_'));
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (err) {
      console.warn('[ReelSong Cache] Error clearing cache:', err);
    }
  }
};

