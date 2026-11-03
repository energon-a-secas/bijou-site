// ── Eyes: saccade timing, blinks and when an emotion may show ─
// The saccade gap table is ported from Project AIRI,
// packages/stage-ui-three/src/composables/vrm/utils/eye-motions.ts at commit
// ded3dd1 (https://github.com/moeru-ai/airi): gaps in 400 ms steps from
// 800 ms, about 2.9 s on average, in place of a uniform random wait. About one
// hop in five returns to eye contact. Two ideas from pixiv's ChatVRM, with no
// code taken: a newly requested emotion waits for a blink in progress to
// reopen, so a smile never lands on a closing lid, and the eyes yield to a
// playing clip's own gaze by 1 - smoothstep(30, 90 degrees) of how far that
// gaze turns away. Pure: no three.js and no DOM.
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

const SACCADE_STEP = 0.4;
// The chance of each gap bucket; bucket i starts at 0.8 + 0.4 i seconds and
// the last one takes the remaining 28.5 percent.
const SACCADE_ODDS = [0.075, 0.110, 0.125, 0.140, 0.125, 0.050, 0.040, 0.030, 0.020, 1.000];
const SACCADE_CUMULATIVE = SACCADE_ODDS.map((_, i) => SACCADE_ODDS.slice(0, i + 1).reduce((a, b) => a + b, 0));

/** Seconds until the next saccade. */
export function saccadeGap(random = Math.random) {
  const r = random();
  let i = SACCADE_CUMULATIVE.findIndex((c) => r <= c);
  if (i < 0) i = SACCADE_CUMULATIVE.length - 1;
  return 0.8 + i * SACCADE_STEP + random() * SACCADE_STEP;
}

export const smoothstep = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much the eyes keep following the person while a clip looks `deg` degrees away on its own. */
export const userGazeShare = (deg) => 1 - smoothstep(Math.abs(deg), 30, 90);

/**
 * Blinks (0.06 s to close, 0.04 s shut, 0.1 s to open; the next one 2.2 to
 * 6 s later, or 0.25 s later for an occasional double blink) and saccade
 * hops. update() returns { blink, hop }: hop is null between saccades, else
 * the new eye offset { x, y } in radians of the gaze direction ({ 0, 0 } is
 * eye contact).
 */
export function createEyes({ random = Math.random } = {}) {
  const st = { t: 0, blinkAt: 2 + random() * 2, blinkT: -1, saccAt: 1, queue: [] };

  function blinkValue(dt, on) {
    if (on && st.t >= st.blinkAt && st.blinkT < 0) st.blinkT = 0;
    if (st.blinkT < 0) return 0;
    st.blinkT += dt;
    const b = st.blinkT;
    if (b >= 0.2) {
      st.blinkT = -1;
      st.blinkAt = st.t + (random() < 0.18 ? 0.25 : 2.2 + random() * 3.8);
      return 0;
    }
    return b < 0.06 ? b / 0.06 : b < 0.1 ? 1 : 1 - (b - 0.1) / 0.1;
  }

  return {
    update(dt, { blink = true, saccades = true, reduced = false } = {}) {
      st.t += dt;
      const value = blinkValue(dt, blink);
      // Emotions requested during a blink show as the lids reopen.
      if (st.blinkT < 0 && st.queue.length) {
        const ready = st.queue;
        st.queue = [];
        for (const fn of ready) fn();
      }
      let hop = null;
      if (st.t >= st.saccAt) {
        const contact = !saccades || random() < 0.2;
        const amp = reduced ? 0.02 : 0.05;
        hop = contact ? { x: 0, y: 0 } : { x: (random() * 2 - 1) * amp, y: (random() * 2 - 1) * amp * 0.6 };
        st.saccAt = st.t + saccadeGap(random);
      }
      return { blink: value, hop };
    },
    /** Run fn now if the eyes are open, else once the blink in progress reopens. */
    whenOpen(fn) {
      if (st.blinkT < 0) fn();
      else st.queue.push(fn);
    },
    get blinking() { return st.blinkT >= 0; },
    get state() { return st; },
  };
}
