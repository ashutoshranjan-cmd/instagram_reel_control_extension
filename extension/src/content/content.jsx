import React from 'react';
import { createRoot } from 'react-dom/client';
import { createShadowMount } from './shadow-host.js';
import { LiquidMusicBar } from './components/LiquidMusicBar.jsx';
import { ViewerHUD } from './components/ViewerControls.jsx';
import { InstagramDetector } from '../platform/instagram/InstagramDetector.js';
import { RecognitionManager } from '../services/recognitionManager.js';
import { ReelViewer } from '../viewer/ReelViewer.js';
import { getReelMedia } from '../platform/instagram/reelMedia.js';
import { MessageTypes } from '../utils/messageTypes.js';

function init() {
  if (globalThis.__reelsongStarted) return;
  globalThis.__reelsongStarted = true;

  const { mountPoint } = createShadowMount();
  const root = createRoot(mountPoint);
  let current = { state: 'IDLE', data: {} };
  let viewerState = {};
  let viewer;

  const render = () => {
    root.render(
      <>
        <LiquidMusicBar
          state={current.state}
          data={current.data}
          viewer={viewerState}
          onViewerAction={onAction}
          onRetry={analyze}
          onClose={() => manager.cancel()}
        />
        <ViewerHUD
          viewer={viewerState}
          song={current.data.result}
          onAction={(action, value) => onAction(action, value).catch(() => {})}
          onAnalyze={analyze}
          busy={['DETECTING', 'CAPTURING', 'RECOGNIZING'].includes(current.state)}
        />
      </>
    );
  };

  const manager = new RecognitionManager((state, data) => {
    current = { state, data: { ...current.data, ...data } };
    render();
  });

  const detector = new InstagramDetector(reel => {
    if (reel?.isReel) {
      current.data.reel = reel;
      viewer?.updateReel(reel);
      manager.identifyReel(reel, false);
    } else {
      current.data.reel = null;
      manager.reset();
    }
    render();
  });

  const analyze = () => {
    const reel = detector.detectActiveReel();
    if (reel?.isReel) {
      current.data.reel = reel;
      viewer?.updateReel(reel);
      manager.identifyReel(reel, true);
    }
  };

  const onAction = async (action, value) => {
    if (!viewer?.reel?.videoElement?.isConnected) {
      const reel = detector.detectActiveReel();
      if (reel?.isReel) viewer?.updateReel(reel);
    }
    return viewer?.action(action, value);
  };

  viewer = new ReelViewer(detector, state => {
    viewerState = state;
    render();
  });

  viewer.start();
  detector.start();

  // Check immediately for active reel on page load
  const initial = detector.detectActiveReel();
  if (initial?.isReel) {
    current.data.reel = initial;
    viewer.updateReel(initial);
    manager.identifyReel(initial, false);
  }
  render();

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === MessageTypes.MANUAL_IDENTIFY) {
      const reel = detector.detectActiveReel();
      if (!reel?.isReel) {
        respond({ success: false, message: 'No active reel found.' });
        return;
      }
      current.data.reel = reel;
      viewer.updateReel(reel);
      manager.identifyReel(reel, true);
      respond({ success: true });
      return;
    }

    if (message.type === 'VIEWER_ACTION') {
      if (!viewer.reel?.videoElement?.isConnected) {
        const r = detector.detectActiveReel();
        if (r?.isReel) viewer.updateReel(r);
      }
      viewer
        .action(message.action, message.value)
        .then(res => respond({ success: true, viewer: { ...viewer.state }, ...res }))
        .catch(e => respond({ success: false, message: e.message }));
      return true;
    }

    if (message.type === 'RECOGNITION_PROGRESS' && message.requestId === manager.currentRequestId) {
      manager.setState('RECOGNIZING');
    }

    if (message.type === MessageTypes.GET_CURRENT_STATE) {
      const reel = detector.detectActiveReel();
      if (reel?.isReel && (!current.data.reel || !viewer.reel?.videoElement?.isConnected)) {
        current.data.reel = reel;
        viewer.updateReel(reel);
      }
      respond({
        state: current.state,
        song: current.data.result,
        credit: current.data.credit,
        error: current.data.error,
        requestId: current.data.requestId,
        viewer: viewerState,
        media: getReelMedia(reel),
        reel: reel?.isReel
          ? { reelId: reel.reelId, shortcode: reel.shortcode, reelUrl: reel.reelUrl }
          : null
      });
    }
  });

  window.addEventListener('pagehide', () => {
    manager.cancel();
    viewer.stop();
    detector.stop();
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
