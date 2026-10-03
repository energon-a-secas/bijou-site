// ── Entry point ──────────────────────────────────────────────
// Wires the doll, her motion and her behaviour to the page. Keep under 50 lines.

import { state, loadSaved, save, dollConfig } from './state.js';
import { createDoll } from './doll.js';
import { createMotion } from './motion.js';
import { createFx } from './fx.js';
import { createBehavior } from './behavior.js';
import { bindDoll } from './interact.js';
import { visit } from './wardrobe.js';
import { setCompanionView } from './companion.js';
import { bindEvents, makeHooks, renderAll } from './events.js';
import { $ } from './utils.js';

function init() {
  loadSaved(state);
  const info = visit(state);
  const stage = $('stage');
  const doll = createDoll($('doll'));
  const fx = createFx({ stage, layer: $('fx'), bubble: $('bubble'), live: $('speech'), doll });
  let behavior = null;
  const motion = createMotion(doll, {
    bounds() {
      const k = Math.min(stage.clientWidth / 400, (stage.clientHeight * 0.95) / 820) || 1;
      const half = stage.clientWidth / k / 2 - 70;
      return { minX: -Math.max(0, half), maxX: Math.max(0, half) };
    },
    onLand: () => behavior?.landed(),
    onFrame: () => fx.place(),
  });
  doll.build(dollConfig(state));
  behavior = createBehavior({ state, doll, motion, fx, hooks: makeHooks() });
  bindDoll({ stage, doll, motion, behavior });
  bindEvents({ doll, motion, behavior, fx });
  if (new URLSearchParams(location.search).get('view') === 'companion') setCompanionView(true);
  renderAll();
  motion.start();
  behavior.start(info);
  save(state, true);
}

init();
