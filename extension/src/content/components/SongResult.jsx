import React, { useState } from 'react';
import { YouTubePlaylistPicker } from './YouTubePlaylistPicker.jsx';
import { YouTubeIcon, MusicIcon } from '../../components/icons.jsx';
import { getSongYouTubeUrl, getYouTubeVideoId, buildYouTubeSearchUrl } from '../../utils/youtubeHelper.js';

export const SongResult = ({ song }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [message, setMessage] = useState('');

  if (!song) return null;

  const directVideoUrl = getSongYouTubeUrl(song);
  const searchUrl = buildYouTubeSearchUrl(song.artist, song.title);
  const primaryUrl = directVideoUrl || searchUrl;
  const isDirect = Boolean(directVideoUrl);

  return (
    <div className="rs-song">
      <div className="rs-song-heading">
        <div className="rs-art-container">
          <MusicIcon size={22} />
        </div>
        <div className="rs-info">
          <span className="rs-source-badge">
            {song.source === 'instagram_credit' ? 'Instagram credit' : 'Audio match'}
          </span>
          <strong className="rs-title">{song.title}</strong>
          <span className="rs-artist">{song.artist}</span>
        </div>
      </div>

      <div className="rs-actions">
        <a
          className="rs-btn-youtube"
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <YouTubeIcon size={16} />
          {isDirect ? 'Play on YouTube' : 'Search YouTube'}
        </a>

        <button
          className="rs-btn-icon"
          onClick={() => setShowPicker(!showPicker)}
          aria-expanded={showPicker}
          aria-label="Save to YouTube playlist"
          title="Save to YouTube playlist"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 3h14v18l-7-5-7 5z" />
          </svg>
        </button>
      </div>

      {showPicker && (
        <YouTubePlaylistPicker
          key={getYouTubeVideoId(directVideoUrl) || 'search_playlist'}
          videoId={getYouTubeVideoId(directVideoUrl)}
          onSaved={result => {
            setMessage(`Saved to ${result.playlistTitle || 'your YouTube playlist'}.`);
            setShowPicker(false);
          }}
        />
      )}

      {message && <p className="rs-note" role="status">{message}</p>}
    </div>
  );
};
