// vrm-motion.js clip playback on bijou.vrm, checked on every bone, every frame.
//   node --test dev/vrm-motion.test.mjs
// three.js writes a bone only when the mixer's value for it changes, so a
// clip that holds a key, pauses, finishes, or restarts its loop on repeated
// keys must still show on every bone it drives. Every other bone shows the
// relaxed base pose, and a clip fades in from that pose and back out to it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../js/vendor/avatar-engine.js';
import { createMotion } from '../js/vrm-motion.js';
import { restPose, boneNames } from '../js/vrm-runtime.js';

const TOL = 1e-4; // degrees

async function loadBijou() {
  const file = readFileSync(new URL('../assets/models/bijou.vrm', import.meta.url));
  const loader = new T.GLTFLoader();
  // Node has no image decoder; motion does not need the textures.
  loader.register(() => ({ name: 'NODE_TEXTURE_STUB', loadTexture: () => Promise.resolve(new T.Texture()) }));
  loader.register((parser) => new T.VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  T.VRMUtils.rotateVRM0(gltf.userData.vrm);
  return gltf.userData.vrm;
}

const turn = (x, y, z, angle) => new T.Quaternion().setFromAxisAngle(new T.Vector3(x, y, z).normalize(), angle);
const I = new T.Quaternion();

/** A model with her motion, the procedural layers off unless `layers`, and a clip builder on her normalized bones. */
async function doll({ layers = false } = {}) {
  const vrm = await loadBijou();
  const node = (b) => vrm.humanoid.getNormalizedBoneNode(b);
  const hipsRest = node('hips').position.clone();
  const motion = createMotion(vrm, { sleepAfter: 0 });
  // Idle off, and the gaze off at once rather than easing back.
  const quiet = () => { Object.assign(motion.state, { idle: 0, yaw: 0, pitch: 0 }); motion.follow = false; };
  if (!layers) quiet();
  /** rot: { bone: [times, quaternions] }; hips: [times, offsets from the rest hips]. */
  const clip = (name, rot, hips) => {
    const tracks = Object.entries(rot).map(([b, [times, qs]]) => new T.QuaternionKeyframeTrack(`${node(b).name}.quaternion`, times, qs.flatMap((q) => q.toArray())));
    if (hips) tracks.push(new T.VectorKeyframeTrack(`${node('hips').name}.position`, hips[0], hips[1].flatMap((v) => hipsRest.clone().add(v).toArray())));
    return new T.AnimationClip(name, 1, tracks);
  };
  const base = restPose(vrm);
  /**
   * Largest gap (degrees, and metres for the hips) between every bone and
   * what it should show: clip `c` at time t, mixed toward the base pose by
   * 1 - w where the clip drives it; the base pose elsewhere.
   */
  const gap = (c, t, w = 1) => {
    // Evaluated in double precision, as the mixer does.
    const want = new Map(c ? c.tracks.map((track) => [track.name, track.createInterpolant(new Float64Array(track.getValueSize())).evaluate(t)]) : []);
    let deg = 0;
    for (const b of boneNames(vrm)) {
      const rest = base[b] || I, v = want.get(`${node(b).name}.quaternion`);
      const q = v ? new T.Quaternion().fromArray(v).slerp(rest, 1 - w) : rest.clone();
      // Unit length first: angleTo reads a slightly short quaternion as turned.
      deg = Math.max(deg, (node(b).quaternion.clone().normalize().angleTo(q.normalize()) * 180) / Math.PI);
    }
    const p = want.get(`${node('hips').name}.position`);
    const hips = p ? new T.Vector3().fromArray(p).lerp(hipsRest, 1 - w) : hipsRest;
    return { deg, m: node('hips').position.distanceTo(hips) };
  };
  return { motion, clip, gap, quiet };
}

function expectGap(label, g) {
  assert.ok(g.deg < TOL, `${label}: a bone is ${g.deg.toFixed(4)} degrees off`);
  assert.ok(g.m < 1e-9, `${label}: the hips are ${g.m.toExponential(1)} m off`);
}

test('a clip shows on every bone, every frame: held keys, a loop restarting on repeated keys, a pause, a finished clip', async (t) => {
  const { motion, clip, gap } = await doll();
  const held = turn(0, 0, 1, -0.9), a = turn(1, 0, 0, 0.4), b = turn(0, 1, 0, -0.5);
  const c = clip('hold', {
    leftUpperArm: [[0, 1], [held, held]], // one value throughout: written on the first frame only
    rightUpperArm: [[0, 0.35, 0.7, 1], [a, a, b, a]], // still for the first third, so each loop restarts on a hold
    leftUpperLeg: [[0, 0.5, 1], [I, turn(1, 0, 0, -0.5), I]], // moves every frame
  }, [[0, 1], [new T.Vector3(0, -0.06, 0), new T.Vector3(0, -0.06, 0)]]); // the hips held low
  motion.addClip('hold', c);
  motion.play('hold', { fade: 0 });
  // 0.07 s frames: the loop wraps between frames, as it does at any real frame rate.
  let time = 0;
  for (let i = 1; i <= 50; i++) {
    motion.update(0.07);
    time += 0.07;
    expectGap(`frame ${i}`, gap(c, time % 1));
  }
  for (let i = 0; i < 3; i++) motion.update(0);
  expectGap('paused', gap(c, time % 1));
  motion.play('hold', { loop: false, fade: 0 });
  for (let i = 0; i < 25; i++) motion.update(0.07);
  expectGap('finished, holding its last frame', gap(c, 1));
  t.diagnostic('50 frames over three and a half loops, a pause and a finished clip: every bone within 1e-4 degrees');
});

test('a clip fades in from the base pose, hands bones over in a cross-fade, and fades back out to the base', async () => {
  const { motion, clip, gap, quiet } = await doll({ layers: true });
  const one = clip('one', {
    leftUpperArm: [[0, 1], [turn(0, 0, 1, -0.8), turn(0, 0, 1, -0.6)]],
    chest: [[0, 1], [turn(1, 0, 0, 0.2), turn(1, 0, 0, 0.1)]],
  }, [[0, 1], [new T.Vector3(), new T.Vector3(0, 0, 0.1)]]);
  const two = clip('two', {
    rightUpperArm: [[0, 1], [turn(0, 0, 1, 0.7), turn(0, 0, 1, 0.5)]],
    chest: [[0, 1], [turn(0, 1, 0, 0.3), turn(0, 1, 0, 0.2)]],
  });
  motion.addClip('one', one);
  motion.addClip('two', two);
  // Her breathing, sway and gaze run until the clip starts; it must fade in
  // from the base pose, not from that frame's layers.
  for (let i = 0; i < 30; i++) motion.update(1 / 30);
  motion.play('one', { fade: 0.5 });
  quiet();
  motion.update(0.1);
  expectGap('a fifth of the way into the fade', gap(one, 0.1, 0.2));
  for (let i = 0; i < 5; i++) motion.update(0.1);
  expectGap('faded in', gap(one, 0.6));
  motion.play('two', { fade: 0.3 });
  for (let i = 0; i < 5; i++) motion.update(0.1);
  expectGap('after the cross-fade: the left arm and hips back to base, the chest on the new clip', gap(two, 0.5));
  motion.stopClip(0.2);
  for (let i = 0; i < 3; i++) motion.update(0.1);
  expectGap('stopped', gap(null, 0));
  for (let i = 0; i < 5; i++) motion.update(0.1);
  expectGap('still at base', gap(null, 0));
});
