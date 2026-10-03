// ── Rendering: wardrobe, worn strip, hearts, wish ────────────
// Interpolated text goes through escHtml; item art comes from thumbs.js, which
// draws from catalog data, never from visitor input.

import { CATALOG, CATEGORIES, MILESTONES, itemById } from './catalog.js';
import { isWorn, canAfford, tagCount } from './wardrobe.js';
import { itemThumb } from './thumbs.js';
import { escHtml, $ } from './utils.js';

const HEART = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 21C5 15.4 2 12.2 2 8.4 2 5.4 4.4 3 7.3 3c1.9 0 3.6 1 4.7 2.6C13.1 4 14.8 3 16.7 3 19.6 3 22 5.4 22 8.4c0 3.8-3 7-10 12.6z" fill="currentColor"/></svg>';

let lastHearts = null;
export function renderHearts(s) {
  $('heartCount').textContent = String(s.hearts);
  const el = $('hearts');
  if (lastHearts !== null && s.hearts > lastHearts) {
    el.classList.remove('is-bumped');
    void el.offsetWidth;
    el.classList.add('is-bumped');
  }
  lastHearts = s.hearts;
}

export function renderCategories(s) {
  $('categories').innerHTML = CATEGORIES.map((c) => {
    const items = CATALOG.filter((it) => c.slots.includes(it.slot));
    const fresh = items.some((it) => s.unlocked.has(it.id) && !s.seen.has(it.id));
    return `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === s.ui.category}">${escHtml(c.name)}${fresh ? ' <span aria-label="new items">•</span>' : ''}</button>`;
  }).join('');
}

function meta(s, it) {
  if (isWorn(s, it.id)) return 'Wearing';
  if (s.unlocked.has(it.id)) return 'Ready';
  if (it.unlock.milestone) return 'Milestone';
  return `${HEART} ${it.unlock.hearts}`;
}

function label(s, it) {
  if (isWorn(s, it.id)) return `${it.name}, wearing. Press to take it off.`;
  if (s.unlocked.has(it.id)) return `${it.name}. Press to put it on.`;
  if (it.unlock.milestone) return `${it.name}, locked. ${MILESTONES[it.unlock.milestone]}.`;
  return `${it.name}, locked. Unlock for ${it.unlock.hearts} hearts.`;
}

export function renderItems(s) {
  const cat = CATEGORIES.find((c) => c.id === s.ui.category) || CATEGORIES[0];
  const items = CATALOG.filter((it) => cat.slots.includes(it.slot))
    .sort((a, b) => (s.unlocked.has(b.id) - s.unlocked.has(a.id)) || ((a.unlock.hearts || 0) - (b.unlock.hearts || 0)));
  const fresh = [];
  $('items').innerHTML = items.map((it) => {
    const owned = s.unlocked.has(it.id);
    const cls = ['item'];
    if (!owned) cls.push('is-locked');
    if (!owned && canAfford(s, it)) cls.push('is-affordable');
    if (owned && !s.seen.has(it.id)) { cls.push('is-new'); fresh.push(it.id); }
    if (s.wish && it.tags.includes(s.wish.tag)) cls.push('is-wished');
    return `<li><button class="${cls.join(' ')}" type="button" data-id="${it.id}"${owned ? ` data-drag-id="${it.id}"` : ''}` +
      ` aria-pressed="${isWorn(s, it.id)}" aria-label="${escHtml(label(s, it) + (s.wish && it.tags.includes(s.wish.tag) ? ' Matches her wish.' : ''))}">` +
      `${itemThumb(it, s.head)}<span class="item__name">${escHtml(it.name)}</span>` +
      `<span class="item__meta">${meta(s, it)}</span></button></li>`;
  }).join('');
  for (const id of fresh) s.seen.add(id);
  return fresh.length > 0;
}

export function renderWearing(s) {
  const worn = Object.values(s.outfit).map(itemById).filter(Boolean);
  $('wearing').innerHTML = worn.length
    ? worn.map((it) => `<li><button class="wearing__item" type="button" data-remove="${it.id}" data-drag-id="${it.id}" aria-label="Take off ${escHtml(it.name)}">` +
      `${itemThumb(it, s.head, 'wearing__thumb')}<span>${escHtml(it.name)}</span></button></li>`).join('')
    : '<li class="wearing__empty">Just her slip. Drag something on!</li>';
  const names = worn.map((it) => it.name);
  $('doll').setAttribute('aria-label', `${s.name}${names.length ? `, wearing ${names.join(', ')}` : ', in her slip'}`);
}

export function renderWish(s, done = null) {
  const box = $('request');
  if (done) {
    box.hidden = false;
    box.classList.add('is-done');
    $('requestText').textContent = done.label;
    $('requestProgress').textContent = 'granted!';
    return;
  }
  box.classList.remove('is-done');
  if (!s.wish) { box.hidden = true; return; }
  box.hidden = false;
  $('requestText').textContent = s.wish.label;
  $('requestProgress').textContent = `${Math.min(tagCount(s, s.wish.tag), s.wish.need)} of ${s.wish.need} pieces`;
}
