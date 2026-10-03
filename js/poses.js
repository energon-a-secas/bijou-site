// ── Poses ────────────────────────────────────────────────────
// Data, per docs/RIG.md section 6. Arms are angles or IK targets on landmarks;
// loop(t) adds motion inside a held pose. Angles are outward-positive.

import { solveArm } from './rig.js';

const STAND_ARM = { upper: 9, fore: -5 };
/** The left arm while holding something, unless the pose says otherwise. */
const HOLD_ARM = { upper: 12, fore: -52 };
const STAND_LEG = { thigh: 1.5, shin: -1, foot: 3 };
const SIT_DROP = (M) => M.thigh * 0.62;

function pose(id, label, o) {
  return {
    id, label,
    arms: { L: STAND_ARM, R: STAND_ARM, ...o.arms },
    legs: { L: STAND_LEG, R: STAND_LEG, ...o.legs },
    spine: o.spine || 0, neck: o.neck || 0, head: o.head || 0,
    root: { x: 0, y: 0, rot: 0, ...o.root },
    hands: { L: 'rest', R: 'rest', ...o.hands },
    band: { L: 'mid', R: 'mid', ...o.band },
    skirt: { sx: 1, sy: 1, ...o.skirt },
    look: o.look || null,
    expr: o.expr || 'smile',
    prop: o.prop || null,
    hidden: !!o.hidden,
    loop: o.loop || null,
  };
}

const sway = (k, f) => (t) => k * Math.sin(t * f);

export const POSES = Object.fromEntries([
  pose('stand', 'Stand', {
    legs: { L: { thigh: 3.5, shin: -2, foot: 4 }, R: { thigh: -1.5, shin: 4.5, foot: 9 } },
    root: { rot: 1.4 }, spine: -2.4, head: 2.5,
  }),
  pose('wave', 'Wave', {
    arms: { R: { upper: 148, fore: -28 } }, hands: { R: 'open' }, head: 4, expr: 'happy',
    loop: (t) => ({ foreArmR: 14 * Math.sin(t * 9) }),
  }),
  pose('shy', 'Shy', {
    arms: { L: { to: ['navel', 6, 22], bend: 'out' }, R: { to: ['navel', 6, 22], bend: 'out' } },
    legs: { L: { thigh: -3.5, shin: 7, foot: -4 }, R: { thigh: -3.5, shin: 7, foot: -4 } },
    head: -6, neck: -2, expr: 'blush',
    loop: (t) => ({ head: sway(1.5, 1.3)(t) }),
  }),
  pose('behind', 'Hands behind', {
    arms: { L: { upper: -10, fore: -25 }, R: { upper: -10, fore: -25 } }, band: { L: 'back', R: 'back' },
    legs: { L: { thigh: -2, shin: 3, foot: 2 } }, head: 7, spine: -1,
    loop: (t) => ({ root: sway(1.2, 1.1)(t) }),
  }),
  pose('peace', 'Peace', {
    arms: { L: { upper: 10, fore: -6 }, R: { to: ['cheek', 36, -22], bend: 'in' } },
    band: { R: 'front' }, hands: { R: 'peace' }, head: 6, expr: 'wink',
  }),
  pose('hips', 'Hands on hips', {
    arms: { L: { to: ['waist', 9, 12], bend: 'out' }, R: { to: ['waist', 9, 12], bend: 'out' } },
    hands: { L: 'fist', R: 'fist' }, legs: { L: { thigh: 4.5, shin: -2.5, foot: 6 }, R: { thigh: 4.5, shin: -2.5, foot: 6 } },
    head: -3, expr: 'grin',
  }),
  pose('stretch', 'Stretch', {
    arms: { L: { to: ['crown', 34, -30], bend: 'out' }, R: { to: ['crown', 34, -30], bend: 'out' } },
    hands: { L: 'open', R: 'open' }, legs: { L: { thigh: 0.5, shin: 0, foot: 1 }, R: { thigh: 0.5, shin: 0, foot: 1 } },
    root: { y: -3 }, expr: 'joy',
    loop: (t) => ({ spine: sway(2.2, 1.6)(t) }),
  }),
  pose('heart', 'Heart', {
    arms: { L: { to: ['chest', 2, -16], bend: 'out' }, R: { to: ['chest', 2, -16], bend: 'out' } },
    hands: { L: 'curl', R: 'curl' }, head: 5, expr: 'happy',
  }),
  pose('think', 'Think', {
    arms: { R: { to: ['chin', 16, 16], bend: 'out' } }, band: { R: 'front' }, hands: { R: 'point' },
    head: -5, expr: 'curious', look: [0.5, -0.5],
  }),
  pose('cheer', 'Cheer', {
    arms: { L: { upper: 150, fore: -10 }, R: { upper: 150, fore: -10 } }, hands: { L: 'fist', R: 'fist' },
    expr: 'grin',
    loop: (t) => ({ rootY: -6 * Math.abs(Math.sin(t * 4)), foreArmL: 10 * Math.sin(t * 8), foreArmR: 10 * Math.sin(t * 8 + 1) }),
  }),
  pose('curtsy', 'Curtsy', {
    arms: { L: { to: ['hip', 26, 44], bend: 'out' }, R: { to: ['hip', 26, 44], bend: 'out' } },
    hands: { L: 'grip', R: 'grip' }, legs: { L: { thigh: -6, shin: 10, foot: 0 }, R: { thigh: 3, shin: -1, foot: 4 } },
    root: { y: 10 }, head: -6, neck: -3, skirt: { sx: 1.1 }, expr: 'smile',
  }),
  pose('sit', 'Sit', {
    arms: { L: { to: ['hip', 8, 14], bend: 'out' }, R: { to: ['hip', 8, 14], bend: 'out' } },
    legs: { L: { thigh: 0, thighSY: 0.3, shin: 4, foot: 6 }, R: { thigh: 0, thighSY: 0.3, shin: 4, foot: 6 } },
    root: { y: SIT_DROP }, skirt: { sy: 0.62, sx: 1.04 }, prop: 'pouf',
    loop: (t) => ({ shinL: 9 * Math.sin(t * 2.4), shinR: 9 * Math.sin(t * 2.4 + Math.PI) }),
  }),
  pose('sleep', 'Sleep', {
    arms: { L: { to: ['navel', 4, 34], bend: 'out' }, R: { to: ['navel', 4, 34], bend: 'out' } },
    legs: { L: { thigh: 0, thighSY: 0.3, shin: 3, foot: 6 }, R: { thigh: 0, thighSY: 0.3, shin: 3, foot: 6 } },
    root: { y: SIT_DROP }, skirt: { sy: 0.62, sx: 1.04 }, prop: 'pouf',
    head: 11, neck: 4, spine: 1, expr: 'sleep', hidden: true,
    loop: (t) => ({ head: 1.5 * Math.sin(t * 1.2) }),
  }),
  pose('admire', 'Admire', {
    arms: { L: { upper: 24, fore: 8 }, R: { upper: 24, fore: 8 } }, hands: { L: 'open', R: 'open' },
    head: 4, neck: 4, expr: 'happy', look: [0, 0.9], hidden: true,
  }),
  pose('dangle', 'Dangle', {
    arms: { L: { upper: 62, fore: 24 }, R: { upper: 62, fore: 24 } }, hands: { L: 'open', R: 'open' },
    legs: { L: { thigh: 4, shin: 6, foot: 8 }, R: { thigh: 4, shin: 6, foot: 8 } },
    expr: 'surprised', hidden: true,
  }),
  pose('hop', 'Hop', {
    arms: { L: { upper: 55, fore: 10 }, R: { upper: 55, fore: 10 } }, hands: { L: 'open', R: 'open' },
    legs: { L: { thigh: -2, shin: 4, shinSY: 0.88 }, R: { thigh: -2, shin: 4, shinSY: 0.88 } },
    expr: 'joy', hidden: true,
  }),
  pose('spin', 'Spin', {
    arms: { L: { upper: 72, fore: 12 }, R: { upper: 72, fore: 12 } }, hands: { L: 'open', R: 'open' },
    skirt: { sx: 1.22, sy: 0.96 }, expr: 'joy', hidden: true,
  }),
].map((p) => [p.id, p]));

/** The poses a visitor can pick; the rest belong to the behaviour engine. */
export const PICKABLE = Object.values(POSES).filter((p) => !p.hidden);

/** A pose, solved against M, as a flat target frame for the motion layer. */
export function resolvePose(M, p, { holding = false } = {}) {
  const bones = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const arm = side === 'L' && holding && p.arms.L === STAND_ARM ? HOLD_ARM : p.arms[side];
    const ang = arm.to ? solveArm(M, s, arm) : arm;
    bones[`upperArm${side}`] = { a: ang.upper };
    bones[`foreArm${side}`] = { a: ang.fore };
    bones[`hand${side}`] = { a: arm.hand || 0 };
    const leg = p.legs[side];
    bones[`thigh${side}`] = { a: leg.thigh || 0, sy: leg.thighSY ?? 1 };
    bones[`shin${side}`] = { a: leg.shin || 0, sy: leg.shinSY ?? 1 };
    bones[`foot${side}`] = { a: leg.foot || 0 };
  }
  bones.spine = { a: p.spine };
  bones.neck = { a: p.neck };
  bones.head = { a: p.head };
  bones.skirt = { a: 0, sx: p.skirt.sx, sy: p.skirt.sy };
  const rootY = typeof p.root.y === 'function' ? p.root.y(M) : p.root.y;
  bones.root = { a: p.root.rot || 0 };
  return { bones, rootX: p.root.x || 0, rootY };
}
