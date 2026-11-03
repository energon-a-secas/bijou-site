// ── VRM motion: clips, idle, gestures, gaze and face ─────────
// Layers, applied every frame on the normalized humanoid, in order:
//   1. the relaxed rest pose (every bone reset, so nothing accumulates)
//   2. VRMA clips through an AnimationMixer, cross-faded
//   3. procedural idle: breathing, weight shift, small head drift
//   4. gestures authored in code (wave, twirl arms, cheer, shy, peace...)
//   5. head and neck tracking toward a look point; the eyes do the rest,
//      with small saccades so they never stare like glass
//   6. blinking, smoothed expressions, petting and talking
// Left alone for `sleepAfter` seconds she dozes off; any interaction wakes
// her. Springs are not touched here; vrm-physics.js steps them after this.

import * as T from './vendor/avatar-engine.js';
import { restPose, forwardOf, aim, boneNames } from './vrm-runtime.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const QX = new T.Quaternion(), QE = new T.Quaternion(), EU = new T.Euler();

// Character space for gesture directions: x outward (away from the body
// centre on that arm's side), y up, z forward. Converted per model. Each arm
// gesture names where the upper arm and the forearm point; the elbow's local
// rotation is solved from the two, so it holds in every arm position.
const GESTURES = {
  wave: { dur: 2.4, expr: { happy: 0.8 }, f: (m, p) => {
    m.arm('right', [0.86, 0.3, 0.2], [0.1 + 0.38 * Math.sin(p * Math.PI * 7), 1, 0.15]);
    m.head(0, 0.04, -0.12);
  } },
  cheer: { dur: 1.8, expr: { happy: 1 }, f: (m, p) => {
    const b = 0.18 * Math.sin(p * Math.PI * 6);
    m.arm('left', [0.6, 0.76, 0.15], [0.32 + b, 0.95, 0.1]);
    m.arm('right', [0.6, 0.76, 0.15], [0.32 - b, 0.95, 0.1]);
    m.head(0, -0.08, 0);
  } },
  stretch: { dur: 2.8, expr: { relaxed: 0.9 }, blink: 0.85, f: (m) => {
    m.arm('left', [0.16, 1, -0.04], [-0.2, 1, 0]);
    m.arm('right', [0.16, 1, -0.04], [-0.2, 1, 0]);
    m.spine(-0.08, 0, 0);
    m.head(0, -0.18, 0);
  } },
  shy: { dur: 3.2, expr: { happy: 0.45, relaxed: 0.4 }, f: (m) => {
    m.arm('left', [-0.08, -0.95, 0.32], [-0.75, -0.1, 0.65]);
    m.arm('right', [-0.08, -0.95, 0.32], [-0.75, -0.1, 0.65]);
    m.head(0.12, 0.2, 0.18);
  } },
  peace: { dur: 2.6, expr: { happy: 0.7 }, wink: true, f: (m) => {
    m.arm('right', [0.52, -0.33, 0.79], [0.08, 0.95, 0.22]);
    m.head(-0.1, 0, -0.16);
  } },
  think: { dur: 3, expr: { neutral: 0.3 }, f: (m) => {
    m.arm('right', [0.22, -0.62, 0.75], [-0.55, 0.72, 0.42]);
    m.head(0.12, -0.08, 0.14);
  } },
  nod: { dur: 1.4, expr: { happy: 0.5 }, f: (m, p) => { m.head(0, 0.22 * Math.sin(p * Math.PI * 4), 0); } },
  tilt: { dur: 2, expr: { happy: 0.6 }, f: (m) => { m.head(0.1, 0.05, 0.3); } },
  spin: { dur: 1.2, expr: { happy: 0.9 }, f: (m) => {
    m.arm('left', [0.97, 0.05, 0.1], [0.97, 0.12, 0.1]);
    m.arm('right', [0.97, 0.05, 0.1], [0.97, 0.12, 0.1]);
  } },
  dangle: { dur: Infinity, expr: { surprised: 0.8 }, f: (m, p, t) => {
    const k = 0.18 * Math.sin(t * 5);
    m.arm('left', [0.75, 0.45 + k, 0.15], [0.55, 0.82, 0.12]);
    m.arm('right', [0.75, 0.45 - k, 0.15], [0.55, 0.82, 0.12]);
    m.leg('left', 0.25 + k, 0.4); m.leg('right', 0.25 - k, 0.4);
  } },
};

export const GESTURE_NAMES = Object.keys(GESTURES).filter((k) => k !== 'dangle');

export function createMotion(vrm, opts = {}) {
  const fwd = forwardOf(vrm);
  const names = boneNames(vrm);
  const node = Object.fromEntries(names.map((n) => [n, vrm.humanoid.getNormalizedBoneNode(n)]));
  const rest = restPose(vrm);
  const base = Object.fromEntries(names.map((n) => [n, (rest[n] || new T.Quaternion()).clone()]));
  const hipsRest = node.hips.position.clone();
  const side = {};
  for (const L of ['left', 'right']) side[L] = node[`${L}LowerArm`] && node[`${L}LowerArm`].position.x < 0 ? -1 : 1;

  const mixer = new T.AnimationMixer(vrm.scene);
  const clips = new Map();
  let action = null;
  if (vrm.lookAt) {
    const proxy = new T.VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'lookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }

  const lookTarget = new T.Object3D();
  if (vrm.lookAt) vrm.lookAt.target = lookTarget;
  const exprNames = vrm.expressionManager ? Object.keys(vrm.expressionManager.expressionMap) : [];
  // Custom VRM 0.x expressions keep their author's spelling ('Surprised'), so match case-insensitively.
  const byLower = new Map(exprNames.map((n) => [n.toLowerCase(), n]));
  const has = (n) => byLower.has(n.toLowerCase());
  const real = (n) => byLower.get(n.toLowerCase()) || n;
  const st = {
    t: 0, idle: 1, reduced: !!opts.reduced, follow: true, yaw: 0, pitch: 0,
    gestures: [], mood: {}, cur: {}, blinkAt: 2 + Math.random() * 2, blinkT: -1, blinkOn: true,
    talkUntil: 0, wink: 0, held: false,
    look: new T.Vector3(0, 1.4, 2), sacc: new T.Vector2(), saccAt: 1, saccades: true,
    petUntil: 0, petSide: 0, lastSeen: 0, sleepAfter: opts.sleepAfter ?? 60, sleep: 0,
  };

  // ── Pose helpers used by gestures ─────────────────────────
  const tmpV = new T.Vector3();
  function toModel(L, [x, y, z]) { return tmpV.set(side[L] * x, y, fwd * z).normalize().clone(); }
  const helper = (w) => ({
    /** Point the upper arm along `up` and the forearm along `fore` (character space). */
    arm(L, up, fore) {
      const u = node[`${L}UpperArm`], lo = node[`${L}LowerArm`];
      if (!u || !lo) return;
      const along = new T.Vector3(side[L], 0, 0);
      const qUp = aim(along, toModel(L, up));
      u.quaternion.slerp(qUp, w);
      if (fore) {
        const local = toModel(L, fore).applyQuaternion(qUp.clone().invert());
        lo.quaternion.slerp(aim(along, local), w);
      }
    },
    leg(L, lift, knee) {
      const up = node[`${L}UpperLeg`], lo = node[`${L}LowerLeg`];
      if (up) up.quaternion.slerp(QX.setFromAxisAngle(new T.Vector3(1, 0, 0), -fwd * lift), w);
      if (lo) lo.quaternion.slerp(QX.setFromAxisAngle(new T.Vector3(1, 0, 0), fwd * knee), w);
    },
    head(yaw, pitch, roll) { turn('head', yaw * w, pitch * w, roll * w); },
    spine(pitch, yaw, roll) { turn('spine', yaw * w, pitch * w, roll * w); },
  });

  /** Rotate a bone by yaw (toward the model's left), pitch (down) and roll. */
  function turn(bone, yaw, pitch, roll) {
    const n = node[bone];
    if (!n) return;
    EU.set(fwd * pitch, yaw, fwd * roll, 'YXZ');
    n.quaternion.multiply(QE.setFromEuler(EU));
  }

  // ── Clips ─────────────────────────────────────────────────
  /** A VRMA animation (built for this model here), or a clip already on its normalized bones (vrm-retarget.js). */
  function addClip(name, vrmAnimation) {
    const clip = vrmAnimation instanceof T.AnimationClip ? vrmAnimation : T.createVRMAnimationClip(vrmAnimation, vrm);
    clip.name = name;
    clips.set(name, clip);
    return clip;
  }
  function play(name, { loop = true, fade = 0.35, speed = 1 } = {}) {
    const clip = clips.get(name);
    if (!clip) return false;
    const next = mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop ? T.LoopRepeat : T.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = speed;
    if (action && action !== next) action.crossFadeTo(next, fade, false);
    else next.fadeIn(fade);
    next.play();
    action = next;
    return true;
  }
  function stopClip(fade = 0.4) {
    if (action) action.fadeOut(fade);
    action = null;
  }

  // ── Gestures and mood ─────────────────────────────────────
  function gesture(name) {
    const g = GESTURES[name];
    if (!g) return false;
    if (name !== 'dangle') wake();
    st.gestures = st.gestures.filter((x) => x.name !== name);
    st.gestures.push({ name, g, t0: st.t, dur: g.dur });
    return true;
  }
  function release(name) {
    const x = st.gestures.find((y) => y.name === name);
    if (x) x.dur = Math.min(x.dur, st.t - x.t0 + 0.35);
  }
  function mood(values, hold = 2.5) {
    wake();
    for (const [k, v] of Object.entries(values)) if (has(k)) st.mood[k] = { v, until: st.t + hold };
  }
  function talk(seconds) { wake(); st.talkUntil = st.t + seconds; }
  function lookAt(point) { st.look.copy(point); wake(); }
  /** Any interaction resets the doze timer; waking from a doze startles her a little. */
  function wake() {
    if (st.sleep > 0.5 && has('surprised')) st.mood.surprised = { v: 0.6, until: st.t + 0.8 };
    st.lastSeen = st.t;
  }
  /** A stroke on the head: she leans into it and her eyes go soft. side: -1..1, the stroke's direction. */
  function pet(side = 0) {
    wake();
    st.petUntil = st.t + 0.7;
    st.petSide += (clamp(side, -1, 1) - st.petSide) * 0.3;
  }

  // ── Per-frame layers ──────────────────────────────────────
  function idleLayer(t, k) {
    const breath = Math.sin(t * Math.PI * 2 / 3.6);
    turn('upperChest', 0, 0.012 * breath * k, 0);
    turn('chest', 0, 0.01 * breath * k, 0);
    for (const L of ['left', 'right']) {
      const up = node[`${L}UpperArm`];
      if (up) up.quaternion.multiply(QX.setFromAxisAngle(new T.Vector3(0, 0, 1), side[L] * 0.025 * breath * k));
    }
    const sway = Math.sin(t * 0.55), drift = Math.sin(t * 0.31 + 1);
    turn('hips', 0.015 * drift * k, 0, 0.022 * sway * k);
    turn('spine', -0.01 * drift * k, 0, -0.03 * sway * k);
    node.hips.position.x += 0.008 * sway * k * (fwd > 0 ? 1 : -1);
    turn('neck', 0.04 * Math.sin(t * 0.23) * k, 0.02 * Math.sin(t * 0.41 + 2) * k, 0.03 * Math.sin(t * 0.37) * k);
  }

  function gestureLayer(t) {
    let wink = 0, blinkHold = 0;
    const exprs = {};
    st.gestures = st.gestures.filter((x) => {
      const age = t - x.t0;
      if (age > x.dur) return false;
      const fadeIn = clamp(age / 0.3, 0, 1);
      const fadeOut = Number.isFinite(x.dur) ? clamp((x.dur - age) / 0.35, 0, 1) : 1;
      const w = ease(Math.min(fadeIn, fadeOut)) * (st.reduced ? 0.6 : 1);
      const p = Number.isFinite(x.dur) ? age / x.dur : 0;
      x.g.f(helper(w), p, t);
      for (const [k, v] of Object.entries(x.g.expr || {})) exprs[k] = Math.max(exprs[k] || 0, v * w);
      if (x.g.wink) wink = Math.max(wink, w);
      if (x.g.blink) blinkHold = Math.max(blinkHold, x.g.blink * w);
      return true;
    });
    return { exprs, wink, blinkHold };
  }

  // Saccades: the eyes hop a few degrees every second or so (eyes only),
  // returning to the point of attention about one hop in five.
  const right = new T.Vector3(), up = new T.Vector3();
  function saccadeLayer() {
    if (st.t >= st.saccAt) {
      const contact = Math.random() < 0.2 || !st.saccades;
      const amp = st.reduced ? 0.02 : 0.05;
      st.sacc.set(contact ? 0 : (Math.random() * 2 - 1) * amp, contact ? 0 : (Math.random() * 2 - 1) * amp * 0.6);
      st.saccAt = st.t + 0.5 + Math.random() * Math.random() * 3;
    }
    const head = node.head;
    lookTarget.position.copy(st.look);
    if (!head) return;
    head.getWorldPosition(headPos);
    dir.copy(st.look).sub(headPos);
    const dist = dir.length();
    right.crossVectors(dir, T.Object3D.DEFAULT_UP).normalize();
    up.crossVectors(right, dir).normalize();
    lookTarget.position.addScaledVector(right, st.sacc.x * dist).addScaledVector(up, st.sacc.y * dist);
  }

  const headPos = new T.Vector3(), dir = new T.Vector3(), invQ = new T.Quaternion();
  function gazeLayer(dt) {
    let yaw = 0, pitch = 0;
    const head = node.head;
    if (st.follow && head && st.sleep < 0.5) {
      head.getWorldPosition(headPos);
      dir.copy(st.look).sub(headPos);
      vrm.scene.getWorldQuaternion(invQ).invert();
      dir.applyQuaternion(invQ);
      yaw = clamp(Math.atan2(fwd * dir.x, fwd * dir.z), -0.75, 0.75);
      pitch = clamp(Math.atan2(-dir.y, Math.hypot(dir.x, dir.z)), -0.35, 0.4);
    }
    const k = 1 - Math.exp(-dt * 5);
    st.yaw += (yaw - st.yaw) * k;
    st.pitch += (pitch - st.pitch) * k;
    turn('neck', st.yaw * 0.35, st.pitch * 0.35, 0);
    turn('head', st.yaw * 0.45, st.pitch * 0.45, 0);
    // Petting: lean into the hand. Dozing: the head droops and tips.
    const petting = st.t < st.petUntil ? 1 : 0;
    st.petW = (st.petW || 0) + (petting - (st.petW || 0)) * (1 - Math.exp(-dt * 6));
    if (st.petW > 0.01) turn('head', 0, 0.07 * st.petW, -0.16 * st.petSide * st.petW);
    if (st.sleep > 0.01) {
      const nod = 0.02 * Math.sin(st.t * 0.9);
      turn('neck', 0, (0.22 + nod) * st.sleep, 0.05 * st.sleep);
      turn('head', 0.04 * st.sleep, 0.12 * st.sleep, 0.12 * st.sleep);
      turn('spine', 0, 0.05 * st.sleep, 0);
    }
  }

  function faceLayer(dt, g) {
    if (!vrm.expressionManager) return;
    const target = {};
    for (const [k, m] of Object.entries(st.mood)) if (m.until > st.t) target[k] = m.v; else delete st.mood[k];
    for (const [k, v] of Object.entries(g.exprs)) if (has(k)) target[k] = Math.max(target[k] || 0, v);
    if (st.held && has('surprised')) target.surprised = Math.max(target.surprised || 0, 0.7);
    if (st.petW > 0.05 && has('happy')) target.happy = Math.max(target.happy || 0, 0.85 * st.petW);
    if (st.sleep > 0.05 && has('relaxed')) target.relaxed = Math.max(target.relaxed || 0, 0.6 * st.sleep);
    // Blink, with an occasional double blink.
    let blink = 0;
    if (st.blinkOn && st.t >= st.blinkAt && st.blinkT < 0) st.blinkT = 0;
    if (st.blinkT >= 0) {
      st.blinkT += dt;
      const b = st.blinkT;
      blink = b < 0.06 ? b / 0.06 : b < 0.1 ? 1 : b < 0.2 ? 1 - (b - 0.1) / 0.1 : 0;
      if (b >= 0.2) { st.blinkT = -1; st.blinkAt = st.t + (Math.random() < 0.18 ? 0.25 : 2.2 + Math.random() * 3.8); }
    }
    // Soft eyes while petted; closed while dozing.
    target.blink = Math.max(blink, g.blinkHold, 0.45 * (st.petW || 0), st.sleep);
    if (g.wink && has('blinkLeft')) target.blinkLeft = g.wink;
    const talking = st.t < st.talkUntil;
    if (has('aa')) target.aa = talking ? 0.35 + 0.35 * Math.max(0, Math.sin(st.t * 18)) : 0;
    const k = 1 - Math.exp(-dt * 12);
    for (const n of new Set([...Object.keys(target), ...Object.keys(st.cur)])) {
      const want = target[n] || 0;
      const fast = n === 'blink' || n === 'aa' || n === 'blinkLeft';
      const v = fast ? want : (st.cur[n] || 0) + (want - (st.cur[n] || 0)) * k;
      st.cur[n] = v;
      vrm.expressionManager.setValue(real(n), clamp(v, 0, 1));
    }
  }

  function update(dt) {
    st.t += dt;
    for (const n of names) node[n].quaternion.copy(base[n]);
    node.hips.position.copy(hipsRest);
    mixer.update(dt);
    // Doze after being left alone: eased in over seconds, out quickly on waking.
    const dozing = st.sleepAfter > 0 && !st.held && st.t - st.lastSeen > st.sleepAfter ? 1 : 0;
    st.sleep += (dozing - st.sleep) * (1 - Math.exp(-dt * (dozing ? 0.6 : 4)));
    const k = (action ? 0.3 : 1) * (st.reduced ? 0.3 : 1) * st.idle * (1 - 0.5 * st.sleep);
    idleLayer(st.t, k);
    saccadeLayer();
    const g = gestureLayer(st.t);
    gazeLayer(dt);
    faceLayer(dt, g);
  }

  function setHeld(on) {
    wake();
    st.held = on;
    if (on) gesture('dangle'); else release('dangle');
  }

  return {
    update, addClip, play, stopClip, gesture, release, mood, talk, lookAt, setHeld, pet, wake,
    get clips() { return [...clips.keys()]; },
    get state() { return st; },
    get expressions() { return exprNames; },
    set follow(v) { st.follow = v; },
    set saccades(v) { st.saccades = v; },
    set blink(v) { st.blinkOn = v; },
    set reduced(v) { st.reduced = v; },
  };
}
