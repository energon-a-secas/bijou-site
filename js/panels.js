// ── Rendering: style, poses, rooms, looks, progress ──────────

import { SKIN, HAIR, EYES, EYE_STYLES, FACE_SHAPES, FRONT_STYLES, BACK_STYLES, MOUTHS, HEADS } from './looks.js';
import { PICKABLE } from './poses.js';
import { BACKDROPS } from './stage.js';
import { CATALOG } from './catalog.js';
import { COLLECTIONS, matchingCollection } from './collections.js';
import { miniDoll } from './thumbs.js';
import { escHtml, $ } from './utils.js';
import { RENDER_STYLES } from './render-style.js';

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
    `<fieldset class="control-row"><legend class="field__label">Rendering style</legend><div class="chips">${RENDER_STYLES.map(f=>`<button class="chip" type="button" data-render-style="${f.id}" aria-pressed="${s.renderStyle===f.id}">${f.name}</button>`).join('')}</div><p class="panel__hint">${RENDER_STYLES.find(f=>f.id===s.renderStyle)?.detail||RENDER_STYLES[0].detail}</p></fieldset>`,
    `<fieldset class="control-row"><legend class="field__label">Ready-made heads</legend><div class="chips">${HEADS.map((h) => `<button class="chip" type="button" data-head="${h.id}" aria-pressed="${Object.entries(h.head).every(([k,v])=>s.head[k]===v)}">${escHtml(h.name)}</button>`).join('')}</div></fieldset>`,
    swatches('Hair colour', HAIR, 'head.hair', s),
    chips('Bangs', FRONT_STYLES, 'head.front', s),
    chips('Hairstyle', BACK_STYLES, 'head.back', s),
    `<details class="body-details"><summary>Hair motion</summary>${range('Movement','head.hairMotion',s,0,1,.05,['Off','Flowing'])}${range('Stiffness','head.hairStiffness',s,0,1,.05,['Loose','Held shape'])}${range('Damping','head.hairDamping',s,0,1,.05,['Springy','Calm'])}<p class="panel__hint">Pauses while shaping and with reduced motion.</p></details>`,
    toggle('Ahoge (the little sprout on top)', 'head.ahoge', s),
    `<fieldset class="control-row"><legend class="field__label">Face shape</legend><div class="face-options">${FACE_SHAPES.map(f=>`<button class="face-option" type="button" data-set="head.face" data-val="${f.id}" aria-pressed="${s.head.face===f.id}"><img src="assets/previews/face-${f.id}.webp" alt="" width="240" height="240" loading="lazy"><span>${escHtml(f.name)}</span></button>`).join('')}</div></fieldset>`,
    swatches('Eye colour', EYES, 'head.eyes', s),
    chips('Eye shape', EYE_STYLES, 'head.eyeStyle', s),
    chips('Resting mouth', MOUTHS, 'head.mouth', s),
    range('Blush', 'head.blush', s, 0, 2, 1, ['None', 'Rosy']),
    toggle('Freckles', 'head.freckles', s),
    chips('Beauty mark', [{ id: 'none', name: 'None' }, { id: 'L', name: 'Left' }, { id: 'R', name: 'Right' }], 'head.mark', s),
    swatches('Skin', SKIN, 'body.skin', s),
  ].join('');
}

export function renderCollections(s) {
  const box = $('collections');
  if (!box.childElementCount) {
    box.innerHTML = COLLECTIONS.map(c => `<button class="collection collection--${c.tone}" type="button" data-collection="${c.id}" aria-label="Wear ${escHtml(c.name)}: change hair and outfit" aria-pressed="false"><img src="assets/previews/${c.id}.webp" alt="" width="312" height="640"><span class="collection__copy"><strong>${escHtml(c.name)}</strong><span>${escHtml(c.detail)}</span></span></button>`).join('');
  }
  const selected = matchingCollection(s);
  box.querySelectorAll('[data-collection]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.collection === selected?.id)));
  $('stageLook').textContent = selected?.name || 'Your own creation';
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
    `<button class="look__wear" type="button" data-look="${escHtml(l.id)}" aria-label="Wear ${escHtml(l.name)}">${l.preview ? `<img src="${escHtml(l.preview)}" alt="" width="146" height="300">` : '<svg preserveAspectRatio="xMidYMax meet" aria-hidden="true"></svg>'}</button>` +
    `<div class="look__bar"><span class="look__name">${escHtml(l.name)}</span>` +
    `<button class="btn btn--ghost btn--sm" type="button" data-unlook="${escHtml(l.id)}" aria-label="Remove ${escHtml(l.name)}">Remove</button></div></li>`).join('');
  list.querySelectorAll('.look__wear').forEach((button, i) => { const svg=button.querySelector('svg'); if(svg)miniDoll(svg,s.looks[i]); });
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
