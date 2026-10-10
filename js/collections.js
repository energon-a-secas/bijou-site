// Complete looks made from real, individually editable wardrobe pieces.
import { DEFAULT_HEAD } from './looks.js';
import { STARTER_OUTFIT, itemById } from './catalog.js';
import { cleanGarment, templateDefaults } from './garment-templates.js';

export const COLLECTIONS = [
  { id: 'seaglass', name: 'Sea-glass bikini', detail: 'Teal & ivory', tone: 'mint', pose: 'stand',
    head: { ...DEFAULT_HEAD }, outfit: { ...STARTER_OUTFIT } },
  { id: 'captain', name: 'Rose captain', detail: 'Ivory & gold', tone: 'rose', pose: 'salute',
    head: { ...DEFAULT_HEAD, hair: 'rosewood', front: 'swept', back: 'long', eyes: 'amethyst', eyeStyle: 'soft' },
    outfit: { dress: 'dress-captain', hat: 'hat-captain', shoes: 'shoes-captain' } },
  { id: 'midnight', name: 'Midnight bunny', detail: 'Satin & mint', tone: 'mint', pose: 'peace',
    head: { ...DEFAULT_HEAD },
    outfit: { swim: 'swim-tuxedo', hat: 'hat-bunny', legwear: 'legs-satin', shoes: 'shoes-mint', wrist: 'wrist-cuffs' } },
];

export function matchingCollection(s) {
  return COLLECTIONS.find(c =>
    Object.entries(c.head).every(([k, v]) => s.head[k] === v) &&
    Object.keys(c.outfit).length === Object.keys(s.outfit).length &&
    Object.entries(c.outfit).every(([k, v]) => s.outfit[k] === v&&(!itemById(v).template||Object.entries(templateDefaults(itemById(v))).every(([key,value])=>cleanGarment(itemById(v),s.garments?.[v])[key]===value))));
}
