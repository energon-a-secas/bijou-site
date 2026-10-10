// ── Face ─────────────────────────────────────────────────────
// Face shape, ears, eyes, brows, mouth and blush, in canonical head space
// (chin at y 244). Expressions are data; blinking and talking are CSS states on
// the doll root, so neither rebuilds markup.

import { f1, smooth, line, shape, fillOnly, stroke, darken, lighten, heart, cel } from './paint.js';

const EYE_C = { L: { x: 178, y: 201 }, R: { x: 222, y: 201 } };
const EYE_K = 1.02;
const LASH = '#39242b';

/** Named expressions. eyes, mouth, brows, blush, extra. */
export const EXPR = {
  smile: { eyes: 'open', mouth: null, brows: 'neutral', blush: 0 },
  happy: { eyes: 'open', mouth: 'open', brows: 'up', blush: 0 },
  joy: { eyes: 'joy', mouth: 'open', brows: 'up', blush: 2 },
  love: { eyes: 'love', mouth: 'open', brows: 'up', blush: 2 },
  blush: { eyes: 'open', mouth: 'small', brows: 'worried', blush: 2, look: [-0.6, 0.3] },
  wink: { eyes: 'wink', mouth: 'open', brows: 'up', blush: 1 },
  grin: { eyes: 'open', mouth: 'grin', brows: 'up', blush: 0 },
  surprised: { eyes: 'wide', mouth: 'o', brows: 'raised', blush: 0 },
  pout: { eyes: 'half', mouth: 'pout', brows: 'angry', blush: 1, extra: 'puff' },
  curious: { eyes: 'open', mouth: 'cat', brows: 'raised', blush: 0 },
  sleepy: { eyes: 'half', mouth: 'small', brows: 'neutral', blush: 0 },
  sleep: { eyes: 'closed', mouth: 'o', brows: 'neutral', blush: 0 },
  dizzy: { eyes: 'swirl', mouth: 'wavy', brows: 'worried', blush: 0, extra: 'sweat' },
  flustered: { eyes: 'open', mouth: 'wavy', brows: 'worried', blush: 2, extra: 'sweat' },
};

// ── Shape tables (u outward, v down, around the eye centre) ──

const UPPER = {
  sparkle: [[-13, -1], [-7, -9], [2, -12.5], [10, -10.5], [15.5, -6]],
  soft: [[-13, -4], [-6, -12], [3, -13], [11, -9], [15, -1]],
  cat: [[-13, 0], [-6, -8.5], [3, -12], [11, -12.5], [16, -10]],
};
const LOWER = {
  sparkle: [[15, -5], [12, 4], [5, 9], [-4, 9], [-10, 5]],
  soft: [[15, -1], [11, 7], [4, 11], [-4, 10.5], [-10, 5]],
  cat: [[16, -10], [13, 1], [6, 9], [-3, 9.5], [-10, 5]],
};
const IRIS = {
  sparkle: { u: 1, v: 0.5, rx: 9.1, ry: 12 },
  soft: { u: 0.5, v: 2, rx: 10, ry: 12.5 },
  cat: { u: 1.5, v: 0.5, rx: 9.4, ry: 12 },
};
const CLOSED_V = [3, 6, 6.5, 5, 1.5];

const base = (style) => (style === 'sleepy' ? 'sparkle' : style);

/** Upper lid points at a given openness (1 open, 0 shut). */
function upperLid(style, open) {
  const b = base(style);
  const o = style === 'sleepy' ? open * 0.55 : open;
  return UPPER[b].map(([u, v], i) => [u, CLOSED_V[i] + (v - CLOSED_V[i]) * o]);
}

const toXY = (c, s) => ([u, v]) => [c.x + s * u, c.y + v];

function openEye(style, open, side, eye, uid, variant) {
  const s = side === 'L' ? -1 : 1, c = EYE_C[side], p = toXY(c, s), b = base(style);
  const up = upperLid(style, open);
  const white = smooth(up.concat(LOWER[b]).map(p));
  const clip = `bj-eye-${uid}-${side}-${Math.round(open * 100)}`;
  const ir = IRIS[b];
  const small = variant === 'wide' ? 0.76 : 1;
  const ix = c.x + s * ir.u, iy = c.y + ir.v;
  let iris;
  if (variant === 'love') {
    iris = `<path d="${heart(ix, iy + 1, 9.5)}" fill="#ff4f86" stroke="#c42a5c" stroke-width="1.2"/>` +
      `<ellipse cx="${f1(ix - 3)}" cy="${f1(iy - 3)}" rx="2.6" ry="2" fill="#fff" opacity=".9"/>`;
  } else {
    iris = `<ellipse cx="${f1(ix)}" cy="${f1(iy)}" rx="${f1(ir.rx * small)}" ry="${f1(ir.ry * small)}" fill="url(#bj-iris-${uid})" stroke="${darken(eye, 0.5)}" stroke-width="1"/>` +
      `<ellipse cx="${f1(ix)}" cy="${f1(iy)}" rx="${f1(3.5 * small)}" ry="${f1(6 * small)}" fill="${darken(eye, 0.76)}"/>` +
      `<path d="M${f1(ix - 6.5 * small)} ${f1(iy + 7 * small)}Q${f1(ix)} ${f1(iy + 12.5 * small)} ${f1(ix + 6.5 * small)} ${f1(iy + 7 * small)}" fill="none" stroke="${lighten(eye, 0.55)}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>` +
      `<ellipse cx="${f1(ix - 3.8)}" cy="${f1(iy - 4.6)}" rx="2.6" ry="3.6" fill="#fffaf2"/>` +
      `<circle cx="${f1(ix + 4.2)}" cy="${f1(iy + 6)}" r="1.4" fill="#fffaf2"/>` +
      (style === 'sparkle' ? `<circle cx="${f1(ix + 5)}" cy="${f1(iy - 6)}" r="1.1" fill="#fff" opacity=".9"/>` : '');
  }
  const lashD = smooth(up.map(p), false);
  const wing = line([[up[4][0] - 1, up[4][1] - 0.5], [up[4][0] + 4.5, up[4][1] - 4.5], [up[4][0] + 0.6, up[4][1] + 3]].map(p), true);
  const lower = smooth(LOWER[b].slice(0, 3).map(([u, v]) => [u - 1, v]).map(p), false);
  const crease = smooth([[-8, -15], [2, -18.5], [11, -15.8]].map(([u, v]) => [u, v + (1 - open) * 12]).map(p), false);
  return `<clipPath id="${clip}"><path d="${white}"/></clipPath>` +
    `<path d="${white}" fill="#fffafc"/>` +
    `<g clip-path="url(#${clip})"><g class="bj-iris" data-side="${side}">${iris}</g>` +
    `<path d="${smooth(up.map(p), false)}" fill="none" stroke="${darken(eye, 0.3)}" stroke-width="7" opacity=".22"/></g>` +
    stroke(lashD, LASH, 2.8) + `<path d="${wing}" fill="${LASH}"/>` +
    stroke(line([[up[3][0], up[3][1] - 1], [up[3][0] + 2.5, up[3][1] - 5.5]].map(p)) + line([[up[4][0] - 1.5, up[4][1] - 1], [up[4][0] + 4.5, up[4][1] - 6.5]].map(p)), LASH, 1.6) +
    stroke(lower, LASH, 0.9, 'opacity=".65"') +
    (open > 0.6 ? stroke(crease, LASH, 1, 'opacity=".38"') : '');
}

function closedEye(side) {
  const s = side === 'L' ? -1 : 1, p = toXY(EYE_C[side], s);
  return stroke(smooth([[-13, 1], [-4, 6], [6, 6.2], [15, 0.5]].map(p), false), LASH, 3) +
    stroke(line([[13, 2.5], [16.5, 5.5]].map(p)) + line([[9, 5], [11, 8.5]].map(p)), LASH, 1.4);
}

function joyEye(side) {
  const s = side === 'L' ? -1 : 1, p = toXY(EYE_C[side], s);
  return stroke(smooth([[-12, 5], [-4, -5.5], [6, -5.5], [14, 4]].map(p), false), LASH, 3.4) +
    stroke(line([[14, 4], [17.5, 2]].map(p)), LASH, 1.8);
}

function swirlEye(side) {
  const c = EYE_C[side];
  let d = `M${c.x} ${c.y}`;
  for (let i = 1; i <= 22; i++) {
    const a = i * 0.62, r = i * 0.55;
    d += `L${f1(c.x + Math.cos(a) * r)} ${f1(c.y + Math.sin(a) * r * 1.15)}`;
  }
  return stroke(d, LASH, 2);
}

function eyePair(head, eye, expr, uid) {
  const style = head.eyeStyle;
  const one = (side, kind) => {
    if (kind === 'joy') return joyEye(side);
    if (kind === 'closed') return closedEye(side);
    if (kind === 'swirl') return swirlEye(side);
    if (kind === 'half') return openEye(style, 0.42, side, eye, uid);
    const variant = kind === 'wide' || kind === 'love' ? kind : null;
    const open = kind === 'wide' ? 1.08 : 1;
    // Open eyes carry their blink frames: CSS swaps them on data-blink.
    return `<g class="bj-eye-open">${openEye(style, open, side, eye, uid, variant)}</g>` +
      `<g class="bj-eye-half">${openEye(style, 0.35, side, eye, uid)}</g>` +
      `<g class="bj-eye-shut">${closedEye(side)}</g>`;
  };
  const kinds = expr.eyes === 'wink' ? { L: 'open', R: 'joy' } : { L: expr.eyes, R: expr.eyes };
  // Big anime eyes: each eye is drawn at its table size and scaled about its centre.
  const big = (side, svg) => { const c = EYE_C[side]; return `<g transform="translate(${c.x} ${c.y}) scale(${EYE_K}) translate(${-c.x} ${-c.y})">${svg}</g>`; };
  return big('L', one('L', kinds.L)) + big('R', one('R', kinds.R));
}

// ── Mouths ──────────────────────────────────────────────────

const MOUTH_FILL = '#9b2f45';
function mouth(kind, skin) {
  const ln = skin.line;
  switch (kind) {
    case 'open':
      return `<path d="M192.6 232Q200 233.6 207.4 232Q205 242 200 242.5Q195 242 192.6 232Z" fill="${MOUTH_FILL}" stroke="${ln}" stroke-width="1.5" stroke-linejoin="round"/>` +
        '<ellipse cx="200" cy="239.4" rx="4" ry="2.1" fill="#f27a8c"/>';
    case 'grin':
      return `<path d="M190 231.4Q200 234 210 231.4Q207 243 200 243.5Q193 243 190 231.4Z" fill="${MOUTH_FILL}" stroke="${ln}" stroke-width="1.5" stroke-linejoin="round"/>` +
        '<path d="M191.6 232.3Q200 234.5 208.4 232.3L207.8 234.4Q200 236.4 192.2 234.4Z" fill="#fff"/>';
    case 'o':
      return `<ellipse cx="200" cy="236" rx="3.4" ry="4" fill="${MOUTH_FILL}" stroke="${ln}" stroke-width="1.4"/>`;
    case 'cat':
      return stroke('M193 233.5q3.5 3.6 7 0q3.5 3.6 7 0', ln, 1.7);
    case 'small':
      return stroke('M196.6 234Q200 236.2 203.4 234', ln, 1.7);
    case 'pout':
      return stroke('M195.5 236.6Q200 232.6 204.5 236.6', ln, 1.8);
    case 'wavy':
      return stroke('M192.5 235q2.3-2.4 4.6 0t4.6 0t4.6 0', ln, 1.6);
    default:
      return stroke('M193 233Q200 238.6 207 233', ln, 1.8);
  }
}

// ── Brows ───────────────────────────────────────────────────

const BROWS = {
  neutral: [[-10, -25], [1, -28.5], [12, -26.5]],
  up: [[-10, -27], [1, -30.5], [12, -28.5]],
  worried: [[-10, -31], [1, -29], [12, -24.5]],
  angry: [[-10, -22.5], [1, -26], [12, -28.5]],
  raised: [[-10, -31], [1, -35], [12, -32]],
};

export function browsPiece(hair, expr) {
  const pts = BROWS[expr.brows] || BROWS.neutral;
  const svg = ['L', 'R'].map((side) => {
    const s = side === 'L' ? -1 : 1;
    return stroke(smooth(pts.map(([u, v]) => [u * 1.05, v * 1.1 - 2]).map(toXY(EYE_C[side], s)), false), hair.deep, 1.3, 'opacity=".6"');
  }).join('');
  return { bone: 'head', z: 452, depth: 1, key: 'brows', svg };
}

// ── Pieces ──────────────────────────────────────────────────

const FACE_PTS = [[200, 128], [232, 138], [250, 167], [249, 195], [239, 218], [222, 232], [206, 242], [200, 244], [194, 242], [178, 232], [161, 218], [151, 195], [150, 167], [168, 138]];

export function facePieces(skin, head = {}) {
  const width={soft:1.045,oval:.975,heart:1.01,defined:1}[head.face]||1;
  const face = smooth(FACE_PTS.map(([x,y])=>[200+(x-200)*width,y]));
  const ear = (x, s) => shape(`M${x} 196q${s * 8} -2 ${s * 8} 8q0 10 ${-s * 7} 11z`, skin.base, skin.line, 1.8) +
    stroke(`M${x + s * 1.5} 200q${s * 4} 0 ${s * 4} 5`, skin.line, 1, 'opacity=".5"');
  return [
    { bone: 'head', z: 399, depth: -0.15, svg: ear(150, -1) + ear(250, 1) },
    { bone: 'head', z: 400, depth: 0, svg: cel(face, skin.base, skin.line, 1.4, { dx: -4, dy: -2, shadow: skin.shadow }) + fillOnly('M160 212Q173 230 194 239Q176 234 162 221Z', skin.shadow, 'opacity=".35"') },
  ];
}

/** The expression layer. uid keeps clip and gradient ids unique per SVG. */
export function featuresPiece(head, skin, eye, exprName, uid) {
  const expr = EXPR[exprName] || EXPR.smile;
  const blushLevel = Math.max(head.blush || 0, expr.blush || 0);
  const grad = `<linearGradient id="bj-iris-${uid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${darken(eye, 0.45)}"/><stop offset=".5" stop-color="${eye}"/>` +
    `<stop offset="1" stop-color="${lighten(eye, 0.5)}"/></linearGradient>`;
  let svg = `<defs>${grad}</defs>`;
  if (blushLevel) {
    const op = blushLevel > 1 ? 0.8 : 0.38;
    svg += `<ellipse cx="174" cy="219" rx="12" ry="5.5" fill="url(#bj-blush)" opacity="${op}"/><ellipse cx="226" cy="219" rx="12" ry="5.5" fill="url(#bj-blush)" opacity="${op}"/>`;
    if (blushLevel > 1) svg += stroke('M168 226l3-4M173 226l3-4M178 226l3-4M222 226l3-4M227 226l3-4M232 226l3-4', '#ff5f8a', 1.1, 'opacity=".6"');
  }
  if (head.freckles) {
    svg += [[186, 222], [190.5, 225.5], [183, 226], [214, 222], [209.5, 225.5], [217, 226]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".95" fill="${skin.deep}" opacity=".6"/>`).join('');
  }
  if (head.mark === 'L' || head.mark === 'R') {
    svg += `<circle cx="${head.mark === 'L' ? 164 : 236}" cy="219" r="1.3" fill="${skin.line}"/>`;
  }
  svg += eyePair(head, eye, expr, uid);
  svg += fillOnly('M201 215L199 221L202 221Z', skin.shadow) + stroke('M201.4 218.4q1.3 2.1-1.4 2.6', skin.deep, 0.95);
  const rest = expr.mouth || head.mouth;
  svg += `<g transform="translate(0 -4)"><g class="bj-mouth-rest">${mouth(rest, skin)}</g><g class="bj-mouth-talk">${mouth('open', skin)}</g></g>`;
  if (expr.extra === 'sweat') {
    svg += `<path d="M247 176q-5 9 0 12q5-3 0-12z" fill="#bfe6ff" stroke="#6aa9d6" stroke-width="1.2"/>`;
  }
  if (expr.extra === 'puff') {
    svg += stroke('M157 226q-4 5 1 10M243 226q4 5 -1 10', skin.line, 1.4, 'opacity=".55"');
  }
  return { bone: 'head', z: 410, depth: 1, key: 'features', svg, look: expr.look || null };
}

export const exprOf = (name) => EXPR[name] || EXPR.smile;
