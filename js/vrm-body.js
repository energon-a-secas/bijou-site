// ── Whole-body dynamics: carry, toss, land, hop, twirl ───────
// The rig around vrm.scene:
//   root (moves, spins) > lean (pivots at the hips) > squash (scales about the feet) > vrm.scene
// hold/move/release carry and toss her; hop and land bounce her; every one
// of those motions makes the springs swing (js/vrm-physics.js). Lean, tilt,
// squash and the twirl are exact damped springs (js/spring-damper.js), and
// flight is solved in closed form with each landing and wall bounce handled
// at its own moment inside the frame, so the same hop draws the same curves
// at 30, 60 or 120 frames a second.

import * as T from './vendor/avatar-engine.js';
import { spring, advance, kick } from './spring-damper.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const G = 9.8;
const TURN = Math.PI * 2;

/**
 * Frequency (Hz) and damping ratio of each channel. Squash rings briefly
 * after a landing; lean swings like a pendulum under the grip and in
 * flight; tilt is the wobble after a poke; the twirl is critically damped,
 * so it eases into a whole turn and never swings back.
 */
export const BODY_SPRINGS = {
  squash: { hz: 2.5, ratio: 0.4 },
  lean: { hz: 1.3, ratio: 0.6 },
  tilt: { hz: 1.5, ratio: 0.4 },
  spin: { hz: 0.51, ratio: 1 },
};

// How far each event squashes or stretches her, as a share of her height:
// a landing 2.7 percent per m/s of impact, capped at 8 (a 2.4 m/s hop lands
// at about 6.5); the hop's stretch; a poke at strength 1.
const SQUASH = { perImpact: 0.027, max: 0.08, hop: 0.05, poke: 0.06 };

export function createBody(vrm, opts = {}) {
  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  const hipsY = hips ? hips.getWorldPosition(new T.Vector3()).y : 0.9;
  const root = new T.Group();
  const lean = new T.Group();
  const squash = new T.Group();
  lean.position.y = hipsY;
  squash.position.y = -hipsY;
  root.add(lean); lean.add(squash); squash.add(vrm.scene);

  // opts.springs overrides a channel's hz or ratio; a value that is not a finite number is ignored.
  const tune = (k) => {
    const out = { ...BODY_SPRINGS[k] };
    for (const f of ['hz', 'ratio']) if (Number.isFinite(opts.springs?.[k]?.[f])) out[f] = opts.springs[k][f];
    return out;
  };
  const sp = { squash: spring(tune('squash'), 1), lean: spring(tune('lean')), tilt: spring(tune('tilt')), spin: spring(tune('spin')) };
  let spinning = false;

  const st = {
    held: false, grip: new T.Vector3(), target: new T.Vector3(), vel: new T.Vector3(), prev: new T.Vector3(), airborne: false,
    bounds: opts.bounds || { minX: -1.4, maxX: 1.4, maxY: 1.6 }, onLand: opts.onLand || null, reduced: false,
    /** The four channels, { hz, ratio, x, v, goal } each; tune hz and ratio live. */
    springs: sp,
    // The earlier integrator's fields, kept as views of the springs.
    get s() { return clamp(sp.squash.x, 0.92, 1.07); }, set s(v) { sp.squash.x = v; },
    get sV() { return sp.squash.v; }, set sV(v) { sp.squash.v = v; },
    get lean() { return sp.lean.x; }, set lean(v) { sp.lean.x = v; },
    get leanV() { return sp.lean.v; }, set leanV(v) { sp.lean.v = v; },
    get tilt() { return sp.tilt.x; }, set tilt(v) { sp.tilt.x = v; },
    get tiltV() { return sp.tilt.v; }, set tiltV(v) { sp.tilt.v = v; },
    get spin() { return sp.spin.x - sp.spin.goal; }, set spin(v) { sp.spin.x = sp.spin.goal + v; spinning = true; },
    get spinV() { return sp.spin.v; }, set spinV(v) { sp.spin.v = v; spinning = true; },
  };

  function hold(point) {
    st.held = true;
    st.grip.copy(point).sub(root.position);
    st.target.copy(point);
    st.airborne = true;
  }
  function move(point) { if (st.held) st.target.copy(point); }
  function release() {
    if (!st.held) return;
    st.held = false;
    st.vel.clampLength(0, 6);
  }
  function hop(power = 2.4) {
    if (st.held || st.airborne || !Number.isFinite(power)) return false;
    const k = st.reduced ? 0.5 : 1;
    st.vel.y = power * k;
    kick(sp.squash, SQUASH.hop * k);
    st.airborne = true;
    return true;
  }
  /** A twirl of `turns` whole turns (negative turns the other way), easing to a stop facing front. */
  function spin(turns = 1) {
    if (!Number.isFinite(turns)) return;
    const s = sp.spin;
    s.goal += turns * TURN;
    // From rest this follows exactly the old exponential ease into a whole turn.
    s.v += turns * TURN * 2 * Math.PI * s.hz * s.ratio;
    spinning = true;
  }
  function poke(strength = 1) {
    if (!Number.isFinite(strength)) return;
    kick(sp.squash, -SQUASH.poke * strength);
    sp.tilt.v += (Math.random() - 0.5) * 3 * strength;
  }

  // ── Flight in closed form ──────────────────────────────────
  /** Seconds until the next landing or wall contact on the current arc. */
  function untilContact() {
    const p = root.position, v = st.vel, b = st.bounds;
    // The later root of y + vy t - g t^2 / 2 = 0.
    let t = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * G * Math.max(0, p.y)))) / G;
    if (v.x > 0) t = Math.min(t, Math.max(0, (b.maxX - p.x) / v.x));
    if (v.x < 0) t = Math.min(t, Math.max(0, (b.minX - p.x) / v.x));
    return t;
  }
  function fly(h) {
    const p = root.position, v = st.vel;
    p.x += v.x * h; p.z += v.z * h;
    p.y += v.y * h - 0.5 * G * h * h;
    v.y -= G * h;
  }
  /** Walls and floor, at the moment of contact. */
  function contact() {
    const p = root.position, v = st.vel, b = st.bounds;
    if ((p.x <= b.minX + 1e-9 && v.x < 0) || (p.x >= b.maxX - 1e-9 && v.x > 0)) { p.x = clamp(p.x, b.minX, b.maxX); v.x *= -0.4; }
    if (p.y > 1e-9 || v.y > 0) return;
    p.y = 0;
    const impact = -v.y;
    kick(sp.squash, -Math.min(SQUASH.max, SQUASH.perImpact * impact) * (st.reduced ? 0.4 : 1));
    if (impact > 1.2) v.y = impact * 0.28;
    else { v.set(0, 0, 0); st.airborne = false; }
    v.x *= 0.5;
    if (impact > 0.4) st.onLand?.(impact);
  }

  /** Every channel moves h seconds toward its goal; lean leans against the flight. */
  function settle(h) {
    sp.lean.goal = st.airborne ? clamp(-st.vel.x * 0.11, -0.55, 0.55) : 0;
    advance(sp.squash, h); advance(sp.lean, h); advance(sp.tilt, h);
    if (spinning) advance(sp.spin, h);
  }

  // A hitch longer than 0.1 s pauses her rather than teleporting her; a frame time that is not a number moves nothing.
  function update(dt) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    const p = root.position;
    st.prev.copy(p);
    if (st.held) {
      const want = st.target.clone().sub(st.grip);
      want.x = clamp(want.x, st.bounds.minX, st.bounds.maxX);
      want.y = clamp(want.y, 0, st.bounds.maxY);
      p.lerp(want, 1 - Math.exp(-dt * 18));
      st.vel.copy(p).sub(st.prev).divideScalar(Math.max(dt, 1e-3));
      settle(dt);
    } else {
      // Split the frame at each contact, so a landing happens at its own time, not the frame's.
      let left = dt;
      for (let i = 0; i < 12 && left > 0; i++) {
        const h = st.airborne ? Math.min(left, untilContact()) : left;
        if (st.airborne) fly(h);
        settle(h);
        left -= h;
        if (st.airborne) contact();
      }
    }
    // Lean pivots at the hips; squash scales about the feet, volume roughly preserved.
    lean.rotation.z = sp.lean.x + sp.tilt.x * 0.12;
    const s = st.s, w = 1 / Math.sqrt(s);
    squash.scale.set(w, s, w);
    // The twirl writes the root's rotation only while it turns, so a host
    // that places the root itself keeps its own.
    if (spinning) {
      const off = sp.spin.x - sp.spin.goal;
      if (Math.abs(off) < 1e-5 && Math.abs(sp.spin.v) < 1e-4) {
        sp.spin.x = sp.spin.goal = sp.spin.v = 0;
        spinning = false;
      }
      root.rotation.y = spinning ? off : 0;
    }
  }

  return {
    root, hold, move, release, hop, spin, poke, update,
    get state() { return st; },
    get hipsY() { return hipsY; },
  };
}
