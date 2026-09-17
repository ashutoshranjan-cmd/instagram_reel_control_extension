import test from 'node:test';
import assert from 'node:assert/strict';
import { InstagramMusicExtractor } from '../src/platform/instagram/InstagramMusicExtractor.js';
import { getSongYouTubeUrl, getYouTubeVideoId, buildYouTubeSearchUrl } from '../src/utils/youtubeHelper.js';
import { RecognitionManager, RecognitionStates } from '../src/services/recognitionManager.js';
import { settingsService } from '../src/services/settings.service.js';
import { cacheService } from '../src/services/cache.service.js';
import { historyService } from '../src/services/history.service.js';

test('Level 1: InstagramMusicExtractor parses various credit formats and ignores UI strings', () => {
  const extractor = new InstagramMusicExtractor();

  // "Title By Artist" format
  const r1 = extractor.parseAudioString('Champava Ki Kaliyan By MaatiBaani');
  assert.equal(r1.isOriginalAudio, false);
  assert.equal(r1.title, 'Champava Ki Kaliyan');
  assert.equal(r1.artist, 'MaatiBaani');
  assert.ok(r1.links.youtube.includes('YouTube') || r1.links.youtube.includes('youtube.com'));

  // "Artist • Title" format
  const r2 = extractor.parseAudioString('Arijit Singh • Kesariya');
  assert.equal(r2.isOriginalAudio, false);
  assert.equal(r2.artist, 'Arijit Singh');
  assert.equal(r2.title, 'Kesariya');

  // "Artist · Title" (middle dot) format
  const r3 = extractor.parseAudioString('Coldplay · Yellow');
  assert.equal(r3.isOriginalAudio, false);
  assert.equal(r3.artist, 'Coldplay');
  assert.equal(r3.title, 'Yellow');

  // "Original Audio" format
  const r4 = extractor.parseAudioString('Original Audio - john_doe');
  assert.equal(r4.isOriginalAudio, true);
  assert.equal(r4.username, 'john_doe');

  // CRITICAL REGRESSION TESTS: UI buttons and labels must NEVER be detected as songs!
  assert.equal(extractor.parseAudioString('Audio is muted'), null, 'Audio is muted must be ignored');
  assert.equal(extractor.parseAudioString('Audio is playing'), null, 'Audio is playing must be ignored');
  assert.equal(extractor.parseAudioString('Mute'), null, 'Mute must be ignored');
  assert.equal(extractor.parseAudioString('Unmute'), null, 'Unmute must be ignored');
  assert.equal(extractor.parseAudioString('Toggle audio'), null, 'Toggle audio must be ignored');
  assert.equal(extractor.parseAudioString('papacharlieyt01 • Follow'), null, 'Follow button must be ignored');
  assert.equal(extractor.parseAudioString('Audio'), null);
  assert.equal(extractor.parseAudioString('Music'), null);
  assert.equal(extractor.parseAudioString(''), null);
});

test('YouTube Helpers: Strictly YouTube links and search queries', () => {
  const searchUrl = buildYouTubeSearchUrl('Queen', 'Bohemian Rhapsody');
  assert.equal(searchUrl, 'https://www.youtube.com/results?search_query=Queen%20Bohemian%20Rhapsody');

  assert.equal(getYouTubeVideoId('https://www.youtube.com/watch?v=fJ9rUzIMcZQ'), 'fJ9rUzIMcZQ');
  assert.equal(getYouTubeVideoId('https://youtu.be/fJ9rUzIMcZQ'), 'fJ9rUzIMcZQ');
  assert.equal(getYouTubeVideoId('https://not-youtube.com/watch?v=fJ9rUzIMcZQ'), null);

  const songWithDirectLink = { links: { youtube: 'https://youtu.be/fJ9rUzIMcZQ' } };
  assert.equal(getSongYouTubeUrl(songWithDirectLink), 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ&autoplay=1');

  assert.equal(getSongYouTubeUrl({ links: {} }), null);
});

test('Level 1 & 2: Instant recognition from metadata with zero API calls', async () => {
  let apiCalls = 0;
  globalThis.chrome = {
    runtime: {
      sendMessage: async () => {
        apiCalls++;
        return { success: true };
      }
    }
  };

  settingsService.getSettings = async () => ({ autoIdentify: true, backendUrl: 'http://localhost:5050' });
  cacheService.get = async () => null;
  cacheService.set = async () => {};
  historyService.addSong = async () => {};

  const manager = new RecognitionManager();
  manager.extractor.extract = () => ({
    isOriginalAudio: false,
    title: 'Champava Ki Kaliyan',
    artist: 'MaatiBaani',
    links: { youtube: 'https://www.youtube.com/results?search_query=MaatiBaani%20Champava%20Ki%20Kaliyan' }
  });

  const reel = { reelId: 'reel_meta_1', isReel: true, reelUrl: 'https://instagram.com/reel/123/' };
  await manager.identifyReel(reel, false);

  assert.equal(manager.state, RecognitionStates.FOUND);
  assert.equal(manager.currentResult.title, 'Champava Ki Kaliyan');
  assert.equal(apiCalls, 0, 'Level 1/2 metadata identification must not call backend API');
});

test('Quota Protection: Original audio stays at READY_TO_IDENTIFY without auto-capturing', async () => {
  let apiCalls = 0;
  globalThis.chrome = {
    runtime: {
      sendMessage: async () => {
        apiCalls++;
        return { success: true };
      }
    }
  };

  settingsService.getSettings = async () => ({ autoIdentify: true, backendUrl: 'http://localhost:5050' });
  cacheService.get = async () => null;
  cacheService.set = async () => {};
  historyService.addSong = async () => {};

  const manager = new RecognitionManager();
  manager.extractor.extract = () => ({
    isOriginalAudio: true,
    rawText: 'Original Audio - traveler_vlogs',
    title: 'Original Audio'
  });

  const reel = { reelId: 'reel_orig_1', isReel: true, reelUrl: 'https://instagram.com/reel/456/' };
  
  await manager.identifyReel(reel, false);

  assert.equal(manager.state, RecognitionStates.READY_TO_IDENTIFY, 'Must show Identify Song button');
  assert.equal(apiCalls, 0, 'Must NOT trigger audio capture automatically');
});

test('Manual Trigger: Clicking Identify Song executes Level 3 Audio Fingerprinting', async () => {
  let captured = false;
  globalThis.chrome = {
    runtime: {
      sendMessage: async (msg) => {
        if (msg.type === 'START_AUDIO_CAPTURE') {
          captured = true;
          return {
            success: true,
            result: {
              title: 'Resolved Song',
              artist: 'Resolved Artist',
              links: { youtube: 'https://www.youtube.com/watch?v=abc12345678' }
            }
          };
        }
        return { success: true };
      }
    }
  };

  settingsService.getSettings = async () => ({ autoIdentify: true, backendUrl: 'http://localhost:5050' });
  cacheService.get = async () => null;
  cacheService.set = async () => {};
  historyService.addSong = async () => {};

  const manager = new RecognitionManager();
  manager.extractor.extract = () => ({
    isOriginalAudio: true,
    rawText: 'Original Audio',
    title: 'Original Audio'
  });

  const reel = {
    reelId: 'reel_orig_2',
    isReel: true,
    reelUrl: 'https://instagram.com/reel/789/',
    isPlaying: true,
    videoElement: { muted: false, volume: 1 }
  };

  await manager.identifyReel(reel, true);

  assert.equal(captured, true, 'Must send START_AUDIO_CAPTURE on manual user action');
  assert.equal(manager.state, RecognitionStates.FOUND);
  assert.equal(manager.currentResult.title, 'Resolved Song');
});

