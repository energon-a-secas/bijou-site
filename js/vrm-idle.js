// ── Idle scheduler, breathing and the idle repertoire ────────
// What she does when nobody asks anything of her. A weighted pool of
// behaviours, each with optional start, loop and end parts (VPet's shape);
// a new one about every 12 s with jitter, cross-faded over about 3 s, never
// the same one twice in a row (Shimeji's weighted picks, Mate Engine's
// timing; ideas and numbers only). Event-only behaviours (drag, toss, fall,
// land) are never picked by the clock: the caller fires them. While she
// dozes a separate pool of sleepy poses rotates more slowly.
// Behaviours are procedural today (a pose function, or one of vrm-motion's
// gestures) and VRMA clips later: a part may name a clip registered with
// addClip, and vrm-motion.js plays it at idle priority. Pure: no three.js
// and no DOM, so dev/behaviour.test.mjs runs the scheduler in Node.

const TAU = Math.PI * 2;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ── Breathing and drift ──────────────────────────────────────
// Summed sines whose periods are far from small whole-number ratios, so the
// sum never lines up into a cycle you could spot. Breathing uses periods in
// the range Live2D's samples use (3.23 to 15.53 s); the slower body and head
// drift use their own. The shorter periods were searched so that no 6 s
// stretch comes within 6 percent of repeating inside five minutes (two plain
// sines, 11.42 and 6.5345 s, nearly realign every 45.7 s).

const waves = (t, terms) => terms.reduce((s, [a, period, phase]) => s + a * Math.sin(TAU * t / period + phase), 0);

/** Chest rise, -1..1, about 18 breaths a minute with a slowly varying depth. */
export const breath = (t) => waves(t, [[0.66, 3.2345, 0], [0.24, 5.0269, 1.7], [0.1, 10.4807, 0.6]]);

/** Slow body and head drift, each -1..1. */
export function drift(t) {
  return {
    sway: waves(t, [[0.6, 11.42, 0], [0.28, 6.562, 0.8], [0.12, 4.042, 2.1]]),
    turn: waves(t, [[0.6, 20.27, 1], [0.28, 13.919, 2.4], [0.12, 6.53, 0.5]]),
    yaw: waves(t, [[0.6, 27.31, 0], [0.28, 18, 1.9], [0.12, 8.636, 0.7]]),
    pitch: waves(t, [[0.6, 15.33, 2], [0.28, 9.824, 0.3], [0.12, 5.302, 1.4]]),
    roll: waves(t, [[0.6, 16.98, 0], [0.28, 9.03, 1.2], [0.12, 6.18, 2.6]]),
  };
}

// ── The repertoire ───────────────────────────────────────────
// pose(m, x) runs every frame with a pose helper m already scaled by the
// behaviour's blend and part envelope (see vrm-motion.js: arm, leg, head and
// spine as the gestures use them, plus turn(bone, yaw, pitch, roll) and
// shift(metres toward her left)); x is { phase, t, p, age, amount }.
// face holds expressions shown at idle priority; gesture plays one of
// vrm-motion's gestures once at idle priority.

const shift = (s) => (m) => {
  // Contrapposto: weight onto one leg, that hip up, shoulders the other way.
  const free = s > 0 ? 'right' : 'left', stand = s > 0 ? 'left' : 'right';
  m.turn('hips', 0, 0, 0.05 * s);
  m.shift(0.012 * s);
  m.turn(`${stand}UpperLeg`, 0, 0, -0.05 * s);
  m.turn(`${free}UpperLeg`, 0.04 * s, -0.09, -0.05 * s);
  m.turn(`${free}LowerLeg`, 0, 0.2, 0);
  m.turn(`${free}Foot`, 0, -0.1, 0);
  m.turn('spine', 0, 0, -0.04 * s);
  m.turn('chest', 0, 0, -0.02 * s);
  m.turn('neck', 0, 0, 0.025 * s);
};

const both = (m, up, fore) => { m.arm('left', up, fore); m.arm('right', up, fore); };
const spread = (m) => both(m, [0.92, 0.3, 0.12], [0.95, 0.25, 0.1]);
const raised = (m) => both(m, [0.78, 0.58, 0.18], [0.62, 0.76, 0.15]);
// Hands loosely together at the lower belly: nothing presses on the body springs.
const handsTogether = (m) => both(m, [0.06, -0.97, 0.2], [-0.6, -0.68, 0.42]);

export const IDLES = [
  { name: 'still', weight: 2.2 },
  { name: 'shiftLeft', weight: 1.6, start: 1.4, end: 1.2, pose: shift(1) },
  { name: 'shiftRight', weight: 1.6, start: 1.4, end: 1.2, pose: shift(-1) },
  { name: 'sway', weight: 1.1, start: 1.5, end: 1.5, face: { happy: 0.25 }, pose: (m, x) => {
    const a = 0.7 * Math.sin(TAU * x.age / 3.1) + 0.3 * Math.sin(TAU * x.age / 4.37 + 0.9);
    m.turn('hips', 0, 0, 0.03 * a);
    m.turn('spine', 0, 0, -0.022 * a);
    m.turn('neck', 0, 0, 0.03 * a);
  } },
  { name: 'handsFront', weight: 1.3, start: 1.3, end: 1.1, face: { relaxed: 0.2 }, pose: handsTogether },
  { name: 'handsBack', weight: 1, start: 1.3, end: 1.1, face: { happy: 0.2 }, pose: (m) => {
    both(m, [0.12, -0.95, -0.2], [-0.6, -0.7, -0.38]);
    m.spine(-0.03, 0, 0);
  } },
  { name: 'lookAround', weight: 1, start: 0.8, end: 1, pose: (m, x) => {
    // Glance one way, then the other; the gaze overrides this while she watches you.
    const k = Math.sin(TAU * x.age / 9.3);
    m.head(0.38 * k, 0.06, 0.05 * k);
  } },
  { name: 'tilt', weight: 0.8, start: 1, end: 1, face: { happy: 0.35 }, pose: (m) => m.head(0.06, 0.03, 0.2) },
  { name: 'stretch', weight: 0.45, gesture: 'stretch' },
  { name: 'think', weight: 0.5, gesture: 'think' },
];

export const DOZES = [
  { name: 'dozeStill', weight: 1, asleep: true },
  { name: 'dozeLeft', weight: 1, asleep: true, start: 2, end: 2, pose: (m) => m.turn('head', 0.03, 0.04, 0.16) },
  { name: 'dozeRight', weight: 1, asleep: true, start: 2, end: 2, pose: (m) => m.turn('head', -0.03, 0.04, -0.16) },
  { name: 'dozeNod', weight: 0.6, asleep: true, loop: 5, end: 0.8, pose: (m, x) => {
    // Nodding off: the head sinks lower and lower, then jerks back up.
    const sink = x.phase === 'loop' ? ease(clamp01(x.t / 4.2)) - ease(clamp01((x.t - 4.2) / 0.35)) : 0;
    m.turn('neck', 0, 0.16 * sink, 0);
    m.turn('head', 0, 0.1 * sink, 0);
  } },
];

// Reactions with an open loop last until the caller ends them, or `timeout`
// seconds (10 by default) if it never does; a drag lasts as long as she is held.
export const REACTIONS = [
  { name: 'eek', on: 'drag', timeout: 60, start: 0.4, end: 0.6, face: { surprised: 0.55, happy: 0.2 }, pose: (m) => m.turn('head', 0, 0.12, 0) },
  { name: 'wheee', on: 'drag', timeout: 60, start: 0.4, end: 0.6, face: { happy: 0.7 }, pose: (m) => m.turn('head', 0, -0.08, 0.05) },
  { name: 'fly', on: 'toss', start: 0.2, end: 0.4, face: { happy: 0.9 }, pose: (m) => { spread(m); m.leg('left', 0.2, 0.35); m.leg('right', 0.12, 0.3); } },
  { name: 'flail', on: 'fall', start: 0.15, end: 0.4, face: { surprised: 0.85 }, pose: (m, x) => {
    const k = 0.12 * Math.sin(x.age * 14);
    m.arm('left', [0.45, 0.88, 0.1], [0.3 + k, 0.95, 0.05]);
    m.arm('right', [0.45, 0.88, 0.1], [0.3 - k, 0.95, 0.05]);
  } },
  { name: 'tada', on: 'land', start: 0.25, loop: 0.7, end: 0.8, face: { happy: 0.85 }, pose: raised },
  { name: 'phew', on: 'land', start: 0.3, loop: 0.8, end: 0.8, face: { relaxed: 0.5, happy: 0.35 }, pose: handsTogether },
];

export const BEHAVIOURS = [...IDLES, ...DOZES, ...REACTIONS];

// ── Scheduler ────────────────────────────────────────────────

// A part is seconds, a clip name, or { dur, clip }.
const part = (v, dur = 1) => (v == null ? null : typeof v === 'number' ? { dur: v }
  : typeof v === 'string' ? { clip: v, dur } : { ...v, dur: v.dur === undefined ? dur : v.dur });

/** Fill in a behaviour's defaults. A missing loop runs until the next pick; `clip` is shorthand for a looping clip. */
export function normalizeBehaviour(b) {
  if (!b || !b.name) throw new Error('A behaviour needs a name.');
  const loop = part(b.loop ?? b.clip ?? {}, null);
  return { ...b, weight: Math.max(0, b.weight ?? 1), start: part(b.start), loop, end: part(b.end) };
}

/** Every clip a behaviour names. */
export const clipsOf = (b) => [b.start?.clip, b.loop?.clip, b.end?.clip].filter(Boolean);

/**
 * opts: { period: 12, jitter: 3, blend: 3, asleepPeriod: 24, eventBlend: 0.3,
 * eventTimeout: 10, first: seconds before the first pick, random,
 * available(b) }. update() returns the active behaviours as
 * { b, phase, t, p, age, w, amount }: t is the time in the current part and
 * p its progress (0 in an open loop); w is the eased cross-fade weight and
 * amount the part envelope (rises over the start part, falls over the end).
 */
export function createIdleScheduler(list = BEHAVIOURS, opts = {}) {
  const period = opts.period ?? 12, jitter = opts.jitter ?? 3, blend = opts.blend ?? 3;
  const asleepPeriod = opts.asleepPeriod ?? 24, eventBlend = opts.eventBlend ?? 0.3;
  const eventTimeout = opts.eventTimeout ?? 10;
  const random = opts.random || Math.random;
  const available = opts.available || (() => true);
  let pool = list.map(normalizeBehaviour);
  const st = { t: 0, entries: [], current: null, nextAt: opts.first ?? 1, last: {}, picks: [], asleep: false, enabled: true };

  const endDur = (b) => (b.end ? b.end.dur : 0);
  const reacting = () => !!(st.current && st.current.b.on && st.current.phase !== 'end');

  function pickFrom(options, avoid) {
    const fresh = options.length > 1 ? options.filter((b) => b.name !== avoid) : options;
    const total = fresh.reduce((s, b) => s + b.weight, 0);
    let r = random() * total;
    for (const b of fresh) if ((r -= b.weight) < 0) return b;
    return fresh[fresh.length - 1];
  }

  /** Send an entry into its end part and fade it out, starting `delay` seconds from now. */
  function leave(e, fade, delay = 0) {
    if (e.phase !== 'end') { e.phase = 'end'; e.since = Math.max(st.t, e.t0); }
    e.target = 0;
    e.rate = 1 / Math.max(fade, 1e-3);
    e.fadeAt = st.t + delay;
  }

  /** A reaction ending hands back to the clock as its end part finishes. */
  function release(e) {
    leave(e, Math.max(0.6, endDur(e.b)));
    st.nextAt = st.t + Math.max(0, endDur(e.b) - blend * 0.5);
  }

  function begin(b, fade, delay = 0) {
    if (st.current) leave(st.current, fade, delay);
    const at = st.t + delay;
    const e = { b, t0: at, since: at, phase: 'start', w: 0, target: 1, rate: 1 / Math.max(fade, 1e-3), fadeAt: at };
    st.entries.push(e);
    st.current = e;
    st.last[b.on || (b.asleep ? 'asleep' : 'awake')] = b.name;
    st.picks.push({ name: b.name, t: +at.toFixed(3), on: b.on || null, asleep: !!b.asleep });
    if (st.picks.length > 200) st.picks.shift();
    st.nextAt = at + (b.asleep ? asleepPeriod : period) + (random() * 2 - 1) * jitter * (b.asleep ? 2 : 1);
    return e;
  }

  /** Pick the next clock-driven behaviour for the current pool and start it. */
  function next(fade = blend) {
    const key = st.asleep ? 'asleep' : 'awake';
    const options = pool.filter((b) => !b.on && !!b.asleep === st.asleep && b.weight > 0 && available(b));
    if (!options.length) { st.nextAt = st.t + period; return null; }
    const b = pickFrom(options, st.last[key]);
    // A behaviour may ask for a quicker blend (a gesture played once).
    const f = Math.min(fade, b.blend ?? fade);
    // The new one starts as the old one's end part finishes, overlapping it by the blend.
    const cur = st.current;
    const delay = cur && cur.phase !== 'end' ? Math.max(0, endDur(cur.b) - f) : 0;
    return begin(b, f, delay);
  }

  function advance(e, dt) {
    if (st.t < e.t0) return;
    if (e.phase === 'start' && st.t - e.since >= (e.b.start ? e.b.start.dur : 0)) {
      e.since += e.b.start ? e.b.start.dur : 0;
      e.phase = 'loop';
    }
    const loopDur = e.b.loop.dur ?? (e.b.on ? e.b.timeout ?? eventTimeout : null);
    if (e.phase === 'loop' && loopDur != null && st.t - e.since >= loopDur) {
      // A fixed-length behaviour ends by itself and frees the slot early.
      e.since += loopDur;
      if (e === st.current && e.b.on) release(e);
      else leave(e, Math.max(0.6, endDur(e.b)));
    }
    const rising = e.target > e.w;
    if (rising ? st.t >= e.t0 : st.t >= e.fadeAt) {
      e.w = rising ? Math.min(e.target, e.w + e.rate * dt) : Math.max(e.target, e.w - e.rate * dt);
    }
  }

  function view(e) {
    const t = st.t - e.since;
    const dur = e.phase === 'start' ? e.b.start?.dur : e.phase === 'end' ? e.b.end?.dur : e.b.loop.dur;
    const p = dur ? clamp01(t / dur) : 0;
    const amount = e.phase === 'start' && e.b.start ? ease(p) : e.phase === 'end' && e.b.end ? 1 - ease(p) : 1;
    return { b: e.b, phase: e.phase, t, p, age: st.t - e.t0, w: ease(clamp01(e.w)), amount };
  }

  function update(dt, { asleep = false, enabled = true } = {}) {
    st.t += dt;
    if (!enabled) {
      if (st.current) { leave(st.current, 1); st.current = null; }
      st.enabled = false;
    } else if (!st.enabled) {
      st.enabled = true;
      st.nextAt = st.t + 1;
    } else if (asleep !== st.asleep && !reacting()) {
      // Falling asleep eases into a doze pose; waking answers quickly.
      st.asleep = asleep;
      next(asleep ? blend : 1);
    } else if (st.t >= st.nextAt && !reacting()) {
      next();
    }
    for (const e of st.entries) advance(e, dt);
    st.entries = st.entries.filter((e) => !(e.phase === 'end' && e.w <= 0 && st.t >= e.fadeAt));
    if (st.current && !st.entries.includes(st.current)) st.current = null;
    return st.entries.filter((e) => st.t >= e.t0).map(view);
  }

  return {
    update,
    /** Start an event-only behaviour (drag, toss, fall, land); returns its name, or null if none answers. */
    fire(name) {
      const cur = st.current;
      if (cur && cur.b.on === name && cur.phase !== 'end') return cur.b.name;
      const options = pool.filter((b) => b.on === name && b.weight > 0 && available(b));
      if (!options.length) return null;
      return begin(pickFrom(options, st.last[name]), eventBlend).b.name;
    },
    /** End a running event behaviour's open loop (a drag that was let go). */
    end(name) {
      const e = st.current;
      if (!e || e.b.on !== name || e.phase === 'end') return false;
      release(e);
      return true;
    },
    /** Move on to a new clock-driven behaviour now; returns its name. */
    next: () => next()?.b.name ?? null,
    add(b) {
      const n = normalizeBehaviour(b);
      pool = pool.filter((x) => x.name !== n.name).concat(n);
      return n;
    },
    remove(name) { pool = pool.filter((b) => b.name !== name); },
    get current() { return st.current ? { name: st.current.b.name, phase: st.current.phase } : null; },
    get picks() { return st.picks; },
    get behaviours() { return pool; },
    get state() { return st; },
  };
}
