import React, { useState } from 'react';
import { getResolutionOptions } from '../../platform/instagram/reelMedia.js';
export function DownloadControls({ reel, media }) {
  const [resolution,setResolution] = useState('original'),[busy,setBusy] = useState(false),[status,setStatus]=useState('');
  async function download(format) {
    setBusy(true); setStatus('Preparing download…');
    try {
      const result = await chrome.runtime.sendMessage({type:'DOWNLOAD_REEL',media,format,resolution,shortcode:reel?.shortcode});
      if (!result?.success) throw new Error(result?.message||'Download failed. Please try again.');
      setStatus('Download started. Check browser downloads for progress.');
    } catch(e) { setStatus(e.message); } finally { setBusy(false); }
  }
  return <div className="rs-downloads"><label>Video resolution<select aria-label="Video resolution" value={resolution} onChange={e=>setResolution(e.target.value)} disabled={!media||busy}>{getResolutionOptions(media).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><div className="rs-download-buttons"><button className="rs-secondary" disabled={!media||busy} onClick={()=>download('mp4')}>↓ Video</button><button className="rs-secondary" disabled={!media||busy} onClick={()=>download('mp3')}>↓ MP3 audio</button></div><p className="rs-note">{media?'MP3 and smaller sizes use your local server.':'This reel has no accessible video file. Downloads are unavailable for this source.'}</p>{status&&<p className="rs-note" role="status">{status}</p>}</div>;
}
