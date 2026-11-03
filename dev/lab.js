// Doll Lab: load any VRM, animate it, simulate its springs, and handle it.
// A development harness for judging models, motions and physics side by
// side before they reach the companion. Exposes window.lab for checks.

import * as T from '../js/vendor/avatar-engine.js';
import { loadVRM, loadVRMA, disposeVRM } from '../js/vrm-runtime.js';
import { createMotion, GESTURE_NAMES } from '../js/vrm-motion.js';
import { createSprings, createBody, stepVRM, PRESETS } from '../js/vrm-physics.js';
import { attachRibbons } from '../js/vrm-accessory.js';
import { createPressGestures } from '../js/vrm-touch.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ?seed=N makes idle picks, saccades and blinks repeatable, for checks. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Scene ────────────────────────────────────────────────────
const canvas = $('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color('#f4e8ee');
const camera = new T.PerspectiveCamera(28, 1, 0.05, 60);
camera.position.set(0, 1.15, 4.2);
const controls = new T.OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.5;
controls.maxDistance = 9;

scene.add(new T.HemisphereLight('#fff6f2', '#c3aed6', 1.4));
const key = new T.DirectionalLight('#ffffff', 2.1);
key.position.set(1.6, 3.2, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5, near: 0.5, far: 10 });
scene.add(key);
const rim = new T.DirectionalLight('#ffd3ea', 0.9);
rim.position.set(-2, 2.4, -2.5);
scene.add(rim);
const floor = new T.Mesh(new T.CircleGeometry(4, 64), new T.ShadowMaterial({ opacity: 0.16 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const disc = new T.Mesh(new T.CircleGeometry(0.9, 64), new T.MeshBasicMaterial({ color: '#ead6e0' }));
disc.rotation.x = -Math.PI / 2;
disc.position.y = -0.002;
scene.add(disc);

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

// ── State ────────────────────────────────────────────────────
let cur = null;
let preset = 'natural';
const status = (msg) => { $('status').textContent = msg; };
const clayMat = new T.MeshToonMaterial({ color: '#f1e3e6' });

function renderInfo(info) {
  const rows = [
    ['Name', info.name], ['Author', info.author], ['Format', info.version],
    ['License', info.license.summary], ['Modification', info.license.modification],
    ['Avatar use', info.license.avatarUse], ['Commercial', info.license.commercial],
    ['Springs', `${info.springs} joints, ${info.colliders} colliders`],
    ['Expressions', info.expressions.join(', ') || 'none'],
  ];
  $('info').innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    $('info').append(dt, dd);
  }
}

function applyClay(on) {
  if (!cur) return;
  cur.vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.labMat) o.userData.labMat = o.material;
    o.material = on ? clayMat : o.userData.labMat;
  });
}

// Runtime accessories join the model's own spring manager and colliders.
function setRibbons(on) {
  if (!cur) return;
  if (on && !cur.ribbons) cur.ribbons = attachRibbons(cur.vrm, $('ribbon-color').value);
  if (!on && cur.ribbons) { cur.ribbons.dispose(); cur.ribbons = null; }
  cur.springs.refresh();
  applyClay($('clay').checked);
  showHelpers($('helpers').checked);
}

// Spring and collider overlay, rebuilt whenever the joints change.
let helpers = [];
function showHelpers(on) {
  for (const h of helpers) { h.removeFromParent(); h.dispose?.(); }
  helpers = [];
  const mgr = cur?.vrm.springBoneManager;
  if (!on || !mgr) return;
  for (const j of mgr.joints) helpers.push(new T.VRMSpringBoneJointHelper(j));
  for (const c of mgr.colliders) helpers.push(new T.VRMSpringBoneColliderHelper(c));
  for (const h of helpers) scene.add(h);
}

const SLIDERS = ['stiffness', 'gravity', 'drag', 'wind', 'bounce', 'inertia'];
function physicsValues() {
  return { stiffness: +$('stiffness').value, gravity: +$('gravity').value, drag: +$('drag').value, wind: +$('wind').value, bounce: +$('bounce').value, inertia: +$('inertia').value, enabled: $('springs').checked, reduced };
}

function syncOutputs() {
  for (const id of SLIDERS) $(`o-${id}`).textContent = (+$(id).value).toFixed(2);
}

async function load(src, label = 'model') {
  status(`Loading ${label}…`);
  try {
    const { vrm, info } = await loadVRM(src);
    if (cur) { showHelpers(false); scene.remove(cur.body.root); disposeVRM(cur.vrm); }
    const seed = params.get('seed');
    const motion = createMotion(vrm, { reduced, sleepAfter: +(params.get('sleep') || 60), random: seed ? seeded(+seed) : undefined });
    const body = createBody(vrm, {
      // Landing is an event-only behaviour in the idle scheduler; a soft one just ends the flight.
      onLand: (impact) => {
        if (cur) cur.falling = false;
        if (impact > 1.2) motion.fire('land');
        else { motion.endEvent('toss'); motion.endEvent('fall'); }
        if (impact > 3) motion.gesture('nod');
      },
    });
    const springs = createSprings(vrm, { root: body.root });
    body.state.reduced = reduced;
    scene.add(body.root);
    cur = { vrm, springs, motion, body, info, label, ribbons: null, falling: false };
    setRibbons($('ribbons').checked);
    springs.set({ ...PRESETS[preset], ...physicsValues() });
    applyClay($('clay').checked);
    motion.state.idle = $('idle').checked ? 1 : 0;
    motion.follow = $('follow').checked;
    // Let springs settle in the rest pose before the first frame is shown.
    for (let i = 0; i < 120; i++) frame(1 / 60);
    renderInfo(info);
    frameView('full');
    renderClips();
    status('');
  } catch (err) {
    status(`Could not load ${label}: ${err.message}`);
    throw err;
  }
}

// ── Frame loop ───────────────────────────────────────────────
const follow = new T.Vector3();
function frame(dt) {
  if (!cur) return;
  cur.body.update(dt);
  // Let go of in the air and coming down fast: a fall, until she lands.
  const b = cur.body.state;
  if (b.airborne && !b.held && b.vel.y < -3 && !cur.falling) { cur.falling = true; cur.motion.fire('fall'); }
  cur.motion.update(dt);
  stepVRM(cur.vrm, dt, cur.springs);
  // The camera drifts after her, so a toss never carries her out of view.
  const root = cur.body.root.position;
  follow.set(root.x - controls.target.x, (root.y * 0.5) - 0, 0);
  const k = 1 - Math.exp(-dt * 3);
  const dx = follow.x * k;
  controls.target.x += dx;
  camera.position.x += dx;
}

const clock = new T.Clock();
let frames = 0, fpsT = 0;
// ?still=1 stops the loop: checks step and render explicitly (software GL is slow).
if (params.get('still')) key.shadow.mapSize.set(512, 512);
if (!params.get('still')) renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  frame(dt);
  controls.update();
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) {
    $('stats').textContent = `${Math.round(frames / fpsT)} fps · ${renderer.info.render.calls} draw calls · ${cur ? cur.springs.count : 0} spring joints`;
    showIdle();
    frames = 0; fpsT = 0;
  }
});

/** What the scheduler is doing, and how many pats she has had. */
function showIdle() {
  if (!cur) return;
  const now = cur.motion.idle.current, st = cur.motion.state;
  const doing = st.sleep > 0.5 ? 'dozing' : now ? `${now.name} (${now.phase})` : 'resting';
  $('idle-now').textContent = `Now: ${doing} · ${st.pats} pat${st.pats === 1 ? '' : 's'}`;
}

// ── Pointer: carry, toss, pat, tap, look ─────────────────────
// vrm-touch.js decides what a press is. A stroke over the head pats her
// (AIRI's recogniser: the stroke must turn back, and every 70 px of it is one
// more pat); a quick press is a tap; a press below the neck, or a
// press-and-hold on the head, picks her up.
const ray = new T.Raycaster();
const ndc = new T.Vector2();
const plane = new T.Plane();
const hit = new T.Vector3();
const touches = createPressGestures();
let press = null;

function pointerRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function onPlane(point) {
  const n = new T.Vector3().subVectors(camera.position, point).setY(0).normalize();
  plane.setFromNormalAndCoplanarPoint(n, point);
}
function neckY() {
  const n = cur.vrm.humanoid.getNormalizedBoneNode('neck');
  return n ? n.getWorldPosition(new T.Vector3()).y : 1.3;
}

/** Her head as a sphere around its bone, so a stroke between strands of hair is still on her head. */
function headSphere() {
  const h = cur.vrm.humanoid.getNormalizedBoneNode('head');
  const c = h ? h.getWorldPosition(new T.Vector3()) : new T.Vector3(0, 1.4, 0);
  const s = Math.min(1.5, Math.max(0.65, cur.info.headHeight / 1.45));
  c.y += 0.09 * s;
  return { c, r: 0.15 * s };
}

/** A sample for the recogniser: over her head or not, and where across it (viewer's left -1 to right 1). */
function sampleOf(e, region = null) {
  const { c, r } = headSphere();
  const across = ray.ray.closestPointToPoint(c, new T.Vector3()).sub(c).dot(new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0));
  const over = ray.ray.distanceToPoint(c) < r ? 'head' : 'body';
  return { x: e.clientX, y: e.clientY, ms: e.timeStamp, hit: { region: region || over, side: Math.max(-1, Math.min(1, across / r)) } };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!cur || e.button !== 0) return;
  pointerRay(e);
  const hits = ray.intersectObject(cur.vrm.scene, true);
  if (!hits.length) return;
  e.preventDefault();
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  const p = hits[0].point.clone();
  onPlane(p);
  press = { id: e.pointerId, point: p };
  touches.down(sampleOf(e, p.y > neckY() ? 'head' : 'body'));
});

// Brushing: a moving pointer ruffles the hair and ribbons it passes through.
const brush = { p: new T.Vector3(), t: 0, has: false };
function brushThrough(h) {
  onPlane(h);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const now = performance.now();
  const dt = (now - brush.t) / 1000;
  if (brush.has && dt > 0 && dt < 0.1) {
    const vel = hit.clone().sub(brush.p).divideScalar(dt).clampLength(0, 3);
    if (vel.length() > 0.15) cur.springs.touch({ ray: ray.ray, vel, radius: 0.09, gain: 1.6 });
  }
  brush.p.copy(hit); brush.t = now; brush.has = true;
}

canvas.addEventListener('pointermove', (e) => {
  if (!cur) return;
  pointerRay(e);
  if (!press) {
    // Look at the pointer, projected onto a plane in front of her face.
    const head = cur.vrm.humanoid.getNormalizedBoneNode('head');
    if (head) {
      const h = head.getWorldPosition(new T.Vector3());
      brushThrough(h);
      onPlane(h.clone().add(new T.Vector3().subVectors(camera.position, h).setY(0).normalize().multiplyScalar(0.6)));
      if (ray.ray.intersectPlane(plane, hit)) cur.motion.lookAt(hit);
    }
    return;
  }
  if (e.pointerId !== press.id) return;
  const ev = touches.move(sampleOf(e));
  if (ev?.type === 'pickup') {
    cur.body.hold(press.point);
    cur.motion.setHeld(true);
  }
  if (touches.mode === 'carry') {
    if (ray.ray.intersectPlane(plane, hit)) cur.body.move(hit);
    return;
  }
  if (touches.mode !== 'stroke' || !ray.ray.intersectPlane(plane, hit)) return;
  // A stroking hand ruffles the hair it passes; every pat presses down on it.
  const dx = e.movementX || 0;
  cur.springs.touch({ point: hit, vel: new T.Vector3(dx * 0.05, -0.4, 0), radius: 0.14, gain: 1.2 });
  if (ev?.type === 'pat') {
    cur.motion.touch({ region: 'head', gesture: 'pat', side: ev.side });
    cur.springs.touch({ point: hit, vel: new T.Vector3(0, -1.2, 0), radius: 0.16 });
  }
});

function endPress(e) {
  if (!press || e.pointerId !== press.id) return;
  const p = press;
  press = null;
  controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  pointerRay(e);
  const ev = e.type === 'pointercancel' ? touches.cancel() : touches.up(sampleOf(e));
  if (ev?.type === 'drop') {
    cur.body.release();
    cur.motion.setHeld(false);
    // Let go of while moving fast: thrown.
    if (cur.body.state.vel.length() > 2) cur.motion.fire('toss');
    return;
  }
  if (ev?.type !== 'tap') return;
  cur.motion.touch({ region: ev.region, gesture: 'tap', side: ev.side });
  if (ev.region === 'head') {
    cur.motion.mood({ happy: 1 }, 1.8);
    cur.motion.gesture('tilt');
    cur.body.poke(0.5);
    cur.springs.touch({ point: p.point, vel: new T.Vector3(0, -1.6, 0), radius: 0.16 });
  } else {
    cur.motion.mood({ surprised: 0.8, happy: 0.4 }, 1.2);
    cur.body.poke(1);
  }
}
canvas.addEventListener('pointerup', endPress);
canvas.addEventListener('pointercancel', endPress);

// ── Panel ────────────────────────────────────────────────────
function chips(el, items, onClick) {
  el.innerHTML = '';
  for (const [id, label] of items) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.id = id;
    b.addEventListener('click', () => onClick(id, b));
    el.append(b);
  }
}
chips($('gestures'), GESTURE_NAMES.map((g) => [g, g[0].toUpperCase() + g.slice(1)]), (g) => cur?.motion.gesture(g));
chips($('presets'), Object.entries(PRESETS).map(([k, v]) => [k, v.label]), (k) => {
  preset = k;
  const p = PRESETS[k];
  $('stiffness').value = p.stiffness; $('gravity').value = p.gravity; $('drag').value = p.drag;
  syncOutputs();
  cur?.springs.set({ ...p, ...physicsValues() });
  for (const b of $('presets').children) b.setAttribute('aria-pressed', String(b.dataset.id === k));
});
const MOODS = [['happy', 'Happy'], ['relaxed', 'Relaxed'], ['surprised', 'Surprised'], ['sad', 'Sad'], ['angry', 'Pout'], ['neutral', 'Neutral']];
chips($('moods'), MOODS, (m) => cur?.motion.mood({ [m]: 1 }, 3));

function renderClips() {
  const names = cur ? cur.motion.clips : [];
  if (!names.length) { $('clips').innerHTML = '<span class="muted">None yet. Drop a .vrma file.</span>'; return; }
  chips($('clips'), [...names.map((n) => [n, n]), ['__stop', 'Stop']], (n) => (n === '__stop' ? cur.motion.stopClip() : cur.motion.play(n)));
}

for (const id of SLIDERS) {
  $(id).addEventListener('input', () => { syncOutputs(); cur?.springs.set(physicsValues()); });
}
$('helpers').addEventListener('change', () => showHelpers($('helpers').checked));
$('springs').addEventListener('change', () => { cur?.springs.set(physicsValues()); cur?.springs.reset(); });
$('idle').addEventListener('change', () => { if (cur) cur.motion.state.idle = $('idle').checked ? 1 : 0; });
$('clip-idles').addEventListener('change', () => { for (const n of cur ? cur.motion.clips : []) clipIdle(n); });
/** With the box ticked, dropped clips join the idle rotation (at idle priority, under the gaze). */
function clipIdle(name) {
  if ($('clip-idles').checked) cur.motion.addIdle(name);
  else cur.motion.removeIdle(name);
}
$('follow').addEventListener('change', () => { if (cur) cur.motion.follow = $('follow').checked; });
$('blink').addEventListener('change', () => { if (cur) cur.motion.blink = $('blink').checked; });
$('clay').addEventListener('change', () => applyClay($('clay').checked));
$('ribbons').addEventListener('change', () => setRibbons($('ribbons').checked));
$('ribbon-color').addEventListener('input', () => cur?.ribbons?.recolor($('ribbon-color').value));

document.querySelector('.panel').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const view = e.target.closest('[data-view]')?.dataset.view;
  if (act && cur) {
    if (act === 'hop') cur.body.hop();
    if (act === 'spin') { cur.body.spin(1); cur.motion.gesture('spin'); }
    if (act === 'toss') toss(1.6, 3.2);
    if (act === 'talk') cur.motion.talk(2.2);
    if (act === 'next-idle') { cur.motion.idle.next(); showIdle(); }
  }
  if (view) frameView(view);
});

function toss(vx, vy) {
  if (!cur) return;
  const st = cur.body.state;
  st.airborne = true;
  st.vel.set(vx, vy, 0);
  cur.motion.setHeld(true);
  cur.motion.fire('toss');
  setTimeout(() => cur?.motion.setHeld(false), 700);
}

function frameView(kind) {
  const h = cur ? Math.max(0.8, cur.info.headHeight) : 1.4;
  if (kind === 'face') { controls.target.set(0, h, 0); camera.position.set(0, h + 0.02, 0.85); }
  else if (kind === 'side') { controls.target.set(0, h * 0.62, 0); camera.position.set(3.6, h * 0.7, 0.6); }
  else { controls.target.set(0, h * 0.6, 0); camera.position.set(0, h * 0.72, h * 2.9); }
  controls.update();
}

// ── Files ────────────────────────────────────────────────────
async function openFile(file) {
  if (/\.vrma$/i.test(file.name)) {
    if (!cur) return;
    const anim = await loadVRMA(file);
    const name = file.name.replace(/\.vrma$/i, '');
    cur.motion.addClip(name, anim);
    clipIdle(name);
    renderClips();
    cur.motion.play(name);
  } else {
    await load(file, file.name);
  }
}
$('file').addEventListener('change', async (e) => { for (const f of e.target.files) await openFile(f).catch(() => {}); });
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drop'); });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drop'); });
addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('drop');
  for (const f of e.dataTransfer.files) await openFile(f).catch(() => {});
});

syncOutputs();
for (const b of $('presets').children) b.setAttribute('aria-pressed', String(b.dataset.id === preset));
/** A world point in client pixels. */
function toClient(p) {
  camera.updateMatrixWorld();
  const r = canvas.getBoundingClientRect(), v = p.clone().project(camera);
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}
window.lab = {
  load, frame, toss,
  ribbons(on) { $('ribbons').checked = on; setRibbons(on); },
  get cur() { return cur; },
  step(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) frame(dt); renderer.render(scene, camera); },
  view: frameView,
  render() { renderer.render(scene, camera); },
  /** Her head on screen, for scripted strokes: { x, y, r } in client pixels. */
  headScreen() {
    const { c, r } = headSphere();
    const a = toClient(c), b = toClient(c.clone().add(new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(r)));
    return { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
  },
  /** A humanoid bone on screen, in client pixels. */
  boneScreen(name) {
    const n = cur.vrm.humanoid.getNormalizedBoneNode(name);
    return n ? toClient(n.getWorldPosition(new T.Vector3())) : null;
  },
  get pressMode() { return touches.mode; },
};
await load(params.get('model') || '../assets/models/bijou.vrm', 'Bijou');
if (params.get('vrma')) {
  const anim = await loadVRMA(params.get('vrma'));
  cur.motion.addClip('clip', anim);
  renderClips();
  cur.motion.play('clip');
}
