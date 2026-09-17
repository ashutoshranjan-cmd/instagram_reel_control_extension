import React, { useEffect, useState } from 'react';
export function YouTubePlaylistPicker({ videoId, onSaved, settingsMode = false }) {
  const [playlists, setPlaylists] = useState([]), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState(''), [code, setCode] = useState('');
  async function load(interactive = false, refresh = false) {
    setBusy(true); setStatus(interactive ? 'Connecting to YouTube…' : 'Loading playlists…');
    try {
      const result = await chrome.runtime.sendMessage({ type: interactive ? 'CONNECT_YOUTUBE' : 'LIST_YOUTUBE_PLAYLISTS', refresh });
      if (!result?.success) throw Object.assign(new Error(result?.message || 'Could not load playlists.'), { code: result?.code });
      setPlaylists(result.playlists || []); setSelected(result.selectedId || ''); setLoaded(true); setCode('');
      setStatus(result.playlists?.length ? '' : 'No playlists found. Create a playlist on YouTube, then refresh.');
    } catch (error) { setStatus(error.message); setCode(error.code || 'NETWORK_ERROR'); setLoaded(false); setPlaylists([]); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  async function save() {
    setBusy(true); setStatus('');
    try {
      const response = await chrome.runtime.sendMessage({ type: settingsMode ? 'SELECT_YOUTUBE_PLAYLIST' : 'SAVE_TO_YOUTUBE', playlistId: selected, videoId });
      if (!response?.success) throw Object.assign(new Error(response?.message || 'YouTube did not confirm the save.'), { code: response?.code });
      setStatus(settingsMode ? 'Default playlist updated.' : `Saved to ${response.playlistTitle || 'your YouTube playlist'}.`);
      if (!settingsMode) onSaved?.(response);
    } catch (error) { setStatus(error.message); setCode(error.code || 'YOUTUBE_ERROR'); }
    finally { setBusy(false); }
  }
  return <div className="rs-playlist-picker" aria-label="YouTube playlist chooser">
    <strong>{settingsMode ? 'YouTube playlist' : 'Save song to YouTube'}</strong>
    {loaded && <><label className="rs-field-label">Playlist<select aria-label="Choose YouTube playlist" value={selected} onChange={e => setSelected(e.target.value)} disabled={busy || !playlists.length}>
      <option value="">Choose a playlist</option>{playlists.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select></label><button className="rs-primary" disabled={!selected || busy} onClick={save}>{settingsMode ? 'Use this playlist' : 'Save to playlist'}</button></>}
    {status && <p className="rs-note" role="status">{status}</p>}
    <div className="rs-inline-actions">
      {code === 'SETUP_REQUIRED' ? <button className="rs-secondary" onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_YOUTUBE_SETTINGS' })}>Open YouTube settings</button>
        : <button className="rs-secondary" disabled={busy} onClick={() => load(!loaded || code === 'AUTH_REQUIRED', true)}>{loaded && code !== 'AUTH_REQUIRED' ? 'Refresh playlists' : 'Connect YouTube'}</button>}
      {loaded && <a className="rs-text-link" href="https://www.youtube.com/feed/playlists" target="_blank" rel="noreferrer">Manage playlists ↗</a>}
    </div>
    {settingsMode && loaded && <button className="rs-text-button" disabled={busy} onClick={async () => { await chrome.runtime.sendMessage({ type: 'DISCONNECT_YOUTUBE' }); setLoaded(false); setPlaylists([]); setSelected(''); setCode('AUTH_REQUIRED'); setStatus('Disconnected from YouTube.'); }}>Disconnect YouTube</button>}
  </div>;
}
