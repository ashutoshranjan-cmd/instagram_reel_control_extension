export function getPanelPlacement(rect, width, height, navRight = 80) {
  if (!rect || height < 300) return null;
  const top = Math.max(24, Math.min(rect.top + 24, height - 640));
  const rightSpace = width - 112 - rect.right - 88 - 20;
  if (rightSpace >= 220) return { position: 'fixed', left: `${rect.right + 108}px`, top: `${top}px`, width: `${Math.min(280, rightSpace)}px` };
  const leftSpace = rect.left - Math.max(navRight, 20) - 40;
  if (leftSpace >= 220) { const size = Math.min(280, leftSpace); return { position: 'fixed', left: `${rect.left - size - 20}px`, top: `${top}px`, width: `${size}px` }; }

  // On standard laptop or narrow screens where side margin is tight,
  // float reliably at the bottom center of the viewport so ReelSong is never hidden.
  const pillWidth = Math.min(360, Math.max(280, width - 48));
  return {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${pillWidth}px`,
    zIndex: 2147483640
  };
}
