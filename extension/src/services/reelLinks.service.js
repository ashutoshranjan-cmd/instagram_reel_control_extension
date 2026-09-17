const KEY = 'reelsong_saved_reels';
export function cleanReelUrl(value) {
  try { const u = new URL(value); if (['www.instagram.com','instagram.com'].includes(u.hostname) && /^\/reels?\/[\w-]+\/?$/.test(u.pathname)) return `https://www.instagram.com/reel/${u.pathname.split('/')[2]}/`; } catch {}
  return null;
}
export const reelLinksService = {
  async list() { const data = await chrome.storage.local.get(KEY); return (Array.isArray(data[KEY]) ? data[KEY] : []).filter(r => cleanReelUrl(r.url)); },
  async save(url) { const clean = cleanReelUrl(url); if (!clean) throw new Error('A permalink is not available for this reel yet.'); const items = await this.list(); await chrome.storage.local.set({ [KEY]: [{ url: clean, savedAt: Date.now() }, ...items.filter(r => r.url !== clean)].slice(0,100) }); },
  async remove(url) { await chrome.storage.local.set({ [KEY]: (await this.list()).filter(r => r.url !== url) }); }
};
