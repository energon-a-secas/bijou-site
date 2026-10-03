// ── Drawing helpers ──────────────────────────────────────────
// Colour mixing, smooth outlines and the fills every drawing shares. No body
// knowledge lives here: landmarks come from M (rig.js).

const INK = '#2b1631';

export const f1 = (n) => Math.round(n * 10) / 10;

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const darken = (hex, t = 0.18) => mix(hex, INK, t);
export const lighten = (hex, t = 0.3) => mix(hex, '#ffffff', t);
/** Outline colour: a deep tint of the fill, the cel-shaded line-art look. */
export const inkOf = (hex) => mix(hex, INK, 0.62);

/** Smooth closed (or open) path through points, Catmull-Rom to cubic Bezier. */
export function smooth(pts, closed = true, k = 0.5) {
  const n = pts.length;
  if (n < 3) return line(pts, closed);
  const P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1x = p1[0] + ((p2[0] - p0[0]) * k) / 3, c1y = p1[1] + ((p2[1] - p0[1]) * k) / 3;
    const c2x = p2[0] - ((p3[0] - p1[0]) * k) / 3, c2y = p2[1] - ((p3[1] - p1[1]) * k) / 3;
    d += `C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

export const line = (pts, closed = false) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join('') + (closed ? 'Z' : '');

/** Right-half points (x >= 200), top to bottom, mirrored into a full loop. */
export function mirror(half, cx = 200) {
  const left = half.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
  return half.concat(left);
}

/** A filled, outlined path. opts: { sw, stroke, extra } */
export function shape(d, fill, stroke, sw = 2, extra = '') {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${extra ? ` ${extra}` : ''}/>`;
}
export const fillOnly = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
export const stroke = (d, color, sw = 1.6, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;

/** Soft volume over any fill: light top-left, plum shadow bottom-right. */
export const shade = (d) => `<path d="${d}" fill="url(#bj-shade)" pointer-events="none"/>`;

/** A ribbon bow centred on (x, y), size r. */
export function bow(x, y, r, fill, ink, tilt = 0) {
  const loopL = smooth([[x, y], [x - r * 1.1, y - r * 0.75], [x - r * 1.25, y + r * 0.1], [x - r * 0.9, y + r * 0.55]]);
  const loopR = smooth([[x, y], [x + r * 1.1, y - r * 0.75], [x + r * 1.25, y + r * 0.1], [x + r * 0.9, y + r * 0.55]]);
  const tailL = line([[x - r * 0.15, y + r * 0.1], [x - r * 0.75, y + r * 1.3], [x - r * 0.35, y + r * 1.15], [x - r * 0.15, y + r * 1.45], [x + r * 0.05, y + r * 0.2]], true);
  const tailR = line([[x + r * 0.15, y + r * 0.1], [x + r * 0.75, y + r * 1.3], [x + r * 0.35, y + r * 1.15], [x + r * 0.15, y + r * 1.45], [x - r * 0.05, y + r * 0.2]], true);
  const knot = `<ellipse cx="${f1(x)}" cy="${f1(y + r * 0.05)}" rx="${f1(r * 0.32)}" ry="${f1(r * 0.38)}" fill="${fill}" stroke="${ink}" stroke-width="1.4"/>`;
  const g = [tailL, tailR, loopL, loopR].map((d) => shape(d, fill, ink, 1.4)).join('');
  const folds = stroke(`M${f1(x - r * 0.35)} ${f1(y - r * 0.1)}Q${f1(x - r * 0.7)} ${f1(y - r * 0.2)} ${f1(x - r * 0.9)} ${f1(y - r * 0.35)}M${f1(x + r * 0.35)} ${f1(y - r * 0.1)}Q${f1(x + r * 0.7)} ${f1(y - r * 0.2)} ${f1(x + r * 0.9)} ${f1(y - r * 0.35)}`, ink, 1, 'opacity=".55"');
  return `<g transform="rotate(${tilt} ${f1(x)} ${f1(y)})">${g}${folds}${knot}</g>`;
}

/** A five-point star path centred on (x, y). */
export function star(x, y, r, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return line(pts, true);
}

/** A heart path with its point at the bottom, centred on (x, y). */
export function heart(x, y, r) {
  return `M${f1(x)} ${f1(y + r * 0.9)}C${f1(x - r * 1.4)} ${f1(y - r * 0.1)} ${f1(x - r * 0.8)} ${f1(y - r * 1.1)} ${f1(x)} ${f1(y - r * 0.45)}C${f1(x + r * 0.8)} ${f1(y - r * 1.1)} ${f1(x + r * 1.4)} ${f1(y - r * 0.1)} ${f1(x)} ${f1(y + r * 0.9)}Z`;
}

// ── Shared defs and patterns ─────────────────────────────────

export const SHARED_DEFS = `
<linearGradient id="bj-shade" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
  <stop offset=".42" stop-color="#fff" stop-opacity="0"/>
  <stop offset="1" stop-color="#3a1446" stop-opacity=".26"/>
</linearGradient>
<radialGradient id="bj-blush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff6f9a" stop-opacity=".55"/>
  <stop offset="1" stop-color="#ff6f9a" stop-opacity="0"/>
</radialGradient>
<radialGradient id="bj-floor" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#2a1436" stop-opacity=".34"/>
  <stop offset="1" stop-color="#2a1436" stop-opacity="0"/>
</radialGradient>`;

/**
 * A fill for an item: a plain colour, or a url() into a pattern this returns.
 * Patterns use userSpaceOnUse, so they ride along with the bone's transform.
 */
export function fabric(id, kind, main, accent) {
  if (!kind) return { fill: main, def: '' };
  const pid = `pat-${id}`;
  const a = accent || darken(main, 0.25);
  let size = 14, body = '';
  switch (kind) {
    case 'dots':
      body = `<circle cx="4" cy="4" r="2.1" fill="${a}"/><circle cx="11" cy="11" r="2.1" fill="${a}"/>`;
      break;
    case 'stripes':
      size = 12; body = `<rect y="0" width="12" height="5" fill="${a}"/>`;
      break;
    case 'vstripes':
      size = 10; body = `<rect x="0" width="3" height="10" fill="${a}"/>`;
      break;
    case 'gingham':
      size = 12;
      body = `<rect width="6" height="12" fill="${a}" opacity=".45"/><rect width="12" height="6" fill="${a}" opacity=".45"/>`;
      break;
    case 'plaid':
      size = 20;
      body = `<rect x="0" width="5" height="20" fill="${a}" opacity=".5"/><rect y="0" width="20" height="5" fill="${a}" opacity=".5"/><rect x="12" width="1.4" height="20" fill="${lighten(main, 0.6)}" opacity=".7"/><rect y="12" width="20" height="1.4" fill="${lighten(main, 0.6)}" opacity=".7"/>`;
      break;
    case 'floral':
      size = 18;
      body = [[5, 5], [14, 13]].map(([x, y]) =>
        [0, 72, 144, 216, 288].map((r) => `<ellipse cx="${x}" cy="${y - 2.2}" rx="1.5" ry="2.3" fill="${a}" transform="rotate(${r} ${x} ${y})"/>`).join('') +
        `<circle cx="${x}" cy="${y}" r="1.2" fill="${lighten(a, 0.7)}"/>`).join('');
      break;
    case 'hearts':
      size = 16; body = `<path d="${heart(5, 5, 2.6)}" fill="${a}"/><path d="${heart(13, 13, 2.6)}" fill="${a}"/>`;
      break;
    case 'stars':
      size = 22; body = `<path d="${star(6, 6, 3)}" fill="${a}"/><path d="${star(16, 15, 2)}" fill="${a}" opacity=".8"/><circle cx="17" cy="4" r=".9" fill="${a}"/>`;
      break;
    case 'knit':
      size = 8; body = `<path d="M2 0v8M6 0v8" stroke="${a}" stroke-width="1" opacity=".35"/>`;
      break;
    case 'tropical':
      size = 26;
      body = `<path d="M6 18q6-12 14-12q-2 9-14 12z" fill="${a}"/><circle cx="20" cy="20" r="2.4" fill="${lighten(a, 0.5)}"/><circle cx="5" cy="5" r="1.6" fill="${lighten(a, 0.5)}"/>`;
      break;
    default:
      return { fill: main, def: '' };
  }
  const def = `<pattern id="${pid}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${main}"/>${body}</pattern>`;
  return { fill: `url(#${pid})`, def };
}
