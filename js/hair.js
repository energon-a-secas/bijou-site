// ── Hair ─────────────────────────────────────────────────────
// Back mass, tails, bangs, side locks and the ahoge, in canonical head space.
// Tails and long hair ride spring bones (tailL/R/C, hairBack, ahoge), which the
// motion loop swings, so the art here is drawn hanging at rest.

import { f1, smooth, line, shape, fillOnly, stroke, shade, bow, cel } from './paint.js';

/**
 * A claw-shaped lock: wide at the root, curving to a sharp tip. bend pushes the
 * belly sideways, so a fan of locks can curl in toward the face.
 */
function lockD(x0, y0, x1, y1, w, bend = 0) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const h = w / 2;
  const L0 = [x0 - nx * h, y0 - ny * h], R0 = [x0 + nx * h, y0 + ny * h];
  const pt = (t, off) => [x0 + dx * t + nx * off, y0 + dy * t + ny * off];
  const c1 = pt(0.45, bend * 0.8 - h * 0.95), c2 = pt(0.82, bend * 0.5 - w * 0.08);
  const c3 = pt(0.7, bend * 0.6 + w * 0.34), c4 = pt(0.3, bend * 0.7 + h * 1.02);
  const P = (q) => `${f1(q[0])} ${f1(q[1])}`;
  return `M${P(L0)}C${P(c1)} ${P(c2)} ${f1(x1)} ${f1(y1)}C${P(c3)} ${P(c4)} ${P(R0)}Z`;
}

/** Cel-shaded locks: a darker crescent on each lock's lower-right edge. */
const locks = (list, hair, sw = 1.8) => list.map((l) => cel(lockD(...l), hair.base, hair.line, sw, { dx: -3.5, dy: -3, shadow: hair.shadow })).join('');

/** Strand lines: a few soft strokes that read as hair texture. */
const strands = (d, hair) => stroke(d, hair.line, 1.1, 'opacity=".32"');

// ── Back ────────────────────────────────────────────────────

const CAP = [[200, 110], [238, 116], [262, 146], [267, 186], [263, 222], [256, 250], [238, 262], [200, 264], [162, 262], [144, 250], [137, 222], [133, 186], [138, 146], [162, 116]];

function backCap(hair, bottom = 264) {
  const pts = CAP.map(([x, y]) => [x, y > 240 ? y + (bottom - 264) : y]);
  return cel(smooth(pts), hair.shadow, hair.line, 2, { dx: -6, dy: -4, shadow: hair.deep });
}

/** A wavy bob: a dark inner layer with flipped ends, and lit outer locks over it. */
function wavyBob(hair) {
  const R = [[238, 114], [264, 140], [273, 178], [269, 212], [277, 240], [290, 268, 1], [271, 262], [265, 290, 1], [249, 272], [233, 287, 1], [220, 266], [200, 272]];
  const back = R.concat(R.slice(0, -1).reverse().map(([x, y, c]) => [400 - x, y, c]));
  const inner = cel(smooth([[200, 110], ...back]), hair.shadow, hair.line, 2, { dx: -6, dy: -4, shadow: hair.deep });
  const outer = [
    [250, 146, 284, 264, 30, 12], [244, 166, 262, 288, 24, 6], [150, 146, 116, 264, 30, -12], [156, 166, 138, 288, 24, -6],
  ];
  return [
    { bone: 'head', z: 12, depth: -0.6, svg: inner },
    { bone: 'head', z: 13, depth: -0.4, svg: locks(outer, hair, 2) },
  ];
}

function longBack(hair, wavy) {
  const R = wavy
    ? [[262, 196], [272, 236], [264, 278], [280, 320], [268, 362], [282, 402], [266, 432], [254, 414], [244, 440], [230, 418], [216, 442], [204, 422]]
    : [[262, 196], [270, 240], [274, 300], [271, 360], [266, 410], [252, 396], [242, 424], [228, 404], [214, 428], [204, 410]];
  const L = R.map(([x, y]) => [400 - x, y]).reverse();
  // Sharp tips read better than a smoothed hem, so the hem is a polyline.
  const sides = 6;
  const d = smooth(R.slice(0, sides), false) + line(R.slice(sides - 1).concat([[200, 430]], L.slice(0, L.length - sides + 1))).replace(/^M[^L]*/, '') +
    smooth(L.slice(L.length - sides), false).replace(/^M[^C]*/, '') + 'Z';
  const light = strands(wavy
    ? 'M232 230q12 40 0 80q-12 40 4 80M168 230q-12 40 0 80q12 40 -4 80M200 250v150'
    : 'M236 230q8 70 2 160M164 230q-8 70 -2 160M200 250v150', hair);
  return { bone: 'hairBack', z: 12, depth: -0.6, svg: cel(d, hair.shadow, hair.line, 2, { dx: -7, dy: 0, shadow: hair.deep }) + light };
}

function tail(hair, s, side) {
  const p = ([u, v]) => [(side === 'L' ? 147 : 253) + s * u, 158 + v];
  const outer = [[-4, -10], [12, -13], [26, -4], [35, 14], [38, 50], [35, 92], [31, 132], [33, 172], [27, 208], [16, 236]].map(p);
  const tip1 = p([7, 258]);
  const notch = p([3, 232]);
  const tip2 = p([-4, 246]);
  const inner = [[-7, 214], [-5, 172], [-9, 130], [-7, 90], [-11, 50], [-13, 18], [-10, -2]].map(p);
  const d = smooth(outer, false) + line([outer[outer.length - 1], tip1, notch, tip2, inner[0]]).replace(/^M[^L]*/, '') +
    smooth(inner, false).replace(/^M[^C]*/, '') + 'Z';
  const tie = bow(p([6, -6])[0], p([6, -6])[1], 11, '#ff9cc2', '#a84470', s * 12);
  const st = strands(`M${p([14, 10]).map(f1).join(' ')}Q${p([24, 90]).map(f1).join(' ')} ${p([12, 220]).map(f1).join(' ')}`, hair);
  const shine = stroke(`M${p([20, 24]).map(f1).join(' ')}Q${p([27, 50]).map(f1).join(' ')} ${p([25, 78]).map(f1).join(' ')}`, hair.light, 3, 'opacity=".55"');
  return [
    { bone: `tail${side}`, z: 14, depth: -0.3, svg: cel(d, hair.base, hair.line, 2, { dx: -6, dy: 0, shadow: hair.shadow }) + st + shine },
    { bone: `tail${side}`, z: 15, depth: -0.3, svg: tie, key: `tie${side}` },
  ];
}

function ponytail(hair) {
  const p = ([u, v]) => [200 + u, 122 + v];
  const outer = [[-10, 4], [-6, -16], [12, -20], [28, -8], [40, 18], [50, 62], [54, 112], [52, 162], [46, 202]].map(p);
  const tips = [p([38, 242]), p([31, 214]), p([22, 238])];
  const inner = [[18, 196], [20, 150], [15, 100], [6, 60], [-4, 30]].map(p);
  const d = smooth(outer, false) + line([outer[outer.length - 1], ...tips, inner[0]]).replace(/^M[^L]*/, '') +
    smooth(inner, false).replace(/^M[^C]*/, '') + 'Z';
  return { bone: 'tailC', z: 11, depth: -0.5, svg: cel(d, hair.shadow, hair.line, 2, { dx: -6, dy: 0, shadow: hair.deep }) + strands(`M${p([20, 0]).join(' ')}Q${p([42, 90]).join(' ')} ${p([32, 200]).join(' ')}`, hair) };
}

function buns(hair) {
  const bun = (x) => `<ellipse cx="${x}" cy="122" rx="22" ry="21" fill="${hair.base}" stroke="${hair.line}" stroke-width="2"/>` +
    strands(`M${x - 12} 120q8-14 22-6M${x - 8} 132q10-6 18 2`, hair) +
    stroke(`M${x - 10} 112q6-6 14-4`, hair.light, 2.6, 'opacity=".6"');
  return { bone: 'head', z: 13, depth: -0.3, svg: bun(160) + bun(240) };
}

// ── Front ───────────────────────────────────────────────────

const FRONT_CAP = [[141, 206], [139, 170], [147, 140], [167, 118], [200, 109], [233, 118], [253, 140], [261, 170], [259, 206], [251, 190], [243, 162], [222, 148], [200, 145], [178, 148], [157, 162], [149, 190]];

const BANGS = {
  wispy: [
    [154, 150, 145, 207, 18, -4], [246, 150, 255, 207, 18, 4],
    [168, 140, 159, 196, 23, -3], [232, 140, 241, 196, 23, 3],
    [184, 136, 179, 192, 23, -1.5], [216, 136, 221, 192, 23, 1.5],
    [199, 134, 200, 186, 21, 0], [191, 138, 188, 181, 11, -1], [208, 138, 212, 182, 11, 1],
  ],
  swept: [
    [150, 150, 168, 197, 22, 6], [166, 141, 196, 193, 25, 8], [186, 137, 222, 189, 25, 8],
    [210, 138, 244, 185, 21, 6], [232, 143, 254, 180, 14, 4], [148, 152, 146, 210, 14, -2],
  ],
  messy: [
    [156, 146, 146, 204, 20, -3], [244, 148, 257, 208, 16, 4],
    [170, 138, 165, 198, 22, -4], [228, 140, 247, 199, 22, 5],
    [186, 134, 199, 193, 21, 4], [208, 135, 226, 195, 22, 4],
    [196, 136, 186, 186, 12, -2], [214, 138, 237, 186, 10, 3],
  ],
  split: [
    [197, 133, 156, 207, 32, -10], [203, 133, 244, 207, 32, 10], [190, 136, 182, 182, 11, -2], [210, 136, 218, 182, 11, 2],
  ],
};

const SIDE_LOCKS = {
  wavy: [[151, 164, 144, 270, 19, -9], [159, 170, 166, 256, 12, 5], [249, 164, 256, 270, 19, 9], [241, 170, 234, 256, 12, -5]],
  default: [[152, 166, 149, 274, 17, -4], [159, 170, 163, 258, 10, 2], [248, 166, 251, 274, 17, 4], [241, 170, 237, 258, 10, -2]],
  short: [[152, 166, 150, 250, 16, -3], [248, 166, 250, 250, 16, 3]],
};

function bluntBangs(hair) {
  const d = 'M145 198L147 160Q152 140 200 136Q248 140 253 160L255 198L247 189L238 192L228 187L216 191L204 187L192 191L180 187L168 191L158 188Z';
  return shape(d, hair.base, hair.line, 1.9) + strands('M170 150l-2 34M188 146l-1 40M212 146l1 40M230 150l2 34', hair);
}

function himeLocks(hair) {
  const lockR = 'M240 168L256 170L258 270L249 264L242 270Z';
  const lockL = 'M160 168L144 170L142 270L151 264L158 270Z';
  return shape(lockL, hair.base, hair.line, 1.9) + shape(lockR, hair.base, hair.line, 1.9);
}

export function hairPieces(head, hair) {
  const out = [];
  const back = head.back;
  const short = back === 'bob' || back === 'buns' || back === 'wavybob';
  if (back === 'wavybob') out.push(...wavyBob(hair));
  else out.push({ bone: 'head', z: 12, depth: -0.6, svg: backCap(hair, short ? 274 : 264) });
  if (back === 'long' || back === 'wavy') out.push(longBack(hair, back === 'wavy'));
  if (back === 'twintails') out.push(...tail(hair, -1, 'L'), ...tail(hair, 1, 'R'));
  if (back === 'ponytail') out.push(ponytail(hair));
  if (back === 'buns') out.push(buns(hair));

  // Shadow the bangs cast on the forehead; it shows between wispy locks.
  out.push({ bone: 'head', z: 405, depth: 0.85, svg: fillOnly('M150 182Q160 158 200 150Q240 158 250 182L250 198Q200 186 150 198Z', hair.deep, 'opacity=".28"') });

  const sideSet = back === 'wavybob' ? SIDE_LOCKS.wavy : short ? SIDE_LOCKS.short : SIDE_LOCKS.default;
  out.push({ bone: 'head', z: 440, depth: 0.55, svg: head.front === 'blunt' ? himeLocks(hair) : locks(sideSet, hair) });

  const cap = smooth(FRONT_CAP);
  // Locks first, then the cap over their roots, so strand lines start where the cap ends.
  let front = head.front === 'blunt' ? bluntBangs(hair) : locks(BANGS[head.front] || BANGS.wispy, hair);
  front += cel(cap, hair.base, hair.line, 0, { dx: -4, dy: -7, shadow: hair.shadow }) + stroke(smooth(FRONT_CAP.slice(0, 9), false), hair.line, 2);
  // Gloss: two short arcs on the crown instead of a solid ring, which read as a headband.
  front += stroke('M168 130Q184 121 197 121M206 121Q221 121 234 130', hair.light, 2.4, 'opacity=".75"') +
    stroke('M176 136Q188 130 196 130M207 130Q218 130 228 136', hair.light, 1.4, 'opacity=".45"');
  out.push({ bone: 'head', z: 450, depth: 0.7, svg: front });

  if (head.ahoge) {
    out.push({ bone: 'ahoge', z: 451, depth: 0.7, key: 'ahoge', svg: shape('M205 122C198 102 212 92 223 97C212 98 208 106 211 122Z', hair.base, hair.line, 1.7) });
  }
  return out;
}

export const hasTails = (head) => head.back === 'twintails';
