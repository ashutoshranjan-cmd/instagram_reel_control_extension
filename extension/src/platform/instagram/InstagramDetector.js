import { throttle } from '../../utils/domUtils.js';
import { InstagramMusicExtractor } from './InstagramMusicExtractor.js';

export class InstagramDetector {
  constructor(onReelChange) {
    this.onReelChange = onReelChange;
    this.currentReelKey = null;
    this.currentCanListen = false;
    this.initialEmitted = false;
    this.check = throttle(() => this.checkCurrentState(), 200);
    this.identities = new WeakMap();
    this.idCounter = 0;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(this.check, 600);
    document.addEventListener('scroll', this.check, true);
    document.addEventListener('play', this.check, true);
    document.addEventListener('loadedmetadata', this.check, true);
    document.addEventListener('volumechange', this.check, true);
    document.addEventListener('pause', this.check, true);
    window.addEventListener('resize', this.check);
    this.checkCurrentState();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('scroll', this.check, true);
    document.removeEventListener('play', this.check, true);
    document.removeEventListener('loadedmetadata', this.check, true);
    document.removeEventListener('volumechange', this.check, true);
    document.removeEventListener('pause', this.check, true);
    window.removeEventListener('resize', this.check);
  }

  extractReelIdFromUrl(url) {
    return url?.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)(?:\/|\?|$)/)?.[1] || null;
  }

  detectActiveVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (videos.length === 0) return null;

    // Fast path 1: Exactly 1 video is playing on the page
    const playing = videos.filter(v => !v.paused && !v.ended && v.readyState >= 2);
    if (playing.length === 1) {
      return { videoElement: playing[0], isPlaying: true };
    }

    // Fast path 2: A video has fullscreen attribute and is playing
    const fsVideo = videos.find(v => v.hasAttribute('data-rs-fullscreen-video') && !v.paused && !v.ended);
    if (fsVideo) {
      return { videoElement: fsVideo, isPlaying: true };
    }

    let best = null;
    let bestScore = -Infinity;
    for (const video of document.querySelectorAll('video')) {
    for (const video of videos) {
      const isPlaying = !video.paused && !video.ended;
      const rect = video.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;
      const visibleW = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left));
      const visibleH = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
      const fraction = (visibleW * visibleH) / (rect.width * rect.height);
      if (fraction < 0.25) continue;
      const isPlaying = !video.paused && !video.ended;
      const score = fraction * 1000 - Math.abs(rect.top + rect.height / 2 - innerHeight / 2) + (isPlaying ? 150 : 0);
      const score = fraction * 1000 - Math.abs(rect.top + rect.height / 2 - innerHeight / 2) + (isPlaying ? 5000 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { videoElement: video, isPlaying, rect };
      }
    }
    return best;
  }

  detectActiveReel() {
    const active = this.detectActiveVideo();
    if (!active || !active.videoElement) return { isReel: false };
    const video = active.videoElement;
    const container = new InstagramMusicExtractor().findReelContainer(video);
    const isRoute = /^\/(?:reels?|p)(?:\/|$)/.test(location.pathname);
    const nearby = container?.querySelector?.('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]') ||
      document.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]');
    if (!isRoute && !nearby) return { isReel: false };
    const shortcode = this.extractReelIdFromUrl(nearby?.href) || this.extractReelIdFromUrl(location.href);

    let identity = this.identities.get(video);
    if (!identity) {
      this.idCounter += 1;
      identity = `v_${this.idCounter}`;
      this.identities.set(video, identity);
    }
    const reelId = shortcode ? `reel_${shortcode}` : `vid_${identity}`;
    const source = video.currentSrc || video.src || '';

    return {
      isReel: true,
      reelId,
      shortcode,
      reelUrl: shortcode ? `https://www.instagram.com/reel/${shortcode}/` : location.href,
      videoElement: video,
      isPlaying: active.isPlaying,
      source
    };
  }

  checkCurrentState() {
    const reel = this.detectActiveReel();
    const key = reel.isReel ? reel.reelId : null;
    const canListen = Boolean(reel.isPlaying && !reel.videoElement?.muted && reel.videoElement?.volume > 0);
    const changed = key !== this.currentReelKey;
    const becameAudible = !this.currentCanListen && canListen;
    this.currentReelKey = key;
    this.currentCanListen = canListen;
    if (changed || becameAudible || (reel.isReel && !this.initialEmitted)) {
      this.initialEmitted = true;
      this.onReelChange?.(reel.isReel ? reel : null);
    }
  }
}
