import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAudDResponse, normalizeACRCloudResponse } from '../src/utils/normalizer.js';
const acr = (score, extras = {}) => ({ status: { code: 0 }, metadata: { music: [{ title: 'Song', artists: [{ name: 'Artist' }], score, ...extras }] } });
test('Reject zero, missing, malformed and low confidence scores', () => {
  for (const score of [0, undefined, '95', 60, 89, NaN, 101]) assert.equal(normalizeACRCloudResponse(acr(score)).success, false);
  assert.equal(normalizeACRCloudResponse(acr(95)).verified, true);
});
test('Ambiguous close matches do not pick an arbitrary song', () => {
  const data = acr(96); data.metadata.music.push({ title: 'Other song', score: 95 });
  assert.equal(normalizeACRCloudResponse(data).code, 'LOW_CONFIDENCE');
});
test('Missing artist, malformed metadata and provider errors do not become matches', () => {
  assert.equal(normalizeAudDResponse({ status: 'success', result: { title: 'Song' } }).success, false);
  assert.equal(normalizeAudDResponse({ status: 'error', error: {} }).code, 'PROVIDER_ERROR');
  assert.equal(normalizeACRCloudResponse({ status: { code: 3003 } }).code, 'PROVIDER_ERROR');
  assert.equal(normalizeACRCloudResponse({ status: { code: 1001 } }).code, 'SONG_NOT_FOUND');
});
test('No guessed YouTube video or fabricated confidence', () => {
  const response = normalizeAudDResponse({ status: 'success', result: { title: 'Song', artist: 'Artist', youtube: { link: 'https://evil.test/youtube' } } });
  assert.equal(response.links.youtube, null);
  assert.equal(response.confidence, null);
  const bad = normalizeACRCloudResponse(acr(95, { external_metadata: { youtube: { vid: 'fake' } } }));
  assert.equal(bad.links.youtube, null);
});
