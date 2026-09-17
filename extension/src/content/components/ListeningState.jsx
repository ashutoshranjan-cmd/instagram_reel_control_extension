import React from 'react';
import { CloseIcon } from '../../components/icons.jsx';

export const ListeningState = ({ isCapturing, onClose }) => {
  return (
    <>
      <div className="rs-art-container">
        <div className="rs-waves">
          <div className="rs-wave-bar" />
          <div className="rs-wave-bar" />
          <div className="rs-wave-bar" />
          <div className="rs-wave-bar" />
        </div>
      </div>

      <div className="rs-info">
        <span className="rs-title">
          {isCapturing ? 'Listening for music...' : 'Identifying song...'}
        </span>
        <span className="rs-artist">
          {isCapturing ? 'Capturing audio sample' : 'Searching music database'}
        </span>
      </div>

      <div className="rs-actions">
        <button
          type="button"
          onClick={onClose}
          className="rs-btn-icon"
          title="Cancel"
          aria-label="Cancel"
        >
          <CloseIcon size={15} />
        </button>
      </div>
    </>
  );
};

