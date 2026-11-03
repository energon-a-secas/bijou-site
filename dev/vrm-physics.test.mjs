// Physics checks that need no browser: the exact springs (js/spring-damper.js),
// the body rig's frame-rate independence (js/vrm-body.js), cone limits
// (js/vrm-limits.js, including three-vrm's own VRMSpringBoneLimitCone cases,
// and colliders winning over a cone), the spring controller's drag floor,
// per-chain variation and hair cones (js/vrm-physics.js) on a small
// synthetic rig, and bad inputs to all of them.
//   node --test dev/vrm-physics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/vendor/avatar-engine.js';
import { spring, advance, kick } from '../js/spring-damper.js';
import { createBody } from '../js/vrm-body.js';
import { SpringConeLimit, setCone, coneOf } from '../js/vrm-limits.js';
import { createSprings, DRAG_FLOOR, PRESETS } from '../js/vrm-physics.js';
import { attachStrip } from '../js/vrm-accessory.js';

const REGIMES = [{ hz: 2.5, ratio: 0.4 }, { hz: 1.3, ratio: 1 }, { hz: 1.5, ratio: 1.7 }];
const close = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b}`);
const DEG = 180 / Math.PI;

test('an exact spring lands on one curve at any step, and on the true solution', () => {
  for (const r of REGIMES) {
    const at = (fps) => {
      const sp = Object.assign(spring(r), { x: -0.2, v: 0.7, goal: 1 }), out = [];
      for (let i = 1; i <= 2 * fps; i++) { advance(sp, 1 / fps); if (i % (fps / 30) === 0) out.push([sp.x, sp.v]); }
      return out;
    };
    const a = at(30), b = at(120);
    a.forEach((p, i) => { close(p[0], b[i][0], 1e-12, `x at ratio ${r.ratio}`); close(p[1], b[i][1], 1e-11, `v at ratio ${r.ratio}`); });
    // RK4 on x'' = -s (x - goal) - d x' with a fine step.
    const s = (2 * Math.PI * r.hz) ** 2, d = r.ratio * 2 * Math.sqrt(s), f = (x, v) => -s * (x - 1) - d * v;
    let x = -0.2, v = 0.7;
    const h = 1e-4;
    for (let i = 0; i < 2 / h; i++) {
      const k1x = v, k1v = f(x, v), k2x = v + h / 2 * k1v, k2v = f(x + h / 2 * k1x, v + h / 2 * k1v);
      const k3x = v + h / 2 * k2v, k3v = f(x + h / 2 * k2x, v + h / 2 * k2v), k4x = v + h * k3v, k4v = f(x + h * k3x, v + h * k3v);
      x += h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); v += h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    }
    close(a.at(-1)[0], x, 1e-7, `closed form vs RK4 at ratio ${r.ratio}`);
  }
});

test('a kick travels the asked distance from rest', () => {
  for (const r of REGIMES) {
    const sp = kick(spring(r, 1), -0.06);
    let far = 0;
    for (let i = 0; i < 6000; i++) { advance(sp, 1 / 3000); far = Math.max(far, 1 - sp.x); }
    close(far, 0.06, 2e-5, `reach at ratio ${r.ratio}`);
  }
});

const fakeVRM = () => ({ scene: new T.Group(), humanoid: { getNormalizedBoneNode: () => null } });

test('the body rig draws the same hop and toss at 30, 60 and 120 frames a second', () => {
  const run = (fps, kickOff) => {
    const body = createBody(fakeVRM()), out = [];
    kickOff(body);
    for (let i = 1; i <= 3 * fps; i++) {
      body.update(1 / fps);
      if (i % (fps / 30) === 0) out.push([body.state.s, body.state.lean, body.root.position.y, body.root.position.x]);
    }
    return out;
  };
  const hop = (b) => b.hop(2.4);
  const toss = (b) => { b.state.airborne = true; b.state.vel.set(0.9, 3.4, 0); };
  for (const kickOff of [hop, toss]) {
    const c30 = run(30, kickOff), c60 = run(60, kickOff), c120 = run(120, kickOff);
    c120.forEach((p, i) => p.forEach((v, k) => { close(c30[i][k], v, 1e-9, `30 fps channel ${k} at ${i}`); close(c60[i][k], v, 1e-9, `60 fps channel ${k} at ${i}`); }));
  }
  // A 2.4 m/s hop lands with a squash of 3 to 8 percent, sampled finely.
  const body = createBody(fakeVRM());
  body.hop(2.4);
  let squash = 0, stretch = 0;
  for (let i = 0; i < 3000; i++) { body.update(1 / 1000); squash = Math.max(squash, 1 - body.state.s); stretch = Math.max(stretch, body.state.s - 1); }
  assert.ok(squash >= 0.03 && squash <= 0.08, `landing squash ${squash}`);
  assert.ok(stretch > 0.02 && stretch <= 0.07, `hop stretch ${stretch}`);
  assert.equal(body.state.airborne, false);
});

test('a twirl eases into a whole turn without swinging back, and leaves her facing front', () => {
  const body = createBody(fakeVRM());
  body.spin(1);
  let last = -Infinity;
  for (let i = 0; i < 5 * 60; i++) {
    body.update(1 / 60);
    const y = body.root.rotation.y;
    assert.ok(y >= last - 1e-12 && y <= 1e-12, `rotation ${y} after ${last}`);
    last = y;
  }
  assert.equal(body.root.rotation.y, 0);
  // A host that places the root itself keeps its rotation once the twirl is done.
  body.root.rotation.y = 0.4;
  body.update(1 / 60);
  assert.equal(body.root.rotation.y, 0.4);
});

test('the cone port matches three-vrm\'s VRMSpringBoneLimitCone cases', () => {
  const Y = new T.Vector3(0, 1, 0), I = new T.Quaternion();
  const prep = (opts) => { const l = new SpringConeLimit(opts); l.internalPrecalcRotation(I, Y); return l; };
  assert.equal(new SpringConeLimit({ angle: -1 }).angle, 0);
  assert.equal(new SpringConeLimit({ angle: 3.15 }).angle, Math.PI);
  const near = (v, x, y, z) => [v.x - x, v.y - y, v.z - z].forEach((e) => assert.ok(Math.abs(e) < 1e-3, `${v.toArray()} vs ${[x, y, z]}`));
  let d = Y.clone();
  assert.equal(prep({ angle: Math.PI / 4 }).calculateLimit(d), false);
  near(d, 0, 1, 0);
  d = new T.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
  assert.equal(prep({ angle: Math.PI / 4 }).calculateLimit(d), true);
  near(d, 0.5, Math.SQRT1_2, -0.5);
  d = new T.Vector3(0, -1, 0);
  assert.equal(prep({ angle: Math.PI / 4 }).calculateLimit(d), true);
  near(d, 0, Math.SQRT1_2, Math.SQRT1_2);
  d = Y.clone();
  assert.equal(prep({ angle: Math.PI / 4, rotation: new T.Quaternion(0, 0, 0.707, 0.707) }).calculateLimit(d), true);
  near(d, -Math.SQRT1_2, Math.SQRT1_2, 0);
});

test('a limited joint stays in its cone and stores the tail it was clamped to', () => {
  const run = (cone) => {
    const parent = new T.Object3D(), bone = new T.Bone(), child = new T.Bone();
    parent.add(bone); bone.add(child); child.position.set(0, -0.1, 0);
    parent.updateMatrixWorld(true);
    const j = new T.VRMSpringBoneJoint(bone, child, { stiffness: 0, gravityPower: 0, dragForce: 0 });
    j.setInitState();
    setCone(j, cone);
    j._prevTail.x -= 0.03; // a hard sideways shove: 1.8 m/s at the tail
    const a = new T.Vector3(), b = new T.Vector3(), seen = { max: 0, step: 0, drift: 0 };
    let before = child.getWorldPosition(new T.Vector3());
    for (let i = 0; i < 40; i++) {
      bone.updateMatrix(); bone.updateWorldMatrix(false, false);
      j.update(1 / 60);
      child.updateWorldMatrix(false, false);
      const tip = child.getWorldPosition(b), dir = tip.clone().sub(bone.getWorldPosition(a)).normalize();
      seen.max = Math.max(seen.max, Math.acos(Math.min(1, -dir.y)) * DEG);
      seen.step = Math.max(seen.step, tip.distanceTo(before));
      seen.drift = Math.max(seen.drift, j._currentTail.distanceTo(tip));
      before = tip.clone();
    }
    return { j, ...seen };
  };
  const free = run(null), held = run(30);
  assert.ok(free.max > 60, `unlimited swing ${free.max}`);
  assert.ok(held.max <= 30 + 1e-6, `limited swing ${held.max}`);
  assert.ok(held.drift < 1e-9, `stored tail ${held.drift} away from the bone's tail`);
  assert.ok(held.step <= 0.03 + 1e-9, `a step moved the tail ${held.step}, more than its own speed (a snap)`);
  assert.equal(coneOf(held.j).toFixed(6), '30.000000');
  setCone(held.j, null);
  assert.equal(coneOf(held.j), null);
  assert.equal(Object.hasOwn(held.j, 'update'), false);
});

test('a collider wins over a cone, and a tail it held past the rim eases back', () => {
  const parent = new T.Object3D(), bone = new T.Bone(), child = new T.Bone();
  parent.add(bone); bone.add(child); child.position.set(0, -0.1, 0);
  // A ball filling the cone under the bone: the tail can only sit outside it about 47 degrees out.
  const ball = new T.VRMSpringBoneCollider(new T.VRMSpringBoneColliderShapeSphere({ radius: 0.08 }));
  ball.position.set(0.005, -0.1, 0);
  parent.add(ball);
  parent.updateMatrixWorld(true);
  ball.updateWorldMatrix(true, false);
  const j = new T.VRMSpringBoneJoint(bone, child, { stiffness: 0.3, gravityPower: 0, dragForce: 0.4 }, [{ colliders: [ball] }]);
  j.setInitState();
  setCone(j, 30);
  const tip = new T.Vector3(), n = new T.Vector3();
  const step = () => { bone.updateMatrix(); bone.updateWorldMatrix(false, false); j.update(1 / 60); child.updateWorldMatrix(false, false); return child.getWorldPosition(tip); };
  const angle = () => Math.acos(Math.min(1, -tip.clone().normalize().y)) * DEG;
  for (let i = 0; i < 90; i++) step();
  // A free joint settles 0.6 mm inside (the vendored push-out, then back to bone length); the rim is 23 mm in.
  const inside = -ball.shape.calculateCollision(ball.colliderMatrix, tip, 0, n);
  assert.ok(inside < 0.001, `the tail sits ${inside * 1000} mm inside the ball`);
  const held = angle();
  assert.ok(held > 40, `held at ${held} degrees, not past the 30 degree rim`);
  // Take the ball away: the tail comes back over several steps, not in one.
  j.colliderGroups = [];
  let last = held, biggest = 0;
  for (let i = 0; i < 90; i++) { step(); biggest = Math.max(biggest, last - angle()); last = angle(); }
  assert.ok(last <= 30 + 1e-6, `still ${last} degrees out after 1.5 s`);
  assert.ok(biggest < 0.5 * (held - 30), `one step took back ${biggest} of ${held - 30} degrees (a snap)`);
});

test('a joint whose limit is cleared behind setCone() runs the plain update', () => {
  const vrm = springRig(), mgr = vrm.springBoneManager, j = [...mgr.joints][0];
  setCone(j, 40);
  j.limit = null;
  assert.doesNotThrow(() => mgr.update(1 / 60));
  j.limit = {};
  assert.doesNotThrow(() => mgr.update(1 / 60));
  assert.ok(Number.isFinite(j.bone.quaternion.x));
});

/** A head with two hair chains, a skirt chain with pixiv's 0.05 drag, and a bust pair. */
function springRig() {
  const scene = new T.Group(), head = new T.Bone(), hips = new T.Bone();
  head.name = 'J_Bip_C_Head'; head.position.set(0, 1.4, 0);
  hips.name = 'J_Bip_C_Hips'; hips.position.set(0, 0.9, 0);
  scene.add(head, hips);
  const mgr = new T.VRMSpringBoneManager();
  const chain = (parent, name, n, settings, at) => {
    let up = parent;
    const bones = [];
    for (let i = 0; i <= n; i++) {
      const b = new T.Bone();
      b.name = `${name}_${i}`;
      b.position.set(...(i ? [0, -0.05, 0] : at));
      up.add(b); bones.push(b); up = b;
    }
    scene.updateMatrixWorld(true);
    for (let i = 0; i < n; i++) {
      const j = new T.VRMSpringBoneJoint(bones[i], bones[i + 1], { gravityDir: new T.Vector3(0, -1, 0), ...settings });
      j.setInitState();
      mgr.addJoint(j);
    }
  };
  chain(head, 'HairJoint-a', 5, { stiffness: 0.5, dragForce: 0.4, gravityPower: 0.05 }, [0.04, 0, -0.08]);
  chain(head, 'HairJoint-b', 5, { stiffness: 0.5, dragForce: 0.4, gravityPower: 0.05 }, [-0.04, 0, -0.08]);
  chain(hips, 'J_Sec_L_Skirt', 3, { stiffness: 0.5, dragForce: 0.05 }, [0.08, 0, 0]);
  chain(head.parent, 'J_Sec_L_Bust', 2, { stiffness: 0.75, dragForce: 0.05 }, [0.06, 1.2, 0.1]);
  return { scene, springBoneManager: mgr, humanoid: { getNormalizedBoneNode: () => null } };
}

test('springs keep a drag floor, vary each chain but never the body, and limit the hair', () => {
  const vrm = springRig(), springs = createSprings(vrm);
  const all = [...vrm.springBoneManager.joints], by = (re) => all.filter((j) => re.test(j.bone.name));
  const snap = () => all.map((j) => [j.bone.name, j.settings.stiffness, j.settings.dragForce]);
  // Floor and cap under every preset and slider extreme.
  for (const p of Object.values(PRESETS)) for (const k of [0.2, 1, 2]) for (const vary of [0, 0.15]) {
    springs.set({ ...p, drag: p.drag * k, stiffness: p.stiffness * k, vary });
    for (const j of by(/skirt|hair/i)) assert.ok(j.settings.dragForce >= DRAG_FLOOR - 1e-12, `${j.bone.name} drag ${j.settings.dragForce}`);
    for (const j of by(/bust/i)) assert.ok(j.settings.stiffness >= 1 && j.settings.dragForce >= 0.35, `${j.bone.name} loosened`);
  }
  // Variation: the body untouched, chains apart, the root 1.5 times the tip.
  springs.set({ ...PRESETS.natural, vary: 0, taper: 1.5 });
  const even = snap(), bust0 = by(/bust/i).map((j) => [j.settings.stiffness, j.settings.dragForce]);
  const [a, b] = [by(/HairJoint-a/), by(/HairJoint-b/)];
  close(a[0].settings.stiffness / a.at(-1).settings.stiffness, 1.5, 1e-12, 'root over tip');
  close(a.reduce((n, j) => n + j.settings.stiffness, 0) / a.length, 0.5, 1e-12, 'mean stiffness kept');
  springs.set({ vary: 0.15 });
  assert.deepEqual(by(/bust/i).map((j) => [j.settings.stiffness, j.settings.dragForce]), bust0);
  // The two hair chains are authored alike, so they are spread across the range, not drawn close.
  const [ka, kb] = [a[0].settings.stiffness, b[0].settings.stiffness];
  close(Math.max(ka, kb) / Math.min(ka, kb), 1.15 / 0.85, 1e-9, 'alike chains spread to both ends');
  assert.notEqual(a[0].settings.dragForce, b[0].settings.dragForce);
  // The skirt sits on the drag floor and still varies, upward from it.
  const skirtDrag = (vary) => (springs.set({ vary }), by(/skirt/i)[0].settings.dragForce);
  assert.equal(skirtDrag(0), DRAG_FLOOR);
  assert.ok(skirtDrag(0.15) > DRAG_FLOOR && skirtDrag(0.15) <= DRAG_FLOOR * 1.15 + 1e-12, `floored skirt drag ${skirtDrag(0.15)}`);
  springs.set({ vary: 0.15 });
  for (const j of [...a, ...b]) {
    const plain = even.find((x) => x[0] === j.bone.name);
    assert.ok(Math.abs(j.settings.stiffness / plain[1] - 1) <= 0.15 + 1e-12, `${j.bone.name} varies past 15 percent`);
  }
  // The same values after refresh(), presets and a fresh controller.
  springs.set({ vary: 0.12 });
  const before = snap();
  springs.refresh(); springs.preset('bouncy'); springs.preset('floaty'); springs.preset('natural');
  assert.deepEqual(snap(), before);
  createSprings(vrm).set({ ...PRESETS.natural });
  assert.deepEqual(snap(), before);
  // Hair takes the hair cone; the skirt and the body stay free.
  assert.ok(by(/hair/i).every((j) => Math.abs(coneOf(j) - 50) < 1e-9));
  assert.ok(by(/skirt|bust/i).every((j) => coneOf(j) === null));
  springs.set({ hairCone: 180 });
  assert.ok(by(/hair/i).every((j) => coneOf(j) === null));
  springs.set({ hairCone: 40 });
  assert.ok(by(/hair/i).every((j) => Math.abs(coneOf(j) - 40) < 1e-9));
});

test('a joint with a cone of its own keeps it; opts.cones covers other names', () => {
  const vrm = springRig();
  const all = [...vrm.springBoneManager.joints];
  const skirt = all.filter((j) => /skirt/i.test(j.bone.name)), hair = all.filter((j) => /hair/i.test(j.bone.name));
  setCone(hair[0], 70);
  const springs = createSprings(vrm, { cones: [{ match: /skirt/i, angle: 45 }] });
  springs.set({ hairCone: 30 });
  assert.equal(Math.round(coneOf(hair[0])), 70);
  assert.equal(Math.round(coneOf(hair[1])), 30);
  assert.ok(skirt.every((j) => Math.abs(coneOf(j) - 45) < 1e-9));
  // Cones set once a controller runs are kept too, on a hair joint or a free one.
  setCone(hair[1], 65);
  springs.set({ hairCone: 20 });
  assert.equal(Math.round(coneOf(hair[1])), 65);
  assert.equal(Math.round(coneOf(hair[2])), 20);
  const other = springRig(), plain = createSprings(other);
  const skirt2 = [...other.springBoneManager.joints].find((j) => /skirt/i.test(j.bone.name));
  setCone(skirt2, 40);
  plain.set({ hairCone: 45 });
  assert.equal(Math.round(coneOf(skirt2)), 40);
});

test('pattern cones ignore global and sticky flags; a strip left free and a bangle stay free', () => {
  for (const match of [/skirt/gi, /Skirt/y, /skirt/i]) {
    const vrm = springRig(), springs = createSprings(vrm, { cones: [{ match, angle: 45 }] });
    const skirt = [...vrm.springBoneManager.joints].filter((j) => /skirt/i.test(j.bone.name));
    for (let i = 0; i < 3; i++) {
      springs.set({ wind: 0 });
      assert.ok(skirt.every((j) => Math.abs(coneOf(j) - 45) < 1e-9), `${match}: ${skirt.map(coneOf)}`);
    }
  }
  const vrm = springRig(), head = vrm.scene.children[0];
  vrm.humanoid.getRawBoneNode = () => head;
  const springs = createSprings(vrm);
  const strip = (name, cone) => attachStrip(vrm, { name, links: 3, cone }).joints;
  const free = [...strip('hairTail', null), ...strip('hairTail2', 180), ...strip('bangle', undefined)];
  springs.refresh();
  springs.set({ hairCone: 40 });
  assert.deepEqual(free.slice(0, 6).map(coneOf), [null, null, null, null, null, null]);
  assert.ok(free.slice(6).every((j) => Math.abs(coneOf(j) - 60) < 1e-9), 'a bangle strip keeps its own 60 degrees');
  assert.ok([...vrm.springBoneManager.joints].filter((j) => /^HairJoint/.test(j.bone.name)).every((j) => Math.abs(coneOf(j) - 40) < 1e-9));
});

test('settings that are undefined or not finite are ignored, and bad springs stay finite', () => {
  const vrm = springRig(), springs = createSprings(vrm), joints = [...vrm.springBoneManager.joints];
  const snap = () => joints.map((j) => [j.settings.stiffness, j.settings.dragForce, coneOf(j)]);
  const before = snap(), state = { ...springs.state };
  springs.set({ vary: undefined, taper: NaN, hairCone: Infinity, stiffness: '2', enabled: undefined, drag: null });
  for (const k of ['vary', 'taper', 'hairCone', 'stiffness', 'enabled', 'drag']) assert.equal(springs.state[k], state[k], k);
  assert.deepEqual(snap(), before);
  vrm.scene.children[0].position.x = 0.1;
  vrm.scene.updateMatrixWorld(true);
  for (let i = 0; i < 60; i++) springs.step(1 / 60);
  assert.equal(springs.state.resets, 0);
  assert.ok(joints.every((j) => Number.isFinite(j.bone.quaternion.x)));
  for (const bad of [{ hz: 0, ratio: 0.4 }, { hz: -2, ratio: 0.4 }, { hz: NaN, ratio: 0.4 }, { hz: 2, ratio: -1 }, { hz: 2, ratio: NaN }, { hz: 2, ratio: 1e6 }, { hz: Infinity, ratio: 0.5 }]) {
    const sp = kick(spring(bad, 1), -0.06);
    for (let i = 0; i < 120; i++) advance(sp, 1 / 60);
    assert.ok(Number.isFinite(sp.x) && Number.isFinite(sp.v), `${JSON.stringify(bad)}: ${sp.x}, ${sp.v}`);
  }
  const body = createBody(fakeVRM(), { springs: { squash: { hz: 0 }, lean: { ratio: undefined }, tilt: { hz: NaN } } });
  body.hop();
  body.spin(NaN);
  body.update(NaN);
  for (let i = 0; i < 120; i++) body.update(1 / 60);
  const squash = body.root.children[0].children[0];
  assert.ok(Number.isFinite(squash.scale.y) && Number.isFinite(body.root.rotation.y) && Number.isFinite(body.root.position.y));
  assert.equal(body.state.springs.lean.ratio, 0.6);
});

test('a teleport is not felt by the springs, even when the substeps split it', () => {
  const swing = (fps) => {
    const vrm = springRig(), body = createBody(vrm), springs = createSprings(vrm, { root: body.root });
    const head = vrm.scene.children[0], tip = [...vrm.springBoneManager.joints].filter((j) => /HairJoint-a/.test(j.bone.name)).at(-1);
    const local = () => head.worldToLocal(tip.child.getWorldPosition(new T.Vector3()));
    for (let i = 0; i < 60; i++) { body.update(1 / 60); springs.step(1 / 60); }
    const rest = local();
    body.root.position.y += 0.8; // the host re-centres her
    let far = 0;
    for (let i = 0; i < fps; i++) { body.update(1 / fps); springs.step(1 / fps); far = Math.max(far, local().distanceTo(rest)); }
    return far;
  };
  for (const fps of [30, 60, 120]) assert.ok(swing(fps) < 0.002, `a 0.8 m jump at ${fps} fps swings the hair ${swing(fps)} m`);
});
