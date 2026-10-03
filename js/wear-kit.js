// ── Garment kit ──────────────────────────────────────────────
// Shape builders every garment generator shares. Each reads landmarks from M
// (rig.js) and returns path data in rest coordinates, so one garment fits every
// height and build, and follows the limbs through every pose.

import { f1, smooth, line, shape, fillOnly, stroke, shade, mirror, darken, lighten, inkOf, fabric, cel } from './paint.js';

export function paintOf(item) {
  const c = item.colors || {};
  const main = c.main || '#ffffff';
  const { fill, def } = fabric(item.id, item.pattern, main, c.pattern);
  return {
    main, fill, def, ink: inkOf(main), shadow: darken(main, 0.16),
    trim: c.trim || lighten(main, 0.65), accent: c.accent || darken(main, 0.22),
  };
}

/** A filled, cel-shaded, outlined garment shape. */
export const cloth = (d, p, sw = 2) => cel(d, p.fill, p.ink, sw);
/** The same with a side-only shadow, for limb pieces that meet at a joint. */
export const limb = (d, p, sw = 2) => cel(d, p.fill, p.ink, sw, { dx: -4.5, dy: 0 });

export function hemY(M, len) {
  const map = {
    micro: M.hipY + 36, mini: M.hipY + 54, short: M.hipY + 80, knee: M.kneeY - 4,
    midi: M.kneeY + 54, long: M.ankleY - 24, floor: M.ground - 3,
  };
  return map[len] ?? M.kneeY;
}

// ── Bodice ──────────────────────────────────────────────────

const STRAP_NECKS = new Set(['square', 'sweetheart', 'straight', 'halter']);
export const isStrapNeck = (neck) => STRAP_NECKS.has(neck);

/**
 * The torso part of a top or dress.
 * o: { neck, hem, ease, loose, flare, hemCurve }
 * Returns { d, half, top } where top is the neckline's lowest centre y.
 */
export function bodice(M, o = {}) {
  const sY = M.shoulderY, ease = o.ease ?? 2, loose = o.loose ?? 0;
  const hem = o.hem ?? M.waistY + 10, armY = sY + 24;
  const hw = (y) => M.torsoHW(y) + ease + loose * Math.max(0, Math.min(1, (y - armY) / Math.max(1, hem - armY)));
  let neck;
  switch (o.neck) {
    case 'scoop': neck = [[200, sY + 28], [210, sY + 24], [217, sY + 12], [220, sY - 1, 1]]; break;
    case 'v': neck = [[200, sY + 36, 1], [208, sY + 19], [215, sY + 2], [217, sY - 3, 1]]; break;
    case 'square': neck = [[200, sY + 22], [214, sY + 22, 1]]; break;
    case 'sweetheart': neck = [[200, M.chestY - 9, 1], [207, M.chestY - 18], [216, M.chestY - 20], [226, M.chestY - 13]]; break;
    case 'straight': neck = [[200, M.chestY - 15], [214, M.chestY - 16]]; break;
    case 'halter': neck = [[200, M.chestY - 3, 1], [209, M.chestY - 14], [219, M.chestY - 18]]; break;
    case 'boat': neck = [[200, sY + 4], [212, sY + 2], [222, sY, 1]]; break;
    default: neck = [[200, sY + 9], [208, sY + 7], [213, sY + 1], [215, sY - 4, 1]];
  }
  const half = [...neck];
  if (STRAP_NECKS.has(o.neck)) half.push([200 + hw(armY + 6), armY + 6, 1]);
  else half.push([200 + 43 + ease * 0.5, sY + 5], [200 + 42 + ease, sY + 14]);
  for (const y of [M.chestY - 6, M.chestY + 4, M.chestY + 20, M.waistY, M.waistY + 26, M.hipY - 4, M.hipY + 14, M.hipY + 40]) {
    if (y > armY + 8 && y < hem - 6) half.push([200 + hw(y), y]);
  }
  half.push([200 + hw(hem) + (o.flare || 0), hem, 1]);
  half.push([200, hem + (o.hemCurve ?? 2)]);
  return { d: smooth(mirror(half)), half, top: neck[0][1], hem };
}

/** Thin straps from a strap neckline over the shoulders. */
export function straps(M, o, p, w = 4) {
  const sY = M.shoulderY;
  const from = o.neck === 'halter' ? [[211, M.chestY - 15], [204, sY - 8]] : [[212, (o.top ?? sY + 22) + 1], [220, sY - 3]];
  const d = ['', ''].map((_, i) => {
    const s = i ? 1 : -1;
    return `M${f1(200 + s * (from[0][0] - 200))} ${f1(from[0][1])}Q${f1(200 + s * (from[0][0] - 196))} ${f1((from[0][1] + from[1][1]) / 2)} ${f1(200 + s * (from[1][0] - 200))} ${f1(from[1][1])}`;
  }).join('');
  return stroke(d, p.ink, w + 2.2) + stroke(d, p.trim === p.main ? p.main : p.main, w);
}

// ── Collars and trims ───────────────────────────────────────

export function collar(M, kind, p, color = '#ffffff') {
  const sY = M.shoulderY;
  const ink = inkOf(color);
  if (kind === 'peter') {
    const half = [[201, sY + 9], [208, sY + 3], [215, sY - 3], [226, sY + 5], [222, sY + 18], [207, sY + 17]];
    const L = half.map(([x, y]) => [400 - x, y]);
    return shape(smooth(half), color, ink, 1.7) + shape(smooth(L), color, ink, 1.7);
  }
  if (kind === 'sailor') {
    const half = [[201, sY + 44, 1], [214, sY - 3, 1], [238, sY + 6], [233, sY + 28, 1]];
    const fill = p.accent;
    const tr = (pts) => line(pts, true);
    const R = tr(half), Lp = tr(half.map(([x, y]) => [400 - x, y]));
    const stripe = (s) => line([[200 + s * 5, sY + 38], [200 + s * 15, sY + 2], [200 + s * 35, sY + 9], [200 + s * 31, sY + 24]]);
    return shape(R, fill, inkOf(fill), 1.8) + shape(Lp, fill, inkOf(fill), 1.8) +
      stroke(stripe(1) + stripe(-1), '#ffffff', 1.6);
  }
  if (kind === 'shirt') {
    const half = [[201, sY + 8, 1], [213, sY - 5], [228, sY + 3, 1], [212, sY + 16, 1]];
    return shape(line(half, true), color, ink, 1.7) + shape(line(half.map(([x, y]) => [400 - x, y]), true), color, ink, 1.7);
  }
  return '';
}

/** Scalloped lace or frill along a horizontal line from x0 to x1 at y. */
export function scallops(x0, x1, y, r, fill, ink, sw = 1.2) {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / (r * 2)));
  const step = (x1 - x0) / n;
  let d = `M${f1(x0)} ${f1(y - r * 0.6)}`;
  for (let i = 0; i < n; i++) d += `Q${f1(x0 + step * (i + 0.5))} ${f1(y + r * 1.25)} ${f1(x0 + step * (i + 1))} ${f1(y - r * 0.6)}`;
  d += `L${f1(x1)} ${f1(y - r * 1.4)}L${f1(x0)} ${f1(y - r * 1.4)}Z`;
  return shape(d, fill, ink, sw);
}

// ── Sleeves ─────────────────────────────────────────────────

const at = (A, s) => ([u, v]) => [A.x + s * u, A.y + v];

/**
 * Sleeve pieces for both arms. o: { len, puff, cuff, ease, z }
 * len: cap | puff | short | elbow | long | bell | wide
 */
export function sleeves(M, o, p) {
  const out = [];
  const z = o.z ?? 310, ease = o.ease ?? 2.2, len = o.len || 'short';
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const P = M.shoulder[side], L = M.upperArm, F = M.foreArm;
    const hw = (t) => M.armHW(t * 0.52) + ease;
    const pu = at(P, s);
    const top = hw(0) + 2.4;
    let upEnd, upHem, bulge = 0;
    if (len === 'cap') { upEnd = 0.3; upHem = hw(0.3) + 1.5; }
    else if (len === 'puff') { upEnd = 0.44; upHem = hw(0.44) + 1; bulge = 6 + 6 * (o.puff ?? 1); }
    else if (len === 'short') { upEnd = 0.56; upHem = hw(0.56) + 3.5; }
    else if (len === 'wide') { upEnd = 1.04; upHem = 15; bulge = 3; }
    else { upEnd = 1.04; upHem = hw(1) + (len === 'elbow' ? 3 : 0.8); }
    const yEnd = L * upEnd;
    const outer = [[0, -top], [top, -1], [top + bulge * 0.9, L * 0.16], [Math.max(upHem, hw(upEnd * 0.6) + bulge * 0.4), yEnd * 0.62], [upHem, yEnd, 1]];
    const inner = [[-upHem, yEnd, 1], [-(hw(upEnd * 0.5) + bulge * 0.35), yEnd * 0.5], [-(top - 0.8), 5]];
    const d = smooth(outer.concat(inner).map(pu));
    let svg = limb(d, p, 2);
    if (len === 'puff') {
      svg += stroke(smooth([[-upHem, yEnd - 3], [0, yEnd - 1.5], [upHem, yEnd - 3]].map(pu), false), p.ink, 1.1, 'opacity=".55"');
      svg += stroke(smooth([[-4, 4], [-3, yEnd * 0.6]].map(pu), false) + smooth([[4, 3], [5, yEnd * 0.62]].map(pu), false), p.ink, 1, 'opacity=".35"');
    }
    if (o.cuff && (len === 'puff' || len === 'short' || len === 'cap')) {
      svg += shape(line([[-upHem - 0.5, yEnd - 4], [upHem + 0.5, yEnd - 4], [upHem + 0.5, yEnd + 1], [-upHem - 0.5, yEnd + 1]].map(pu), true), p.trim, inkOf(p.trim), 1.4);
    }
    out.push({ bone: `upperArm${side}`, z, svg });

    if (['elbow', 'long', 'bell', 'wide'].includes(len)) {
      const E = M.elbow[side], pf = at(E, s);
      const fh = (t) => M.armHW(0.52 + t * 0.48) + ease;
      let fEnd, wristHW;
      if (len === 'elbow') { fEnd = 0.16; wristHW = fh(0.16) + 3.5; }
      else if (len === 'bell') { fEnd = 1.02; wristHW = 13; }
      else if (len === 'wide') { fEnd = 1.1; wristHW = 18; }
      else { fEnd = 1.0; wristHW = fh(1) + 1; }
      const yF = F * fEnd;
      const cap = fh(0) + 0.6;
      let fpts;
      if (len === 'wide') {
        // A hanging kimono sleeve: the inside drops into a deep pocket.
        fpts = [[0, -cap], [16, -1], [17, yF * 0.6], [wristHW, yF, 1], [-6, yF + 2], [-16, yF + 30, 1], [-17, yF * 0.4], [-15, 2]];
      } else {
        fpts = [[0, -cap], [cap, 0], [Math.max(fh(0.4), wristHW * 0.6), yF * 0.45], [wristHW, yF, 1], [-wristHW, yF, 1], [-Math.max(fh(0.4), wristHW * 0.6) * 0.96, yF * 0.45], [-cap, 0]];
      }
      let fsvg = limb(smooth(fpts.map(pf)), p, 2);
      if (o.cuff && (len === 'long' || len === 'bell')) {
        fsvg += shape(line([[-wristHW - 0.4, yF - 5], [wristHW + 0.4, yF - 5], [wristHW + 0.4, yF + 0.5], [-wristHW - 0.4, yF + 0.5]].map(pf), true), p.trim, inkOf(p.trim), 1.4);
      }
      if (len === 'bell') fsvg += stroke(smooth([[-3, yF * 0.35], [-6, yF - 2]].map(pf), false) + smooth([[3, yF * 0.35], [6, yF - 2]].map(pf), false), p.ink, 1, 'opacity=".4"');
      out.push({ bone: `foreArm${side}`, z: z + 1, svg: fsvg });
    }
  }
  return out;
}

// ── Skirts ──────────────────────────────────────────────────

/**
 * A skirt on the skirt bone (pivot at the waist), plus the darker inside that
 * shows through the hem's hollows. o: { top, len, flare, pleats, tiers, lace, band, z }
 */
export function skirt(M, o, p) {
  const topY = o.topY ?? (o.top === 'high' ? M.waistY - 10 : o.top === 'hip' ? M.waistY + 22 : M.waistY - 2);
  const hem = o.hem ?? hemY(M, o.len);
  const flare = o.flare ?? 0.5;
  const topHW = M.torsoHW(topY) + 2.2;
  const hipHW = M.torsoHW(M.hipY) + 3 + flare * 9;
  // Flare grows with length, but levels off so a floor-length gown stays a gown.
  const run = hem - M.hipY;
  const hemHW = Math.max(hipHW, topHW) + 5 + flare * Math.min(run, 150 + Math.max(0, run - 150) * 0.35) * 0.42;
  const z = o.z ?? 180;
  const folds = o.pleats ? Math.max(6, Math.round(hemHW / 9)) : 4 + Math.round(flare * 4);
  // Hem: alternating crests and hollows, a zigzag when pleated.
  const hemPts = [];
  for (let i = 0; i <= folds * 2; i++) {
    const x = 200 + hemHW - (i / (folds * 2)) * hemHW * 2;
    const crest = i % 2 === 0;
    hemPts.push([x, hem + (o.pleats ? (crest ? 2 : -3) : (crest ? 3 : -4 * (0.4 + flare))), o.pleats ? 1 : 0]);
  }
  hemPts[0][2] = 1; hemPts[hemPts.length - 1][2] = 1;
  // A bell, not a cone: the skirt swings out below the hip, then falls.
  const rightSide = [[200 + topHW, topY, 1], [200 + (topHW + hipHW) / 2 + flare * 2, (topY + M.hipY) / 2], [200 + hipHW, M.hipY + 4]];
  if (run > 60) rightSide.push([200 + hipHW + (hemHW - hipHW) * 0.62, M.hipY + run * 0.3]);
  if (run > 140) rightSide.push([200 + hipHW + (hemHW - hipHW) * 0.9, M.hipY + run * 0.65]);
  const leftSide = rightSide.slice().reverse().map(([x, y, c]) => [400 - x, y, c]);
  const pts = [[200, topY + 1.5], ...rightSide, ...hemPts, ...leftSide];
  const d = smooth(pts);
  const out = [];
  const inside = smooth([[200 - hipHW + 6, M.hipY + 24], [200 + hipHW - 6, M.hipY + 24], [200 + hemHW - 9, hem + 5, 1], [200 - hemHW + 9, hem + 5, 1]]);
  out.push({ bone: 'skirt', z: 24, svg: fillOnly(inside, darken(p.main, 0.38)) + stroke(inside, p.ink, 1.6) });
  let svg = cloth(d, p, 2);
  // Fold lines run from under the waist down to each hollow.
  let foldsD = '';
  for (let i = 1; i < folds * 2; i += 2) {
    const [hx, hy] = hemPts[i];
    const tx = 200 + (hx - 200) * (o.pleats ? 0.62 : 0.4);
    foldsD += `M${f1(tx)} ${f1(topY + (hem - topY) * (o.pleats ? 0.08 : 0.32))}L${f1(hx)} ${f1(hy)}`;
  }
  svg += stroke(foldsD, p.ink, o.pleats ? 1.2 : 1.1, `opacity="${o.pleats ? 0.5 : 0.38}"`);
  if (o.tiers) {
    for (let k = 1; k < o.tiers; k++) {
      const y = topY + (hem - topY) * (k / o.tiers);
      const w = topHW + (hemHW - topHW) * (k / o.tiers);
      svg += scallops(200 - w, 200 + w, y + 3, 5, p.fill, p.ink, 1.3);
    }
  }
  if (o.lace) svg += scallops(200 - hemHW + 2, 200 + hemHW - 2, hem + 5, 4, o.lace, inkOf(o.lace), 1.1);
  if (o.circuit) svg += circuit(hemHW - 10, hem - 34, hem - 8, o.circuit);
  if (o.band !== false) {
    const bh = o.band === 'wide' ? 12 : 6;
    svg += shape(line([[200 - topHW, topY, 1], [200 + topHW, topY, 1], [200 + M.torsoHW(topY + bh) + 2.6, topY + bh], [200 - M.torsoHW(topY + bh) - 2.6, topY + bh]], true), o.bandColor || p.accent, inkOf(o.bandColor || p.accent), 1.5);
  }
  out.push({ bone: 'skirt', z, svg });
  return out;
}

/** Gold circuit traces across a hem band, deterministic so every render agrees. */
function circuit(halfW, y0, y1, color) {
  let d = '', dots = '';
  const n = Math.max(6, Math.round(halfW / 9));
  for (let i = 0; i <= n; i++) {
    const x = 200 - halfW + (i / n) * halfW * 2;
    const k = (i * 37) % 11, top = y0 + (k % 4) * 4, turn = (k % 2 ? 1 : -1) * (4 + (k % 3) * 2);
    d += `M${f1(x)} ${f1(y1)}V${f1(top + 6)}l${turn} -6`;
    dots += `<circle cx="${f1(x + turn)}" cy="${f1(top)}" r="1.5" fill="none" stroke="${color}" stroke-width="1"/>`;
    if (i < n && k > 5) d += `M${f1(x)} ${f1(y1 - 6)}h${f1(halfW * 2 / n * 0.6)}`;
  }
  return stroke(`M${f1(200 - halfW)} ${f1(y1)}H${f1(200 + halfW)}` + d, color, 1.1, 'opacity=".9"') + dots;
}

// ── Trousers and shorts ─────────────────────────────────────

/** Hip piece on the root, legs on the thighs and shins. o: { len, wide, cuff, rise, z } */
export function pants(M, o, p) {
  const z = o.z ?? 180;
  const topY = o.rise === 'high' ? M.waistY - 8 : M.waistY + 4;
  const ys = [topY, M.waistY + 28, M.hipY - 4, M.hipY + 14].filter((y) => y >= topY);
  const half = [[200, topY], ...ys.map((y, i) => [200 + M.torsoHW(y) + 2.6, y, i === 0 ? 1 : 0]), [208, M.hipY + 29], [200, M.hipY + 31, 1]];
  const out = [{ bone: 'root', z, svg: cloth(smooth(mirror(half)), p, 2) + stroke(`M200 ${f1(topY + 8)}V${f1(M.hipY + 22)}`, p.ink, 1.1, 'opacity=".45"') +
    shape(line([[200 - M.torsoHW(topY) - 2.6, topY, 1], [200 + M.torsoHW(topY) + 2.6, topY, 1], [200 + M.torsoHW(topY + 7) + 2.6, topY + 7], [200 - M.torsoHW(topY + 7) - 2.6, topY + 7]], true), p.accent, inkOf(p.accent), 1.4) }];
  const wide = o.wide ?? 0;
  const lenT = { short: 0.24, mid: 0.52, capri: 1, long: 1 }[o.len || 'long'];
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const H = M.hip[side], K = M.knee[side];
    const c = (t) => ({ x: H.x + (K.x - H.x) * t, y: H.y + (K.y - H.y) * t });
    const w = (t) => M.thighHW(t) + 3 + wide * t * 4 + (o.len === 'short' ? 3 : 0);
    const tEnd = Math.min(1.04, lenT);
    const e = c(tEnd);
    const pts = [[H.x + s * (w(0) + 1), H.y - 10], [c(0.4).x + s * w(0.4), c(0.4).y], [e.x + s * w(tEnd), e.y, 1], [e.x - s * w(tEnd), e.y, 1], [c(0.3).x - s * w(0.3), c(0.3).y], [H.x - s * (w(0) - 2), H.y - 4]];
    let svg = limb(smooth(pts), p, 2);
    if (o.cuff && lenT < 1) svg += shape(line([[e.x - s * (w(tEnd) + 1), e.y - 6], [e.x + s * (w(tEnd) + 1), e.y - 6], [e.x + s * (w(tEnd) + 1), e.y + 1], [e.x - s * (w(tEnd) + 1), e.y + 1]], true), p.trim, inkOf(p.trim), 1.4);
    out.push({ bone: `thigh${side}`, z: 130, svg });
    if (lenT >= 1) {
      const A = M.ankle[side];
      const tS = o.len === 'capri' ? 0.6 : 1.02;
      const cs = (t) => ({ x: K.x + (A.x - K.x) * t, y: K.y + (A.y - K.y) * t });
      const sw = (t) => M.shinHW(Math.min(t, 1)) + 3.2 + wide * (2 + t * 9);
      const end = cs(tS);
      const sp = [[K.x + s * (sw(0) + 0.6), K.y - 8], [cs(0.4).x + s * sw(0.4), cs(0.4).y], [end.x + s * sw(tS), end.y, 1], [end.x - s * sw(tS), end.y, 1], [cs(0.4).x - s * sw(0.4) * 0.94, cs(0.4).y], [K.x - s * (sw(0) + 0.4), K.y - 8]];
      out.push({ bone: `shin${side}`, z: 131, svg: limb(smooth(sp), p, 2) + stroke(line([[K.x + s * 2, K.y + 10], [end.x + s * 3, end.y - 4]]), p.ink, 1, 'opacity=".3"') });
    }
  }
  return out;
}

// ── Legs, for socks, tights and boots ──────────────────────

/** Outline of a thigh or shin segment between t0 and t1, eased outward. */
export function legSegment(M, side, part, t0, t1, ease = 0.8) {
  const s = side === 'L' ? -1 : 1;
  const [A, B, hwf] = part === 'thigh' ? [M.hip[side], M.knee[side], M.thighHW] : [M.knee[side], M.ankle[side], M.shinHW];
  const c = (t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const k = part === 'shin' ? (t) => (t > 0.15 && t < 0.6 ? 1.06 : 1) : () => 1;
  const ts = [t0, (t0 * 2 + t1) / 3, (t0 + t1 * 2) / 3, t1];
  const outer = ts.map((t) => { const q = c(t); return [q.x + s * (hwf(t) * k(t) + ease), q.y]; });
  const inner = ts.slice().reverse().map((t) => { const q = c(t); return [q.x - s * (hwf(t) * 0.94 + ease), q.y]; });
  outer[0][2] = 1; outer[outer.length - 1][2] = 1; inner[0][2] = 1; inner[inner.length - 1][2] = 1;
  return { pts: outer.concat(inner), top: c(t0), bottom: c(t1), hw: (t) => hwf(t) + ease };
}

/** The foot outline used by socks and shoes, eased outward. */
export function footPts(M, side, ease = 1) {
  const s = side === 'L' ? -1 : 1, p = at(M.ankle[side], s);
  return [[-5.4 - ease, -7], [5.4 + ease, -7], [6.2 + ease, 6], [8.6 + ease, 20], [8.8 + ease, 27.5], [6 + ease, 33 + ease * 0.4], [1, 34.4 + ease * 0.6], [-4 - ease, 33.3 + ease * 0.4], [-7.1 - ease, 28], [-7 - ease, 18], [-5.8 - ease, 6]].map(p);
}

export { at, smooth, line, shape, fillOnly, stroke, shade, mirror, darken, lighten, inkOf, f1, cel };
