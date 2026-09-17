import React from 'react';
import { AlertCircleIcon, RefreshIcon, CloseIcon, MusicIcon, YouTubeIcon } from '../../components/icons.jsx';

export const ErrorState = ({ isNotFound, isOriginalAudio, error, fallbackSearchUrl, onRetry, onClose }) => {
  const title = isNotFound
    ? (isOriginalAudio ? 'Original Audio' : "Couldn't identify this audio")
    : (error || 'Unable to identify music');

  const subtitle = isNotFound
    ? (isOriginalAudio ? 'User created audio track' : 'No commercial match found')
    : (isOriginalAudio ? 'Original audio - audio backend offline' : 'Check connection or try again');

  return (
    <>
      <div
        className="rs-art-container"
        style={{
          background: isNotFound
            ? 'linear-gradient(135deg, #64748b, #334155)'
            : 'linear-gradient(135deg, #f59e0b, #ef4444)'
        }}
      >
        {isNotFound ? <MusicIcon size={20} /> : <AlertCircleIcon size={20} />}
      </div>

      <div className="rs-info">
        <span className="rs-title" title={title}>{title}</span>
        <span className="rs-artist" title={subtitle}>{subtitle}</span>
      </div>

      <div className="rs-actions">
        {fallbackSearchUrl && (
          <a
            href={fallbackSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rs-btn-youtube"
            title="Search on YouTube"
          >
            <YouTubeIcon size={15} />
            <span>Search YouTube</span>
          </a>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rs-btn-icon"
            title="Try Again"
            aria-label="Try Again"
          >
            <RefreshIcon size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rs-btn-icon"
          title="Dismiss"
          aria-label="Dismiss"
        >
          <CloseIcon size={15} />
        </button>
      </div>
    </>
  );
};
