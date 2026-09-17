import assert from 'assert';
import { normalizeAudDResponse, normalizeACRCloudResponse, buildYouTubeUrl } from '../src/utils/normalizer.js';
import { MusicRecognitionService } from '../src/services/musicRecognition.service.js';

console.log('--- Running ReelSong Backend Unit Tests ---');

// Test 1: YouTube URL builder
console.log('Test 1: YouTube URL Builder');
const ytUrl1 = buildYouTubeUrl('The Weeknd', 'Blinding Lights');
assert.strictEqual(ytUrl1, 'https://www.youtube.com/results?search_query=The%20Weeknd%20Blinding%20Lights');
const ytUrl2 = buildYouTubeUrl('', 'Alone');
assert.strictEqual(ytUrl2, 'https://www.youtube.com/results?search_query=Alone');
console.log('✓ YouTube URL builder passed');

// Test 2: AudD Normalizer - Success Case
console.log('Test 2: AudD Normalizer Success');
const auddMock = {
  status: 'success',
  result: {
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    timecode: '01:23',
    youtube: {
      link: 'https://www.youtube.com/watch?v=34Na4j8AVgA'
    }
  }
};
const auddNormalized = normalizeAudDResponse(auddMock);
assert.strictEqual(auddNormalized.success, true);
assert.strictEqual(auddNormalized.title, 'Starboy');
assert.strictEqual(auddNormalized.artist, 'The Weeknd');
assert.strictEqual(auddNormalized.links.youtube, 'https://www.youtube.com/watch?v=34Na4j8AVgA');
assert.strictEqual(auddNormalized.links.spotify, undefined, 'Spotify must not be included per user specification');
console.log('✓ AudD Normalizer success case passed');

// Test 3: AudD Normalizer - No result case
console.log('Test 3: AudD Normalizer Not Found');
const auddNotFound = normalizeAudDResponse({ status: 'success', result: null });
assert.strictEqual(auddNotFound.success, false);
assert.strictEqual(auddNotFound.code, 'SONG_NOT_FOUND');
console.log('✓ AudD Normalizer not found case passed');

// Test 4: ACRCloud Normalizer - Success Case
console.log('Test 4: ACRCloud Normalizer Success');
const acrMock = {
  status: { code: 0, msg: 'Success' },
  metadata: {
    music: [{
      title: 'Midnight City',
      artists: [{ name: 'M83' }],
      score: 95,
      external_metadata: {
        youtube: { vid: 'dX3k_QDnzHE' }
      }
    }]
  }
};
const acrNormalized = normalizeACRCloudResponse(acrMock);
assert.strictEqual(acrNormalized.success, true);
assert.strictEqual(acrNormalized.title, 'Midnight City');
assert.strictEqual(acrNormalized.artist, 'M83');
assert.strictEqual(acrNormalized.links.youtube, 'https://www.youtube.com/watch?v=dX3k_QDnzHE');
console.log('✓ ACRCloud Normalizer success case passed');

// Test 5: Provider unconfigured check
console.log('Test 5: Service handles unconfigured keys gracefully');
const service = new MusicRecognitionService();
const active = service.getActiveProvider();
assert.strictEqual(typeof active.isConfigured, 'boolean');
console.log('✓ Provider service graceful check passed');

console.log('\nAll Backend Unit Tests Passed Successfully!');

