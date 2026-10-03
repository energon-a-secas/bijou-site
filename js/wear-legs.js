// ── Legwear and shoes ────────────────────────────────────────
// Socks and tights follow the leg's own outline (wear-kit legSegment), shoes
// follow the foot's. All drawn per side in rest coordinates.

import { legSegment, footPts, smooth, line, shape, fillOnly, stroke, inkOf, darken, lighten, f1, at, scallops } from './wear-kit.js';

const SIDES = [['L', -1], ['R', 1]];

export function legwearPieces(item, M, p) {
  const style = item.params?.style || 'knee';
  const out = [];
  for (const [side, s] of SIDES) {
    if (style !== 'warmers') {
      out.push({ bone: `foot${side}`, z: 110, svg: shape(smooth(footPts(M, side, 0.8)), p.fill, p.ink, 1.8) });
    }
    const t0 = { ankle: 0.8, ruffle: 0.78, knee: 0.06, tights: 0, warmers: 0.36, over: -0.04 }[style] ?? 0.06;
    const t1 = style === 'warmers' ? 0.98 : 1.03;
    const seg = legSegment(M, side, 'shin', t0, t1, style === 'warmers' ? 3.2 : 0.9);
    let svg = shape(smooth(seg.pts), p.fill, p.ink, 1.8);
    const band = (y, h, color) => {
      const w = seg.hw(t0) + 1.2;
      return shape(line([[seg.top.x - w, y, 1], [seg.top.x + w, y, 1], [seg.top.x + w * 0.98, y + h, 1], [seg.top.x - w * 0.98, y + h, 1]], true), color, inkOf(color), 1.3);
    };
    if (style === 'knee') svg += band(seg.top.y, 7, p.trim);
    if (style === 'ankle') svg += band(seg.top.y, 5, p.trim);
    if (style === 'ruffle') svg += scallops(seg.top.x - seg.hw(t0) - 3, seg.top.x + seg.hw(t0) + 3, seg.top.y + 4, 3.2, p.trim, inkOf(p.trim), 1.1);
    if (style === 'warmers') {
      let rib = '';
      for (let k = -2; k <= 2; k++) rib += `M${f1(seg.top.x + k * 4)} ${f1(seg.top.y + 4)}L${f1(seg.bottom.x + k * 4.4)} ${f1(seg.bottom.y - 4)}`;
      svg += stroke(rib, p.ink, 1, 'opacity=".35"') + stroke(smooth([[seg.top.x - 12, seg.bottom.y - 2], [seg.bottom.x, seg.bottom.y + 3], [seg.top.x + 12, seg.bottom.y - 2]], false), p.ink, 1.6);
    }
    out.push({ bone: `shin${side}`, z: 110, svg });
    if (style === 'over') {
      const th = legSegment(M, side, 'thigh', 0.4, 1.03, 0.9);
      const w = th.hw(0.4) + 1;
      out.push({
        bone: `thigh${side}`, z: 110,
        svg: shape(smooth(th.pts), p.fill, p.ink, 1.8) +
          shape(line([[th.top.x - w, th.top.y - 1, 1], [th.top.x + w, th.top.y - 1, 1], [th.top.x + w * 0.98, th.top.y + 6, 1], [th.top.x - w * 0.98, th.top.y + 6, 1]], true), p.trim, inkOf(p.trim), 1.2) +
          stroke(line([[th.top.x - s * 4, th.top.y + 14], [th.bottom.x - s * 3, th.bottom.y - 4]]), '#ffffff', 2, 'opacity=".14"'),
      });
    }
    if (style === 'tights') {
      const th = legSegment(M, side, 'thigh', -0.04, 1.03, 0.8);
      out.push({ bone: `thigh${side}`, z: 110, svg: shape(smooth(th.pts), p.fill, p.ink, 1.8) });
    }
    void s;
  }
  if (style === 'tights') {
    const ys = [M.waistY + 20, M.hipY - 4, M.hipY + 8];
    const half = [[200, ys[0]], ...ys.map((y, i) => [200 + M.torsoHW(y) + 0.8, y, i === 0 ? 1 : 0]), [211, M.hipY + 22], [200, M.hipY + 27]];
    const L = half.slice(1, -1).reverse().map(([x, y, c]) => [400 - x, y, c]);
    out.push({ bone: 'root', z: 152, svg: fillOnly(smooth(half.concat(L)), p.fill) });
  }
  return out;
}

export function shoePieces(item, M, p) {
  const style = item.params?.style || 'maryjane';
  const out = [];
  for (const [side, s] of SIDES) {
    const P = at(M.ankle[side], s);
    const poly = (pts) => smooth(pts.map(P));
    const sole = darken(p.main, 0.45);
    let svg = '';
    if (style === 'maryjane') {
      const body = poly([[-7.4, 11, 1], [-3, 15.5], [3, 15.5], [7.4, 11, 1], [9.8, 22], [10, 30], [7.4, 36.4], [0, 37.8], [-7.4, 36.4], [-10, 30], [-9.8, 22]]);
      svg = shape(body, p.fill, p.ink, 1.8) +
        shape(poly([[-9.4, 32], [0, 35.4], [9.4, 32], [8.2, 38.8, 1], [-8.2, 38.8, 1]]), sole, inkOf(sole), 1.3) +
        stroke(line([[-6.8, 8.5], [6.8, 8.5]].map(P)), p.ink, 4.6) + stroke(line([[-6.8, 8.5], [6.8, 8.5]].map(P)), p.main, 2.6) +
        `<circle cx="${f1(P([6, 8.5])[0])}" cy="${f1(P([6, 8.5])[1])}" r="1.8" fill="${p.trim}" stroke="${p.ink}" stroke-width=".9"/>` +
        `<ellipse cx="${f1(P([-2, 25])[0])}" cy="${f1(P([-2, 25])[1])}" rx="2.4" ry="4" fill="#fff" opacity=".45"/>`;
    } else if (style === 'loafer') {
      const body = poly([[-7.6, 9, 1], [-3, 12.5], [3, 12.5], [7.6, 9, 1], [10, 22], [10.2, 30], [7.6, 36.2], [0, 37.6], [-7.6, 36.2], [-10.2, 30], [-10, 22]]);
      const glow = p.accent;
      const soleD = poly([[-10, 33], [0, 36], [10, 33], [8.8, 40.5, 1], [-8.8, 40.5, 1]]);
      svg = shape(body, p.fill, p.ink, 1.8) +
        stroke(soleD, glow, 5, 'opacity=".25"') + shape(soleD, glow, inkOf(glow), 1.2) +
        shape(poly([[-8.4, 15, 1], [8.4, 15, 1], [8.8, 20, 1], [-8.8, 20, 1]]), darken(p.main, 0.2), p.ink, 1.1) +
        `<ellipse cx="${f1(P([0, 17.5])[0])}" cy="${f1(P([0, 17.5])[1])}" rx="3" ry="1.2" fill="${p.ink}"/>` +
        `<ellipse cx="${f1(P([-3, 26])[0])}" cy="${f1(P([-3, 26])[1])}" rx="2.2" ry="3.6" fill="#fff" opacity=".35"/>`;
    } else if (style === 'sneaker') {
      const body = poly([[-8.6, 3, 1], [8.6, 3, 1], [10.8, 18], [11.2, 30], [8.6, 37], [0, 38.6], [-8.6, 37], [-11.2, 30], [-10.8, 18]]);
      svg = shape(body, p.fill, p.ink, 1.8) +
        shape(poly([[-11, 31], [0, 34.5], [11, 31], [9.6, 40, 1], [-9.6, 40, 1]]), p.trim, inkOf(p.trim), 1.4) +
        stroke(line([[-4, 6], [4, 9]].map(P)) + line([[4, 6], [-4, 9]].map(P)) + line([[-4, 11], [4, 14]].map(P)) + line([[4, 11], [-4, 14]].map(P)), p.ink, 1.1) +
        stroke(smooth([[-9, 24], [-2, 21], [6, 24]].map(P), false), p.accent, 2.4);
    } else if (style === 'slipper') {
      const body = poly([[-9, 9], [0, 7], [9, 9], [12.4, 20], [12.6, 31], [8.6, 38], [0, 39.4], [-8.6, 38], [-12.6, 31], [-12.4, 20]]);
      const ear = (u) => shape(smooth([[u, 10], [u + 4 * Math.sign(u), -6], [u + 8 * Math.sign(u), -4], [u + 5 * Math.sign(u), 12]].map(P)), p.main, p.ink, 1.5);
      svg = ear(-3) + ear(3) + shape(body, p.fill, p.ink, 1.8) +
        `<circle cx="${f1(P([-3.6, 24])[0])}" cy="${f1(P([-3.6, 24])[1])}" r="1.4" fill="${p.ink}"/><circle cx="${f1(P([3.6, 24])[0])}" cy="${f1(P([3.6, 24])[1])}" r="1.4" fill="${p.ink}"/>` +
        `<ellipse cx="${f1(P([0, 28])[0])}" cy="${f1(P([0, 28])[1])}" rx="1.8" ry="1.3" fill="#ff8fb3"/>`;
    } else if (style === 'sandal') {
      svg = shape(poly([[-8.6, 33], [0, 35.6], [8.6, 33], [8, 38.4, 1], [-8, 38.4, 1]]), p.main, p.ink, 1.4) +
        stroke(line([[-8.2, 23], [8.2, 23]].map(P)), p.ink, 4.4) + stroke(line([[-8.2, 23], [8.2, 23]].map(P)), p.main, 2.6) +
        stroke(line([[-6.4, 2], [6.4, 2]].map(P)), p.ink, 4) + stroke(line([[-6.4, 2], [6.4, 2]].map(P)), p.main, 2.2) +
        `<circle cx="${f1(P([0, 23])[0])}" cy="${f1(P([0, 23])[1])}" r="2.4" fill="${p.trim}" stroke="${p.ink}" stroke-width=".9"/>`;
    } else if (style === 'rainboot' || style === 'boot') {
      const t0 = style === 'rainboot' ? 0.5 : 0.76;
      const seg = legSegment(M, side, 'shin', t0, 1.04, style === 'rainboot' ? 3.6 : 2.2);
      out.push({
        bone: `shin${side}`, z: 121,
        svg: shape(smooth(seg.pts), p.fill, p.ink, 1.9) +
          shape(line([[seg.top.x - seg.hw(t0) - 1.4, seg.top.y - 1, 1], [seg.top.x + seg.hw(t0) + 1.4, seg.top.y - 1, 1], [seg.top.x + seg.hw(t0) + 1, seg.top.y + 6, 1], [seg.top.x - seg.hw(t0) - 1, seg.top.y + 6, 1]], true), p.trim, inkOf(p.trim), 1.3) +
          stroke(line([[seg.top.x - s * 3, seg.top.y + 12], [seg.bottom.x - s * 3, seg.bottom.y - 6]]), '#fff', 2.2, 'opacity=".45"'),
      });
      const tall = style === 'boot' ? 6 : 0;
      svg = shape(poly([[-8, -4, 1], [8, -4, 1], [10.6, 18], [11, 30], [8.6, 37], [0, 38.4], [-8.6, 37], [-11, 30], [-10.6, 18]]), p.fill, p.ink, 1.8) +
        shape(poly([[-11, 31], [0, 34], [11, 31], [10, 39 + tall, 1], [-10, 39 + tall, 1]]), sole, inkOf(sole), 1.4);
      if (style === 'boot') svg += stroke(line([[-4, 2], [4, 5]].map(P)) + line([[4, 2], [-4, 5]].map(P)) + line([[-4, 8], [4, 11]].map(P)) + line([[4, 8], [-4, 11]].map(P)), p.trim, 1.2);
    }
    out.push({ bone: `foot${side}`, z: 120, svg });
  }
  return out;
}
