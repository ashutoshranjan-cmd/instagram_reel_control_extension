/**
 * Shadow Host Manager for ReelSong
 * Creates and attaches an isolated Shadow DOM container
 * directly to document.documentElement to guarantee no parent transform/filter clips it.
 */

import liquidGlassStyles from '../styles/liquidGlass.css?raw';

const SHADOW_HOST_ID = 'reelsong-extension-root';

export function createShadowMount() {
  let host = document.getElementById(SHADOW_HOST_ID);

  if (!host) {
    host = document.createElement('div');
    host.id = SHADOW_HOST_ID;
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('bottom', '0px', 'important');
    host.style.setProperty('left', '0px', 'important');
    host.style.setProperty('width', '100%', 'important');
    host.style.setProperty('height', '0px', 'important');
    host.style.setProperty('overflow', 'visible', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');

    const parent = document.documentElement;
    parent.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: 'open' });
  }

  // Check if style is already injected
  let styleEl = shadow.querySelector('style[data-reelsong-style]');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-reelsong-style', 'true');
    styleEl.textContent = liquidGlassStyles;
    shadow.appendChild(styleEl);
  }

  // Create or get the react mount point
  let mountPoint = shadow.querySelector('#reelsong-mount');
  if (!mountPoint) {
    mountPoint = document.createElement('div');
    mountPoint.id = 'reelsong-mount';
    mountPoint.style.setProperty('pointer-events', 'auto', 'important');
    shadow.appendChild(mountPoint);
  }

  return { host, shadow, mountPoint };
}
