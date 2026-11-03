// Retargeter: turn a humanoid animation from a GLB or FBX on your disk into
// a clip on Bijou (or the VRM in ?model=), watch it beside the source
// skeleton, and save it as a .vrma. Files are read in the browser and never
// leave it. Exposes window.retarget for checks.

import * as T from '../js/vendor/avatar-engine.js';
import { loadVRM, loadVRMA } from '../js/vrm-runtime.js';
import { createMotion } from '../js/vrm-motion.js';
import { createSprings, stepVRM } from '../js/vrm-physics.js';
import { retargetClip, BONE_MAPS, guessBoneMap, matchBones, aimPairs } from '../js/vrm-retarget.js';
import { writeVRMA } from '../js/vrma-writer.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CLIP = 'retargeted';

// meshoptimizer's decoder, for meshopt-compressed GLBs (every Mesh2Motion
// file). It compiles WebAssembly as it loads, which the companion's CSP
// forbids, so dev/vendor-avatar.sh builds it as a dev-only module beside the
// engine bundle, never into it. Until that script next runs, it is absent.
const meshopt = await import('../js/vendor/meshopt-decoder.js')
  .then(({ MeshoptDecoder: d }) => (d.supported ? d.ready.then(() => d) : null))
  .catch(() => null);

// ── Scene ────────────────────────────────────────────────────
const canvas = $('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = T.SRGBColorSpace;
const scene = new T.Scene();
scene.background = new T.Color('#f4e8ee');
const camera = new T.PerspectiveCamera(28, 1, 0.05, 60);
const controls = new T.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.5;
controls.maxDistance = 12;
scene.add(new T.HemisphereLight('#fff6f2', '#c3aed6', 1.5));
const key = new T.DirectionalLight('#ffffff', 2);
key.position.set(1.6, 3.2, 2.6);
scene.add(key);
const floor = new T.Mesh(new T.CircleGeometry(2.2, 64), new T.MeshBasicMaterial({ color: '#ead6e0' }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
scene.add(floor);
// The source skeleton stands this far from her, on the right of the screen:
// to her left from the front, behind her from the side.
const SIDE = 0.9;
let view = 'front';
const figureAt = () => (view === 'side' ? new T.Vector3(0, 0, -SIDE) : new T.Vector3(SIDE, 0, 0));

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

function frameView(kind = 'front') {
  view = kind === 'side' ? 'side' : 'front';
  const mid = figureAt().multiplyScalar(0.5).setY(0.85);
  controls.target.copy(mid);
  if (view === 'side') camera.position.set(mid.x + 4.4, 1.05, mid.z);
  else camera.position.set(mid.x, 1.05, mid.z + 4.6);
  controls.update();
  if (figure) { figure.group.position.copy(figureAt()); drawFigure(); }
}

// ── State ────────────────────────────────────────────────────
let doll = null;    // { vrm, motion, springs }
let source = null;  // { root, clips, name }
let clip = null;    // the retargeted clip she plays
let figure = null;  // the source skeleton beside her
let paused = false;
const status = (msg) => { $('status').textContent = msg; };

// What this engine bundle can read, said plainly on the page.
function renderSupport() {
  const notes = [
    meshopt
      ? ['ok', '<strong>Meshopt decoder:</strong> loaded from js/vendor/meshopt-decoder.js, so meshopt-compressed GLBs (Mesh2Motion) open.']
      : ['missing', '<strong>Meshopt decoder: missing.</strong> js/vendor/meshopt-decoder.js has not been built (or this browser has no WebAssembly), so meshopt-compressed GLBs, which is every Mesh2Motion file, will not open. Run dev/vendor-avatar.sh to build it.'],
    T.FBXLoader
      ? ['ok', '<strong>FBX loader:</strong> in the bundle.']
      : ['missing', '<strong>FBX loader: missing</strong> from the bundle, so .fbx files (Mixamo) will not open here. Convert them to GLB in Blender first, or add FBXLoader to dev/vendor-avatar.sh.'],
  ];
  $('support').innerHTML = notes.map(([k, html]) => `<p class="${k}">${html}</p>`).join('');
}

function renderMaps() {
  const counts = source ? Object.fromEntries(Object.entries(BONE_MAPS).map(([id, { map }]) => [id, Object.keys(matchBones(source.root, map)).length])) : {};
  const best = source ? guessBoneMap(source.root) : null;
  const keep = $('map').value;
  $('map').innerHTML = [['', `Best match${best ? `: ${best}` : ''}`], ...Object.entries(BONE_MAPS).map(([id, { label }]) => [id, `${label}${source ? `, ${counts[id]} bones` : ''}`])]
    .map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  $('map').value = keep;
}

function renderReport() {
  const r = clip?.userData.retarget;
  const src = source && source.clips[+$('clip').value || 0];
  const rows = !source ? [['Source', 'none yet']] : [
    ['File', source.name],
    ['Clip', src ? `${src.name || 'unnamed'}, ${src.duration.toFixed(2)} s` : 'none'],
  ];
  if (r) {
    rows.push(
      ['Bone map', `${r.map}, ${Object.keys(r.bones).length} bones matched, ${r.driven} tracks move them`],
      ['Not in the source', summarize(r.missing)],
      ['Folded (she lacks them)', summarize(r.folded)],
      ['Hips scale', r.scale.toFixed(3)],
      ['Axes', facing(r.frame)],
      ['Keys', `${r.keys}`],
    );
  }
  $('report').innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    $('report').append(dt, dd);
  }
}

/** A bone list with fingers gathered per hand: "left thumb, index fingers; neck". */
function summarize(bones) {
  if (!bones.length) return 'none';
  const hands = { left: new Set(), right: new Set() }, rest = [];
  for (const b of bones) {
    const m = /^(left|right)(Thumb|Index|Middle|Ring|Little)/.exec(b);
    if (m) hands[m[1]].add(m[2].toLowerCase()); else rest.push(b);
  }
  const fingers = Object.entries(hands).filter(([, s]) => s.size).map(([side, s]) => `${side} ${[...s].join(', ')} fingers`);
  return `${[...fingers, ...rest].join('; ')} (${bones.length} bones)`;
}

/** Where the source's up and front were, from the frame the retargeter found. */
function facing(frame) {
  const inv = new T.Quaternion().fromArray(frame).invert();
  const axis = (v) => {
    const a = v.applyQuaternion(inv).toArray();
    const k = [0, 1, 2].reduce((m, c) => (Math.abs(a[c]) > Math.abs(a[m]) ? c : m), 0);
    return `${a[k] < 0 ? '-' : '+'}${'XYZ'[k]}`;
  };
  return `source up ${axis(new T.Vector3(0, 1, 0))}, front ${axis(new T.Vector3(0, 0, 1))}`;
}

// ── Loading ──────────────────────────────────────────────────
async function loadDoll(src) {
  const { vrm, info } = await loadVRM(src);
  scene.add(vrm.scene);
  const motion = createMotion(vrm, { reduced, sleepAfter: 0 });
  const springs = createSprings(vrm);
  springs.set({ reduced });
  doll = { vrm, motion, springs, info };
  setLayers($('layers').checked);
  for (let i = 0; i < 90; i++) frame(1 / 60);
}

async function readSource(file) {
  const kind = file.name.split('.').pop().toLowerCase();
  if (kind === 'fbx') {
    if (!T.FBXLoader) throw new Error('this engine bundle has no FBXLoader. Convert the file to GLB in Blender, or add FBXLoader to dev/vendor-avatar.sh.');
    const root = new T.FBXLoader().parse(await file.arrayBuffer(), '');
    return { root, clips: root.animations || [] };
  }
  const loader = new T.GLTFLoader();
  if (meshopt) loader.setMeshoptDecoder(meshopt);
  try {
    const gltf = await loader.parseAsync(await file.arrayBuffer(), '');
    return { root: gltf.scene, clips: gltf.animations || [] };
  } catch (err) {
    if (!meshopt && /meshopt/i.test(err.message)) throw new Error('it is meshopt-compressed and js/vendor/meshopt-decoder.js is missing. Run dev/vendor-avatar.sh to build it.');
    throw err;
  }
}

async function openFile(file) {
  status(`Reading ${file.name}…`);
  try {
    const { root, clips } = await readSource(file);
    status('');
    useSource(root, clips, file.name);
  } catch (err) {
    status(`Could not open ${file.name}: ${err.message}`);
    throw err;
  }
}

/** Use an Object3D hierarchy standing in its rest pose, with its clips, as the source. */
function useSource(root, clips, name = 'source') {
  if (!clips.length) throw new Error('the file has no animation.');
  source = { root, clips, name };
  $('clip').innerHTML = clips.map((c, i) => `<option value="${i}">${c.name || `clip ${i + 1}`} (${c.duration.toFixed(2)} s)</option>`).join('');
  $('clip').disabled = clips.length < 2;
  $('name').value = (clips[0].name || name).replace(/\.[^.]+$/, '');
  renderMaps();
  return retarget();
}

// ── Retarget and preview ─────────────────────────────────────
function retarget() {
  if (!doll || !source) return null;
  const src = source.clips[+$('clip').value || 0];
  try {
    clip = retargetClip(src, source.root, doll.vrm, {
      map: $('map').value || undefined, tpose: $('tpose').checked, inPlace: $('inplace').checked,
      translation: $('translation').checked, fps: +$('fps').value,
    });
  } catch (err) {
    clip = null;
    disposeFigure();
    status(err.message);
    renderReport();
    $('save').disabled = true;
    return null;
  }
  doll.motion.addClip(CLIP, clip);
  doll.motion.play(CLIP, { fade: 0.15 });
  buildFigure(src);
  setPaused(false);
  renderReport();
  $('save').disabled = false;
  if (!clip.userData.retarget.driven) status('This clip moves none of the matched bones: try the other bone map.');
  return clip;
}

function restart() {
  if (!clip) return;
  doll.motion.play(CLIP, { fade: 0.1 });
  figure?.action.reset().play();
  setPaused(false);
}

// The source skeleton: a copy playing the original clip, turned into her
// frame and scaled by the same hips ratio, drawn as lines between its joints.
function buildFigure(src) {
  disposeFigure();
  if (!$('skeleton').checked || !clip) return;
  const r = clip.userData.retarget;
  const copy = T.SkeletonUtils.clone(source.root);
  const table = BONE_MAPS[r.map]?.map;
  const joints = table ? matchBones(copy, table) : {};
  const names = Object.keys(r.bones).filter((b) => joints[b]);
  const pairs = names.map((b) => {
    let p = T.VRMHumanBoneParentMap[b];
    while (p && !names.includes(p)) p = T.VRMHumanBoneParentMap[p];
    return p ? [p, b] : null;
  }).filter(Boolean);
  const group = new T.Group();
  group.add(copy);
  group.quaternion.fromArray(r.frame);
  group.scale.setScalar(r.scale);
  group.position.copy(figureAt());
  copy.traverse((o) => { if (o.isMesh) o.visible = false; });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pairs.length * 6), 3));
  const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#7b3f8c', depthTest: false }));
  lines.renderOrder = 2;
  lines.frustumCulled = false;
  scene.add(group, lines);
  const mixer = new T.AnimationMixer(copy);
  const action = mixer.clipAction(src).play();
  figure = { group, lines, mixer, action, joints, pairs };
  drawFigure();
}

function drawFigure() {
  if (!figure) return;
  figure.group.updateMatrixWorld(true);
  const a = figure.lines.geometry.attributes.position;
  const v = new T.Vector3();
  figure.pairs.forEach(([p, b], i) => {
    figure.joints[p].getWorldPosition(v); a.setXYZ(i * 2, v.x, v.y, v.z);
    figure.joints[b].getWorldPosition(v); a.setXYZ(i * 2 + 1, v.x, v.y, v.z);
  });
  a.needsUpdate = true;
}

function disposeFigure() {
  if (!figure) return;
  figure.mixer.stopAllAction();
  scene.remove(figure.group, figure.lines);
  figure.lines.geometry.dispose();
  figure.lines.material.dispose();
  figure = null;
}

/** Largest angle (degrees) between her bones and the source skeleton's, over the pairs the T-pose aligns. */
function directionError() {
  if (!figure || !doll) return null;
  const h = doll.vrm.humanoid, a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
  let max = 0, n = 0;
  for (const [p, q] of aimPairs(Object.keys(figure.joints).filter((x) => h.getRawBoneNode(x)))) {
    figure.joints[p].getWorldPosition(a); figure.joints[q].getWorldPosition(b);
    h.getRawBoneNode(p).getWorldPosition(c); h.getRawBoneNode(q).getWorldPosition(d);
    max = Math.max(max, b.sub(a).angleTo(d.sub(c)));
    n++;
  }
  return { max: (max * 180) / Math.PI, pairs: n };
}

function setLayers(on) {
  if (!doll) return;
  doll.motion.state.idle = on ? 1 : 0;
  doll.motion.follow = on;
  doll.motion.saccades = on;
}
function setPaused(on) {
  paused = on;
  for (const b of document.querySelectorAll('[data-act="play"], [data-act="pause"]')) b.setAttribute('aria-pressed', String((b.dataset.act === 'pause') === on));
}

// ── Frame loop ───────────────────────────────────────────────
function frame(dt) {
  if (!doll) return;
  const t = paused ? 0 : dt * +$('speed').value;
  if ($('layers').checked) doll.motion.state.look.copy(camera.position);
  doll.motion.update(t);
  stepVRM(doll.vrm, dt, doll.springs);
  if (figure) { figure.mixer.update(t); drawFigure(); }
}

const clock = new T.Clock();
let since = 0;
if (!params.get('still')) renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  frame(dt);
  controls.update();
  renderer.render(scene, camera);
  if ((since += dt) > 0.5) {
    since = 0;
    const e = $('layers').checked ? null : directionError();
    $('match').textContent = e ? `Her bones point within ${e.max.toFixed(2)} degrees of the source's (${e.pairs} bones).` : '';
  }
});

// ── Save ─────────────────────────────────────────────────────
/** Largest key difference between two clips with the same tracks. */
function clipDiff(a, b) {
  const other = new Map(b.tracks.map((t) => [t.name, t]));
  let max = 0;
  for (const t of a.tracks) {
    const u = other.get(t.name);
    if (!u || u.values.length !== t.values.length) return Infinity;
    for (let i = 0; i < t.values.length; i++) max = Math.max(max, Math.abs(t.values[i] - u.values[i]));
  }
  return max;
}

async function save() {
  if (!clip) return null;
  const name = ($('name').value.trim() || 'animation').replace(/[^\w.-]+/g, '_');
  const buffer = writeVRMA(clip, doll.vrm, { name });
  const url = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.vrma` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  // Read it back the way the Lab and the companion will.
  const back = T.createVRMAnimationClip(await loadVRMA(buffer), doll.vrm);
  const diff = clipDiff(clip, back);
  $('saved').textContent = `Saved ${name}.vrma (${(buffer.byteLength / 1024).toFixed(1)} KB). Read back, it matches the preview to within ${diff.toExponential(1)}.`;
  return { buffer, diff };
}

// ── Panel ────────────────────────────────────────────────────
$('file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openFile(f).catch(() => {}); });
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drop'); });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drop'); });
addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drop');
  const f = e.dataTransfer.files[0];
  if (f) openFile(f).catch(() => {});
});
for (const id of ['clip', 'map', 'tpose', 'inplace', 'translation', 'fps']) $(id).addEventListener('change', () => { status(''); retarget(); });
$('skeleton').addEventListener('change', () => { if (clip) buildFigure(source.clips[+$('clip').value || 0]); restart(); });
$('layers').addEventListener('change', () => setLayers($('layers').checked));
$('speed').addEventListener('input', () => { $('o-speed').textContent = `${(+$('speed').value).toFixed(2)}x`; });
$('save').addEventListener('click', () => save().catch((err) => { $('saved').textContent = `Could not save: ${err.message}`; }));
document.querySelector('.panel').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const kind = e.target.closest('[data-view]')?.dataset.view;
  if (act === 'play') setPaused(false);
  if (act === 'pause') setPaused(true);
  if (act === 'restart') restart();
  if (kind) frameView(kind);
});

renderSupport();
renderMaps();
renderReport();
$('o-speed').textContent = '1.00x';
frameView('front');
window.retarget = {
  useSource, retarget, save, restart, frame, directionError, view: frameView,
  get doll() { return doll; }, get source() { return source; }, get clip() { return clip; },
  step(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) frame(dt); renderer.render(scene, camera); },
  render() { renderer.render(scene, camera); },
};
try {
  await loadDoll(params.get('model') || '../assets/models/bijou.vrm');
  status('');
  if (source) retarget();
} catch (err) {
  status(`Could not load the doll: ${err.message}`);
  throw err;
}
