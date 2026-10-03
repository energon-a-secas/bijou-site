// ── Effects and speech ───────────────────────────────────────
// Floating particles and the speech bubble. Both live inside the stage, so
// they travel with it into the pop-out window. Positions come from the doll's
// last solved frame, converted from viewBox units to stage pixels.

import { heart, star } from './paint.js';

const ICON = {
  heart: `<svg viewBox="-12 -12 24 24"><path d="${heart(0, 0, 10)}" fill="#ff6f9a" stroke="#fff" stroke-width="1.6"/></svg>`,
  sparkle: `<svg viewBox="-12 -12 24 24"><path d="${star(0, 0, 11, 0.32)}" fill="#ffe08a" stroke="#fff" stroke-width="1.2"/></svg>`,
  note: '<svg viewBox="0 0 24 24"><path d="M9 18a3 3 0 1 1-2-2.8V5l11-2v11a3 3 0 1 1-2-2.8V6.4L9 7.7z" fill="#c5a3f0" stroke="#fff" stroke-width="1.2"/></svg>',
  zz: '<svg viewBox="0 0 24 24"><path d="M5 6h9L5 18h9" fill="none" stroke="#bcd4ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function createFx({ stage, layer, bubble, live, doll }) {
  let talkTimer = 0, hideTimer = 0, speaking = false;

  function toStage(pt) {
    const m = doll.svg.getScreenCTM();
    const r = stage.getBoundingClientRect();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * pt.x + m.c * pt.y + m.e - r.left, y: m.b * pt.x + m.d * pt.y + m.f - r.top };
  }

  /** n particles of a kind from a point on the head (canonical head space). */
  function burst(kind, n = 3, hx = 200, hy = 150) {
    const p = toStage(doll.worldOf('head', hx, hy));
    for (let i = 0; i < n; i++) {
      const el = stage.ownerDocument.createElement('span');
      el.className = 'fx__p';
      el.innerHTML = ICON[kind] || ICON.heart;
      el.style.left = `${p.x + (Math.random() - 0.5) * 50}px`;
      el.style.top = `${p.y + (Math.random() - 0.5) * 20}px`;
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}px`);
      el.style.setProperty('--rot', `${(Math.random() - 0.5) * 40}deg`);
      el.style.animationDelay = `${i * 0.12}s`;
      el.addEventListener('animationend', () => el.remove(), { once: true });
      layer.append(el);
    }
  }

  function stopTalk() {
    clearInterval(talkTimer);
    doll.svg.dataset.talk = '0';
  }

  /** Show a line for a while; her mouth moves while it types out. */
  function say(text, ms) {
    if (!text) return;
    const dur = ms || Math.min(4200, 1400 + text.length * 55);
    bubble.textContent = text;
    bubble.hidden = false;
    live.textContent = text;
    speaking = true;
    stopTalk();
    let on = false;
    const talkFor = Math.min(1800, text.length * 45);
    const started = performance.now();
    talkTimer = setInterval(() => {
      if (performance.now() - started > talkFor) { stopTalk(); return; }
      on = !on;
      doll.svg.dataset.talk = on ? '1' : '0';
    }, 110);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { bubble.hidden = true; speaking = false; stopTalk(); }, dur);
    place();
  }

  /** Keep the bubble above her head; called every frame. */
  function place() {
    if (!speaking) return;
    const p = toStage(doll.worldOf('head', 200, 96));
    const w = stage.clientWidth;
    const half = Math.min(bubble.offsetWidth / 2, w / 2 - 8);
    bubble.style.left = `${Math.max(half + 8, Math.min(w - half - 8, p.x))}px`;
    bubble.style.top = `${Math.max(bubble.offsetHeight + 8, p.y - 6)}px`;
  }

  return { burst, say, place, toStage, get speaking() { return speaking; } };
}
