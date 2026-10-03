// ── Rendering: style, poses, rooms, looks, progress ──────────

import { SKIN, HAIR, EYES, EYE_STYLES, FRONT_STYLES, BACK_STYLES, MOUTHS, HEADS } from './looks.js';
import { PICKABLE } from './poses.js';
import { BACKDROPS } from './stage.js';
import { CATALOG } from './catalog.js';
import { miniDoll } from './thumbs.js';
import { escHtml, $ } from './utils.js';

const get = (s, path) => path.split('.').reduce((o, k) => o?.[k], s);

function swatches(label, list, path, s, key = 'base') {
  const cur = get(s, path);
  return `<fieldset class="control-row"><legend class="field__label">${label}</legend><div class="swatches">` +
    list.map((x) => `<button class="swatch" type="button" style="--sw:${x[key]}" data-set="${path}" data-val="${x.id}" aria-pressed="${x.id === cur}" aria-label="${escHtml(x.name)}" title="${escHtml(x.name)}"></button>`).join('') +
    '</div></fieldset>';
}

function chips(label, list, path, s) {
  const cur = get(s, path);
  return `<fieldset class="control-row"><legend class="field__label">${label}</legend><div class="chips">` +
    list.map((x) => `<button class="chip" type="button" data-set="${path}" data-val="${x.id}" aria-pressed="${x.id === cur}">${escHtml(x.name)}</button>`).join('') +
    '</div></fieldset>';
}

function range(label, path, s, lo, hi, step, ends) {
  const id = `r-${path.replace('.', '-')}`;
  return `<div class="control-row"><label class="field__label" for="${id}">${label}</label>` +
    `<input class="range" type="range" id="${id}" min="${lo}" max="${hi}" step="${step}" value="${get(s, path)}" data-range="${path}">` +
    `<div class="range-labels" aria-hidden="true"><span>${ends[0]}</span><span>${ends[1]}</span></div></div>`;
}

const toggle = (label, path, s) =>
  `<label class="toggle"><input type="checkbox" data-toggle="${path}"${get(s, path) ? ' checked' : ''}>${label}</label>`;

export function renderStyle(s) {
  $('dollName').value = s.name;
  $('styleControls').innerHTML = [
    `<fieldset class="control-row"><legend class="field__label">Ready-made heads</legend><div class="chips">${HEADS.map((h) => `<button class="chip" type="button" data-head="${h.id}">${escHtml(h.name)}</button>`).join('')}</div></fieldset>`,
    swatches('Hair colour', HAIR, 'head.hair', s),
    chips('Bangs', FRONT_STYLES, 'head.front', s),
    chips('Hairstyle', BACK_STYLES, 'head.back', s),
    toggle('Ahoge (the little sprout on top)', 'head.ahoge', s),
    swatches('Eye colour', EYES, 'head.eyes', s),
    chips('Eye shape', EYE_STYLES, 'head.eyeStyle', s),
    chips('Resting mouth', MOUTHS, 'head.mouth', s),
    range('Blush', 'head.blush', s, 0, 2, 1, ['None', 'Rosy']),
    toggle('Freckles', 'head.freckles', s),
    chips('Beauty mark', [{ id: 'none', name: 'None' }, { id: 'L', name: 'Left' }, { id: 'R', name: 'Right' }], 'head.mark', s),
    swatches('Skin', SKIN, 'body.skin', s),
    range('Height', 'body.height', s, 0, 1, 0.05, ['Petite', 'Tall']),
    range('Build', 'body.build', s, 0, 1, 0.05, ['Slender', 'Soft']),
  ].join('');
}

export function renderPoses(s, current) {
  $('poses').innerHTML = PICKABLE.map((p) =>
    `<button class="chip" type="button" data-pose="${p.id}" aria-pressed="${p.id === current}">${escHtml(p.label)}</button>`).join('');
  $('backdrops').innerHTML = BACKDROPS.map((b) =>
    `<button class="chip" type="button" data-backdrop="${b.id}" aria-pressed="${b.id === s.backdrop}">${escHtml(b.name)}</button>`).join('');
}

export function renderLooks(s) {
  const list = $('looks');
  if (!s.looks.length) {
    list.innerHTML = '<li class="panel__hint">No saved looks yet. Dress her up, name it, and save it here.</li>';
    return;
  }
  list.innerHTML = s.looks.map((l) => `<li class="look">` +
    `<button class="look__wear" type="button" data-look="${escHtml(l.id)}" aria-label="Wear ${escHtml(l.name)}"><svg preserveAspectRatio="xMidYMax meet" aria-hidden="true"></svg></button>` +
    `<div class="look__bar"><span class="look__name">${escHtml(l.name)}</span>` +
    `<button class="btn btn--ghost btn--sm" type="button" data-unlook="${escHtml(l.id)}" aria-label="Remove ${escHtml(l.name)}">Remove</button></div></li>`).join('');
  list.querySelectorAll('.look__wear svg').forEach((svg, i) => miniDoll(svg, s.looks[i]));
}

export function renderStats(s) {
  const rows = [
    ['Days together', s.stats.days],
    ['Visit streak', `${s.stats.streak} day${s.stats.streak === 1 ? '' : 's'}`],
    ['Minutes together', s.stats.minutes],
    ['Head pats', s.stats.pats],
    ['Wishes granted', s.stats.wishes],
    ['Outfit changes', s.stats.outfits],
    ['Wardrobe', `${s.unlocked.size} of ${CATALOG.length}`],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escHtml(String(v))}</dd>`).join('');
}
