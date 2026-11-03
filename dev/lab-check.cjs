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
  await page.evaluate(() => { window.lab.step(2.5); window.lab.cur.motion.gesture('wave'); window.lab.step(0.9); });
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

  const finite = [...rest, ...spin].every((p) => p.every(Number.isFinite));
  console.log('finite spring positions:', finite);
  console.log('console errors:', errors.length ? errors : 'none');
  console.log('screenshots:', out);
  await browser.close();
  process.exit(errors.length || !finite ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
