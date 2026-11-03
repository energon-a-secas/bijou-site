// Headless check for the VRM companion (index.html?renderer=vrm, js/avatar-vrm.js).
// The default page still loads avatar.js and none of the VRM runtime; the flag
// loads the runtime with no console errors on a local host, and a public host
// name ignores it; faces, poses and the twirl reach the runtime; taps and drags
// through the real pointer handlers pat, poke and carry her, a head tap flicks
// the hair it touched, and her springs swing; worldOf puts the eye line on her
// eyes, and hitTest and capture answer; a stalled frame, a resize and the
// pop-out keep the springs finite; reduced motion holds them still; a lost
// WebGL context shows the 2D doll until it is restored; &model= takes
// same-origin files only; no WebGL or a missing model falls back to the SVG
// doll. Needs a dev server and Playwright.
//   BIJOU_URL=http://localhost:8897 node dev/companion-vrm-check.cjs [outDir]
// NODE_PATH can supply Playwright from the monorepo root node_modules. Springs
// are measured in real time, so the browser asks for the GPU (Metal on macOS;
// GPU_ARGS overrides). Software GL draws about two frames a second, where the
// springs rightly rest instead of swing, and the check says so.
const BASE = (process.env.BIJOU_URL || 'http://localhost:8897').replace(/\/$/, '');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../../../node_modules/playwright')); }
const path = require('node:path');
const fs = require('node:fs');

const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'bijou-companion-vrm');
fs.mkdirSync(out, { recursive: true });
const GPU = process.env.GPU_ARGS != null ? process.env.GPU_ARGS.split(' ').filter(Boolean)
  : ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
// The flag is honoured on local hosts only: a public name, resolved to this server, must ignore it.
const local = new URL(BASE), PUBLIC = /^(localhost|127\.0\.0\.1)$/.test(local.hostname) ? `http://bijou.example:${local.port || 80}` : null;
const VRM_FILES = /\/js\/(avatar-vrm|vrm-runtime|vrm-motion|vrm-physics|vrm-accessory)\.js/;
const NO_WEBGL = 'THREE.WebGLRenderer: Error creating WebGL context.';
const FALLBACK = '3D is unavailable in this browser. Showing Bijou in 2D.';
const PAUSED = '3D paused. Bijou is still here in 2D.';
const failures = [], errors = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail === undefined ? '' : ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  if (!ok) failures.push(label);
};

/** Page errors are fatal; console errors too, except failed loads from other hosts and `allow`. */
function watch(page, label, allow = () => false) {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text(), at = m.location().url || '';
    if (/Failed to load resource/.test(text) && !at.startsWith(BASE)) return;
    if (!allow(text, at)) errors.push(`${label}: ${text}${at ? ` (${at})` : ''}`);
  });
}

/** Every frame for `ms`: the largest spring swing (rad) from `ref` or the start, the root's height, held. */
const sample = (page, ms, ref = null) => page.evaluate(({ ms, ref }) => new Promise((done) => {
  const b = window.bijouVrm, r0 = ref || b.locals(), t0 = performance.now();
  const s = { swing: 0, rootY: 0, held: false, finite: true, frames: 0 };
  (function frame() {
    s.swing = Math.max(s.swing, b.swing(r0));
    s.rootY = Math.max(s.rootY, b.body.root.position.y);
    s.held = s.held || b.motion.state.held;
    s.finite = s.finite && b.springs.sample(12).flat().every(Number.isFinite);
    s.frames++;
    if (performance.now() - t0 < ms) requestAnimationFrame(frame); else done(s);
  })();
}), { ms, ref });
/** A point in canonical head space, in client pixels of whichever window holds the stage. */
const headPoint = (page, x, y) => page.evaluate(([x, y]) => {
  const d = window.bijouVrm.doll, p = d.worldOf('head', x, y), m = d.svg.getScreenCTM();
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}, [x, y]);
const stat = (page, key) => page.evaluate(async (key) => (await import('/js/state.js')).state.stats[key], key);
const pats = (page) => stat(page, 'pats');
/** Record how many joints each springs.touch call moves; touched() hands over the calls since the last read. */
const spyTouch = (page) => page.evaluate(() => {
  const s = window.bijouVrm.springs, touch = s.touch;
  window.bijouTouched = [];
  s.touch = (opts) => { const n = touch(opts); window.bijouTouched.push(n); return n; };
});
const touched = (page) => page.evaluate(() => window.bijouTouched.splice(0));
const resets = (page) => page.evaluate(() => window.bijouVrm.springs.state.resets);
const finiteNow = (page) => page.evaluate(() => window.bijouVrm.springs.sample(12).flat().every(Number.isFinite));
async function tap(mouse, p) { await mouse.move(p.x, p.y); await mouse.down(); await new Promise((r) => setTimeout(r, 80)); await mouse.up(); }
async function drag(page, p, shot) {
  const { mouse } = page;
  await mouse.move(p.x, p.y);
  await mouse.down();
  await mouse.move(p.x, p.y - 70, { steps: 12 });
  await page.waitForTimeout(350);
  if (shot) await page.locator('#stage').screenshot({ path: path.join(out, shot) });
  await mouse.move(p.x + 120, p.y - 70, { steps: 6 });
  await page.waitForTimeout(200);
  await mouse.move(p.x, p.y - 70, { steps: 6 });
  await page.waitForTimeout(200);
  await mouse.up();
}
const stageShot = (page, name) => page.locator('#stage').screenshot({ path: path.join(out, name) });

/** The SVG fallback, as avatar.js shows it, with a pat through the 2D doll. */
async function fallbackState(page, label) {
  await page.waitForSelector('#stage[data-renderer="svg"]', { timeout: 60000 });
  const st = await page.evaluate(async () => {
    const d = window.bijouVrm.doll, canvas = document.querySelector('canvas.avatar-canvas');
    return {
      ready: await d.ready, is3D: d.is3D, status: document.querySelector('.avatar-status')?.textContent,
      canvasHidden: !canvas || canvas.hidden, svgClasses: ['avatar-loading', 'avatar-ready'].filter((c) => d.svg.classList.contains(c)),
      parts: document.querySelectorAll('#doll .bj-parts [data-b]').length,
    };
  });
  const before = await pats(page);
  await page.mouse.click(...Object.values(await headPoint(page, 200, 150)));
  await page.waitForTimeout(200);
  const after = await pats(page);
  check(st.ready === false && !st.is3D && st.status === FALLBACK && st.canvasHidden && !st.svgClasses.length && st.parts > 0 && after === before + 1,
    `${label}: SVG fallback, status, hidden canvas, a pat on the 2D head`, { ...st, pats: [before, after] });
}

(async () => {
  const browser = await chromium.launch({ args: [...GPU, ...(PUBLIC ? [`--host-resolver-rules=MAP bijou.example ${local.hostname}`] : [])] });
  const context = () => browser.newContext({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 1 });

  // 1. The default path: avatar.js, and nothing of the VRM runtime.
  const plain = await (await context()).newPage();
  watch(plain, 'default');
  const requested = [];
  plain.on('request', (r) => requested.push(new URL(r.url()).pathname));
  await plain.goto(`${BASE}/`);
  await plain.waitForSelector('#stage[data-renderer]', { timeout: 90000 });
  const plainState = await plain.evaluate(() => ({ renderer: document.getElementById('stage').dataset.renderer, handle: typeof window.bijouVrm }));
  check(plainState.renderer === '3d' && plainState.handle === 'undefined' && requested.includes('/js/avatar.js') && !requested.some((u) => VRM_FILES.test(u)),
    'default path: avatar.js in 3D, no VRM module requested', plainState);
  await stageShot(plain, 'default.png');
  if (PUBLIC) {
    requested.length = 0;
    await plain.goto(`${PUBLIC}/?renderer=vrm`);
    await plain.waitForSelector('#stage[data-renderer]', { timeout: 90000 });
    const pub = await plain.evaluate(() => ({ renderer: document.getElementById('stage').dataset.renderer, handle: typeof window.bijouVrm }));
    check(pub.renderer === '3d' && pub.handle === 'undefined' && !requested.some((u) => VRM_FILES.test(u)), 'a public host ignores ?renderer=vrm', pub);
  }
  await plain.context().close();

  // 2. The flag: the runtime loads, springs settled, ribbons joined.
  const ctx = await context();
  const page = await ctx.newPage();
  watch(page, 'vrm');
  await page.goto(`${BASE}/?renderer=vrm`);
  await page.waitForFunction(() => window.bijouVrm?.doll.is3D, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => document.querySelector('[data-pose="stand"]').click());
  const fps = await page.evaluate(() => new Promise((done) => { let n = 0; const t = performance.now(); (function f() { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else done(n); })(); }));
  check(fps >= 20, 'frames fast enough for real-time spring checks', `${fps} fps${fps < 20 ? ' (software GL? pass GPU_ARGS for this machine)' : ''}`);
  const loaded = await page.evaluate(() => {
    const b = window.bijouVrm, svg = document.getElementById('doll');
    // Body-region springs keep vrm-physics.js's cap whatever the saved Bounce says.
    const body = [...b.vrm.springBoneManager.joints].filter((j) => /bust|breast|chest|belly|butt|thigh/i.test(j.bone.name));
    return {
      renderer: document.getElementById('stage').dataset.renderer, ready: svg.classList.contains('avatar-ready'), springs: b.springs.count, authored: b.info.springs,
      editing: b.doll.editing, model: b.info.name, unit: +b.unit.toFixed(1), bounce: b.springs.state.bounce,
      bodyCapped: body.length > 0 && body.every((j) => j.settings.stiffness >= 1 && j.settings.dragForce >= 0.35),
    };
  });
  check(loaded.renderer === '3d' && loaded.ready && loaded.springs >= loaded.authored + 16 && loaded.editing === false && loaded.bodyCapped, 'VRM path loads in 3D with ribbons, body springs capped', loaded);
  await stageShot(page, 'vrm-rest.png');

  // 2b. Behaviour reaches the runtime: sleep is a doze, sleepy half shuts her eyes,
  // joy and pout become her expressions (a new face lets go of the last one at once),
  // a picked pose plays its gesture, the twirl turns her once and she faces front.
  const faces = await page.evaluate(async () => {
    const b = window.bijouVrm, d = b.doll, st = b.motion.state, face = d.setExpression;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const weight = (name) => +(b.vrm.expressionManager.getValue(name) || 0).toFixed(2);
    d.setExpression = () => {}; // behaviour sets her face four times a second; hold it off for a moment
    face('sleep');
    await wait(3000);
    const doze = +st.sleep.toFixed(2);
    face('sleepy');
    await wait(400);
    const sleepy = weight('blink');
    face('joy');
    await wait(500);
    const joy = weight('happy');
    face('pout');
    await wait(500);
    const pout = { angry: weight('angry'), happy: weight('happy') };
    face('smile');
    d.setExpression = face;
    return { doze, sleepy, joy, pout };
  });
  await page.evaluate(() => document.querySelector('[data-pose="cheer"]').click());
  await page.waitForTimeout(200);
  const cheer = await page.evaluate(() => window.bijouVrm.motion.state.gestures.map((g) => g.name));
  await page.evaluate(() => document.querySelector('[data-pose="stand"]').click());
  await page.locator('[data-act="twirl"]').click();
  const twirl = await page.evaluate(() => new Promise((done) => {
    const b = window.bijouVrm, t0 = performance.now();
    let turn = 0, spin = false;
    (function frame() {
      turn = Math.max(turn, b.body.root.rotation.y);
      spin = spin || b.motion.state.gestures.some((g) => g.name === 'spin');
      if (performance.now() - t0 < 1600) requestAnimationFrame(frame); else done({ turn: +turn.toFixed(2), end: +b.body.root.rotation.y.toFixed(3), spin });
    })();
  }));
  check(faces.doze > 0.75 && faces.sleepy >= 0.55 && faces.joy >= 0.9 && faces.pout.angry >= 0.5 && faces.pout.happy <= 0.05 && cheer.includes('cheer') && twirl.turn > 6 && twirl.end === 0 && twirl.spin,
    'faces, poses and the twirl reach the runtime', { ...faces, cheer, twirl });

  // 3. worldOf: finite, on the stage, the crown above the eye line, and (200, 206) on her own
  // eyes: interact.js tells a pat from a cheek poke by that line, fx hangs hearts and speech
  // from the same bridge. She looks straight out first, so the head is not turned.
  const eyeLine = await headPoint(page, 200, 206);
  await page.mouse.move(eyeLine.x, eyeLine.y);
  await page.waitForTimeout(1200);
  const world = await page.evaluate(() => {
    const b = window.bijouVrm, d = b.doll, m = d.svg.getScreenCTM(), inv = m.inverse(), r = document.getElementById('stage').getBoundingClientRect();
    const points = [[200, 96], [200, 150], [200, 206], [236, 112], [200, 300]].map(([x, y]) => {
      const p = d.worldOf('head', x, y), cx = m.a * p.x + m.e, cy = m.d * p.y + m.f;
      return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom };
    });
    // The model's eye bones, projected, then taken back into viewBox units.
    const eyes = ['leftEye', 'rightEye'].map((n) => b.clientOf(n)).filter(Boolean).map((c) => ({ x: inv.a * c.x + inv.c * c.y + inv.e, y: inv.b * c.x + inv.d * c.y + inv.f }));
    const mid = eyes.length === 2 ? [(eyes[0].x + eyes[1].x) / 2, (eyes[0].y + eyes[1].y) / 2] : [NaN, NaN];
    return { points, eyes: mid.map((n) => +n.toFixed(1)), off: [points[2].x - mid[0], points[2].y - mid[1]].map((n) => +n.toFixed(1)) };
  });
  check(world.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.inside) && world.points[1].y < world.points[2].y && Math.abs(world.off[0]) <= 12 && Math.abs(world.off[1]) <= 6,
    'worldOf head points finite, on stage, the eye line on her eyes', { points: world.points.map((p) => [p.x, p.y]), eyes: world.eyes, off: world.off });

  // 4. hitTest: forehead, chest, empty corner.
  const forehead = await headPoint(page, 200, 170);
  const hits = await page.evaluate((f) => {
    const b = window.bijouVrm, chest = b.clientOf('chest'), r = document.getElementById('stage').getBoundingClientRect();
    return { head: b.doll.hitTest(f.x, f.y), chest: b.doll.hitTest(chest.x, chest.y), corner: b.doll.hitTest(r.left + 6, r.top + 6) };
  }, forehead);
  check(hits.head === 'head' && hits.chest === 'spine' && hits.corner === null, 'hitTest head, body, empty', hits);

  // 5. capture: a PNG, and a 300 px WebP preview with her in it.
  const cap = await page.evaluate(async () => {
    const d = window.bijouVrm.doll, png = d.capture(), webp = d.capture({ height: 300, mime: 'image/webp' });
    const img = new Image();
    img.src = webp;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let seen = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) seen++;
    return { png: /^data:image\/png/.test(png), webp: /^data:image\/webp/.test(webp), w: c.width, h: c.height, filled: +(seen / (px.length / 4)).toFixed(3) };
  });
  check(cap.png && cap.webp && cap.h === 300 && cap.filled > 0.01, 'capture PNG and WebP preview', cap);

  // 6 and 7. A head tap through the real handlers: a pat that flicks the hair it touched
  // (springs.touch, the Lab's tap), and her hair swings.
  await spyTouch(page);
  await page.mouse.move(forehead.x, forehead.y);
  await page.waitForTimeout(1500);
  const restHead = await sample(page, 1000);
  let p0 = await pats(page);
  await touched(page);
  const tapped = sample(page, 1500);
  await page.waitForTimeout(100);
  await tap(page.mouse, await headPoint(page, 200, 170));
  const tapSwing = await tapped;
  const tapPats = (await pats(page)) - p0, tapTouched = await touched(page);
  check(tapPats === 1 && tapTouched.length === 1 && tapTouched[0] > 0 && tapSwing.swing >= Math.max(0.02, 2 * restHead.swing) && tapSwing.finite,
    'head tap pats, flicks the hair it touched and swings the springs',
    { pats: tapPats, touched: tapTouched, baseline: +restHead.swing.toFixed(4), swing: +tapSwing.swing.toFixed(4), frames: tapSwing.frames });

  // 7b. Below the eye line is her cheek: the same handlers count a poke, not a pat.
  const before = { pats: await pats(page), pokes: await stat(page, 'pokes') };
  await tap(page.mouse, await headPoint(page, 214, 222));
  await page.waitForTimeout(300);
  const cheek = { pats: (await pats(page)) - before.pats, pokes: (await stat(page, 'pokes')) - before.pokes };
  check(cheek.pokes === 1 && cheek.pats === 0, 'a tap on her cheek is a poke, not a pat', cheek);

  // 8. Carry her up, swing her sideways, let go: she lands and is let go of.
  const chest = await page.evaluate(() => window.bijouVrm.clientOf('chest'));
  await page.mouse.move(chest.x, chest.y);
  await page.waitForTimeout(1500);
  const restBody = await sample(page, 1000);
  const carried = sample(page, 3000);
  await page.waitForTimeout(100);
  await drag(page, chest, 'vrm-drag.png');
  const carry = await carried;
  check(carry.held && carry.rootY > 0.15 && carry.swing >= Math.max(0.05, 2 * restBody.swing) && carry.finite, 'drag lifts and swings her',
    { baseline: +restBody.swing.toFixed(4), swing: +carry.swing.toFixed(4), rootY: +carry.rootY.toFixed(3) });
  await page.waitForTimeout(2500);
  const landed = await page.evaluate(() => ({ y: +window.bijouVrm.body.root.position.y.toFixed(4), held: window.bijouVrm.motion.state.held }));
  check(landed.y < 0.005 && !landed.held, 'she lands and is no longer held', landed);

  // 9. A stalled frame (what a hidden tab returns with): the springs rest instead of explode.
  let r0 = await resets(page);
  await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 400); });
  await page.waitForTimeout(300);
  check((await resets(page)) > r0 && (await finiteNow(page)), 'a 400 ms stall resets the springs', { resets: [r0, await resets(page)] });

  // 10. Pop-out sized stage: the canvas follows the SVG, the bridge stays finite.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(600);
  const sized = await page.evaluate(async () => {
    const { state } = await import('/js/state.js'), { qualityFor } = await import('/js/render-quality.js');
    const q = qualityFor(state.renderQuality), dpr = devicePixelRatio, pr = Math.min(dpr, q.pixelRatio) * (q.id === 'detailed' && dpr === 1 ? 1.5 : 1);
    const svg = document.getElementById('doll'), c = document.querySelector('canvas.avatar-canvas'), p = window.bijouVrm.doll.worldOf('head', 200, 150);
    return { canvas: [c.width, c.height], want: [Math.floor(svg.clientWidth * pr), Math.floor(svg.clientHeight * pr)], world: [p.x, p.y].every(Number.isFinite) };
  });
  check(sized.canvas[0] === sized.want[0] && sized.canvas[1] === sized.want[1] && sized.world && (await finiteNow(page)), 'canvas follows a small stage', sized);
  await page.setViewportSize({ width: 900, height: 720 });
  await page.waitForTimeout(600);

  // 11. Reduced motion: the springs hold still through a tap and a carry, and swing again after.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  const flags = await page.evaluate(() => { const b = window.bijouVrm; return [b.springs.state.reduced, b.motion.state.reduced, b.body.state.reduced]; });
  const ref = await page.evaluate(() => window.bijouVrm.locals());
  p0 = await pats(page);
  await touched(page);
  const still = sample(page, 6500, ref);
  await page.waitForTimeout(100);
  await tap(page.mouse, await headPoint(page, 200, 170));
  await page.waitForTimeout(700);
  await drag(page, await page.evaluate(() => window.bijouVrm.clientOf('chest')));
  const held = await still;
  const stillTouched = (await touched(page)).length;
  await stageShot(page, 'vrm-reduced.png');
  check(flags.every(Boolean) && held.swing < 1e-6 && held.held && !stillTouched && (await pats(page)) === p0 + 1, 'reduced motion holds the springs still',
    { flags, swing: held.swing, carried: held.held, touched: stillTouched });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(400);
  const again = sample(page, 1500);
  await page.waitForTimeout(100);
  await tap(page.mouse, await headPoint(page, 200, 170));
  const after = await again;
  check(after.swing > 0.01, 'springs swing again without reduced motion', { swing: +after.swing.toFixed(4) });

  // 12. The pop-out: the stage moves into a Picture-in-Picture window and keeps working.
  if (await page.evaluate(() => 'documentPictureInPicture' in window)) {
    r0 = await resets(page);
    const opened = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await page.locator('#popOut').click();
    const pip = await opened;
    if (pip) {
      watch(pip, 'pop-out');
      await pip.waitForSelector('#stage[data-renderer="3d"]', { timeout: 5000 });
      await pip.waitForTimeout(600);
      const moved = await resets(page);
      p0 = await pats(page);
      await tap(pip.mouse, await headPoint(page, 200, 170));
      await pip.waitForTimeout(600);
      const pipPats = (await pats(page)) - p0, pipFinite = await finiteNow(page);
      await pip.screenshot({ path: path.join(out, 'vrm-pop-out.png') });
      await pip.close();
      await page.waitForSelector('#stage[data-renderer="3d"]', { timeout: 5000 });
      await page.waitForTimeout(400);
      const back = await resets(page);
      check(moved > r0 && pipPats === 1 && pipFinite && back > moved, 'pop-out keeps her in 3D, a pat works there, she comes back', { resets: [r0, moved, back], pats: pipPats });
    } else {
      console.log('SKIP pop-out: no window opened');
      await page.keyboard.press('Escape');
    }
  } else console.log('SKIP pop-out: no Document Picture-in-Picture');

  // 12b. A lost WebGL context shows the 2D doll with avatar.js's message; a restored one brings her back.
  const context3d = await page.evaluate(async () => {
    const stage = document.getElementById('stage'), c = document.querySelector('canvas.avatar-canvas'), d = window.bijouVrm.doll;
    const lose = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    lose.loseContext();
    await wait(500);
    const lost = { renderer: stage.dataset.renderer, status: document.querySelector('.avatar-status').textContent, canvasHidden: c.hidden, is3D: d.is3D };
    lose.restoreContext();
    await wait(1000);
    const back = { renderer: stage.dataset.renderer, statusHidden: document.querySelector('.avatar-status').hidden, canvasHidden: c.hidden, is3D: d.is3D, calls: d.stats.calls };
    return { lost, back, finite: window.bijouVrm.springs.sample(12).flat().every(Number.isFinite) };
  });
  const { lost, back } = context3d;
  check(lost.renderer === 'svg' && lost.status === PAUSED && lost.canvasHidden && !lost.is3D && back.renderer === '3d' && back.statusHidden && !back.canvasHidden && back.is3D && back.calls > 0 && context3d.finite,
    'a lost WebGL context shows the 2D doll, a restored one brings her back', context3d);
  await ctx.close();

  // 13. &model=: a same-origin file loads as given; another origin is refused with a warning
  // (the page CSP would block the fetch anyway) and the bundled model loads instead.
  const own = '/assets/models/bijou.vrm?from=model-param', models = [];
  for (const [label, wanted] of [['same origin', own], ['other origin', 'https://bijou.example/model.vrm']]) {
    const mp = await (await context()).newPage();
    watch(mp, `model ${label}`);
    const asked = [], warned = [];
    mp.on('request', (r) => { const u = new URL(r.url()); if (/\.vrm$/.test(u.pathname)) asked.push(u.href.startsWith(BASE) ? u.pathname + u.search : u.href); });
    mp.on('console', (m) => { if (m.type() === 'warning' && /\?model/.test(m.text())) warned.push(m.text()); });
    await mp.goto(`${BASE}/?renderer=vrm&model=${encodeURIComponent(wanted)}`);
    await mp.waitForSelector('#stage[data-renderer]', { timeout: 90000 });
    models.push({ label, renderer: await mp.evaluate(() => document.getElementById('stage').dataset.renderer), asked, warned: warned.length });
    await mp.context().close();
  }
  check(models.every((m) => m.renderer === '3d') && models[0].asked.join() === own && !models[0].warned && models[1].asked.join() === '/assets/models/bijou.vrm' && models[1].warned === 1,
    '&model= loads a same-origin file and refuses another origin', models);

  // 14. No WebGL: the SVG doll, exactly as avatar.js falls back.
  const noGL = await (await context()).newPage();
  watch(noGL, 'no-webgl', (text) => text === NO_WEBGL);
  await noGL.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
  });
  await noGL.goto(`${BASE}/?renderer=vrm`);
  await fallbackState(noGL, 'no WebGL');
  await stageShot(noGL, 'vrm-fallback.png');
  await noGL.context().close();

  // 15. A missing model: the same fallback.
  const noModel = await (await context()).newPage();
  watch(noModel, 'no-model', (text, at) => /ERR_FAILED/.test(text) && /bijou\.vrm/.test(at));
  await noModel.route('**/assets/models/bijou.vrm', (r) => r.abort());
  await noModel.goto(`${BASE}/?renderer=vrm`);
  await fallbackState(noModel, 'missing model');
  await noModel.context().close();

  // 16. Verdict.
  check(!errors.length, 'no page or console errors', errors.length ? errors : 'none');
  console.log('screenshots:', out);
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
