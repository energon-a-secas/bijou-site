// ── Spring cone limits ───────────────────────────────────────
// A cone limit keeps a spring joint's tail within an angle of its rest
// direction, measured in its parent's current frame: each link of a strip
// or a lock stays within that angle of the link above it, so it cannot kink
// or fold sharply at one joint. It does not bound the strip as a whole: an
// eight-link ribbon with 60 degree cones may still bend 480 degrees in all,
// so a long strip can still curl, or trail out over the head, in a hard
// toss or twirl. The vendored three-vrm (3.5.5) has no limits, so this ports
// VRMSpringBoneLimit, VRMSpringBoneLimitCone and the limit-aware
// VRMSpringBoneJoint.update from three-vrm's springbone-limit branch
// (commit 4f61363, packages/three-vrm-springbone/src), the shape the
// ratified VRMC_springBone_limit extension defines.
//
// The bundle is not edited: setCone() gives one joint a limit and installs
// the ported update on that joint alone, so it keeps its identity and its
// place in the spring manager, and removing the limit restores the
// original. Three changes from upstream, each because upstream's hard
// clamp made locks pop or clip in a hard toss (docs/MODELS-AND-MOTION.md):
//   - colliders act last, with the vendored joint's plain push-out, in up
//     to PASSES passes, so a tail pushed out of one collider into another
//     is pushed out again. Upstream limits again after every push-out,
//     which can leave a tail inside the body: a cone turned with a bent
//     parent can point into the chest.
//   - a tail a collider holds past its rim stays where the collider holds
//     it and, once free, eases back over about RETURN seconds. Upstream
//     snaps it back in one step.
//   - a tail the rim stops keeps half its speed per 60 Hz step (RIM_KEEP),
//     so a lock pinned at its rims cannot ride them up to speed and fling
//     free when they turn back.
// The tail stored for the next step is the final one, so the bone and its
// verlet state always agree and the next step starts where the bone is.
// The clamp still stops a tail at once when its own swing reaches the rim,
// so a lock pinned at its rims swings as one stiffer piece while it lasts.
// Should a later three-vrm bring native limits, setCone() only sets
// joint.limit and the joint applies it as upstream does.
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
/** Seconds (exponential) for a tail a collider held past its rim to ease back once free. */
export const RETURN = 0.15;
/** The share of its speed a tail the rim stops keeps, per 1/60 s. */
export const RIM_KEEP = 0.5;
/** Collider passes at most per step. */
export const PASSES = 2;
// Scratch values, reused by every limited joint.
const _quatBoneAxis = new T.Quaternion();
const _worldSpaceInitialRotation = new T.Quaternion();
const _worldSpaceInitialMatrix = new T.Matrix4();
const _worldSpaceInitialMatrixInv = new T.Matrix4();
const _worldSpacePosition = new T.Vector3();
const _nextTail = new T.Vector3();
const _v3A = new T.Vector3();
const _v3B = new T.Vector3();
const _v3C = new T.Vector3();
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
    /** Radians past the rim a collider recently held the tail; it decays once the tail is free. */
    this.slack = 0;
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

  /**
   * Clamp a world-space unit tail direction into the cone in place; true
   * when it was outside. `angle` widens the cone for this call only.
   */
  calculateLimit(tailDir, angle = this.angle) {
    tailDir.applyQuaternion(this._totalRotationInvCache);
    const cosLimitAngle = Math.cos(Math.min(Math.PI, angle));
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

  /** How far (radians) a world-space unit direction is from the cone's axis. */
  angleOf(dir) {
    return Math.acos(T.MathUtils.clamp(_v3C.copy(dir).applyQuaternion(this._totalRotationInvCache).y, -1, 1));
  }
}

/** VRMSpringBoneJoint.update with the limit (springbone-limit branch, with the changes above), installed as a joint's own update. */
function limitedUpdate(delta) {
  const limit = this.limit;
  // A limit cleared or replaced without setCone(): the joint's plain update.
  if (!(limit instanceof SpringConeLimit)) return Object.getPrototypeOf(this).update.call(this, delta);
  if (delta <= 0) return;
  const parentMatrixWorld = this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY;
  _worldSpaceInitialMatrix.copy(parentMatrixWorld).multiply(this._initialLocalMatrix);
  _worldSpaceInitialMatrixInv.copy(_worldSpaceInitialMatrix).invert();
  _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
  this._calcWorldSpaceBoneLength();

  // The limit's frame: parent world rotation times the initial local rotation.
  if (this.bone.parent) this.bone.parent.matrixWorld.decompose(_v3B, _worldSpaceInitialRotation, _scale);
  else _worldSpaceInitialRotation.identity();
  _worldSpaceInitialRotation.multiply(this._initialLocalRotation).normalize();
  limit.internalPrecalcRotation(_worldSpaceInitialRotation, this._boneAxis);

  // Verlet: inertia in center space, then stiffness and gravity in world space.
  const worldSpaceBoneAxis = _v3B.copy(this._boneAxis).transformDirection(_worldSpaceInitialMatrix);
  _nextTail
    .copy(this._currentTail)
    .add(_v3A.subVectors(this._currentTail, this._prevTail).multiplyScalar(1 - this.settings.dragForce))
    .applyMatrix4(this._getMatrixCenterToWorld())
    .addScaledVector(worldSpaceBoneAxis, this.settings.stiffness * delta)
    .addScaledVector(this.settings.gravityDir, this.settings.gravityPower * delta);

  // Back to bone length and into the cone, widened by any slack a collider left.
  _nextTail.sub(_worldSpacePosition).normalize();
  const stopped = limit.calculateLimit(_nextTail, limit.angle + limit.slack);
  _nextTail.multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);

  // Colliders last, with the plain push-out: a collider wins over the cone.
  let touched = false;
  for (let pass = 0; pass < PASSES; pass++) {
    let hit = false;
    for (const group of this.colliderGroups) {
      for (const collider of group.colliders) {
        const dist = collider.shape.calculateCollision(collider.colliderMatrix, _nextTail, this.settings.hitRadius, _v3A);
        if (dist < 0) {
          touched = hit = true;
          _nextTail.addScaledVector(_v3A, -dist).sub(_worldSpacePosition);
          _nextTail.multiplyScalar(this._worldSpaceBoneLength / _nextTail.length()).add(_worldSpacePosition);
        }
      }
    }
    if (!hit) break;
  }
  // Where a collider held the tail past the rim, the next step allows it;
  // once free, that slack fades, so the tail eases back instead of snapping.
  limit.slack = touched
    ? Math.max(0, limit.angleOf(_v3A.copy(_nextTail).sub(_worldSpacePosition).normalize()) - limit.angle)
    : limit.slack * Math.exp(-delta / RETURN);

  // The stored tail is the final one, so the next step's inertia starts where the bone is.
  this._prevTail.copy(this._currentTail);
  this._currentTail.copy(_nextTail).applyMatrix4(this._getMatrixWorldToCenter());
  // A tail the rim stopped keeps only part of its speed, as at an inelastic stop.
  if (stopped && !touched) this._prevTail.lerp(this._currentTail, 1 - RIM_KEEP ** (delta * 60));
  this.bone.quaternion
    .setFromUnitVectors(this._boneAxis, _v3A.copy(_nextTail).applyMatrix4(_worldSpaceInitialMatrixInv).normalize())
    .premultiply(this._initialLocalRotation);
  this.bone.updateMatrix();
  this.bone.matrixWorld.multiplyMatrices(parentMatrixWorld, this.bone.matrix);
}

// Joints an owner holds free: setCone(joint, null, owner). The spring
// controller's cones by name leave them alone, as they do a joint's own cone.
const HELD_FREE = new WeakMap();

/**
 * Limit a spring joint to a cone of `degrees` around its rest direction, or
 * free it (null, or 180 and over). `owner` marks who set it (the spring
 * controller marks the cones it assigns by bone name); freeing a joint with
 * an owner holds it free, and freeing it without one lets go of it. Returns
 * the limit, or null when free.
 */
export function setCone(joint, degrees, owner = null) {
  if (degrees == null || !(degrees < 180)) {
    if (joint.limit instanceof SpringConeLimit) joint.limit = null;
    if (Object.hasOwn(joint, 'update') && joint.update === limitedUpdate) delete joint.update;
    if (owner == null) HELD_FREE.delete(joint);
    else HELD_FREE.set(joint, owner);
    return null;
  }
  HELD_FREE.delete(joint);
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

/**
 * Who holds a joint's cone: the owner its cone was set with (null when set
 * without one, as a cone the file authored is), the owner holding it free,
 * or undefined when nobody holds it.
 */
export function coneOwner(joint) {
  if (joint.limit) return joint.limit.owner ?? null;
  return HELD_FREE.get(joint);
}
