// Headless check for the Doll Lab: loads the default model, verifies there are
// no console errors, measures how far spring tails move when she is tossed and
// spun, and saves screenshots. Needs the dev server (make serve) and Playwright.
//   node dev/lab-check.cjs [outDir] [modelUrl]
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../../../node_modules/playwright')); }
const path = require('node:path');
const fs = require('node:fs');

const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'bijou-lab');
const model = process.argv[3] ? `&model=${encodeURIComponent(process.argv[3])}` : '';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:8897/dev/lab.html?still=1&v=${Date.now()}${model}`);
  await page.waitForFunction(() => window.lab && window.lab.cur, null, { timeout: 60000 });
  const info = await page.evaluate(() => window.lab.cur.info);
  console.log('model:', info.name, '|', info.version, '|', info.license.summary, '| springs', info.springs, '| expressions', info.expressions.length);

  const shot = async (name) => {
    const data = await page.evaluate(() => { window.lab.render(); return document.getElementById('view').toDataURL('image/png'); });
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  };

  // Rest: settle, sample spring tails.
  const rest = await page.evaluate(() => { window.lab.step(1.5); return window.lab.cur.springs.sample(8); });
  await shot('lab-rest.png');

  // Toss: measure the largest tail displacement while airborne.
  const toss = await page.evaluate(() => {
    const lab = window.lab;
    lab.toss(0.9, 3.4);
    let max = 0;
    const base = lab.cur.springs.sample(8);
    const root0 = lab.cur.body.root.position.clone();
    for (let i = 0; i < 40; i++) {
      lab.step(1 / 60);
      const now = lab.cur.springs.sample(8);
      const dr = lab.cur.body.root.position.clone().sub(root0);
      now.forEach((p, k) => {
        // Displacement relative to where the tail would be if it moved rigidly with the body.
        const rigid = [base[k][0] + dr.x, base[k][1] + dr.y, base[k][2] + dr.z];
        max = Math.max(max, Math.hypot(p[0] - rigid[0], p[1] - rigid[1], p[2] - rigid[2]));
      });
    }
    return { maxLag: +max.toFixed(4), airborne: lab.cur.body.state.airborne, height: +lab.cur.body.root.position.y.toFixed(3) };
  });
  await shot('lab-toss.png');
  console.log('toss:', JSON.stringify(toss));

  // Land and settle, then twirl.
  await page.evaluate(() => window.lab.step(3));
  const spin = await page.evaluate(() => {
    const lab = window.lab;
    lab.cur.body.spin(1);
    lab.cur.motion.gesture('spin');
    lab.step(0.35);
    return lab.cur.springs.sample(8);
  });
  await shot('lab-spin.png');
  const facing = await page.evaluate(() => {
    window.lab.step(3);
    const r = window.lab.cur.body.root;
    return { x: +r.rotation.x.toFixed(3), y: +r.rotation.y.toFixed(3), z: +r.rotation.z.toFixed(3) };
  });
  const facesFront = Math.abs(facing.x) < 1e-3 && Math.abs(facing.y) < 1e-3 && Math.abs(facing.z) < 1e-3;
  console.log('after a twirl she faces front:', facesFront, JSON.stringify(facing));
  await page.evaluate(() => { window.lab.cur.motion.gesture('wave'); window.lab.step(0.9); });
  await shot('lab-wave.png');
  await page.evaluate(() => { window.lab.step(2); window.lab.view('face'); window.lab.cur.motion.mood({ happy: 1 }, 3); window.lab.step(0.6); });
  await shot('lab-face.png');

  // Every gesture at the middle of its hold, for a contact sheet.
  await page.evaluate(() => { window.lab.view('full'); window.lab.step(1.5); });
  for (const g of ['wave', 'cheer', 'stretch', 'shy', 'peace', 'think', 'tilt', 'spin']) {
    await page.evaluate((name) => { window.lab.cur.motion.gesture(name); window.lab.step(0.75); }, g);
    await shot(`gesture-${g}.png`);
    await page.evaluate(() => window.lab.step(2.6));
  }

  // Ribbons: runtime accessories on the model's own spring manager. At rest
  // they hang; a twirl swings their tails outward; positions stay finite.
  const ribbon = await page.evaluate(() => {
    const lab = window.lab;
    if (!lab.cur.ribbons) return null;
    const reach = () => {
      let max = 0;
      const joints = lab.cur.ribbons.joints;
      for (let i = 0; i < joints.length; i += 8) {
        const a = joints[i].bone.getWorldPosition(joints[i].bone.position.clone());
        const tail = joints[i + 7].child;
        const b = tail.getWorldPosition(tail.position.clone());
        max = Math.max(max, Math.hypot(b.x - a.x, b.z - a.z));
      }
      return max;
    };
    lab.view('full');
    lab.step(2);
    const atRest = reach();
    lab.cur.body.spin(1);
    let swing = 0;
    for (let i = 0; i < 30; i++) { lab.step(1 / 60); swing = Math.max(swing, reach()); }
    const tails = lab.cur.ribbons.joints.map((j) => j.child.getWorldPosition(j.child.position.clone()).toArray());
    return { joints: lab.cur.ribbons.joints.length, atRest: +atRest.toFixed(3), swing: +swing.toFixed(3), finite: tails.every((p) => p.every(Number.isFinite)) };
  });
  await shot('ribbons-twirl.png');
  await page.evaluate(() => { window.lab.step(3); window.lab.view('side'); window.lab.step(0.2); });
  await shot('ribbons-side.png');
  console.log('ribbons:', JSON.stringify(ribbon));

  // Body bounce: a hop moves the body springs at 1 (authored) and holds them
  // still at 0. Touch: a brush through the head moves hair, never the body.
  const bounce = await page.evaluate(() => {
    const lab = window.lab;
    const body = [...lab.cur.vrm.springBoneManager.joints].filter((j) => /bust|breast/i.test(j.bone.name));
    const swing = () => {
      // Largest change of a body tail relative to its own bone, over a hop.
      const rel = () => body.map((j) => { const a = j.bone.getWorldPosition(j.bone.position.clone()); return (j.child || j.bone).getWorldPosition(a.clone()).sub(a); });
      lab.step(2);
      const r0 = rel();
      lab.cur.body.hop(2.4);
      let max = 0;
      for (let i = 0; i < 70; i++) { lab.step(1 / 60); rel().forEach((v, k) => { max = Math.max(max, v.distanceTo(r0[k])); }); }
      return +max.toFixed(4);
    };
    const out = { joints: body.length };
    for (const b of [1, 0.5, 0]) { lab.cur.springs.set({ bounce: b }); out[`at${b}`] = swing(); }
    lab.cur.springs.set({ bounce: 1 });
    return out;
  });
  console.log('body bounce:', JSON.stringify(bounce));

  const touch = await page.evaluate(() => {
    const lab = window.lab;
    lab.step(2);
    const mgr = lab.cur.vrm.springBoneManager;
    const head = lab.cur.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(mgr.joints.values().next().value.bone.position.clone());
    const tails = () => [...mgr.joints].map((j) => (j.child || j.bone).getWorldPosition(head.clone()));
    const before = tails();
    const Ray = lab.cur.vrm.scene.position.constructor; // Vector3
    const ray = { distanceToPoint: (p) => Math.hypot(p.x - head.x, p.y - (head.y + 0.08), p.z - head.z) * 0 + Math.hypot(p.x - head.x, p.z - head.z) };
    const moved = lab.cur.springs.touch({ ray, vel: new Ray(2.5, 0, 0), radius: 0.12, gain: 1.6 });
    lab.step(4 / 60);
    const after = tails();
    let hair = 0, body = 0;
    [...mgr.joints].forEach((j, k) => {
      const d = after[k].distanceTo(before[k]);
      if (/bust|breast/i.test(j.bone.name)) body = Math.max(body, d); else hair = Math.max(hair, d);
    });
    return { pushed: moved, hairMoved: +hair.toFixed(4), bodyMoved: +body.toFixed(4) };
  });
  console.log('touch:', JSON.stringify(touch));

  // Carry swing: the share of a toss the springs feel. Frame rate: the same
  // hop at 30 and 120 frames a second swings the hair about the same.
  const feel = await page.evaluate(() => {
    const lab = window.lab;
    const hair = [...lab.cur.vrm.springBoneManager.joints].filter((j) => !/bust|breast|skirt|sleeve|ribbon/i.test(j.bone.name)).slice(0, 12);
    const rel = () => hair.map((j) => { const a = j.bone.getWorldPosition(j.bone.position.clone()); return (j.child || j.bone).getWorldPosition(a.clone()).sub(a); });
    const run = (kick, dt) => {
      lab.step(2.5);
      const r0 = rel();
      kick();
      let max = 0;
      for (let t = 0; t < 1.2; t += dt) { lab.step(dt, dt); rel().forEach((v, k) => { max = Math.max(max, v.distanceTo(r0[k])); }); }
      lab.step(2.5);
      return +max.toFixed(4);
    };
    const out = {};
    for (const i of [0, 0.4, 1]) { lab.cur.springs.set({ inertia: i }); out[`toss${i}`] = run(() => lab.toss(0.9, 3), 1 / 60); }
    lab.cur.springs.set({ inertia: 0.4 });
    out.hop30 = run(() => lab.cur.body.hop(2.4), 1 / 30);
    out.hop120 = run(() => lab.cur.body.hop(2.4), 1 / 120);
    out.resets = lab.cur.springs.state.resets;
    return out;
  });
  console.log('carry swing and frame rate:', JSON.stringify(feel));

  const behaviour = await page.evaluate(() => {
    const lab = window.lab, m = lab.cur.motion, st = m.state;
    // Saccades: the eye target leaves the point of attention while it holds still.
    const look = lab.cur.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(st.look.clone()).add(st.look.clone().set(0, 0, 0.8));
    m.lookAt(look);
    let off = 0;
    for (let i = 0; i < 300; i++) { lab.step(1 / 60); off = Math.max(off, lab.cur.vrm.lookAt.target.position.distanceTo(look)); }
    // Petting: soft eyes and a smile.
    st.blinkOn = false;
    for (let i = 0; i < 40; i++) { m.pet(0.6); lab.step(1 / 60); }
    const pet = { happy: +(st.cur.happy || 0).toFixed(2), softEyes: +(st.cur.blink || 0).toFixed(2) };
    st.blinkOn = true;
    // Startle: being picked up shows the model's surprised face, whatever its spelling.
    m.setHeld(true); lab.step(0.5);
    const startled = +(st.cur.surprised || 0).toFixed(2);
    m.setHeld(false); lab.step(1);
    // Dozing: left alone, eyes close; a look wakes her.
    st.sleepAfter = 3;
    lab.step(9);
    const asleep = { sleep: +st.sleep.toFixed(2), blink: +(st.cur.blink || 0).toFixed(2) };
    m.lookAt(look);
    lab.step(1.2);
    const awake = +st.sleep.toFixed(2);
    st.sleepAfter = 60;
    return { saccadeMaxOffset: +off.toFixed(3), pet, startled, asleep, awakeAfter: awake };
  });
  await shot('doze-woken.png');
  console.log('behaviour:', JSON.stringify(behaviour));

  const overlay = await page.evaluate(() => {
    document.getElementById('helpers').click();
    window.lab.view('full');
    window.lab.step(0.5);
    let n = 0;
    window.lab.cur.vrm.scene.parent.parent.parent.parent.traverse((o) => { if (/Helper/.test(o.constructor.name) || o.type === 'LineSegments') n++; });
    return n;
  });
  await shot('overlay.png');
  console.log('overlay objects:', overlay);

  const finite = [...rest, ...spin].every((p) => p.every(Number.isFinite)) && (!ribbon || ribbon.finite);
  console.log('finite spring positions:', finite);
  console.log('console errors:', errors.length ? errors : 'none');
  console.log('screenshots:', out);
  await browser.close();
  process.exit(errors.length || !finite || !facesFront ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
