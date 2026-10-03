// ── The rig ──────────────────────────────────────────────────
// Measurements, the bone table, forward kinematics and a two-bone IK.
// This file is the code half of docs/RIG.md: change the contract there first.

export const VIEW = { w: 400, h: 820, cx: 200, ground: 790 };

/** Head art is drawn with the chin here; the head bone shifts it onto the body. */
export const HEAD_CHIN = 244;

/** The head is drawn large and scaled onto the body: about six and a half heads tall. */
export const HEAD_SCALE = 0.9;

const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

/** Piecewise-linear lookup over [[y, value], ...] sorted by y. */
function lerpTable(table, y) {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (y <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + (v1 - v0) * ((y - y0) / (y1 - y0));
    }
  }
  return table[table.length - 1][1];
}

/** body: { height: 0..1, build: 0..1 }. Returns the frozen landmark object M. */
export function measure(body = {}) {
  const leg = 0.94 + 0.12 * clamp01(body.height);
  const tor = 0.97 + 0.06 * clamp01(body.height);
  const w = 0.9 + 0.2 * clamp01(body.build);
  const ground = VIEW.ground;
  const ankleY = ground - 36;
  const shin = 160 * leg;
  const thigh = 168 * leg;
  const kneeY = ankleY - shin;
  const hipY = kneeY - thigh;
  const pelvisY = hipY - 8;
  const waistY = pelvisY - 54 * tor;
  const chestY = waistY - 64 * tor;
  const shoulderY = chestY - 42 * tor;
  const chinY = shoulderY - 24;
  const upperArm = 86 * tor;
  const foreArm = 80 * tor;

  // A young adult's silhouette: shoulders, a soft chest line, waist, hips.
  const torso = [
    [shoulderY - 8, 10], [shoulderY - 2, 24], [shoulderY + 4, 39], [shoulderY + 12, 41],
    [shoulderY + 24, 35 * (0.95 + 0.05 * w)], [chestY - 6, 34 * w], [chestY + 4, 33.5 * w], [chestY + 20, 28.5 * w],
    [waistY, 25 * w], [waistY + 26, 33 * w], [hipY - 4, 38 * w], [hipY + 14, 37 * w],
  ];

  const side = (fn) => ({ L: fn(-1), R: fn(1) });
  const shoulder = side((s) => ({ x: 200 + s * 43, y: shoulderY + 7 }));
  const elbow = side((s) => ({ x: 200 + s * 43, y: shoulderY + 7 + upperArm }));
  const wrist = side((s) => ({ x: 200 + s * 43, y: shoulderY + 7 + upperArm + foreArm }));
  const hip = side((s) => ({ x: 200 + s * 19.5 * w, y: hipY }));
  const knee = side((s) => ({ x: 200 + s * (14 + 2 * w), y: kneeY }));
  const ankle = side((s) => ({ x: 200 + s * (13 + 1.5 * w), y: ankleY }));

  return Object.freeze({
    ground, ankleY, kneeY, hipY, pelvisY, waistY, chestY, shoulderY, chinY,
    headTop: chinY - 116 * HEAD_SCALE, headDY: chinY - HEAD_CHIN, w, leg, tor,
    upperArm, foreArm, thigh, shin,
    shoulder, elbow, wrist, hip, knee, ankle,
    torsoHW: (y) => lerpTable(torso, y),
    thighHW: (t) => (21 - 10.5 * t) * (0.8 + 0.2 * w),            // t: 0 hip .. 1 knee
    shinHW: (t) => (t < 0.28 ? 10.5 + 1.9 * (t / 0.28) : 12.4 - 6.4 * ((t - 0.28) / 0.72)) * (0.85 + 0.15 * w),
    armHW: (t) => (10 - 4.4 * t) * (0.88 + 0.12 * w),             // t: 0 shoulder .. 1 wrist
  });
}

// ── Bones ───────────────────────────────────────────────────
// [name, parent, side]. side: -1 L, +1 R, 0 centre. Pivots come from M.

export const BONES = [
  ['root', null, 0], ['spine', 'root', 0], ['neck', 'spine', 0], ['head', 'neck', 0],
  ['hairBack', 'head', 0], ['tailL', 'head', -1], ['tailR', 'head', 1], ['tailC', 'head', 0], ['ahoge', 'head', 0],
  ['upperArmL', 'spine', -1], ['foreArmL', 'upperArmL', -1], ['handL', 'foreArmL', -1],
  ['upperArmR', 'spine', 1], ['foreArmR', 'upperArmR', 1], ['handR', 'foreArmR', 1],
  ['skirt', 'root', 0],
  ['thighL', 'root', -1], ['shinL', 'thighL', -1], ['footL', 'shinL', -1],
  ['thighR', 'root', 1], ['shinR', 'thighR', 1], ['footR', 'shinR', 1],
];

export const BONE_SIDE = Object.fromEntries(BONES.map(([n, , s]) => [n, s]));

/** Which arm band a bone belongs to, for the pose's depth shift. */
export const ARM_OF = {
  upperArmL: 'L', foreArmL: 'L', handL: 'L', upperArmR: 'R', foreArmR: 'R', handR: 'R',
};

const HEAD_BONES = new Set(['head', 'hairBack', 'tailL', 'tailR', 'tailC', 'ahoge']);
export const isHeadBone = (b) => HEAD_BONES.has(b);

export function pivots(M) {
  return {
    root: { x: 200, y: M.pelvisY },
    spine: { x: 200, y: M.waistY },
    neck: { x: 200, y: M.shoulderY - 4 },
    head: { x: 200, y: M.chinY },
    // Head children are in canonical head space (chin at HEAD_CHIN).
    hairBack: { x: 200, y: 176 }, tailL: { x: 147, y: 158 }, tailR: { x: 253, y: 158 },
    tailC: { x: 200, y: 122 }, ahoge: { x: 206, y: 120 },
    upperArmL: M.shoulder.L, foreArmL: M.elbow.L, handL: M.wrist.L,
    upperArmR: M.shoulder.R, foreArmR: M.elbow.R, handR: M.wrist.R,
    skirt: { x: 200, y: M.waistY },
    thighL: M.hip.L, shinL: M.knee.L, footL: M.ankle.L,
    thighR: M.hip.R, shinR: M.knee.R, footR: M.ankle.R,
  };
}

// ── Affine matrices, SVG order [a b c d e f] ────────────────

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const IDENTITY = [1, 0, 0, 1, 0, 0];

/** T(p) R(deg) S(sx,sy) T(-p) T(shift): rotate and scale about a pivot. */
function local(p, deg, sx, sy, shift) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  const tx = shift ? shift.x : 0, ty = shift ? shift.y : 0;
  // M = [a b cc d] about p, then shift in local space.
  const ex = p.x - (a * p.x + cc * p.y) + (a * tx + cc * ty);
  const ey = p.y - (b * p.x + d * p.y) + (b * tx + d * ty);
  return [a, b, cc, d, ex, ey];
}

export function apply(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/**
 * Forward kinematics.
 * frame: { bones: { name: { a, sx, sy } }, root: { x, y } } with outward-positive
 * angles on sided bones. Returns { name: matrix } in world (viewBox) space.
 */
export function solve(M, P, frame) {
  const out = {};
  for (const [name, parent, side] of BONES) {
    const f = frame.bones[name] || {};
    const deg = side ? -side * (f.a || 0) : (f.a || 0);
    const shift = name === 'head' ? { x: 0, y: M.headDY } : null;
    const hs = name === 'head' ? HEAD_SCALE : 1;
    let m = local(P[name], deg, (f.sx ?? 1) * hs, (f.sy ?? 1) * hs, shift);
    if (name === 'root') {
      // Spin and squash happen about the feet, so a landing compresses toward the floor.
      const r = frame.root;
      const sq = local({ x: 200, y: M.ground }, 0, r.sx ?? 1, r.sy ?? 1, null);
      m = mul([1, 0, 0, 1, r.x || 0, r.y || 0], mul(sq, m));
    }
    out[name] = parent ? mul(out[parent], m) : m;
  }
  return out;
}

export const matrixAttr = (m) => `matrix(${m.map((v) => +v.toFixed(4)).join(' ')})`;

/** World rotation in degrees of a matrix (for springs that hang under gravity). */
export const worldAngle = (m) => (Math.atan2(m[1], m[0]) * 180) / Math.PI;

// ── IK ──────────────────────────────────────────────────────

const norm = (d) => {
  let a = ((d + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
};
const deg = (r) => (r * 180) / Math.PI;

/** Outward-positive angle of the direction (dx, dy) for side s. */
const outward = (s, dx, dy) => deg(Math.atan2(s * dx, dy));

/** Landmarks a pose can aim a wrist at, in rest coordinates. dx is outward. */
export function landmark(M, name, s) {
  switch (name) {
    case 'chin': return { x: 200, y: M.chinY };
    case 'cheek': return { x: 200 + s * 34, y: M.chinY - 18 };
    case 'crown': return { x: 200, y: M.headTop };
    case 'chest': return { x: 200 + s * 8, y: M.chestY };
    case 'navel': return { x: 200, y: M.waistY + 14 };
    case 'waist': return { x: 200 + s * M.torsoHW(M.waistY), y: M.waistY };
    case 'hip': return { x: 200 + s * M.torsoHW(M.hipY), y: M.hipY };
    case 'shoulder': return { x: 200 + s * 43, y: M.shoulderY };
    default: return { x: 200, y: M.chestY };
  }
}

/** Two-bone IK for an arm. Returns { upper, fore } outward-positive degrees. */
export function solveArm(M, s, spec) {
  const side = s < 0 ? 'L' : 'R';
  const S = M.shoulder[side];
  const [name, dx = 0, dy = 0] = spec.to;
  const base = landmark(M, name, s);
  const T = { x: base.x + s * dx, y: base.y + dy };
  const a = M.upperArm, b = M.foreArm;
  const vx = T.x - S.x, vy = T.y - S.y;
  const d = Math.min(a + b - 0.5, Math.max(Math.abs(a - b) + 1, Math.hypot(vx, vy)));
  const phi = outward(s, vx, vy);
  const alpha = deg(Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))));
  const upper = spec.bend === 'in' ? phi - alpha : phi + alpha;
  // Elbow position along the upper arm, then the forearm's own direction.
  const ur = (upper * Math.PI) / 180;
  const E = { x: S.x + s * Math.sin(ur) * a, y: S.y + Math.cos(ur) * a };
  const psi = outward(s, T.x - E.x, T.y - E.y);
  return { upper: norm(upper), fore: norm(psi - upper) };
}
