// ── State ────────────────────────────────────────────────────
// One namespaced, versioned store through the Persist Kit. Every field read
// back from storage is validated against the data it names, so a stale or
// edited save can never hand the doll an item, colour or pose that is gone.

import { createStore } from './neorgon-persist.js';
import { DEFAULT_BODY, DEFAULT_HEAD, SKIN, HAIR, EYES, EYE_STYLES, FACE_SHAPES, FRONT_STYLES, BACK_STYLES, MOUTHS } from './looks.js';
import { STARTER_OUTFIT, FREE_IDS, itemById, SLOTS, MILESTONES, cleanGarments } from './catalog.js';
import { BACKDROPS } from './stage.js';
import { SHAPE_KEYS, SHAPE_DEFAULTS, MOTION_DEFAULTS, NAIL_DEFAULTS, NAIL_SHAPES, NAIL_COLORS } from './body-shape.js';
import { ARCHETYPES } from './archetypes.js';
import { RENDER_QUALITIES } from './render-quality.js';
import { cleanRenderStyle } from './render-style.js';

const store = createStore({ key: 'bijou-site:save', version: 1 });

/** The visitor's local calendar date: the day rolls over at their midnight, not UTC's. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const state = {
  name: 'Bijou',
  renderQuality:'balanced',
  renderStyle:'anime3d',
  body: { ...DEFAULT_BODY },
  head: { ...DEFAULT_HEAD },
  outfit: { ...STARTER_OUTFIT },
  garments:{},
  unlocked: new Set(FREE_IDS),
  seen: new Set(FREE_IDS),
  hearts: 0,
  milestones: new Set(),
  stats: { pats: 0, pokes: 0, twirls: 0, wishes: 0, outfits: 0, minutes: 0, sleeps: 0, days: 0, streak: 0, lastVisit: null, lastGift: null, firstVisit: null },
  daily: { date: today(), earned: {} },
  backdrop: 'atelier',
  looks: [],
  wish: null,
  // Runtime only, never saved.
  ui: { tab: 'wardrobe', category: 'featured' },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const inList = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);
const num = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const str = (v, max, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function cleanBody(b) {
  if (!isObj(b)) return { ...DEFAULT_BODY };
  return {
    height: num(b.height, 0, 1, 0.5), skin: inList(SKIN, b.skin, DEFAULT_BODY.skin),
    archetype:inList(ARCHETYPES,b.archetype,DEFAULT_BODY.archetype),
    ...Object.fromEntries(SHAPE_KEYS.map(k=>[k,num(b[k],0,1,SHAPE_DEFAULTS[k])])),
    ...Object.fromEntries(Object.entries(MOTION_DEFAULTS).map(([k,v])=>[k,num(b[k],0,1,v)])),
    nailLength:num(b.nailLength,0,1,NAIL_DEFAULTS.nailLength),nailShape:inList(NAIL_SHAPES,b.nailShape,NAIL_DEFAULTS.nailShape),nailColor:inList(NAIL_COLORS,b.nailColor,NAIL_DEFAULTS.nailColor),
  };
}

export function cleanHead(h) {
  if (!isObj(h)) return { ...DEFAULT_HEAD };
  return {
    hair: inList(HAIR, h.hair, DEFAULT_HEAD.hair),
    front: inList(FRONT_STYLES, h.front, DEFAULT_HEAD.front),
    back: inList(BACK_STYLES, h.back, DEFAULT_HEAD.back),
    ahoge: typeof h.ahoge === 'boolean' ? h.ahoge : DEFAULT_HEAD.ahoge,
    eyes: inList(EYES, h.eyes, DEFAULT_HEAD.eyes),
    face: inList(FACE_SHAPES, h.face, DEFAULT_HEAD.face),
    eyeStyle: inList(EYE_STYLES, h.eyeStyle, DEFAULT_HEAD.eyeStyle),
    mouth: inList(MOUTHS, h.mouth, DEFAULT_HEAD.mouth),
    ...Object.fromEntries(['hairMotion','hairStiffness','hairDamping'].map(k=>[k,num(h[k],0,1,DEFAULT_HEAD[k])])),
    blush: num(h.blush, 0, 2, 1),
    freckles: !!h.freckles,
    mark: ['none', 'L', 'R'].includes(h.mark) ? h.mark : 'none',
  };
}

/** Only known slots holding known, unlocked items of that slot. */
export function cleanOutfit(o, unlocked) {
  const out = {};
  if (!isObj(o)) return out;
  for (const slot of SLOTS) {
    const it = itemById(o[slot]);
    if (it && it.slot === slot && unlocked.has(it.id)) out[slot] = it.id;
  }
  return out;
}

export function loadSaved(s) {
  const saved = store.load(null);
  if (!isObj(saved)) return false;
  const ids = (arr) => new Set((Array.isArray(arr) ? arr : []).filter((id) => itemById(id)));
  s.unlocked = new Set([...FREE_IDS, ...ids(saved.unlocked)]);
  s.seen = new Set([...FREE_IDS, ...ids(saved.seen)]);
  s.name = str(saved.name, 20, 'Bijou');
  s.renderQuality=inList(RENDER_QUALITIES,saved.renderQuality,'balanced');
  s.renderStyle=cleanRenderStyle(saved.renderStyle);
  s.body = cleanBody(saved.body);
  s.head = cleanHead(saved.head);
  s.outfit = cleanOutfit(saved.outfit, s.unlocked);
  s.garments=cleanGarments(saved.garments);
  const retired={top:'top-tie',outer:'outer-blazer',bottom:'bottom-circuit',legwear:'legs-thigh',shoes:'shoes-glow',hairacc:'hair-loops',wrist:'wrist-beads'};
  if(Object.keys(s.outfit).length===7&&Object.entries(retired).every(([k,v])=>s.outfit[k]===v))s.outfit={...STARTER_OUTFIT};
  const oldHead={hair:'ember',front:'messy',back:'wavybob',face:'soft',eyes:'copper',eyeStyle:'sparkle',mouth:'smile',ahoge:false,blush:1,freckles:false,mark:'none'};
  if(Object.entries(oldHead).every(([k,v])=>s.head[k]===v))s.head={...DEFAULT_HEAD};
  s.hearts = Math.floor(num(saved.hearts, 0, 99999, 0));
  s.milestones = new Set((Array.isArray(saved.milestones) ? saved.milestones : []).filter((m) => m in MILESTONES));
  const st = isObj(saved.stats) ? saved.stats : {};
  for (const k of ['pats', 'pokes', 'twirls', 'wishes', 'outfits', 'minutes', 'sleeps', 'days', 'streak']) {
    s.stats[k] = Math.floor(num(st[k], 0, 1e7, 0));
  }
  for (const k of ['lastVisit', 'lastGift', 'firstVisit']) s.stats[k] = isDate(st[k]) ? st[k] : null;
  const d = isObj(saved.daily) ? saved.daily : {};
  s.daily = isDate(d.date) && d.date === today() && isObj(d.earned)
    ? { date: d.date, earned: Object.fromEntries(Object.entries(d.earned).map(([k, v]) => [k, Math.floor(num(v, 0, 1e5, 0))])) }
    : { date: today(), earned: {} };
  s.backdrop = inList(BACKDROPS, saved.backdrop, 'dreamy');
  s.looks = (Array.isArray(saved.looks) ? saved.looks : []).slice(0, 8).filter(isObj).map((l) => ({
    id: str(l.id, 24, `l${Math.random().toString(36).slice(2, 8)}`),
    name: str(l.name, 24, 'Look'),
    body: cleanBody(l.body), head: cleanHead(l.head),
    renderStyle:cleanRenderStyle(l.renderStyle),
    garments:cleanGarments(l.garments),
    outfit: cleanOutfit(l.outfit, s.unlocked), backdrop: inList(BACKDROPS, l.backdrop, 'dreamy'),
    preview: typeof l.preview === 'string' && l.preview.length < 180000 && /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(l.preview) ? l.preview : null,
  }));
  return true;
}

let timer = 0;
/** Debounced: interactions fire many small changes. false means saving failed. */
export function save(s, now = false) {
  const write = () => store.save({
    name: s.name, body: s.body, head: s.head, outfit: s.outfit,garments:s.garments,renderQuality:s.renderQuality,renderStyle:s.renderStyle,
    unlocked: [...s.unlocked], seen: [...s.seen], hearts: s.hearts,
    milestones: [...s.milestones], stats: s.stats, daily: s.daily,
    backdrop: s.backdrop, looks: s.looks,
  });
  clearTimeout(timer);
  if (now) return write();
  timer = setTimeout(write, 400);
  return true;
}

/** The doll's build config. */
export const dollConfig = (s) => ({ body: s.body, head: s.head, outfit: s.outfit,garments:s.garments,quality:s.renderQuality,renderStyle:s.renderStyle });
