// ── Wardrobe and hearts ──────────────────────────────────────
// Equipping (with the slot conflicts in docs/RIG.md section 5), unlocking, the
// hearts economy and its daily caps, visit streaks and milestones. No DOM.

import { itemById, CONFLICTS, CATALOG } from './catalog.js';
import { today } from './state.js';

/** Per source: hearts per grant, cooldown in seconds, daily cap. */
const EARN = {
  pat: { amount: 2, cool: 2.5, cap: 60 },
  poke: { amount: 1, cool: 1.5, cap: 15 },
  time: { amount: 1, cool: 55, cap: 60 },
  outfit: { amount: 1, cool: 15, cap: 30 },
  twirl: { amount: 1, cool: 20, cap: 10 },
  wish: { amount: 15, cool: 0, cap: 150 },
  gift: { amount: 20, cool: 0, cap: 20 },
};
const lastAt = {};

function rollDay(s) {
  if (s.daily.date !== today()) s.daily = { date: today(), earned: {} };
}

/** Grant hearts for an action, respecting cooldowns and the daily cap. Returns the grant. */
export function earn(s, source) {
  const rule = EARN[source];
  if (!rule) return 0;
  rollDay(s);
  const now = performance.now() / 1000;
  if (rule.cool && lastAt[source] && now - lastAt[source] < rule.cool) return 0;
  const got = s.daily.earned[source] || 0;
  const amount = Math.min(rule.amount, rule.cap - got);
  if (amount <= 0) return 0;
  lastAt[source] = now;
  s.daily.earned[source] = got + amount;
  s.hearts += amount;
  return amount;
}

export const isWorn = (s, id) => Object.values(s.outfit).includes(id);

/** Put an item on. Returns { ok, removed: [ids] } or { ok: false, reason }. */
export function equip(s, id) {
  const it = itemById(id);
  if (!it) return { ok: false, reason: 'missing' };
  if (!s.unlocked.has(id)) return { ok: false, reason: 'locked' };
  const removed = [];
  for (const slot of CONFLICTS[it.slot] || []) {
    if (s.outfit[slot]) { removed.push(s.outfit[slot]); delete s.outfit[slot]; }
  }
  if (s.outfit[it.slot] && s.outfit[it.slot] !== id) removed.push(s.outfit[it.slot]);
  s.outfit[it.slot] = id;
  s.stats.outfits += 1;
  return { ok: true, item: it, removed };
}

export function unequip(s, id) {
  const it = itemById(id);
  if (!it || s.outfit[it.slot] !== id) return false;
  delete s.outfit[it.slot];
  return true;
}

export const costOf = (it) => it.unlock.hearts || 0;
export const canAfford = (s, it) => !!it.unlock.hearts && s.hearts >= it.unlock.hearts;

export function unlock(s, id) {
  const it = itemById(id);
  if (!it || s.unlocked.has(id) || !canAfford(s, it)) return false;
  s.hearts -= it.unlock.hearts;
  s.unlocked.add(id);
  return true;
}

/** Milestones reached since the last check, with the items they unlock. */
export function checkMilestones(s) {
  const reached = [];
  const test = {
    firstSleep: s.stats.sleeps >= 1,
    pats100: s.stats.pats >= 100,
    streak3: s.stats.streak >= 3,
    wishes5: s.stats.wishes >= 5,
  };
  for (const [id, ok] of Object.entries(test)) {
    if (!ok || s.milestones.has(id)) continue;
    s.milestones.add(id);
    for (const it of CATALOG) {
      if (it.unlock.milestone === id && !s.unlocked.has(it.id)) { s.unlocked.add(it.id); reached.push(it); }
    }
  }
  return reached;
}

/**
 * Record today's visit. Returns { first, daysAway, gift } where gift is an item
 * unlocked as today's present, or 'hearts' when every cheap item is owned.
 */
export function visit(s) {
  const d = today();
  const prev = s.stats.lastVisit;
  const first = !prev;
  let daysAway = 0;
  if (prev && prev !== d) {
    daysAway = Math.round((Date.parse(d) - Date.parse(prev)) / 86400000);
    s.stats.streak = daysAway === 1 ? s.stats.streak + 1 : 1;
    s.stats.days += 1;
  } else if (first) {
    s.stats.streak = 1; s.stats.days = 1; s.stats.firstVisit = d;
  }
  s.stats.lastVisit = d;
  let gift = null;
  if (!first && s.stats.lastGift !== d) {
    s.stats.lastGift = d;
    const pool = CATALOG.filter((it) => !s.unlocked.has(it.id) && it.unlock.hearts && it.unlock.hearts <= 30);
    if (pool.length) {
      gift = pool[Math.floor(Math.random() * pool.length)];
      s.unlocked.add(gift.id);
    } else if (earn(s, 'gift')) gift = 'hearts';
  }
  if (first) s.stats.lastGift = d;
  return { first, daysAway, gift };
}

/** How many worn pieces carry a tag. */
export function tagCount(s, tag) {
  return Object.values(s.outfit).map(itemById).filter((it) => it && it.tags.includes(tag)).length;
}
