// ── Spring cone limits ───────────────────────────────────────
// A cone limit keeps a spring joint's tail within an angle of its rest
// direction, measured in its parent's current frame, so a ribbon or a lock
// of hair cannot flip over the head or fold back on itself however hard a
// twirl or a toss throws it. The vendored three-vrm (3.5.5) has no limits,
// so this ports VRMSpringBoneLimit, VRMSpringBoneLimitCone and the
// limit-aware VRMSpringBoneJoint.update from three-vrm's springbone-limit
// branch (commit 4f61363, packages/three-vrm-springbone/src), the shape the
// ratified VRMC_springBone_limit extension defines.
//
// The bundle is not edited: setCone() gives one joint a limit and installs
// the ported update on that joint alone, so it keeps its identity and its
// place in the spring manager, and removing the limit restores the
// original. The tail is limited after inertia, stiffness and gravity, and
// again after each collider push-out, and the tail stored for the next step
// is that clamped one: the bone and its verlet state always agree, so the
// next step starts from where the bone really is and nothing snaps. Should
// a later three-vrm bring native limits, setCone() only sets joint.limit.
//
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

import * as T from './vendor/avatar-engine.js';

const DEG = Math.PI / 180;
const SINGULARITY_EPSILON = Math.sqrt(Number.EPSILON);
const POSITIVE_X = new T.Vector3(1, 0, 0);
const POSITIVE_Y = new T.Vector3(0, 1, 0);
const NEGATIVE_Y = new T.Vector3(0, -1, 0);
const IDENTITY = new T.Matrix4();
// Scratch values, reused by every limited joint.
const _quatBoneAxis = new T.Quaternion();
const _worldSpaceInitialRotation = new T.Quaternion();
const _worldSpaceInitialMatrix = new T.Matrix4();
const _worldSpaceInitialMatrixInv = new T.Matrix4();
const _worldSpacePosition = new T.Vector3();
const _nextTail = new T.Vector3();
const _v3A = new T.Vector3();
const _v3B = new T.Vector3();
const _scale = new T.Vector3();

/** A later three-vrm whose joints carry `limit` applies it itself. */
const NATIVE = 'limit' in new T.VRMSpringBoneJoint(new T.Object3D());

/**
 * The VRMC_springBone_limit cone: the tail stays within `angle` (radians,
 * 0 to PI) of the joint's rest direction, turned by `rotation`.
 */
export class SpringConeLimit {
  constructor({ angle = Math.PI, rotation = new T.Quaternion() } = {}) {
    this.angle = T.MathUtils.clamp(angle, 0, Math.PI);
    this.rotation = rotation;
    this._totalRotationCache = new T.Quaternion();
    this._totalRotationInvCache = new T.Quaternion();
  }

  get internalTotalRotationCache() { return this._totalRotationCache; }

  /** The limit's frame for this step, from the rest rotation in current world space and the local bone axis. */
  internalPrecalcRotation(worldSpaceInitialRotation, boneAxis) {
    // A bone axis of (0, -1, 0) turns 180 degrees about X, as the spec defines.
    if (boneAxis.equals(NEGATIVE_Y)) _quatBoneAxis.setFromAxisAngle(POSITIVE_X, Math.PI);
    else _quatBoneAxis.setFromUnitVectors(POSITIVE_Y, boneAxis);
    this._totalRotationCache.copy(worldSpaceInitialRotation).multiply(_quatBoneAxis).multiply(this.rotation);
    this._totalRotationInvCache.copy(this._totalRotationCache).invert();
  }

  /** Clamp a world-space unit tail direction into the cone in place; true when it was outside. */
  calculateLimit(tailDir) {
    tailDir.applyQuaternion(this._totalRotationInvCache);
    const cosLimitAngle = Math.cos(this.angle);
    let isLimited = false;
    if (tailDir.y < cosLimitAngle) {
      isLimited = true;
      // Scale x and z so the direction lands on the cone's rim.
      const horizontalLengthSq = 1 - tailDir.y * tailDir.y;
      if (horizontalLengthSq < SINGULARITY_EPSILON) {
        // Straight down the axis's opposite: take the +Z side.
        tailDir.x = 0;
        tailDir.z = Math.sqrt(1 - cosLimitAngle * cosLimitAngle);
      } else {
        const scale = Math.sqrt((1 - cosLimitAngle * cosLimitAngle) / horizontalLengthSq);
        tailDir.x *= scale;
        tailDir.z *= scale;
      }
      tailDir.y = cosLimitAngle;
    }
    tailDir.applyQuaternion(this._totalRotationCache);
    return isLimited;
  }
}

/** Bring a world-space tail back inside the joint's cone, at bone length. */
function limitTail(joint, tail) {
  tail.sub(_worldSpacePosition).normalize();
  joint.limit.calculateLimit(tail);
  tail.multiplyScalar(joint._worldSpaceBoneLength).add(_worldSpacePosition);
}

/** VRMSpringBoneJoint.update with the limit (springbone-limit branch), installed as a joint's own update. */
function limitedUpdate(delta) {
  if (delta <= 0) return;
  this._calcWorldSpaceBoneLength();
  const parentMatrixWorld = this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY;
  _worldSpaceInitialMatrix.copy(parentMatrixWorld).multiply(this._initialLocalMatrix);
  _worldSpaceInitialMatrixInv.copy(_worldSpaceInitialMatrix).invert();
  _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);

  // The limit's frame: parent world rotation times the initial local rotation.
  if (this.bone.parent) this.bone.parent.matrixWorld.decompose(_v3B, _worldSpaceInitialRotation, _scale);
  else _worldSpaceInitialRotation.identity();
  _worldSpaceInitialRotation.multiply(this._initialLocalRotation).normalize();
  this.limit.internalPrecalcRotation(_worldSpaceInitialRotation, this._boneAxis);

  // Verlet: inertia in center space, then stiffness and gravity in world space.
  const worldSpaceBoneAxis = _v3B.copy(this._boneAxis).transformDirection(_worldSpaceInitialMatrix);
  _nextTail
    .copy(this._currentTail)
    .add(_v3A.subVectors(this._currentTail, this._prevTail).multiplyScalar(1 - this.settings.dragForce))
    .applyMatrix4(this._getMatrixCenterToWorld())
    .addScaledVector(worldSpaceBoneAxis, this.settings.stiffness * delta)
    .addScaledVector(this.settings.gravityDir, this.settings.gravityPower * delta);
  limitTail(this, _nextTail);

  // Collisions, limited again after every push-out.
  for (const group of this.colliderGroups) {
    for (const collider of group.colliders) {
      const dist = collider.shape.calculateCollision(collider.colliderMatrix, _nextTail, this.settings.hitRadius, _v3A);
      if (dist < 0) {
        _nextTail.addScaledVector(_v3A, -dist);
        limitTail(this, _nextTail);
      }
    }
  }

  // The stored tail is the limited one, so the next step's inertia starts where the bone is.
  this._prevTail.copy(this._currentTail);
  this._currentTail.copy(_nextTail).applyMatrix4(this._getMatrixWorldToCenter());
  this.bone.quaternion
    .setFromUnitVectors(this._boneAxis, _v3A.copy(_nextTail).applyMatrix4(_worldSpaceInitialMatrixInv).normalize())
    .premultiply(this._initialLocalRotation);
  this.bone.updateMatrix();
  this.bone.matrixWorld.multiplyMatrices(parentMatrixWorld, this.bone.matrix);
}

/**
 * Limit a spring joint to a cone of `degrees` around its rest direction, or
 * free it (null, or 180 and over). `owner` marks who set it (the spring
 * controller marks the cones it assigns by bone name). Returns the limit,
 * or null when free.
 */
export function setCone(joint, degrees, owner = null) {
  if (degrees == null || !(degrees < 180)) {
    if (joint.limit instanceof SpringConeLimit) joint.limit = null;
    if (Object.hasOwn(joint, 'update') && joint.update === limitedUpdate) delete joint.update;
    return null;
  }
  if (!(joint.limit instanceof SpringConeLimit)) joint.limit = new SpringConeLimit();
  joint.limit.angle = T.MathUtils.clamp(degrees * DEG, 0, Math.PI);
  joint.limit.owner = owner;
  if (!NATIVE && joint.update !== limitedUpdate) joint.update = limitedUpdate;
  return joint.limit;
}

/** A joint's cone in degrees, or null when it is free. */
export function coneOf(joint) {
  return joint.limit && joint.limit.angle < Math.PI ? joint.limit.angle / DEG : null;
}
