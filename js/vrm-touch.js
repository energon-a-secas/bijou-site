// ── Touch: taps, pats and the reaction to them ───────────────
// The tap and pat recogniser and the reaction impulses are ported from
// Project AIRI, packages/stage-ui-live2d/src/composables/live2d/touch.ts at
// commit ded3dd1 (https://github.com/moeru-ai/airi): its TypeScript is
// rewritten as plain functions and its Live2D parameter output as VRM bone
// angles and an eye squint. The press classifier at the end (strokes, taps
// and pickups for one press) is Bijou's own. Pure: no three.js and no DOM,
// so dev/behaviour.test.mjs runs it in Node.
//
// MIT License
//
// Copyright (c) 2024-PRESENT Neko Ayaka
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const DEG = Math.PI / 180;

/** Limits of the recognition, in CSS pixels and milliseconds (AIRI's defaults). */
export const TOUCH_LIMITS = Object.freeze({
  tapTravel: 8, // largest pointer travel of a tap
  tapMs: 450, // longest press of a tap
  patTravel: 70, // travel over the head for each pat
  // Length of one direction sample. A 1 or 2 px step can point anywhere
  // because of jitter, so directions are only measured over this much travel.
  segment: 8,
  turnBack: -0.5, // cosine against the first direction that counts as turning back (120 degrees)
});

/**
 * Taps and pats from one pointer. Samples are { x, y, ms, hit }, where hit is
 * { region: 'head' | 'body', side } (side -1..1, the touch's place across the
 * head on screen, viewer's left to right) or null off the doll.
 *
 * A tap is a press and release with at most tapTravel of travel within tapMs;
 * it belongs to the region pressed. A pat is a stroke over the head that turns
 * back, and every further patTravel of travel over the head is one more pat.
 * A straight stroke (a drag from the head down to the body) never turns back,
 * so it never pats. The turn is measured against the stroke's first direction,
 * not the previous sample: a circle turns only a few degrees between samples,
 * so against the first direction it turns back after about half a turn, and a
 * back-and-forth rub at its first reverse. A press that patted is not a tap.
 */
export function createTouchTracker(limits = TOUCH_LIMITS) {
  let press = null;

  function down(s) {
    press = s.hit
      ? { start: s, last: s, travel: 0, patTravel: 0, seg: { x: s.x, y: s.y }, first: null, turned: false, patted: false }
      : null;
  }

  /** Close a direction sample once it is long enough and compare it with the first. */
  function direction(p, s) {
    const dx = s.x - p.seg.x, dy = s.y - p.seg.y, len = Math.hypot(dx, dy);
    if (len < limits.segment) return;
    const d = { x: dx / len, y: dy / len };
    p.seg = { x: s.x, y: s.y };
    if (!p.first) { p.first = d; return; }
    if (d.x * p.first.x + d.y * p.first.y <= limits.turnBack) p.turned = true;
  }

  function move(s) {
    if (!press) return null;
    const step = Math.hypot(s.x - press.last.x, s.y - press.last.y);
    press.travel += step;
    press.last = s;
    // Directions count only over the head; leaving it restarts the sample.
    if (s.hit?.region !== 'head') { press.seg = { x: s.x, y: s.y }; return null; }
    press.patTravel += step;
    direction(press, s);
    if (!press.turned || press.patTravel < limits.patTravel) return null;
    press.patTravel = 0;
    press.patted = true;
    return { ...s.hit, gesture: 'pat' };
  }

  function up(s) {
    const p = press;
    press = null;
    if (!p || p.patted || !p.start.hit) return null;
    const travel = p.travel + Math.hypot(s.x - p.last.x, s.y - p.last.y);
    if (travel > limits.tapTravel || s.ms - p.start.ms > limits.tapMs) return null;
    return { ...p.start.hit, gesture: 'tap' };
  }

  return {
    down, move, up,
    cancel() { press = null; },
    /** Pointer travel of the current press, in pixels. */
    get travel() { return press ? press.travel : 0; },
  };
}

// ── Reaction ─────────────────────────────────────────────────
// Each touch adds an impulse with a short rise and an exponential fade.
// Repeated pats overlap, so a long stroke keeps the head tilted and the eyes
// narrowed; the sum is bounded, so many fast taps cannot twist the head.
// AIRI's Live2D angles become VRM bone angles in radians: head yaw (toward
// her left), pitch (down) and roll (lean toward the touch), spine yaw and
// pitch; eyeSquint becomes `squint`, which vrm-motion.js shows as soft,
// smiling eyes.

const ZERO = Object.freeze({ yaw: 0, pitch: 0, roll: 0, spineYaw: 0, spinePitch: 0, squint: 0 });
const LIMIT = { yaw: 10 * DEG, pitch: 10 * DEG, roll: 14 * DEG, spineYaw: 6 * DEG, spinePitch: 6 * DEG };

function impulseFor(touch, t0) {
  const side = clamp(touch.side || 0, -1, 1);
  if (touch.region === 'head' && touch.gesture === 'pat') {
    // Rises in 0.15 s, fades over 0.7 s: the head dips 5 degrees and leans 9 into the hand.
    return { t0, rise: 0.15, fade: 0.7, peak: { ...ZERO, pitch: 5 * DEG, roll: -side * 9 * DEG, squint: 0.65 } };
  }
  if (touch.region === 'head') {
    return { t0, rise: 0.05, fade: 0.35, peak: { ...ZERO, yaw: -side * 4 * DEG, pitch: 7 * DEG, roll: -side * 6 * DEG, squint: 0.45 } };
  }
  // A tap on the body: she looks up and turns her shoulders away from it.
  return { t0, rise: 0.05, fade: 0.3, peak: { ...ZERO, pitch: -6 * DEG, spineYaw: -side * 4 * DEG, spinePitch: -3 * DEG } };
}

function envelope(i, t) {
  const age = t - i.t0;
  if (age < 0) return 0;
  if (age < i.rise) return Math.sin((age / i.rise) * Math.PI / 2);
  return Math.exp(-(age - i.rise) / i.fade);
}

/** The procedural reaction of one doll to touches; at most 8 impulses overlap. */
export function createTouchReaction() {
  let impulses = [];
  return {
    /** touch: { region, gesture: 'pat' | 'tap', side }, t: seconds on the caller's clock. */
    trigger(touch, t) {
      impulses.push(impulseFor(touch, t));
      if (impulses.length > 8) impulses = impulses.slice(-8);
    },
    sample(t) {
      impulses = impulses.filter((i) => t - i.t0 < i.rise + i.fade * 6);
      if (!impulses.length) return ZERO;
      const sum = { ...ZERO };
      for (const i of impulses) {
        const w = envelope(i, t);
        for (const k of Object.keys(sum)) sum[k] += i.peak[k] * w;
      }
      const out = { squint: clamp(sum.squint, 0, 0.8) };
      for (const [k, lim] of Object.entries(LIMIT)) out[k] = clamp(sum[k], -lim, lim);
      return out;
    },
    reset() { impulses = []; },
    get count() { return impulses.length; },
  };
}

// ── Press classifier (Bijou's own) ───────────────────────────
// One press on the doll is a stroke, a tap or a pickup. Any press below the
// neck that moves past tap travel picks her up. On the head, a press that
// moves within holdMs is a stroke: it can pat and never picks her up. A
// press that holds still for holdMs and then moves picks her up by the head.
// "Moves" is distance from the press point, so a hand that trembles while it
// holds still is still holding still.

/**
 * Feed it the same samples as the tracker. down() and move() return null or
 * an event; up() returns the release's event. Events: { type: 'pat', region,
 * side } while stroking, { type: 'pickup', region, side } once, { type: 'tap',
 * region, side } on a quick release, { type: 'drop' } when a carry ends.
 */
export function createPressGestures({ holdMs = 350, limits = TOUCH_LIMITS } = {}) {
  const tracker = createTouchTracker(limits);
  let press = null;
  const event = (type, hit) => ({ type, region: hit.region, side: hit.side || 0 });
  return {
    down(s) {
      tracker.down(s);
      press = s.hit ? { start: s, mode: null } : null;
      return null;
    },
    move(s) {
      if (!press || press.mode === 'carry') return null;
      const pat = tracker.move(s);
      if (!press.mode) {
        if (Math.hypot(s.x - press.start.x, s.y - press.start.y) <= limits.tapTravel) return null;
        // The first real movement decides what this press is.
        if (press.start.hit.region !== 'head' || s.ms - press.start.ms >= holdMs) {
          press.mode = 'carry';
          tracker.cancel();
          return event('pickup', press.start.hit);
        }
        press.mode = 'stroke';
      }
      return pat ? event('pat', pat) : null;
    },
    up(s) {
      const p = press;
      press = null;
      if (!p) return null;
      if (p.mode === 'carry') return { type: 'drop' };
      const tap = tracker.up(s);
      return tap ? event('tap', tap) : null;
    },
    cancel() {
      const carrying = press?.mode === 'carry';
      press = null;
      tracker.cancel();
      return carrying ? { type: 'drop' } : null;
    },
    /** null before the press is decided, then 'stroke' or 'carry'. */
    get mode() { return press ? press.mode : null; },
    get pressed() { return !!press; },
  };
}
