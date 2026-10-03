// ── Wiring ───────────────────────────────────────────────────
// Every listener, bound once. Lists use delegation; renderers only redraw.

import { state, save, dollConfig, cleanHead } from './state.js';
import { itemById, MILESTONES } from './catalog.js';
import { equip, unequip, unlock, isWorn, canAfford } from './wardrobe.js';
import { HEADS } from './looks.js';
import { LINES } from './lines.js';
import { renderHearts, renderCategories, renderItems, renderWearing, renderWish } from './render.js';
import { renderStyle, renderPoses, renderLooks, renderStats } from './panels.js';
import { drawBackdrop } from './stage.js';
import { bindDnd } from './dnd.js';
import { popOut, canPopOut, setCompanionView, snapshot, inPip } from './companion.js';
import { openDialog, bindDialog } from './dialogs.js';
import { itemThumb } from './thumbs.js';
import { showToast, escHtml, $ } from './utils.js';

let app = null;

const rebuild = () => { app.doll.build(dollConfig(state)); app.motion.retarget(); renderWearing(state); };
function refreshWardrobe() { if (renderItems(state)) save(state); renderCategories(state); }

/** Hooks the behaviour engine calls back into the page with. */
export function makeHooks() {
  return {
    changed(kind) {
      if (kind === 'hearts') { renderHearts(state); refreshWardrobe(); }
      if (kind === 'wardrobe') refreshWardrobe();
      if (kind === 'wish') { renderWish(state); refreshWardrobe(); }
      save(state);
    },
    wishDone(w) { renderWish(state, w); setTimeout(() => renderWish(state), 2600); },
    toast: (msg) => showToast(msg),
    save: () => save(state),
    inPip,
  };
}

export function renderAll(current = 'stand') {
  renderHearts(state); refreshWardrobe(); renderWearing(state); renderWish(state);
  renderStyle(state); renderPoses(state, current); renderLooks(state); renderStats(state);
  drawBackdrop($('backdrop'), state.backdrop);
}

function putOn(id) {
  const r = equip(state, id);
  if (!r.ok) return;
  rebuild(); refreshWardrobe();
  app.behavior.dressed(r.item);
  save(state);
}

function takeOff(id) {
  if (!unequip(state, id)) return;
  rebuild(); refreshWardrobe();
  app.behavior.undressed();
  save(state);
}

let pending = null;
function openUnlock(it, opener) {
  pending = it;
  $('unlockTitle').textContent = it.name;
  $('unlockThumb').innerHTML = itemThumb(it, state.head, 'unlock__art');
  const confirm = $('unlockConfirm');
  if (it.unlock.milestone) {
    $('unlockText').textContent = `This one unlocks by itself when you reach a milestone: ${MILESTONES[it.unlock.milestone].toLowerCase()}.`;
    confirm.hidden = true;
  } else {
    const short = it.unlock.hearts - state.hearts;
    confirm.hidden = false;
    confirm.disabled = short > 0;
    confirm.textContent = `Unlock for ${it.unlock.hearts} hearts`;
    $('unlockText').textContent = short > 0
      ? `You have ${state.hearts} hearts, ${short} short. Pat her head, grant her wishes, or simply keep her company: every minute together earns a heart.`
      : `You have ${state.hearts} hearts. She will put it on straight away.`;
  }
  openDialog($('unlockDialog'), opener);
}

function bindTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
    state.ui.tab = tab.id.replace('tab-', '');
    if (state.ui.tab === 'looks') renderStats(state);
  };
  for (const t of tabs) {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
      if (next) { e.preventDefault(); next.focus(); select(next); }
    });
  }
}

function setPath(path, val) {
  const [group, key] = path.split('.');
  state[group] = { ...state[group], [key]: val };
  if (group === 'head') state.head = cleanHead(state.head);
  rebuild();
}

function bindStyle() {
  const box = $('styleControls');
  box.addEventListener('click', (e) => {
    const set = e.target.closest('[data-set]');
    const head = e.target.closest('[data-head]');
    if (set) setPath(set.dataset.set, set.dataset.val);
    else if (head) { state.head = cleanHead(HEADS.find((h) => h.id === head.dataset.head)?.head); rebuild(); }
    else return;
    renderStyle(state); refreshWardrobe(); save(state);
  });
  box.addEventListener('input', (e) => {
    if (e.target.dataset.range) setPath(e.target.dataset.range, Number(e.target.value));
  });
  box.addEventListener('change', (e) => {
    if (e.target.dataset.toggle) { setPath(e.target.dataset.toggle, e.target.checked); refreshWardrobe(); }
    save(state);
  });
  const name = $('dollName');
  name.addEventListener('input', () => { state.name = name.value.trim().slice(0, 20) || 'Bijou'; renderWearing(state); });
  name.addEventListener('change', () => { app.behavior.renamed(); save(state); });
}

function bindLooks() {
  $('lookForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.looks.length >= 8) { showToast('Eight looks saved already. Remove one to make room.'); return; }
    const field = $('lookName');
    state.looks.push({
      id: `l${Date.now().toString(36)}`, name: field.value.trim().slice(0, 24) || `Look ${state.looks.length + 1}`,
      body: { ...state.body }, head: { ...state.head }, outfit: { ...state.outfit }, backdrop: state.backdrop,
    });
    field.value = '';
    renderLooks(state); save(state);
    app.behavior.saw(LINES.look);
  });
  $('looks').addEventListener('click', (e) => {
    const wear = e.target.closest('[data-look]');
    const drop = e.target.closest('[data-unlook]');
    if (wear) {
      const l = state.looks.find((x) => x.id === wear.dataset.look);
      if (!l) return;
      Object.assign(state, { body: { ...l.body }, head: { ...l.head }, outfit: Object.fromEntries(Object.entries(l.outfit).filter(([, id]) => state.unlocked.has(id))), backdrop: l.backdrop });
      rebuild(); renderAll(app.motion.pose.id); save(state);
      app.behavior.dressed({ tags: [], slot: 'look', kind: 'look' });
    } else if (drop) {
      const l = state.looks.find((x) => x.id === drop.dataset.unlook);
      state.looks = state.looks.filter((x) => x !== l);
      renderLooks(state); save(state);
      if (l) showToast(`Removed ${l.name}`);
    }
  });
}

export function bindEvents(ctx) {
  app = ctx;
  bindTabs(); bindStyle(); bindLooks();
  bindDialog($('unlockDialog'), $('items'));
  bindDialog($('companionDialog'), $('popOut'));

  const dnd = bindDnd({
    panel: $('panel-wardrobe'), wearing: $('wearing'), stage: $('stage'), hint: $('dropHint'),
    canDrag: (id) => state.unlocked.has(id), onDrop: putOn, onRemove: takeOff,
  });

  $('categories').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.ui.category = b.dataset.cat;
    refreshWardrobe();
  });
  $('items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b || dnd.swallowClick()) return;
    const it = itemById(b.dataset.id);
    if (!state.unlocked.has(it.id)) openUnlock(it, b);
    else if (isWorn(state, it.id)) takeOff(it.id);
    else putOn(it.id);
  });
  $('wearing').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (b && !dnd.swallowClick()) takeOff(b.dataset.remove);
  });
  $('unlockConfirm').addEventListener('click', () => {
    const it = pending;
    if (!it || !canAfford(state, it) || !unlock(state, it.id)) return;
    $('unlockDialog').close();
    renderHearts(state);
    app.behavior.unlocked(it);
    putOn(it.id);
  });

  $('poses').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pose]');
    if (!b) return;
    app.behavior.choosePose(b.dataset.pose);
    renderPoses(state, b.dataset.pose);
  });
  $('backdrops').addEventListener('click', (e) => {
    const b = e.target.closest('[data-backdrop]');
    if (!b) return;
    state.backdrop = b.dataset.backdrop;
    drawBackdrop($('backdrop'), state.backdrop);
    renderPoses(state, app.motion.pose.id); save(state);
  });

  $('stage').querySelector('.stage-tools').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'twirl') app.behavior.twirl();
    if (act === 'pat') app.behavior.pat();
    if (act === 'ask') app.behavior.ask();
  });

  $('popOut').addEventListener('click', async () => {
    const ok = canPopOut() && await popOut({ stage: $('stage'), motion: app.motion, title: state.name }).catch(() => false);
    if (!ok) {
      $('companionView').textContent = document.body.classList.contains('is-companion') ? 'Leave companion view' : 'Companion view';
      openDialog($('companionDialog'), $('popOut'));
    }
  });
  $('companionView').addEventListener('click', () => {
    setCompanionView(!document.body.classList.contains('is-companion'));
    $('companionDialog').close();
  });
  $('snapshot').addEventListener('click', async () => {
    const ok = await snapshot({ backdrop: $('backdrop'), doll: app.doll.svg, name: state.name }).catch(() => false);
    if (ok) app.behavior.saw(LINES.snapshot); else showToast('The picture could not be saved in this browser.');
  });
}
