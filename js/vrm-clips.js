// ── VRMA clip layers ─────────────────────────────────────────
// Clips made by createVRMAnimationClip are evaluated straight from their
// tracks rather than through an AnimationMixer. vrm-motion.js resets every
// bone each frame and layers idle, gaze and gestures around the clips, and
// the mixer writes a property only when its value differs from the last
// frame's: a clip holding a pose (a held keyframe, or the clamped end of a
// play-once clip) fell back to the rest pose, and its fades blended against
// a pose frozen when the clip began. Here a layer evaluates its clips every
// frame and reports, per bone, the blended rotation and how much of that
// bone the clips own (their summed weight, at most 1), so bones no clip
// animates are left to the layers below. A clip's own expressions and gaze
// (its lookAt track, as yaw and pitch in degrees) are reported the same way.

import * as T from './vendor/avatar-engine.js';

const EXPR = 'VRMExpression_';
const RAD2DEG = 180 / Math.PI;

/**
 * Index a clip's tracks by what they drive. boneOfNode maps normalized bone
 * node names to humanoid bone names; lookName is the VRMLookAtQuaternionProxy's name.
 */
export function indexClip(clip, boneOfNode, lookName = 'lookAtQuaternionProxy') {
  const out = { clip, bones: [], hips: null, expressions: [], look: null };
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot), prop = track.name.slice(dot + 1);
    const read = track.createInterpolant();
    if (prop === 'quaternion' && nodeName === lookName) out.look = read;
    else if (prop === 'quaternion' && boneOfNode.has(nodeName)) out.bones.push({ bone: boneOfNode.get(nodeName), read });
    else if (prop === 'position' && boneOfNode.get(nodeName) === 'hips') out.hips = read;
    else if (prop === 'weight' && nodeName.startsWith(EXPR)) out.expressions.push({ name: nodeName.slice(EXPR.length), read });
  }
  return out;
}

/** One layer of clips with their own weights: one-shot clips, or idle clips. */
export function createClipLayer() {
  let players = [];
  const pose = new Map(), face = new Map();
  const hips = { p: new T.Vector3(), w: 0 };
  const gaze = { yaw: 0, pitch: 0, w: 0 };
  const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3();
  const rate = (fade) => 1 / Math.max(fade, 1e-3);

  /** Fade a clip in from its start (and with solo, every other clip out) over `fade` seconds. */
  function play(entry, { loop = true, fade = 0.35, speed = 1, solo = true } = {}) {
    let p = players.find((x) => x.entry === entry);
    if (!p) { p = { entry, w: 0 }; players.push(p); }
    Object.assign(p, { time: 0, loop, speed, target: 1, rate: rate(fade) });
    if (solo) for (const x of players) if (x !== p) Object.assign(x, { target: 0, rate: rate(fade) });
    return p;
  }
  function stop(fade = 0.4) { for (const x of players) Object.assign(x, { target: 0, rate: rate(fade) }); }

  /** Set the weights directly, for blends computed elsewhere: [{ entry, w, loop }]; unlisted clips stop. */
  function drive(list) {
    const keep = new Set();
    for (const d of list) {
      let p = players.find((x) => x.entry === d.entry);
      if (!p) { p = { entry: d.entry, time: 0, speed: 1, w: 0 }; players.push(p); }
      if (!keep.has(p)) p.w = 0;
      p.w = Math.min(1, p.w + d.w);
      Object.assign(p, { target: p.w, rate: 0, loop: d.loop });
      keep.add(p);
    }
    players = players.filter((p) => keep.has(p));
  }

  function evaluate() {
    for (const s of pose.values()) s.w = 0;
    for (const s of face.values()) { s.v = 0; s.w = 0; }
    hips.w = 0; gaze.yaw = 0; gaze.pitch = 0; gaze.w = 0;
    for (const p of players) {
      const w = p.w;
      if (w <= 1e-4) continue;
      const { bones, expressions, look } = p.entry;
      // A running weighted average: each clip pulls the blend toward itself by its share so far.
      for (const { bone, read } of bones) {
        let s = pose.get(bone);
        if (!s) { s = { q: new T.Quaternion(), w: 0 }; pose.set(bone, s); }
        _q.fromArray(read.evaluate(p.time));
        if (s.w === 0) s.q.copy(_q); else s.q.slerp(_q, w / (s.w + w));
        s.w += w;
      }
      if (p.entry.hips) {
        _v.fromArray(p.entry.hips.evaluate(p.time));
        if (hips.w === 0) hips.p.copy(_v); else hips.p.lerp(_v, w / (hips.w + w));
        hips.w += w;
      }
      for (const { name, read } of expressions) {
        let s = face.get(name);
        if (!s) { s = { v: 0, w: 0 }; face.set(name, s); }
        s.v += read.evaluate(p.time)[0] * w;
        s.w += w;
      }
      if (look) {
        _e.setFromQuaternion(_q.fromArray(look.evaluate(p.time)), 'YXZ');
        gaze.yaw += _e.y * RAD2DEG * w;
        gaze.pitch += _e.x * RAD2DEG * w;
        gaze.w += w;
      }
    }
    for (const s of face.values()) if (s.w > 0) s.v /= s.w;
    if (gaze.w > 0) { gaze.yaw /= gaze.w; gaze.pitch /= gaze.w; }
  }

  function update(dt) {
    for (const p of players) {
      if (p.rate) p.w += Math.sign(p.target - p.w) * Math.min(Math.abs(p.target - p.w), p.rate * dt);
      const d = p.entry.clip.duration;
      p.time += dt * p.speed;
      if (d > 0) p.time = p.loop ? ((p.time % d) + d) % d : Math.min(Math.max(p.time, 0), d);
    }
    players = players.filter((p) => p.w > 1e-4 || p.target > 0);
    evaluate();
  }

  /** Slerp every bone the clips animate toward their pose, by the share they own times `scale`. */
  function applyBones(node, scale = 1) {
    if (scale <= 0) return;
    for (const [bone, s] of pose) {
      if (s.w > 0 && node[bone]) node[bone].quaternion.slerp(s.q, Math.min(1, s.w) * scale);
    }
    if (hips.w > 0 && node.hips) node.hips.position.lerp(hips.p, Math.min(1, hips.w) * scale);
  }

  return {
    play, stop, drive, update, applyBones,
    /** Share of a bone the clips own, 0..1. */
    owns: (bone) => Math.min(1, pose.get(bone)?.w || 0),
    /** Expressions the clips set: name -> { v, w }. */
    get face() { return face; },
    /** The clips' own gaze: { yaw, pitch } in degrees and w, the share they own. */
    get gaze() { return gaze; },
    get weight() { return Math.min(1, players.reduce((s, p) => s + p.w, 0)); },
    get playing() { return players.map((p) => ({ name: p.entry.clip.name, w: +p.w.toFixed(3), time: +p.time.toFixed(3) })); },
  };
}
