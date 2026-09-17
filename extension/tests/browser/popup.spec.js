import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
test('Built popup exposes current reel controls and YouTube account setup', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.route('https://popup.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const type = pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html';
    await route.fulfill({ contentType: type, body: await readFile(path.join(root, pathname)) });
  });
  await page.addInitScript(() => {
    window.__storage = {};
    Object.defineProperty(window, 'chrome', { value: {
      identity: { getRedirectURL: () => 'https://test.chromiumapp.org/' },
      storage: { local: { get: async key => ({ [key]: window.__storage[key] }), set: async data => Object.assign(window.__storage, data), remove: async () => {} } },
      tabs: {
        query: async () => [{ id: 1, url: 'https://www.instagram.com/reels/A/' }],
        sendMessage: (id, message, respond) => respond({ state: 'NOT_FOUND', song: null, reel: { reelId: 'A', shortcode: 'A' }, media: { url: 'https://scontent.cdninstagram.com/a.mp4', width: 720, height: 1280 } })
      },
      runtime: { sendMessage: async message => message.type === 'CONNECT_YOUTUBE' ? { success: true, playlists: [{ id: 'list1', title: 'My Reel songs' }] } : { success: true } }
    }, configurable: true });
  });
  await page.goto('https://popup.test/src/popup/index.html');
  await expect(page.getByText('Song not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '↓ MP3 audio' })).toBeEnabled();
  await page.getByTitle('Settings', { exact: true }).click();
  await page.getByLabel('YouTube OAuth client ID').fill('test.apps.googleusercontent.com');
  await page.getByRole('button', { name: 'Connect YouTube / Refresh playlists' }).click();
  await expect(page.getByText('Connected. Choose a playlist below.')).toBeVisible();
  await page.getByLabel('Save songs to playlist').selectOption('list1');
  await expect.poll(() => page.evaluate(() => window.__storage.reelsong_settings?.youtubePlaylistId)).toBe('list1');
  await expect.poll(() => page.evaluate(() => window.__storage.reelsong_settings?.youtubeClientId)).toBe('test.apps.googleusercontent.com');
  await page.getByRole('button', { name: 'Disconnect YouTube', exact: true }).click();
  await expect(page.getByText('Disconnected.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/popup-settings.png', fullPage: true });
});
