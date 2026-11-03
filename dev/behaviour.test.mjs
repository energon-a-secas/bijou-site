// Unit tests for the companion's behaviour logic: the tap and pat recogniser
// and press classifier on synthetic pointer traces, the touch reaction, the
// idle scheduler, saccade timing and the emotion gate, breathing that never
// repeats, and VRMA clip layers that hold a pose.
//   node --test dev/behaviour.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchTracker, createTouchReaction, createPressGestures, TOUCH_LIMITS } from '../js/vrm-touch.js';
import { createIdleScheduler, BEHAVIOURS, IDLES, DOZES, REACTIONS, breath, drift } from '../js/vrm-idle.js';
import { createEyes, saccadeGap, userGazeShare } from '../js/vrm-eyes.js';

// A small seeded generator, so every run sees the same "random" numbers.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Synthetic pointer traces ─────────────────────────────────
// The head is a 60 px circle around (300, 200); everything else is the body.
const HEAD = { x: 300, y: 200, r: 60 };
const hitAt = (x, y, region) => {
  const d = Math.hypot(x - HEAD.x, y - HEAD.y);
  return { region: region || (d < HEAD.r ? 'head' : 'body'), side: Math.max(-1, Math.min(1, (x - HEAD.x) / HEAD.r)) };
};
/** Points along straight legs between waypoints, `step` px apart. */
function path(waypoints, step = 4) {
  const out = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const [ax, ay] = waypoints[i - 1], [bx, by] = waypoints[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}
const circle = (cx, cy, r, turns, step = 4) => {
  const n = Math.round((2 * Math.PI * r * turns) / step);
  return Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * turns * 2 * Math.PI), cy + r * Math.sin((i / n) * turns * 2 * Math.PI)]);
};
/**
 * Run one press through the classifier: press at the first point (in the
 * given region), optionally hold still for holdMs with a little jitter, move
 * through the points every dtMs, release at the last. Returns every event.
 */
function press(points, { dtMs = 16, holdMs = 0, region, jitter = 0, random = rng(1), gestures = createPressGestures() } = {}) {
  const events = [];
  let ms = 1000;
  const [x0, y0] = points[0];
  const push = (e) => { if (e) events.push(e); };
  push(gestures.down({ x: x0, y: y0, ms, hit: hitAt(x0, y0, region) }));
  for (let held = 0; held < holdMs; held += dtMs) {
    ms += dtMs;
    const x = x0 + (random() * 2 - 1) * jitter, y = y0 + (random() * 2 - 1) * jitter;
    push(gestures.move({ x, y, ms, hit: hitAt(x, y) }));
  }
  for (const [x, y] of points.slice(1)) {
    ms += dtMs;
    const jx = x + (random() * 2 - 1) * jitter, jy = y + (random() * 2 - 1) * jitter;
    push(gestures.move({ x: jx, y: jy, ms, hit: hitAt(jx, jy) }));
  }
  const [xn, yn] = points[points.length - 1];
  push(gestures.up({ x: xn, y: yn, ms: ms + dtMs, hit: hitAt(xn, yn) }));
  return events;
}
const count = (events, type) => events.filter((e) => e.type === type).length;
const { x: hx, y: hy } = HEAD;

const STROKES = {
  'side to side': path([[hx - 30, hy], [hx + 30, hy], [hx - 30, hy], [hx + 30, hy]]),
  'up and down': path([[hx, hy - 30], [hx, hy + 30], [hx, hy - 30], [hx, hy + 30]]),
  'diagonal rub': path([[hx - 25, hy - 25], [hx + 25, hy + 25], [hx - 25, hy - 25], [hx + 25, hy + 25]]),
  'circles': circle(hx, hy, 28, 1.6),
  'jittery rub': path([[hx - 35, hy - 5], [hx + 35, hy + 5], [hx - 35, hy], [hx + 35, hy - 5]], 3),
  'quick rub': path([[hx - 35, hy], [hx + 35, hy], [hx - 35, hy], [hx + 35, hy]], 9),
  'slow rub': path([[hx - 30, hy + 10], [hx + 30, hy + 10], [hx - 30, hy + 10]], 2),
  'short rub': path([[hx - 22, hy], [hx + 23, hy], [hx - 22, hy]]),
  'figure eight': [...circle(hx - 18, hy, 18, 1), ...circle(hx + 18, hy, 18, 1).reverse()],
  'off and back on': path([[hx - 40, hy], [hx + 40, hy], [hx + 90, hy], [hx + 40, hy], [hx - 40, hy]]),
};

test('ten head strokes read as pats, never as a pickup or a tap', () => {
  for (const [name, points] of Object.entries(STROKES)) {
    const events = press(points, { jitter: name === 'jittery rub' ? 1.5 : 0 });
    assert.ok(count(events, 'pat') >= 1, `${name}: at least one pat (${JSON.stringify(events)})`);
    assert.equal(count(events, 'pickup'), 0, `${name}: no pickup`);
    assert.equal(count(events, 'tap'), 0, `${name}: no tap`);
    for (const e of events.filter((x) => x.type === 'pat')) assert.ok(e.region === 'head' && e.side >= -1 && e.side <= 1, `${name}: pat on the head`);
  }
});

test('ten press-and-hold drags pick her up and never pat', () => {
  const random = rng(7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const start = [hx + Math.cos(a) * 15, hy + Math.sin(a) * 15];
    const drag = path([start, [start[0] + Math.cos(a) * 160, start[1] + Math.sin(a) * 160]], 6);
    // Held still (within the tap travel) for 0.4 to 0.9 s, then dragged away.
    const events = press(drag, { holdMs: 400 + i * 55, jitter: 2, random, region: 'head' });
    assert.equal(count(events, 'pickup'), 1, `hold-and-drag ${i}: one pickup`);
    assert.equal(count(events, 'pat'), 0, `hold-and-drag ${i}: no pat`);
    assert.equal(events[events.length - 1].type, 'drop', `hold-and-drag ${i}: let go`);
  }
});

test('any press below the neck that moves picks her up, even a rub', () => {
  for (const points of [path([[300, 420], [300, 520]]), path([[260, 400], [340, 400], [260, 400]])]) {
    const events = press(points, { region: 'body' });
    assert.equal(count(events, 'pickup'), 1);
    assert.equal(count(events, 'pat'), 0);
  }
});

test('quick taps are taps of the region pressed; long or travelling presses are not', () => {
  for (let i = 0; i < 10; i++) {
    const region = i % 2 ? 'body' : 'head';
    const at = region === 'head' ? [hx + (i - 5) * 4, hy] : [300, 450];
    // A press, at most a pixel or two of wobble, and a release within 60 to 420 ms.
    const events = press([at, [at[0] + (i % 3) - 1, at[1] + 1]], { dtMs: 30 + i * 20, region });
    assert.deepEqual(events.map((e) => e.type), ['tap'], `tap ${i}`);
    assert.equal(events[0].region, region);
  }
  assert.equal(press([[hx, hy], [hx, hy]], { holdMs: 600, region: 'head' }).length, 0, 'a long press is not a tap');
  const nudge = press(path([[hx, hy], [hx + 12, hy]]), { region: 'head' });
  assert.equal(count(nudge, 'tap'), 0, 'a press that travels 12 px is not a tap');
});

test('a straight stroke never turns back, so it never pats', () => {
  const events = press(path([[hx - 50, hy - 10], [hx + 50, hy + 10]]), { region: 'head' });
  assert.equal(count(events, 'pat'), 0);
  assert.equal(count(events, 'pickup'), 0);
});

test('every further 70 px over the head is one more pat', () => {
  const tracker = createTouchTracker();
  let ms = 0, pats = 0;
  const legs = path([[hx - 40, hy], [hx + 40, hy], [hx - 40, hy], [hx + 40, hy], [hx - 40, hy], [hx + 40, hy]], 2);
  tracker.down({ x: legs[0][0], y: legs[0][1], ms, hit: hitAt(...legs[0]) });
  for (const [x, y] of legs.slice(1)) if (tracker.move({ x, y, ms: (ms += 16), hit: hitAt(x, y) })) pats++;
  // 400 px of travel; the first pat waits for the turn at 80 px.
  assert.ok(Math.abs(pats - Math.floor(400 / TOUCH_LIMITS.patTravel)) <= 1, `pats ${pats}`);
});

test('the touch reaction rises in 0.15 s, fades over 0.7 s, and stays bounded', () => {
  const r = createTouchReaction();
  r.trigger({ region: 'head', gesture: 'pat', side: 1 }, 0);
  const peak = r.sample(0.15);
  const DEG = Math.PI / 180;
  assert.ok(Math.abs(peak.pitch - 5 * DEG) < 1e-9 && Math.abs(peak.roll + 9 * DEG) < 1e-9 && Math.abs(peak.squint - 0.65) < 1e-9);
  assert.ok(r.sample(0.05).squint < peak.squint, 'still rising');
  assert.ok(Math.abs(r.sample(0.85).squint - 0.65 * Math.exp(-1)) < 1e-9, 'one time constant later');
  for (let i = 0; i < 40; i++) r.trigger({ region: 'head', gesture: 'pat', side: -1 }, 1 + i * 0.01);
  assert.equal(r.count, 8, 'at most 8 impulses overlap');
  const many = r.sample(1.5);
  assert.ok(many.roll <= 14 * DEG + 1e-9 && many.squint <= 0.8 + 1e-9);
  assert.equal(r.sample(20).squint, 0, 'fades away');
});

// ── Idle scheduler ───────────────────────────────────────────

test('picks follow the weights and never repeat back to back', () => {
  const pool = [{ name: 'a', weight: 3 }, { name: 'b', weight: 1 }, { name: 'c', weight: 1 }];
  const sched = createIdleScheduler(pool, { random: rng(11), first: 0 });
  sched.update(0.01);
  const seq = [sched.current.name];
  for (let i = 0; i < 20000; i++) seq.push(sched.next());
  const pairs = {};
  for (let i = 1; i < seq.length; i++) {
    assert.notEqual(seq[i], seq[i - 1], 'no immediate repeat');
    pairs[seq[i - 1]] ??= {};
    pairs[seq[i - 1]][seq[i]] = (pairs[seq[i - 1]][seq[i]] || 0) + 1;
  }
  const share = (from, to) => pairs[from][to] / Object.values(pairs[from]).reduce((s, n) => s + n, 0);
  // After b, the choice is a (3) or c (1); after a, b (1) or c (1).
  assert.ok(Math.abs(share('b', 'a') - 0.75) < 0.02, `a after b ${share('b', 'a')}`);
  assert.ok(Math.abs(share('c', 'a') - 0.75) < 0.02, `a after c ${share('c', 'a')}`);
  assert.ok(Math.abs(share('a', 'b') - 0.5) < 0.02, `b after a ${share('a', 'b')}`);
});

test('a new idle about every 12 s, cross-faded over about 3 s, never an event behaviour', () => {
  const sched = createIdleScheduler(BEHAVIOURS, { random: rng(5) });
  const dt = 1 / 30;
  let maxEntries = 0;
  const fades = [];
  for (let t = 0; t < 600; t += dt) {
    const views = sched.update(dt);
    maxEntries = Math.max(maxEntries, views.length);
    if (views.length === 2) fades.push(t);
  }
  const picks = sched.picks;
  const gaps = picks.slice(1).map((p, i) => p.t - picks[i].t);
  assert.ok(picks.length >= 40 && picks.length <= 70, `${picks.length} picks in 10 minutes`);
  assert.ok(gaps.every((g) => g >= 9 - 1e-6 && g <= 15 + 1e-6), `gaps ${Math.min(...gaps)}..${Math.max(...gaps)}`);
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  assert.ok(Math.abs(mean - 12) < 0.8, `mean gap ${mean}`);
  assert.ok(picks.every((p) => !p.on && !p.asleep), 'the clock picks only idles');
  assert.ok(picks.every((p, i) => i === 0 || p.name !== picks[i - 1].name), 'no repeats');
  assert.ok(new Set(picks.map((p) => p.name)).size >= 8, 'a varied pool');
  assert.ok(maxEntries <= 3, 'at most a couple of behaviours overlap');
  assert.ok(fades.length > 0, 'behaviours cross-fade');
});

test('the blend takes about 3 s and the outgoing idle hands over smoothly', () => {
  const pool = [{ name: 'a' }, { name: 'b' }];
  const sched = createIdleScheduler(pool, { random: rng(2), first: 0 });
  for (let t = 0; t < 5; t += 0.05) sched.update(0.05);
  sched.next();
  const trace = [];
  for (let t = 0; t < 4; t += 0.05) trace.push(sched.update(0.05));
  const weight = (views, name) => views.find((v) => v.b.name === name)?.w ?? 0;
  const incoming = sched.current.name, outgoing = incoming === 'a' ? 'b' : 'a';
  const full = trace.findIndex((v) => weight(v, incoming) >= 0.999) * 0.05;
  assert.ok(full >= 2.7 && full <= 3.2, `incoming reaches full weight after ${full} s`);
  assert.ok(weight(trace[30], outgoing) > 0.05 && weight(trace[30], incoming) > 0.05, 'both visible mid-blend');
  for (const v of trace) assert.ok(weight(v, incoming) + weight(v, outgoing) > 0.99 || weight(v, incoming) >= 0.999);
});

test('event-only behaviours fire on hooks, end on hooks, and hand back to the clock', () => {
  const sched = createIdleScheduler(BEHAVIOURS, { random: rng(9) });
  for (let t = 0; t < 3; t += 0.05) sched.update(0.05);
  const drag = sched.fire('drag');
  assert.ok(REACTIONS.some((b) => b.name === drag && b.on === 'drag'));
  assert.equal(sched.fire('drag'), drag, 'firing again while held does not restart it');
  for (let t = 0; t < 30; t += 0.05) sched.update(0.05);
  assert.deepEqual(sched.current, { name: drag, phase: 'loop' }, 'the drag lasts while she is held');
  assert.equal(sched.end('drag'), true);
  assert.equal(sched.current.phase, 'end');
  for (let t = 0; t < 3; t += 0.05) sched.update(0.05);
  assert.ok(IDLES.some((b) => b.name === sched.current?.name), 'idling again once let go');
  // A fall that nobody ends times out after 10 s.
  const fall = sched.fire('fall');
  for (let t = 0; t < 9; t += 0.05) sched.update(0.05);
  assert.equal(sched.current.name, fall);
  for (let t = 0; t < 3; t += 0.05) sched.update(0.05);
  assert.ok(IDLES.some((b) => b.name === sched.current?.name), 'the fall timed out');
  // A landing plays once, then the clock takes over again.
  const land = sched.fire('land');
  assert.ok(['tada', 'phew'].includes(land));
  for (let t = 0; t < 0.5; t += 0.05) sched.update(0.05);
  assert.deepEqual(sched.current, { name: land, phase: 'loop' });
  for (let t = 0; t < 3; t += 0.05) sched.update(0.05);
  assert.ok(IDLES.some((b) => b.name === sched.current?.name), 'back to idling after landing');
  assert.equal(sched.fire('nonsense'), null);
  assert.ok(sched.picks.filter((p) => p.on).every((p) => REACTIONS.some((b) => b.name === p.name && b.on === p.on)));
});

test('dozing switches to the sleepy pool, waking back to the idles', () => {
  const sched = createIdleScheduler(BEHAVIOURS, { random: rng(4) });
  for (let t = 0; t < 20; t += 0.1) sched.update(0.1);
  const before = sched.picks.length;
  for (let t = 0; t < 200; t += 0.1) sched.update(0.1, { asleep: true });
  const asleep = sched.picks.slice(before);
  assert.ok(asleep.length >= 5 && asleep.every((p) => DOZES.some((b) => b.name === p.name)), JSON.stringify(asleep.map((p) => p.name)));
  const gaps = asleep.slice(1).map((p, i) => p.t - asleep[i].t);
  assert.ok(Math.min(...gaps) >= 17.9, 'dozing poses change more slowly');
  sched.update(0.1, { asleep: false });
  assert.ok(IDLES.some((b) => b.name === sched.current.name), 'waking picks an idle at once');
});

test('clip behaviours wait for their clips; disabled schedulers stay quiet', () => {
  let ready = false;
  const sched = createIdleScheduler([{ name: 'still' }, { name: 'clipIdle', weight: 100, start: { clip: 's', dur: 1 }, clip: 'loop' }], {
    random: rng(6), first: 0, available: (b) => b.name !== 'clipIdle' || ready,
  });
  for (let i = 0; i < 50; i++) { sched.update(0.1); sched.next(); }
  assert.ok(sched.picks.every((p) => p.name === 'still'));
  ready = true;
  sched.next();
  assert.equal(sched.current.name, 'clipIdle');
  const b = sched.behaviours.find((x) => x.name === 'clipIdle');
  assert.deepEqual([b.start.clip, b.loop.clip, b.loop.dur], ['s', 'loop', null]);
  const quiet = createIdleScheduler(BEHAVIOURS, { random: rng(1) });
  for (let t = 0; t < 60; t += 0.1) quiet.update(0.1, { enabled: false });
  assert.equal(quiet.picks.length, 0);
});

// ── Eyes and breathing ───────────────────────────────────────

test('saccade gaps follow AIRI\'s table and about one hop in five returns to eye contact', () => {
  const random = rng(8);
  const gaps = Array.from({ length: 50000 }, () => saccadeGap(random));
  assert.ok(gaps.every((g) => g >= 0.8 && g < 4.8));
  const share = (a, b) => gaps.filter((g) => g >= a && g < b).length / gaps.length;
  assert.ok(Math.abs(share(0.8, 1.2) - 0.075) < 0.006);
  assert.ok(Math.abs(share(2.0, 2.4) - 0.14) < 0.008);
  assert.ok(Math.abs(share(4.4, 4.8) - 0.285) < 0.01);
  const eyes = createEyes({ random: rng(12) });
  let hops = 0, contact = 0;
  for (let t = 0; t < 4000; t += 0.05) {
    const { hop } = eyes.update(0.05);
    if (hop) { hops++; if (!hop.x && !hop.y) contact++; }
  }
  assert.ok(hops > 1200 && Math.abs(contact / hops - 0.2) < 0.03, `${contact} of ${hops} hops`);
});

test('a new emotion waits for a blink in progress to reopen', () => {
  const eyes = createEyes({ random: rng(13) });
  let t = 0;
  while (!eyes.blinking) { eyes.update(0.01); t += 0.01; }
  let shown = -1;
  eyes.whenOpen(() => { shown = t; });
  assert.equal(shown, -1, 'not while the lids are closing');
  while (eyes.blinking) { eyes.update(0.01); t += 0.01; }
  eyes.update(0.01);
  assert.ok(shown > 0, 'shown as the blink reopens');
  let now = false;
  eyes.whenOpen(() => { now = true; });
  assert.ok(now, 'with open eyes it shows at once');
});

test('the eyes keep to the person unless a clip looks well away', () => {
  assert.equal(userGazeShare(0), 1);
  assert.equal(userGazeShare(30), 1);
  assert.ok(Math.abs(userGazeShare(60) - 0.5) < 1e-9);
  assert.equal(userGazeShare(90), 0);
  assert.equal(userGazeShare(-120), 0);
});

/**
 * The closest any 6 s window of a signal comes to repeating, 3 to 120 s
 * later, within five minutes: the largest difference over the window,
 * divided by the window's own range (0 is an exact loop).
 */
function closestRepeat(f, hz = 10, dur = 300) {
  const n = dur * hz, x = Array.from({ length: n }, (_, i) => f(i / hz)), win = 6 * hz;
  let best = Infinity;
  for (let s = 0; s + win < n; s += hz) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < win; k++) { lo = Math.min(lo, x[s + k]); hi = Math.max(hi, x[s + k]); }
    for (let lag = 3 * hz; lag <= 120 * hz && s + lag + win <= n; lag++) {
      let worst = 0;
      for (let k = 0; k < win && worst < best * (hi - lo); k++) worst = Math.max(worst, Math.abs(x[s + k] - x[s + lag + k]));
      best = Math.min(best, worst / (hi - lo));
    }
  }
  return best;
}

test('breathing and drift never line up into a repeating cycle', () => {
  // A single sine is an exact loop; two badly chosen ones nearly are.
  assert.ok(closestRepeat((t) => Math.sin(t * 2 * Math.PI / 3.6)) < 1e-3);
  assert.ok(closestRepeat((t) => 0.7 * Math.sin(t * 2 * Math.PI / 11.42) + 0.3 * Math.sin(t * 2 * Math.PI / 6.5345 + 0.8)) < 0.01);
  const channels = { breath, ...Object.fromEntries(['sway', 'turn', 'yaw', 'pitch', 'roll'].map((k) => [k, (t) => drift(t)[k]])) };
  for (const [name, f] of Object.entries(channels)) {
    const c = closestRepeat(f);
    assert.ok(c > 0.04, `${name}: a 6 s window comes within ${(c * 100).toFixed(1)} percent of repeating`);
  }
  for (let t = 0; t < 600; t += 0.37) {
    assert.ok(Math.abs(breath(t)) <= 1);
    for (const v of Object.values(drift(t))) assert.ok(Math.abs(v) <= 1);
  }
});

// ── Clip layers ──────────────────────────────────────────────

test('a clip layer holds a still pose every frame and shares bones by weight', async () => {
  const T = await import('../js/vendor/avatar-engine.js');
  const { createClipLayer, indexClip } = await import('../js/vrm-clips.js');
  const qa = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.5);
  const qb = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.5);
  const still = new T.AnimationClip('still', 2, [
    new T.QuaternionKeyframeTrack('N_head.quaternion', [0, 2], [...qa.toArray(), ...qa.toArray()]),
    new T.QuaternionKeyframeTrack('N_neck.quaternion', [0, 2], [...qa.toArray(), ...qa.toArray()]),
    new T.NumberKeyframeTrack('VRMExpression_happy.weight', [0, 2], [0.8, 0.8]),
    new T.QuaternionKeyframeTrack('lookAtQuaternionProxy.quaternion', [0, 2], [...qa.toArray(), ...qa.toArray()]),
  ]);
  const other = new T.AnimationClip('other', 1, [new T.QuaternionKeyframeTrack('N_head.quaternion', [0, 1], [...qb.toArray(), ...qb.toArray()])]);
  const boneOfNode = new Map([['N_head', 'head'], ['N_neck', 'neck']]);
  const a = indexClip(still, boneOfNode), b = indexClip(other, boneOfNode);
  const layer = createClipLayer();
  const node = { head: new T.Object3D(), neck: new T.Object3D() };
  layer.play(a, { fade: 0.3 });
  const angle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  for (let i = 0; i < 60; i++) {
    node.head.quaternion.identity(); node.neck.quaternion.identity();
    layer.update(1 / 60);
    layer.applyBones(node);
    if (i > 20) assert.ok(Math.abs(angle(node.head.quaternion) - 0.5) < 1e-6, `frame ${i}: the still pose holds`);
  }
  assert.ok(Math.abs(layer.face.get('happy').v - 0.8) < 1e-6);
  assert.ok(Math.abs(layer.gaze.yaw - 0.5 * 180 / Math.PI) < 1e-3 && layer.gaze.w === 1);
  // Cross-fade to a clip that animates only the head: the neck is handed back below.
  layer.play(b, { fade: 1 });
  for (let i = 0; i < 30; i++) layer.update(1 / 60);
  assert.ok(Math.abs(layer.owns('head') - 1) < 1e-6, 'shared bone fully owned mid-fade');
  assert.ok(Math.abs(layer.owns('neck') - 0.5) < 0.02, `neck owned by the outgoing clip only: ${layer.owns('neck')}`);
  for (let i = 0; i < 60; i++) layer.update(1 / 60);
  assert.equal(layer.owns('neck'), 0);
  layer.stop(0.2);
  for (let i = 0; i < 20; i++) layer.update(1 / 60);
  assert.equal(layer.weight, 0);
});
