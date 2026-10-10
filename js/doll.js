// ── Doll ─────────────────────────────────────────────────────
// Composes body, face, hair and outfit pieces into one SVG, sorted by depth,
// and applies a solved frame each tick. Rebuilds are partial where they can be:
// an expression change swaps two pieces, a band change reorders nodes.

import { measure, pivots, solve, matrixAttr, ARM_OF, isHeadBone, VIEW, apply } from './rig.js';
import { SHARED_DEFS, f1 } from './paint.js';
import { bodyPieces, handPiece } from './body.js';
import { facePieces, featuresPiece, browsPiece, exprOf } from './face.js';
import { hairPieces } from './hair.js';
import { SKIN, HAIR, EYES, byId } from './looks.js';
import { outfitPieces } from './wear.js';

const BAND = { back: -270, mid: 0, front: 200 };
const PARALLAX = { x: 7, y: 5 };
let seq = 0;

/** A round, tufted cushion stool for the seated poses. */
function pouf(M) {
  const top = M.hipY + M.thigh * 0.62 + 6, bot = M.ground - 6;
  const body = `M138 ${f1(top + 6)}Q132 ${f1((top + bot) / 2)} 140 ${f1(bot - 8)}Q200 ${f1(bot + 10)} 260 ${f1(bot - 8)}Q268 ${f1((top + bot) / 2)} 262 ${f1(top + 6)}Z`;
  const cushion = `M134 ${f1(top + 4)}Q134 ${f1(top - 14)} 200 ${f1(top - 16)}Q266 ${f1(top - 14)} 266 ${f1(top + 4)}Q266 ${f1(top + 20)} 200 ${f1(top + 22)}Q134 ${f1(top + 20)} 134 ${f1(top + 4)}Z`;
  const tufts = [160, 200, 240].map((x) => `<circle cx="${x}" cy="${f1((top + bot) / 2 + 8)}" r="3" fill="#8f73c4"/>`).join('');
  return `<path d="${body}" fill="#b9a2e8" stroke="#6d4f9a" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="${body}" fill="url(#bj-shade)"/>${tufts}` +
    `<path d="M142 ${f1(bot - 20)}Q200 ${f1(bot - 4)} 258 ${f1(bot - 20)}" fill="none" stroke="#6d4f9a" stroke-width="1.4" opacity=".45"/>` +
    `<path d="${cushion}" fill="#d9c8f7" stroke="#6d4f9a" stroke-width="2.2"/>` +
    `<path d="M150 ${f1(top - 4)}Q200 ${f1(top - 12)} 250 ${f1(top - 4)}" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>`;
}

export function createDoll(svg) {
  const uid = `d${++seq}`;
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.classList.add('bj-svg');
  svg.innerHTML = `<defs>${SHARED_DEFS}</defs><defs class="bj-dyn"></defs>` +
    `<ellipse class="bj-floor" cx="200" cy="${VIEW.ground}" rx="78" ry="11" fill="url(#bj-floor)"/>` +
    '<g class="bj-prop"></g><g class="bj-parts"></g>';
  const dyn = svg.querySelector('.bj-dyn');
  const floor = svg.querySelector('.bj-floor');
  const propG = svg.querySelector('.bj-prop');
  const root = svg.querySelector('.bj-parts');

  let parts = [];
  let cfg = null, M = null, P = null, colors = null;
  let bands = { L: 'mid', R: 'mid' };
  let hands = { L: 'rest', R: 'rest' };
  let expr = 'smile';
  let irises = [];
  let lastMats = null;
  let flags = {};

  const zOf = (p) => p.z + (ARM_OF[p.bone] && !p.fixed ? BAND[bands[ARM_OF[p.bone]]] : 0);

  function mount(pieces) {
    const sorted = pieces.map((p, i) => ({ p, i })).sort((a, b) => zOf(a.p) - zOf(b.p) || a.i - b.i).map((x) => x.p);
    root.textContent = '';
    parts = sorted.map((p) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-b', p.bone);
      if (p.item) g.setAttribute('data-item', p.item);
      if (p.key) g.setAttribute('data-key', p.key);
      g.innerHTML = p.svg;
      root.append(g);
      const part = { ...p, el: g, last: '' };
      if (p.upright) {
        // Upright pieces sit at the palm's world position with no rotation.
        const side = ARM_OF[p.bone] || 'L', s = side === 'L' ? -1 : 1, W = M.wrist[side];
        part.anchor = { x: W.x + s * p.upright[0], y: W.y + p.upright[1] };
      }
      return part;
    });
    irises = [...root.querySelectorAll('.bj-iris')];
  }

  function dynamicPieces() {
    const heldL = flags.held && bands.L !== 'back';
    return [
      featuresPiece(cfg.head, colors.skin, colors.eye, expr, uid),
      browsPiece(colors.hair, exprOf(expr)),
      { ...handPiece(M, colors.skin, -1, heldL ? 'grip' : hands.L), key: 'handL' },
      { ...handPiece(M, colors.skin, 1, hands.R), key: 'handR' },
    ];
  }

  /** Full rebuild: body, head or outfit changed. */
  function build(next) {
    cfg = next;
    M = measure(cfg.body);
    P = pivots(M);
    colors = {
      skin: byId(SKIN, cfg.body.skin), hair: byId(HAIR, cfg.head.hair), eye: byId(EYES, cfg.head.eyes).base,
    };
    const outfit = outfitPieces(cfg.outfit || {}, M, { head: cfg.head, hair: colors.hair, skin: colors.skin,garments:cfg.garments });
    flags = outfit.flags;
    dyn.innerHTML = outfit.defs;
    const head = cfg.head.ahoge && flags.hideAhoge ? { ...cfg.head, ahoge: false } : cfg.head;
    const pieces = [
      ...bodyPieces(M, colors.skin), ...facePieces(colors.skin, head), ...hairPieces(head, colors.hair),
      ...outfit.pieces, ...dynamicPieces(),
    ];
    mount(pieces);
    if (lastMats) applyMats(lastMats);
    return M;
  }

  /** Swap only the keyed pieces (features, brows, hands), keeping depth order. */
  function swapKeyed() {
    const fresh = Object.fromEntries(dynamicPieces().map((p) => [p.key, p]));
    for (const part of parts) {
      const f = part.key && fresh[part.key];
      if (!f) continue;
      part.el.innerHTML = f.svg;
      part.bone = f.bone;
    }
    irises = [...root.querySelectorAll('.bj-iris')];
  }

  function setExpression(name) {
    if (name === expr || !cfg) { expr = name; return; }
    expr = name;
    swapKeyed();
  }

  function setPoseLook({ hands: h, bands: b }) {
    if (!cfg) return;
    const handsChanged = h.L !== hands.L || h.R !== hands.R;
    const bandsChanged = b.L !== bands.L || b.R !== bands.R;
    hands = { ...h };
    bands = { ...b };
    if (bandsChanged) {
      const order = parts.map((p, i) => ({ p, i })).sort((a, c) => zOf(a.p) - zOf(c.p) || a.i - c.i);
      parts = order.map((x) => x.p);
      for (const p of parts) root.append(p.el);
    }
    if (handsChanged || bandsChanged) swapKeyed();
  }

  let yaw = 0, pitch = 0;
  function applyMats(mats) {
    lastMats = mats;
    const cache = new Map();
    for (const part of parts) {
      if (part.anchor) {
        const w = apply(mats[part.bone], part.anchor.x, part.anchor.y);
        const attr = `translate(${f1(w.x)} ${f1(w.y)}) scale(1.3)`;
        if (attr !== part.last) { part.el.setAttribute('transform', attr); part.last = attr; }
        continue;
      }
      const d = isHeadBone(part.bone) ? part.depth || 0 : 0;
      const key = `${part.bone}|${d}`;
      let attr = cache.get(key);
      if (!attr) {
        const m = mats[part.bone];
        if (d) {
          const tx = yaw * PARALLAX.x * d, ty = pitch * PARALLAX.y * d;
          attr = matrixAttr([m[0], m[1], m[2], m[3], m[4] + m[0] * tx + m[2] * ty, m[5] + m[1] * tx + m[3] * ty]);
        } else attr = matrixAttr(m);
        cache.set(key, attr);
      }
      if (attr !== part.last) { part.el.setAttribute('transform', attr); part.last = attr; }
    }
  }

  /** frame: { bones, root: {x,y} }, view: { yaw, pitch, look: {x,y}, lift } */
  function render(frame, view) {
    if (!cfg) return null;
    yaw = view.yaw; pitch = view.pitch;
    const mats = solve(M, P, frame);
    applyMats(mats);
    const lx = f1(view.look.x * 3.2), ly = f1(view.look.y * 2.4);
    const t = `translate(${lx} ${ly})`;
    for (const el of irises) el.setAttribute('transform', t);
    const lift = Math.max(0, -frame.root.y - (view.seatY || 0));
    const k = Math.max(0.45, 1 - lift / 260);
    floor.setAttribute('transform', `translate(${f1(frame.root.x)} 0) translate(200 ${VIEW.ground}) scale(${f1(k)}) translate(-200 ${-VIEW.ground})`);
    return mats;
  }

  function setProp(kind, rootX = 0) {
    propG.innerHTML = kind === 'pouf' && M ? `<g transform="translate(${f1(rootX)} 0)">${pouf(M)}</g>` : '';
  }

  /** World position (viewBox units) of a point on a bone, from the last frame. */
  function worldOf(bone, x, y) {
    return lastMats ? apply(lastMats[bone], x, y) : { x, y };
  }

  return {
    svg, uid, build, render, setExpression, setPoseLook, setProp, worldOf,
    get M() { return M; }, get flags() { return flags; }, get expression() { return expr; },
  };
}
