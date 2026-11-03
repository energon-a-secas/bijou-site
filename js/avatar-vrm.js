// ── VRM companion: the runtime behind the doll interface ─────
// The companion on the model-agnostic VRM runtime, speaking the interface
// avatar.js speaks, so motion, behaviour, touch, effects and the pop-out work
// unchanged. app.js loads it only for ?renderer=vrm.
//   - motion.js stays the one owner of carrying, falling, landing, hops and
//     the twirl: its frame places the rig (root > lean > squash > model) and
//     the model's own springs feel that travel. createBody adds only poke
//     squash and tilt; its hold, move, release, hop and spin are never used,
//     so two integrators never fight or land twice.
//   - Faces and gestures come from vrm-motion.js: behaviour's expressions
//     become moods, its poses become gestures, its sleep is the runtime doze.
//   - No loop of its own: motion.js calls render() once a frame from whichever
//     window hosts the stage, so the pop-out's requestAnimationFrame drives
//     one VRM step and one draw. A change of window is a discontinuity.
//   - The SVG doll stays the fallback and the screen-coordinate bridge.
// The bundled model is the CC0 beta stand-in: wardrobe and body edits rebuild
// only the hidden SVG fallback here, and nothing new is built on that model.

import * as T from './vendor/avatar-engine.js';
import { createDoll } from './doll.js';
import { pivots, solve, apply, isHeadBone } from './rig.js';
import { POSES } from './poses.js';
import { BODY_REGIONS } from './body-shape.js';
import { qualityFor } from './render-quality.js';
import { loadVRM, disposeVRM } from './vrm-runtime.js';
import { createMotion } from './vrm-motion.js';
import { createSprings, createBody, stepVRM } from './vrm-physics.js';
import { attachRibbons } from './vrm-accessory.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const DEG = Math.PI / 180;

// Behaviour's faces as expression weights; a model without one skips it.
const MOODS = {
  smile: { happy: 0.25 }, happy: { happy: 0.6 }, grin: { happy: 0.75 }, joy: { happy: 1 },
  love: { happy: 0.9, relaxed: 0.25 }, wink: { happy: 0.6, blinkLeft: 1 },
  blush: { happy: 0.3, sad: 0.25 }, flustered: { surprised: 0.3, sad: 0.3 },
  surprised: { surprised: 0.9, oh: 0.35 }, pout: { angry: 0.6 },
  curious: { surprised: 0.25, happy: 0.2 }, dizzy: { sad: 0.35, relaxed: 0.35 }, sleepy: { relaxed: 0.6 },
};
// Poses whose arms speak through a runtime gesture; the others stand at ease.
const GESTURE_OF = {
  wave: 'wave', cheer: 'cheer', stretch: 'stretch', shy: 'shy', peace: 'peace',
  think: 'think', spin: 'spin', admire: 'tilt', salute: 'nod', curtsy: 'nod',
};
// motion.js hands each pose's own `hands` object to setPoseLook, so it names the pose.
const POSE_OF = new Map(Object.values(POSES).map((p) => [p.hands, p.id]));

const CHIN = 244;              // canonical head space: the chin (rig.js HEAD_CHIN)
const EYES = 206;              // and the eye line interact.js tells a pat from a cheek poke by
const FRONT = 0.07;            // head points sit this far in front of the head bone (m)
const FIT = 820 / 585;         // viewBox height over the default 2D chin height above the ground
const FOCUS = 0.5 - 30 / 820;  // camera centre as a share of its height: the ground (y 790) is y 0
const REST = { frame: { bones: { root: { a: 0 } }, root: { x: 0, y: 0 } }, view: { yaw: 0, pitch: 0 } };

/** The saved Soft motion > Bounce; the body cap in vrm-physics.js holds whatever it says. */
const bounceOf = (cfg) => clamp(cfg?.body?.bounce ?? 1, 0, 1);

/** ?model=<url> when it is same origin (the page CSP refuses others), else the bundled stand-in. */
function modelUrl() {
  const bundled = new URL('../assets/models/bijou.vrm', import.meta.url).href;
  const wanted = new URLSearchParams(location.search).get('model');
  if (!wanted) return bundled;
  try {
    const url = new URL(wanted, location.href);
    if (url.origin === location.origin) return url.href;
  } catch { /* not a URL: use the bundled model */ }
  console.warn('Bijou: ?model must be a same-origin URL; loading the bundled model.');
  return bundled;
}

/** avatar.js's soft contact shadow, so she belongs to the illustrated room. */
function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(90,54,48,.20)');
  g.addColorStop(1, 'rgba(90,54,48,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new T.Mesh(new T.PlaneGeometry(0.67, 0.075), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
  mesh.position.set(0, 0.001, -0.34);
  return mesh;
}

export function createVrmAvatar(svg) {
  const fallback = createDoll(svg), stage = svg.parentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const ac = new AbortController();
  let renderer = null, canvas = null, vrm = null, info = null, motion = null, body = null, springs = null, ribbons = null;
  let lean = null, squash = null, head = null, neck = null, hips = null, em = null;
  let cfg = null, lastFrame = null, lastView = null, lastMats = null, lastM = null, P = null, lastHit = null;
  let active = false, disposed = false, reduced = false, shaping = false, onShapeFrame = null;
  let expression = 'smile', poseId = null, hostDoc = null, lastTime = 0, quality = qualityFor('balanced');
  let H = 2.18, UNIT = 820 / H, s = 0.00215;
  const size = { w: 0, h: 0, dpr: 0 };
  const restHead = new T.Vector3(), toHead = new T.Matrix4();
  const v = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), push = new T.Vector3(), ndc = new T.Vector2();
  const raycaster = new T.Raycaster(), meshes = [];

  // The Lab's lights; MToon without tone mapping and no shadow maps.
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-0.5, 0.5, H / 2, -H / 2, 0.1, 20);
  const key = new T.DirectionalLight('#ffffff', 2.1);
  key.position.set(1.6, 3.2, 2.6);
  const rim = new T.DirectionalLight('#ffd3ea', 0.9);
  rim.position.set(-2, 2.4, -2.5);
  const shadow = contactShadow();
  scene.add(new T.HemisphereLight('#fff6f2', '#c3aed6', 1.4), key, rim, shadow);
  const status = document.createElement('span');
  status.className = 'avatar-status';
  status.textContent = 'Bringing Bijou to life…';
  status.setAttribute('role', 'status');
  stage.append(status);
  stage.setAttribute('aria-busy', 'true');
  svg.classList.add('avatar-loading');

  function showFallback(message) {
    active = false;
    stage.dataset.renderer = 'svg';
    svg.classList.remove('avatar-loading', 'avatar-ready');
    if (canvas) canvas.hidden = true;
    stage.removeAttribute('aria-busy');
    status.textContent = message;
    status.hidden = false;
  }

  const ready = (async () => {
    try {
      canvas = document.createElement('canvas');
      canvas.className = 'doll avatar-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.hidden = true;
      svg.after(canvas);
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      const loaded = await loadVRM(modelUrl());
      if (disposed) { disposeVRM(loaded.vrm); return false; }
      ({ vrm, info } = loaded);
      rig();
      calibrate();
      applyReduced(media.matches, true);
      // The Lab's settle: her hair already hangs when she appears.
      for (let i = 0; i < 120; i++) step(lastFrame || REST.frame, lastView || REST.view, 1 / 60, 1 / 60);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFallback('3D paused. Bijou is still here in 2D.'); }, { signal: ac.signal });
      canvas.addEventListener('webglcontextrestored', () => { activate(); springs.reset(); }, { signal: ac.signal });
      activate();
      enterPose(poseId);
      applyMood(expression);
      if (lastFrame) render(lastFrame, lastView);
      return true;
    } catch (error) {
      if (disposed) return false;
      console.warn('Bijou: the 3D renderer could not start.', error);
      showFallback('3D is unavailable in this browser. Showing Bijou in 2D.');
      release();
      return false;
    }
  })();

  /** The Lab's rig, in its order: motion, body, springs, then ribbons at rest. */
  function rig() {
    motion = createMotion(vrm, { reduced: media.matches, sleepAfter: 0 });
    body = createBody(vrm);
    springs = createSprings(vrm, { root: body.root });
    scene.add(body.root);
    squash = vrm.scene.parent;
    lean = squash.parent;
    ribbons = attachRibbons(vrm);
    springs.refresh();
    em = vrm.expressionManager || null;
    if (cfg) springs.set({ bounce: bounceOf(cfg) });
  }

  /**
   * Fit the camera to the model, never the model to the camera (scaling would
   * change its springs), and map canonical head space onto the head: the chin
   * at the head bone, the eye line at the eyes.
   */
  function calibrate() {
    head = vrm.humanoid.getRawBoneNode('head');
    neck = vrm.humanoid.getRawBoneNode('neck') || head;
    hips = vrm.humanoid.getRawBoneNode('hips');
    H = clamp(info.headHeight * FIT, 1.6, 3.2) || 2.18;
    UNIT = 820 / H;
    camera.top = H / 2;
    camera.bottom = -H / 2;
    camera.position.set(0, FOCUS * H, 5);
    camera.lookAt(0, FOCUS * H, 0);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    head.getWorldPosition(restHead);
    toHead.copy(head.matrixWorld).invert();
    const eyes = ['leftEye', 'rightEye'].map((n) => vrm.humanoid.getRawBoneNode(n)).filter(Boolean);
    const eyeY = eyes.reduce((n, e) => n + e.getWorldPosition(v).y, 0) / eyes.length;
    s = eyes.length ? clamp((eyeY - restHead.y) / (CHIN - EYES), 0.0016, 0.003) : 0.00215;
  }

  function activate() {
    active = true;
    canvas.hidden = false;
    svg.classList.remove('avatar-loading');
    svg.classList.add('avatar-ready');
    stage.dataset.renderer = '3d';
    stage.removeAttribute('aria-busy');
    status.hidden = true;
    hostDoc = svg.ownerDocument;
    lastTime = 0;
    applySize(true);
  }

  function build(next) {
    cfg = structuredClone(next);
    if (cfg.quality && cfg.quality !== quality.id) setQuality(cfg.quality);
    springs?.set({ bounce: bounceOf(cfg) });
    return fallback.build(next);
  }
  function updateBody(next) {
    cfg.body = { ...next };
    fallback.build(cfg);
    springs?.set({ bounce: bounceOf(cfg) });
  }

  // ── The frame ──────────────────────────────────────────────
  function render(frame, view) {
    lastFrame = frame; lastView = view;
    if (!active || !cfg) {
      const mats = fallback.render(frame, view);
      if (shaping) onShapeFrame?.();
      return mats;
    }
    // Popped out or back: the springs rest, time restarts, size and pixel ratio come from the new window.
    if (svg.ownerDocument !== hostDoc) { hostDoc = svg.ownerDocument; lastTime = 0; springs.reset(); applySize(true); }
    else applySize(false);
    const now = performance.now(), raw = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    applyReduced(media.matches);
    // Motion takes motion.js's clamp; springs take the real gap, so a hidden tab or a throttled
    // pop-out frame (over 0.25 s) makes them rest instead of explode.
    step(frame, view, Math.min(0.05, raw), raw > 0.25 ? raw : Math.min(raw, 0.1));
    renderer.render(scene, camera);
    if (fallback.M !== lastM) { lastM = fallback.M; P = pivots(lastM); }
    // motion.js runs its drag physics only when render returns the solved 2D frame.
    return (lastMats = solve(lastM, P, frame));
  }

  /** One VRM step: the rig from the 2D frame, gaze, motion layers, then springs. */
  function step(frame, view, dt, springDt) {
    body.update(dt);
    place(frame);
    aim(view);
    if (svg.dataset.talk === '1' && expression !== 'sleep') motion.talk(0.15);
    motion.update(dt);
    if (expression === 'sleepy' && em) em.setValue('blink', Math.max(em.getValue('blink') || 0, 0.55));
    stepVRM(vrm, springDt, springs);
  }

  /** Root, twirl, lean and landing squash from the 2D frame (viewBox units over UNIT). */
  function place(frame) {
    const r = frame.root || {}, root = body.root, lift = Math.max(0, -(r.y || 0));
    // Only lifts: pose drops (sit, curtsy) never sink her into the floor.
    root.position.set((r.x || 0) / UNIT, lift / UNIT, 0);
    root.rotation.set(0, r.turnY || 0, 0);
    // body.update reassigns lean and squash every call, so these never accumulate.
    lean.rotation.z -= (frame.bones?.root?.a || 0) * DEG;
    const sy = r.sy ?? 1;
    if (sy !== 1) { const w = 1 / Math.sqrt(sy); squash.scale.x *= w; squash.scale.y *= sy; squash.scale.z *= w; }
    shadow.position.x = root.position.x;
    shadow.scale.setScalar(Math.max(0.5, 1 - lift / 500));
  }

  /** motion.js's head yaw and pitch, inverted onto a plane 0.6 m in front of her face (as the Lab aims). */
  function aim(view) {
    head.getWorldPosition(a);
    motion.state.look.set(a.x + (view.yaw || 0) * 260 / UNIT, a.y - (view.pitch || 0) * 320 / UNIT, a.z + 0.6);
  }

  // ── Faces and poses ────────────────────────────────────────
  function setExpression(name) {
    const changed = name !== expression;
    expression = name;
    fallback.setExpression(name);
    if (motion && (changed || name === 'sleep')) applyMood(name);
  }
  /** A face is held until the next one, so a throttled behaviour timer never lets it lapse. */
  function applyMood(name) {
    const st = motion.state;
    st.sleepAfter = name === 'sleep' ? 1e-3 : 0;
    const mood = name === 'sleep' ? {} : MOODS[name] || MOODS.smile;
    for (const k of Object.keys(st.mood)) if (!(k in mood)) delete st.mood[k];
    // Asleep is the runtime's doze: eyes shut, head droops, relaxed face.
    if (name === 'sleep') st.lastSeen = -Infinity;
    else motion.mood(mood, Infinity);
  }

  function setPoseLook(look) {
    fallback.setPoseLook(look);
    const id = POSE_OF.get(look.hands) || null;
    if (id === poseId) return;
    if (motion) leavePose(poseId);
    poseId = id;
    if (motion) enterPose(id);
  }
  // 'dangle' spans a drag and the fall that follows, until behaviour's landed().
  function enterPose(id) {
    if (id === 'dangle') motion.setHeld(true);
    else if (GESTURE_OF[id]) motion.gesture(GESTURE_OF[id]);
  }
  function leavePose(id) {
    if (id === 'dangle') motion.setHeld(false);
    else if (GESTURE_OF[id]) motion.release(GESTURE_OF[id]);
  }

  // ── Screen bridge ──────────────────────────────────────────
  /** A point on a bone in viewBox units. Head bones take canonical head space. */
  function worldOf(bone, x, y) {
    if (!active) return fallback.worldOf(bone, x, y);
    if (!isHeadBone(bone)) return lastMats ? apply(lastMats[bone], x, y) : { x, y };
    v.set(restHead.x + (x - 200) * s, restHead.y + (CHIN - y) * s, restHead.z + FRONT)
      .applyMatrix4(toHead).applyMatrix4(head.matrixWorld).project(camera);
    return { x: 200 + v.x * (camera.right - camera.left) * UNIT / 2, y: (1 - v.y) * 410 };
  }

  function hitTest(clientX, clientY) {
    if (!active || shaping) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(ndc, camera);
    body.root.updateMatrixWorld(true);
    // r180 SkinnedMesh.raycast caches its bounds: refresh them for the current pose.
    meshes.length = 0;
    vrm.scene.traverseVisible((o) => { if (o.isMesh) { if (o.isSkinnedMesh) o.computeBoundingSphere(); meshes.push(o); } });
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) { lastHit = null; return null; }
    head.getWorldPosition(a);
    neck.getWorldPosition(b);
    // Above the neck and near the head: a raised hand beside her face is not her head.
    const onHead = hit.point.y > b.y && Math.hypot(hit.point.x - a.x, hit.point.z - a.z) < 0.18;
    lastHit = { point: hit.point.clone(), head: onHead, at: performance.now() };
    return onHead ? 'head' : 'spine';
  }

  /** A poke or pat: squash and tilt; a fresh tap on her head also flicks the hair it touched (the Lab's tap). */
  function impulse(strength = 1) {
    if (!active || reduced) return;
    body.poke(strength);
    if (lastHit?.head && performance.now() - lastHit.at < 900) {
      springs.touch({ point: lastHit.point, vel: push.set(0, -1.6, 0), radius: 0.16 });
      lastHit = null;
    }
  }

  function capture({ height = 0, mime = 'image/png' } = {}) {
    if (!active) return null;
    renderer.render(scene, camera);
    const h = canvas.height, ratio = Math.min(0.7, canvas.width / h), w = h * ratio;
    // Centred on her hips rather than the canvas, so a doll carried aside stays in frame.
    hips.getWorldPosition(v).project(camera);
    const cx = clamp((v.x + 1) / 2 * canvas.width, w / 2, canvas.width - w / 2);
    const copy = document.createElement('canvas');
    copy.height = height || h;
    copy.width = Math.round(copy.height * ratio);
    copy.getContext('2d').drawImage(canvas, cx - w / 2, 0, w, h, 0, 0, copy.width, copy.height);
    return copy.toDataURL(mime, 0.85);
  }

  /** Shape mode is 2D only here: in 3D every dot is placed off screen, so the editor hides them. */
  function shapePoints() {
    if (active) return BODY_REGIONS.map((r) => ({ id: r.id, x: -1e5, y: -1e5 }));
    const M = fallback.M, m = svg.getScreenCTM();
    if (!M || !m) return [];
    const ys = { shoulders: M.shoulderY, armpits: M.shoulderY + 25, bust: M.chestY, torso: M.chestY, waist: M.waistY, belly: (M.waistY + M.hipY) / 2, hips: M.hipY, arms: M.elbow.R.y, legs: (M.hipY + M.kneeY) / 2 };
    return BODY_REGIONS.map((r) => ({ id: r.id, x: m.a * (200 + r.x * 300) + m.e, y: m.d * ys[r.id] + m.f }));
  }

  // ── Size, quality, reduced motion ──────────────────────────
  function setQuality(value) {
    quality = qualityFor(value);
    if (cfg) cfg.quality = quality.id;
    if (renderer) applySize(true);
  }
  // Polled every frame: an observer made in the main window may stop firing while the stage is popped out.
  function applySize(force) {
    const w = svg.clientWidth, h = svg.clientHeight, dpr = svg.ownerDocument.defaultView?.devicePixelRatio || 1;
    if (!w || !h || (!force && w === size.w && h === size.h && dpr === size.dpr)) return;
    Object.assign(size, { w, h, dpr });
    renderer.setPixelRatio(Math.min(dpr, quality.pixelRatio) * (quality.id === 'detailed' && dpr === 1 ? 1.5 : 1));
    renderer.setSize(w, h, false);
    camera.left = -H * w / h / 2;
    camera.right = H * w / h / 2;
    camera.updateProjectionMatrix();
  }
  /** Reduced motion stills the springs (they rest once, then stop stepping) and calms the layers. */
  function applyReduced(on, force = false) {
    if (on === reduced && !force) return;
    const was = reduced;
    reduced = on;
    motion.reduced = on;
    body.state.reduced = on;
    springs.set({ reduced: on });
    if (was && !on) springs.reset();
  }

  // ── Teardown ───────────────────────────────────────────────
  function release() {
    ribbons?.dispose();
    if (body) scene.remove(body.root);
    disposeVRM(vrm);
    renderer?.dispose();
    ribbons = vrm = motion = body = springs = null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    ac.abort();
    release();
    shadow.geometry.dispose();
    shadow.material.map.dispose();
    shadow.material.dispose();
    canvas?.remove();
    status.remove();
    svg.classList.remove('avatar-loading', 'avatar-ready');
    stage.dataset.renderer = 'svg';
    stage.removeAttribute('aria-busy');
    if (window.bijouVrm?.doll === api) delete window.bijouVrm;
  }

  const api = {
    svg, uid: fallback.uid, ready, build, updateBody, render, setExpression, setPoseLook, worldOf, hitTest, capture,
    shapePoints, setQuality, impulse, dispose,
    setProp: (kind, x = 0) => fallback.setProp(kind, x),
    setEditing(on) { shaping = !!on; },
    // The stand-in takes no shape edits in 3D: these keep the interface and do nothing.
    set shapeView(value) {}, set inspection(value) {}, set inspectionRegion(value) {}, orbitBy() {}, zoomBy() {},
    set onShapeFrame(fn) { onShapeFrame = fn; },
    get editing() { return !active && shaping; },
    get M() { return fallback.M; }, get flags() { return fallback.flags; }, get expression() { return expression; },
    get is3D() { return active; },
    get diagnostics() {
      return springs ? { springs: springs.count, body: springs.bodyCount, resets: springs.state.resets, reduced, sleep: +motion.state.sleep.toFixed(2), held: motion.state.held, pose: poseId } : null;
    },
    get stats() { return renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory } : null; },
  };

  // ── Debug handle (only exists with ?renderer=vrm) ──────────
  const locals = () => (vrm?.springBoneManager ? [...vrm.springBoneManager.joints].map((j) => j.bone.quaternion.toArray()) : []);
  window.bijouVrm = {
    doll: api, dispose,
    get loaded() { return !!vrm; }, get vrm() { return vrm; }, get info() { return info; }, get motion() { return motion; },
    get body() { return body; }, get springs() { return springs; }, get camera() { return camera; }, get unit() { return UNIT; },
    /** [x, y, z, w] local rotation of every spring joint, manager order (ribbons included). */
    locals,
    /** Largest angle (rad) between `ref` (from locals()) and the joints now. */
    swing(ref) {
      return locals().reduce((m, q, i) => {
        const r = ref[i];
        return r ? Math.max(m, 2 * Math.acos(Math.min(1, Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3])))) : m;
      }, 0);
    },
    /** A raw humanoid bone, raised `up` metres, in client pixels. */
    clientOf(name, up = 0) {
      const node = vrm?.humanoid.getRawBoneNode(name);
      if (!node || !canvas) return null;
      node.getWorldPosition(v);
      v.y += up;
      v.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
  };
  return api;
}
