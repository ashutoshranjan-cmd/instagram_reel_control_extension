import { settingsService } from '../services/settings.service.js';
const fail = (code, message) => Object.assign(new Error(message), { code });
let authVersion = 0, signIn = null, writes = Promise.resolve();
async function auth(interactive = false) {
  const { youtubeClientId } = await settingsService.getSettings();
  if (!youtubeClientId?.endsWith('.apps.googleusercontent.com')) throw fail('SETUP_REQUIRED', 'Add your Google OAuth client ID in YouTube settings first.');
  const saved = (await chrome.storage.session.get('youtubeAuth')).youtubeAuth;
  if (saved?.clientId === youtubeClientId && saved.expiresAt > Date.now() + 60000) return saved.accessToken;
  if (!interactive) throw fail('AUTH_REQUIRED', 'Connect YouTube to load your playlists.');
  if (signIn) return signIn;
  const version = authVersion;
  signIn = (async () => {
    const state = crypto.randomUUID();
    const redirect = chrome.identity.getRedirectURL();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: youtubeClientId, redirect_uri: redirect, response_type: 'token',
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl', prompt: 'select_account', state }).toString();
    let callback;
    try { callback = await chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true }); }
    catch { throw fail('AUTH_REQUIRED', 'Sign-in was closed or blocked. Reconnect YouTube to try again.'); }
    const result = new URL(callback || redirect);
    const params = new URLSearchParams(result.hash.slice(1));
    if (result.origin !== new URL(redirect).origin || params.get('state') !== state || !params.get('access_token')) throw fail('AUTH_REQUIRED', 'YouTube access was not granted. Please reconnect.');
    if (version !== authVersion) throw fail('AUTH_REQUIRED', 'YouTube was disconnected.');
    const accessToken = params.get('access_token');
    // Clear a playlist chosen for a different account before exposing the new account's lists.
    await settingsService.updateSettings({ youtubePlaylistId: '', youtubePlaylistTitle: '' });
    await chrome.storage.session.set({ youtubeAuth: { clientId: youtubeClientId, accessToken, expiresAt: Date.now() + Math.min(Number(params.get('expires_in')) || 3600, 3600) * 1000 } });
    return accessToken;
  })();
  try { return await signIn; } finally { signIn = null; }
}
async function api(path, accessToken, body) {
  let response;
  try { response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
  }); } catch { throw fail('NETWORK_ERROR', 'Could not reach YouTube. Check your connection and try again.'); }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { await chrome.storage.session.remove(['youtubeAuth','youtubePlaylists']); throw fail('AUTH_REQUIRED', 'Your YouTube connection expired. Reconnect to load playlists.'); }
    const reason = data.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw fail('QUOTA_EXCEEDED', 'YouTube API quota reached. Try again later.');
    if (response.status === 404) throw fail('PLAYLIST_REQUIRED', 'This playlist is no longer available. Refresh and choose another.');
    throw fail('YOUTUBE_ERROR', 'YouTube denied this request. Check API enablement, account access, and playlist ownership.');
  }
  return data;
}
export async function listYouTubePlaylists(interactive = false, refresh = false) {
  const token = await auth(interactive);
  const saved = (await chrome.storage.session.get('youtubePlaylists')).youtubePlaylists;
  // Cache survives the action popup closing during Google sign-in. Never expose tokens to content scripts.
  let playlists = !refresh && saved?.expiresAt > Date.now() && saved.token === token ? saved.items : null;
  if (!playlists) {
    playlists = []; let pageToken = '';
    do {
      const data = await api(`playlists?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token);
      playlists.push(...(data.items || []).map(p => ({ id: p.id, title: p.snippet.title })));
      pageToken = data.nextPageToken;
    } while (pageToken && playlists.length < 1000);
    await chrome.storage.session.set({ youtubePlaylists: { token, items: playlists, expiresAt: Date.now() + 5 * 60000 } });
  }
  const settings = await settingsService.getSettings();
  return { success: true, connected: true, playlists, selectedId: playlists.some(p => p.id === settings.youtubePlaylistId) ? settings.youtubePlaylistId : '' };
}
export async function disconnectYouTube() {
  authVersion++;
  await chrome.storage.session.remove(['youtubeAuth','youtubePlaylists']);
  await settingsService.updateSettings({ youtubePlaylistId: '', youtubePlaylistTitle: '' });
  return { success: true };
}
export async function selectYouTubePlaylist(playlistId) {
  const data = await listYouTubePlaylists();
  const playlist = data.playlists.find(p => p.id === playlistId);
  if (!playlist) throw fail('PLAYLIST_REQUIRED', 'Choose one of your available YouTube playlists.');
  await settingsService.updateSettings({ youtubePlaylistId: playlist.id, youtubePlaylistTitle: playlist.title });
  return { success: true, playlist };
}
export function saveToYouTube(videoId, playlistId) {
  const pending = writes.catch(() => {}).then(async () => {
    if (!/^[\w-]{11}$/.test(videoId || '')) throw fail('VIDEO_REQUIRED', 'No verified YouTube video is available for this song.');
    const settings = await settingsService.getSettings();
    const selectedId = playlistId || settings.youtubePlaylistId;
    if (!selectedId) throw fail('PLAYLIST_REQUIRED', 'Choose a playlist below.');
    const selection = await selectYouTubePlaylist(selectedId);
    const token = await auth();
    const params = new URLSearchParams({ part: 'id', playlistId: selectedId, videoId, maxResults: '1' });
    const existing = await api(`playlistItems?${params}`, token);
    if (!existing.items?.length) await api('playlistItems?part=snippet', token, { snippet: { playlistId: selectedId, resourceId: { kind: 'youtube#video', videoId } } });
    return { success: true, alreadySaved: Boolean(existing.items?.length), playlistTitle: selection.playlist.title };
  });
  writes = pending; return pending;
}
