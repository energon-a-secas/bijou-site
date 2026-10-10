// ── Body ─────────────────────────────────────────────────────
// Skin pieces: neck, torso, pelvis, arms, hands, legs, feet. Every coordinate
// is read from M, so height and build reshape the body and every garment that
// reads the same landmarks.

import { f1, smooth, line, shape, fillOnly, stroke, cel } from './paint.js';

const SW = 1.45;

/**
 * Fill with a cel shadow down the right side, then outline only the edges that
 * should show. The shadow shifts sideways only, so joints never seam.
 */
function skinPart(bone, z, fill, outline, skin, dx = -4) {
  return { bone, z, svg: cel(fill, skin.base, skin.line, 0, { dx, dy: 0, shadow: skin.shadow }) + outline.map((d) => stroke(d, skin.line, SW)).join('') };
}

function neck(M, skin) {
  const top = M.chinY - 16, base = M.shoulderY - 4;
  const fill = smooth([[191, top], [209, top], [210, base - 6], [213, base + 4], [187, base + 4], [190, base - 6]]);
  const shadowD = `M189 ${f1(M.chinY - 8)}H211V${f1(M.chinY + 3)}Q200 ${f1(M.chinY + 13)} 189 ${f1(M.chinY + 3)}Z`;
  return {
    bone: 'neck', z: 149,
    svg: fillOnly(fill, skin.base) + fillOnly(shadowD, skin.shadow) +
      stroke(`M209.4 ${f1(M.chinY)}L210.2 ${f1(base - 4)}`, skin.line, SW) +
      stroke(`M190.6 ${f1(M.chinY)}L189.8 ${f1(base - 4)}`, skin.line, SW),
  };
}

function torso(M, skin) {
  const ys = [M.shoulderY - 8, M.shoulderY - 2, M.shoulderY + 4, M.shoulderY + 12, M.shoulderY + 24, M.chestY - 6, M.chestY + 4, M.chestY + 20, M.waistY, M.waistY + 14];
  const right = ys.map((y) => [200 + M.torsoHW(y), y]);
  const left = right.map(([x, y]) => [400 - x, y]);
  const fill = smooth(right.concat(left.slice().reverse()));
  const side = (pts) => smooth(pts.slice(0, 9), false);
  const collar = `M${195} ${f1(M.shoulderY + 6)}Q${186} ${f1(M.shoulderY + 2)} ${179} ${f1(M.shoulderY + 4)}M205 ${f1(M.shoulderY + 6)}Q214 ${f1(M.shoulderY + 2)} 221 ${f1(M.shoulderY + 4)}`;
  const part = skinPart('spine', 150, fill, [side(right), side(left)], skin);
  part.svg += stroke(collar, skin.line, 1.1, 'opacity=".45"');
  return part;
}

function pelvis(M, skin) {
  const ys = [M.waistY - 8, M.waistY + 14, M.waistY + 28, M.hipY - 4, M.hipY + 8];
  const right = ys.map((y) => [200 + M.torsoHW(y), y]).concat([[211, M.hipY + 22], [200, M.hipY + 27]]);
  const left = right.slice(0, -1).map(([x, y]) => [400 - x, y]);
  const fill = smooth(right.concat(left.reverse()));
  const sideR = smooth(right.slice(0, 5), false);
  const sideL = smooth(right.slice(0, 5).map(([x, y]) => [400 - x, y]), false);
  return skinPart('root', 150, fill, [sideR, sideL], skin);
}

/** Local (u outward, v down) around an anchor, for side s. */
const at = (A, s) => ([u, v]) => [A.x + s * u, A.y + v];

function upperArm(M, skin, s, side) {
  const P = M.shoulder[side], L = M.upperArm, h = (t) => M.armHW(t * 0.52);
  const p = at(P, s);
  const outer = [[0, -h(0)], [h(0) * 0.97, -h(0) * 0.25], [h(0.18) + 0.7, L * 0.2], [h(0.55), L * 0.58], [h(1), L + 3]].map(p);
  const inner = [[-h(1), L + 3], [-h(0.5) * 0.96, L * 0.52], [-h(0.1) * 0.94, 9], [-h(0) * 0.97, -h(0) * 0.25]].map(p);
  const fill = smooth(outer.concat(inner));
  const innerLine = smooth([[-h(0.12), 12], [-h(0.5) * 0.96, L * 0.52], [-h(1), L]].map(p), false);
  return skinPart(`upperArm${side}`, 300, fill, [smooth(outer.slice(0, 5), false), innerLine], skin);
}

function foreArm(M, skin, s, side) {
  const E = M.elbow[side], F = M.foreArm, h = (t) => M.armHW(0.52 + t * 0.48);
  const p = at(E, s);
  const outer = [[0, -h(0)], [h(0), 0], [h(0.3) + 0.5, F * 0.32], [h(0.8), F * 0.8], [h(1), F + 2]].map(p);
  const inner = [[-h(1), F + 2], [-h(0.7) * 0.95, F * 0.68], [-h(0.25) * 0.95, F * 0.25], [-h(0), 0]].map(p);
  const fill = smooth(outer.concat(inner));
  return skinPart(`foreArm${side}`, 301, fill, [
    smooth(outer.slice(1, 5), false),
    smooth(inner.slice(0, 4).reverse(), false),
  ], skin);
}

function thigh(M, skin, s, side) {
  const H = M.hip[side], K = M.knee[side], h = M.thighHW;
  const c = (t) => ({ x: H.x + (K.x - H.x) * t, y: H.y + (K.y - H.y) * t });
  const o = (t, k = 1) => { const q = c(t); return [q.x + s * h(t) * k, q.y]; };
  const i = (t, k = 1) => { const q = c(t); return [q.x - s * h(t) * k, q.y]; };
  const outer = [[H.x, H.y - h(0)], o(0), o(0.35, 1.02), o(0.75), [K.x + s * h(1), K.y + 5]];
  const inner = [[K.x - s * h(1), K.y + 5], i(0.62), i(0.2, 0.98), [H.x - s * h(0), H.y]];
  const fill = smooth(outer.concat(inner));
  const kneecap = `M${f1(K.x - 4)} ${f1(K.y - 1)}Q${f1(K.x)} ${f1(K.y + 3)} ${f1(K.x + 4)} ${f1(K.y - 1)}`;
  const part = skinPart(`thigh${side}`, 100, fill, [
    smooth([o(0.08), o(0.35, 1.02), o(0.75), [K.x + s * h(1), K.y + 4]], false),
    smooth([i(0.25, 0.98), i(0.62), [K.x - s * h(1), K.y + 4]], false),
  ], skin);
  part.svg += stroke(kneecap, skin.line, 1.1, 'opacity=".35"');
  return part;
}

function shin(M, skin, s, side) {
  const K = M.knee[side], A = M.ankle[side], h = M.shinHW;
  const c = (t) => ({ x: K.x + (A.x - K.x) * t, y: K.y + (A.y - K.y) * t });
  const o = (t, k) => { const q = c(t); return [q.x + s * h(t) * k, q.y]; };
  const i = (t, k) => { const q = c(t); return [q.x - s * h(t) * k, q.y]; };
  const outer = [[K.x, K.y - h(0)], [K.x + s * h(0), K.y], o(0.3, 1.08), o(0.66, 1), [A.x + s * h(1), A.y + 5]];
  const inner = [[A.x - s * h(1), A.y + 5], i(0.6, 0.9), i(0.26, 0.95), [K.x - s * h(0), K.y]];
  const fill = smooth(outer.concat(inner));
  return skinPart(`shin${side}`, 101, fill, [
    smooth(outer.slice(1), false),
    smooth(inner.slice().reverse(), false),
  ], skin);
}

function foot(M, skin, s, side) {
  const A = M.ankle[side], p = at(A, s);
  const pts = [[-5.4, -6], [5.4, -6], [6.2, 6], [8.6, 20], [8.8, 27.5], [6, 33], [1, 34.4], [-4, 33.3], [-7.1, 28], [-7, 18], [-5.8, 6]].map(p);
  const fill = smooth(pts);
  const toes = line([[-1.6, 28.5], [-1.4, 33.2]].map(p)) + line([[2.6, 28.8], [2.8, 33.6]].map(p));
  const part = skinPart(`foot${side}`, 102, fill, [smooth(pts.slice(1), false)], skin);
  part.svg += stroke(toes, skin.line, 1, 'opacity=".45"');
  return part;
}

// ── Hands ───────────────────────────────────────────────────

/** An outlined rounded finger from a to b, drawn as two strokes. */
function finger(a, b, w, skin) {
  const d = `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
  return { under: stroke(d, skin.line, w + 2.3), over: stroke(d, skin.base, w) };
}

function fistBody(p, skin) {
  const pts = [[-5.4, -2], [5.4, -2], [7, 6], [7.2, 14], [4.4, 19.4], [-4, 19.6], [-7, 15], [-7, 6]].map(p);
  return shape(smooth(pts), skin.base, skin.line, 2) +
    stroke(line([[-2.5, 15], [-2.2, 19]].map(p)) + line([[1.5, 15.5], [1.7, 19.3]].map(p)), skin.line, 1, 'opacity=".5"');
}

export function handPiece(M, skin, s, kind = 'rest') {
  const side = s < 0 ? 'L' : 'R';
  const p = at(M.wrist[side], s);
  let svg = '';
  if (kind === 'open') {
    const fs = [[-6, 9, -11, 26], [-2, 10, -4, 29], [2, 10, 3, 29], [5.5, 9, 9, 25.5]].map(([x0, y0, x1, y1]) => finger(p([x0, y0]), p([x1, y1]), 4.2, skin));
    const thumb = finger(p([-5, 4]), p([-12, 10]), 4.4, skin);
    svg = fs.map((f) => f.under).join('') + thumb.under +
      shape(smooth([[-5.4, -2], [5.4, -2], [7, 6], [6, 12], [-6, 12], [-7, 5]].map(p)), skin.base, skin.line, 2) +
      fs.map((f) => f.over).join('') + thumb.over;
  } else if (kind === 'fist' || kind === 'grip') {
    svg = fistBody(p, skin) + (() => { const t = finger(p([-6.4, 7]), p([0.5, 11.5]), 4, skin); return t.under + t.over; })();
  } else if (kind === 'peace' || kind === 'point') {
    const fs = kind === 'peace'
      ? [finger(p([-1.5, 14]), p([-5, 31]), 4, skin), finger(p([3, 14]), p([6, 31]), 4, skin)]
      : [finger(p([0.5, 14]), p([0, 31]), 4, skin)];
    svg = fs.map((f) => f.under).join('') + fistBody(p, skin) + fs.map((f) => f.over).join('') +
      (() => { const t = finger(p([-6.4, 7]), p([0.5, 11.5]), 4, skin); return t.under + t.over; })();
  } else {
    // rest and curl: a relaxed hand, fingers together, thumb in front.
    const curl = kind === 'curl' ? 0.72 : 1;
    const palm = [[-5, -2], [5, -2], [6.2, 8], [6.3, 15 * curl + 1], [4.8, 22 * curl], [1.5, 25.5 * curl], [-2, 24.5 * curl], [-4.2, 20 * curl], [-4.6, 13]].map(p);
    const thumb = [[-4.4, 5], [-7.8, 9.5], [-8.3, 14.5], [-6, 17.4], [-3.8, 13.5]].map(p);
    svg = shape(smooth(palm), skin.base, skin.line, 2) +
      stroke(line([[0, 13 * curl], [0.5, 21 * curl]].map(p)) + line([[3, 12 * curl], [3.4, 19.5 * curl]].map(p)), skin.line, 1, 'opacity=".5"') +
      shape(smooth(thumb), skin.base, skin.line, 1.8);
  }
  return { bone: `hand${side}`, z: 303, svg, hand: kind };
}

/** Every skin piece except the hands, which depend on the pose. */
export function bodyPieces(M, skin) {
  const out = [neck(M, skin), torso(M, skin), pelvis(M, skin)];
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    out.push(upperArm(M, skin, s, side), foreArm(M, skin, s, side),
      thigh(M, skin, s, side), shin(M, skin, s, side), foot(M, skin, s, side));
  }
  return out;
}
