// ── Desktop companion ────────────────────────────────────────
// Pop out: Document Picture-in-Picture opens a small window that stays on top
// of every other app (Chrome and Edge). The stage element itself moves into
// it, listeners and all, and the animation loop follows it to that window's
// own requestAnimationFrame, so she keeps moving while the main tab is hidden.
// Without the API: Companion view, a doll-only layout for a small window.

import { downloadBlob } from './neorgon-dom.js';

export const canPopOut = () => 'documentPictureInPicture' in window;

let pip = null;

function copyStyles(target) {
  for (const sheet of document.styleSheets) {
    try {
      const style = target.document.createElement('style');
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
      target.document.head.append(style);
    } catch {
      // A cross-origin sheet (the CDN tokens) refuses cssRules; link it instead.
      if (!sheet.href) continue;
      const link = target.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      target.document.head.append(link);
    }
  }
}

/** Returns true when she moved into a floating window. */
export async function popOut({ stage, motion, title, onHost }) {
  if (!canPopOut()) return false;
  if (pip) { pip.focus(); return true; }
  pip = await window.documentPictureInPicture.requestWindow({ width: 320, height: 520 });
  copyStyles(pip);
  pip.document.title = title;
  pip.document.body.className = 'pip-body';
  const holder = document.createComment('stage');
  stage.before(holder);
  pip.document.body.append(stage);
  motion.setHost(pip);
  onHost?.(true);
  pip.addEventListener('pagehide', () => {
    holder.replaceWith(stage);
    motion.setHost(window);
    pip = null;
    onHost?.(false);
  }, { once: true });
  return true;
}

export const inPip = () => !!pip;

export function setCompanionView(on) {
  document.body.classList.toggle('is-companion', on);
  const url = new URL(location.href);
  if (on) url.searchParams.set('view', 'companion'); else url.searchParams.delete('view');
  history.replaceState(null, '', url);
}

/**
 * Save the room and the doll as a PNG. The SVGs are serialised with the few
 * rules they need inlined (closed-eye and talking frames stay hidden), drawn
 * onto a canvas, and handed over as a download.
 */
export async function snapshot({ backdrop, doll, name }) {
  const W = 900, H = 1200;
  const ser = (svg, extra = '') => {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const vb = (svg.getAttribute('viewBox') || '0 0 400 820').split(/\s+/).map(Number);
    clone.setAttribute('width', String(vb[2]));
    clone.setAttribute('height', String(vb[3]));
    clone.removeAttribute('style');
    clone.removeAttribute('data-talk');
    clone.removeAttribute('data-blink');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `.bj-eye-half,.bj-eye-shut,.bj-mouth-talk,.bj-fx{display:none}${extra}`;
    clone.prepend(style);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  };
  const load = (src) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bg = await load(ser(backdrop));
  // The backdrop is 1000 x 820: cover the portrait canvas, anchored at the floor.
  const k = Math.max(W / 1000, H / 820);
  ctx.drawImage(bg, (W - 1000 * k) / 2, H - 820 * k, 1000 * k, 820 * k);
  const fig = await load(ser(doll));
  const dk = (H * 0.94) / 820;
  ctx.drawImage(fig, (W - 400 * dk) / 2, H - 820 * dk - H * 0.02, 400 * dk, 820 * dk);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (blob) downloadBlob(blob, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'bijou'}-${new Date().toISOString().slice(0, 10)}.png`);
  return !!blob;
}
