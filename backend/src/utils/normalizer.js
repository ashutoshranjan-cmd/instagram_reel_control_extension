export function buildYouTubeUrl(artist, title) {
  if (!title) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent((artist ? `${artist} ${title}` : title).trim())}`;
}
function directYouTube(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
      ['youtube.com', 'www.youtube.com', 'music.youtube.com'].includes(url.hostname) && url.pathname === '/watch' ? url.searchParams.get('v') : null;
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
}
const clean = value => typeof value === 'string' ? value.trim() : '';
const notFound = () => ({ success: false, code: 'SONG_NOT_FOUND', message: 'No reliable song match found.' });
export function normalizeAudDResponse(data) {
  if (data?.status === 'error') return { success: false, code: 'PROVIDER_ERROR', message: 'The recognition provider rejected the request.' };
  if (data?.status !== 'success' || !data.result) return notFound();
  const res = data.result;
  const title = clean(res.title), artist = clean(res.artist);
  if (!title || !artist) return notFound();
  return {
    success: true, verified: true, source: 'audio_fingerprint', provider: 'audd', title, artist,
    album: res.album || null, artwork: null, confidence: null,
    links: { youtube: directYouTube(res.youtube?.link) || directYouTube(res.song_link) }, recognizedAt: Date.now()
  };
}
export function normalizeACRCloudResponse(data) {
  if (data?.status?.code !== 0) {
    if (!data || data.status?.code === 1001) return notFound();
    return { success: false, code: 'PROVIDER_ERROR', message: 'The recognition provider rejected the request.' };
  }
  const matches = data.metadata?.music;
  if (!Array.isArray(matches) || !matches.length) return notFound();
  const sorted = [...matches].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const music = sorted[0];
  const score = typeof music.score === 'number' && Number.isFinite(music.score) ? music.score : 0;
  if (score < 90 || score > 100) return { success: false, code: 'LOW_CONFIDENCE', message: 'No reliable song match found.' };
  const title = clean(music.title);
  const artist = Array.isArray(music.artists) ? music.artists.map(a => clean(a.name)).filter(Boolean).join(', ') : '';
  if (!title || !artist) return notFound();
  const second = sorted[1];
  if (second && Number(second.score) >= score - 3 && clean(second.title).toLowerCase() !== title.toLowerCase()) {
    return { success: false, code: 'LOW_CONFIDENCE', message: 'The audio matched multiple songs; no reliable match found.' };
  }
  return { success: true, verified: true, source: 'audio_fingerprint', provider: 'acrcloud', title, artist,
    album: music.album?.name || null, artwork: null, confidence: score / 100,
    links: { youtube: directYouTube(`https://www.youtube.com/watch?v=${music.external_metadata?.youtube?.vid}`) }, recognizedAt: Date.now() };
}
