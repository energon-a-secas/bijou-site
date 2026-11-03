// ── Exact damped springs ─────────────────────────────────────
// A spring-damper solved in closed form instead of integrated, so a channel
// follows one curve whatever the frame rate: a 1/30 s step lands exactly
// where two 1/60 s steps or four 1/120 s steps do. Each spring is set by its
// frequency (Hz) and damping ratio (1 is critical; below 1 it overshoots and
// rings, above 1 it creeps back without overshooting).
//
// The math is ported from Daniel Holden's Spring-It-On
// (https://github.com/orangeduck/Spring-It-On, common.h at 4d97b49:
// spring_damper_exact_stiffness_damping, frequency_to_stiffness and
// damping_ratio_to_damping), with the goal held still. Exact Math.exp,
// Math.cos and Math.sin replace its fast approximations, and the
// under-damped branch is written as its equivalent cosine-plus-sine sum
// rather than amplitude and phase, which needs no epsilon near the goal.
//
// MIT License
//
// Copyright (c) 2021 Daniel Holden
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

/** frequency_to_stiffness: the spring constant (per unit mass) of `hz`. */
export const stiffnessOf = (hz) => (2 * Math.PI * hz) ** 2;

/** damping_ratio_to_damping: the damping constant for `ratio` at `stiffness`. */
export const dampingOf = (ratio, stiffness) => ratio * 2 * Math.sqrt(stiffness);

/** A spring channel at rest at x: { hz, ratio, x, v, goal }. Change any field at any time. */
export function spring({ hz, ratio }, x = 0) {
  return { hz, ratio, x, v: 0, goal: x };
}

/** Move a spring dt seconds toward its goal, exactly. */
export function advance(sp, dt) {
  if (!(dt > 0)) return sp;
  const s = stiffnessOf(sp.hz), d = dampingOf(sp.ratio, s), y = d / 2;
  const c = sp.goal, x = sp.x, v = sp.v, j0 = x - c;
  if (Math.abs(sp.ratio - 1) < 1e-6) {
    // Critically damped.
    const j1 = v + j0 * y, e = Math.exp(-y * dt);
    sp.x = j0 * e + dt * j1 * e + c;
    sp.v = -y * j0 * e - y * dt * j1 * e + j1 * e;
  } else if (sp.ratio < 1) {
    // Under damped: x(t) = c + e^(-yt) (A cos wt + B sin wt).
    const w = Math.sqrt(s - y * y), b = (v + y * j0) / w;
    const e = Math.exp(-y * dt), cs = Math.cos(w * dt), sn = Math.sin(w * dt);
    sp.x = c + e * (j0 * cs + b * sn);
    sp.v = e * ((b * w - y * j0) * cs - (j0 * w + y * b) * sn);
  } else {
    // Over damped.
    const r = Math.sqrt(d * d - 4 * s), y0 = (d + r) / 2, y1 = (d - r) / 2;
    const k1 = (c * y0 - x * y0 - v) / (y1 - y0), k0 = x - k1 - c;
    const e0 = Math.exp(-y0 * dt), e1 = Math.exp(-y1 * dt);
    sp.x = k0 * e0 + k1 * e1 + c;
    sp.v = -y0 * k0 * e0 - y1 * k1 * e1;
  }
  return sp;
}

/** The furthest a spring at rest travels from its goal after a kick of 1 unit per second. */
export function reachOf({ hz, ratio }) {
  const w0 = 2 * Math.PI * hz;
  if (Math.abs(ratio - 1) < 1e-6) return 1 / (w0 * Math.E);
  if (ratio < 1) {
    const wd = w0 * Math.sqrt(1 - ratio * ratio);
    return Math.exp(-ratio * w0 * Math.atan2(wd, ratio * w0) / wd) / w0;
  }
  const r = w0 * Math.sqrt(ratio * ratio - 1), y0 = ratio * w0 + r, y1 = ratio * w0 - r;
  const t = Math.log(y0 / y1) / (y0 - y1);
  return (Math.exp(-y1 * t) - Math.exp(-y0 * t)) / (y0 - y1);
}

/** Kick a spring so that, from rest, it would travel `amount` from its goal (negative for the other way). */
export function kick(sp, amount) {
  sp.v += amount / Math.max(1e-9, reachOf(sp));
  return sp;
}
