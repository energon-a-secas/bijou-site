// ── VRM motion: clips, idle, gestures, gaze and face ─────────
// Layers run every frame on the normalized humanoid in priority order,
// lowest first (VTube Studio's order): default, idle, tracking, one-shot,
// expression, physics. A layer that poses a bone slerps it from what the
// layers below left toward its own pose by its weight, and every weight
// fades, so a higher layer takes a bone over gradually and hands it back the
// same way. Small additive turns (breathing, drift, a pat's tilt) ride on top
// of whatever is there.
//   1. default: the relaxed rest pose (every bone reset, so nothing accumulates)
//   2. idle: breathing and sway, the idle scheduler's behaviours (procedural
//      poses, gestures, or VRMA clips at idle priority; vrm-idle.js) and the doze
//   3. tracking: head and neck aim at the look point while the spine shares
//      the turn; the eyes do the rest, with saccades (vrm-eyes.js)
//   4. one-shot: clips from play() and gestures; the gaze on the head and neck
//      yields to them instead of fighting them
//   5. expression: the touch reaction (vrm-touch.js) and the face
//   6. physics: the dangle while she is held; springs follow in vrm-physics.js
// The eyes yield to a playing clip's own gaze. Left alone for `sleepAfter`
// seconds she dozes off; a drag, a look or any other interaction wakes her.

import * as T from './vendor/avatar-engine.js';
import { restPose, forwardOf, aim, boneNames } from './vrm-runtime.js';
import { createClipLayer, indexClip } from './vrm-clips.js';
import { createIdleScheduler, normalizeBehaviour, clipsOf, BEHAVIOURS, breath, drift } from './vrm-idle.js';
import { createEyes, userGazeShare } from './vrm-eyes.js';
import { createTouchReaction } from './vrm-touch.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const DEG = Math.PI / 180;
const QX = new T.Quaternion(), QE = new T.Quaternion(), QA = new T.Quaternion(), EU = new T.Euler();
const X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);

// Character space for gesture directions: x outward (away from the body
// centre on that arm's side), y up, z forward. Converted per model. Each arm
// gesture names where the upper arm and the forearm point; the elbow's local
// rotation is solved from the two, so it holds in every arm position. A
// gesture's head turn is a pose that takes the head and neck over from the
// gaze; `rel` gestures (a nod) turn the head from wherever she is looking.
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
  nod: { dur: 1.4, rel: true, expr: { happy: 0.5 }, f: (m, p) => { m.head(0, 0.22 * Math.sin(p * Math.PI * 4), 0); } },
  tilt: { dur: 2, expr: { happy: 0.6 }, f: (m) => { m.head(0.1, 0.05, 0.3); } },
  spin: { dur: 1.2, expr: { happy: 0.9 }, f: (m) => {
    m.arm('left', [0.97, 0.05, 0.1], [0.97, 0.12, 0.1]);
    m.arm('right', [0.97, 0.05, 0.1], [0.97, 0.12, 0.1]);
  } },
  // Held: physics priority, so it wins over clips and gestures while she dangles.
  dangle: { dur: Infinity, physics: true, expr: { surprised: 0.8 }, f: (m, p, t) => {
    const k = 0.18 * Math.sin(t * 5);
    m.arm('left', [0.75, 0.45 + k, 0.15], [0.55, 0.82, 0.12]);
    m.arm('right', [0.75, 0.45 - k, 0.15], [0.55, 0.82, 0.12]);
    m.leg('left', 0.25 + k, 0.4); m.leg('right', 0.25 - k, 0.4);
  } },
};

export const GESTURE_NAMES = Object.keys(GESTURES).filter((k) => k !== 'dangle');

const EMOTIONS = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral'];
const ATTENTION = { span: 6, lapse: 0.35 }; // full attention for 6 s after a look, then 35 percent
const SPINE_MAX = 15 * DEG;
const SPINE_SPLIT = { spine: 1, chest: 0.8, upperChest: 0.6 };

/** Gesture idles play the gesture once, so their loop lasts the gesture. */
const withGestureLength = (b) => (b.gesture && GESTURES[b.gesture] ? { blend: 0.8, ...b, loop: b.loop ?? GESTURES[b.gesture].dur } : b);

export function createMotion(vrm, opts = {}) {
  const fwd = forwardOf(vrm);
  const random = opts.random || Math.random;
  const names = boneNames(vrm);
  const node = Object.fromEntries(names.map((n) => [n, vrm.humanoid.getNormalizedBoneNode(n)]));
  const rest = restPose(vrm);
  const base = Object.fromEntries(names.map((n) => [n, (rest[n] || new T.Quaternion()).clone()]));
  const hipsRest = node.hips.position.clone();
  const side = {};
  for (const L of ['left', 'right']) side[L] = node[`${L}LowerArm`] && node[`${L}LowerArm`].position.x < 0 ? -1 : 1;
  const spineShare = Object.entries(SPINE_SPLIT).filter(([n]) => node[n]);
  const spineSum = spineShare.reduce((s, [, k]) => s + k, 0) || 1;

  // Clips: one layer at one-shot priority (play), one at idle priority (the scheduler).
  const clips = new Map(), entries = new Map();
  const boneOfNode = new Map(names.map((n) => [node[n].name, n]));
  const shots = createClipLayer(), idleClips = createClipLayer();
  if (vrm.lookAt) {
    // createVRMAnimationClip names its gaze track after this proxy; the layers read it.
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
    t: 0, idle: 1, reduced: !!opts.reduced, follow: true, yaw: 0, pitch: 0, track: 0, lastLook: -1e9,
    gestures: [], mood: {}, cur: {}, blinkOn: true, talkUntil: 0, held: false,
    look: new T.Vector3(0, 1.4, 2), sacc: new T.Vector2(), saccades: true, eyeShare: 1,
    pats: 0, squint: 0, breathT: 0, lastSeen: 0, sleepAfter: opts.sleepAfter ?? 60, sleep: 0,
  };
  const eyes = createEyes({ random });
  const reaction = createTouchReaction();
  const sched = createIdleScheduler((opts.idles || BEHAVIOURS).map(withGestureLength), {
    random, first: opts.firstIdle ?? 1, available: (b) => clipsOf(b).every((c) => clips.has(c)),
  });

  // ── Pose helpers used by gestures and idles ───────────────
  const tmpV = new T.Vector3();
  function toModel(L, [x, y, z]) { return tmpV.set(side[L] * x, y, fwd * z).normalize().clone(); }
  const helper = (w, rel = false) => ({
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
      if (up) up.quaternion.slerp(QX.setFromAxisAngle(X, -fwd * lift), w);
      if (lo) lo.quaternion.slerp(QX.setFromAxisAngle(X, fwd * knee), w);
    },
    /** The head turned from rest (the neck returns to rest), or from where it is with `rel`. */
    head(yaw, pitch, roll) {
      if (rel) { turn('head', yaw * w, pitch * w, roll * w); return; }
      poseBone('neck', 0, 0, 0, w);
      poseBone('head', yaw, pitch, roll, w);
    },
    spine(pitch, yaw, roll) { turn('spine', yaw * w, pitch * w, roll * w); },
    turn(bone, yaw, pitch, roll) { turn(bone, yaw * w, pitch * w, roll * w); },
    /** Move the hips sideways, in metres toward her left. */
    shift(x) { node.hips.position.x += fwd * x * w; },
  });

  /** Rotate a bone by yaw (toward the model's left), pitch (down) and roll. */
  function turn(bone, yaw, pitch, roll) {
    const n = node[bone];
    if (!n) return;
    EU.set(fwd * pitch, yaw, fwd * roll, 'YXZ');
    n.quaternion.multiply(QE.setFromEuler(EU));
  }
  /** Slerp a bone toward its rest pose turned by yaw, pitch and roll. */
  function poseBone(bone, yaw, pitch, roll, w) {
    const n = node[bone];
    if (!n || w <= 0) return;
    EU.set(fwd * pitch, yaw, fwd * roll, 'YXZ');
    n.quaternion.slerp(QA.copy(base[bone]).multiply(QE.setFromEuler(EU)), Math.min(1, w));
  }

  // ── Clips ─────────────────────────────────────────────────
  /** A VRMA animation (built for this model here), or a clip already on its normalized bones (vrm-retarget.js). */
  function addClip(name, vrmAnimation) {
    const clip = vrmAnimation instanceof T.AnimationClip ? vrmAnimation : T.createVRMAnimationClip(vrmAnimation, vrm);
    clip.name = name;
    clips.set(name, clip);
    entries.set(name, indexClip(clip, boneOfNode));
    return clip;
  }
  function play(name, { loop = true, fade = 0.35, speed = 1 } = {}) {
    const entry = entries.get(name);
    if (!entry) return false;
    shots.play(entry, { loop, fade, speed });
    return true;
  }
  function stopClip(fade = 0.4) { shots.stop(fade); }

  /**
   * Add an idle behaviour to the rotation. A string is a looping clip of
   * that name; parts may name clips added with addClip (start and end clips
   * play once, so they last as long as the clip).
   */
  function addIdle(def) {
    const b = normalizeBehaviour(typeof def === 'string' ? { name: def, clip: def } : def);
    for (const part of [b.start, b.end]) if (part?.clip && clips.has(part.clip)) part.dur = clips.get(part.clip).duration;
    for (const c of clipsOf(b)) if (!clips.has(c)) throw new Error(`No clip named "${c}"; add it with addClip first.`);
    return sched.add(b).name;
  }

  // ── Gestures, mood and touch ──────────────────────────────
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
  /** Show an emotion for `hold` seconds; a new one waits for a blink in progress to reopen. */
  function mood(values, hold = 2.5) {
    wake();
    eyes.whenOpen(() => {
      for (const [k, v] of Object.entries(values)) if (has(k)) st.mood[k] = { v, until: st.t + hold };
    });
  }
  function talk(seconds) { wake(); st.talkUntil = st.t + seconds; }
  function lookAt(point) { st.look.copy(point); st.lastLook = st.t; wake(); }
  /** Any interaction resets the doze timer; waking from a doze startles her a little. */
  function wake() {
    if (st.sleep > 0.5 && has('surprised')) st.mood.surprised = { v: 0.6, until: st.t + 0.8 };
    st.lastSeen = st.t;
  }
  /** A tap or pat from vrm-touch.js: { region: 'head' | 'body', gesture: 'tap' | 'pat', side }. */
  function touch(t) {
    wake();
    reaction.trigger(t, st.t);
    if (t.gesture === 'pat') st.pats++;
  }
  /** A pat on the head: she leans into it and her eyes go soft. side: -1..1 across her head. */
  function pet(side = 0) { touch({ region: 'head', gesture: 'pat', side }); }
  /** Event-only behaviours (drag, toss, fall, land) are hooks the caller fires. */
  function fire(name) { wake(); return sched.fire(name); }
  function endEvent(name) { return sched.end(name); }
  function setHeld(on) {
    wake();
    st.held = on;
    if (on) { gesture('dangle'); sched.fire('drag'); } else { release('dangle'); sched.end('drag'); }
  }

  // ── Layers ────────────────────────────────────────────────
  function idleLayer(dt, k, views) {
    // Breathing and sway from sums of sines that never line up; slower and smaller asleep.
    st.breathT += dt * (1 - 0.35 * st.sleep);
    const b = breath(st.breathT), d = drift(st.t), s = k * (1 - 0.5 * st.sleep);
    turn('upperChest', 0, 0.012 * b * s, 0);
    turn('chest', 0, 0.01 * b * s, 0);
    for (const L of ['left', 'right']) {
      const up = node[`${L}UpperArm`];
      if (up) up.quaternion.multiply(QX.setFromAxisAngle(Z, side[L] * 0.025 * b * s));
    }
    turn('hips', 0.015 * d.turn * s, 0, 0.022 * d.sway * s);
    turn('spine', -0.01 * d.turn * s, 0, -0.03 * d.sway * s);
    node.hips.position.x += 0.008 * d.sway * s * fwd;
    // The scheduler's behaviours, then its clips.
    for (const v of views) {
      const w = v.w * v.amount * k;
      if (w < 1e-3) continue;
      if (v.b.pose) v.b.pose(helper(w), v);
      const g = GESTURES[v.b.gesture];
      if (g) g.f(helper(w, g.rel), clamp(v.age / g.dur, 0, 1), st.t);
    }
    idleClips.applyBones(node, k);
    // Dozing: the head droops and tips, nodding with her slow breath.
    if (st.sleep > 0.01) {
      const nod = 0.02 * b;
      turn('neck', 0, (0.22 + nod) * st.sleep, 0.05 * st.sleep);
      turn('head', 0.04 * st.sleep, 0.12 * st.sleep, 0.12 * st.sleep);
      turn('spine', 0, 0.05 * st.sleep, 0);
    }
  }

  const headPos = new T.Vector3(), dir = new T.Vector3(), invQ = new T.Quaternion();
  function trackingLayer(dt, k) {
    // Full attention while she is being looked after; it lapses after a while, so her idles show.
    const watch = st.follow && st.sleep < 0.5 ? (st.t - st.lastLook < ATTENTION.span ? 1 : ATTENTION.lapse) : 0;
    st.track += (watch - st.track) * (1 - Math.exp(-dt * (watch > st.track ? 5 : 0.7)));
    let yaw = 0, pitch = 0;
    const head = node.head;
    if (head && watch > 0) {
      head.getWorldPosition(headPos);
      dir.copy(st.look).sub(headPos);
      vrm.scene.getWorldQuaternion(invQ).invert();
      dir.applyQuaternion(invQ);
      yaw = clamp(Math.atan2(fwd * dir.x, fwd * dir.z), -45 * DEG, 45 * DEG);
      pitch = clamp(Math.atan2(-dir.y, Math.hypot(dir.x, dir.z)), -0.35, 0.4);
    }
    const s = 1 - Math.exp(-dt * 5);
    st.yaw += (yaw - st.yaw) * s;
    st.pitch += (pitch - st.pitch) * s;
    const w = st.track;
    // The spine shares up to 15 degrees of the turn, split 1.0 : 0.8 : 0.6 up the back.
    const body = clamp(st.yaw / 3, -SPINE_MAX, SPINE_MAX);
    for (const [n, share] of spineShare) turn(n, body * (share / spineSum) * w, 0, 0);
    // Head and neck aim: together with the spine, 80 percent of the way; the eyes do the rest.
    const neckHead = 0.8 * st.yaw - body;
    poseBone('neck', neckHead * 0.4375, st.pitch * 0.35, 0, w);
    poseBone('head', neckHead * 0.5625, st.pitch * 0.45, 0, w);
    // A small drift rides on the aim, so a watched head still lives.
    const d = drift(st.t), life = k * (1 - 0.5 * st.sleep);
    turn('neck', 0.04 * d.yaw * life, 0.02 * d.pitch * life, 0.03 * d.roll * life);
  }

  function gestureLayer(t, physics) {
    let wink = 0, blinkHold = 0;
    const exprs = {};
    for (const x of st.gestures) {
      if (!!x.g.physics !== physics) continue;
      const age = t - x.t0;
      if (age > x.dur) continue;
      const fadeIn = clamp(age / 0.3, 0, 1);
      const fadeOut = Number.isFinite(x.dur) ? clamp((x.dur - age) / 0.35, 0, 1) : 1;
      const w = ease(Math.min(fadeIn, fadeOut)) * (st.reduced ? 0.6 : 1);
      const p = Number.isFinite(x.dur) ? age / x.dur : 0;
      x.g.f(helper(w, x.g.rel), p, t);
      for (const [k, v] of Object.entries(x.g.expr || {})) exprs[k] = Math.max(exprs[k] || 0, v * w);
      if (x.g.wink) wink = Math.max(wink, w);
      if (x.g.blink) blinkHold = Math.max(blinkHold, x.g.blink * w);
    }
    return { exprs, wink, blinkHold };
  }

  function reactionLayer() {
    const r = reaction.sample(st.t);
    const k = st.reduced ? 0.5 : 1;
    turn('head', r.yaw * k, r.pitch * k, r.roll * k);
    turn('spine', r.spineYaw * k, r.spinePitch * k, 0);
    st.squint = r.squint;
  }

  // Eyes: the look point plus saccades. A playing clip's own gaze takes the
  // eyes over by how far it looks away (1 - smoothstep(30, 90 degrees) stays
  // with the person), so a clip glancing aside is not dragged back to you.
  const right = new T.Vector3(), up = new T.Vector3(), clipDir = new T.Vector3(), headQ = new T.Quaternion();
  function eyesLayer(hop) {
    if (hop) st.sacc.set(hop.x, hop.y);
    lookTarget.position.copy(st.look);
    st.eyeShare = 1;
    const head = node.head;
    if (!head) return;
    head.getWorldPosition(headPos);
    dir.copy(st.look).sub(headPos);
    const dist = dir.length();
    right.crossVectors(dir, T.Object3D.DEFAULT_UP).normalize();
    up.crossVectors(right, dir).normalize();
    lookTarget.position.addScaledVector(right, st.sacc.x * dist).addScaledVector(up, st.sacc.y * dist);
    const g = shots.gaze.w > 0.01 ? shots.gaze : idleClips.gaze;
    if (g.w <= 0.01) return;
    const k = Math.min(1, g.w) * (1 - userGazeShare(Math.hypot(g.yaw, g.pitch)));
    st.eyeShare = 1 - k;
    if (k <= 1e-3) return;
    EU.set(fwd * g.pitch * DEG, g.yaw * DEG, 0, 'YXZ');
    clipDir.set(0, 0, fwd).applyEuler(EU).applyQuaternion(head.getWorldQuaternion(headQ));
    dir.copy(lookTarget.position).sub(headPos).normalize().lerp(clipDir, k);
    if (dir.lengthSq() < 1e-6) return;
    lookTarget.position.copy(headPos).addScaledVector(dir.normalize(), Math.max(dist, 0.5));
  }

  function faceLayer(dt, blinkNow, g, views) {
    if (!vrm.expressionManager) return;
    const lower = {}, upper = {};
    const put = (into, k, v) => { if (has(k) && v > (into[k] || 0)) into[k] = v; };
    // Idle and one-shot faces: the behaviours' (an idle gesture brings its own), the doze, the clips', the gestures'.
    let idleBlink = 0;
    for (const v of views) {
      const w = v.w * v.amount * st.idle, ge = GESTURES[v.b.gesture];
      for (const [k, x] of Object.entries(v.b.face || ge?.expr || {})) put(lower, k, x * w);
      if (ge?.blink) idleBlink = Math.max(idleBlink, ge.blink * w);
    }
    if (st.sleep > 0.05) put(lower, 'relaxed', 0.6 * st.sleep);
    for (const layer of [idleClips, shots]) for (const [k, s] of layer.face) put(lower, k, s.v * Math.min(1, s.w));
    for (const [k, v] of Object.entries(g.exprs)) put(lower, k, v);
    // Expression priority: moods, the startle while held, the smile under a hand.
    for (const [k, m] of Object.entries(st.mood)) if (m.until > st.t) put(upper, k, m.v); else delete st.mood[k];
    if (st.held) put(upper, 'surprised', 0.7);
    const soft = Math.min(1, st.squint / 0.65);
    if (soft > 0.01) put(upper, 'happy', 0.85 * soft);
    // An emotion asked for at expression priority fades the lower ones out.
    const strength = Math.max(0, ...EMOTIONS.map((e) => upper[e] || 0));
    const target = {};
    for (const k of new Set([...Object.keys(lower), ...Object.keys(upper)])) {
      const low = (lower[k] || 0) * (EMOTIONS.includes(k) ? 1 - strength : 1);
      target[k] = Math.max(upper[k] || 0, low);
    }
    // Blinks pause while an emotion shows (two closing shapes stack and the
    // lids fold); soft eyes under a hand; closed while dozing; a clip's own blink still shows.
    const calm = 1 - Math.max(0, ...EMOTIONS.filter((e) => e !== 'neutral').map((e) => st.cur[e] || 0));
    target.blink = Math.max(blinkNow * calm, g.blinkHold, idleBlink, 0.45 * soft, st.sleep, target.blink || 0);
    if (g.wink && has('blinkLeft')) target.blinkLeft = g.wink;
    const talking = st.t < st.talkUntil;
    if (has('aa')) target.aa = Math.max(target.aa || 0, talking ? 0.35 + 0.35 * Math.max(0, Math.sin(st.t * 18)) : 0);
    const k = 1 - Math.exp(-dt * 12);
    for (const n of new Set([...Object.keys(target), ...Object.keys(st.cur)])) {
      const want = target[n] || 0;
      const fast = n === 'blink' || n === 'aa' || n === 'blinkLeft';
      const v = fast ? want : (st.cur[n] || 0) + (want - (st.cur[n] || 0)) * k;
      st.cur[n] = v;
      vrm.expressionManager.setValue(real(n), clamp(v, 0, 1));
    }
  }

  // Idle clips follow the scheduler's blends; within a behaviour a part hands
  // over to the next one over 0.3 s.
  function driveIdleClips(views) {
    const list = [];
    for (const v of views) {
      const { start, loop, end } = v.b;
      const cur = v.phase === 'start' ? start?.clip : v.phase === 'end' ? end?.clip || loop.clip : loop.clip;
      const prev = v.phase === 'loop' ? start?.clip : v.phase === 'end' && end?.clip ? loop.clip : null;
      const x = prev ? Math.min(1, v.t / 0.3) : 1;
      if (cur && entries.has(cur)) list.push({ entry: entries.get(cur), w: v.w * x, loop: cur === loop.clip });
      if (prev && x < 1 && entries.has(prev)) list.push({ entry: entries.get(prev), w: v.w * (1 - x), loop: prev === loop.clip });
    }
    idleClips.drive(list);
  }

  function update(dt) {
    st.t += dt;
    for (const n of names) node[n].quaternion.copy(base[n]);
    node.hips.position.copy(hipsRest);
    // Doze after being left alone: eased in over seconds, out quickly on waking.
    const dozing = st.sleepAfter > 0 && !st.held && st.t - st.lastSeen > st.sleepAfter ? 1 : 0;
    st.sleep += (dozing - st.sleep) * (1 - Math.exp(-dt * (dozing ? 0.6 : 4)));
    const k = (st.reduced ? 0.3 : 1) * st.idle;
    const views = sched.update(dt, { asleep: st.sleep > 0.5, enabled: st.idle > 0 });
    driveIdleClips(views);
    idleClips.update(dt);
    shots.update(dt);
    idleLayer(dt, k, views);
    trackingLayer(dt, k);
    shots.applyBones(node, 1);
    const g = gestureLayer(st.t, false);
    reactionLayer();
    const held = gestureLayer(st.t, true);
    for (const [n, v] of Object.entries(held.exprs)) g.exprs[n] = Math.max(g.exprs[n] || 0, v);
    st.gestures = st.gestures.filter((x) => st.t - x.t0 <= x.dur);
    const e = eyes.update(dt, { blink: st.blinkOn, saccades: st.saccades, reduced: st.reduced });
    eyesLayer(e.hop);
    faceLayer(dt, e.blink, g, views);
  }

  return {
    update, addClip, play, stopClip, gesture, release, mood, talk, lookAt, setHeld, pet, wake,
    touch, fire, endEvent, addIdle,
    removeIdle: (name) => sched.remove(name),
    get clips() { return [...clips.keys()]; },
    get state() { return st; },
    get expressions() { return exprNames; },
    /** The idle scheduler: current, picks, next(), behaviours. */
    get idle() { return sched; },
    /** Clips playing at one-shot and idle priority, with their weights. */
    get playing() { return { shots: shots.playing, idle: idleClips.playing }; },
    set follow(v) { st.follow = v; },
    set saccades(v) { st.saccades = v; },
    set blink(v) { st.blinkOn = v; },
    set reduced(v) { st.reduced = v; },
  };
}
