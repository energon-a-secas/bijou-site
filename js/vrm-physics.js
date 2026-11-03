// ── VRM physics: springs, wind and whole-body dynamics ───────
// Springs are the model's own (VRMC_springBone or VRM 0.x secondary
// animation), stepped at a fixed rate so a slow frame, a background tab or
// the pop-out window cannot change how far hair swings or make it explode.
// Whole-body dynamics (js/vrm-body.js) move the avatar through world space
// (carried, tossed, landing, hopping, spinning); the springs react to that
// motion by themselves, which is where most of the visible life comes from.

import * as T from './vendor/avatar-engine.js';

export { createBody, BODY_SPRINGS } from './vrm-body.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const STEP = 1 / 60;

export const PRESETS = {
  calm: { label: 'Calm', stiffness: 1.4, gravity: 1, drag: 1.4, heft: 0 },
  natural: { label: 'Natural', stiffness: 1, gravity: 1, drag: 1, heft: 0 },
  bouncy: { label: 'Bouncy', stiffness: 0.62, gravity: 1.1, drag: 0.6, heft: 0.08 },
  floaty: { label: 'Floaty', stiffness: 0.45, gravity: 0.4, drag: 0.42, heft: 0 },
};

// Springs on body regions are capped at a modest motion (stiffness at
// least BODY_MIN.stiffness, drag at least BODY_MIN.drag, whatever the file
// authored) and presets never loosen them: hair, skirts, sleeves and
// accessories carry the jiggle. Bounce scales body motion from still (0)
// to that cap (1), and touch impulses and variation skip the body entirely.
const BODY = /bust|breast|chest|belly|butt|thigh/i;
const BODY_MIN = { stiffness: 1, drag: 0.35 };
// Every other joint keeps at least this drag after presets, sliders and
// variation: pixiv's skirt drag (0.05) under Bouncy (x0.6) would be 0.03,
// which swings eight times over two seconds after a hop: jelly.
export const DRAG_FLOOR = 0.12;
const _v = new T.Vector3();
const _q = new T.Quaternion();
const _p = new T.Vector3();
// Each joint's authored values, kept from the first time any controller
// sees it: a controller rebuilt after an accessory change must start from
// the file's values, not from the floored and varied ones it inherits.
const AUTHORED = new WeakMap();
function authored(j) {
  if (!AUTHORED.has(j)) {
    const s = j.settings;
    AUTHORED.set(j, { stiffness: s.stiffness, gravityPower: s.gravityPower, dragForce: s.dragForce, gravityDir: s.gravityDir.clone() });
  }
  return AUTHORED.get(j);
}

/** A stable number in [-1, 1) from a string (FNV-1a, then a final mix). */
function unit(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 2 ** 31 - 1;
}

/**
 * Per-chain variation. A chain is a root joint and the joints hanging from
 * it. Each chain gets its own stiffness and drag factors from its root
 * bone's name, so strands differ from each other but are the same on every
 * load, refresh and preset; nothing here is random per frame. `along` runs
 * 0 at the root to 1 at the tip of chains of three joints or more, unless
 * the file already graded their stiffness.
 */
function chainUp(records) {
  const byBone = new Map(records.map((x) => [x.j.bone, x]));
  const chains = new Map();
  for (const x of records) {
    let top = x.j.bone, depth = 0;
    while (top.parent && byBone.has(top.parent)) { top = top.parent; depth++; }
    x.depth = depth;
    if (!chains.has(top)) chains.set(top, []);
    chains.get(top).push(x);
  }
  for (const [top, chain] of chains) {
    const key = top.name || top.position.toArray().map((n) => n.toFixed(3)).join(',');
    const len = Math.max(...chain.map((x) => x.depth)) + 1;
    const even = chain.every((x) => Math.abs(x.base.stiffness - chain[0].base.stiffness) < 1e-6);
    for (const x of chain) {
      x.vk = unit(`${key}|stiffness`);
      x.vd = unit(`${key}|drag`);
      x.along = len >= 3 && even ? x.depth / (len - 1) : null;
    }
  }
}

/**
 * Spring control for one VRM. With opts.root (the body rig's root), every
 * joint simulates in a proxy center space that follows part of the root's
 * travel: `inertia` is the share of carrying and tossing the springs feel
 * (0 none, 1 all of it); spins are always felt in full. The motion of the
 * root and of the rig groups under it (lean, squash) is also spread across
 * the fixed substeps, so a 30 Hz frame does not kick twice as hard as a
 * 60 Hz one.
 *
 * State, through set(): stiffness, gravity, drag, heft (presets); wind;
 * bounce (body springs, 0 still to 1 capped); inertia; vary (each chain's
 * stiffness and drag spread, 0 to 0.15); taper (root over tip stiffness on
 * long chains, 1 for even); reduced.
 */
export function createSprings(vrm, opts = {}) {
  const mgr = vrm.springBoneManager || null;
  const root = opts.root || null;
  const proxy = root ? new T.Object3D() : null;
  // The rig from the root down to the model: root, lean, squash.
  const rig = [];
  if (root) {
    for (let o = vrm.scene.parent; o; o = o === root ? null : o.parent) rig.unshift(o);
    if (rig[0] !== root) rig.splice(0, rig.length, root);
  }
  const frames = rig.map((o) => ({
    o, p0: new T.Vector3(), q0: new T.Quaternion(), s0: new T.Vector3(),
    p1: new T.Vector3(), q1: new T.Quaternion(), s1: new T.Vector3(), e1: new T.Euler(),
  }));
  let started = false;
  // Authored values are captured once per joint, so joints added later
  // (runtime accessories) join the presets through refresh().
  let joints = [];
  function scan() {
    const known = new Map(joints.map((x) => [x.j, x]));
    joints = mgr ? [...mgr.joints].map((j) => known.get(j) || {
      j,
      body: BODY.test(j.bone.name),
      base: authored(j),
    }) : [];
    chainUp(joints);
    if (proxy) {
      // Re-express only the joints that change space; the rest keep swinging.
      proxy.updateMatrixWorld(true);
      for (const { j } of joints) if (j.center !== proxy) { j.center = proxy; j.reset(); }
    }
  }
  function placeProxy() {
    root.getWorldPosition(proxy.position);
    (proxy.userData.last ||= new T.Vector3()).copy(proxy.position);
    proxy.updateMatrixWorld(true);
  }
  if (proxy) placeProxy();
  scan();
  const st = {
    enabled: true, stiffness: 1, gravity: 1, drag: 1, heft: 0, bounce: 1, inertia: 0.4, reduced: false,
    vary: 0.12, taper: 1.5,
    wind: 0, windDir: new T.Vector3(1, 0, 0.35).normalize(), t: 0, acc: 0, resets: 0,
  };
  const g = new T.Vector3();

  function settle(windNow) {
    const bounce = clamp(st.bounce, 0, 1);
    const vary = clamp(st.vary, 0, 0.15), taper = Math.max(1, st.taper);
    for (const x of joints) {
      const { j, body, base } = x, s = j.settings;
      if (body) {
        const drag = clamp(Math.max(base.dragForce, BODY_MIN.drag) * Math.max(1, st.drag), 0, 1);
        // Stiffness rises steeply as bounce falls, so the swing scales about linearly.
        s.stiffness = Math.max(base.stiffness, BODY_MIN.stiffness) * Math.max(1, st.stiffness) * (1 + 6 * (1 / Math.max(bounce, 0.02) - 1));
        s.dragForce = drag + (1 - drag) * (1 - bounce);
      } else {
        // Root over tip is `taper`, keeping the chain's mean stiffness.
        const grade = x.along == null ? 1 : 2 * (taper - (taper - 1) * x.along) / (1 + taper);
        s.stiffness = base.stiffness * st.stiffness * (1 + vary * x.vk) * grade;
        s.dragForce = clamp(Math.max(DRAG_FLOOR, base.dragForce * st.drag * (1 + vary * x.vd)), 0, 1);
      }
      g.copy(base.gravityDir).multiplyScalar(base.gravityPower * (body ? 1 : st.gravity));
      if (!body) g.y -= st.heft;
      if (!body && windNow) g.addScaledVector(st.windDir, windNow);
      const len = g.length();
      s.gravityPower = len;
      if (len > 1e-6) s.gravityDir.copy(g).divideScalar(len);
      else s.gravityDir.copy(base.gravityDir);
    }
  }

  function gust(t) {
    if (!st.wind) return 0;
    return st.wind * (0.55 + 0.3 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.7 + 1.1));
  }

  function recover() {
    root?.updateMatrixWorld(true);
    if (proxy) placeProxy();
    mgr.reset();
    started = false;
    st.resets++;
  }

  /** Advance springs by dt seconds in fixed steps. */
  function step(dt) {
    if (!mgr || !st.enabled || st.reduced) return;
    if (dt > 0.25) { recover(); st.acc = 0; return; }
    for (const f of frames) {
      f.p1.copy(f.o.position); f.q1.copy(f.o.quaternion); f.s1.copy(f.o.scale); f.e1.copy(f.o.rotation);
      if (!started) { f.p0.copy(f.p1); f.q0.copy(f.q1); f.s0.copy(f.s1); }
    }
    started = true;
    st.acc += dt;
    const n = Math.min(5, Math.floor(st.acc / STEP));
    for (let i = 1; i <= n; i++) {
      st.t += STEP;
      if (st.wind) settle(gust(st.t));
      if (root) {
        // Place the rig part of the way through this frame's motion.
        const a = i / n;
        for (const f of frames) {
          f.o.position.lerpVectors(f.p0, f.p1, a);
          f.o.quaternion.slerpQuaternions(f.q0, f.q1, a);
          f.o.scale.lerpVectors(f.s0, f.s1, a);
        }
        root.updateMatrixWorld(true);
        if (proxy) {
          root.getWorldPosition(_p);
          _v.copy(_p).sub(proxy.userData.last || _p);
          // A jump this large is a teleport or re-centre: the springs should not feel it.
          const share = _v.length() > 0.45 ? 1 : 1 - clamp(st.inertia, 0, 1);
          proxy.position.addScaledVector(_v, share);
          proxy.updateMatrixWorld(true);
          (proxy.userData.last ||= new T.Vector3()).copy(_p);
        }
      }
      mgr.update(STEP);
    }
    st.acc = n === 5 ? 0 : st.acc - n * STEP;
    // Restore the exact Euler: three.js re-derives it from the quaternion,
    // and past 90 degrees that can read (PI, PI - y, PI), which the body
    // rig (it writes rotation.y only) would turn into a half-turn flip.
    for (const f of frames) {
      f.o.position.copy(f.p1); f.o.rotation.copy(f.e1); f.o.scale.copy(f.s1);
      if (n) { f.p0.copy(f.p1); f.q0.copy(f.q1); f.s0.copy(f.s1); }
    }
    // A tail landing exactly on a collider centre can produce NaN: recover.
    if (n && joints.length && !Number.isFinite(joints[0].j.bone.quaternion.x + joints[joints.length - 1].j.bone.quaternion.x)) recover();
  }

  function set(values) {
    const wasReduced = st.reduced;
    Object.assign(st, values);
    if (st.reduced && !wasReduced && mgr) recover();
    settle(gust(st.t));
  }
  settle(0);

  return {
    step, set, reset: () => mgr && recover(),
    preset: (name) => set(PRESETS[name] || PRESETS.natural),
    /** Pick up joints added or removed since creation, then apply the current settings. */
    refresh() { scan(); settle(gust(st.t)); },
    /**
     * Push the springs near a ray (a pointer brushing through hair) or near
     * a point (a tap) with a world-space velocity in m/s. Body springs are
     * never pushed. Returns how many joints moved.
     */
    touch({ ray = null, point = null, vel, radius = 0.1, gain = 1 }) {
      if (!mgr || !st.enabled) return 0;
      let n = 0;
      for (const { j, body } of joints) {
        if (body) continue;
        j.bone.getWorldPosition(_v);
        const d = ray ? ray.distanceToPoint(_v) : point.distanceTo(_v);
        if (d > radius) continue;
        const w = (1 - d / radius) * gain * STEP;
        _v.copy(vel).multiplyScalar(w);
        // Tails live in the joint's center space when it has one.
        if (j.center) _v.applyQuaternion(j.center.getWorldQuaternion(_q).invert());
        j._prevTail.sub(_v);
        n++;
      }
      return n;
    },
    get state() { return st; },
    get count() { return joints.length; },
    get bodyCount() { return joints.filter((x) => x.body).length; },
    /** World positions of a few joint tails, for checks and debugging. */
    sample(n = 4) {
      return joints.filter((x) => !x.body).slice(0, n).map(({ j }) => {
        const p = new T.Vector3();
        (j.child || j.bone).getWorldPosition(p);
        return [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
      });
    },
  };
}

/** One frame of VRM update with the springs stepped by the controller. */
export function stepVRM(vrm, dt, springs) {
  vrm.humanoid.update();
  vrm.lookAt?.update(dt);
  vrm.expressionManager?.update();
  vrm.nodeConstraintManager?.update();
  if (springs) springs.step(dt);
  else vrm.springBoneManager?.update(dt);
  vrm.materials?.forEach((m) => m.update?.(dt));
}
