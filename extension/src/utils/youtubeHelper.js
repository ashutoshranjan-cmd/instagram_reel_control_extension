/** Only provider-supplied video IDs are treated as playable matches. */
export function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    let id;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (['www.youtube.com', 'youtube.com', 'music.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
export function buildYouTubeSearchUrl(artist, title) {
  if (!title) return null;
  const query = artist && artist !== 'Unknown Artist' ? `${artist} ${title}` : title;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}
export function getSongYouTubeUrl(song) {
  const id = getYouTubeVideoId(song?.links?.youtube);
  return id ? `https://www.youtube.com/watch?v=${id}&autoplay=1` : null;
}
