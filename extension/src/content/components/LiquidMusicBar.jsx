import React, { useState, useEffect } from 'react';
import { SongResult } from './SongResult.jsx';
import { ViewerControls } from './ViewerControls.jsx';
import { ReelLinkControls } from './ReelLinkControls.jsx';
import { DownloadControls } from './DownloadControls.jsx';
import { settingsService } from '../../services/settings.service.js';
import { getPanelPlacement } from '../../utils/panelPlacement.js';
import { getReelMedia } from '../../platform/instagram/reelMedia.js';

const defaultPlacement = {
  position: 'fixed',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '380px',
  zIndex: 2147483640
};

export const LiquidMusicBar = ({ state, data, onRetry, onClose, onViewerAction, viewer = {}, inPopup = false }) => {
  const [theme, setTheme] = useState('dark');
  const [placement, setPlacement] = useState(() => (inPopup ? { position: 'static', width: '100%' } : defaultPlacement));
  const [media, setMedia] = useState(null);

  useEffect(() => {
    settingsService.getSettings().then(s => {
      setTheme(s.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme);
    });
  }, []);

  useEffect(() => {
    if (inPopup) {
      setMedia(data?.media || null);
      return;
    }

    const update = () => {
      if (viewer.cinema || viewer.fullscreen) return;
      const video = data?.reel?.videoElement || document.querySelector('video');
      let navRight = 80;
      for (const nav of document.querySelectorAll('nav, [role="navigation"]')) {
        const r = nav.getBoundingClientRect();
        if (r.left < 40 && r.width < 350) navRight = Math.max(navRight, r.right);
      }
      const rect = video?.isConnected ? video.getBoundingClientRect() : null;
      const newPlacement = viewer.cinema
        ? (viewer.sidebar && !viewer.focus ? { position: 'fixed', left: `${innerWidth - 300}px`, top: '20px', width: '280px' } : null)
        : (rect ? getPanelPlacement(rect, innerWidth, innerHeight, navRight) : defaultPlacement);

      setPlacement(newPlacement || defaultPlacement);
      if (data?.reel) setMedia(getReelMedia(data.reel));
    };

    update();
    const timer = setInterval(update, 600);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [data?.reel, data?.media, viewer.cinema, viewer.sidebar, viewer.focus, inPopup]);

  if (!inPopup && (state === 'CANCELLED' || viewer.fullscreen || viewer.focus || (viewer.cinema && !viewer.sidebar))) {
    return null;
  }
  if (!data?.reel && !inPopup) return null;

  const busy = ['DETECTING', 'CAPTURING', 'RECOGNIZING'].includes(state);

  const getStatusTitle = () => {
    if (busy) return state === 'CAPTURING' ? 'Listening to this reel…' : 'Checking for a song…';
    if (state === 'NOT_FOUND') return 'Song not found';
    if (state === 'ERROR') return 'Could not identify song';
    if (state === 'READY_TO_IDENTIFY') return data?.credit?.isOriginalAudio ? 'Original / Uncredited Audio' : 'Find song in this reel';
    return 'Find song in this reel';
  };

  const getStatusSubtitle = () => {
    if (state === 'ERROR') return data?.error || 'Could not complete identification.';
    if (state === 'NOT_FOUND') return 'No reliable match found. Try another part of the reel.';
    if (busy) return 'Keep this reel playing. Changing reels cancels analysis.';
    return 'Click below to analyze audio. Protects your free API quota.';
  };

  return (
    <div className={`reelsong-wrapper ${inPopup ? 'rs-popup-card' : ''}`} style={inPopup ? { position: 'static', width: '100%' } : (placement || defaultPlacement)}>
      <section
        className={`reelsong-bar theme-${theme}`}
        aria-label="ReelSong"
        style={!inPopup && placement?.top ? { maxHeight: `calc(100vh - ${placement.top + 24}px)` } : { maxHeight: '82vh' }}
      >
        <header className="rs-header">
          <span className="rs-brand">♫ REELSONG</span>
          {!inPopup && <button className="rs-btn-icon" onClick={onClose} aria-label="Dismiss ReelSong">×</button>}
        </header>

        {state === 'FOUND' && data?.result ? (
          <SongResult key={data.requestId || data.result?.title} song={data.result} credit={data.credit} />
        ) : (
          <div className="rs-status" role="status">
            <strong>{getStatusTitle()}</strong>
            <p>{getStatusSubtitle()}</p>
            {!busy && data?.credit?.rawText && !data?.credit?.isOriginalAudio && (
              <p className="rs-credit">Instagram credit: {data.credit.rawText}</p>
            )}
            <button className="rs-primary" onClick={onRetry} disabled={busy}>
              {busy ? 'Analyzing…' : state === 'ERROR' || state === 'NOT_FOUND' ? 'Try again' : 'Identify Song'}
            </button>
          </div>
        )}

        <details className="rs-details">
          <summary>Viewing controls</summary>
          <ViewerControls viewer={viewer} onAction={onViewerAction} />
        </details>

        {data?.reel && <ReelLinkControls key={data.reel.reelId} reel={data.reel} />}

        {data?.reel && (
          <details className="rs-details">
            <summary>Download reel / MP3</summary>
            <DownloadControls key={data.reel.reelId} reel={data.reel} media={media} />
          </details>
        )}
      </section>
    </div>
  );
};
