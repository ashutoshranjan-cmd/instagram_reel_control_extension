export function isInstagramMediaUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['cdninstagram.com','fbcdn.net'].some(h => u.hostname === h || u.hostname.endsWith(`.${h}`)); } catch { return false; }
}
export function getReelMedia(reel) {
  const video = reel?.videoElement;
  if (!video) return null;
  const source = video.currentSrc || video.src;
  if (isInstagramMediaUrl(source)) return { url: source, width: video.videoWidth, height: video.videoHeight };
  if (!reel.shortcode) return null;
  let found = null, count = 0;
  function walk(value, depth = 0) {
    if (!value || found || depth > 30 || ++count > 100000) return;
    if (typeof value === 'string' && /^[{[]/.test(value)) { try { walk(JSON.parse(value), depth+1); } catch {} return; }
    if (typeof value !== 'object') return;
    if (value.shortcode === reel.shortcode || value.code === reel.shortcode) {
      const versions = (Array.isArray(value.video_versions) ? value.video_versions : []).filter(v => isInstagramMediaUrl(v.url)).sort((a,b) => b.width*b.height-a.width*a.height);
      if (versions[0]) found = { url: versions[0].url, width: versions[0].width, height: versions[0].height };
      else if (isInstagramMediaUrl(value.video_url)) found = { url: value.video_url, width: value.dimensions?.width, height: value.dimensions?.height };
    }
    if (!found) for (const v of Object.values(value)) walk(v,depth+1);
  }
  for (const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    if (script.textContent.length > 10000000 || !script.textContent.includes(reel.shortcode)) continue;
    try { walk(JSON.parse(script.textContent)); } catch {} if (found) break;
  }
  return found;
}
export function getResolutionOptions(media) {
  const short = Math.min(Number(media?.width)||0,Number(media?.height)||0);
  return [{ value:'original',label:short?`Original · ${media.width} × ${media.height}`:'Original source' },...[1080,720,480,360].filter(p=>p<short).map(p=>({value:String(p),label:`${p}p · converted`}))];
}
