// Headless physics check for the Doll Lab: the spring controller
// (js/vrm-physics.js), the whole-body rig (js/vrm-body.js) and cone limits
// (js/vrm-limits.js), measured on the default model with idle motion off.
//   - A hair chain after a hop at 30, 60 and 120 frames a second: how many
//     times it swings, how long it takes to settle, how far it moves.
//   - The squash and lean curves of the same hop and toss at those rates:
//     peaks (the squash spring's own value, not the clamped scale), and how
//     far the curves drift between rates.
//   - What the cone limits change, each move run with and without them:
//     how far a hair lock or a ribbon swings from rest as a whole, the
//     largest single-frame jump of any tail (a pop), and how deep a hair
//     tail sits inside a body collider (clipping).
//   - The smallest drag any non-body joint reaches under every preset and
//     slider extreme (floor 0.12), and the body cap (stiffness 1, drag 0.35).
//   - Per-chain variation: body springs untouched, chains the file authored
//     alike kept apart, floored chains still varied in drag, root stiffer
//     than tip, and the same values after refresh(), preset changes and
//     re-adding the ribbons.
//   - Bouncy is not jelly: hair, ribbon and skirt settle after a hop.
// Prints one line per measurement; exits 1 when a bound fails.
//   LAB_URL=http://localhost:8897 node dev/physics-check.cjs [outDir]
// NODE_PATH can supply Playwright from the monorepo root node_modules.
const BASE = (process.env.LAB_URL || 'http://localhost:8897').replace(/\/$/, '');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../../../node_modules/playwright')); }
const path = require('node:path');
const fs = require('node:fs');

const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'bijou-physics');
fs.mkdirSync(out, { recursive: true });
const RATES = [30, 60, 120];
const failures = [];
const expect = (ok, what) => { if (!ok) failures.push(what); };
const r4 = (n) => +n.toFixed(4);

// Swings and settling of a tip's offset from rest (head space). A swing is
// an excursion past the threshold on the side opposite the last one, along
// the direction of the largest offset; settled is the last time the offset
// exceeds the threshold.
function swingsOf(rec, from = 0) {
  const mag = rec.map((r) => Math.hypot(...r.d));
  const iPeak = mag.indexOf(Math.max(...mag));
  const peak = mag[iPeak];
  const u = rec[iPeak].d.map((x) => x / (peak || 1));
  const thr = Math.max(0.002, 0.1 * peak);
  let swings = 0, side = 0, last = from;
  for (let i = from; i < rec.length; i++) {
    const p = rec[i].d[0] * u[0] + rec[i].d[1] * u[1] + rec[i].d[2] * u[2];
    if (Math.abs(p) > thr && Math.sign(p) !== side) { swings++; side = Math.sign(p); }
    if (mag[i] > thr) last = i;
  }
  return { peak: r4(peak), swings, settle: r4(rec[last].t - (from ? rec[from].t : 0)) };
}

/** Largest gap between two curves at the times both sampled (every 1/30 s). */
function drift(a, b, key) {
  const at = (rec, t) => rec.find((r) => Math.abs(r.t - t) < 1e-6);
  let max = 0;
  for (const r of a) { const q = at(b, r.t); if (q) max = Math.max(max, Math.abs(r[key] - q[key])); }
  return max;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/dev/lab.html?still=1&v=${Date.now()}`);
  await page.waitForFunction(() => window.lab && window.lab.cur, null, { timeout: 60000 });

  // In-page helpers: a quiet doll, a rig and springs at rest, chains and cone angles.
  const env = await page.evaluate(async () => {
    const T = await import('/js/vendor/avatar-engine.js');
    const { PRESETS } = await import('/js/vrm-physics.js');
    const lab = window.lab;
    const BODY = /bust|breast|chest|belly|butt|thigh/i;
    const pc = window.pc = { T, PRESETS, BODY };
    const cur = () => lab.cur;
    pc.joints = () => [...cur().vrm.springBoneManager.joints];
    pc.quiet = () => {
      const m = cur().motion.state;
      m.idle = 0; m.sleepAfter = 0; m.gestures = [];
      cur().springs.set({ ...PRESETS.natural, wind: 0, bounce: 1, inertia: 0.4 });
    };
    pc.rest = () => {
      const { body, springs } = cur(), st = body.state;
      st.held = false; st.airborne = false; st.vel.set(0, 0, 0);
      body.root.position.set(0, 0, 0); body.root.rotation.set(0, 0, 0);
      Object.assign(st, { s: 1, sV: 0, lean: 0, leanV: 0, tilt: 0, tiltV: 0, spin: 0, spinV: 0 });
      if (st.springs) for (const sp of Object.values(st.springs)) { sp.goal = sp === st.springs.squash ? 1 : 0; sp.x = sp.goal; sp.v = 0; }
      springs.reset();
      for (let i = 0; i < 150; i++) lab.frame(1 / 60);
      springs.state.acc = 0;
    };
    // Joints grouped into chains by the bone hierarchy, root first.
    pc.chains = () => {
      const js = pc.joints(), byBone = new Map(js.map((j) => [j.bone, j])), groups = new Map();
      for (const j of js) {
        let top = j.bone, depth = 0;
        while (top.parent && byBone.has(top.parent)) { top = top.parent; depth++; }
        if (!groups.has(top)) groups.set(top, []);
        groups.get(top).push([depth, j]);
      }
      return [...groups.values()].map((g) => g.sort((a, b) => a[0] - b[0]).map((x) => x[1]));
    };
    pc.tail = (j, out = new T.Vector3()) => (j.child ? j.child.getWorldPosition(out) : j._initialLocalChildPosition.clone().applyMatrix4(j.bone.matrixWorld));
    // Angle (degrees) between a joint's tail and its rest direction in its parent's current frame: the cone axis.
    const q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
    pc.coneAngle = (j) => {
      if (j.bone.parent) { j.bone.parent.updateWorldMatrix(true, false); j.bone.parent.matrixWorld.decompose(p, q, s); } else q.identity();
      q.multiply(j._initialLocalRotation).normalize();
      const axis = j._boneAxis.clone().applyQuaternion(q);
      j.bone.getWorldPosition(a);
      const dir = pc.tail(j, b).sub(a).normalize();
      return Math.acos(Math.min(1, Math.max(-1, dir.dot(axis)))) * 180 / Math.PI;
    };
    pc.quiet();
    pc.rest();
    const chains = pc.chains();
    const hair = chains.filter((c) => /hair/i.test(c[0].bone.name)).sort((x, y) => y.length - x.length);
    return { joints: pc.joints().length, chains: chains.length, hairChains: hair.length, longestHair: hair[0]?.length || 0, hasVary: 'vary' in cur().springs.state, hasCones: 'hairCone' in cur().springs.state, bodySprings: !!cur().body.state.springs };
  });
  console.log('model:', JSON.stringify(env));

  // ── Hop and toss at 30, 60 and 120 frames a second ─────────
  const runs = {};
  for (const fps of RATES) {
    runs[fps] = await page.evaluate(({ fps }) => {
      const { lab, pc } = { lab: window.lab, pc: window.pc };
      const { body, vrm } = lab.cur;
      const head = vrm.humanoid.getRawBoneNode('head');
      const chain = pc.chains().filter((c) => /hair/i.test(c[0].bone.name)).sort((x, y) => y.length - x.length)[0];
      const tipJ = chain[chain.length - 1];
      const tip = () => { head.updateWorldMatrix(true, false); return head.worldToLocal(pc.tail(tipJ)); };
      const record = (kick, seconds) => {
        pc.rest();
        const rest = tip();
        kick();
        const dt = 1 / fps, out = [];
        // s is the squash scale the model shows (clamped); sx is the squash spring itself.
        const sx = () => (body.state.springs ? body.state.springs.squash.x : body.state.s);
        for (let i = 1; i <= Math.round(seconds * fps); i++) {
          lab.frame(dt);
          out.push({ t: i / fps, d: tip().sub(rest).toArray(), s: body.state.s, sx: sx(), lean: body.state.lean, air: body.state.airborne });
        }
        return out;
      };
      const hop = record(() => body.hop(2.4), 4);
      const toss = record(() => { body.state.airborne = true; body.state.vel.set(0.9, 3.4, 0); }, 4);
      return { hop, toss, chain: chain.length, tip: tipJ.bone.name.slice(0, 18) };
    }, { fps });
  }
  const hairRows = {};
  for (const fps of RATES) {
    const { hop, toss } = runs[fps];
    const land = hop.findLastIndex((r, i) => i > 0 && hop[i - 1].air && !r.air);
    const whole = swingsOf(hop), after = swingsOf(hop, Math.max(0, land));
    const s = hop.map((r) => r.sx), ts = toss.map((r) => r.sx);
    hairRows[fps] = {
      hairPeak: whole.peak, swings: whole.swings, settle: whole.settle,
      swingsAfterLanding: after.swings, settleAfterLanding: after.settle, landedAt: r4(hop[land]?.t ?? NaN),
      hopStretch: r4(Math.max(...s) - 1), hopSquash: r4(1 - Math.min(...s)), tossSquash: r4(1 - Math.min(...ts)),
      tossLean: r4(Math.max(...toss.map((r) => Math.abs(r.lean)))),
    };
    console.log(`hop and toss at ${fps} fps:`, JSON.stringify(hairRows[fps]));
  }
  const drifts = {
    squash30v120: r4(drift(runs[30].hop, runs[120].hop, 'sx')), squash60v120: r4(drift(runs[60].hop, runs[120].hop, 'sx')),
    tossSquash30v120: r4(drift(runs[30].toss, runs[120].toss, 'sx')),
    lean30v120: r4(drift(runs[30].toss, runs[120].toss, 'lean')), lean60v120: r4(drift(runs[60].toss, runs[120].toss, 'lean')),
  };
  console.log('rig curve drift between rates:', JSON.stringify(drifts));
  fs.writeFileSync(path.join(out, 'physics-curves.json'), JSON.stringify(Object.fromEntries(RATES.map((f) => [f, {
    hop: runs[f].hop.map((r) => [r4(r.t), r4(r.sx), r4(r.lean), r4(Math.hypot(...r.d))]),
    toss: runs[f].toss.map((r) => [r4(r.t), r4(r.sx), r4(r.lean), r4(Math.hypot(...r.d))]),
  }]))));
  for (const fps of RATES) {
    const h = hairRows[fps];
    expect(h.hopSquash >= 0.03 && h.hopSquash <= 0.08, `landing squash at ${fps} fps is ${h.hopSquash}, outside 3 to 8 percent`);
    expect(h.tossSquash <= 0.08 + 1e-6, `toss landing squash at ${fps} fps is ${h.tossSquash}, over 8 percent`);
    expect(Math.abs(h.hairPeak - hairRows[60].hairPeak) <= 0.15 * hairRows[60].hairPeak, `hair peak at ${fps} fps differs from 60 fps by over 15 percent`);
    expect(Math.abs(h.swingsAfterLanding - hairRows[60].swingsAfterLanding) <= 1, `hair swings after landing at ${fps} fps differ from 60 fps by more than one`);
    expect(Math.abs(h.settle - hairRows[60].settle) <= 0.25, `hair settle time at ${fps} fps differs from 60 fps by over 0.25 s`);
  }
  expect(Math.max(drifts.squash30v120, drifts.squash60v120, drifts.tossSquash30v120) < 1e-3, 'squash curve drifts with frame rate');
  expect(Math.max(drifts.lean30v120, drifts.lean60v120) < 1e-3, 'lean curve drifts with frame rate');

  // ── Cones on versus off (60 fps) ───────────────────────────
  // Each move runs from rest twice, with the cones (hair and ribbons) and
  // without, for 3 s. lock: the largest angle between a lock's or a strip's
  // root-to-tip direction and its rest direction, in head space (a cone
  // holds each link to the one above it, so this is what it does to the
  // whole). jump: the largest move of any hair or ribbon tail in one frame,
  // in head space (a pop). clip: the deepest a hair tail sits inside a body
  // collider. pastRim: how far colliders, which win over cones, hold a
  // limited joint past its rim.
  const coneRuns = await page.evaluate(async () => {
    const { lab, pc } = { lab: window.lab, pc: window.pc };
    const { setCone } = await import('/js/vrm-limits.js');
    const T = pc.T, head = lab.cur.vrm.humanoid.getRawBoneNode('head');
    pc.quiet();
    const chains = pc.chains();
    const hairC = chains.filter((c) => /hair/i.test(c[0].bone.name) && c.length >= 3), ribC = chains.filter((c) => /^ribbon/i.test(c[0].bone.name));
    const hairJ = pc.joints().filter((j) => /hair/i.test(j.bone.name)), ribJ = pc.joints().filter((j) => /^ribbon/i.test(j.bone.name));
    const hairCone = lab.cur.springs.state.hairCone ?? 50, ribCone = ribJ[0]?.limit ? ribJ[0].limit.angle * 180 / Math.PI : 60;
    const cones = (on) => { lab.cur.springs.set({ hairCone: on ? hairCone : 180 }); for (const j of ribJ) setCone(j, on ? ribCone : null); };
    const local = (v) => head.worldToLocal(v);
    const lockDir = (c) => local(pc.tail(c[c.length - 1])).sub(local(c[0].bone.getWorldPosition(new T.Vector3()))).normalize();
    const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;
    const n = new T.Vector3();
    const clip = () => {
      let worst = 0;
      for (const j of hairJ) {
        const t = pc.tail(j);
        for (const g of j.colliderGroups) for (const c of g.colliders) worst = Math.max(worst, -c.shape.calculateCollision(c.colliderMatrix, t, j.settings.hitRadius, n));
      }
      return worst;
    };
    const moves = {
      'Lab Toss': (b) => { b.state.airborne = true; b.state.vel.set(1.6, 3.2, 0); },
      'Lab Twirl': (b) => b.spin(1),
      'Lab Hop': (b) => b.hop(),
      'toss at 6 m/s': (b) => { b.state.airborne = true; b.state.vel.set(1.2, 6, 0); },
      'thrown up at 4 m/s': (b) => { b.state.airborne = true; b.state.vel.set(0, 4, 0); },
      'three twirls': (b) => b.spin(3),
      'dropped from 0.8 m': (b) => { b.root.position.y = 0.8; b.state.airborne = true; },
      'dropped from 1.2 m': (b) => { b.root.position.y = 1.2; b.state.airborne = true; },
    };
    const out = {};
    for (const [name, move] of Object.entries(moves)) {
      out[name] = {};
      for (const on of [false, true]) {
        cones(on);
        pc.rest();
        head.updateWorldMatrix(true, false);
        const rest = { hair: hairC.map(lockDir), ribbon: ribC.map(lockDir) };
        const tails = () => { head.updateWorldMatrix(true, false); return [...hairJ, ...ribJ].map((j) => local(pc.tail(j))); };
        let prev = tails();
        move(lab.cur.body);
        const r = { hairLock: 0, ribbonLock: 0, hairJump: 0, ribbonJump: 0, clip: 0, pastRim: 0 };
        for (let i = 0; i < 180; i++) {
          lab.frame(1 / 60);
          head.updateWorldMatrix(true, false);
          hairC.forEach((c, k) => { r.hairLock = Math.max(r.hairLock, deg(lockDir(c), rest.hair[k])); });
          ribC.forEach((c, k) => { r.ribbonLock = Math.max(r.ribbonLock, deg(lockDir(c), rest.ribbon[k])); });
          const now = tails();
          now.forEach((v, k) => { const d = v.distanceTo(prev[k]); if (k < hairJ.length) r.hairJump = Math.max(r.hairJump, d); else r.ribbonJump = Math.max(r.ribbonJump, d); });
          prev = now;
          r.clip = Math.max(r.clip, clip());
          if (on) for (const j of [...hairJ, ...ribJ]) if (j.limit) r.pastRim = Math.max(r.pastRim, pc.coneAngle(j) - j.limit.angle * 180 / Math.PI);
        }
        out[name][on ? 'on' : 'off'] = r;
      }
    }
    cones(true);
    const finite = pc.joints().every((j) => Number.isFinite(j.bone.quaternion.x));
    pc.quiet(); pc.rest();
    return { out, hairCone, ribCone, finite, limited: pc.joints().filter((j) => j.limit).length, hairAtRest: Math.max(...hairJ.map(pc.coneAngle)) };
  });
  const r1 = (n) => +n.toFixed(1), cm = (m) => r1(m * 100), mm = (m) => r1(m * 1000);
  console.log(`cones: hair ${coneRuns.hairCone}, ribbons ${r1(coneRuns.ribCone)} degrees per link; ${coneRuns.limited} joints limited; hair sits up to ${r1(coneRuns.hairAtRest)} degrees off rest at rest`);
  for (const [name, { on, off }] of Object.entries(coneRuns.out)) {
    const pair = (k, f) => `${f(on[k])}/${f(off[k])}`;
    console.log(`  ${name}, cones on/off: lock hair ${pair('hairLock', r1)}, ribbon ${pair('ribbonLock', r1)} deg; jump hair ${pair('hairJump', cm)}, ribbon ${pair('ribbonJump', cm)} cm; clip ${pair('clip', mm)} mm; past rim ${r1(on.pastRim)} deg`);
    expect(on.clip <= off.clip + 0.005, `${name}: with cones hair clips ${mm(on.clip)} mm into the body, against ${mm(off.clip)} mm without`);
    expect(on.hairJump <= 1.5 * off.hairJump + 0.01 && on.ribbonJump <= 1.5 * off.ribbonJump + 0.01, `${name}: cones make a tail pop (hair ${cm(on.hairJump)} cm in a frame, ${cm(off.hairJump)} without; ribbon ${cm(on.ribbonJump)}, ${cm(off.ribbonJump)})`);
    expect(on.hairLock <= off.hairLock + 5 && on.ribbonLock <= off.ribbonLock + 5, `${name}: cones let a lock or strip swing further (hair ${r1(on.hairLock)} against ${r1(off.hairLock)}, ribbon ${r1(on.ribbonLock)} against ${r1(off.ribbonLock)})`);
  }
  const worstLock = (side) => Math.max(...Object.values(coneRuns.out).map((r) => r[side].hairLock));
  expect(worstLock('on') <= worstLock('off') - 15, `the hair cone keeps the worst lock to ${r1(worstLock('on'))} degrees from rest, against ${r1(worstLock('off'))} without (want 15 less)`);
  expect(coneRuns.finite, 'spring bones went non-finite during the cone runs');

  // ── Drag floor and body cap under every preset and slider extreme ──
  const drag = await page.evaluate(() => {
    const { lab, pc } = { lab: window.lab, pc: window.pc };
    const js = pc.joints(), body = js.filter((j) => pc.BODY.test(j.bone.name)), rest = js.filter((j) => !pc.BODY.test(j.bone.name));
    let minDrag = Infinity, minBodyDrag = Infinity, minBodyK = Infinity, worst = '';
    const perPreset = {};
    for (const [name, p] of Object.entries(pc.PRESETS)) {
      for (const d of [0.2, 1, 2]) for (const vary of [0, 0.15]) for (const stiffness of [0.2, 2]) {
        lab.cur.springs.set({ ...p, drag: p.drag * d, stiffness: p.stiffness * stiffness, vary, wind: 0 });
        for (const j of rest) if (j.settings.dragForce < minDrag) { minDrag = j.settings.dragForce; worst = `${name} x${d}`; }
        for (const j of body) { minBodyDrag = Math.min(minBodyDrag, j.settings.dragForce); minBodyK = Math.min(minBodyK, j.settings.stiffness); }
      }
      lab.cur.springs.set({ ...p, vary: 0.12 });
      perPreset[name] = +Math.min(...rest.map((j) => j.settings.dragForce)).toFixed(4);
    }
    pc.quiet();
    return { minDrag: +minDrag.toFixed(4), worst, perPreset, minBodyDrag: +minBodyDrag.toFixed(4), minBodyStiffness: +minBodyK.toFixed(4) };
  });
  console.log('drag floor and body cap:', JSON.stringify(drag));
  expect(drag.minDrag >= 0.12 - 1e-9, `a non-body joint reached drag ${drag.minDrag} (${drag.worst}), under the 0.12 floor`);
  expect(drag.minBodyDrag >= 0.35 - 1e-9 && drag.minBodyStiffness >= 1 - 1e-9, 'a body spring was loosened past its cap');

  // ── Per-chain variation ────────────────────────────────────
  const vary = await page.evaluate(() => {
    const { lab, pc } = { lab: window.lab, pc: window.pc };
    const sp = () => lab.cur.springs;
    const snap = (pred) => Object.fromEntries(pc.joints().filter(pred).map((j) => [j.bone.name, [j.settings.stiffness, j.settings.dragForce, j.settings.gravityPower]]));
    const isBody = (j) => pc.BODY.test(j.bone.name);
    sp().set({ ...pc.PRESETS.natural, vary: 0, taper: 1 });
    const body0 = snap(isBody), plain = snap((j) => !isBody(j));
    sp().set({ vary: 0, taper: 1.5 });
    const tapered = snap((j) => !isBody(j));
    sp().set({ vary: 0.15, taper: 1.5 });
    const body1 = snap(isBody), varied = snap((j) => !isBody(j));
    const bodyUntouched = JSON.stringify(body0) === JSON.stringify(body1);
    sp().set({ vary: 0.12, taper: 1.5 });
    const before = snap(() => true);
    // Chain factors at the default variation, over the taper alone.
    const chains = pc.chains().filter((c) => !isBody(c[0]));
    const k = (j) => j.settings.stiffness / tapered[j.bone.name][0];
    const d = (j) => j.settings.dragForce / Math.max(1e-9, tapered[j.bone.name][1]);
    const spread = chains.map((c) => Math.abs(k(c[0]) - 1));
    // Chains the file authored alike (the same length, plain stiffness, drag
    // and gravity) swing in lockstep unless variation keeps them apart.
    let alikePairs = 0, closest = { gap: Infinity, a: '', b: '' };
    for (let a = 0; a < chains.length; a++) for (let b = a + 1; b < chains.length; b++) {
      const A = chains[a], B = chains[b], pa = plain[A[0].bone.name], pb = plain[B[0].bone.name];
      if (A.length !== B.length || pa.some((v, i) => Math.abs(v - pb[i]) > 1e-6)) continue;
      alikePairs++;
      const gap = Math.max(Math.abs(k(A[0]) - k(B[0])), Math.abs(d(A[0]) - d(B[0])));
      if (gap < closest.gap) closest = { gap: +gap.toFixed(4), a: A[0].bone.name.slice(0, 22), b: B[0].bone.name.slice(0, 22) };
    }
    // Joints the drag floor holds still vary, upward from it.
    const floored = pc.joints().filter((j) => !isBody(j) && Math.abs(plain[j.bone.name][1] - 0.12) < 1e-9).map((j) => j.settings.dragForce);
    const long = chains.filter((c) => c.length >= 3);
    const taper = long.map((c) => +(tapered[c[0].bone.name][0] / tapered[c[c.length - 1].bone.name][0]).toFixed(3));
    const ribbons = chains.filter((c) => /^ribbon/i.test(c[0].bone.name)).map((c) => [+k(c[0]).toFixed(4), +d(c[0]).toFixed(4)]);
    // Survives refresh(), preset changes and re-adding the ribbons.
    sp().refresh();
    sp().set({ ...pc.PRESETS.bouncy }); sp().set({ ...pc.PRESETS.floaty }); sp().set({ ...pc.PRESETS.natural });
    lab.ribbons(false); lab.ribbons(true);
    sp().set({ ...pc.PRESETS.natural });
    const after = snap(() => true);
    const stable = Object.keys(before).every((n) => after[n] && before[n].every((v, i) => Math.abs(v - after[n][i]) < 1e-9));
    pc.quiet();
    return {
      bodyUntouched, bodyJoints: Object.keys(body0).length, chains: chains.length, alikePairs, closestAlike: closest,
      floored: floored.length ? { joints: floored.length, min: +Math.min(...floored).toFixed(4), max: +Math.max(...floored).toFixed(4) } : null,
      maxSpread: +Math.max(...spread).toFixed(4),
      rootToTip: taper.length ? [Math.min(...taper), Math.max(...taper)] : null, ribbons, stable,
      anyVaried: Object.keys(plain).some((n) => Math.abs(plain[n][0] - varied[n][0]) > 1e-9),
    };
  });
  console.log('per-chain variation:', JSON.stringify(vary));
  expect(vary.bodyUntouched, 'variation changed a body spring');
  expect(vary.anyVaried && (vary.alikePairs === 0 || vary.closestAlike.gap >= 0.03), `chains authored alike end up ${vary.closestAlike.gap} apart in stiffness and drag (lockstep; want 0.03)`);
  expect(!vary.floored || (vary.floored.min >= 0.12 - 1e-9 && vary.floored.max - vary.floored.min >= 0.03 * 0.12), 'joints at the drag floor all share one drag (no variation)');
  expect(vary.maxSpread <= 0.15 + 1e-6, `a chain varies by ${vary.maxSpread}, over 15 percent`);
  expect(vary.rootToTip && vary.rootToTip[0] >= 1.3 && vary.rootToTip[1] <= 1.7, 'long chains are not about 1.5 times stiffer at the root');
  expect(vary.ribbons.length === 2 && (vary.ribbons[0][0] !== vary.ribbons[1][0] || vary.ribbons[0][1] !== vary.ribbons[1][1]), 'the two ribbons move in lockstep');
  expect(vary.stable, 'variation changed after refresh(), presets or re-adding the ribbons');

  // ── Bouncy never reads as jelly ────────────────────────────
  // Swings after the landing of a hop under Bouncy, for the longest hair,
  // ribbon and skirt chains, each tip in its chain's parent frame. (This
  // model's skirt has joints but no mesh; its authored drag is 0.05.)
  const bouncyRuns = await page.evaluate(() => {
    const { lab, pc } = { lab: window.lab, pc: window.pc };
    const { body } = lab.cur;
    pc.quiet();
    lab.cur.springs.set({ ...pc.PRESETS.bouncy });
    const pick = (re) => pc.chains().filter((c) => re.test(c[0].bone.name)).sort((a, b) => b.length - a.length)[0];
    const watch = Object.entries({ hair: pick(/hair/i), ribbon: pick(/^ribbon/i), skirt: pick(/skirt/i) }).filter(([, c]) => c);
    const tip = (c) => { const f = c[0].bone.parent; f.updateWorldMatrix(true, false); return f.worldToLocal(pc.tail(c[c.length - 1])); };
    pc.rest();
    const rest = watch.map(([, c]) => tip(c));
    body.hop(2.4);
    const out = Object.fromEntries(watch.map(([k]) => [k, []]));
    for (let i = 1; i <= 240; i++) {
      lab.frame(1 / 60);
      watch.forEach(([k, c], n) => out[k].push({ t: i / 60, d: tip(c).sub(rest[n]).toArray(), air: body.state.airborne }));
    }
    const drag = Object.fromEntries(watch.map(([k, c]) => [k, +c[c.length - 1].settings.dragForce.toFixed(3)]));
    pc.quiet();
    return { out, drag };
  });
  const bouncy = {};
  for (const [k, rec] of Object.entries(bouncyRuns.out)) {
    const land = rec.findLastIndex((r, i) => i > 0 && rec[i - 1].air && !r.air);
    const s = swingsOf(rec, Math.max(0, land));
    bouncy[k] = { drag: bouncyRuns.drag[k], swingsAfterLanding: s.swings, settleAfterLanding: s.settle };
  }
  console.log('bouncy, after a hop at 60 fps:', JSON.stringify(bouncy));
  for (const k of ['hair', 'ribbon', 'skirt']) {
    expect(bouncy[k] && bouncy[k].swingsAfterLanding <= 6 && bouncy[k].settleAfterLanding <= 1.5, `${k} under Bouncy swings ${bouncy[k]?.swingsAfterLanding} times over ${bouncy[k]?.settleAfterLanding} s (jelly)`);
  }

  // ── Cost of a spring step ──────────────────────────────────
  const cost = await page.evaluate(() => {
    const { lab, pc } = { lab: window.lab, pc: window.pc };
    pc.rest();
    const sp = lab.cur.springs, mgr = lab.cur.vrm.springBoneManager;
    const time = () => { const t0 = performance.now(); for (let i = 0; i < 600; i++) mgr.update(1 / 60); return (performance.now() - t0) / 600; };
    time();
    const on = time();
    const hair = 'hairCone' in sp.state ? sp.state.hairCone : null;
    if (hair != null) sp.set({ hairCone: 180 });
    const off = time();
    if (hair != null) sp.set({ hairCone: hair });
    pc.rest();
    return { joints: mgr.joints.size, msPerStep: +on.toFixed(4), msPerStepHairFree: +off.toFixed(4) };
  });
  console.log('spring step cost:', JSON.stringify(cost));

  // ── The Lab's tuning controls reach the model and the next one ──
  const controls = await page.evaluate(async () => {
    const lab = window.lab;
    const input = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const hairJoint = () => [...lab.cur.vrm.springBoneManager.joints].find((j) => /hair/i.test(j.bone.name));
    const read = () => ({
      vary: lab.cur.springs.state.vary, hairCone: lab.cur.springs.state.hairCone,
      hairLimit: hairJoint().limit ? +(hairJoint().limit.angle * 180 / Math.PI).toFixed(2) : null,
      squashHz: lab.cur.body.state.springs?.squash.hz, leanRatio: lab.cur.body.state.springs?.lean.ratio,
    });
    if (!document.getElementById('hair-cone')) return null;
    input('vary', 0.05); input('hair-cone', 35); input('squash-hz', 3); input('lean-ratio', 0.8);
    const moved = read();
    await lab.load('../assets/models/bijou.vrm', 'Bijou');
    const reloaded = read();
    input('vary', 0.12); input('hair-cone', 50); input('squash-hz', 2.5); input('lean-ratio', 0.6);
    return { moved, reloaded, freed: (input('hair-cone', 180), hairJoint().limit == null), back: (input('hair-cone', 50), read()) };
  });
  console.log('lab tuning controls:', JSON.stringify(controls));
  const want = { vary: 0.05, hairCone: 35, hairLimit: 35, squashHz: 3, leanRatio: 0.8 };
  expect(controls && JSON.stringify(controls.moved) === JSON.stringify(want), 'the tuning sliders do not reach the model');
  expect(controls && JSON.stringify(controls.reloaded) === JSON.stringify(want), 'a reloaded model does not take the tuning sliders');
  expect(controls && controls.freed && controls.back.hairLimit === 50, 'the hair cone slider does not free and restore the cone');

  await page.evaluate(() => { window.pc.quiet(); window.lab.view('full'); window.lab.cur.body.spin(1); window.lab.step(0.3); });
  const data = await page.evaluate(() => { window.lab.render(); return document.getElementById('view').toDataURL('image/png'); });
  fs.writeFileSync(path.join(out, 'physics-twirl.png'), Buffer.from(data.split(',')[1], 'base64'));

  console.log('console errors:', errors.length ? errors : 'none');
  console.log(failures.length ? `FAIL (${failures.length}):\n  - ${failures.join('\n  - ')}` : 'all physics bounds hold');
  await browser.close();
  process.exit(errors.length || failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
