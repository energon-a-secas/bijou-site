// ── Personalization data ─────────────────────────────────────
// Skin tones, hair and eye colours, style lists and the ready-made heads.
// Data only. The drawings that read it are body.js, face.js and hair.js.

import { mix } from './paint.js';

const skin = (id, name, base) => ({
  id, name, base,
  shadow: mix(base, '#c45c6a', 0.2),
  deep: mix(base, '#9a3f52', 0.32),
  line: mix(base, '#4a1f2a', 0.66),
});

export const SKIN = [
  skin('porcelain', 'Porcelain', '#fff0e8'),
  skin('peach', 'Peach', '#ffdcc8'),
  skin('honey', 'Honey', '#f5c7a1'),
  skin('sand', 'Sand', '#e6b088'),
  skin('caramel', 'Caramel', '#c98e62'),
  skin('bronze', 'Bronze', '#a96f47'),
  skin('cocoa', 'Cocoa', '#7f5034'),
  skin('ebony', 'Ebony', '#5b3826'),
];

const hair = (id, name, base) => ({
  id, name, base,
  shadow: mix(base, '#3b1a4a', 0.24),
  deep: mix(base, '#2a1036', 0.42),
  light: mix(base, '#ffffff', 0.5),
  line: mix(base, '#2b1631', 0.62),
});

export const HAIR = [
  hair('sakura', 'Sakura', '#f6a6c6'),
  hair('lilac', 'Lilac', '#c5a3f0'),
  hair('silver', 'Silver', '#dcdeea'),
  hair('platinum', 'Platinum', '#f4e6c7'),
  hair('honey', 'Honey', '#efbf68'),
  hair('chestnut', 'Chestnut', '#8c5a3b'),
  hair('raven', 'Raven', '#35304a'),
  hair('midnight', 'Midnight', '#33427a'),
  hair('mint', 'Mint', '#97dfca'),
  hair('sky', 'Sky', '#97c4f2'),
  hair('cherry', 'Cherry', '#d8445f'),
  hair('ash', 'Ash', '#a59eb2'),
];

export const EYES = [
  { id: 'amethyst', name: 'Amethyst', base: '#9b6bdc' },
  { id: 'sky', name: 'Sky', base: '#4aa3f0' },
  { id: 'emerald', name: 'Emerald', base: '#2fb27a' },
  { id: 'amber', name: 'Amber', base: '#ee9f35' },
  { id: 'rose', name: 'Rose', base: '#ec5f95' },
  { id: 'ruby', name: 'Ruby', base: '#d23a4c' },
  { id: 'teal', name: 'Teal', base: '#23a5a6' },
  { id: 'gold', name: 'Gold', base: '#e0b43a' },
  { id: 'grey', name: 'Storm', base: '#858aa0' },
  { id: 'cocoa', name: 'Cocoa', base: '#8a5a3c' },
];

export const EYE_STYLES = [
  { id: 'sparkle', name: 'Sparkly' },
  { id: 'soft', name: 'Gentle' },
  { id: 'cat', name: 'Feline' },
  { id: 'sleepy', name: 'Dreamy' },
];

export const FRONT_STYLES = [
  { id: 'wispy', name: 'Wispy' },
  { id: 'blunt', name: 'Blunt' },
  { id: 'swept', name: 'Swept' },
  { id: 'split', name: 'Parted' },
];

export const BACK_STYLES = [
  { id: 'twintails', name: 'Twin tails' },
  { id: 'long', name: 'Long' },
  { id: 'wavy', name: 'Waves' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'bob', name: 'Bob' },
  { id: 'buns', name: 'Buns' },
];

export const MOUTHS = [
  { id: 'smile', name: 'Smile' },
  { id: 'cat', name: 'Cat' },
  { id: 'small', name: 'Small' },
];

export const DEFAULT_HEAD = {
  hair: 'sakura', front: 'wispy', back: 'twintails', ahoge: true,
  eyes: 'amethyst', eyeStyle: 'sparkle', mouth: 'smile', blush: 1, freckles: false, mark: 'none',
};

export const DEFAULT_BODY = { height: 0.5, build: 0.5, skin: 'peach' };

/** Ready-made heads. Applying one replaces the head, never the body or outfit. */
export const HEADS = [
  { id: 'bijou', name: 'Bijou', head: { ...DEFAULT_HEAD } },
  { id: 'hime', name: 'Hime', head: { ...DEFAULT_HEAD, hair: 'raven', front: 'blunt', back: 'long', ahoge: false, eyes: 'ruby', eyeStyle: 'soft', mouth: 'small' } },
  { id: 'sunny', name: 'Sunny', head: { ...DEFAULT_HEAD, hair: 'honey', front: 'swept', back: 'ponytail', eyes: 'sky', eyeStyle: 'sparkle', freckles: true } },
  { id: 'luna', name: 'Luna', head: { ...DEFAULT_HEAD, hair: 'silver', front: 'split', back: 'wavy', ahoge: false, eyes: 'gold', eyeStyle: 'cat', mouth: 'cat', mark: 'R' } },
  { id: 'mochi', name: 'Mochi', head: { ...DEFAULT_HEAD, hair: 'lilac', front: 'wispy', back: 'buns', eyes: 'rose', eyeStyle: 'sleepy', blush: 2 } },
  { id: 'kiri', name: 'Kiri', head: { ...DEFAULT_HEAD, hair: 'mint', front: 'swept', back: 'bob', ahoge: false, eyes: 'teal', eyeStyle: 'cat', mouth: 'small' } },
];

export const byId = (list, id, fallback = list[0]) => list.find((x) => x.id === id) || fallback;
