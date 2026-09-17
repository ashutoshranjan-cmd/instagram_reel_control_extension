import { cacheService } from './cache.service.js';
import { historyService } from './history.service.js';
import { settingsService } from './settings.service.js';
import { InstagramMusicExtractor } from '../platform/instagram/InstagramMusicExtractor.js';
import { MessageTypes } from '../utils/messageTypes.js';
import { isVerifiedSong } from '../utils/songValidation.js';
export { isVerifiedSong } from '../utils/songValidation.js';

export const RecognitionStates = Object.fromEntries([
  'IDLE',
  'READY_TO_IDENTIFY',
  'DETECTING',
  'CHECKING_METADATA',
  'CAPTURING',
  'RECOGNIZING',
  'FOUND',
  'NOT_FOUND',
  'ERROR',
  'CANCELLED'
].map(x => [x, x]));

const errors = {
  CAPTURE_FAILED: 'Open ReelSong from the browser toolbar and click Identify Song to allow tab listening.',
  CAPTURE_ERROR: 'Could not capture this tab. Play and unmute the reel, then identify it.',
  NETWORK_ERROR: 'Recognition service is unavailable. Check the local server in Settings.',
  PROVIDER_NOT_CONFIGURED: 'Add an AudD or ACRCloud key to backend/.env to identify songs.',
  PROVIDER_ERROR: 'The recognition provider could not complete this request. Try again later.',
  BUSY: 'Another tab is being analyzed. Wait for it to finish.',
  TIMEOUT: 'Recognition timed out. Try another part of the reel.',
  RATE_LIMITED: 'The recognition limit was reached. Please wait before trying again.'
};

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch {}
  }
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
}

export class RecognitionManager {
  constructor(onStateChange) {
    this.onStateChange = onStateChange;
    this.state = 'IDLE';
    this.currentResult = null;
    this.currentReel = null;
    this.currentRequestId = null;
    this.extractor = new InstagramMusicExtractor();
    this.credit = null;
  }

  setState(state, data = {}) {
    this.state = state;
    if ('result' in data) this.currentResult = data.result;
    this.onStateChange?.(state, {
      reel: this.currentReel,
      result: this.currentResult,
      credit: this.credit,
      requestId: this.currentRequestId,
      ...data
    });
  }

  cancel() {
    const requestId = this.currentRequestId;
    if (requestId && ['CAPTURING', 'RECOGNIZING'].includes(this.state)) {
      chrome.runtime?.sendMessage?.({ type: MessageTypes.CANCEL_AUDIO_CAPTURE, requestId })?.catch?.(() => {});
    }
    this.currentRequestId = null;
    this.currentResult = null;
    this.setState('CANCELLED');
  }

  reset() {
    this.cancel();
    this.currentReel = null;
    this.credit = null;
    this.setState('IDLE');
  }

  async identifyReel(reel, isManual = false) {
    if (!reel?.isReel) return this.reset();
    if (this.currentReel?.reelId === reel.reelId && ['CAPTURING', 'RECOGNIZING', 'DETECTING'].includes(this.state)) return;
    if (!isManual && this.currentReel?.reelId === reel.reelId) return;

    this.cancel();
    const requestId = generateUUID();
    this.currentRequestId = requestId;
    this.currentReel = reel;
    this.credit = this.extractor.extract(reel);
    this.setState('DETECTING', { result: null });
    const active = () => this.currentRequestId === requestId;

    try {
      // 1. Check cache first
      const cached = await cacheService.get(reel.reelId);
      if (!active()) return;
      if (cached && (isVerifiedSong(cached) || (cached.title && cached.artist))) {
        return this.setState('FOUND', { result: cached, cached: true });
      }

      // 2. Level 1: Instagram visible music metadata
      if (this.credit && !this.credit.isOriginalAudio && this.credit.title && this.credit.artist) {
        const songResult = {
          ...this.credit,
          reelId: reel.reelId,
          reelUrl: reel.reelUrl,
          source: 'instagram_credit',
          verified: true
        };
        await cacheService.set(reel.reelId, songResult);
        if (!active()) return;
        await historyService.addSong(songResult);
        if (!active()) return;
        return this.setState('FOUND', { result: songResult });
      }

      // 3. Level 2 / Level 3 Quota Protection
      if (!isManual) {
        return this.setState('READY_TO_IDENTIFY', { credit: this.credit });
      }

      // 4. Level 3 Audio Fingerprinting: Triggered on manual user click
      const settings = await settingsService.getSettings();
      if (!active()) return;

      const video = reel.videoElement;
      if (video) {
        if (video.paused) {
          try { await video.play?.(); } catch {}
        }
        if (video.muted || video.volume === 0) {
          video.muted = false;
          if (video.volume === 0) video.volume = 0.5;
        }
      }

      this.setState('CAPTURING');
      const response = await chrome.runtime.sendMessage({
        type: MessageTypes.START_AUDIO_CAPTURE,
        requestId,
        userInitiated: true,
        duration: settings?.sampleDuration || 10,
        backendUrl: settings?.backendUrl || 'http://localhost:5050'
      });

      if (!active()) return;

      if (response?.success && response.result && (isVerifiedSong(response.result) || (response.result.title && response.result.artist))) {
        const song = {
          ...response.result,
          reelId: reel.reelId,
          reelUrl: reel.reelUrl,
          source: response.result.source || 'audio_fingerprint',
          verified: true
        };
        await cacheService.set(reel.reelId, song);
        if (!active()) return;
        await historyService.addSong(song);
        if (!active()) return;
        this.setState('FOUND', { result: song });
      } else if (['SONG_NOT_FOUND', 'LOW_CONFIDENCE'].includes(response?.code) || response?.success) {
        this.setState('NOT_FOUND');
      } else {
        this.setState('ERROR', { error: errors[response?.code] || 'Analysis was interrupted. Keep this reel playing and try again.' });
      }
    } catch (err) {
      if (active()) this.setState('ERROR', { error: 'Could not complete analysis. Reload Instagram and try again.' });
    }
  }
}
