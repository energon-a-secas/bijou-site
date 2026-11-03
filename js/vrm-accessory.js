// ── Runtime accessories with physics ─────────────────────────
// Wardrobe pieces added after load (ribbons, streamers, charms) get their
// own bone chain, skinned strip and VRMSpringBoneJoint per link, registered
// with the avatar's spring manager and its body colliders, so they swing,
// trail and collide like the model's authored hair. Built in world space
// from the avatar's current pose, then parented to a raw bone. Offsets are
// in the avatar's own frame (the parent of vrm.scene, where both VRM 0.x
// and 1.0 models face +Z), so they hold for either version and mid-spin.

import * as T from './vendor/avatar-engine.js';

/** World-space direction of [x, y, z] given in the avatar's frame. */
function inFrame(vrm, v) {
  const frame = vrm.scene.parent || vrm.scene;
  return new T.Vector3(...v).applyQuaternion(frame.getWorldQuaternion(new T.Quaternion()));
}

/**
 * Attach a hanging strip to a humanoid bone.
 * opts: { bone, offset: [x, y, z] in metres (avatar front is +Z), length,
 *         links, width, color, stiffness, gravity, drag, hit, twist }
 * Returns { object, joints, dispose }.
 */
export function attachStrip(vrm, opts = {}) {
  const parent = vrm.humanoid.getRawBoneNode(opts.bone || 'head');
  const mgr = vrm.springBoneManager;
  if (!parent || !mgr) return null;
  const links = opts.links ?? 7;
  const length = opts.length ?? 0.34;
  const width = opts.width ?? 0.045;
  const seg = length / links;
  vrm.scene.updateMatrixWorld(true);

  // Bone chain in world space, then re-expressed in its parents' spaces.
  const start = parent.getWorldPosition(new T.Vector3()).add(inFrame(vrm, opts.offset || [0, 0, 0]));
  const down = inFrame(vrm, [0, -1, 0]);
  const side = inFrame(vrm, [1, 0, 0]);
  const depth = inFrame(vrm, [0, 0, 1]);
  const bones = [];
  let up = parent;
  for (let i = 0; i <= links; i++) {
    const b = new T.Bone();
    b.name = `${opts.name || 'strip'}_${i}`;
    const world = start.clone().addScaledVector(down, seg * i);
    up.add(b);
    up.updateMatrixWorld(true);
    b.position.copy(up.worldToLocal(world.clone()));
    b.updateMatrixWorld(true);
    bones.push(b);
    up = b;
  }

  // A ribbon strip skinned along the chain (world-space bind).
  const geo = new T.PlaneGeometry(width, length, 1, links * 2);
  geo.translate(0, -length / 2, 0);
  const pos = geo.attributes.position;
  const idx = [], wts = [];
  for (let v = 0; v < pos.count; v++) {
    const t = clampT(-pos.getY(v) / seg, 0, links);
    const i = Math.min(links - 1, Math.floor(t)), f = t - i;
    idx.push(i, i + 1, 0, 0);
    wts.push(1 - f, f, 0, 0);
    // A gentle twist along the strip so it catches the light as it swings.
    const twist = (opts.twist ?? 0.6) * (t / links);
    const x = pos.getX(v);
    const p = start.clone().addScaledVector(down, -pos.getY(v))
      .addScaledVector(side, x * Math.cos(twist)).addScaledVector(depth, x * Math.sin(twist));
    pos.setXYZ(v, p.x, p.y, p.z);
  }
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new T.Float32BufferAttribute(wts, 4));
  geo.computeVertexNormals();
  const mat = new T.MeshToonMaterial({ color: opts.color || '#f28cb8', side: T.DoubleSide });
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.name = opts.name || 'strip';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const skeleton = new T.Skeleton(bones);
  vrm.scene.add(mesh);
  vrm.scene.updateMatrixWorld(true);
  mesh.bind(skeleton, new T.Matrix4());

  // One spring joint per link, colliding with the avatar's own colliders.
  const settings = {
    hitRadius: opts.hit ?? 0.02,
    stiffness: opts.stiffness ?? 0.55,
    gravityPower: opts.gravity ?? 0.35,
    gravityDir: new T.Vector3(0, -1, 0),
    dragForce: opts.drag ?? 0.35,
  };
  const groups = mgr.colliderGroups;
  const joints = [];
  for (let i = 0; i < links; i++) {
    const j = new T.VRMSpringBoneJoint(bones[i], bones[i + 1], { ...settings, gravityDir: settings.gravityDir.clone() }, groups);
    j.setInitState();
    mgr.addJoint(j);
    joints.push(j);
  }

  return {
    object: mesh,
    material: mat,
    joints,
    dispose() {
      for (const j of joints) mgr.deleteJoint(j);
      vrm.scene.remove(mesh);
      bones[0].parent?.remove(bones[0]);
      geo.dispose(); mat.dispose();
    },
  };
}

function clampT(n, a, b) { return Math.min(b, Math.max(a, n)); }

/** A pair of hair ribbons with a small bow, tied at the back of the head. */
export function attachRibbons(vrm, color = '#f28cb8') {
  const strips = [-1, 1].map((s) => attachStrip(vrm, {
    name: `ribbon${s < 0 ? 'L' : 'R'}`, bone: 'head', offset: [s * 0.055, 0.07, -0.075],
    length: 0.36, links: 8, width: 0.04, color, twist: s * 0.7,
  })).filter(Boolean);
  const head = vrm.humanoid.getRawBoneNode('head');
  const bowMat = new T.MeshToonMaterial({ color });
  let bow = null;
  if (head) {
    bow = new T.Group();
    bow.name = 'ribbonBow';
    for (const s of [-1, 1]) {
      const loop = new T.Mesh(new T.TorusGeometry(0.026, 0.009, 8, 16), bowMat);
      loop.scale.set(1.25, 0.8, 0.6);
      loop.position.set(s * 0.03, 0, 0);
      bow.add(loop);
    }
    bow.add(new T.Mesh(new T.SphereGeometry(0.013, 12, 8), bowMat));
    bow.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    vrm.scene.updateMatrixWorld(true);
    const at = head.getWorldPosition(new T.Vector3()).add(inFrame(vrm, [0, 0.075, -0.08]));
    head.add(bow);
    bow.position.copy(head.worldToLocal(at));
  }
  const mats = [...strips.map((x) => x.material), bowMat];
  return {
    joints: strips.flatMap((x) => x.joints),
    recolor(c) { for (const m of mats) m.color.set(c); },
    dispose() {
      strips.forEach((x) => x.dispose());
      if (bow) { bow.parent?.remove(bow); bow.traverse((o) => o.geometry?.dispose()); }
      bowMat.dispose();
    },
  };
}
