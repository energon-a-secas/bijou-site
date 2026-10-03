// ── Thumbnails ───────────────────────────────────────────────
// A wardrobe card shows the item itself, drawn by the same generator the doll
// uses, at the standing pose, cropped to its own bounds. Mini dolls for saved
// looks are full dolls on a static frame.

import { measure, pivots, solve, matrixAttr, apply } from './rig.js';
import { resolvePose, POSES } from './poses.js';
import { itemPieces } from './wear.js';
import { DEFAULT_BODY, HAIR, SKIN, byId } from './looks.js';
import { createDoll } from './doll.js';
import { f1 } from './paint.js';

const NS = 'http://www.w3.org/2000/svg';
const M = measure(DEFAULT_BODY);
const MATS = solve(M, pivots(M), { bones: resolvePose(M, POSES.stand).bones, root: { x: 0, y: 0 } });
const cache = new Map();
let sizer = null;

function bbox(inner) {
  if (!sizer) {
    sizer = document.createElementNS(NS, 'svg');
    sizer.setAttribute('aria-hidden', 'true');
    sizer.setAttribute('viewBox', '0 0 400 820');
    sizer.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:820px;visibility:hidden;pointer-events:none';
    document.body.append(sizer);
  }
  sizer.innerHTML = `<g>${inner}</g>`;
  try { return sizer.firstChild.getBBox(); } catch { return { x: 0, y: 0, width: 400, height: 820 }; }
}

/** SVG markup for an item card. head decides where hair accessories sit. */
export function itemThumb(item, head, cls = 'item__thumb') {
  const key = `${item.id}|${item.slot === 'hairacc' ? head.back : ''}|${cls}`;
  if (cache.has(key)) return cache.get(key);
  const ctx = { head, hair: byId(HAIR, head.hair), skin: byId(SKIN, DEFAULT_BODY.skin) };
  const { pieces, def } = itemPieces(item, M, ctx);
  const inner = pieces.slice().sort((a, b) => a.z - b.z).map((p) => {
    if (p.upright) {
      const side = p.bone.endsWith('R') ? 'R' : 'L', s = side === 'L' ? -1 : 1, W = M.wrist[side];
      const w = apply(MATS[p.bone], W.x + s * p.upright[0], W.y + p.upright[1]);
      return `<g transform="translate(${f1(w.x)} ${f1(w.y)})">${p.svg}</g>`;
    }
    return `<g transform="${matrixAttr(MATS[p.bone])}">${p.svg}</g>`;
  }).join('');
  const b = bbox(inner);
  const side = Math.max(b.width, b.height) * 1.12 + 6;
  const vb = [b.x + b.width / 2 - side / 2, b.y + b.height / 2 - side / 2, side, side].map(f1).join(' ');
  const svg = `<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false"><defs>${def}</defs>${inner}</svg>`;
  cache.set(key, svg);
  return svg;
}

/** A full doll on a static standing frame, into an existing <svg>. */
export function miniDoll(svg, cfg, expr = 'smile') {
  const doll = createDoll(svg);
  const m = doll.build(cfg);
  const pose = POSES.stand;
  const t = resolvePose(m, pose, { holding: !!doll.flags.held });
  doll.setPoseLook({ hands: pose.hands, bands: pose.band });
  doll.setExpression(expr);
  doll.render({ bones: t.bones, root: { x: 0, y: 0 } }, { yaw: 0, pitch: 0, look: { x: 0, y: 0 } });
  svg.setAttribute('viewBox', '60 90 280 720');
  return doll;
}
