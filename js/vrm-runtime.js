// ── VRM runtime: loading, description, rest pose ─────────────
// Model-agnostic: any VRM 0.x or 1.0 avatar (a VRoid Studio export, a CC0
// sample, a file the visitor drops in) loads the same way, keeps its own
// materials, expressions and spring physics, and is posed through the
// normalized humanoid so one motion set fits every model.

import * as T from './vendor/avatar-engine.js';

function loader() {
  const l = new T.GLTFLoader();
  l.register((parser) => new T.VRMLoaderPlugin(parser));
  l.register((parser) => new T.VRMAnimationLoaderPlugin(parser));
  return l;
}

async function parse(src) {
  const l = loader();
  if (src instanceof ArrayBuffer) return l.parseAsync(src, '');
  if (src && typeof src.arrayBuffer === 'function') return l.parseAsync(await src.arrayBuffer(), '');
  return l.loadAsync(src);
}

/** Load a VRM avatar from a URL, File, Blob or ArrayBuffer. */
export async function loadVRM(src) {
  const gltf = await parse(src);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('This file does not contain a VRM avatar.');
  T.VRMUtils.removeUnnecessaryVertices(gltf.scene);
  T.VRMUtils.combineSkeletons(gltf.scene);
  T.VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = true;
  });
  vrm.scene.updateMatrixWorld(true);
  vrm.springBoneManager?.reset();
  return { vrm, info: describeVRM(vrm) };
}

/** Load the first VRM Animation (.vrma) in a file. */
export async function loadVRMA(src) {
  const gltf = await parse(src);
  const anim = gltf.userData.vrmAnimations?.[0];
  if (!anim) throw new Error('This file does not contain a VRM animation.');
  return anim;
}

export function disposeVRM(vrm) {
  if (vrm) T.VRMUtils.deepDispose(vrm.scene);
}

const VRM0_LICENSE = {
  CC0: 'CC0 (public domain)', CC_BY: 'CC BY', CC_BY_NC: 'CC BY-NC', CC_BY_NC_ND: 'CC BY-NC-ND',
  CC_BY_NC_SA: 'CC BY-NC-SA', CC_BY_ND: 'CC BY-ND', CC_BY_SA: 'CC BY-SA', Other: 'Other terms',
  Redistribution_Prohibited: 'Redistribution prohibited',
};

/**
 * What the file says about itself: name, author, version, the embedded
 * license terms, and the physics and expressions it carries. The license is
 * what the author declared; it is shown, never assumed.
 */
export function describeVRM(vrm) {
  const m = vrm.meta || {};
  const v1 = m.metaVersion === '1';
  const license = v1 ? {
    summary: m.allowRedistribution ? 'Redistribution allowed' : 'Redistribution not allowed',
    redistribution: !!m.allowRedistribution,
    modification: m.modification || 'unknown',
    avatarUse: m.avatarPermission || 'unknown',
    commercial: m.commercialUsage || 'unknown',
    credit: m.creditNotation || 'unknown',
    url: m.licenseUrl || '',
  } : {
    summary: VRM0_LICENSE[m.licenseName] || 'Unknown license',
    redistribution: ['CC0', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA', 'CC_BY_ND', 'CC_BY_NC_ND'].includes(m.licenseName),
    modification: /ND/.test(m.licenseName || '') ? 'prohibited' : (m.licenseName ? 'see license' : 'unknown'),
    avatarUse: m.allowedUserName || 'unknown',
    commercial: m.commercialUssageName || 'unknown',
    credit: m.licenseName === 'CC0' ? 'unnecessary' : 'see license',
    url: m.otherLicenseUrl || '',
  };
  const joints = vrm.springBoneManager ? [...vrm.springBoneManager.joints] : [];
  const expressions = vrm.expressionManager ? Object.keys(vrm.expressionManager.expressionMap) : [];
  const head = vrm.humanoid.getNormalizedBoneNode('head');
  const p = new T.Vector3();
  if (head) head.getWorldPosition(p);
  return {
    name: (v1 ? m.name : m.title) || 'Untitled avatar',
    author: (v1 ? (m.authors || []).join(', ') : m.author) || 'Unknown author',
    version: v1 ? 'VRM 1.0' : 'VRM 0.x',
    license,
    springs: joints.length,
    colliders: vrm.springBoneManager ? vrm.springBoneManager.colliders.length : 0,
    expressions,
    headHeight: +p.y.toFixed(3),
  };
}

// ── Rest pose ──────────────────────────────────────────────
// VRMs load in a T-pose. A relaxed stance drops the arms, bends the elbows
// a little and curls the fingers. Directions are measured from the model's
// own bones, so VRM 0.x (facing -Z before rotation) and 1.0 pose alike.

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const JOINTS = ['Proximal', 'Intermediate', 'Distal'];

/** +1 when the bone's child points toward +X in its parent's space. */
function sideOf(vrm, bone, child) {
  const a = vrm.humanoid.getNormalizedBoneNode(bone);
  const b = vrm.humanoid.getNormalizedBoneNode(child);
  return a && b && b.position.x < 0 ? -1 : 1;
}

/** Forward along Z in normalized space: +1 for VRM 1.0, -1 for VRM 0.x. */
export const forwardOf = (vrm) => (vrm.meta?.metaVersion === '0' ? -1 : 1);

const Q = () => new T.Quaternion();
const V = (x, y, z) => new T.Vector3(x, y, z).normalize();

/** Quaternion turning a rest direction toward a target direction. */
export function aim(from, to) {
  return Q().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
}

/**
 * The relaxed base pose as a map of bone name to quaternion (normalized
 * space). opts: { drop: arm angle below horizontal (rad), bend, curl }.
 */
export function restPose(vrm, opts = {}) {
  const drop = opts.drop ?? 1.18, bend = opts.bend ?? 0.28, curl = opts.curl ?? 0.32;
  const fwd = forwardOf(vrm);
  const pose = {};
  for (const L of ['left', 'right']) {
    const s = sideOf(vrm, `${L}UpperArm`, `${L}LowerArm`);
    const along = V(s, 0, 0);
    pose[`${L}UpperArm`] = aim(along, V(s * Math.cos(drop), -Math.sin(drop), fwd * 0.12));
    pose[`${L}LowerArm`] = aim(along, V(s * Math.cos(bend), 0, fwd * Math.sin(bend)));
    pose[`${L}Hand`] = aim(along, V(s, -0.08, fwd * 0.12));
    for (const f of FINGERS) {
      JOINTS.forEach((j, k) => {
        const bone = `${L}${f}${j}`;
        if (!vrm.humanoid.getNormalizedBoneNode(bone)) return;
        const c = f === 'Thumb' ? curl * 0.35 : curl * (1 + k * 0.25) * (f === 'Index' ? 0.7 : 1);
        pose[bone] = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -s * c);
      });
    }
  }
  return pose;
}

/** Every humanoid bone the model actually has. */
export function boneNames(vrm) {
  return Object.keys(vrm.humanoid.normalizedHumanBones).filter((n) => vrm.humanoid.getNormalizedBoneNode(n));
}
