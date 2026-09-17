import { cleanText } from '../../utils/domUtils.js';
import { buildYouTubeSearchUrl } from '../../utils/youtubeHelper.js';

export class InstagramMusicExtractor {
  findReelContainer(video) {
    let node = video?.parentElement, best = node;
    for (let depth = 0; node && depth < 14; depth++, node = node.parentElement) {
      if (node === document.body || node === document.documentElement || node.querySelectorAll('video').length !== 1) break;
      best = node;
      if (node.tagName === 'ARTICLE' || node.getAttribute('role') === 'dialog') break;
    }
    return best;
  }

  extract(reel) {
    const root = this.findReelContainer(reel?.videoElement);
    if (!root) return null;
    for (const link of root.querySelectorAll('a[href*="/reels/audio/"], a[href*="/music/"], a[href*="/audio/"]')) {
      const credit = this.parseAudioString(link.textContent);
      if (credit) return credit;
    }
    return null;
  }

  parseAudioString(raw) {
    const text = cleanText(raw || '');
    if (!text || text.length > 180) return null;
    // Strict blacklist of UI control labels and status indicators
    if (/audio is (playing|muted)|toggle audio|turn on sound|\b(mute|unmute|follow)\b|^audio$|^music$/i.test(text)) return null;

    // Check for "Original Audio"
    if (/original\s+(audio|sound)/i.test(text)) {
      const userMatch = text.match(/original\s+(?:audio|sound)\s*[-–—•·]?\s*([a-zA-Z0-9._]+)?/i);
      const username = userMatch?.[1]?.trim() || null;
      return {
        isOriginalAudio: true,
        username,
        rawText: text,
        title: 'Original Audio',
        verified: false
      };
    }

    // "Title by Artist" format
    const by = text.match(/^(.+?)\s+by\s+(.+)$/i);
    // "Artist • Title" or "Title • Artist" format
    const parts = text.split(/\s+[•·—–|]\s+/);
    const title = by ? by[1].trim() : parts.length === 2 ? parts[1].trim() : null;
    const artist = by ? by[2].trim() : parts.length === 2 ? parts[0].trim() : null;

    if (!title || !artist || title.length < 2 || artist.length < 2) return null;

    // Prevent UI text slipping through split (e.g., username • Follow)
    if (/\bfollow\b/i.test(artist) || /\bfollow\b/i.test(title)) return null;

    return {
      title,
      artist,
      isOriginalAudio: false,
      links: {
        youtube: buildYouTubeSearchUrl(artist, title)
      },
      rawText: text,
      source: 'instagram_credit',
      verified: true
    };
  }
}
