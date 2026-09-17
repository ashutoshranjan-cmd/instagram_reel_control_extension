# ReelSong

Chrome/Brave extension for Instagram Reels: identify the audible song, open a verified YouTube video, save it to a YouTube playlist, and download the reel or its MP3 audio.

The extension is built in `extension/dist`. It requires Chrome/Chromium 116 or later. Node 18+ and FFmpeg/ffprobe are needed for the local backend and media conversion.

## Run the updated version

1. In `backend`, run `npm install` and `npm start`. The default server is `http://localhost:5050`; `.env` can override the port. Keep this terminal running.
2. In `extension`, run `npm install` and `npm run build`.
3. Open `chrome://extensions` (or `brave://extensions`), enable Developer mode, and load `extension/dist`. If already installed, click Reload on ReelSong, then refresh Instagram.
4. Play and unmute a reel. Open the extension's toolbar popup and choose **Identify Current Reel** to grant tab capture access. The browser requires extension invocation before tab audio capture; a button injected in the Instagram page cannot grant that permission.

The popup supports all song and download controls. On wide pages the card appears beside the reel, outside its video and action rail. If neither side has enough room, it stays in the toolbar popup instead of covering the reel. The close button dismisses it until the next reel.

## Set up recognition

The old implementation misidentified UI labels and captions as music. Those paths have been removed. Instagram music credits can also describe a different track than the actual audible edit, so they are not treated as verified recognition.

Add one provider's credentials to `backend/.env` and restart the backend:

```dotenv
PORT=5050
MUSIC_PROVIDER=acrcloud
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_key
ACRCLOUD_ACCESS_SECRET=your_secret
```

Use the host for your ACRCloud project. ACRCloud results must have a numeric score of at least 90/100. Close competing matches with different titles are rejected. ACRCloud can provide a direct YouTube ID through external metadata; availability depends on the catalog/project configuration.

Alternatively:

```dotenv
PORT=5050
MUSIC_PROVIDER=audd
AUDD_API_TOKEN=your_token
```

AudD's standard API identifies audio but does **not** document `youtube` as a supported `return` field. This app no longer requests that unsupported field or invents a confidence score. If a provider does not supply a valid direct YouTube video, the result explicitly says so and offers **Search YouTube**, with playlist saving disabled. It never picks the first search result and calls it verified.

Only complete audio-provider results are shown as matches. No match/weak match, muted or paused video, missing provider keys, permission failure, and server failure have distinct messages. A provider match is evidence, not a guarantee of perfect recognition for every remix or noisy clip. Requests are cancelled when reels change, and the old untrusted cache/history is excluded from the new version.

Your current server address must be one of the permitted local addresses: `http://localhost:5050`, `http://localhost:5000`, or the corresponding `127.0.0.1` address. Check `/api/health` for configuration status. Recognition API keys stay on the backend; the extension does not store them.

## YouTube playback and playlist saving

**Play on YouTube** opens the provider-supplied video with `autoplay=1`. YouTube/browser autoplay restrictions may still require pressing Play. Search links are labeled **Search YouTube**, never playback links.

Playlist writes require your Google account's authorization. Being signed in to youtube.com alone does not authorize the extension.

1. In your Google Cloud project, enable **YouTube Data API v3** and configure the OAuth consent screen. If the app is in testing, add your Google account as a test user.
2. Create an OAuth **Web application** client. In ReelSong Settings, copy the exact **Redirect URI** (the extension's `https://<extension-id>.chromiumapp.org/` address) into the client's authorized redirect URIs.
3. Paste the public client ID into ReelSong Settings. Do not paste a client secret; none is used or stored by this extension.
4. Click **Connect YouTube / Refresh playlists**, sign in, and choose one of your playlists. Create a playlist on YouTube first if you have none.
5. Click the bookmark icon next to a verified video's playback button. It checks for duplicates, inserts the video into your selected playlist, and shows **Saved** only after YouTube confirms the operation.

This uses `chrome.identity.launchWebAuthFlow` with Google's client-side OAuth flow and the `youtube.force-ssl` scope. Tokens are stored only in `chrome.storage.session`, not local history or backend files. Reconnect when the token expires or after restarting the browser. **Disconnect YouTube** discards the session token; you can also revoke app access in your Google account.

The client ID/redirect URI must match this installation's extension ID. Moving the unpacked extension to another path can change its ID. Google Workspace policy or an unapproved consent-screen configuration may prevent sign-in; the UI reports the failure instead of claiming a save.

## Reel video / MP3 downloads

- **Original source** downloads the active reel's accessible source file directly.
- The selector shows its actual dimensions when known. Smaller choices (1080p, 720p, 480p, 360p) are explicitly marked **converted**, and only appear below the source's shorter dimension. For a portrait reel, 720p means a width of 720 pixels with proportional height. No artificial upscale is offered.
- **MP3 audio** extracts the audio track from the full accessible reel source into a real 192 kbps MP3. It does not rename an MP4 or download the identified song from YouTube.
- MP3 and resized videos require the running backend with `ffmpeg` and `ffprobe` on PATH. Verify with `ffmpeg -version` and `ffprobe -version`.
- Sources are limited to Instagram/Meta media CDN URLs attached to the current video or matching that reel's structured metadata. Expired URLs, inaccessible blob/DASH-only sources without an exposed full video URL, and videos without audio are reported clearly. The extension does not substitute media from an unrelated preloaded reel.
- Conversion accepts up to 100 MB, 20 minutes, and 4K source pixel count, one job at a time. Original downloads are not uploaded to the backend. Conversions use temporary files deleted on completion/failure; a process crash can leave OS temporary files.
- The browser's download manager shows file progress and any later download errors. “Download started” means the browser accepted the job, not that it has finished writing the file.

## Tests

```bash
cd backend
npm test

cd ../extension
npm test
npm run test:browser
```

Browser tests use an installed Chrome executable (`/usr/bin/google-chrome` by default). Set `CHROME_PATH` for another Chromium executable. Playwright is pinned for this project's Node 18 runtime.

Coverage includes false-label rejection, recognition failures, cache and asynchronous reel-switch races, capture cancellation during stream acquisition/upload, OAuth state validation, playlist API errors and duplicate inserts, valid/invalid YouTube URLs, real FFmpeg MP3/MP4 conversion, source resolution limits, responsive positioning, and UI save/download actions.

The browser suite runs the built content script against controlled Instagram-shaped DOM fixtures and mocked extension/provider responses. It does not sign in to your Instagram or Google account, verify live commercial-song recognition, or mutate your real YouTube playlists. Those live checks require your credentials and an authenticated browser session.

Screenshots from the layout checks are in `extension/tests/artifacts/`.

## Permissions and data

`tabCapture`, `activeTab`, and `offscreen` support short tab-audio samples, with audio routed back to the speakers during capture. No microphone is requested. `storage` holds settings, verified history, and the 24-hour cache. `identity` supports Google authorization; `downloads` starts the requested file downloads. `tabs` and `scripting` find/reinitialize the active Instagram tab.

The server binds to loopback by default. Audio samples go only to your configured local server and its chosen recognition provider. Video conversion uploads the selected source to the local server. Playlist requests go directly to Google's API. No Instagram login cookies are read or stored.

API references: [Chrome tab capture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture), [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity), [Google client-side OAuth](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow), [YouTube playlist insertion](https://developers.google.com/youtube/v3/docs/playlistItems/insert), [AudD recognition](https://docs.audd.io/).
# instagram_reel_control_extension
