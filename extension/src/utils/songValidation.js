export function isVerifiedSong(song) {
  return song?.verified === true && song.source === 'audio_fingerprint' &&
    ['audd', 'acrcloud'].includes(song.provider) && typeof song.title === 'string' && song.title.trim().length > 1 &&
    typeof song.artist === 'string' && song.artist.trim().length > 1 && song.artist !== 'Unknown Artist' &&
    !/^audio is (playing|muted)$/i.test(song.title);
}
