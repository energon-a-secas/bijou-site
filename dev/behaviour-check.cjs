// Headless behaviour check for the Doll Lab. Five simulated minutes alone
// (varied idles, nothing that repeats, a doze near 60 s); strokes, holds and
// taps through the lab's own pointer handlers; the gaze yielding to a
// gesture and to clips, the eyes yielding to a clip's own gaze, a still clip
// holding its pose, an emotion waiting for a blink, and the drag, toss, fall
// and land hooks. Needs the dev server (make serve) and Playwright.
//   node dev/behaviour-check.cjs [outDir]
// LAB_URL points it at another server (a worktree on its own port), and
// NODE_PATH can supply Playwright from the monorepo root node_modules.
const BASE = (process.env.LAB_URL || 'http://localhost:8897').replace(/\/$/, '');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../../../node_modules/playwright')); }
const path = require('node:path');
const fs = require('node:fs');

const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'bijou-behaviour');
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(name, ok, detail) {
  results.push(!!ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

/**
 * The closest any 6 s window of one channel comes to repeating 3 to 120 s
 * later: the largest difference over the window divided by the window's own
 * range (0 is an exact loop). Windows that barely move are skipped.
 */
function closestRepeat(samples, hz, d) {
  const win = 6 * hz;
  let best = { diff: Infinity, lag: 0, at: 0 };
  for (let s = 0; s + win < samples.length; s += hz) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < win; k++) { lo = Math.min(lo, samples[s + k][d]); hi = Math.max(hi, samples[s + k][d]); }
    const range = hi - lo;
    if (range < 0.3) continue;
    for (let lag = 3 * hz; lag <= 120 * hz && s + lag + win <= samples.length; lag++) {
      let worst = 0;
      for (let k = 0; k < win && worst < best.diff * range; k++) worst = Math.max(worst, Math.abs(samples[s + k][d] - samples[s + lag + k][d]));
      if (worst / range < best.diff) best = { diff: worst / range, lag: lag / hz, at: s / hz };
    }
  }
  return best;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/dev/lab.html?still=1&seed=7&v=${Date.now()}`);
  await page.waitForFunction(() => window.lab && window.lab.cur, null, { timeout: 60000 });
  const shot = async (name) => {
    const data = await page.evaluate(() => { window.lab.render(); return document.getElementById('view').toDataURL('image/png'); });
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  };

  // ── Five minutes alone ─────────────────────────────────────
  await page.evaluate(() => {
    const lab = window.lab, vrm = lab.cur.vrm, frame = vrm.scene;
    const Q = frame.quaternion.constructor, E = frame.rotation.constructor;
    const node = (n) => vrm.humanoid.getNormalizedBoneNode(n);
    const bones = { head: node('head'), hips: node('hips'), chest: node('upperChest') || node('chest') };
    const q = new Q(), qr = new Q(), e = new E(), deg = 180 / Math.PI;
    window.__alone = { samples: [], dozeAt: null };
    // One sample at 10 Hz: head turn against her body, hips roll and turn, chest pitch, hips sway (cm).
    window.__sample = () => {
      bones.head.getWorldQuaternion(q).premultiply(frame.getWorldQuaternion(qr).invert());
      e.setFromQuaternion(q, 'YXZ');
      const s = [e.x * deg, e.y * deg, e.z * deg];
      e.setFromQuaternion(bones.hips.quaternion, 'YXZ');
      s.push(e.z * deg, e.y * deg);
      e.setFromQuaternion(bones.chest.quaternion, 'YXZ');
      s.push(e.x * deg, bones.hips.position.x * 100);
      return s;
    };
  });
  for (let seg = 0; seg < 40; seg++) {
    await page.evaluate(() => {
      const lab = window.lab, st = lab.cur.motion.state, a = window.__alone;
      for (let i = 0; i < 225; i++) { // 7.5 s at 30 frames a second
        lab.frame(1 / 30);
        if (a.dozeAt == null && st.sleep > 0.5) a.dozeAt = st.t - st.lastSeen;
        if (i % 3 === 2) a.samples.push(window.__sample());
      }
    });
    if (seg % 2 === 1 && seg < 16) await shot(`alone-${String((seg + 1) * 7.5).padStart(3, '0')}s.png`);
  }
  await shot('alone-300s-dozing.png');
  const alone = await page.evaluate(() => ({
    ...window.__alone,
    picks: window.lab.cur.motion.idle.picks.map((p) => ({ name: p.name, t: p.t, asleep: p.asleep, on: p.on })),
    lastSeen: window.lab.cur.motion.state.lastSeen,
  }));
  const awake = alone.picks.filter((p) => !p.asleep && !p.on);
  const asleep = alone.picks.filter((p) => p.asleep);
  check('dozes off near the 60 s mark', alone.dozeAt > 60 && alone.dozeAt < 64, `asleep ${alone.dozeAt?.toFixed(2)} s after the last attention`);
  check('varied idles before the doze, never twice in a row',
    new Set(awake.map((p) => p.name)).size >= 4 && awake.every((p, i) => !i || p.name !== awake[i - 1].name),
    awake.map((p) => `${p.name}@${p.t.toFixed(1)}`).join(' '));
  check('sleepy poses keep changing while she dozes',
    asleep.length >= 6 && new Set(asleep.map((p) => p.name)).size >= 3 && asleep.every((p, i) => !i || p.name !== asleep[i - 1].name),
    `${asleep.length} picks: ${asleep.map((p) => p.name).join(' ')}`);
  // Per channel, because a loop hides in one joint. A loop is near-exact
  // periodicity: within 1 percent of the window's range. The earlier idle's
  // single 3.6 s breathing sine scored 0 here and its hips sway 0.1 percent
  // (every 45.7 s); behaviours recurring at random times score higher.
  const channels = ['head pitch', 'head yaw', 'head roll', 'hips roll', 'hips yaw', 'chest pitch', 'hips sway'];
  const repeats = channels.map((n, d) => ({ n, ...closestRepeat(alone.samples, 10, d) }));
  check('no visible loop in five minutes', repeats.every((r) => r.diff > 0.01),
    repeats.map((r) => `${r.n} ${(r.diff * 100).toFixed(1)}% (lag ${r.lag} s)`).join(', '));

  // ── Strokes, holds and taps through the pointer handlers ───
  const wakeUp = () => page.evaluate(() => {
    const lab = window.lab;
    lab.view('full');
    lab.cur.motion.lookAt(lab.cur.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(lab.cur.body.root.position.clone()).setZ(2));
    lab.step(2.5);
  });
  await wakeUp();
  const strokeShapes = [
    (k) => [[-k, 0], [k, 0], [-k, 0], [k, 0]],
    (k) => [[0, -k], [0, k], [0, -k], [0, k]],
    (k) => [[-k, -k / 2], [k, k / 2], [-k, -k / 2], [k, k / 2]],
    (k) => Array.from({ length: 25 }, (_, i) => [k * Math.cos(i / 24 * 3.4 * Math.PI), k * 0.8 * Math.sin(i / 24 * 3.4 * Math.PI)]),
    (k) => [[-k, k / 3], [k, k / 3], [-k, k / 3], [k, k / 3], [-k, k / 3]],
    (k) => [[k, 0], [-k, 0], [k, 0], [-k, 0]],
    (k) => [[-k, k / 2], [k, -k / 2], [-k, k / 2], [k, -k / 2]],
    (k) => [[0, k], [0, -k], [0, k], [0, -k]],
    (k) => Array.from({ length: 25 }, (_, i) => [k * Math.sin(i / 24 * 3.4 * Math.PI), k * 0.8 * Math.cos(i / 24 * 3.4 * Math.PI)]),
    (k) => [[-k * 0.6, 0], [k * 0.6, 0], [-k * 0.6, 0], [k * 0.6, 0], [-k * 0.6, 0], [k * 0.6, 0]],
  ];
  const strokes = [];
  for (const shape of strokeShapes) {
    const h = await page.evaluate(() => window.lab.headScreen());
    // Press on her head, then stroke across it.
    const way = [[h.x, h.y], ...shape(h.r * 0.8).map(([dx, dy]) => [h.x + dx, h.y + dy])];
    const before = await page.evaluate(() => window.lab.cur.motion.state.pats);
    await page.mouse.move(way[0][0], way[0][1]);
    await page.mouse.down();
    let held = false;
    for (let i = 1; i < way.length; i++) {
      const [ax, ay] = way[i - 1], [bx, by] = way[i];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 6));
      for (let j = 1; j <= n; j++) {
        await page.mouse.move(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n);
        held = (await page.evaluate(() => { window.lab.step(1 / 60); return window.lab.cur.body.state.held; })) || held;
      }
    }
    const mode = await page.evaluate(() => window.lab.pressMode);
    await page.mouse.up();
    const face = await page.evaluate(() => { window.lab.step(0.15); const c = window.lab.cur.motion.state.cur; return { happy: +(c.happy || 0).toFixed(2), blink: +(c.blink || 0).toFixed(2) }; });
    const after = await page.evaluate(() => window.lab.cur.motion.state.pats);
    strokes.push({ pats: after - before, mode, held, ...face });
    await page.evaluate(() => window.lab.step(0.6));
  }
  check('ten head strokes read as pats, none as a pickup', strokes.every((s) => s.pats >= 1 && s.mode === 'stroke' && !s.held),
    strokes.map((s) => `${s.pats} pat${s.pats === 1 ? '' : 's'}`).join(', '));
  check('a happy, soft-eyed face under the hand', strokes.every((s) => s.happy > 0.5 && s.blink > 0.25),
    strokes.map((s) => `happy ${s.happy} eyes ${s.blink}`).join('; '));
  await page.evaluate(() => { window.lab.view('face'); window.lab.step(0.05); });
  await shot('stroke-face.png');

  const drags = [];
  for (let i = 0; i < 10; i++) {
    await wakeUp();
    const onHead = i < 5;
    const at = await page.evaluate((head) => (head ? window.lab.headScreen() : window.lab.boneScreen('spine')), onHead);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    if (onHead) await page.waitForTimeout(420); // press and hold on the head
    let held = false;
    for (let j = 1; j <= 12; j++) {
      await page.mouse.move(at.x + j * 7 * (i % 2 ? -1 : 1), at.y - j * 5);
      held = (await page.evaluate(() => { window.lab.step(1 / 60); return window.lab.cur.body.state.held && window.lab.cur.motion.state.held; })) || held;
    }
    const pats = await page.evaluate(() => window.lab.cur.motion.state.pats);
    await page.mouse.up();
    const let_go = await page.evaluate(() => { window.lab.step(3); return !window.lab.cur.body.state.held && !window.lab.cur.motion.state.held; });
    drags.push({ where: onHead ? 'head' : 'body', held, let_go, pats });
  }
  check('ten drags (five held on the head, five below the neck) all pick her up', drags.every((d) => d.held && d.let_go) && new Set(drags.map((d) => d.pats)).size === 1,
    drags.map((d) => `${d.where}:${d.held ? 'carried' : 'not carried'}`).join(' '));

  await wakeUp();
  const taps = [];
  for (const where of ['head', 'body']) {
    const at = await page.evaluate((w) => (w === 'head' ? window.lab.headScreen() : window.lab.boneScreen('spine')), where);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.up();
    taps.push(await page.evaluate(() => {
      const m = window.lab.cur.motion, st = m.state;
      window.lab.step(0.1);
      const r = { held: st.held, tilt: st.gestures.some((g) => g.name === 'tilt'), squint: +st.squint.toFixed(2) };
      window.lab.step(0.25); // a mood waits out a blink in progress
      r.mood = Object.keys(st.mood);
      window.lab.step(2.5);
      return r;
    }));
  }
  check('quick taps react (head: tilt and narrowed eyes; body: a startle), no pickup',
    taps[0].tilt && taps[0].squint > 0.2 && !taps[0].held && taps[1].mood.includes('surprised') && !taps[1].held, taps);

  // ── Priority: the gaze yields, the eyes yield, clips hold ──
  const pri = await page.evaluate(async () => {
    const T = await import('/js/vendor/avatar-engine.js');
    const lab = window.lab, m = lab.cur.motion, st = m.state, vrm = lab.cur.vrm;
    const node = (n) => vrm.humanoid.getNormalizedBoneNode(n);
    const q = new T.Quaternion(), qr = new T.Quaternion(), e = new T.Euler(), deg = 180 / Math.PI;
    // Head turn against her own frame (vrm.scene): positive toward her left, for VRM 0.x and 1.0 alike.
    const yaw = () => { node('head').getWorldQuaternion(q).premultiply(vrm.scene.getWorldQuaternion(qr).invert()); return +(e.setFromQuaternion(q, 'YXZ').y * deg).toFixed(1); };
    st.idle = 0;
    lab.view('full');
    lab.step(2);
    // Something to watch on her left, at head height.
    const head = node('head').getWorldPosition(new T.Vector3());
    const left = head.clone().add(new T.Vector3(0.9, 0, 1.0));
    m.lookAt(left); lab.step(2.5);
    const watching = yaw();
    m.gesture('tilt'); lab.step(1.0);
    const duringTilt = yaw();
    lab.step(2.4);
    m.lookAt(left);
    lab.step(1);
    const afterTilt = yaw();
    // A clip that turns her head 0.6 rad to her right and owns the back, with its own gaze.
    const turned = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.6), id = new T.Quaternion();
    const track = (b, qq) => [b, new T.QuaternionKeyframeTrack(`${b}.q`, [0, 2], [...qq.toArray(), ...qq.toArray()])];
    const vrma = (eyeYaw) => ({
      duration: 2, restHipsPosition: new T.Vector3(0, 1, 0),
      humanoidTracks: { translation: new Map(), rotation: new Map([track('spine', id), track('chest', id), track('upperChest', id), track('neck', id), track('head', turned)]) },
      expressionTracks: { preset: new Map(), custom: new Map() },
      lookAtTrack: eyeYaw == null ? null : new T.QuaternionKeyframeTrack('look.q', [0, 2], (() => { const g = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), eyeYaw * Math.PI / 180).toArray(); return [...g, ...g]; })()),
    });
    m.addClip('aside', vrma(-70));
    m.addClip('ahead', vrma(-10));
    m.play('aside', { fade: 0.3 });
    const hold = [];
    for (let i = 0; i < 90; i++) { lab.frame(1 / 60); if (i >= 30) hold.push(yaw()); }
    const eyesAside = +vrm.lookAt.yaw.toFixed(1), shareAside = +st.eyeShare.toFixed(2);
    m.play('ahead', { fade: 0.3 });
    lab.step(0.8);
    const eyesAhead = +vrm.lookAt.yaw.toFixed(1), shareAhead = +st.eyeShare.toFixed(2), clipHead = yaw();
    m.stopClip(0.4);
    m.lookAt(left);
    lab.step(1.5);
    const afterClip = yaw();
    st.idle = 1;
    return { watching, duringTilt, afterTilt, holdMin: Math.min(...hold), holdMax: Math.max(...hold), eyesAside, shareAside, eyesAhead, shareAhead, clipHead, afterClip };
  });
  await shot('after-priority.png');
  check('the gaze turns her head toward what she watches', pri.watching > 20, `${pri.watching} degrees toward her left`);
  check('the gaze on head and neck yields to a gesture, then returns', pri.duringTilt < pri.watching - 8 && Math.abs(pri.afterTilt - pri.watching) < 3,
    `watching ${pri.watching}, during the tilt ${pri.duringTilt}, after ${pri.afterTilt}`);
  check('a clip holding still keeps its pose every frame, over the gaze', pri.holdMin > -34.4 - 0.6 && pri.holdMax < -34.4 + 0.6,
    `head ${pri.holdMin}..${pri.holdMax} (the clip: -34.4) while the gaze wants her left`);
  check('the eyes yield to a clip looking 70 degrees away', pri.eyesAside < -20 && pri.shareAside < 0.35, `eye yaw ${pri.eyesAside}, share left to the person ${pri.shareAside}`);
  check('the eyes stay with the person when the clip looks only 10 degrees away', pri.eyesAhead > 40 && pri.shareAhead === 1, `eye yaw ${pri.eyesAhead}, share ${pri.shareAhead}`);
  check('the gaze takes the head back when the clip stops', Math.abs(pri.afterClip - pri.watching) < 3, `${pri.afterClip} (watching ${pri.watching})`);

  // ── An emotion waits for the blink in progress to reopen ───
  const gate = await page.evaluate(() => {
    const lab = window.lab, m = lab.cur.motion, st = m.state;
    st.idle = 0;
    lab.step(5);
    let n = 0;
    while (st.cur.blink < 0.4 && n++ < 900) lab.frame(1 / 60);
    if (n >= 900) return { blinked: false };
    m.mood({ sad: 1 }, 2);
    const waited = !st.mood.sad;
    n = 0;
    while (st.cur.blink > 0.02 && n++ < 60) lab.frame(1 / 60);
    lab.frame(1 / 60);
    const shown = !!st.mood.sad;
    m.mood({ sad: 1 }, 0.01);
    st.idle = 1;
    return { blinked: true, waited, shown, frames: n };
  });
  check('a new emotion waits for a blink in progress to reopen', gate.blinked && gate.waited && gate.shown, gate);

  // ── Event hooks: drag, toss, fall, land ────────────────────
  const hooks = await page.evaluate(() => {
    const lab = window.lab, m = lab.cur.motion;
    lab.step(2);
    const n0 = m.idle.picks.length;
    lab.toss(0.9, 3.4);
    let fell = false;
    for (let i = 0; i < 240; i++) { lab.frame(1 / 60); fell = fell || lab.cur.falling; }
    return { seq: m.idle.picks.slice(n0).map((p) => p.on ? `${p.on}:${p.name}` : p.name), fell };
  });
  const seq = hooks.seq.join(' ');
  check('drag, toss, fall and land fire their behaviours in order', /^drag:\w+ toss:fly fall:flail land:(tada|phew)/.test(seq), seq);

  check('nothing throws', errors.length === 0, errors.length ? errors : 'no page errors, no console errors');
  console.log('screenshots:', out);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
