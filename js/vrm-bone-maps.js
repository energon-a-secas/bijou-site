// ── Bone maps: source skeleton names to VRM humanoid bones ───
// Used by vrm-retarget.js. Two rig families:
//   mesh2motion: Mesh2Motion's human rig, which uses the Unreal Engine 4
//     mannequin's joint names (pelvis, spine_01, upperarm_l ...), so it fits
//     UE4-style rigs too. Checked against Mesh2Motion's own rig fixture
//     (src/retarget/bone-automap/rig-fixtures.ts at b6dc8faa); its *_leaf
//     end bones and a UE4 root are left unmapped.
//   mixamo: ported from three-vrm's examples/humanoidAnimation/
//     mixamoVRMRigMap.js (v3.5.5), under pixiv's MIT notice below.
// Names match loosely (case, separators, a mixamorig or mixamorig1: prefix),
// since loaders and exporters spell them differently.
//
// mixamoVRMRigMap.js:
// Copyright (c) 2019-2026 pixiv Inc.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/** A map from Mixamo rig name to VRM Humanoid bone name (three-vrm, MIT). */
export const MIXAMO_MAP = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
};

// Mesh2Motion / UE4: one side spelled out, mirrored for _l and _r. The
// thumb's first joint is the metacarpal; pinky is VRM's Little.
const FINGERS = { thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Little' };

function mesh2motionMap() {
  const map = { pelvis: 'hips', spine_01: 'spine', spine_02: 'chest', spine_03: 'upperChest', neck_01: 'neck', head: 'head' };
  for (const [s, L] of [['l', 'left'], ['r', 'right']]) {
    Object.assign(map, {
      [`clavicle_${s}`]: `${L}Shoulder`, [`upperarm_${s}`]: `${L}UpperArm`, [`lowerarm_${s}`]: `${L}LowerArm`, [`hand_${s}`]: `${L}Hand`,
      [`thigh_${s}`]: `${L}UpperLeg`, [`calf_${s}`]: `${L}LowerLeg`, [`foot_${s}`]: `${L}Foot`, [`ball_${s}`]: `${L}Toes`,
    });
    for (const [f, F] of Object.entries(FINGERS)) {
      const joints = f === 'thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
      joints.forEach((j, i) => { map[`${f}_0${i + 1}_${s}`] = `${L}${F}${j}`; });
    }
  }
  return map;
}

export const MESH2MOTION_MAP = mesh2motionMap();

export const BONE_MAPS = {
  mesh2motion: { label: 'Mesh2Motion / Unreal (pelvis, spine_01, upperarm_l)', map: MESH2MOTION_MAP },
  mixamo: { label: 'Mixamo (mixamorig:Hips)', map: MIXAMO_MAP },
};

/** The loose form of a bone name: lowercase letters and digits, no Mixamo prefix. */
export const boneKey = (name) => String(name || '').toLowerCase().replace(/^mixamorig\d*/, '').replace(/[^a-z0-9]/g, '');

/**
 * Find the source node for each VRM bone a map names: { vrmBone: Object3D }.
 * Any node counts (animation-only files load joints as plain Object3Ds);
 * when two share a name, a Bone wins over a mesh or group.
 */
export function matchBones(source, map) {
  const want = new Map(Object.entries(map).map(([k, v]) => [boneKey(k), v]));
  const found = {};
  source.traverse((o) => {
    const bone = want.get(boneKey(o.name));
    if (bone && (!found[bone] || (o.isBone && !found[bone].isBone))) found[bone] = o;
  });
  return found;
}

/** The BONE_MAPS id that names the most nodes in `source`, or null. */
export function guessBoneMap(source) {
  let best = null, most = 0;
  for (const [id, { map }] of Object.entries(BONE_MAPS)) {
    const n = Object.keys(matchBones(source, map)).length;
    if (n > most) { best = id; most = n; }
  }
  return best;
}
