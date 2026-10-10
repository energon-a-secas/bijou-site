// ── Clothes ──────────────────────────────────────────────────
// Garment generators by kind, the base slip, and the outfit compositor.
// Slots and conflicts are docs/RIG.md section 5; the slip is section 5's last
// paragraph and is not optional.

import { itemById, resolvedItem } from './catalog.js';
import {
  paintOf, cloth, bodice, straps, collar, scallops, sleeves, skirt, pants, hemY,
  smooth, line, shape, fillOnly, stroke, mirror, inkOf, darken, lighten, f1,
} from './wear-kit.js';
import { bow, heart } from './paint.js';
import { legwearPieces, shoePieces } from './wear-legs.js';
import { accessoryPieces } from './wear-acc.js';
import { costumePieces } from './wear-costume.js';

const ORDER = ['legwear', 'shoes', 'swim', 'bottom', 'top', 'dress', 'outer', 'neck', 'wrist', 'glasses', 'hat', 'hairacc', 'held'];

// ── The base slip: drawn whenever no dress or swimwear is on ──

const SLIP = { id: 'base-slip', colors: { main: '#f6efff', trim: '#ffffff', accent: '#cdb8f2' } };

function baseSlip(M, { top, bottom }) {
  const p = paintOf(SLIP);
  const out = [];
  if (bottom) out.push(...skirt(M, { top: 'waist', len: 'mini', flare: 0.3, lace: '#ffffff', band: false, z: 160 }, p));
  if (top) {
    const b = bodice(M, { neck: 'square', hem: M.waistY + 12, ease: 1.4 });
    out.push({
      bone: 'spine', z: 161,
      svg: cloth(b.d, p) + scallops(186, 214, b.top + 2, 2.6, '#ffffff', '#b9a6dc', 1) +
        straps(M, { neck: 'square', top: b.top }, p, 2.6) + bow(200, b.top + 4, 4.5, '#cdb8f2', '#7d64ab'),
    });
  }
  return out;
}

// ── Dresses and tops ────────────────────────────────────────

function dress(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const waist = o.waist === 'empire' ? M.chestY + 16 : M.waistY;
  const b = bodice(M, { neck: o.neck, hem: waist + 6, ease: 2 });
  const out = [];
  if (o.petticoat) {
    out.push(...skirt(M, { topY: waist, hem: hemY(M, o.len) + 7, flare: (o.flare ?? 0.5) + 0.05, band: false, lace: '#ffffff', z: 197 },
      paintOf({ id: `${item.id}-pc`, colors: { main: '#ffffff' } })));
  }
  out.push(...skirt(M, { topY: waist, len: o.len, flare: o.flare, pleats: o.pleats, tiers: o.tiers, lace: o.lace, band: false, z: 199 }, p));
  let top = cloth(b.d, p);
  if (o.neck && ['square', 'sweetheart', 'straight', 'halter'].includes(o.neck)) top += straps(M, { neck: o.neck, top: b.top }, p, 3.4);
  if (o.lace) top += scallops(200 - (o.neck === 'square' ? 14 : 10), 200 + (o.neck === 'square' ? 14 : 10), b.top + 2, 2.6, o.lace, inkOf(o.lace), 1);
  if (o.collar) top += collar(M, o.collar, p, p.trim);
  if (o.obi) {
    const y0 = M.waistY - 14, y1 = M.waistY + 10;
    top += shape(line([[200 - M.torsoHW(y0) - 3, y0, 1], [200 + M.torsoHW(y0) + 3, y0, 1], [200 + M.torsoHW(y1) + 3, y1, 1], [200 - M.torsoHW(y1) - 3, y1, 1]], true), o.obi, inkOf(o.obi), 1.8) +
      stroke(`M${f1(200 - M.torsoHW(M.waistY) - 2)} ${f1(M.waistY - 2)}H${f1(200 + M.torsoHW(M.waistY) + 2)}`, lighten(o.obi, 0.5), 2);
    top += stroke(`M200 ${f1(M.shoulderY + 9)}L${f1(214)} ${f1(M.waistY - 14)}`, p.ink, 1.6);
  }
  if (o.belt) top += shape(line([[200 - M.torsoHW(waist) - 2.4, waist - 3, 1], [200 + M.torsoHW(waist) + 2.4, waist - 3, 1], [200 + M.torsoHW(waist + 5) + 2.4, waist + 5, 1], [200 - M.torsoHW(waist + 5) - 2.4, waist + 5, 1]], true), o.belt, inkOf(o.belt), 1.4);
  if (o.bow && o.bowAt !== 'waist') top += bow(200, b.top + 8, 7, o.bow, inkOf(o.bow));
  if (o.bow && o.bowAt === 'waist') out.push({ bone: 'spine', z: 202, svg: bow(200, waist + 1, 9, o.bow, inkOf(o.bow)) });
  if (o.apron) {
    const a = smooth(mirror([[200, waist + 2], [222, waist + 2, 1], [228, hemY(M, o.len) - 18, 1], [200, hemY(M, o.len) - 14]]));
    out.push({ bone: 'skirt', z: 201, svg: shape(a, '#ffffff', '#9a8ca8', 1.6) + scallops(172, 228, hemY(M, o.len) - 15, 3, '#ffffff', '#9a8ca8', 1) });
  }
  if (o.stars) top += [[188, M.chestY], [214, M.chestY + 30]].map(([x, y]) => `<circle cx="${x}" cy="${f1(y)}" r="1.3" fill="#fff"/>`).join('');
  out.push({ bone: 'spine', z: 200, svg: top });
  if (o.sleeve && o.sleeve !== 'none') out.push(...sleeves(M, { len: o.sleeve, puff: o.puff, cuff: o.cuff }, p));
  return out;
}

function topGen(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const hem = { crop: M.waistY - 6, waist: M.waistY + 14, hip: M.hipY + 6, tunic: M.hipY + 30 }[o.hem || 'waist'];
  const b = bodice(M, { neck: o.neck, hem, ease: o.ease ?? 2.4, loose: o.loose || 0, hemCurve: o.hem === 'hip' ? 3 : 2 });
  const out = [];
  let svg = cloth(b.d, p);
  if (['square', 'sweetheart', 'straight', 'halter'].includes(o.neck)) svg += straps(M, { neck: o.neck, top: b.top }, p, 3.4);
  if (o.knit) svg += stroke(`M${f1(200 - M.torsoHW(hem) - 4)} ${f1(hem - 7)}H${f1(200 + M.torsoHW(hem) + 4)}`, p.ink, 1.1, 'opacity=".5"');
  if (o.collar) svg += collar(M, o.collar, p, p.trim);
  if (o.ruffle) svg += scallops(184, 216, b.top + 4, 3.2, p.trim, inkOf(p.trim), 1.1);
  if (o.pocket) {
    const y0 = M.waistY + 2, y1 = Math.min(hem - 6, M.waistY + 30);
    svg += shape(smooth([[178, y1, 1], [181, y0, 1], [219, y0, 1], [222, y1, 1]]), p.fill, p.ink, 1.5) + stroke(`M178 ${f1(y1)}Q200 ${f1(y1 + 3)} 222 ${f1(y1)}`, p.ink, 1.1, 'opacity=".5"');
  }
  if (o.strings) svg += stroke(`M195 ${f1(b.top + 2)}l-2 30M205 ${f1(b.top + 2)}l2 30`, p.trim, 2);
  if (o.tie) {
    // A ribbon tie under the collar: a bow with two long tails.
    const y = M.shoulderY + 12, ink = inkOf(o.tie);
    const tails = `M198 ${f1(y + 2)}L190 ${f1(y + 34)}L195 ${f1(y + 31)}L197 ${f1(y + 36)}L201 ${f1(y + 3)}ZM202 ${f1(y + 2)}L211 ${f1(y + 32)}L206 ${f1(y + 30)}L204 ${f1(y + 35)}L199 ${f1(y + 3)}Z`;
    svg += shape(tails, o.tie, ink, 1.2) + bow(200, y, 7.5, o.tie, ink);
  }
  if (o.bow) svg += bow(200, b.top + 9, 7, o.bow, inkOf(o.bow));
  if (o.heart) svg += `<path d="${heart(212, M.chestY + 4, 6)}" fill="${o.heart}" stroke="${inkOf(o.heart)}" stroke-width="1.2"/>`;
  out.push({ bone: 'spine', z: o.layer === 'over' ? 236 : 200, svg });
  if (o.hood) out.push(hood(M, p, o.ears));
  if (o.sleeve && o.sleeve !== 'none') out.push(...sleeves(M, { len: o.sleeve, puff: o.puff, cuff: o.cuff, ease: o.loose ? 3.4 : 2.2 }, p));
  return out;
}

/** A hood lying behind the neck; bunny ears flop out over the shoulders. */
function hood(M, p, ears) {
  const sY = M.shoulderY;
  const d = smooth([[164, sY + 2], [168, M.chinY - 6], [200, M.chinY - 14], [232, M.chinY - 6], [236, sY + 2], [222, sY + 14], [178, sY + 14]]);
  let svg = shape(d, darken(p.main, 0.12), p.ink, 2);
  if (ears) {
    svg = shape(smooth([[170, sY - 6], [148, sY - 14], [132, sY + 4], [146, sY + 16], [170, sY + 6]]), p.main, p.ink, 1.8) +
      shape(smooth([[230, sY - 6], [252, sY - 14], [268, sY + 4], [254, sY + 16], [230, sY + 6]]), p.main, p.ink, 1.8) +
      fillOnly(smooth([[166, sY - 3], [150, sY - 8], [140, sY + 4], [150, sY + 10], [166, sY + 4]]), '#ffc4d8') +
      fillOnly(smooth([[234, sY - 3], [250, sY - 8], [260, sY + 4], [250, sY + 10], [234, sY + 4]]), '#ffc4d8') + svg;
  }
  return { bone: 'spine', z: 26, svg };
}

// ── Bottoms ─────────────────────────────────────────────────

function skirtGen(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const out = skirt(M, { top: o.top, len: o.len, flare: o.flare, pleats: o.pleats, tiers: o.tiers, lace: o.lace, circuit: o.circuit, band: o.band ?? true, bandColor: o.bandColor }, p);
  if (o.bib) {
    const y1 = M.chestY - 6, y0 = M.waistY - 2;
    const bib = shape(line([[184, y1, 1], [216, y1, 1], [214, y0, 1], [186, y0, 1]], true), p.fill, p.ink, 1.8);
    const st = `M186 ${f1(y1 + 2)}L176 ${f1(M.shoulderY + 4)}M214 ${f1(y1 + 2)}L224 ${f1(M.shoulderY + 4)}`;
    out.push({
      bone: 'spine', z: 235,
      svg: bib + stroke(st, p.ink, 6.2) + stroke(st, p.main, 4) +
        `<circle cx="188" cy="${f1(y1 + 4)}" r="2.6" fill="#ffe08a" stroke="${p.ink}" stroke-width="1"/><circle cx="212" cy="${f1(y1 + 4)}" r="2.6" fill="#ffe08a" stroke="${p.ink}" stroke-width="1"/>` +
        (o.heart ? `<path d="${heart(200, (y0 + y1) / 2, 6)}" fill="${o.heart}" stroke="${inkOf(o.heart)}" stroke-width="1.1"/>` : ''),
    });
  }
  return out;
}

function pantsGen(item, M) {
  const o = item.params || {};
  return pants(M, o, paintOf(item));
}

// ── Swimwear ────────────────────────────────────────────────

function swim2(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const out = [];
  const y0 = M.chestY - 15, y1 = M.chestY + 11;
  const hw = (y) => M.torsoHW(y) + 1.6;
  if (o.top === 'tank') {
    const b = bodice(M, { neck: 'square', hem: M.waistY + 4, ease: 1.6 });
    out.push({ bone: 'spine', z: 170, svg: cloth(b.d, p) + straps(M, { neck: 'square', top: b.top }, p, 3) + (o.frill ? scallops(200 - hw(M.waistY) - 2, 200 + hw(M.waistY) + 2, M.waistY + 6, 4, p.trim, inkOf(p.trim), 1.1) : '') });
  } else {
    const dip = o.top === 'halter' ? 6 : 3;
    const band = smooth([[200, y0 + dip], [208, y0 - 1], [200 + hw(y0) * 0.75, y0 - 2], [200 + hw(y0), y0 + 2, 1], [200 + hw(y1), y1, 1], [200, y1 + 1.5], [200 - hw(y1), y1, 1], [200 - hw(y0), y0 + 2, 1], [200 - hw(y0) * 0.75, y0 - 2], [192, y0 - 1]]);
    let svg = cloth(band, p);
    if (o.frill) svg += scallops(200 - hw(y0) - 3, 200 + hw(y0) + 3, y0 + 13, 4.4, p.trim, inkOf(p.trim), 1.1);
    if (o.top === 'halter') svg += straps(M, { neck: 'halter' }, p, 3.2);
    else svg += straps(M, { neck: 'straight', top: y0 - 1 }, p, 2.8);
    if (o.bow) svg += bow(200, y0 + 6, 5.5, o.bow, inkOf(o.bow));
    out.push({ bone: 'spine', z: 170, svg });
  }
  // Bottom: high-waisted, a brief, or a brief with a little skirt over it.
  const topY = o.bottom === 'high' ? M.waistY - 2 : M.waistY + 22;
  const half = [[200, topY + 1], [200 + M.torsoHW(topY) + 1.8, topY, 1], [200 + M.torsoHW(M.hipY) + 2, M.hipY, 1], [210, M.hipY + 24], [200, M.hipY + 29, 1]];
  let bsvg = cloth(smooth(mirror(half)), p);
  if (o.bottom === 'high') bsvg += `<circle cx="200" cy="${f1(topY + 9)}" r="2.2" fill="${p.trim}"/>`;
  out.push({ bone: 'root', z: 170, svg: bsvg });
  if (o.bottom === 'skirt') out.push(...skirt(M, { topY: M.waistY + 20, hem: M.hipY + 34, flare: 0.6, band: false, lace: o.frill ? p.trim : null, z: 172 }, p));
  return out;
}

function swim1(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const b = bodice(M, { neck: o.neck || 'scoop', hem: M.waistY + 14, ease: 1.6 });
  const half = [[200, M.waistY], [200 + M.torsoHW(M.waistY) + 1.6, M.waistY, 1], [200 + M.torsoHW(M.hipY) + 2, M.hipY, 1], [210, M.hipY + 24], [200, M.hipY + 29, 1]];
  const out = [
    { bone: 'root', z: 170, svg: cloth(smooth(mirror(half)), p) },
    { bone: 'spine', z: 171, svg: cloth(b.d, p) + (['square', 'sweetheart', 'straight', 'halter'].includes(o.neck) ? straps(M, { neck: o.neck, top: b.top }, p, 3) : '') + (o.bow ? bow(200, b.top + 7, 6, o.bow, inkOf(o.bow)) : '') },
  ];
  if (o.skirt) out.push(...skirt(M, { topY: M.waistY + 14, hem: M.hipY + 36, flare: 0.55, band: false, lace: o.lace, z: 172 }, p));
  return out;
}

// ── Outerwear ───────────────────────────────────────────────

function outer(item, M) {
  const o = item.params || {}, p = paintOf(item);
  const sY = M.shoulderY;
  const out = [];
  if (o.style === 'capelet') {
    const y = M.chestY + 10;
    const d = smooth(mirror([[200, sY + 6], [214, sY - 6], [238, sY + 4], [258, y - 6], [252, y + 6, 1], [200, y + 10]]));
    let svg = cloth(d, p) + scallops(146, 254, y + 8, 4.5, '#ffffff', '#b6a8c4', 1.2);
    svg += shape(smooth([[186, sY - 8], [214, sY - 8], [218, sY + 2], [182, sY + 2]]), '#ffffff', '#b6a8c4', 1.4);
    svg += bow(200, sY + 4, 7, o.bow || '#d6336c', inkOf(o.bow || '#d6336c'));
    out.push({ bone: 'spine', z: 345, svg });
    return out;
  }
  const hem = { crop: M.waistY + 4, hip: M.hipY + 10, long: M.hipY + 46, knee: M.kneeY - 10 }[o.len || 'hip'];
  const gap = o.style === 'raincoat' ? 0 : o.style === 'blazer' ? 9 : 7;
  const panel = (s) => {
    const X = (x) => 200 + s * x;
    const shoulderHW = M.shoulder.R.x - 200 + 2;
    const pts = [[X(gap + 4), sY + 30, 1], [X(14), sY - 4, 1], [X(shoulderHW), sY + 5], [X(shoulderHW), sY + 15]];
    for (const y of [M.chestY, M.waistY, M.waistY + 28, M.hipY + 8, M.hipY + 40]) if (y < hem - 6) pts.push([X(M.torsoHW(y) + 4.5 + (y > M.waistY ? (y - M.waistY) * 0.08 : 0)), y]);
    const hx = M.torsoHW(Math.min(hem, M.hipY + 14)) + 5 + (hem > M.hipY ? (hem - M.hipY) * 0.18 : 0);
    pts.push([X(hx), hem, 1], [X(gap), hem, 1], [X(gap), M.chestY, 0]);
    return smooth(pts);
  };
  let svg = cloth(panel(-1), p) + cloth(panel(1), p);
  // Lapels or a collar, buttons, pockets.
  if (o.style === 'blazer') {
    // Lapels with piping, two hip pocket flaps, two buttons at the waist.
    const lap = (s) => [[200 + s * 13, sY - 4], [200 + s * 27, sY + 3], [200 + s * 19, sY + 44], [200 + s * (gap + 4), M.chestY + 14]];
    for (const s of [-1, 1]) {
      svg += shape(line(lap(s), true), darken(p.main, 0.12), p.ink, 1.6) + stroke(line(lap(s).slice(1, 4)), p.trim, 1.3);
      const py = M.waistY + 26, px = 200 + s * (M.torsoHW(py) - 8);
      svg += shape(line([[px - 13, py, 1], [px + 13, py, 1], [px + 12, py + 9, 1], [px - 12, py + 9, 1]], true), p.fill, p.ink, 1.5) + stroke(`M${f1(px - 12)} ${f1(py + 1.5)}H${f1(px + 12)}`, p.trim, 1.1);
    }
    for (const y of [M.waistY - 4, M.waistY + 12]) svg += `<circle cx="${f1(200 + gap + 5)}" cy="${f1(y)}" r="2.6" fill="${p.trim}" stroke="${p.ink}" stroke-width="1"/>`;
    svg += stroke(`M${f1(200 - gap)} ${f1(M.chestY + 14)}V${f1(hem - 1)}M${f1(200 + gap)} ${f1(M.chestY + 14)}V${f1(hem - 1)}`, p.trim, 1.2);
  }
  if (o.style === 'jacket' || o.style === 'shirt') {
    const lap = (s) => line([[200 + s * 13, sY - 4], [200 + s * 26, sY + 2], [200 + s * 16, sY + 30], [200 + s * (gap + 4), sY + 30]], true);
    svg += shape(lap(-1), p.trim, inkOf(p.trim), 1.6) + shape(lap(1), p.trim, inkOf(p.trim), 1.6);
  }
  if (o.style === 'jacket') {
    svg += stroke(`M${f1(200 - M.torsoHW(M.chestY) + 2)} ${f1(M.chestY + 4)}h12M${f1(200 + M.torsoHW(M.chestY) - 14)} ${f1(M.chestY + 4)}h12`, p.ink, 1.4) +
      stroke(`M${f1(200 - gap - 2)} ${f1(M.chestY - 10)}V${f1(hem - 4)}M${f1(200 + gap + 2)} ${f1(M.chestY - 10)}V${f1(hem - 4)}`, '#f2c14e', 1.1, 'stroke-dasharray="3 3"');
  }
  if (o.style === 'cardigan' || o.style === 'raincoat') {
    for (let y = M.chestY - 6; y < hem - 8; y += o.style === 'raincoat' ? 26 : 18) {
      svg += `<circle cx="${f1(200 + (o.style === 'raincoat' ? 7 : gap + 4))}" cy="${f1(y)}" r="2.4" fill="${o.buttons || p.trim}" stroke="${p.ink}" stroke-width="1"/>`;
      if (o.style === 'raincoat') svg += `<circle cx="193" cy="${f1(y)}" r="2.4" fill="${o.buttons || p.trim}" stroke="${p.ink}" stroke-width="1"/>`;
    }
  }
  if (o.style === 'raincoat') svg += stroke(`M200 ${f1(sY + 8)}V${f1(hem)}`, p.ink, 1.4);
  if (o.knit) svg += stroke(`M${f1(200 - M.torsoHW(M.hipY) - 6)} ${f1(hem - 7)}H${f1(200 - gap)}M${f1(200 + gap)} ${f1(hem - 7)}H${f1(200 + M.torsoHW(M.hipY) + 6)}`, p.ink, 1.1, 'opacity=".5"');
  out.push({ bone: 'spine', z: 230, svg });
  if (o.hood) out.push({ ...hood(M, p, false) });
  out.push(...sleeves(M, { len: o.sleeve || 'long', cuff: o.cuff ?? true, ease: 3.4, z: 320 }, p));
  return out;
}

const GEN = {
  dress, top: topGen, skirt: skirtGen, pants: pantsGen, swim2, swim1, outer, costume: costumePieces,
};

/** Pieces for one item, used by the outfit and by wardrobe thumbnails. */
export function itemPieces(item, M, ctx) {
  const p = paintOf(item);
  const gen = GEN[item.kind];
  let pieces;
  if (gen) pieces = gen(item, M, ctx);
  else if (item.slot === 'legwear') pieces = legwearPieces(item, M, p);
  else if (item.slot === 'shoes') pieces = shoePieces(item, M, p);
  else pieces = accessoryPieces(item, M, p, ctx);
  return { pieces: pieces.map((x) => ({ ...x, item: item.id })), def: p.def };
}

/** Every outfit piece, the slip included, plus pattern defs and flags. */
export function outfitPieces(outfit, M, ctx) {
  const pieces = [], defs = [];
  const has = (slot) => !!itemById(outfit[slot]);
  if (!has('dress') && !has('swim')) pieces.push(...baseSlip(M, { top: !has('top'), bottom: !has('bottom') }));
  for (const slot of ORDER) {
    const item = resolvedItem(outfit[slot],ctx.garments);
    if (!item) continue;
    const r = itemPieces(item, M, ctx);
    pieces.push(...r.pieces);
    if (r.def) defs.push(r.def);
  }
  return { pieces, defs: defs.join(''), flags: { hideAhoge: has('hat'), held: has('held') } };
}
