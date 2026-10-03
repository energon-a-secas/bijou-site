// ── Touching her ─────────────────────────────────────────────
// Pointer gestures on the doll: a tap pokes (her cheek or her body), stroking
// her head back and forth pats it, pressing and moving anywhere else picks her
// up. Moving over the stage gives her something to look at. Listeners sit on
// the stage, so the gestures keep working inside the pop-out window.

import { isHeadBone } from './rig.js';

const SLOP = 7;

export function bindDoll({ stage, doll, motion, behavior }) {
  const svg = doll.svg;
  let press = null;

  function toView(e) {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const i = m.inverse();
    return { x: i.a * e.clientX + i.c * e.clientY + i.e, y: i.b * e.clientX + i.d * e.clientY + i.f };
  }

  stage.addEventListener('pointermove', (e) => {
    const pt = toView(e);
    if (!press) { if (e.pointerType !== 'touch') motion.setPointer(pt); return; }
    if (e.pointerId !== press.id) return;
    const dx = e.clientX - press.x0, dy = e.clientY - press.y0;
    if (!press.mode && Math.hypot(dx, dy) > SLOP) {
      if (press.region === 'head' && Math.abs(dy) < 28) press.mode = 'pat';
      else {
        press.mode = 'drag';
        svg.classList.add('is-held');
        motion.startDrag(press.pt0);
        behavior.lifted();
      }
    }
    if (press.mode === 'pat') {
      const step = e.clientX - press.lastX;
      if (Math.abs(step) > 4) {
        const dir = Math.sign(step);
        if (press.dir && dir !== press.dir && ++press.turns % 2 === 0) behavior.pat();
        press.dir = dir;
        press.lastX = e.clientX;
      }
    } else if (press.mode === 'drag') {
      motion.moveDrag(pt);
    }
  });

  stage.addEventListener('pointerleave', () => { if (!press) motion.setPointer(null); });

  stage.addEventListener('pointerdown', (e) => {
    const part = e.target.closest?.('.bj-parts [data-b]');
    if (!part || e.button > 0) return;
    e.preventDefault();
    const bone = part.getAttribute('data-b');
    press = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), lastX: e.clientX, dir: 0, turns: 0,
      region: isHeadBone(bone) ? 'head' : 'body', pt0: toView(e), mode: null,
    };
    stage.setPointerCapture(e.pointerId);
  });

  function release(e, cancelled = false) {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    if (p.mode === 'drag') { svg.classList.remove('is-held'); motion.endDrag(); return; }
    if (cancelled || p.mode || performance.now() - p.t0 > 600) return;
    if (p.region === 'head') {
      // Above the eyes is a pat on the head; below them is her cheek.
      const eyes = doll.worldOf('head', 200, 206);
      if (p.pt0 && p.pt0.y < eyes.y) behavior.pat();
      else behavior.poke('cheek');
    } else behavior.poke('body');
  }
  stage.addEventListener('pointerup', (e) => release(e));
  stage.addEventListener('pointercancel', (e) => release(e, true));
}
