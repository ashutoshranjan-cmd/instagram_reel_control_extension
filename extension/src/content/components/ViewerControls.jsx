import React, { useEffect, useState, useRef } from 'react';
import { getSongYouTubeUrl, buildYouTubeSearchUrl } from '../../utils/youtubeHelper.js';

export function ViewerControls({ viewer = {}, onAction, compact = false }) {
  const [error, setError] = useState('');
  const act = async (action, value) => {
    setError('');
    try {
      await onAction?.(action, value);
    } catch (e) {
      setError(e.message);
    }
  };

  const cycleFit = () => {
    const cycle = { contain: 'cover', cover: 'zoom', zoom: 'ultra', ultra: 'contain' };
    act('fit', cycle[viewer.fit] || 'cover');
    const cycle = { auto: 'cover', cover: 'zoom', zoom: 'ultra', ultra: 'contain', contain: 'auto' };
    act('fit', cycle[viewer.fit] || 'auto');
  };

  return (
    <div className={compact ? 'rs-viewer-controls rs-viewer-controls-inline' : 'rs-viewer-controls'}>
      {!compact && <strong className="rs-section-label">Watch your way</strong>}
      <div className="rs-control-grid">
        <button className="rs-secondary" aria-pressed={!!viewer.cinema} onClick={() => act('cinema')}>
          {viewer.cinema ? 'Exit cinema' : 'Cinema view'}
        </button>
        <button className="rs-secondary" aria-pressed={!!viewer.fullscreen} onClick={() => act('fullscreen')}>
          ⛶ {viewer.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
        <button className="rs-secondary" aria-pressed={viewer.fit !== 'contain'} onClick={cycleFit}>
          {viewer.fit === 'ultra' ? 'Zoom 1.6x' : viewer.fit === 'zoom' ? 'Zoom 1.35x' : viewer.fit === 'cover' ? 'Fill' : 'Fit'} video
          {viewer.fit === 'ultra' ? 'Zoom 1.6x' : viewer.fit === 'zoom' ? 'Zoom 1.35x' : viewer.fit === 'cover' ? 'Fill' : viewer.fit === 'contain' ? 'Fit' : 'Auto'} video
        </button>
        <button className="rs-secondary" aria-pressed={!!viewer.focus} onClick={() => act('focus')}>
          {viewer.focus ? 'Exit focus' : 'Focus mode'}
        </button>
      </div>
      <div className="rs-volume">
        <button className="rs-btn-icon" aria-label={viewer.muted ? 'Unmute reel' : 'Mute reel'} onClick={() => act('mute')}>
          {viewer.muted ? '🔇' : '🔊'}
        </button>
        <input
          aria-label="Reel volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={viewer.muted ? 0 : viewer.volume ?? 1}
          onChange={e => act('volume', Number(e.target.value))}
        />
        <span>{Math.round((viewer.muted ? 0 : viewer.volume ?? 1) * 100)}%</span>
      </div>
      <div className="rs-nav-row">
        <button className="rs-secondary" onClick={() => act('previous')} aria-label="Previous reel">↑ Previous</button>
        <button className="rs-secondary" onClick={() => act('next')} aria-label="Next reel">Next ↓</button>
      </div>
      {!compact && (
        <label className="rs-check">
          <input type="checkbox" checked={viewer.shortcuts !== false} onChange={() => act('shortcuts')} />
          Mouse wheel & arrow navigation
        </label>
      )}
      {error && <p className="rs-note" role="status">{error}</p>}
    </div>
  );
}

export function ViewerHUD({ viewer = {}, onAction, onAnalyze, busy, song }) {
  const [awake, setAwake] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);

  const isActive = Boolean(viewer?.cinema || viewer?.fullscreen);

  useEffect(() => {
    if (!isActive) {
      setAwake(true);
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAwake(true);
      if (!isHovered) {
        timerRef.current = setTimeout(() => {
          setAwake(false);
        }, 2500);
      }
    };

    if (isHovered) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAwake(true);
    } else {
      resetTimer();
    }

    const onActivity = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [isActive, isHovered]);

  if (!isActive) return null;

  const directUrl = song ? (getSongYouTubeUrl(song) || buildYouTubeSearchUrl(song.artist, song.title)) : null;

  const cycleZoom = () => {
    const cycle = { contain: 'cover', cover: 'zoom', zoom: 'ultra', ultra: 'contain' };
    onAction('fit', cycle[viewer.fit] || 'cover');
    const cycle = { auto: 'cover', cover: 'zoom', zoom: 'ultra', ultra: 'contain', contain: 'auto' };
    onAction('fit', cycle[viewer.fit] || 'auto');
  };

  return (
    <>
      <div
        className="rs-cinema-hover-zone"
        onMouseEnter={() => setAwake(true)}
        onMouseMove={() => setAwake(true)}
        aria-hidden="true"
      />
      <div
        className={`rs-cinema-toolbar ${!awake ? 'rs-asleep' : ''}`}
        role="toolbar"
        aria-label="Cinema controls"
        onMouseEnter={() => {
          setIsHovered(true);
          setAwake(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onFocus={() => setAwake(true)}
      >
        <button onClick={() => onAction('previous')} aria-label="Previous reel">↑</button>
        <button onClick={() => onAction('play')} aria-label="Play or pause reel">
          {viewer.paused ? '▶ Play' : 'Ⅱ Pause'}
        </button>
        <button onClick={() => onAction('next')} aria-label="Next reel">↓</button>
        <button onClick={cycleZoom} title="Toggle Zoom / Fill / Fit modes">
        <button onClick={cycleZoom} title="Toggle Auto Aspect / Fill / Zoom / Fit modes">
          {viewer.fit === 'ultra'
            ? '🔍 Zoom 1.6x'
            : viewer.fit === 'zoom'
            ? '🔍 Zoom 1.35x'
            : viewer.fit === 'cover'
            ? '↔ Fill Screen'
            : '⛶ Fit Video'}
            : viewer.fit === 'contain'
            ? '⛶ Fit Video'
            : '✨ Auto Aspect'}
        </button>
        <button onClick={() => onAction('fullscreen')} aria-label={viewer.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {viewer.fullscreen ? 'Exit ⛶' : '⛶ Fullscreen'}
        </button>
        <button onClick={onAnalyze} disabled={busy}>{busy ? 'Analyzing…' : 'Identify song'}</button>
        {song && directUrl && (
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rs-hud-song-btn"
            title={`${song.title} - ${song.artist}`}
          >
            🎵 {song.title} · {song.artist} ▶ YouTube
          </a>
        )}
        <button onClick={() => onAction('exit')}>Exit · Esc</button>
      </div>
    </>
  );
}
