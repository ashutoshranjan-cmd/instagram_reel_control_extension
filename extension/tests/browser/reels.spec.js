import { test, expect } from '@playwright/test';
import path from 'node:path';
const content = path.resolve('dist/content/content.js');
const knownSong = { title: 'Midnight City', artist: 'M83', verified: true, provider: 'acrcloud', source: 'audio_fingerprint', links: { youtube: 'https://www.youtube.com/watch?v=dX3k_QDnzHE' } };
async function load(page, { width = 1920, landscape = false, response = { success: false, code: 'SONG_NOT_FOUND' }, original = false, delay = 10 } = {}) {
  await page.setViewportSize({ width, height: 1080 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#0c1014;color:white;font-family:Arial"><nav style="position:fixed;width:72px;inset:0 auto 0 0;border-right:1px solid #262a30;text-align:center;padding-top:32px">◎<p style="margin-top:180px">⌂</p>▣</nav><article style="position:absolute;left:${landscape ? 345 : width < 600 ? 0 : 675}px;top:${landscape ? 248 : 75}px"><video src="https://scontent.cdninstagram.com/reel-a.mp4" style="display:block;width:${landscape ? 1143 : width < 600 ? width : 555}px;height:${landscape ? 644 : 940}px;background:linear-gradient(135deg,#283c49,#454550);border:1px solid #343a40;border-radius:5px"></video><a href="/reels/audio/123/">M83 • Midnight City</a><div aria-label="Audio is playing">Audio is playing</div><div>Song: Deliberately wrong caption</div></article></body></html>` }) : route.abort());
  await page.addInitScript(({ response, original, delay }) => {
    window.__messages = [];
    window.__storage = {};
    window.__listeners = [];
    window.__response = response;
    window.__delay = delay;
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: { onMessage: { addListener: callback => window.__listeners.push(callback) }, sendMessage: async message => {
        window.__messages.push(message);
        if (message.type === 'START_AUDIO_CAPTURE') { const result = window.__response; await new Promise(r => setTimeout(r, window.__delay)); return result; }
        if (message.type === 'SAVE_TO_YOUTUBE') return window.__saveResponse || { success: true };
        if (message.type === 'DOWNLOAD_REEL') return { success: true, downloadId: 3 };
        return { success: true };
      } },
      storage: { local: {
        get: async key => key ? { [key]: window.__storage[key] } : window.__storage,
        set: async data => Object.assign(window.__storage, data), remove: async key => delete window.__storage[key]
      } }
    } });
    window.addEventListener('DOMContentLoaded', () => {
      const video = document.querySelector('video');
      for (const [key, value] of Object.entries({ paused: false, muted: false, ended: false, videoWidth: 1080, videoHeight: 1920 })) Object.defineProperty(video, key, { value, configurable: true });
      Object.defineProperty(video, 'currentSrc', { get: () => video.src, configurable: true });
      if (original) video.src = 'blob:https://www.instagram.com/unavailable';
    });
  }, { response, original, delay });
  await page.goto('https://www.instagram.com/reels/FixtureA/');
  await page.addScriptTag({ path: content });
}
test('False audio labels show not found without a fabricated YouTube button', async ({ page }) => {
  await load(page);
  await expect(page.getByText('Song not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /YouTube/ })).toHaveCount(0);
  await expect(page.locator('#reelsong-extension-root').getByText('Audio is playing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '↓ MP3 audio' })).toBeEnabled();
});
test('Portrait and landscape cards never overlap reel or Instagram action rail', async ({ page }) => {
  for (const landscape of [false, true]) {
    await load(page, { landscape, response: { success: true, result: knownSong } });
    const card = page.getByRole('region', { name: 'ReelSong', exact: true });
    await expect(card).toBeVisible();
    const c = await card.boundingBox(), v = await page.locator('video').boundingBox();
    expect(c.x > v.x + v.width + 88 || c.x + c.width < v.x).toBeTruthy();
    expect(c.x + c.width).toBeLessThanOrEqual(1920 - 112);
    if (landscape) expect(c.x + c.width).toBeLessThan(v.x);
    await page.screenshot({ path: `tests/artifacts/${landscape ? 'landscape' : 'portrait'}-panel.png` });
  }
});
test('Narrow viewport uses popup rather than overlaying video', async ({ page }) => {
  await load(page, { width: 390 });
  await expect(page.getByRole('region', { name: 'ReelSong', exact: true })).toHaveCount(0);
});
test('Verified video opens a direct autoplay link and bookmark waits for confirmed save', async ({ page }) => {
  await load(page, { response: { success: true, result: knownSong } });
  const link = page.getByRole('link', { name: 'Play on YouTube' });
  await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dX3k_QDnzHE&autoplay=1');
  await page.getByRole('button', { name: 'Save to YouTube playlist', exact: true }).click();
  await expect(page.getByText('Saved to your YouTube playlist.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved to YouTube playlist', exact: true })).toBeDisabled();
});
test('Playlist API failures do not show Saved', async ({ page }) => {
  await load(page, { response: { success: true, result: knownSong } });
  await page.evaluate(() => window.__saveResponse = { success: false, message: 'Reconnect YouTube in settings.' });
  await page.getByRole('button', { name: 'Save to YouTube playlist', exact: true }).click();
  await expect(page.getByText('Reconnect YouTube in settings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to YouTube playlist', exact: true })).toBeEnabled();
});
test('No direct video: explicit search label, playlist saving disabled', async ({ page }) => {
  await load(page, { response: { success: true, result: { ...knownSong, links: { youtube: null } } } });
  await expect(page.getByRole('link', { name: 'Search YouTube' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play on YouTube' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save to YouTube playlist', exact: true })).toBeDisabled();
});
test('Resolution and MP3 actions send the active source, inaccessible sources are disabled', async ({ page }) => {
  await load(page);
  await page.getByLabel('Video resolution').selectOption('720');
  await page.getByRole('button', { name: '↓ Video', exact: true }).click();
  await expect(page.getByText(/Download started/)).toBeVisible();
  await page.getByRole('button', { name: '↓ MP3 audio' }).click();
  const calls = await page.evaluate(() => window.__messages.filter(m => m.type === 'DOWNLOAD_REEL'));
  expect(calls[0].resolution).toBe('720'); expect(calls[0].format).toBe('mp4');
  expect(calls[1].format).toBe('mp3'); expect(calls[0].media.url).toContain('reel-a.mp4');
  await load(page, { original: true });
  await expect(page.getByRole('button', { name: '↓ Video', exact: true })).toBeDisabled();
  await expect(page.getByText(/no accessible video file/)).toBeVisible();
});
test('Switching a reused video cancels the old response and clears stale songs', async ({ page }) => {
  await load(page, { delay: 1500, response: { success: true, result: knownSong } });
  await expect(page.getByText('Listening to this reel…')).toBeVisible();
  await page.evaluate(() => {
    window.__response = { success: false, code: 'SONG_NOT_FOUND' };
    window.__delay = 10;
    document.querySelector('video').src = 'https://scontent.cdninstagram.com/reel-b.mp4';
    document.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByText('Song not found', { exact: true })).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.locator('#reelsong-extension-root').getByText('Midnight City', { exact: true })).toHaveCount(0);
  const cancellations = await page.evaluate(() => window.__messages.filter(m => m.type === 'CANCEL_AUDIO_CAPTURE'));
  expect(cancellations.length).toBeGreaterThan(0);
});
test('Missing provider key is explained and keyboard controls remain usable', async ({ page }) => {
  await load(page, { response: { success: false, code: 'PROVIDER_NOT_CONFIGURED' } });
  await expect(page.getByText(/Add an AudD or ACRCloud key/)).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Could not identify song')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss ReelSong' }).click();
  await expect(page.getByRole('region', { name: 'ReelSong', exact: true })).toHaveCount(0);
});

test('Auto-identify resumes when a paused reel starts playing', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    const video = document.querySelector('video');
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    video.src = 'https://scontent.cdninstagram.com/paused-reel.mp4';
    video.dispatchEvent(new Event('pause'));
  });
  await expect(page.getByText('Play and unmute this reel, then try again.')).toBeVisible();
  const before = await page.evaluate(() => window.__messages.filter(m => m.type === 'START_AUDIO_CAPTURE').length);
  await page.evaluate(() => {
    const video = document.querySelector('video');
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.dispatchEvent(new Event('play'));
  });
  await expect(page.getByText('Song not found', { exact: true })).toBeVisible();
  const after = await page.evaluate(() => window.__messages.filter(m => m.type === 'START_AUDIO_CAPTURE').length);
  expect(after).toBeGreaterThan(before);
});
