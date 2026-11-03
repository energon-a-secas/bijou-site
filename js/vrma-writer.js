// ── VRMA writer ──────────────────────────────────────────────
// Writes a VRM Animation file (.vrma: binary glTF 2.0 with the
// VRMC_vrm_animation extension, specVersion "1.0") from a clip that drives
// a VRM's normalized humanoid: what retargetClip, or createVRMAnimationClip,
// returns. The humanoid goes in as that VRM's own T-pose, in the VRM 1.0
// frame (+Y up, facing +Z) and with no rest rotations, so every key is
// written as it stands: a VRM 0.x clip is turned back into that frame (x and
// z negated), undoing what createVRMAnimationClip does on load. Hips
// translation stays absolute over a rest hips at this VRM's height, so on
// the same model the loader's hips scale is exactly 1. Eyes are left out
// (the spec reserves them for lookAt), and so are expression, lookAt and
// non-humanoid tracks. Written by hand: GLTFExporter is not in the bundle.

import * as T from './vendor/avatar-engine.js';
import { restPositions, isVRM0 } from './vrm-retarget.js';

const PARENT = T.VRMHumanBoneParentMap;
const FLOAT = 5126;
const GLB_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

/** The humanoid bones a .vrma for this VRM declares, parents first. */
function vrmaBones(vrm, rest) {
  return T.VRMHumanBoneList.filter((b) => rest[b] && vrm.humanoid.getNormalizedBoneNode(b) && !/Eye$/.test(b));
}

/**
 * Encode `clip` (tracks on `vrm`'s normalized bone nodes) as a .vrma file.
 * Returns an ArrayBuffer; throws on a NaN or infinite key.
 * opts: { name: the animation's name }
 */
export function writeVRMA(clip, vrm, opts = {}) {
  const v0 = isVRM0(vrm);
  const rest = restPositions(vrm);
  const bones = vrmaBones(vrm, rest);
  const index = new Map(bones.map((b, i) => [b, i]));
  const byNode = new Map(bones.map((b) => [vrm.humanoid.getNormalizedBoneNode(b).name, b]));

  // The T-pose hierarchy: translations only.
  const nodes = bones.map((b) => ({ name: b, translation: rest[b].toArray() }));
  const roots = [];
  bones.forEach((b, i) => {
    let p = PARENT[b];
    while (p && !index.has(p)) p = PARENT[p];
    if (!p) { roots.push(i); return; }
    const t = rest[b].clone().sub(rest[p]);
    nodes[i].translation = t.toArray();
    (nodes[index.get(p)].children ||= []).push(i);
  });

  // Binary data: one buffer view per accessor, all float32 (4-byte aligned).
  const parts = [], bufferViews = [], accessors = [];
  let byteLength = 0;
  function accessor(array, type, count, bounds) {
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: array.byteLength });
    parts.push(array);
    byteLength += array.byteLength;
    accessors.push({ bufferView: bufferViews.length - 1, componentType: FLOAT, count, type, ...bounds });
    return accessors.length - 1;
  }
  const inputs = [];
  function input(times) {
    const t = Float32Array.from(times);
    const same = inputs.find(([u]) => u.length === t.length && u.every((x, i) => x === t[i]));
    if (same) return same[1];
    const at = accessor(t, 'SCALAR', t.length, { min: [t[0]], max: [t[t.length - 1]] });
    inputs.push([t, at]);
    return at;
  }

  const channels = [], samplers = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const bone = byNode.get(track.name.slice(0, dot));
    const prop = track.name.slice(dot + 1);
    const path = prop === 'quaternion' ? 'rotation' : prop === 'position' && bone === 'hips' ? 'translation' : null;
    if (!bone || !path) continue;
    const size = path === 'rotation' ? 4 : 3;
    const values = Float32Array.from(track.values);
    // A NaN key would make the model vanish in any player that loads the file.
    if (!values.every(Number.isFinite) || !track.times.every(Number.isFinite)) throw new Error(`The clip gives ${bone} a NaN or infinite key, so it cannot be saved.`);
    // Back into the VRM 1.0 frame: negate x and z (and nothing else).
    if (v0) for (let i = 0; i < values.length; i += size) { values[i] = -values[i]; values[i + 2] = -values[i + 2]; }
    const out = accessor(values, size === 4 ? 'VEC4' : 'VEC3', values.length / size);
    const interpolation = track.getInterpolation() === T.InterpolateDiscrete ? 'STEP' : 'LINEAR';
    samplers.push({ input: input(track.times), output: out, interpolation });
    channels.push({ sampler: samplers.length - 1, target: { node: index.get(bone), path } });
  }
  if (!channels.length) throw new Error('This clip moves no humanoid bone of the model.');

  const json = {
    asset: { version: '2.0', generator: 'Bijou vrma-writer.js' },
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: { humanBones: Object.fromEntries(bones.map((b, i) => [b, { node: i }])) },
      },
    },
    scene: 0,
    scenes: [{ nodes: roots }],
    nodes,
    animations: [{ name: opts.name || clip.name || 'animation', channels, samplers }],
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  };
  const bin = new Uint8Array(byteLength);
  let at = 0;
  for (const a of parts) { bin.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), at); at += a.byteLength; }
  return packGLB(json, bin);
}

/** A binary glTF container: header, JSON chunk (space padded), BIN chunk (zero padded). */
export function packGLB(json, bin) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = Math.ceil(text.length / 4) * 4;
  const binLen = Math.ceil(bin.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLen + (binLen ? 8 + binLen : 0);
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf), bytes = new Uint8Array(buf);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLen, true);
  view.setUint32(16, CHUNK_JSON, true);
  bytes.fill(0x20, 20, 20 + jsonLen);
  bytes.set(text, 20);
  if (binLen) {
    const o = 20 + jsonLen;
    view.setUint32(o, binLen, true);
    view.setUint32(o + 4, CHUNK_BIN, true);
    bytes.set(bin, o + 8);
  }
  return buf;
}
