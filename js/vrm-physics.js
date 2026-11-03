// ── VRM physics: springs, wind and whole-body dynamics ───────
// Springs are the model's own (VRMC_springBone or VRM 0.x secondary
// animation), stepped at a fixed rate so a slow frame, a background tab or
// the pop-out window cannot change how far hair swings or make it explode.
// Whole-body dynamics move the avatar through world space (carried, tossed,
// landing, hopping, spinning); the springs react to that motion by
// themselves, which is where most of the visible life comes from.

import * as T from './vendor/avatar-engine.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const STEP = 1 / 60;

export const PRESETS = {
  calm: { label: 'Calm', stiffness: 1.4, gravity: 1, drag: 1.4, heft: 0 },
  natural: { label: 'Natural', stiffness: 1, gravity: 1, drag: 1, heft: 0 },
  bouncy: { label: 'Bouncy', stiffness: 0.62, gravity: 1.1, drag: 0.6, heft: 0.08 },
  floaty: { label: 'Floaty', stiffness: 0.45, gravity: 0.4, drag: 0.42, heft: 0 },
};

// Springs on body regions keep at least their authored stiffness and drag:
// presets loosen hair, skirts, sleeves and accessories, never the body.
const BODY = /bust|breast|chest|belly|butt|thigh/i;

/** Spring control for one VRM. */
export function createSprings(vrm) {
  const mgr = vrm.springBoneManager || null;
  const joints = mgr ? [...mgr.joints].map((j) => ({
    j,
    body: BODY.test(j.bone.name),
    base: { stiffness: j.settings.stiffness, gravityPower: j.settings.gravityPower, dragForce: j.settings.dragForce, gravityDir: j.settings.gravityDir.clone() },
  })) : [];
  const st = {
    enabled: true, stiffness: 1, gravity: 1, drag: 1, heft: 0,
    wind: 0, windDir: new T.Vector3(1, 0, 0.35).normalize(), t: 0, acc: 0,
  };
  const g = new T.Vector3();

  function settle(windNow) {
    for (const { j, body, base } of joints) {
      const s = j.settings;
      s.stiffness = base.stiffness * (body ? Math.max(1, st.stiffness) : st.stiffness);
      s.dragForce = clamp(base.dragForce * (body ? Math.max(1, st.drag) : st.drag), 0, 1);
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

  /** Advance springs by dt seconds in fixed steps. */
  function step(dt) {
    if (!mgr || !st.enabled) return;
    if (dt > 0.25) { mgr.reset(); st.acc = 0; return; }
    st.acc += dt;
    let n = 0;
    while (st.acc >= STEP && n < 5) {
      st.t += STEP;
      if (st.wind) settle(gust(st.t));
      mgr.update(STEP);
      st.acc -= STEP;
      n++;
    }
    if (n === 5) st.acc = 0;
  }

  function set(values) {
    Object.assign(st, values);
    settle(gust(st.t));
  }

  return {
    step, set, reset: () => mgr?.reset(),
    preset: (name) => set(PRESETS[name] || PRESETS.natural),
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

/**
 * Whole-body dynamics. Build the rig once around vrm.scene:
 *   root (moves, spins) > lean (pivots at the hips) > squash (scales about the feet) > vrm.scene
 * hold/move/release carry and toss her; hop and land bounce her; every one
 * of those motions makes the springs swing.
 */
export function createBody(vrm, opts = {}) {
  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  const hipsY = hips ? hips.getWorldPosition(new T.Vector3()).y : 0.9;
  const root = new T.Group();
  const lean = new T.Group();
  const squash = new T.Group();
  lean.position.y = hipsY;
  squash.position.y = -hipsY;
  root.add(lean); lean.add(squash); squash.add(vrm.scene);

  const st = {
    held: false, grip: new T.Vector3(), target: new T.Vector3(), vel: new T.Vector3(), prev: new T.Vector3(),
    lean: 0, leanV: 0, tilt: 0, tiltV: 0, s: 1, sV: 0, spin: 0, spinV: 0, airborne: false,
    bounds: opts.bounds || { minX: -1.4, maxX: 1.4, maxY: 1.6 }, onLand: opts.onLand || null, reduced: false,
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
    if (st.held || st.airborne) return false;
    st.vel.y = power * (st.reduced ? 0.5 : 1);
    st.sV += 2.2;
    st.airborne = true;
    return true;
  }
  function spin(turns = 1) { st.spinV += turns * Math.PI * 2 * 3.2; }
  function poke(strength = 1) { st.sV -= 1.6 * strength; st.tiltV += (Math.random() - 0.5) * 3 * strength; }

  function update(dt) {
    dt = Math.min(dt, 1 / 20);
    const p = root.position;
    st.prev.copy(p);
    if (st.held) {
      const want = st.target.clone().sub(st.grip);
      want.x = clamp(want.x, st.bounds.minX, st.bounds.maxX);
      want.y = clamp(want.y, 0, st.bounds.maxY);
      p.lerp(want, 1 - Math.exp(-dt * 18));
      st.vel.copy(p).sub(st.prev).divideScalar(Math.max(dt, 1e-3));
    } else if (st.airborne) {
      st.vel.y -= 9.8 * dt;
      p.addScaledVector(st.vel, dt);
      if (p.x < st.bounds.minX || p.x > st.bounds.maxX) { p.x = clamp(p.x, st.bounds.minX, st.bounds.maxX); st.vel.x *= -0.4; }
      if (p.y <= 0) {
        p.y = 0;
        const impact = -st.vel.y;
        st.sV -= clamp(impact * 0.9, 0, 3.2) * (st.reduced ? 0.4 : 1);
        if (impact > 1.2) st.vel.y = impact * 0.28;
        else { st.vel.set(0, 0, 0); st.airborne = false; }
        st.vel.x *= 0.5;
        if (impact > 0.4) st.onLand?.(impact);
      }
    }
    // Lean like a pendulum under the grip while carried or flying.
    const leanTarget = st.airborne ? clamp(-st.vel.x * 0.11, -0.55, 0.55) : 0;
    st.leanV += (70 * (leanTarget - st.lean) - 9 * st.leanV) * dt;
    st.lean += st.leanV * dt;
    st.tiltV += (90 * (0 - st.tilt) - 7 * st.tiltV) * dt;
    st.tilt += st.tiltV * dt;
    lean.rotation.z = st.lean + st.tilt * 0.12;
    // Squash and stretch about the feet, volume roughly preserved.
    st.sV += (160 * (1 - st.s) - 11 * st.sV) * dt;
    st.s = clamp(st.s + st.sV * dt, 0.86, 1.12);
    const w = 1 / Math.sqrt(st.s);
    squash.scale.set(w, st.s, w);
    // Spin decays smoothly to a whole turn.
    if (Math.abs(st.spinV) > 0.01) {
      st.spin += st.spinV * dt;
      st.spinV *= Math.exp(-dt * 3.2);
      root.rotation.y = st.spin;
    } else if (st.spin) {
      const whole = Math.round(st.spin / (Math.PI * 2)) * Math.PI * 2;
      st.spin += (whole - st.spin) * (1 - Math.exp(-dt * 8));
      root.rotation.y = st.spin;
      if (Math.abs(whole - st.spin) < 1e-3) { st.spin = 0; root.rotation.y = 0; }
    }
  }

  return {
    root, hold, move, release, hop, spin, poke, update,
    get state() { return st; },
    get hipsY() { return hipsY; },
  };
}
