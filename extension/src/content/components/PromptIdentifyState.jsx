import React from 'react';
import { MusicIcon, SparklesIcon, CloseIcon } from '../../components/icons.jsx';

export const PromptIdentifyState = ({ data, onIdentify, onClose }) => {
  const isOriginal = data?.isOriginalAudio;
  const title = isOriginal ? (data?.rawText || 'Original Audio') : 'Uncredited Audio';
  const subtitle = 'Click to identify song via audio';

  return (
    <>
      <div className="rs-art-container" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
        <MusicIcon size={20} />
      </div>

      <div className="rs-info">
        <span className="rs-title" title={title}>{title}</span>
        <span className="rs-artist" title={subtitle}>{subtitle}</span>
      </div>

      <div className="rs-actions">
        <button
          type="button"
          onClick={onIdentify}
          className="rs-btn-identify"
          title="Identify this song"
        >
          <SparklesIcon size={14} />
          <span>Identify Song</span>
        </button>

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

