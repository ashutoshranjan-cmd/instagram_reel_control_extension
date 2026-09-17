import { InstagramMusicExtractor } from '../platform/instagram/InstagramMusicExtractor.js';

export class ReelViewer {
  constructor(detector, onChange) {
    this.detector = detector;
    this.onChange = onChange;
    this.reel = null;
    this.currentVideo = null;
    this.userPaused = false;
    this.lastNavigation = 0;
    this.lastWheel = 0;
    this.wheelAmount = 0;
    this.navigationPending = false;
    this.edits = [];
    this.activeVideoElement = null;
    this.extractor = new InstagramMusicExtractor();

    this.state = {
      cinema: false,
      fullscreen: false,
      focus: false,
      details: true,
      fit: 'auto', // Default to 'auto' so aspect ratio is automatically managed without clipping
      volume: 1,
      muted: false,
      shortcuts: true
    };

    this.keyHandler = e => this.onKey(e);
    this.wheelHandler = e => this.onWheel(e);
    this.fullscreenHandler = () => {
      const isFs = Boolean(document.fullscreenElement);
      this.state.fullscreen = isFs;
      if (isFs) {
        this.state.cinema = true;
        this.apply();
      } else {
        if (!this.state.cinema) {
          this.clearStyles();
        }
      }
      this.emit();
      this.ensurePlayback();
    };
    this.volumeHandler = () => this.syncVolume();
    this.resizeHandler = () => {
      if (this.state.cinema || this.state.fullscreen) {
        this.apply();
      }
    };
  }

  start() {
    document.addEventListener('keydown', this.keyHandler, true);
    document.addEventListener('wheel', this.wheelHandler, { capture: true, passive: false });
    document.addEventListener('fullscreenchange', this.fullscreenHandler);
    document.addEventListener('volumechange', this.volumeHandler, true);
    document.addEventListener('play', this.volumeHandler, true);
    document.addEventListener('pause', this.volumeHandler, true);
    window.addEventListener('resize', this.resizeHandler);

    let mutationTimer = null;
    this.observer = new MutationObserver(() => {
      if (mutationTimer) return;
      mutationTimer = setTimeout(() => {
        mutationTimer = null;
        if (this.reel?.videoElement && !this.reel.videoElement.isConnected) {
          const active = this.detector?.detectActiveReel();
          if (active?.isReel) {
            this.updateReel(active);
          }
        }
      }, 150);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    this.exit();
    this.observer?.disconnect();
    clearTimeout(this.navTimer);
    document.removeEventListener('keydown', this.keyHandler, true);
    document.removeEventListener('wheel', this.wheelHandler, true);
    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.removeEventListener('volumechange', this.volumeHandler, true);
    document.removeEventListener('play', this.volumeHandler, true);
    document.removeEventListener('pause', this.volumeHandler, true);
    window.removeEventListener('resize', this.resizeHandler);
  }

  emit() {
    this.onChange?.({ ...this.state });
  }

  syncVolume() {
    const video = this.reel?.videoElement;
    if (video) {
      this.state.volume = video.volume;
      this.state.muted = video.muted;
      this.state.paused = video.paused;
      this.emit();
    }
  }

  ensurePlayback() {
    if (this.userPaused) return;
    const video = this.reel?.videoElement;
    if (!video || video.ended) return;
    const play = () => {
      if (!this.userPaused && video.paused && !video.ended) {
        video.play().catch(() => {});
      }
    };
    play();
    setTimeout(play, 100);
    setTimeout(play, 300);
  }

  updateReel(reel) {
    const newVideo = reel?.videoElement;
    if (!newVideo) {
      if (this.state.cinema) this.exit();
      this.reel = null;
      this.currentVideo = null;
      return;
    }

    const isNewReel = this.reel?.reelId !== reel?.reelId || this.currentVideo !== newVideo;

    // If it is the exact same reel and the video is already active and styled, skip re-applying to prevent flicker!
    if (!isNewReel && this.activeVideoElement === newVideo && this.activeVideoElement?.isConnected) {
      this.syncVolume();
      return;
    }

    // Immediately pause previous reel video to prevent overlapping audio
    if (this.currentVideo && newVideo && this.currentVideo !== newVideo) {
      try {
        this.currentVideo.pause();
      } catch {}
    }

    // Ensure all non-active videos in the DOM are paused
    document.querySelectorAll('video').forEach(v => {
      if (v !== newVideo && !v.paused) {
        try { v.pause(); } catch {}
      }
    });

    this.reel = reel;
    this.currentVideo = newVideo;

    if (isNewReel && this.volumeChosen !== undefined) {
      newVideo.volume = this.volumeChosen;
      newVideo.muted = this.volumeChosen === 0;
    }

    if (this.state.cinema || this.state.fullscreen) {
      // If stylesheet & cinema mode are already active, transfer fullscreen video WITHOUT tearing down the DOM!
      if (document.documentElement.hasAttribute('data-rs-cinema') && document.getElementById('reelsong-viewer-styles')) {
        this.applyVideo(newVideo);
      } else {
        this.apply();
      }
    }
    this.syncVolume();
  }

  edit(node, properties) {
    if (!node?.style) return;
    for (const [property, value] of Object.entries(properties)) {
      this.edits.push({
        node,
        property,
        before: node.style.getPropertyValue(property),
        priority: node.style.getPropertyPriority(property)
      });
      node.style.setProperty(property, String(value), 'important');
    }
  }

  clearStyles() {
    if (this.activeVideoElement) {
      this.activeVideoElement.removeAttribute('data-rs-fullscreen-video');
      this.activeVideoElement.onclick = null;
      this.activeVideoElement = null;
    }
    for (const { node, property, before, priority } of this.edits.reverse()) {
      if (before) node.style.setProperty(property, before, priority);
      else node.style.removeProperty(property);
    }
    this.edits = [];
    document.documentElement.removeAttribute('data-rs-cinema');
    document.documentElement.removeAttribute('data-rs-fit');

    const style = document.getElementById('reelsong-viewer-styles');
    if (style) style.remove();
  }

  hideSidebarAndOverlays(main) {
    const video = this.reel?.videoElement || document.querySelector('video');

    // Strategy 1: Find sidebar via its universal icons/links and climb to top-level column sibling of main
    const sidebarTriggers = [
      'nav',
      '[role="navigation"]',
      'a[href="/"]',
      'svg[aria-label="Home"]',
      'svg[aria-label="Instagram"]',
      'svg[aria-label="Reels"]',
      'svg[aria-label="Search"]',
      'svg[aria-label="Explore"]',
      'svg[aria-label="Threads"]'
    ];

    for (const sel of sidebarTriggers) {
      for (const el of document.querySelectorAll(sel)) {
        if (!el || (video && el.contains(video))) continue;
        let col = el;
        while (
          col.parentElement &&
          col.parentElement !== document.body &&
          col.parentElement !== document.documentElement &&
          !(video && col.parentElement.contains(video)) &&
          !(main && col.parentElement.contains(main))
        ) {
          col = col.parentElement;
        }
        if (col && col !== document.body && col !== document.documentElement && !(video && col.contains(video))) {
          this.edit(col, {
            display: 'none',
            width: '0px',
            'min-width': '0px',
            'max-width': '0px',
            visibility: 'hidden',
            overflow: 'hidden',
            margin: '0',
            padding: '0'
          });
        }
      }
    }

    // Strategy 2: Also hide any fixed/sticky left column container (left: 0, width <= 320px)
    for (const div of document.querySelectorAll('body > div, body > div > div, body > div > div > div, body > div > div > div > div')) {
      if (div.id === 'reelsong-extension-root' || (video && div.contains(video))) continue;
      const rect = div.getBoundingClientRect();
      if (rect.left <= 5 && rect.width > 0 && rect.width <= 320 && rect.height > window.innerHeight * 0.5) {
        this.edit(div, {
          display: 'none',
          width: '0px',
          'min-width': '0px',
          'max-width': '0px',
          visibility: 'hidden',
          overflow: 'hidden'
        });
      }
    }

    // Strategy 3: Hide floating Messages drawer at bottom-right
    for (const el of document.querySelectorAll('button, [role="button"], div')) {
      if (el.id === 'reelsong-extension-root' || (video && el.contains(video))) continue;
      const text = el.textContent?.trim() || '';
      const label = el.getAttribute('aria-label') || '';
      if (
        text.includes('Messages') ||
        label.includes('Messages') ||
        el.querySelector?.('svg[aria-label="Direct"], svg[aria-label="Messenger"]')
      ) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth - 320 && rect.bottom > window.innerHeight - 180 && rect.width < 380) {
          this.edit(el, {
            display: 'none',
            visibility: 'hidden',
            opacity: '0',
            'pointer-events': 'none'
          });
        }
      }
    }

    // Strategy 4: Hide Instagram next/prev chevrons visually (keep layout for programmatic navigate click)
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      if ((video && btn.contains(video)) || btn.closest('#reelsong-extension-root')) continue;
      const label = (btn.getAttribute('aria-label') || btn.querySelector('svg[aria-label]')?.getAttribute('aria-label') || '').toLowerCase();
      if (/next|previous|down chevron|up chevron|arrow down|arrow up/.test(label)) {
        this.edit(btn, {
          opacity: '0',
          'pointer-events': 'none'
        });
      }
    }
  }

  updateAspect(video) {
    if (!video) return;
    if (this.state.fit === 'auto') {
      // 16:9 1920x1080 display:
      // Portrait / square reels (< 1.1 aspect): use 'contain' (100vh height, 0% cropped, all text visible)
      // Landscape reels (>= 1.1 aspect): use 'cover' (fills 1920x1080 screen edge-to-edge)
      const isPortrait = video.videoWidth && video.videoHeight ? (video.videoWidth / video.videoHeight < 1.1) : true;
      document.documentElement.setAttribute('data-rs-fit', isPortrait ? 'contain' : 'cover');
    } else {
      document.documentElement.setAttribute('data-rs-fit', this.state.fit || 'auto');
    }
  }

  applyVideo(video) {
    if (!video?.isConnected) return;

    // If previous video was different, clean its attributes and click handler
    if (this.activeVideoElement && this.activeVideoElement !== video) {
      this.activeVideoElement.removeAttribute('data-rs-fullscreen-video');
      this.activeVideoElement.onclick = null;
    }

    // Clear containing blocks and stacking contexts on video's parents
    for (let p = video.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      this.edit(p, {
        transform: 'none',
        filter: 'none',
        perspective: 'none',
        contain: 'none',
        'will-change': 'auto',
        'clip-path': 'none',
        mask: 'none',
        '-webkit-mask': 'none',
        'backdrop-filter': 'none',
        'z-index': 'auto',
        isolation: 'auto',
        opacity: '1'
      });
    }

    // Mark video as fullscreen video and attach click listener
    video.setAttribute('data-rs-fullscreen-video', 'true');
    this.activeVideoElement = video;

    // Dynamically manage aspect ratio for this video
    this.updateAspect(video);
    if (!video.videoWidth || !video.videoHeight) {
      video.addEventListener('loadedmetadata', () => this.updateAspect(video), { once: true });
    }

    video.onclick = (e) => {
      if (this.state.cinema || this.state.fullscreen) {
        e.preventDefault();
        e.stopPropagation();
        this.action('play');
      }
    };

    this.emit();
    this.ensurePlayback();
  }

  apply() {
    const video = this.reel?.videoElement || document.querySelector('video');
    if (!video?.isConnected) return;
    if (!this.state.cinema && !this.state.fullscreen) return;

    const main = document.querySelector('main, [role="main"]') || video.closest('main') || document.body;

    // 1. Inject or update viewer styles
    let style = document.getElementById('reelsong-viewer-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'reelsong-viewer-styles';
      style.textContent = `
        html[data-rs-cinema], html[data-rs-cinema] body {
          background: #000000 !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }

        /* Hide all Instagram navigation, headers, and banners */
        html[data-rs-cinema] nav,
        html[data-rs-cinema] [role="navigation"],
        html[data-rs-cinema] header,
        html[data-rs-cinema] [role="banner"],
        html[data-rs-cinema] div:has(> nav),
        html[data-rs-cinema] div:has(> [role="navigation"]) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
        }

        /* Hide Instagram Action Buttons (Like, Comment, Share, Save, More, Audio) */
        html[data-rs-cinema] svg[aria-label="Like"],
        html[data-rs-cinema] svg[aria-label="Unlike"],
        html[data-rs-cinema] svg[aria-label="Comment"],
        html[data-rs-cinema] svg[aria-label="Share Post"],
        html[data-rs-cinema] svg[aria-label="Share"],
        html[data-rs-cinema] svg[aria-label="Save"],
        html[data-rs-cinema] svg[aria-label="Remove"],
        html[data-rs-cinema] svg[aria-label="More options"],
        html[data-rs-cinema] svg[aria-label="Options"],
        html[data-rs-cinema] svg[aria-label="Audio"],
        html[data-rs-cinema] svg[aria-label="Original audio"],
        html[data-rs-cinema] svg[aria-label="Remix"] {
          display: none !important;
        }

        html[data-rs-cinema] button:has(svg[aria-label="Like"]),
        html[data-rs-cinema] button:has(svg[aria-label="Unlike"]),
        html[data-rs-cinema] button:has(svg[aria-label="Comment"]),
        html[data-rs-cinema] button:has(svg[aria-label="Share Post"]),
        html[data-rs-cinema] button:has(svg[aria-label="Share"]),
        html[data-rs-cinema] button:has(svg[aria-label="Direct"]),
        html[data-rs-cinema] button:has(svg[aria-label="Save"]),
        html[data-rs-cinema] button:has(svg[aria-label="Remove"]),
        html[data-rs-cinema] button:has(svg[aria-label="More options"]),
        html[data-rs-cinema] button:has(svg[aria-label="Options"]),
        html[data-rs-cinema] button:has(svg[aria-label="Audio"]),
        html[data-rs-cinema] button:has(svg[aria-label="Original audio"]),
        html[data-rs-cinema] button:has(svg[aria-label="Remix"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Like"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Unlike"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Comment"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Share Post"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Share"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Direct"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Save"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Remove"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="More options"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Options"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Audio"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Original audio"]),
        html[data-rs-cinema] article a,
        html[data-rs-cinema] article button:not([data-rs-dock-btn]),
        html[data-rs-cinema] article [role="button"]:not([data-rs-dock-btn]),
        html[data-rs-cinema] article h2 {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Hide chevrons visually while retaining layout for programmatic click */
        html[data-rs-cinema] button:has(svg[aria-label="Down chevron"]),
        html[data-rs-cinema] button:has(svg[aria-label="Up chevron"]),
        html[data-rs-cinema] button:has(svg[aria-label="Next"]),
        html[data-rs-cinema] button:has(svg[aria-label="Previous"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Down chevron"]),
        html[data-rs-cinema] [role="button"]:has(svg[aria-label="Up chevron"]) {
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Hide Messages drawer */
        html[data-rs-cinema] button:has(svg[aria-label="Direct"]),
        html[data-rs-cinema] button:has(svg[aria-label="Messenger"]),
        html[data-rs-cinema] div:has(> button:has(svg[aria-label="Direct"])),
        html[data-rs-cinema] div:has(> button:has(svg[aria-label="Messenger"])) {
          display: none !important;
          visibility: hidden !important;
        }

        /* Pure video filling full screen - on top of all Instagram UI elements */
        [data-rs-fullscreen-video="true"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          z-index: 2147483640 !important;
          background: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          cursor: pointer !important;
          object-position: center center !important;
          transition: none !important;
        }

        /* Fit: Contain (max bounds without cropping) */
        html[data-rs-fit="contain"] [data-rs-fullscreen-video="true"] {
          object-fit: contain !important;
          transform: scale(1) !important;
        }

        /* Fill: Cover (fills entire 100vw x 100vh screen with no black bars) */
        html[data-rs-fit="cover"] [data-rs-fullscreen-video="true"] {
          object-fit: cover !important;
          transform: scale(1.001) !important;
        }

        /* Zoom 1.35x: Zoomed in for maximum immersive view */
        html[data-rs-fit="zoom"] [data-rs-fullscreen-video="true"] {
          object-fit: cover !important;
          transform: scale(1.35) !important;
        }

        /* Zoom 1.6x: Ultra Zoom */
        html[data-rs-fit="ultra"] [data-rs-fullscreen-video="true"] {
          object-fit: cover !important;
          transform: scale(1.6) !important;
        }
`;
      document.head.appendChild(style);
    }

    document.documentElement.setAttribute('data-rs-cinema', '');
    this.updateAspect(video);

    // 2. Hide sidebar, action buttons, overlays, and messenger
    this.hideSidebarAndOverlays(main);

    // 3. Apply fullscreen styling directly to the active video
    this.applyVideo(video);
  }

  exit() {
    this.state.cinema = false;
    this.state.fullscreen = false;
    this.state.focus = false;
    this.navigationPending = false;
    clearTimeout(this.navTimer);
    this.clearStyles();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    this.emit();
    this.ensurePlayback();
  }

  async action(action, value) {
    if (!this.reel?.videoElement?.isConnected) {
      const reel = this.detector?.detectActiveReel();
      if (reel?.isReel && reel.videoElement) {
        this.updateReel(reel);
      }
    }
    const video = this.reel?.videoElement;
    if (!video) throw new Error('Open an Instagram reel first.');

    if (action === 'cinema') {
      if (this.state.cinema) {
        this.exit();
      } else {
        this.state.cinema = true;
        this.apply();
      }
    } else if (action === 'fullscreen') {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
        this.state.fullscreen = false;
        this.emit();
        this.ensurePlayback();
      } else {
        try {
          await document.documentElement.requestFullscreen();
          this.state.cinema = true;
          this.state.fullscreen = true;
          this.apply();
          this.ensurePlayback();
        } catch {
          this.state.cinema = true;
          this.apply();
          this.ensurePlayback();
          return { notice: 'Switched to Cinema view. Click ⛶ Fullscreen on the toolbar or press "f" for native fullscreen.' };
        }
      }
    } else if (action === 'focus') {
      this.state.focus = !this.state.focus;
      this.state.cinema = true;
      this.apply();
    } else if (action === 'fit') {
      const allowed = ['auto', 'contain', 'cover', 'zoom', 'ultra'];
      this.state.fit = allowed.includes(value) ? value : 'auto';
      if (!this.state.cinema) this.state.cinema = true;
      const targetVid = this.reel?.videoElement || document.querySelector('video');
      this.updateAspect(targetVid);
      this.emit();
    } else if (action === 'volume') {
      const volume = Math.max(0, Math.min(1, Number(value)));
      if (!Number.isFinite(volume)) return;
      this.volumeChosen = volume;
      video.volume = volume;
      video.muted = volume === 0;
      this.syncVolume();
    } else if (action === 'mute') {
      video.muted = !video.muted;
      if (!video.muted && !video.volume) video.volume = 0.5;
      this.syncVolume();
    } else if (action === 'play') {
      if (video.paused) {
        this.userPaused = false;
        await video.play().catch(() => {});
      } else {
        this.userPaused = true;
        video.pause();
      }
      this.syncVolume();
    } else if (action === 'next' || action === 'previous') {
      this.navigate(action === 'next' ? 1 : -1);
    } else if (action === 'exit') {
      this.exit();
    } else if (action === 'shortcuts') {
      this.state.shortcuts = !this.state.shortcuts;
      this.emit();
    }
  }

  navigate(direction) {
    const now = Date.now();
    if (now - this.lastNavigation < 280) return;
    this.lastNavigation = now;

    const currentVideo = this.reel?.videoElement;
    if (currentVideo) {
      try { currentVideo.pause(); } catch {}
    }

    const matches = [...document.querySelectorAll('button, [role="button"]')].filter(button => {
      const label = button.getAttribute('aria-label') || button.querySelector('svg[aria-label]')?.getAttribute('aria-label') || '';
      const target = direction > 0 ? /^(next|next reel|scroll down|down chevron|arrow down)$/i : /^(previous|previous reel|scroll up|up chevron|arrow up)$/i;
      return target.test(label) && button.getBoundingClientRect().width > 0 && !button.disabled;
    });

    if (matches.length > 0) {
      matches[0].click();
    } else {
      let scroller = currentVideo?.parentElement;
      while (
        scroller &&
        scroller !== document.body &&
        !(scroller.scrollHeight > scroller.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))
      ) {
        scroller = scroller.parentElement;
      }
      const scrollTarget = scroller || window;
      const amount = direction * (window.innerHeight || 800);
      scrollTarget.scrollBy({ top: amount, behavior: 'smooth' });
    }

    clearTimeout(this.navTimer);
    this.navTimer = setTimeout(() => {
      const reel = this.detector?.detectActiveReel();
      if (reel?.isReel) {
        this.updateReel(reel);
      }
    }, 120);
  }

  isEditing(event) {
    const path = event.composedPath?.() || [event.target];
    return path.some(el =>
      el?.matches?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')
    );
  }

  onKey(event) {
    if (event.key === 'Escape' && (this.state.cinema || this.state.fullscreen) && !this.isEditing(event)) {
      event.preventDefault();
      this.exit();
      return;
    }
    if (
      event.key.toLowerCase() === 'f' &&
      !this.isEditing(event) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      this.action('fullscreen').catch(() => {});
      return;
    }
    if ((event.code === 'Space' || event.key === ' ') && this.state.cinema && !this.isEditing(event)) {
      event.preventDefault();
      this.action('play').catch(() => {});
      return;
    }
    if (
      event.key.toLowerCase() === 'm' &&
      this.state.cinema &&
      !this.isEditing(event) &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      this.action('mute').catch(() => {});
      return;
    }
    if (!this.state.shortcuts || !this.reel?.videoElement?.isConnected || this.isEditing(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.navigate(event.key === 'ArrowDown' ? 1 : -1);
  }

  onWheel(event) {
    // Only intercept wheel in cinema/fullscreen mode so normal Instagram scrolling is completely native!
    if (!this.state.shortcuts || (!this.state.cinema && !this.state.fullscreen)) return;
    if (!this.reel?.videoElement?.isConnected || this.isEditing(event) || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const path = event.composedPath?.() || [];
    if (path.some(el => el?.id === 'reelsong-extension-root' || el?.closest?.('[role="dialog"]'))) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (now - this.lastWheel > 180) this.wheelAmount = 0;
    this.lastWheel = now;
    this.wheelAmount += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (Math.abs(this.wheelAmount) < 35) return;
    const direction = Math.sign(this.wheelAmount);
    this.wheelAmount = 0;
    this.navigate(direction);
  }
}
