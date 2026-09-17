import React, { useState } from 'react';
import { cleanReelUrl, reelLinksService } from '../../services/reelLinks.service.js';
export function ReelLinkControls({ reel }) {
  const [message, setMessage] = useState('');
  const url = cleanReelUrl(reel?.reelUrl);
  async function action(type) {
    try {
      if (!url) throw new Error('A permalink is not available for this reel yet.');
      if (type === 'save') { await reelLinksService.save(url); setMessage('Reel link saved locally. Find it in the popup’s Saved reels.'); }
      else if (type === 'share' && navigator.share) { await navigator.share({ title: 'Instagram reel', url }); setMessage('Reel link shared.'); }
      else { await navigator.clipboard.writeText(url); setMessage(type === 'share' ? 'Link copied — paste it to share.' : 'Reel URL copied.'); }
    } catch (e) { if (e.name !== 'AbortError') setMessage(e.message || 'Could not copy the link.'); }
  }
  return <div className="rs-reel-links"><div className="rs-link-buttons"><button className="rs-secondary" onClick={() => action('copy')} disabled={!url}>Copy URL</button><button className="rs-secondary" onClick={() => action('save')} disabled={!url}>Save link</button><button className="rs-secondary" onClick={() => action('share')} disabled={!url}>Share</button></div>{message && <p className="rs-note" role="status">{message}</p>}</div>;
}
