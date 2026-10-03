// ── Motion ───────────────────────────────────────────────────
// The animation loop. Blends toward the target pose, then adds procedural
// layers that never write into the pose: breath, sway, look-at, springs on hair
// and skirt, drag and fall physics, and the twirl, hop and landing actions.

import { POSES, resolvePose } from './poses.js';
import { worldAngle } from './rig.js';
import { prefersReducedMotion } from './neorgon-dom.js';

const SPRINGS = {
  tailL: { k: 55, c: 5.5, kf: 0.32, gain: 0.85, base: 3 },
  tailR: { k: 55, c: 5.5, kf: 0.32, gain: 0.85, base: -3 },
  tailC: { k: 48, c: 5, kf: 0.34, gain: 0.8, base: 2 },
  hairBack: { k: 90, c: 11, kf: 0.12, gain: 0.7, base: 0 },
  ahoge: { k: 160, c: 6, kf: 0.25, gain: 0.15, base: 0 },
  skirt: { k: 120, c: 10, kf: 0.05, gain: 0, base: 0, root: true },
};
const SIDE = { tailL: -1, tailR: 1 };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);

export function createMotion(doll, hooks = {}) {
  const S = {
    pose: POSES.stand, target: null, cur: null, t: 0, last: 0, host: window, raf: 0,
    rootX: 0, dragY: 0, yaw: 0, pitch: 0, eyeX: 0, eyeY: 0, pointer: null, pointerAt: 0,
    springs: Object.fromEntries(Object.keys(SPRINGS).map((k) => [k, { r: 0, v: 0 }])),
    lean: { r: 0, v: 0 }, prev: null, prevV: { x: 0, y: 0 }, prevRootX: 0,
    action: null, drag: null, fall: null, blink: { next: 2.4, step: 0, at: 0 },
    reduced: prefersReducedMotion(), asleep: false,
  };

  function retarget() {
    if (!doll.M) return;
    S.target = resolvePose(doll.M, S.pose, { holding: !!doll.flags.held });
    if (!S.cur) S.cur = JSON.parse(JSON.stringify(S.target));
    doll.setPoseLook({ hands: S.pose.hands, bands: S.pose.band });
    doll.setProp(S.pose.prop, S.rootX);
  }

  function setPose(id) {
    const p = POSES[id];
    if (!p) return;
    S.pose = p;
    retarget();
  }

  /** twirl | hop | land */
  function play(kind) {
    if (S.action && S.action.kind !== 'land') return false;
    const dur = { twirl: 1.05, hop: 0.55, land: 0.32 }[kind] || 0.5;
    S.action = { kind, t0: S.t, dur };
    if (kind === 'twirl') {
      S.springs.tailL.v += 260; S.springs.tailR.v -= 260; S.springs.skirt.v += 40;
    }
    if (kind === 'hop') S.springs.ahoge.v += 300;
    return true;
  }

  function poke(strength = 1) {
    S.springs.ahoge.v += 420 * strength;
    S.springs.tailL.v += 80 * strength; S.springs.tailR.v -= 80 * strength;
  }

  // ── Drag ─────────────────────────────────────────────────
  function startDrag(pt) {
    S.drag = { offX: pt.x - S.rootX, offY: pt.y - S.dragY, x: S.rootX, y: S.dragY, vx: 0, vy: 0, px: pt.x, py: pt.y };
    S.fall = null;
  }
  function moveDrag(pt) { if (S.drag) { S.drag.px = pt.x; S.drag.py = pt.y; } }
  function endDrag() {
    if (!S.drag) return;
    S.fall = { vy: clamp(S.drag.vy, -900, 900) };
    S.drag = null;
  }

  function setPointer(pt) { S.pointer = pt; if (pt) S.pointerAt = S.t; }

  // ── The tick ─────────────────────────────────────────────
  function frameFor(dt) {
    const reduce = S.reduced ? 0.3 : 1;
    const t = S.t;
    const k = ease(dt, S.drag ? 12 : 7);
    for (const [name, tg] of Object.entries(S.target.bones)) {
      const c = S.cur.bones[name] || (S.cur.bones[name] = { a: 0, sx: 1, sy: 1 });
      c.a += ((tg.a || 0) - (c.a || 0)) * k;
      c.sx = (c.sx ?? 1) + ((tg.sx ?? 1) - (c.sx ?? 1)) * k;
      c.sy = (c.sy ?? 1) + ((tg.sy ?? 1) - (c.sy ?? 1)) * k;
    }
    S.cur.rootY += (S.target.rootY - S.cur.rootY) * k;

    const add = S.pose.loop && !S.reduced ? S.pose.loop(t) : {};
    const bones = {};
    for (const [name, c] of Object.entries(S.cur.bones)) {
      bones[name] = { a: c.a + (add[name] || 0), sx: c.sx, sy: c.sy };
    }
    const seated = !!S.pose.prop;
    const breath = Math.sin((t * Math.PI * 2) / 3.8);
    bones.spine.sy = (bones.spine.sy || 1) * (1 + 0.007 * breath * reduce);
    bones.upperArmL.a += 0.8 * breath * reduce;
    bones.upperArmR.a += 0.8 * breath * reduce;
    bones.root.a += (seated ? 0 : 0.7 * Math.sin(t * 0.55) * reduce) + S.lean.r;
    bones.head.a += 1.4 * Math.sin(t * 0.37 + 1) * reduce + S.yaw * 3;

    for (const [name, sp] of Object.entries(S.springs)) {
      const side = SIDE[name];
      bones[name] = bones[name] || { a: 0, sx: 1, sy: 1 };
      if (name === 'skirt') bones.skirt.a += sp.r;
      else bones[name].a = side ? -side * sp.r : sp.r;
    }

    let rootY = S.cur.rootY + S.dragY + (add.rootY || 0);
    let sx = 1, sy = 1;
    if (S.action) {
      const p = clamp((t - S.action.t0) / S.action.dur, 0, 1);
      if (S.action.kind === 'twirl') {
        if (S.reduced) rootY -= 14 * Math.sin(Math.PI * p);
        else {
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          sx = Math.cos(Math.PI * 2 * e);
          bones.skirt.sx = (bones.skirt.sx || 1) * (1 + 0.24 * Math.sin(Math.PI * p));
        }
      } else if (S.action.kind === 'hop') {
        rootY -= (S.reduced ? 12 : 38) * Math.sin(Math.PI * p);
      } else if (S.action.kind === 'land') {
        sy = 1 - 0.07 * Math.sin(Math.PI * p) * reduce;
        sx = 1 + 0.04 * Math.sin(Math.PI * p) * reduce;
      }
      if (p >= 1) { const done = S.action.kind; S.action = null; hooks.onAction?.(done); }
    }
    return { bones, root: { x: S.rootX, y: rootY, sx, sy } };
  }

  function physics(dt, mats) {
    // Drag follows the pointer; a release falls under gravity and lands.
    const bounds = hooks.bounds?.() || { minX: -150, maxX: 150 };
    if (S.drag) {
      const d = S.drag;
      const nx = clamp(d.px - d.offX, bounds.minX, bounds.maxX);
      const ny = Math.min(0, d.py - d.offY);
      const kx = ease(dt, 18);
      const ox = S.rootX, oy = S.dragY;
      S.rootX += (nx - S.rootX) * kx;
      S.dragY += (ny - S.dragY) * kx;
      d.vx = (S.rootX - ox) / dt; d.vy = (S.dragY - oy) / dt;
    } else if (S.fall) {
      S.fall.vy += 2600 * dt;
      S.dragY += S.fall.vy * dt;
      if (S.dragY >= 0) {
        S.dragY = 0; S.fall = null;
        play('land');
        hooks.onLand?.();
      }
    }
    const vx = (S.rootX - S.prevRootX) / Math.max(dt, 1e-3);
    S.prevRootX = S.rootX;
    const leanTarget = S.drag ? clamp(vx * 0.03, -24, 24) : 0;
    S.lean.v += (90 * (leanTarget - S.lean.r) - 9 * S.lean.v) * dt;
    S.lean.r += S.lean.v * dt;

    // Hair and skirt hang under gravity and lag behind the head's motion.
    const hp = { x: mats.head[4], y: mats.head[5] };
    const ha = worldAngle(mats.head);
    const v = S.prev ? { x: (hp.x - S.prev.x) / dt, y: (hp.y - S.prev.y) / dt } : { x: 0, y: 0 };
    const ax = clamp((v.x - S.prevV.x) / dt, -6000, 6000);
    S.prev = hp; S.prevV = v;
    const rootAx = ax;
    for (const [name, cfg] of Object.entries(SPRINGS)) {
      const sp = S.springs[name];
      const target = cfg.root ? 0 : -ha * cfg.gain + cfg.base;
      const force = (cfg.root ? rootAx : ax) * cfg.kf;
      sp.v += (cfg.k * (target - sp.r) - cfg.c * sp.v + force) * dt;
      sp.r = clamp(sp.r + sp.v * dt, -70, 70);
    }
  }

  function look(dt) {
    const head = doll.worldOf('head', 200, 196);
    let yawT = 0, pitchT = 0, ex = 0, ey = 0;
    const fixed = S.pose.look;
    const fresh = S.pointer && S.t - S.pointerAt < 6;
    if (S.asleep) { /* eyes are shut, head settles */ } else if (fixed) {
      [ex, ey] = fixed; yawT = ex * 0.4; pitchT = ey * 0.5;
    } else if (fresh) {
      const dx = S.pointer.x - head.x, dy = S.pointer.y - head.y;
      yawT = clamp(dx / 260, -1, 1); pitchT = clamp(dy / 320, -0.8, 0.8);
      ex = clamp(dx / 140, -1, 1); ey = clamp(dy / 170, -1, 1);
    } else {
      yawT = 0.35 * Math.sin(S.t * 0.23); ex = yawT * 1.2; ey = 0.15 * Math.sin(S.t * 0.31);
    }
    S.yaw += (yawT - S.yaw) * ease(dt, 4);
    S.pitch += (pitchT - S.pitch) * ease(dt, 4);
    S.eyeX += (ex - S.eyeX) * ease(dt, 11);
    S.eyeY += (ey - S.eyeY) * ease(dt, 11);
  }

  function blink() {
    const b = S.blink;
    if (S.asleep) { doll.svg.dataset.blink = '0'; return; }
    if (b.step === 0 && S.t >= b.next) { b.step = 1; b.at = S.t; }
    if (b.step) {
      const e = S.t - b.at;
      const frame = e < 0.045 ? 1 : e < 0.12 ? 2 : e < 0.165 ? 1 : 0;
      doll.svg.dataset.blink = String(frame);
      if (frame === 0 && e >= 0.165) {
        b.step = 0;
        b.next = S.t + (Math.random() < 0.18 ? 0.25 : 2.2 + Math.random() * 3.6);
      }
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, S.last ? (now - S.last) / 1000 : 1 / 60);
    S.last = now;
    S.t += dt;
    if (S.target) {
      look(dt);
      const frame = frameFor(dt);
      const mats = doll.render(frame, { yaw: S.yaw, pitch: S.pitch, look: { x: S.eyeX, y: S.eyeY }, seatY: 0 });
      if (mats) physics(dt, mats);
      blink();
      hooks.onFrame?.(mats, S);
    }
    S.raf = S.host.requestAnimationFrame(tick);
  }

  function start() { if (!S.raf) S.raf = S.host.requestAnimationFrame(tick); }

  /** Move the loop to another window (the companion pop-out has its own rAF). */
  function setHost(win) {
    if (S.raf) S.host.cancelAnimationFrame(S.raf);
    S.host = win; S.last = 0; S.raf = 0;
    start();
  }

  return {
    start, setHost, setPose, retarget, play, poke, startDrag, moveDrag, endDrag, setPointer,
    get pose() { return S.pose; }, get busy() { return !!(S.action || S.drag || S.fall); },
    get dragging() { return !!S.drag; }, get rootX() { return S.rootX; },
    set rootX(x) { S.rootX = x; doll.setProp(S.pose.prop, x); },
    set asleep(v) { S.asleep = v; }, get t() { return S.t; },
  };
}
