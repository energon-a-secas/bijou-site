// Temporary harness for visual checks of the rig and wardrobe.
import { createDoll } from './doll.js';
import { createMotion } from './motion.js';
import { DEFAULT_BODY, DEFAULT_HEAD } from './looks.js';
import { STARTER_OUTFIT } from './catalog.js';

const q = new URLSearchParams(location.search);
const doll = createDoll(document.getElementById('doll'));
const motion = createMotion(doll);
const outfit = q.get('outfit') ? Object.fromEntries(q.get('outfit').split(',').map((kv) => kv.split(':'))) : STARTER_OUTFIT;
doll.build({ body: { ...DEFAULT_BODY }, head: { ...DEFAULT_HEAD }, outfit });
motion.setPose(q.get('pose') || 'stand');
motion.start();
window.bj = { doll, motion, DEFAULT_BODY, DEFAULT_HEAD };
if (q.get('zoom')) {
  const svg = document.getElementById('doll');
  svg.setAttribute('viewBox', q.get('zoom').split(',').join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  Object.assign(svg.style, { height: '100%', bottom: '0' });
}
