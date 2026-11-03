// ── Retargeting: other humanoid rigs onto the VRM humanoid ───
// Turns a clip made for another skeleton (an Object3D hierarchy as
// GLTFLoader or FBXLoader produce it, standing in its rest pose) into a clip
// on a VRM's normalized humanoid, which vrm-motion.js plays like a VRMA.
//
// Rotations follow three-vrm's formula: for each mapped bone,
//   normalized = parentRestWorld x key x inverse(restWorld)
// with the nearest mapped ancestor as the parent. It is evaluated on world
// rotations sampled from the posed source, as
//   normalized = inverse(D(parent)) x D(bone), D = world x inverse(restWorld)
// which is the same for a direct parent and folds any bone in between
// (unmapped, or missing on this VRM) into its child. Before sampling, the
// source rest is posed into the VRM's own T-pose (so an A-pose rig comes out
// right) and its axes are snapped onto the VRM 1.0 frame (+Y up, facing +Z).
// Only the hips translate, scaled by the ratio of rest hips heights. VRM 0.x
// targets get quaternion x and z and hips x and z negated, as
// createVRMAnimationClip does for VRMA files.

import * as T from './vendor/avatar-engine.js';
import { BONE_MAPS, matchBones, guessBoneMap } from './vrm-bone-maps.js';

export { BONE_MAPS, MESH2MOTION_MAP, MIXAMO_MAP, matchBones, guessBoneMap } from './vrm-bone-maps.js';

const BONES = T.VRMHumanBoneList;
const PARENT = T.VRMHumanBoneParentMap;

export const isVRM0 = (vrm) => vrm.meta?.metaVersion === '0';

// Where each bone points in the T-pose: toward the first of these that the
// VRM has and the source maps. The hips keep their own rest (they carry the
// facing); bones with no entry (head, toes, last finger joints) keep theirs.
const AIM = { spine: ['chest', 'upperChest', 'neck'], chest: ['upperChest', 'neck'], upperChest: ['neck'], neck: ['head'] };
for (const L of ['left', 'right']) {
  Object.assign(AIM, {
    [`${L}Shoulder`]: [`${L}UpperArm`], [`${L}UpperArm`]: [`${L}LowerArm`], [`${L}LowerArm`]: [`${L}Hand`],
    [`${L}Hand`]: ['Middle', 'Index', 'Ring', 'Little'].map((f) => `${L}${f}Proximal`),
    [`${L}UpperLeg`]: [`${L}LowerLeg`], [`${L}LowerLeg`]: [`${L}Foot`], [`${L}Foot`]: [`${L}Toes`],
    [`${L}ThumbMetacarpal`]: [`${L}ThumbProximal`], [`${L}ThumbProximal`]: [`${L}ThumbDistal`],
  });
  for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
    AIM[`${L}${f}Proximal`] = [`${L}${f}Intermediate`];
    AIM[`${L}${f}Intermediate`] = [`${L}${f}Distal`];
  }
}

/** [bone, child] pairs whose directions the T-pose aligns, among `bones`: for checks. */
export function aimPairs(bones) {
  const has = new Set(bones);
  return bones.map((b) => [b, (AIM[b] || []).find((c) => has.has(c))]).filter(([, c]) => c);
}

/**
 * The VRM's T-pose joint positions in the VRM 1.0 frame (+Y up, facing +Z),
 * from its normalized rest pose: { bone: Vector3 }.
 */
export function restPositions(vrm) {
  const rest = vrm.humanoid.normalizedRestPose;
  const out = {};
  for (const b of BONES) {
    if (!rest[b]?.position) continue;
    let p = PARENT[b];
    while (p && !out[p]) p = PARENT[p];
    out[b] = new T.Vector3().fromArray(rest[b].position);
    if (p) out[b].add(out[p]);
  }
  if (isVRM0(vrm)) for (const v of Object.values(out)) v.set(-v.x, v.y, -v.z);
  return out;
}

/** v snapped to its largest axis (skipping axis `skip`) as { v: unit Vector3, k: axis }. */
function snapAxis(v, skip = -1) {
  const a = [v.x, v.y, v.z];
  let k = -1;
  for (let i = 0; i < 3; i++) if (i !== skip && (k < 0 || Math.abs(a[i]) > Math.abs(a[k]))) k = i;
  if (Math.abs(a[k]) < 1e-9) return null;
  const out = new T.Vector3();
  out.setComponent(k, Math.sign(a[k]));
  return { v: out, k };
}

/**
 * Rotation from the source's world axes to the VRM 1.0 frame, found from
 * where its head and its left side are, snapped to whole axes so that a
 * leaning rest pose does not tilt the whole clip.
 */
export function sourceFrame(src) {
  const at = (b) => src[b] && src[b].getWorldPosition(new T.Vector3());
  const q = new T.Quaternion();
  const top = ['head', 'neck', 'upperChest', 'chest', 'spine'].map(at).find(Boolean);
  const pair = [['leftUpperLeg', 'rightUpperLeg'], ['leftUpperArm', 'rightUpperArm'], ['leftShoulder', 'rightShoulder'], ['leftHand', 'rightHand']]
    .find(([l, r]) => src[l] && src[r]);
  if (!top || !pair || !src.hips) return q;
  const up = snapAxis(top.sub(at('hips')));
  const left = up && snapAxis(at(pair[0]).sub(at(pair[1])), up.k);
  if (!left) return q;
  const m = new T.Matrix4().makeBasis(left.v, up.v, new T.Vector3().crossVectors(left.v, up.v));
  return q.setFromRotationMatrix(m).invert();
}

/** Pose the mapped source bones so each points where the VRM's T-pose does. */
function poseToVRM(src, bones, rest, toSource) {
  const a = new T.Vector3(), b = new T.Vector3(), want = new T.Vector3();
  const turn = new T.Quaternion(), wq = new T.Quaternion(), pq = new T.Quaternion();
  for (const [name, next] of aimPairs(bones)) {
    const node = src[name];
    node.getWorldPosition(a);
    src[next].getWorldPosition(b).sub(a);
    want.subVectors(rest[next], rest[name]).applyQuaternion(toSource);
    if (b.lengthSq() < 1e-12 || want.lengthSq() < 1e-12) continue;
    turn.setFromUnitVectors(b.normalize(), want.normalize());
    node.getWorldQuaternion(wq).premultiply(turn);
    if (node.parent) wq.premultiply(node.parent.getWorldQuaternion(pq).invert());
    node.quaternion.copy(wq);
    node.updateMatrixWorld(true);
  }
}

/** Sample times: every key of the given tracks, or a fixed rate when fps is set. */
function sampleTimes(tracks, duration, fps) {
  if (fps > 0) {
    const n = Math.max(2, Math.round(duration * fps) + 1);
    return Float32Array.from({ length: n }, (_, i) => (duration * i) / (n - 1));
  }
  const keys = [];
  for (const t of tracks) for (const x of t.times) if (x > 1e-4 && x < duration - 1e-4) keys.push(x);
  keys.sort((a, b) => a - b);
  const out = [0];
  for (const x of keys) if (x - out[out.length - 1] > 1e-4) out.push(x);
  out.push(duration);
  return Float32Array.from(out);
}

/** The clip's position, rotation and scale tracks, bound to nodes of `source`. */
function bindTracks(clip, source) {
  const out = [];
  for (const track of clip.tracks) {
    let parsed;
    try { parsed = T.PropertyBinding.parseTrackName(track.name); } catch { continue; }
    if (!['quaternion', 'position', 'scale'].includes(parsed.propertyName)) continue;
    const node = T.PropertyBinding.findNode(source, parsed.nodeName);
    if (node) out.push({ track, node, prop: parsed.propertyName, f: track.createInterpolant() });
  }
  return out;
}

/**
 * Retarget `clip`, which animates `source` (standing in its rest pose, as
 * loaded), onto `vrm`. Returns a THREE.AnimationClip whose tracks drive the
 * VRM's normalized bone nodes, with a report in clip.userData.retarget.
 * The source is left as it was found.
 * opts: {
 *   map: a BONE_MAPS id or { sourceName: vrmBone } (default: the best match),
 *   tpose: pose the source rest into the VRM's T-pose first (default true),
 *   inPlace: keep the hips height, drop horizontal travel (default false),
 *   translation: move the hips at all (default true),
 *   fps: resample at this rate (default: the clip's own key times),
 *   hipsHeight: the source's rest hips height, when its root is not the floor,
 *   frame: Quaternion from source world to the VRM 1.0 frame (default: found),
 * }
 */
export function retargetClip(clip, source, vrm, opts = {}) {
  const custom = opts.map && typeof opts.map === 'object';
  const mapId = custom ? 'custom' : opts.map || guessBoneMap(source);
  const table = custom ? opts.map : BONE_MAPS[mapId]?.map;
  if (!table) throw new Error('No bone map fits this skeleton.');
  const src = matchBones(source, table);
  const h = vrm.humanoid;
  const bones = BONES.filter((b) => src[b] && h.getNormalizedBoneNode(b));
  if (!bones.includes('hips')) throw new Error('No bone of this skeleton maps to the hips.');
  const parent = {};
  for (const b of bones) {
    let p = PARENT[b];
    while (p && !bones.includes(p)) p = PARENT[p];
    parent[b] = p || null;
  }

  // The rest pose is whatever the source stands in now; put it back after.
  const saved = [];
  source.traverse((o) => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const restore = () => {
    for (const [o, p, q, s] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
    source.updateWorldMatrix(true, true);
  };
  source.updateWorldMatrix(true, true);

  const F = opts.frame ? opts.frame.clone() : sourceFrame(src);
  const Finv = F.clone().invert();
  const rest = restPositions(vrm);
  const hips0 = src.hips.getWorldPosition(new T.Vector3());
  const up = new T.Vector3(0, 1, 0).applyQuaternion(Finv);
  const srcHeight = opts.hipsHeight ?? hips0.clone().sub(source.getWorldPosition(new T.Vector3())).dot(up);
  const scale = srcHeight > 1e-6 ? h.normalizedRestPose.hips.position[1] / srcHeight : 1;

  let restInv;
  try {
    if (opts.tpose !== false) poseToVRM(src, bones, rest, Finv);
    restInv = Object.fromEntries(bones.map((b) => [b, src[b].getWorldQuaternion(new T.Quaternion()).invert()]));
  } finally { restore(); }

  const bound = bindTracks(clip, source);
  const duration = clip.duration > 0 ? clip.duration : 1 / 30;
  const times = sampleTimes(bound.map((x) => x.track), duration, opts.fps);
  const n = times.length;
  const v0 = isVRM0(vrm);
  const rot = Object.fromEntries(bones.map((b) => [b, new Float32Array(n * 4)]));
  const pos = new Float32Array(n * 3);
  const D = Object.fromEntries(bones.map((b) => [b, new T.Quaternion()]));
  const q = new T.Quaternion(), pq = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3();
  try {
    for (let i = 0; i < n; i++) {
      for (const { node, prop, f } of bound) {
        const v = f.evaluate(times[i]);
        if (prop === 'quaternion') node.quaternion.fromArray(v).normalize();
        else node[prop].fromArray(v);
      }
      source.updateWorldMatrix(true, true);
      // World change since the (T-posed) rest, in the VRM 1.0 frame.
      for (const b of bones) {
        src[b].matrixWorld.decompose(p, D[b], s);
        D[b].multiply(restInv[b]).premultiply(F).multiply(Finv);
      }
      for (const b of bones) {
        q.copy(D[b]);
        if (parent[b]) q.premultiply(pq.copy(D[parent[b]]).invert());
        if (v0) { q.x = -q.x; q.z = -q.z; }
        const o = i * 4, out = rot[b];
        // Keep neighbouring keys on the same side, so blends take the short way round.
        const k = i && q.x * out[o - 4] + q.y * out[o - 3] + q.z * out[o - 2] + q.w * out[o - 1] < 0 ? -1 : 1;
        out[o] = q.x * k; out[o + 1] = q.y * k; out[o + 2] = q.z * k; out[o + 3] = q.w * k;
      }
      p.setFromMatrixPosition(src.hips.matrixWorld).sub(hips0).applyQuaternion(F);
      if (opts.inPlace) { p.x = 0; p.z = 0; }
      p.multiplyScalar(scale).add(rest.hips);
      if (v0) { p.x = -p.x; p.z = -p.z; }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    }
  } finally { restore(); }

  const name = (b) => h.getNormalizedBoneNode(b).name;
  const tracks = bones.map((b) => new T.QuaternionKeyframeTrack(`${name(b)}.quaternion`, times.slice(), rot[b]));
  if (opts.translation !== false) tracks.unshift(new T.VectorKeyframeTrack(`${name('hips')}.position`, times.slice(), pos));
  const out = new T.AnimationClip(clip.name || 'retargeted', times[n - 1], tracks);
  const mapped = new Set(bones.map((b) => src[b]));
  out.userData.retarget = {
    map: mapId,
    bones: Object.fromEntries(bones.map((b) => [b, src[b].name])),
    // On the VRM but not driven by the source, and mapped but missing on the VRM (folded into children).
    missing: BONES.filter((b) => h.getNormalizedBoneNode(b) && !src[b] && !/Eye$|^jaw$/.test(b)),
    folded: Object.keys(src).filter((b) => !h.getNormalizedBoneNode(b)),
    driven: bound.filter((x) => mapped.has(x.node)).length,
    keys: n, scale, frame: F.toArray(),
    tpose: opts.tpose !== false, inPlace: !!opts.inPlace, translation: opts.translation !== false,
  };
  return out;
}
