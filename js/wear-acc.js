// ── Accessories ──────────────────────────────────────────────
// Hats, hair pieces, neckwear and glasses live in canonical head space or on
// the neck and spine. Held items are drawn upright around the palm: the doll
// keeps them level whatever the arm does (doll.js reads `upright`).

import { smooth, line, shape, fillOnly, stroke, inkOf, darken, lighten, f1, scallops } from './wear-kit.js';
import { bow, star, heart } from './paint.js';

/** A small five-petal flower centred on (x, y). */
function flower(x, y, r, petal, centre = '#ffe08a') {
  let svg = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    svg += `<circle cx="${f1(x + Math.cos(a) * r * 0.62)}" cy="${f1(y + Math.sin(a) * r * 0.62)}" r="${f1(r * 0.5)}" fill="${petal}" stroke="${inkOf(petal)}" stroke-width=".9"/>`;
  }
  return svg + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.34)}" fill="${centre}"/>`;
}

function hat(style, p) {
  const H = (z, svg, extra = {}) => ({ bone: 'head', z, depth: 0.5, svg, ...extra });
  switch (style) {
    case 'beret':
      return [H(460, `<g transform="rotate(-12 212 120)">${shape('M162 128Q160 98 210 96Q262 96 262 124Q236 134 162 128Z', p.fill, p.ink, 2)}` +
        `${shape('M170 126Q212 134 256 124L256 130Q212 140 170 132Z', darken(p.main, 0.15), p.ink, 1.4)}` +
        `${shape('M209 96q1-8 6-8q-1 5 -2 8z', p.main, p.ink, 1.3)}</g>`)];
    case 'sunhat': {
      const back = 'M108 136A92 22 0 0 1 292 136Z';
      const front = 'M108 136A92 22 0 0 0 292 136Q260 150 200 151Q140 150 108 136Z';
      return [
        H(9, shape(back, darken(p.main, 0.12), p.ink, 2)),
        H(460, shape('M154 136Q152 88 200 86Q248 88 246 136Z', p.fill, p.ink, 2) +
          shape('M154 128Q200 138 246 128L246 136Q200 146 154 136Z', p.trim, inkOf(p.trim), 1.4) +
          bow(238, 133, 8, p.trim, inkOf(p.trim), 10)),
        H(461, shape(front, p.fill, p.ink, 2) + stroke('M124 140Q200 160 276 140', p.ink, 1, 'opacity=".35"')),
      ];
    }
    case 'bunny': {
      const ear = (x, tilt) => `<g transform="rotate(${tilt} ${x} 116)">` +
        shape(`M${x - 11} 118C${x - 16} 80 ${x - 12} 34 ${x} 28C${x + 12} 34 ${x + 15} 80 ${x + 10} 118Z`, p.fill, p.ink, 1.8) +
        fillOnly(`M${x - 5} 112C${x - 9} 82 ${x - 6} 46 ${x} 40C${x + 6} 46 ${x + 8} 82 ${x + 4} 112Z`, p.trim) + '</g>';
      return [H(455, stroke('M146 166Q150 112 200 108Q250 112 254 166', p.ink, 7.4) + stroke('M146 166Q150 112 200 108Q250 112 254 166', p.main, 5) + ear(178, -12) + ear(222, 14))];
    }
    case 'catears': {
      const ear = (x, s) => shape(`M${x - 13} 128L${x + s * 4} 92L${x + 15} 124Z`, p.fill, p.ink, 1.8) +
        fillOnly(`M${x - 7} 124L${x + s * 3} 101L${x + 9} 121Z`, '#ffc4d8');
      return [H(455, stroke('M146 166Q150 112 200 108Q250 112 254 166', p.ink, 7.4) + stroke('M146 166Q150 112 200 108Q250 112 254 166', p.main, 5) + ear(166, -1) + ear(234, 1))];
    }
    case 'witch': {
      return [
        H(9, shape('M118 128A82 17 0 0 1 282 128Z', darken(p.main, 0.12), p.ink, 2)),
        H(460, shape('M160 128Q170 80 196 50Q214 26 248 18Q222 40 226 72Q232 104 240 128Z', p.fill, p.ink, 2) +
          shape('M162 118Q200 126 238 118L240 128Q200 136 160 128Z', p.trim, inkOf(p.trim), 1.4) +
          `<path d="${star(200, 122, 7)}" fill="#ffe08a" stroke="#b8862b" stroke-width="1"/>`),
        H(461, shape('M118 128A82 17 0 0 0 282 128Q250 140 200 141Q150 140 118 128Z', p.fill, p.ink, 2)),
      ];
    }
    case 'crown': {
      let svg = stroke('M150 150Q156 118 200 114Q244 118 250 150', '#6aa86a', 3.2);
      [[152, 146], [164, 128], [182, 118], [200, 114], [218, 118], [236, 128], [248, 146]].forEach(([x, y], i) => {
        svg += flower(x, y, i % 2 ? 9 : 11, i % 3 === 0 ? p.main : i % 3 === 1 ? p.trim : p.accent);
      });
      return [H(456, svg)];
    }
    case 'beanie':
      return [H(460, shape('M146 162Q144 94 200 92Q256 94 254 162Z', p.fill, p.ink, 2) +
        shape('M144 150Q200 158 256 150L256 166Q200 174 144 166Z', p.trim, inkOf(p.trim), 1.5) +
        stroke('M158 154v12M172 156v12M186 157v12M200 157v12M214 157v12M228 156v12M242 154v12', inkOf(p.trim), 1, 'opacity=".4"') +
        `<circle cx="200" cy="88" r="14" fill="${p.trim}" stroke="${inkOf(p.trim)}" stroke-width="1.6"/>`)];
    default:
      return [];
  }
}

function hairAcc(style, p, ctx) {
  const head = ctx?.head || {};
  const H = (svg, z = 470) => ({ bone: 'head', z, depth: 0.7, svg });
  switch (style) {
    case 'ribbon':
      if (head.back === 'twintails') {
        return [
          { bone: 'tailL', z: 16, depth: -0.3, svg: bow(141, 152, 15, p.main, p.ink, -14) },
          { bone: 'tailR', z: 16, depth: -0.3, svg: bow(259, 152, 15, p.main, p.ink, 14) },
        ];
      }
      return [H(bow(236, 130, 17, p.main, p.ink, 18))];
    case 'stars':
      return [H(`<path d="${star(234, 160, 7)}" fill="${p.main}" stroke="${p.ink}" stroke-width="1.2"/><path d="${star(244, 174, 5)}" fill="${p.trim}" stroke="${inkOf(p.trim)}" stroke-width="1.1"/>`)];
    case 'strawberry': {
      const berry = (x, y) => shape(`M${x} ${y + 9}Q${x - 8} ${y + 2} ${x - 6} ${y - 3}Q${x} ${y - 6} ${x + 6} ${y - 3}Q${x + 8} ${y + 2} ${x} ${y + 9}Z`, '#ff5d7a', '#a8324a', 1.2) +
        fillOnly(`M${x - 5} ${y - 4}L${x} ${y - 9}L${x + 5} ${y - 4}L${x} ${y - 2}Z`, '#5fbf6a') +
        `<circle cx="${x - 2}" cy="${y + 1}" r=".8" fill="#ffe08a"/><circle cx="${x + 2}" cy="${y + 4}" r=".8" fill="#ffe08a"/>`;
      return [H(berry(160, 160) + berry(240, 160))];
    }
    case 'headband':
      return [H(stroke('M147 170Q150 118 200 114Q250 118 253 170', p.ink, 8) + stroke('M147 170Q150 118 200 114Q250 118 253 170', p.main, 6) + bow(232, 126, 9, p.main, p.ink, 16), 455)];
    case 'loops': {
      // Two open ribbon loops on the crown with tails trailing behind.
      const band = (d, w = 7) => stroke(d, lighten(p.main, 0.35), w + 2.6) + stroke(d, p.main, w);
      const loops = 'M244 132C232 128 216 110 226 100C236 92 246 112 244 132ZM248 132C260 122 282 112 286 124C290 136 266 138 248 132Z';
      return [
        { bone: 'head', z: 13, depth: -0.3, svg: band('M247 134Q262 160 288 182', 5) + band('M247 134Q254 164 266 190', 4.6) },
        H(band(loops, 6.4) + `<ellipse cx="246" cy="133" rx="6.4" ry="5.6" fill="${p.main}" stroke="${lighten(p.main, 0.35)}" stroke-width="1.4"/>`),
      ];
    }
    default:
      return [];
  }
}

function neckwear(style, p, M) {
  const sY = M.shoulderY;
  switch (style) {
    case 'choker': {
      const y = M.chinY + 14;
      return [{ bone: 'neck', z: 222, svg: stroke(`M189 ${f1(y)}Q200 ${f1(y + 3)} 211 ${f1(y)}`, p.ink, 6) + stroke(`M189 ${f1(y)}Q200 ${f1(y + 3)} 211 ${f1(y)}`, p.main, 4.2) + `<path d="${heart(200, y + 6, 3.4)}" fill="${p.trim}" stroke="${inkOf(p.trim)}" stroke-width=".9"/>` }];
    }
    case 'pearls': {
      let svg = '';
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, x = 186 + 28 * t, y = sY - 2 + Math.sin(t * Math.PI) * 20;
        svg += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.2" fill="#fffaf2" stroke="#b8ab9a" stroke-width=".8"/>`;
      }
      return [{ bone: 'spine', z: 222, svg }];
    }
    case 'locket':
      return [{ bone: 'spine', z: 222, svg: stroke(`M187 ${f1(sY - 3)}Q200 ${f1(sY + 30)} 213 ${f1(sY - 3)}`, '#d8b45a', 1.2) + `<path d="${heart(200, sY + 22, 6)}" fill="#ffd166" stroke="#a8802c" stroke-width="1.2"/>` }];
    case 'scarf': {
      const y0 = M.chinY + 2, y1 = sY + 10;
      const wrap = smooth([[182, y0 + 6], [200, y0], [218, y0 + 6], [222, y1, 1], [178, y1, 1]]);
      const tail = smooth([[206, y1 - 6], [220, y1 - 4], [224, M.chestY + 34, 1], [208, M.chestY + 36, 1]]);
      return [
        { bone: 'neck', z: 223, svg: shape(wrap, p.fill, p.ink, 2) + stroke(`M186 ${f1(y0 + 12)}h28M184 ${f1(y0 + 20)}h32`, p.ink, 1, 'opacity=".35"') },
        { bone: 'spine', z: 224, svg: shape(tail, p.fill, p.ink, 2) + stroke(`M209 ${f1(M.chestY + 36)}v6M214 ${f1(M.chestY + 36)}v6M219 ${f1(M.chestY + 35)}v6`, p.ink, 1.6) },
      ];
    }
    default:
      return [];
  }
}

function glasses(style, p) {
  const G = (svg) => ({ bone: 'head', z: 445, depth: 0.95, svg });
  if (style === 'round') {
    return [G(`<circle cx="178" cy="206" r="15.5" fill="#fff" fill-opacity=".14" stroke="${p.main}" stroke-width="2.4"/><circle cx="222" cy="206" r="15.5" fill="#fff" fill-opacity=".14" stroke="${p.main}" stroke-width="2.4"/>` + stroke('M193.5 204Q200 200 206.5 204', p.main, 2.2))];
  }
  if (style === 'hearts') {
    return [G(`<path d="${heart(178, 206, 15)}" fill="${p.main}" fill-opacity=".72" stroke="${p.ink}" stroke-width="2"/><path d="${heart(222, 206, 15)}" fill="${p.main}" fill-opacity=".72" stroke="${p.ink}" stroke-width="2"/>` + stroke('M194 202Q200 198 206 202', p.ink, 2) + '<ellipse cx="172" cy="200" rx="3" ry="2" fill="#fff" opacity=".7"/><ellipse cx="216" cy="200" rx="3" ry="2" fill="#fff" opacity=".7"/>')];
  }
  if (style === 'stars') {
    return [G(`<path d="${star(178, 206, 17, 0.55)}" fill="${p.main}" fill-opacity=".75" stroke="${p.ink}" stroke-width="2"/><path d="${star(222, 206, 17, 0.55)}" fill="${p.main}" fill-opacity=".75" stroke="${p.ink}" stroke-width="2"/>` + stroke('M193 204Q200 200 207 204', p.ink, 2))];
  }
  return [];
}

// Held items are drawn around (0, 0), the palm, and stay upright.
function held(style, p) {
  const U = (svg, z = 302, extra = {}) => ({ bone: 'handL', z, svg, upright: [0, 10], ...extra });
  switch (style) {
    case 'bunny':
      return [U(shape('M-6 -4Q-10 -22 -5 -24Q-1 -20 -2 -4Z', '#fff', '#8f8496', 1.4) + shape('M2 -4Q2 -22 7 -23Q10 -18 4 -3Z', '#fff', '#8f8496', 1.4) +
        `<circle cx="0" cy="8" r="11" fill="#fff" stroke="#8f8496" stroke-width="1.6"/><ellipse cx="0" cy="30" rx="12.5" ry="14" fill="#fff" stroke="#8f8496" stroke-width="1.6"/>` +
        '<circle cx="-4" cy="7" r="1.5" fill="#3a2a44"/><circle cx="4" cy="7" r="1.5" fill="#3a2a44"/><ellipse cx="0" cy="11" rx="1.6" ry="1.1" fill="#ff8fb3"/>' +
        `${bow(0, 19, 5, p.main, p.ink)}`)];
    case 'boba':
      return [U(shape('M-9 -14L9 -14L7 18Q0 21 -7 18Z', '#f3dcc0', '#9a7a5c', 1.6) +
        fillOnly('M-8.6 -8L8.6 -8L7.4 12Q0 14 -7.4 12Z', p.main) +
        [[-4, 12], [0, 14], [4, 12], [-2, 9], [3, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#3b2433"/>`).join('') +
        shape('M-10 -17h20v4h-20z', '#ffffff', '#9a7a5c', 1.2) + stroke('M3 -16L7 -34', '#ff8fb3', 3), 302)];
    case 'icecream':
      return [U(shape('M-7 -2L7 -2L0 24Z', '#e8b56a', '#9a6a2c', 1.5) + stroke('M-4 4l7 7M4 4l-7 7M-2 12l4 4', '#9a6a2c', 0.9, 'opacity=".6"') +
        `<circle cx="0" cy="-8" r="9" fill="${p.main}" stroke="${inkOf(p.main)}" stroke-width="1.5"/><circle cx="0" cy="-19" r="7.5" fill="${p.trim}" stroke="${inkOf(p.trim)}" stroke-width="1.5"/>` +
        '<circle cx="0" cy="-28" r="2.6" fill="#e2384f"/>')];
    case 'bouquet':
      return [U(shape('M-11 -6L11 -6L3 22L-3 22Z', p.main, p.ink, 1.5) + flower(-7, -12, 8, '#ff9cc2') + flower(6, -14, 8, '#fff2a8') + flower(0, -22, 8, '#c5a3f0') + bow(0, 4, 5, p.trim, inkOf(p.trim)))];
    case 'book':
      return [U(shape('M-11 -14L11 -10L11 16L-11 12Z', p.main, p.ink, 1.6) + stroke('M-8 -9L8 -6M-8 -4L6 -1', '#fff', 1.2, 'opacity=".7"') + `<path d="${heart(1, 6, 4)}" fill="${p.trim}"/>`)];
    case 'phone':
      return [U('<g transform="rotate(-8)">' + shape('M-10 -22h20a3 3 0 0 1 3 3v36a3 3 0 0 1 -3 3h-20a3 3 0 0 1 -3 -3v-36a3 3 0 0 1 3 -3z', p.main, inkOf(p.main), 1.6) +
        '<rect x="-10.5" y="-18" width="21" height="32" rx="1.5" fill="#3557c8"/><rect x="-10.5" y="-18" width="21" height="14" rx="1.5" fill="#6a4fd0" opacity=".7"/>' +
        '<circle cx="0" cy="-2" r="6.5" fill="#ff4f9a"/><path d="M-2 -5.5L3.6 -2L-2 1.5Z" fill="#fff"/>' +
        stroke('M-7 9h14M-7 12h9', '#fff', 1, 'opacity=".6"') + '</g>')];
    case 'parasol': {
      const canopy = 'M-150 -270Q-150 -360 -60 -380Q30 -380 30 -290Q12 -300 -6 -290Q-24 -302 -42 -288Q-60 -300 -78 -286Q-96 -298 -114 -284Q-132 -296 -150 -270Z';
      return [
        U(stroke('M0 0L-58 -300', '#8a6a4a', 3), 6, { fixed: true }),
        U(shape(canopy, p.fill, p.ink, 2) + stroke('M-58 -378L-90 -290M-58 -378L-58 -292M-58 -378L-24 -292M-58 -378L-130 -282M-58 -378L8 -290', p.ink, 1, 'opacity=".35"') +
          scallops(-148, 30, -278, 5, '#ffffff', '#b6a8c4', 1), 7, { fixed: true }),
        U(stroke('M2 4Q4 18 -4 18', '#8a6a4a', 3), 302),
      ];
    }
    default:
      return [];
  }
}

/** A bead bracelet round the right wrist, on the forearm so it follows the arm. */
function wristwear(M) {
  const W = M.wrist.R, colors = ['#ff6f9a', '#3fd6c4', '#ffd84d', '#6aa8ff', '#b98cff', '#7ad37a', '#ff9a5c'];
  let svg = '';
  for (let i = 0; i < 7; i++) {
    const t = i / 6, x = W.x - 7.5 + t * 15, y = W.y - 5 + Math.sin(t * Math.PI) * 2.6;
    svg += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.7" fill="${colors[i]}" stroke="${inkOf(colors[i])}" stroke-width=".8"/><circle cx="${f1(x - 0.8)}" cy="${f1(y - 0.9)}" r=".8" fill="#fff" opacity=".7"/>`;
  }
  return [{ bone: 'foreArmR', z: 332, svg }];
}

export function accessoryPieces(item, M, p, ctx) {
  const style = item.params?.style;
  switch (item.slot) {
    case 'hat': return hat(style, p);
    case 'hairacc': return hairAcc(style, p, ctx);
    case 'neck': return neckwear(style, p, M);
    case 'glasses': return glasses(style, p);
    case 'held': return held(style, p);
    case 'wrist': return wristwear(M);
    default: return [];
  }
}
