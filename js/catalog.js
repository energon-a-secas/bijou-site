// ── Catalog ──────────────────────────────────────────────────
// Every wearable item, per docs/RIG.md section 7. Data only: the drawings are
// wear*.js. Free pieces start unlocked; the rest cost hearts or a milestone.
import { TEMPLATE_ITEMS, customizeItem, cleanGarment } from './garment-templates.js';

const I = (id, name, slot, kind, params, colors, extra = {}) => ({
  id, name, slot, kind, params, colors,
  pattern: extra.pattern || null, tags: extra.tags || [], unlock: extra.unlock || { hearts: 20 },
});
const FREE = { free: true };
const H = (n) => ({ hearts: n });
const MS = (id) => ({ milestone: id });

export const SLOTS = ['dress', 'top', 'bottom', 'swim', 'outer', 'legwear', 'shoes', 'hat', 'hairacc', 'neck', 'wrist', 'glasses', 'held'];

export const CONFLICTS = {
  dress: ['top', 'bottom', 'swim'],
  swim: ['top', 'bottom', 'dress'],
  top: ['dress', 'swim'],
  bottom: ['dress', 'swim'],
};

export const CATEGORIES = [
  { id:'basics',name:'Basics',slots:['top','bottom','dress','swim'],templates:true },
  { id: 'featured', name: 'Featured', slots: ['dress', 'top', 'bottom', 'swim', 'shoes', 'hat'], featured: true },
  { id: 'dresses', name: 'Dresses', slots: ['dress'] },
  { id: 'tops', name: 'Tops', slots: ['top'] },
  { id: 'bottoms', name: 'Bottoms', slots: ['bottom'] },
  { id: 'swim', name: 'Swim', slots: ['swim'] },
  { id: 'outer', name: 'Layers', slots: ['outer'] },
  { id: 'legs', name: 'Socks', slots: ['legwear'] },
  { id: 'shoes', name: 'Shoes', slots: ['shoes'] },
  { id: 'acc', name: 'Accessories', slots: ['hat', 'hairacc', 'neck', 'wrist', 'glasses'] },
  { id: 'held', name: 'In hand', slots: ['held'] },
];

export const MILESTONES = {
  firstSleep: 'Let her doze off while you keep her company',
  pats100: 'Pat her head 100 times',
  streak3: 'Visit three days in a row',
  wishes5: 'Grant five of her style wishes',
};

export const CATALOG = [
  ...TEMPLATE_ITEMS,
  // Signature ensembles: available from the first visit.
  I('dress-captain', 'Rose Captain Uniform', 'dress', 'costume', { style: 'captain' }, { main: '#ad253b', trim: '#f8f4eb', accent: '#d2ad5c' }, { tags: ['elegant', 'party'], unlock: FREE }),
  I('hat-captain', 'Ivory Captain Hat', 'hat', 'acc', { style: 'captain' }, { main: '#f4efe6', trim: '#d2ad5c' }, { tags: ['elegant', 'party'], unlock: FREE }),
  I('shoes-captain', 'Crimson Tall Boots', 'shoes', 'shoes', { style: 'captain' }, { main: '#6d2637', trim: '#d2ad5c' }, { tags: ['elegant', 'party'], unlock: FREE }),
  I('swim-tuxedo', 'Midnight Tuxedo Suit', 'swim', 'costume', { style: 'tuxedo' }, { main: '#303039', trim: '#f8f4eb' }, { tags: ['elegant', 'party', 'night'], unlock: FREE }),
  I('legs-satin', 'Cocoa Satin Tights', 'legwear', 'legwear', { style: 'tights' }, { main: '#675451', trim: '#453737' }, { tags: ['elegant', 'night'], unlock: FREE }),
  I('wrist-cuffs', 'Tuxedo Cuffs', 'wrist', 'acc', { style: 'cuffs' }, { main: '#f8f4eb', trim: '#34333b' }, { tags: ['elegant', 'party'], unlock: FREE }),
  I('shoes-mint', 'Mint-sole Heels', 'shoes', 'shoes', { style: 'pump' }, { main: '#2e3037', trim: '#6bdec6', accent: '#6bdec6' }, { tags: ['elegant', 'night'], unlock: FREE }),
  // Dresses
  I('dress-lilac', 'Lilac Babydoll', 'dress', 'dress', { neck: 'crew', sleeve: 'puff', puff: 1, cuff: true, len: 'short', flare: 0.75, waist: 'empire', collar: 'peter', bow: '#ff8fb8' }, { main: '#cdb2f5', trim: '#ffffff', accent: '#a98ae6' }, { tags: ['sweet', 'party', 'picnic'], unlock: FREE }),
  I('dress-lemon', 'Lemon Sundress', 'dress', 'dress', { neck: 'square', sleeve: 'none', len: 'midi', flare: 0.6, lace: '#ffffff', belt: '#f2b632' }, { main: '#fff3a8', pattern: '#f6c945' }, { pattern: 'dots', tags: ['picnic', 'beach'], unlock: H(20) }),
  I('dress-sweater', 'Knit Sweater Dress', 'dress', 'dress', { neck: 'crew', sleeve: 'long', cuff: true, len: 'short', flare: 0.15 }, { main: '#e7c9a5', pattern: '#c9a47c', trim: '#f4e2cc' }, { pattern: 'knit', tags: ['cozy'], unlock: H(30) }),
  I('dress-gingham', 'Picnic Pinafore', 'dress', 'dress', { neck: 'square', sleeve: 'puff', len: 'knee', flare: 0.6, apron: true, bow: '#ffffff', bowAt: 'waist' }, { main: '#f28b96', pattern: '#ffffff' }, { pattern: 'gingham', tags: ['picnic', 'sweet'], unlock: H(40) }),
  I('dress-marine', 'Marine Dress', 'dress', 'dress', { neck: 'crew', collar: 'sailor', sleeve: 'short', len: 'knee', flare: 0.5, pleats: true, bow: '#e2384f' }, { main: '#ffffff', accent: '#2f4a8a' }, { tags: ['beach', 'picnic'], unlock: H(50) }),
  I('dress-yukata', 'Sakura Yukata', 'dress', 'dress', { neck: 'v', sleeve: 'wide', len: 'long', flare: 0.08, obi: '#e2557f' }, { main: '#fbe3ee', pattern: '#f28bb0' }, { pattern: 'floral', tags: ['elegant', 'party', 'night'], unlock: H(60) }),
  I('dress-lolita', 'Midnight Lolita', 'dress', 'dress', { neck: 'square', sleeve: 'puff', cuff: true, len: 'knee', flare: 0.9, tiers: 3, lace: '#ffffff', petticoat: true, bow: '#ffffff' }, { main: '#2c2440', trim: '#ffffff' }, { tags: ['elegant', 'night', 'party'], unlock: H(90) }),
  I('dress-idol', 'Idol Stage Dress', 'dress', 'dress', { neck: 'sweetheart', sleeve: 'puff', len: 'short', flare: 1, tiers: 2, lace: '#ffffff', bow: '#ff4f86', petticoat: true }, { main: '#ff9cc7', trim: '#ffffff' }, { tags: ['party', 'sweet'], unlock: H(120) }),
  I('dress-star', 'Starlight Gown', 'dress', 'dress', { neck: 'sweetheart', sleeve: 'none', len: 'floor', flare: 0.8, stars: true }, { main: '#33427a', pattern: '#ffe9a8' }, { pattern: 'stars', tags: ['elegant', 'night', 'party'], unlock: H(150) }),

  // Tops
  I('top-tie', 'Ribbon-tie Shirt', 'top', 'top', { neck: 'crew', collar: 'shirt', sleeve: 'long', cuff: true, hem: 'waist', tie: '#1f1a24' }, { main: '#fbfbff', trim: '#ffffff' }, { tags: ['elegant', 'sweet'], unlock: FREE }),
  I('top-blouse', 'Frill Blouse', 'top', 'top', { neck: 'crew', sleeve: 'puff', cuff: true, hem: 'waist', ruffle: true, bow: '#ff8fb8' }, { main: '#ffffff', trim: '#ffffff' }, { tags: ['sweet', 'elegant'], unlock: FREE }),
  I('top-stripe', 'Stripe Tee', 'top', 'top', { neck: 'crew', sleeve: 'short', hem: 'hip' }, { main: '#ffffff', pattern: '#5b7bd5' }, { pattern: 'stripes', tags: ['beach', 'sporty', 'picnic'], unlock: FREE }),
  I('top-tank', 'Track Tank', 'top', 'top', { neck: 'scoop', sleeve: 'none', hem: 'waist', heart: '#ffffff' }, { main: '#7ad3c6' }, { tags: ['sporty', 'beach'], unlock: H(15) }),
  I('top-shirt', 'Sky Shirt', 'top', 'top', { neck: 'v', collar: 'shirt', sleeve: 'short', hem: 'hip' }, { main: '#bfe3ff', trim: '#ffffff' }, { tags: ['picnic', 'sporty'], unlock: H(20) }),
  I('top-ribbon', 'Ribbon Blouse', 'top', 'top', { neck: 'crew', collar: 'peter', sleeve: 'long', cuff: true, hem: 'waist', bow: '#ff6f9a' }, { main: '#cfe6ff', trim: '#ffffff' }, { tags: ['sweet', 'elegant'], unlock: H(25) }),
  I('top-sweater', 'Cloud Sweater', 'top', 'top', { neck: 'crew', sleeve: 'long', cuff: true, hem: 'hip', loose: 6, knit: true }, { main: '#fff4e6', pattern: '#e3d2bb', trim: '#f6eadb' }, { pattern: 'knit', tags: ['cozy'], unlock: H(30) }),
  I('top-hoodie', 'Bunny Hoodie', 'top', 'top', { neck: 'crew', sleeve: 'long', cuff: true, hem: 'hip', loose: 5, hood: true, ears: true, pocket: true, strings: true }, { main: '#f9c6dc', trim: '#ffffff' }, { tags: ['cozy', 'sporty'], unlock: H(45) }),

  // Bottoms
  I('bottom-circuit', 'Circuit Plaid Skirt', 'bottom', 'skirt', { len: 'knee', flare: 0.62, pleats: true, circuit: '#e0ad4a' }, { main: '#9e2b33', pattern: '#5a1820' }, { pattern: 'plaid', tags: ['elegant', 'party'], unlock: FREE }),
  I('bottom-pleated', 'Pleated Skirt', 'bottom', 'skirt', { top: 'waist', len: 'short', flare: 0.45, pleats: true }, { main: '#b9a2e8' }, { tags: ['sweet', 'picnic'], unlock: FREE }),
  I('bottom-shorts', 'Denim Shorts', 'bottom', 'pants', { len: 'short', cuff: true }, { main: '#7aa6dc', trim: '#c8dcf5' }, { tags: ['beach', 'sporty', 'picnic'], unlock: FREE }),
  I('bottom-joggers', 'Cozy Joggers', 'bottom', 'pants', { len: 'long', wide: 0.3, cuff: true }, { main: '#c7c2d6', trim: '#e4e0ee' }, { tags: ['cozy', 'sporty'], unlock: H(15) }),
  I('bottom-jeans', 'Wide Jeans', 'bottom', 'pants', { len: 'long', wide: 1, rise: 'high' }, { main: '#5f88c6' }, { tags: ['cozy', 'picnic'], unlock: H(20) }),
  I('bottom-plaid', 'Plaid Skirt', 'bottom', 'skirt', { len: 'knee', flare: 0.5, pleats: true }, { main: '#c44d5c', pattern: '#3a2342' }, { pattern: 'plaid', tags: ['elegant', 'cozy'], unlock: H(25) }),
  I('bottom-tulle', 'Tulle Skirt', 'bottom', 'skirt', { len: 'midi', flare: 0.85, tiers: 3 }, { main: '#ffc4dc' }, { tags: ['party', 'sweet'], unlock: H(35) }),
  I('bottom-overall', 'Overall Skirt', 'bottom', 'skirt', { len: 'short', flare: 0.35, bib: true, heart: '#ff8fb8' }, { main: '#8fb3e8' }, { tags: ['picnic', 'sweet'], unlock: H(40) }),

  // Swim
  I('swim-bikini', 'Sea-glass Bikini', 'swim', 'swim2', { top: 'halter', bottom: 'brief' }, { main: '#397f88', trim: '#efe2c8' }, { tags: ['beach', 'sporty'], unlock: FREE }),
  I('swim-onepiece', 'Ribbon Swimsuit', 'swim', 'swim1', { neck: 'square', skirt: true, bow: '#ffffff', lace: '#ffffff' }, { main: '#6cc4e8', trim: '#ffffff' }, { tags: ['beach', 'sporty'], unlock: H(30) }),
  I('swim-tankini', 'Wave Tankini', 'swim', 'swim2', { top: 'tank', bottom: 'skirt', frill: true }, { main: '#9fe3cf', pattern: '#ffffff', trim: '#ffffff' }, { pattern: 'stripes', tags: ['beach', 'sporty'], unlock: H(35) }),
  I('swim-frill', 'Frill Bikini', 'swim', 'swim2', { top: 'frill', bottom: 'skirt', frill: true, bow: '#ff6f9a' }, { main: '#ffb3cf', trim: '#ffffff' }, { tags: ['beach'], unlock: H(40) }),
  I('swim-sunset', 'Sunset Bikini', 'swim', 'swim2', { top: 'band', bottom: 'brief', frill: true }, { main: '#ff9a5c', pattern: '#ffd166', trim: '#fff1d6' }, { pattern: 'tropical', tags: ['beach'], unlock: H(50) }),
  I('swim-retro', 'Retro Polka Bikini', 'swim', 'swim2', { top: 'halter', bottom: 'high', bow: '#ffffff' }, { main: '#e2384f', pattern: '#ffffff', trim: '#ffffff' }, { pattern: 'dots', tags: ['beach'], unlock: H(60) }),

  // Layers
  I('outer-blazer', 'Crimson Blazer', 'outer', 'outer', { style: 'blazer', len: 'hip' }, { main: '#8e1f2e', trim: '#c4404d' }, { tags: ['elegant', 'cozy'], unlock: FREE }),
  I('outer-cardigan', 'Pastel Cardigan', 'outer', 'outer', { style: 'cardigan', len: 'hip', knit: true, buttons: '#ffffff' }, { main: '#ffd6e7', trim: '#fff0f6' }, { tags: ['cozy', 'sweet'], unlock: H(25) }),
  I('outer-beach', 'Beach Shirt', 'outer', 'outer', { style: 'shirt', len: 'hip', sleeve: 'short' }, { main: '#ffffff', pattern: '#4fc1a6', trim: '#ffffff' }, { pattern: 'tropical', tags: ['beach'], unlock: H(30) }),
  I('outer-denim', 'Denim Jacket', 'outer', 'outer', { style: 'jacket', len: 'crop' }, { main: '#6f95cf', trim: '#8fb1e3' }, { tags: ['sporty', 'picnic'], unlock: H(45) }),
  I('outer-raincoat', 'Duckling Raincoat', 'outer', 'outer', { style: 'raincoat', len: 'long', hood: true, buttons: '#ffffff' }, { main: '#ffd84d', trim: '#fff3b0' }, { tags: ['rainy'], unlock: H(50) }),
  I('outer-capelet', 'Snow Capelet', 'outer', 'outer', { style: 'capelet', bow: '#ffffff' }, { main: '#b8324f' }, { tags: ['elegant', 'cozy', 'night'], unlock: H(70) }),

  // Socks
  I('legs-thigh', 'Thigh-high Stockings', 'legwear', 'legwear', { style: 'over' }, { main: '#26222c', trim: '#1b1820' }, { tags: ['elegant', 'night'], unlock: FREE }),
  I('legs-ruffle', 'Ruffle Socks', 'legwear', 'legwear', { style: 'ruffle' }, { main: '#ffffff', trim: '#ffffff' }, { tags: ['sweet'], unlock: FREE }),
  I('legs-knee', 'Knee Socks', 'legwear', 'legwear', { style: 'knee' }, { main: '#2c2440', trim: '#cdb2f5' }, { tags: ['elegant', 'cozy'], unlock: H(15) }),
  I('legs-stripe', 'Candy Stripe Socks', 'legwear', 'legwear', { style: 'knee' }, { main: '#ffffff', pattern: '#ff8fb8', trim: '#ff8fb8' }, { pattern: 'stripes', tags: ['sweet', 'party'], unlock: H(20) }),
  I('legs-warmers', 'Leg Warmers', 'legwear', 'legwear', { style: 'warmers' }, { main: '#cdb2f5', pattern: '#a98ae6' }, { pattern: 'knit', tags: ['cozy', 'sporty'], unlock: H(20) }),
  I('legs-tights', 'Star Tights', 'legwear', 'legwear', { style: 'tights' }, { main: '#3d3566', pattern: '#ffe9a8' }, { pattern: 'stars', tags: ['night', 'elegant'], unlock: H(35) }),

  // Shoes
  I('shoes-glow', 'Glow Loafers', 'shoes', 'shoes', { style: 'loafer' }, { main: '#211d27', accent: '#3ff0d0' }, { tags: ['party', 'night'], unlock: FREE }),
  I('shoes-maryjane', 'Mary Janes', 'shoes', 'shoes', { style: 'maryjane' }, { main: '#3a2a44', trim: '#ffd166' }, { tags: ['sweet', 'elegant'], unlock: FREE }),
  I('shoes-sneaker', 'Sneakers', 'shoes', 'shoes', { style: 'sneaker' }, { main: '#ffffff', trim: '#cdb2f5', accent: '#ff8fb8' }, { tags: ['sporty', 'picnic'], unlock: FREE }),
  I('shoes-sandal', 'Sandals', 'shoes', 'shoes', { style: 'sandal' }, { main: '#f2c14e', trim: '#ffffff' }, { tags: ['beach'], unlock: H(15) }),
  I('shoes-pink', 'Strawberry Mary Janes', 'shoes', 'shoes', { style: 'maryjane' }, { main: '#ff6f9a', trim: '#ffffff' }, { tags: ['sweet', 'party'], unlock: H(25) }),
  I('shoes-rainboot', 'Rain Boots', 'shoes', 'shoes', { style: 'rainboot' }, { main: '#ff8fb8', trim: '#ffffff' }, { tags: ['rainy'], unlock: H(30) }),
  I('shoes-boot', 'Platform Boots', 'shoes', 'shoes', { style: 'boot' }, { main: '#2c2440', trim: '#ffffff' }, { tags: ['night', 'party'], unlock: H(45) }),
  I('shoes-slipper', 'Bunny Slippers', 'shoes', 'shoes', { style: 'slipper' }, { main: '#ffffff' }, { tags: ['cozy'], unlock: MS('firstSleep') }),

  // Accessories
  I('hair-loops', 'Loop Ribbon', 'hairacc', 'acc', { style: 'loops' }, { main: '#1f1a24' }, { tags: ['elegant', 'sweet'], unlock: FREE }),
  I('wrist-beads', 'Bead Bracelet', 'wrist', 'acc', { style: 'beads' }, { main: '#ff6f9a' }, { tags: ['party', 'sweet'], unlock: FREE }),
  I('hat-bunny', 'Bunny-ear Headband', 'hat', 'acc', { style: 'bunny' }, { main: '#1f1a24', trim: '#c4323f' }, { tags: ['party'], unlock: FREE }),
  I('hair-ribbon', 'Big Ribbon', 'hairacc', 'acc', { style: 'ribbon' }, { main: '#ff8fb8' }, { tags: ['sweet', 'party'], unlock: FREE }),
  I('hair-stars', 'Star Clips', 'hairacc', 'acc', { style: 'stars' }, { main: '#ffd84d', trim: '#ffffff' }, { tags: ['party', 'night'], unlock: H(10) }),
  I('hair-berry', 'Strawberry Clips', 'hairacc', 'acc', { style: 'strawberry' }, { main: '#ff5d7a' }, { tags: ['sweet', 'picnic'], unlock: H(15) }),
  I('hair-headband', 'Bow Headband', 'hairacc', 'acc', { style: 'headband' }, { main: '#b9a2e8' }, { tags: ['elegant', 'sweet'], unlock: H(15) }),
  I('hair-velvet', 'Velvet Ribbon', 'hairacc', 'acc', { style: 'ribbon' }, { main: '#2c2440' }, { tags: ['elegant', 'night'], unlock: H(20) }),
  I('hat-beret', 'Beret', 'hat', 'acc', { style: 'beret' }, { main: '#c44d5c' }, { tags: ['elegant', 'picnic'], unlock: H(20) }),
  I('hat-beanie', 'Pompom Beanie', 'hat', 'acc', { style: 'beanie' }, { main: '#9fc6f0', trim: '#ffffff' }, { tags: ['cozy', 'rainy'], unlock: H(25) }),
  I('hat-sunhat', 'Sun Hat', 'hat', 'acc', { style: 'sunhat' }, { main: '#f6e3b4', trim: '#ff8fb8' }, { tags: ['beach', 'picnic'], unlock: H(30) }),
  I('hat-witch', 'Witch Hat', 'hat', 'acc', { style: 'witch' }, { main: '#3d2a5c', trim: '#a67fe0' }, { tags: ['night', 'party'], unlock: H(80) }),
  I('hat-catears', 'Cat-ear Headband', 'hat', 'acc', { style: 'catears' }, { main: '#3a2a44' }, { tags: ['sweet', 'party'], unlock: MS('pats100') }),
  I('hat-crown', 'Flower Crown', 'hat', 'acc', { style: 'crown' }, { main: '#ffb3cf', trim: '#fff2a8', accent: '#c5a3f0' }, { tags: ['picnic', 'sweet'], unlock: MS('streak3') }),
  I('neck-choker', 'Heart Choker', 'neck', 'acc', { style: 'choker' }, { main: '#2c2440', trim: '#ff8fb8' }, { tags: ['party'], unlock: H(15) }),
  I('neck-locket', 'Heart Locket', 'neck', 'acc', { style: 'locket' }, { main: '#ffd166' }, { tags: ['sweet'], unlock: H(20) }),
  I('neck-scarf', 'Knit Scarf', 'neck', 'acc', { style: 'scarf' }, { main: '#e46a7a', pattern: '#c4505f' }, { pattern: 'knit', tags: ['cozy', 'rainy'], unlock: H(25) }),
  I('neck-pearls', 'Pearl Necklace', 'neck', 'acc', { style: 'pearls' }, { main: '#fffaf2' }, { tags: ['elegant'], unlock: H(30) }),
  I('glasses-round', 'Round Glasses', 'glasses', 'acc', { style: 'round' }, { main: '#5a3d2b' }, { tags: ['cozy'], unlock: H(15) }),
  I('glasses-hearts', 'Heart Shades', 'glasses', 'acc', { style: 'hearts' }, { main: '#ff6f9a' }, { tags: ['beach', 'party'], unlock: H(25) }),
  I('glasses-stars', 'Star Shades', 'glasses', 'acc', { style: 'stars' }, { main: '#ffd84d' }, { tags: ['party', 'beach'], unlock: H(25) }),

  // In hand
  I('held-phone', 'Phone', 'held', 'acc', { style: 'phone' }, { main: '#2c2a3a' }, { tags: ['party', 'sporty'], unlock: H(10) }),
  I('held-bunny', 'Bunny Plush', 'held', 'acc', { style: 'bunny' }, { main: '#ff8fb8' }, { tags: ['cozy', 'sweet'], unlock: FREE }),
  I('held-boba', 'Bubble Tea', 'held', 'acc', { style: 'boba' }, { main: '#c89f7a' }, { tags: ['picnic', 'sweet'], unlock: H(10) }),
  I('held-book', 'Storybook', 'held', 'acc', { style: 'book' }, { main: '#7a5cc7', trim: '#ffd166' }, { tags: ['cozy'], unlock: H(10) }),
  I('held-icecream', 'Ice Cream', 'held', 'acc', { style: 'icecream' }, { main: '#ffb3cf', trim: '#fff4e6' }, { tags: ['beach', 'sweet'], unlock: H(15) }),
  I('held-bouquet', 'Bouquet', 'held', 'acc', { style: 'bouquet' }, { main: '#9ed9a0', trim: '#ff8fb8' }, { tags: ['elegant', 'picnic'], unlock: H(25) }),
  I('held-parasol', 'Lace Parasol', 'held', 'acc', { style: 'parasol' }, { main: '#ffd6e7' }, { tags: ['beach', 'elegant'], unlock: MS('wishes5') }),
];

const BY_ID = new Map(CATALOG.map((it) => [it.id, it]));
BY_ID.get('swim-bikini').template='bikini';
export const itemById = (id) => (id ? BY_ID.get(id) || null : null);
export const resolvedItem = (id,settings) => customizeItem(itemById(id),settings);
export const cleanGarments = settings => Object.fromEntries(CATALOG.filter(it=>it.template&&settings?.[it.id]).map(it=>[it.id,cleanGarment(it,settings[it.id])]));

export const FREE_IDS = CATALOG.filter((it) => it.unlock.free).map((it) => it.id);

/** The outfit she wears on a first visit. */
export const STARTER_OUTFIT = {
  swim: 'swim-bikini',
};
