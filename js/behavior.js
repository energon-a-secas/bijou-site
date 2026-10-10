// ── Behaviour ────────────────────────────────────────────────
// Her mind: what pose and face she wears, when she talks, idles, gets sleepy,
// reacts and asks for things. Decides four times a second; the motion loop
// does the moving.

import { POSES } from './poses.js';
import { LINES, WISHES, pick } from './lines.js';
import { earn, checkMilestones, tagCount } from './wardrobe.js';
import { CATALOG } from './catalog.js';
import { archetypeFor } from './archetypes.js';

const rand = (a, b) => a + Math.random() * (b - a);
const IDLE = [
  ['stretch', 3], ['behind', 3], ['think', 2], ['admire', 2], ['shy', 2], ['sit', 2], ['hum', 2], ['twirl', 1],
];

export function createBehavior({ state, doll, motion, fx, hooks }) {
  const now = () => performance.now();
  let base = 'stand', userUntil = 0, temp = null, exprTemp = null;
  let lastInteract = now(), asleep = false, sleepy = false, sulkUntil = 0;
  let nextIdle = now() + rand(9000, 15000), nextWishAt = now() + 50000, nextZ = 0, lastMinute = now();
  let lastSay = 0, pokes = [], lastWishTag = null, curPose = null, timer = 0;
  let editing = false;

  const vars = () => ({ name: state.name });
  function say(list, chance = 1, extra = {}, force = false) {
    if (Math.random() > chance) return;
    if (!force && fx.speaking && now() - lastSay < 1800) return;
    lastSay = now();
    fx.say(pick(list, { ...vars(), ...extra }));
  }
  const holdPose = (pose, ms) => { temp = { pose, until: now() + ms }; apply(); };
  const face = (name, ms) => { exprTemp = { name, until: now() + ms }; apply(); };

  function milestoneCheck() {
    for (const it of checkMilestones(state)) {
      hooks.toast(`Unlocked by a milestone: ${it.name}`);
      say(LINES.milestone, 1, {}, true);
      hooks.changed('wardrobe');
    }
  }
  function grant(source) {
    if (earn(state, source)) hooks.changed('hearts');
  }

  // ── Pose and face ────────────────────────────────────────
  function poseNow(t) {
    if(editing)return 'shape';
    if (temp && t < temp.until) return temp.pose;
    temp = null;
    if (asleep) return 'sleep';
    if (sleepy) return 'sit';
    if (t < userUntil) return base;
    return archetypeFor(state.body.archetype).pose;
  }

  function apply() {
    const t = now();
    const pose = poseNow(t);
    if (pose !== curPose) { curPose = pose; motion.setPose(pose); }
    let expr;
    if (exprTemp && t < exprTemp.until) expr = exprTemp.name;
    else if (asleep) expr = 'sleep';
    else if (sleepy) expr = 'sleepy';
    else if (t < sulkUntil) expr = 'pout';
    else expr = POSES[pose]?.expr || 'smile';
    doll.setExpression(expr);
  }

  // ── Idle, sleep, time ────────────────────────────────────
  function doIdle() {
    const choices=archetypeFor(state.body.archetype).idle||IDLE;
    const total = choices.reduce((n, [, w]) => n + w, 0);
    let r = Math.random() * total, kind = 'stretch';
    for (const [k, w] of choices) { if ((r -= w) <= 0) { kind = k; break; } }
    switch (kind) {
      case 'stretch': holdPose('stretch', 2600); say(['Mmmh~', '*stretch*'], 0.4); break;
      case 'behind': holdPose('behind', 6000); fx.burst('note', 2, 236, 120); say(LINES.idleHum, 0.4); break;
      case 'think': holdPose('think', 4200); say(LINES.idleThink, 0.5); break;
      case 'admire': holdPose('admire', 3000); say(LINES.idleOutfit, 0.5); break;
      case 'shy': holdPose('shy', 4000); break;
      case 'wave': holdPose('wave', 2200); break;
      case 'hips': holdPose('hips', 3600); break;
      case 'sit': holdPose('sit', 16000); break;
      case 'hum': fx.burst('note', 3, 236, 120); say(LINES.idleHum, 0.7); break;
      default: twirl(true);
    }
  }

  function decide() {
    if(editing)return;
    const t = now();
    const visible = stageVisible();
    if (visible && t - lastMinute >= 60000) {
      lastMinute = t; state.stats.minutes += 1; grant('time'); hooks.save();
    }
    const night = new Date().getHours() >= 23 || new Date().getHours() < 6;
    const idle = t - lastInteract;
    if (!asleep && !motion.busy && idle > (night ? 140000 : 260000)) {
      asleep = true; sleepy = false; motion.asleep = true; temp = null;
      state.stats.sleeps += 1; milestoneCheck(); hooks.save();
    } else if (!asleep && !sleepy && idle > (night ? 70000 : 150000)) {
      sleepy = true; temp = null; say(LINES.sleepy, 1);
    }
    if (asleep && t > nextZ) { fx.burst('zz', 1, 236, 112); nextZ = t + 2600; }
    if (!asleep && !sleepy && !temp && t > userUntil && t > nextIdle && !motion.busy) {
      doIdle(); nextIdle = t + rand(9000, 20000)/archetypeFor(state.body.archetype).tempo;
    }
    if (!state.wish && !asleep && t > nextWishAt) makeWish();
    apply();
  }

  function stageVisible() {
    return hooks.inPip?.() || document.visibilityState === 'visible';
  }

  // ── Reactions ────────────────────────────────────────────
  function interacted() {
    lastInteract = now();
    if (asleep) wake();
    sleepy = false;
  }

  function wake() {
    asleep = false; motion.asleep = false; temp = null;
    face('surprised', 1200);
    say(LINES.wake, 1, {}, true);
  }

  function pat() {
    state.stats.pats += 1;
    grant('pat');
    milestoneCheck();
    if (asleep) { fx.burst('heart', 1, 200, 140); say(LINES.patAsleep, 0.3); return; }
    interacted();
    face(Math.random() < 0.5 ? 'love' : 'joy', 1600);
    motion.poke(0.5);
    fx.burst('heart', 2, 200, 130);
    say(LINES.pat, 0.3);
  }

  function poke(region) {
    interacted();
    const t = now();
    pokes = pokes.filter((p) => p > t - 6000).concat(t);
    state.stats.pokes += 1;
    if (pokes.length >= 5) {
      sulkUntil = t + 4500; pokes = [];
      face('pout', 4500);
      say(LINES.pokeTooMuch, 1, {}, true);
      return;
    }
    if (t < sulkUntil) return;
    motion.poke(1);
    if (region === 'cheek') { face('pout', 1300); say(LINES.pokeCheek, 0.6); }
    else { face('happy', 1200); if (Math.random() < 0.4) motion.play('hop'); say(LINES.pokeBody, 0.45); }
    grant('poke');
  }

  function lifted() {
    interacted();
    temp = { pose: 'dangle', until: Infinity };
    face('surprised', 99999);
    say(LINES.lifted, 0.7, {}, true);
  }

  function landed() {
    temp = null;
    face('dizzy', 1400);
    setTimeout(() => { face('happy', 1500); say(LINES.landed, 0.8); }, 900);
  }

  function dressed(item) {
    interacted();
    if (!POSES[curPose]?.prop) holdPose('admire', 2200);
    face('happy', 2200);
    fx.burst('sparkle', 3, 200, 300);
    const tag = item.tags.find((g) => LINES.dressedTag[g]);
    if (tag && Math.random() < 0.6) say([LINES.dressedTag[tag]], 1, {}, true);
    else say(LINES.dressed, 0.8, {}, true);
    grant('outfit');
    checkWish();
    if ((item.slot === 'dress' || item.slot === 'bottom') && item.kind !== 'pants' && Math.random() < 0.35) {
      setTimeout(() => twirl(true), 2300);
    }
  }

  function undressed() { interacted(); say(LINES.undressed, 0.3); checkWish(); }

  function unlocked() {
    interacted();
    holdPose('cheer', 2000);
    face('joy', 2000);
    fx.burst('heart', 4, 200, 130);
    say(LINES.unlocked, 1, {}, true);
  }

  function choosePose(id) {
    interacted();
    base = id; userUntil = now() + 60000; temp = null;
    apply();
    say(LINES.posed, 0.35);
  }

  function twirl(self = false) {
    if (!self) interacted();
    if (!motion.play('twirl')) return;
    holdPose('spin', 1050);
    fx.burst('sparkle', 2, 200, 330);
    say(LINES.twirl, self ? 0.3 : 0.5);
    if (!self) { state.stats.twirls += 1; grant('twirl'); }
  }

  // ── Wishes ───────────────────────────────────────────────
  /** Only wish for what the unlocked wardrobe can actually grant. */
  const grantable = (w) => CATALOG.filter((it) => state.unlocked.has(it.id) && it.tags.includes(w.tag)).length >= w.need;

  function makeWish(asked = false) {
    const options = WISHES.filter((w) => w.tag !== lastWishTag && tagCount(state, w.tag) < w.need && grantable(w));
    const w = options[Math.floor(Math.random() * options.length)];
    if (!w) {
      nextWishAt = now() + 240000;
      if (asked) say(['Hmm... I love what I have on right now!'], 1, {}, true);
      return;
    }
    lastWishTag = w.tag;
    state.wish = { tag: w.tag, label: w.label, need: w.need };
    nextWishAt = now() + 240000;
    if (asked) interacted();
    say(LINES.wish, 1, { wish: w.label }, true);
    hooks.changed('wish');
  }

  function ask() {
    if (state.wish) { interacted(); say(LINES.wish, 1, { wish: state.wish.label }, true); }
    else makeWish(true);
  }

  function checkWish() {
    const w = state.wish;
    if (!w) return;
    hooks.changed('wish');
    if (tagCount(state, w.tag) < w.need) return;
    state.wish = null;
    state.stats.wishes += 1;
    grant('wish');
    nextWishAt = now() + 150000;
    holdPose('cheer', 2000);
    face('joy', 2600);
    fx.burst('heart', 6, 200, 130);
    fx.burst('sparkle', 4, 200, 300);
    setTimeout(() => say(LINES.wishDone, 1, {}, true), 600);
    hooks.wishDone?.(w);
    milestoneCheck();
  }

  function greet(info) {
    const h = new Date().getHours();
    const list = info.daysAway > 2 ? LINES.greetAway
      : h >= 5 && h < 11 ? LINES.greetMorning : h < 17 ? LINES.greetDay : h < 22 ? LINES.greetEvening : LINES.greetNight;
    setTimeout(() => {
      holdPose('wave', 2600);
      face('happy', 2600);
      say(list, 1, {}, true);
    }, 700);
    if (info.gift) {
      setTimeout(() => {
        fx.burst('sparkle', 4, 200, 160);
        if (info.gift === 'hearts') { say(LINES.giftHearts, 1, {}, true); hooks.changed('hearts'); }
        else { say(LINES.gift, 1, {}, true); hooks.toast(`Today's present: ${info.gift.name}`); hooks.changed('wardrobe'); }
      }, 4200);
    }
  }

  function start(info) {
    apply();
    greet(info);
    timer = setInterval(decide, 250);
  }

  return {
    setEditing(on){editing=on;temp=null;exprTemp=null;interacted();apply();},
    start, interacted, pat, poke, lifted, landed, dressed, undressed, unlocked, choosePose, twirl, ask,
    renamed: () => say(LINES.named, 1, {}, true),
    saw: (list) => say(list, 1, {}, true),
    get asleep() { return asleep; },
    stop: () => clearInterval(timer),
  };
}
