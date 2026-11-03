// The retargeter and the VRMA writer on synthetic skeletons with known motion.
//   node --test dev/retarget.test.mjs
// Sources stand in a T-pose or an A-pose, with arbitrary bone orientations,
// named as Mesh2Motion (Unreal) or Mixamo rigs, and every joint swings about
// its own axis while the hips travel. A retarget is right when each VRM bone
// points where its source bone points, frame by frame. bijou.vrm loads in
// Node with its textures stubbed, so it is checked too.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../js/vendor/avatar-engine.js';
import { retargetClip, MESH2MOTION_MAP, MIXAMO_MAP, guessBoneMap, matchBones } from '../js/vrm-retarget.js';
import { writeVRMA } from '../js/vrma-writer.js';
import { createMotion } from '../js/vrm-motion.js';

const FPS = 30;
const TOL = 2e-4; // radians
const SIDES = [['left', 1], ['right', -1]];
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomRotation(rand) {
  const u = rand(), a = Math.sqrt(1 - u), b = Math.sqrt(u), s = 2 * Math.PI * rand(), c = 2 * Math.PI * rand();
  return new T.Quaternion(a * Math.sin(s), a * Math.cos(s), b * Math.sin(c), b * Math.cos(c));
}

// A humanoid in the VRM T-pose (metres, +Y up, facing +Z, its left on +X):
// bone: [parent, x, y, z], mirrored for the right side. Arms lie exactly
// along X and legs along Y, so a pure A-pose rotation is exactly undone.
// `nose` is an extra joint on the head that no bone map names.
function layout() {
  const J = {
    hips: [null, 0, 0.95, 0], spine: ['hips', 0, 1.05, -0.01], chest: ['spine', 0, 1.17, -0.012],
    upperChest: ['chest', 0, 1.28, -0.01], neck: ['upperChest', 0, 1.42, -0.01], head: ['neck', 0, 1.52, 0.01],
    nose: ['head', 0, 1.58, 0.09],
  };
  for (const [L, s] of SIDES) {
    const at = (parent, x, y, z) => [parent, s * x, y, z];
    Object.assign(J, {
      [`${L}Shoulder`]: at('upperChest', 0.03, 1.38, 0), [`${L}UpperArm`]: at(`${L}Shoulder`, 0.15, 1.38, 0),
      [`${L}LowerArm`]: at(`${L}UpperArm`, 0.42, 1.38, 0), [`${L}Hand`]: at(`${L}LowerArm`, 0.66, 1.38, 0),
      [`${L}ThumbMetacarpal`]: at(`${L}Hand`, 0.68, 1.37, 0.03), [`${L}ThumbProximal`]: at(`${L}ThumbMetacarpal`, 0.71, 1.365, 0.05),
      [`${L}ThumbDistal`]: at(`${L}ThumbProximal`, 0.735, 1.36, 0.062),
      [`${L}UpperLeg`]: at('hips', 0.09, 0.9, 0), [`${L}LowerLeg`]: at(`${L}UpperLeg`, 0.09, 0.5, 0),
      [`${L}Foot`]: at(`${L}LowerLeg`, 0.09, 0.08, 0), [`${L}Toes`]: at(`${L}Foot`, 0.09, 0.02, 0.12),
    });
    FINGERS.forEach((f, i) => {
      const z = [0.022, 0, -0.018, -0.034][i];
      J[`${L}${f}Proximal`] = at(`${L}Hand`, 0.75, 1.38, z);
      J[`${L}${f}Intermediate`] = at(`${L}${f}Proximal`, 0.79, 1.38, z);
      J[`${L}${f}Distal`] = at(`${L}${f}Intermediate`, 0.815, 1.38, z);
    });
  }
  return J;
}

/** Joint positions, scaled, with poses baked into the rest (A-pose, drooped arms, splayed legs). */
function positions({ scale = 1, apose = 0, droop = 0, splay = 0, extra = false } = {}) {
  const J = layout();
  if (extra) { J.spineExtra = ['chest', 0, 1.225, -0.011]; J.upperChest[0] = 'spineExtra'; }
  const P = Object.fromEntries(Object.entries(J).map(([b, [, x, y, z]]) => [b, new T.Vector3(x, y, z).multiplyScalar(scale)]));
  for (const [L, s] of SIDES) {
    turnLimb(J, P, `${L}UpperArm`, -s * (apose + droop));
    turnLimb(J, P, `${L}UpperLeg`, s * splay);
  }
  return { J, P };
}
function turnLimb(J, P, bone, angle) {
  if (!angle) return;
  const q = new T.Quaternion().setFromAxisAngle(Z, angle);
  const below = (b) => { for (let p = J[b][0]; p; p = J[p][0]) if (p === bone) return true; return false; };
  for (const b of Object.keys(J)) if (below(b)) P[b].sub(P[bone]).applyQuaternion(q).add(P[bone]);
}

/** Nodes for every joint at world positions P, each with an arbitrary rest orientation when `rand` is given. */
function skeleton(J, P, name, rand) {
  const root = new T.Object3D();
  root.name = 'Armature';
  const node = {}, R = {};
  const make = (b) => {
    if (node[b]) return;
    const p = J[b][0];
    if (p) make(p);
    const o = new T.Bone();
    o.name = name(b);
    R[b] = rand ? randomRotation(rand) : new T.Quaternion();
    const inv = (p ? R[p] : new T.Quaternion()).clone().invert();
    o.position.copy(P[b]).sub(p ? P[p] : new T.Vector3()).applyQuaternion(inv);
    o.quaternion.copy(inv).multiply(R[b]);
    (p ? node[p] : root).add(o);
    node[b] = o;
  };
  Object.keys(J).forEach(make);
  root.updateMatrixWorld(true);
  return { root, node };
}

const UE = Object.fromEntries(Object.entries(MESH2MOTION_MAP).map(([k, v]) => [v, k]));
const MIXAMO = Object.fromEntries(Object.entries(MIXAMO_MAP).map(([k, v]) => [v, k]));

/**
 * A source rig with a one-second clip at 30 fps: every mapped joint (and an
 * extra unmapped spine joint, if asked) turns about its own random local axis
 * while the hips travel. `frame` turns the whole rig (another facing or up axis).
 */
function makeSource({ names = UE, apose = 0, scale = 1, frame = null, extra = false, seed = 7 } = {}) {
  const { J, P } = positions({ scale, apose, extra });
  const rand = mulberry32(seed);
  const { root, node } = skeleton(J, P, (b) => names[b] || (b === 'spineExtra' ? 'spine_extra' : b), rand);
  if (frame) { root.quaternion.copy(frame); root.updateMatrixWorld(true); }
  const times = Array.from({ length: FPS + 1 }, (_, i) => i / FPS);
  const tracks = [];
  for (const [b, o] of Object.entries(node)) {
    if (b === 'nose') continue;
    const axis = new T.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const amp = 0.25 + 0.5 * rand(), freq = 0.5 + rand(), phase = 6 * rand();
    const values = times.flatMap((t) => o.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(axis, amp * Math.sin(2 * Math.PI * freq * t + phase))).toArray());
    tracks.push(new T.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, values));
  }
  const hips = node.hips;
  const travel = (t) => new T.Vector3(0.1 * Math.sin(2 * Math.PI * t), 0.06 * Math.sin(4 * Math.PI * t), 0.3 * t).multiplyScalar(scale);
  tracks.push(new T.VectorKeyframeTrack(`${hips.name}.position`, times, times.flatMap((t) => hips.position.clone().add(travel(t)).toArray())));
  return { root, node, clip: new T.AnimationClip('swing', 1, tracks) };
}

/**
 * A minimal VRM: a raw rig (VRM 1.0 with arbitrary rest orientations, VRM 0.x
 * without, facing -Z and turned round as VRMUtils.rotateVRM0 does), its
 * three-vrm humanoid and the meta version. `without` leaves bones out of the humanoid.
 */
function makeVRM({ version = '1', scale = 0.86, droop = 0, splay = 0, without = [], seed = 3 } = {}) {
  const { J, P } = positions({ scale, droop, splay });
  if (version === '0') for (const v of Object.values(P)) v.set(-v.x, v.y, -v.z);
  const { root, node } = skeleton(J, P, (b) => `raw_${b}`, version === '1' ? mulberry32(seed) : null);
  const scene = new T.Group();
  scene.add(root);
  scene.updateMatrixWorld(true);
  const humanBones = {};
  for (const b of T.VRMHumanBoneList) if (node[b] && !without.includes(b)) humanBones[b] = { node: node[b] };
  const humanoid = new T.VRMHumanoid(humanBones);
  scene.add(humanoid.normalizedHumanBonesRoot);
  if (version === '0') scene.rotation.y = Math.PI;
  scene.updateMatrixWorld(true);
  return { scene, humanoid, meta: { metaVersion: version }, bone: (b) => humanoid.getRawBoneNode(b) || node[b] };
}

/** Play `clip` on `root` at time t (the last key included). */
function poseAt(root, clip, t) {
  const mixer = new T.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(t);
  root.updateMatrixWorld(true);
}
const sourceAt = (src, t) => poseAt(src.root, src.clip, t);
function vrmAt(vrm, clip, t) {
  poseAt(vrm.scene, clip, t);
  vrm.humanoid.update();
  vrm.scene.updateMatrixWorld(true);
}

const dir = (a, b) => b.getWorldPosition(new T.Vector3()).sub(a.getWorldPosition(new T.Vector3())).normalize();
/** Largest angle between source and VRM directions over bone pairs; `toVRM` turns source world into the VRM's. */
function worst(src, vrm, pairs, toVRM = new T.Quaternion()) {
  let max = 0;
  for (const [a, b] of pairs) max = Math.max(max, dir(src.node[a], src.node[b]).applyQuaternion(toVRM).angleTo(dir(vrm.bone(a), vrm.bone(b))));
  return max;
}

// Pairs the T-pose aligns (they match whatever either rest looks like), and
// pairs that also need the same layout (they test roll: the hands, the hips, the head).
const AIMS = [['spine', 'chest'], ['chest', 'upperChest'], ['upperChest', 'neck'], ['neck', 'head']];
const ROLLS = [['hips', 'spine'], ['hips', 'leftUpperLeg'], ['hips', 'rightUpperLeg'], ['upperChest', 'leftShoulder'], ['head', 'nose']];
for (const [L] of SIDES) {
  AIMS.push([`${L}Shoulder`, `${L}UpperArm`], [`${L}UpperArm`, `${L}LowerArm`], [`${L}LowerArm`, `${L}Hand`], [`${L}Hand`, `${L}MiddleProximal`],
    [`${L}ThumbMetacarpal`, `${L}ThumbProximal`], [`${L}ThumbProximal`, `${L}ThumbDistal`],
    [`${L}UpperLeg`, `${L}LowerLeg`], [`${L}LowerLeg`, `${L}Foot`], [`${L}Foot`, `${L}Toes`]);
  for (const f of FINGERS) AIMS.push([`${L}${f}Proximal`, `${L}${f}Intermediate`], [`${L}${f}Intermediate`, `${L}${f}Distal`]);
  ROLLS.push([`${L}Hand`, `${L}IndexProximal`], [`${L}Hand`, `${L}LittleProximal`], [`${L}Hand`, `${L}ThumbMetacarpal`]);
}
const FRAMES = [0, 4, 13, 22, 30];

const degrees = (rad) => (rad * 180 / Math.PI).toPrecision(2);
function expectMatch(t, src, vrm, clip, pairs, toVRM) {
  let max = 0;
  for (const i of FRAMES) {
    sourceAt(src, i / FPS);
    vrmAt(vrm, clip, i / FPS);
    const err = worst(src, vrm, pairs, toVRM);
    assert.ok(err < TOL, `frame ${i}: bones differ by ${degrees(err)} degrees`);
    max = Math.max(max, err);
  }
  t.diagnostic(`${pairs.length} bone directions over ${FRAMES.length} frames: worst ${degrees(max)} degrees`);
}

test('a T-pose source drives a smaller humanoid bone for bone, roll included', (t) => {
  const src = makeSource();
  const vrm = makeVRM();
  const clip = retargetClip(src.clip, src.root, vrm);
  const r = clip.userData.retarget;
  assert.equal(r.map, 'mesh2motion');
  assert.equal(Object.keys(r.bones).length, 52);
  assert.deepEqual(r.missing, []);
  assert.equal(r.keys, FPS + 1);
  assert.equal(clip.tracks.length, 53);
  expectMatch(t, src, vrm, clip, [...AIMS, ...ROLLS]);
});

test('an A-pose source is posed into the T-pose first; without that its arms are off by the A-pose angle', (t) => {
  const apose = 0.7;
  const src = makeSource({ apose, seed: 11 });
  const vrm = makeVRM({ seed: 5 });
  // Both before any posing: the source must stand in its rest pose.
  const clip = retargetClip(src.clip, src.root, vrm);
  const raw = retargetClip(src.clip, src.root, vrm, { tpose: false });
  expectMatch(t, src, vrm, clip, [...AIMS, ...ROLLS]);
  vrmAt(vrm, raw, 0.4);
  sourceAt(src, 0.4);
  const arm = worst(src, vrm, [['leftUpperArm', 'leftLowerArm'], ['rightUpperArm', 'rightLowerArm']]);
  assert.ok(Math.abs(arm - apose) < 1e-3, `uncorrected arms differ by ${arm}`);
  t.diagnostic(`without the T-pose step the arms are off by ${degrees(arm)} degrees (A-pose ${degrees(apose)})`);
});

test('a target with its own rest (drooped arms, splayed legs) still points every bone the same way', (t) => {
  const src = makeSource({ apose: 0.6, seed: 2 });
  const vrm = makeVRM({ droop: 0.12, splay: 0.06, scale: 0.78 });
  expectMatch(t, src, vrm, retargetClip(src.clip, src.root, vrm), AIMS);
});

test('retargeting leaves the source standing exactly as it was found', () => {
  const src = makeSource({ apose: 0.5 });
  const before = Object.values(src.node).map((o) => [...o.position.toArray(), ...o.quaternion.toArray()]);
  retargetClip(src.clip, src.root, makeVRM());
  const after = Object.values(src.node).map((o) => [...o.position.toArray(), ...o.quaternion.toArray()]);
  assert.deepEqual(after, before);
});

test('hips travel scales by the ratio of rest hips heights; inPlace keeps only the height', (t) => {
  const src = makeSource({ scale: 2 });
  const vrm = makeVRM();
  const rest = vrm.humanoid.normalizedRestPose.hips.position;
  const hips0 = src.node.hips.getWorldPosition(new T.Vector3());
  const k = rest[1] / hips0.y;
  const position = (clip) => clip.tracks.find((track) => track.name.endsWith('.position'));
  const moving = retargetClip(src.clip, src.root, vrm);
  const still = retargetClip(src.clip, src.root, vrm, { inPlace: true });
  assert.ok(Math.abs(moving.userData.retarget.scale - k) < 1e-5);
  t.diagnostic(`hips scale ${moving.userData.retarget.scale.toFixed(5)} (0.817 m over 1.9 m)`);
  for (const i of [0, 7, 19, 30]) {
    sourceAt(src, i / FPS);
    const d = src.node.hips.getWorldPosition(new T.Vector3()).sub(hips0).multiplyScalar(k);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(position(moving).values[i * 3 + c] - (rest[c] + d.getComponent(c))) < 1e-5);
      assert.ok(Math.abs(position(still).values[i * 3 + c] - (c === 1 ? rest[c] + d.y : rest[c])) < 1e-5);
    }
  }
  assert.ok(Math.abs(position(moving).values[30 * 3 + 2] - rest[2] - 0.3 * 2 * k) < 1e-5, 'a 0.6 m stride on a 1.9 m rig');
  assert.equal(position(retargetClip(src.clip, src.root, vrm, { translation: false })), undefined);
});

test('VRM 0.x targets get quaternion x and z, and hips x and z, negated', (t) => {
  const src = makeSource({ apose: 0.7, seed: 4 });
  const v1 = makeVRM({ version: '1' }), v0 = makeVRM({ version: '0' });
  const c1 = retargetClip(src.clip, src.root, v1), c0 = retargetClip(src.clip, src.root, v0);
  assert.deepEqual(c0.tracks.map((track) => track.name), c1.tracks.map((track) => track.name));
  c1.tracks.forEach((a, n) => {
    const b = c0.tracks[n], size = a.getValueSize();
    for (let j = 0; j < a.values.length; j++) {
      const flip = j % size === 0 || j % size === 2;
      assert.equal(b.values[j], flip ? -a.values[j] : a.values[j]);
    }
  });
  expectMatch(t, src, v0, c0, [...AIMS, ...ROLLS]);
});

test('an animated unmapped bone folds into its child, and so does a bone the VRM lacks', (t) => {
  const src = makeSource({ extra: true, seed: 9 });
  const vrm = makeVRM({ without: ['upperChest'] });
  const clip = retargetClip(src.clip, src.root, vrm);
  assert.deepEqual(clip.userData.retarget.folded, ['upperChest']);
  // Segments across the folded joints cannot match (the VRM has no joint
  // there); every bone below them must still point the right way.
  const spans = (a, b) => ['chest', 'upperChest'].includes(a) || b === 'upperChest';
  expectMatch(t, src, vrm, clip, AIMS.filter(([a, b]) => !spans(a, b)));
});

test('a source facing -Z, or on Z-up axes, is turned into the VRM frame', (t) => {
  for (const frame of [new T.Quaternion().setFromAxisAngle(Y, Math.PI), new T.Quaternion().setFromAxisAngle(X, Math.PI / 2)]) {
    const src = makeSource({ frame, apose: 0.5, seed: 21 });
    const vrm = makeVRM();
    const clip = retargetClip(src.clip, src.root, vrm);
    const found = new T.Quaternion().fromArray(clip.userData.retarget.frame);
    assert.ok(found.angleTo(frame.clone().invert()) < 1e-6, `found frame ${found.toArray()}`);
    assert.ok(Math.abs(clip.userData.retarget.scale - 0.86) < 1e-5, 'hips height measured along the source up axis');
    expectMatch(t, src, vrm, clip, [...AIMS, ...ROLLS], frame.clone().invert());
  }
});

test('Mixamo names as FBXLoader and GLTFLoader leave them map through the ported three-vrm table', (t) => {
  for (const prefix of ['mixamorig', 'mixamorig1', '']) {
    const names = Object.fromEntries(Object.entries(MIXAMO).map(([b, n]) => [b, prefix + n.slice('mixamorig'.length)]));
    const src = makeSource({ names, apose: 0.6, seed: 13 });
    assert.equal(guessBoneMap(src.root), 'mixamo');
    assert.equal(Object.keys(matchBones(src.root, MIXAMO_MAP)).length, 52);
    const vrm = makeVRM();
    expectMatch(t, src, vrm, retargetClip(src.clip, src.root, vrm), [...AIMS, ...ROLLS]);
  }
  assert.equal(guessBoneMap(makeSource().root), 'mesh2motion');
  const stranger = new T.Object3D();
  stranger.add(Object.assign(new T.Bone(), { name: 'tail_01' }));
  assert.equal(guessBoneMap(stranger), null);
  assert.throws(() => retargetClip(new T.AnimationClip('x', 1, []), stranger, makeVRM()), /bone map/);
});

// ── VRMA ─────────────────────────────────────────────────────
async function parseVRMA(buffer) {
  const loader = new T.GLTFLoader();
  loader.register((parser) => new T.VRMAnimationLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buffer, '');
  return gltf.userData.vrmAnimations[0];
}
function glbJSON(buffer) {
  const view = new DataView(buffer);
  assert.equal(view.getUint32(0, true), 0x46546c67, 'glTF magic');
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), buffer.byteLength);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
}
/** Largest difference between two clips' keys (track names must match; q and -q are one rotation). */
function clipDiff(a, b) {
  const other = new Map(b.tracks.map((t) => [t.name, t]));
  assert.equal(b.tracks.length, a.tracks.length);
  let max = Math.abs(a.duration - b.duration);
  for (const t of a.tracks) {
    const u = other.get(t.name);
    assert.ok(u, `no ${t.name} after the round trip`);
    assert.equal(u.values.length, t.values.length);
    t.times.forEach((x, i) => { max = Math.max(max, Math.abs(x - u.times[i])); });
    const size = t.getValueSize();
    for (let i = 0; i < t.values.length; i += size) {
      let same = 0, opposite = 0;
      for (let c = 0; c < size; c++) { same = Math.max(same, Math.abs(t.values[i + c] - u.values[i + c])); opposite = Math.max(opposite, Math.abs(t.values[i + c] + u.values[i + c])); }
      max = Math.max(max, size === 4 ? Math.min(same, opposite) : same);
    }
  }
  return max;
}

test('the VRMA writer round-trips through VRMAnimationLoaderPlugin and createVRMAnimationClip', async (t) => {
  const src = makeSource({ apose: 0.65, seed: 17 });
  for (const version of ['1', '0']) {
    const vrm = makeVRM({ version });
    const clip = retargetClip(src.clip, src.root, vrm);
    const buffer = writeVRMA(clip, vrm, { name: 'swing' });
    const json = glbJSON(buffer);
    const ext = json.extensions.VRMC_vrm_animation;
    assert.deepEqual(json.extensionsUsed, ['VRMC_vrm_animation']);
    assert.equal(ext.specVersion, '1.0');
    const bones = Object.keys(ext.humanoid.humanBones);
    for (const b of ['hips', 'spine', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot']) assert.ok(bones.includes(b), `required ${b}`);
    assert.ok(!bones.some((b) => /Eye$/.test(b)), 'no eyes in a VRMA humanoid');
    assert.ok(json.nodes.every((n) => !n.rotation && !n.scale), 'T-pose rest: translations only');
    // Every joint sits where the model's own joint stands at rest.
    const at = [];
    const place = (i, base) => { at[i] = base.clone().add(new T.Vector3(...json.nodes[i].translation)); for (const c of json.nodes[i].children || []) place(c, at[i]); };
    json.scenes[0].nodes.forEach((i) => place(i, new T.Vector3()));
    for (const [b, { node }] of Object.entries(ext.humanoid.humanBones)) assert.ok(at[node].distanceTo(vrm.bone(b).getWorldPosition(new T.Vector3())) < 1e-6, `${b} rests in place`);
    const hips = json.nodes[ext.humanoid.humanBones.hips.node].translation;
    const rest = vrm.humanoid.normalizedRestPose.hips.position;
    const flip = version === '0' ? [-1, 1, -1] : [1, 1, 1];
    hips.forEach((v, c) => assert.ok(Math.abs(v - flip[c] * rest[c]) < 1e-12, 'rest hips at this VRM in the VRM 1.0 frame'));
    assert.equal(json.animations[0].name, 'swing');
    assert.ok(json.animations[0].channels.every((c) => c.target.path === 'rotation' || ext.humanoid.humanBones.hips.node === c.target.node));
    const back = T.createVRMAnimationClip(await parseVRMA(buffer), vrm);
    const diff = clipDiff(clip, back);
    assert.ok(diff < 1e-6, `VRM ${version}: round trip differs by ${diff}`);
    t.diagnostic(`VRM ${version === '1' ? '1.0' : '0.x'}: ${buffer.byteLength} bytes, ${json.animations[0].channels.length} channels, largest key difference ${diff}`);
  }
});

test('a VRMA written for one model plays on another as a direct retarget would', async (t) => {
  const src = makeSource({ apose: 0.5, seed: 23 });
  const a = makeVRM({ version: '1', scale: 0.86 });
  const b = makeVRM({ version: '0', scale: 0.7 });
  const anim = await parseVRMA(writeVRMA(retargetClip(src.clip, src.root, a), a));
  const diff = clipDiff(retargetClip(src.clip, src.root, b), T.createVRMAnimationClip(anim, b));
  assert.ok(diff < 1e-5, `cross-model VRMA differs by ${diff}`);
  t.diagnostic(`VRM 1.0 file on a smaller VRM 0.x: largest key difference ${diff}`);
});

// ── bijou.vrm ────────────────────────────────────────────────
async function loadBijou() {
  const file = readFileSync(new URL('../assets/models/bijou.vrm', import.meta.url));
  const loader = new T.GLTFLoader();
  // Node has no image decoder; motion does not need the textures.
  loader.register(() => ({ name: 'NODE_TEXTURE_STUB', loadTexture: () => Promise.resolve(new T.Texture()) }));
  loader.register((parser) => new T.VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const vrm = gltf.userData.vrm;
  T.VRMUtils.rotateVRM0(vrm);
  vrm.scene.updateMatrixWorld(true);
  vrm.bone = (b) => vrm.humanoid.getRawBoneNode(b);
  return vrm;
}

test('onto bijou.vrm (VRM 0.x): a body clip with still fingers plays through vrm-motion.js bone for bone, every frame, and its VRMA round-trips', async (t) => {
  const vrm = await loadBijou();
  assert.equal(vrm.meta.metaVersion, '0');
  const src = makeSource({ apose: 0.7, scale: 1.1, seed: 31 });
  // Like most body clips, it never keys the fingers: their tracks hold one value.
  src.clip.tracks = src.clip.tracks.filter((track) => !/^(thumb|index|middle|ring|pinky)_/.test(track.name));
  const clip = retargetClip(src.clip, src.root, vrm, { map: 'mesh2motion', inPlace: true });
  assert.equal(Object.keys(clip.userData.retarget.bones).length, 52);
  // The procedural layers off, so what she shows is the clip alone.
  const motion = createMotion(vrm, { sleepAfter: 0 });
  motion.state.idle = 0;
  motion.follow = false;
  motion.addClip('swing', clip);
  assert.ok(motion.play('swing', { fade: 0.01 }));
  // 0.07 s frames: the one-second loop wraps between frames, three times.
  let max = 0;
  for (let i = 1; i <= 50; i++) {
    motion.update(0.07);
    vrm.humanoid.update();
    vrm.scene.updateMatrixWorld(true);
    sourceAt(src, (i * 0.07) % 1);
    const err = worst(src, vrm, AIMS);
    assert.ok(err < TOL, `frame ${i}: bijou differs by ${degrees(err)} degrees`);
    max = Math.max(max, err);
  }
  const buffer = writeVRMA(clip, vrm);
  const diff = clipDiff(clip, T.createVRMAnimationClip(await parseVRMA(buffer), vrm));
  assert.ok(diff < 1e-6, `bijou round trip differs by ${diff}`);
  t.diagnostic(`bijou through vrm-motion.js, fingers still: worst ${degrees(max)} degrees over 50 frames; VRMA ${buffer.byteLength} bytes, largest key difference ${diff}`);
});
