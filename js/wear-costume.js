// Reference-inspired ensembles, drawn on the same rig as the rest of the wardrobe.
import { paintOf, bodice, cloth, sleeves, skirt, smooth, mirror, line, shape, stroke, fillOnly, f1, inkOf, at } from './wear-kit.js';
import { bow, cel } from './paint.js';

const IVORY = '#f8f4eb', GOLD = '#d2ad5c';

export function costumePieces(item, M) {
  return item.params.style === 'captain' ? captain(item, M) : tuxedo(item, M);
}

function captain(item, M) {
  const p = paintOf(item), y = M.shoulderY;
  const white = paintOf({ colors: { main: IVORY, accent: '#d9d2d6' } });
  const hem = M.hipY + 11;
  const b = bodice(M, { neck: 'crew', hem, ease: 1.9, hemCurve: 4 });
  // Two overlapping tiers give the skirt a sculpted, ruffled silhouette.
  const out = skirt(M, { topY: M.waistY + 22, hem: M.hipY + 67, flare: 0.95, sculpted: true, band: false, z: 198 }, white);
  out.push(...skirt(M, { topY: M.waistY + 20, hem: M.hipY + 37, flare: 0.78, sculpted: true, band: false, z: 199 }, white));
  let svg = cloth(b.d, p);
  const piping = `M194 ${f1(y - 4)}L194 ${f1(y + 23)}L208 ${f1(y + 23)}L208 ${f1(y + 31)}Q182 ${f1(M.chestY - 11)} 184 ${f1(M.chestY + 1)}L191 ${f1(hem - 2)}`;
  svg += stroke(piping, p.ink, 4.3) + stroke(piping, IVORY, 2.1);
  svg += shape(line([[189, y - 10], [200, y - 12], [211, y - 10], [212, y + 10], [204, y + 16], [200, y - 2], [196, y + 16], [188, y + 10]], true), p.main, p.ink, 1.3);
  svg += stroke(`M190 ${f1(y - 8)}L190 ${f1(y + 8)}L196 ${f1(y + 14)}M210 ${f1(y - 8)}L210 ${f1(y + 8)}L204 ${f1(y + 14)}`, IVORY, 2.4);
  // Waist belt, brass clasps and a pair of medals.
  const wy = M.waistY + 6, ww = M.torsoHW(wy) + 1;
  svg += stroke(`M${f1(200 - ww)} ${f1(wy)}Q200 ${f1(wy + 8)} ${f1(200 + ww)} ${f1(wy)}`, '#492f33', 8);
  for (const x of [185, 215]) svg += `<ellipse cx="${x}" cy="${f1(wy + 3)}" rx="4.4" ry="5.5" fill="${GOLD}" stroke="#846130" stroke-width="1"/>` + stroke(`M${x - 1} ${f1(wy)}v5`, '#f5dfa6', 1.6);
  const my = M.chestY + 5;
  svg += shape(`M213 ${f1(my)}h23v5h-23Z`, GOLD, '#846130', 1);
  for (const x of [218, 230]) svg += fillOnly(`M${x - 3} ${f1(my + 6)}l3 7l3-7Z`, GOLD) + `<circle cx="${x}" cy="${f1(my + 15)}" r="3.5" fill="${GOLD}" stroke="#846130" stroke-width=".8"/>`;
  svg += stroke(`M${f1(200 - M.torsoHW(hem) + 2)} ${f1(hem - 1)}Q200 ${f1(hem + 7)} ${f1(200 + M.torsoHW(hem) - 2)} ${f1(hem - 1)}`, IVORY, 2);
  svg += stroke(`M171 ${f1(M.chestY + 20)}Q179 ${f1(M.waistY - 4)} 171 ${f1(M.waistY + 20)}M229 ${f1(M.chestY + 20)}Q221 ${f1(M.waistY - 4)} 229 ${f1(M.waistY + 20)}`, p.ink, 1, 'opacity=".38"');
  out.push({ bone: 'spine', z: 201, svg });
  out.push(...sleeves(M, { len: 'long', cuff: true, ease: 1.7 }, { ...p, trim: IVORY }));
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R', P = at(M.shoulder[side], s);
    const fringe = [[-13, 0], [13, 0], [17, 28], [12, 27], [11, 32], [7, 30], [5, 34], [1, 31], [-2, 33], [-4, 29], [-9, 29]].map(P);
    const epaulet = [[-13, -5], [1, -8], [14, -3], [13, 4], [-12, 3]].map(P);
    out.push({ bone: `upperArm${side}`, z: 318, svg: shape(line(fringe, true), IVORY, '#b5a6a4', 1) + shape(smooth(epaulet), GOLD, '#846130', 1.3) + stroke(line([[-10, -2], [9, -2]].map(P)), '#f5dfa6', 1.4) });
    const W = M.wrist[side], cuff = [[-9, -15], [9, -15], [10, -1], [-10, -1]].map(at(W, s));
    out.push({ bone: `foreArm${side}`, z: 319, svg: shape(line(cuff, true), IVORY, '#b5a6a4', 1) });
  }
  return out;
}

function tuxedo(item, M) {
  const p = paintOf(item), y = M.shoulderY;
  const b = bodice(M, { neck: 'halter', hem: M.waistY + 14, ease: 1.3 });
  const half = [[200, M.waistY], [200 + M.torsoHW(M.waistY) + 1.3, M.waistY, 1], [200 + M.torsoHW(M.hipY) + 1.4, M.hipY, 1], [214, M.hipY + 26], [200, M.hipY + 30, 1]];
  let svg = cloth(b.d, p);
  svg += shape(`M188 ${f1(y - 6)}L174 ${f1(M.chestY - 9)}L200 ${f1(M.chestY + 6)}L226 ${f1(M.chestY - 9)}L212 ${f1(y - 6)}Z`, p.main, p.ink, 1.3);
  svg += shape(`M190 ${f1(y - 5)}L210 ${f1(y - 5)}L209 ${f1(y + 30)}L200 ${f1(y + 44)}L191 ${f1(y + 30)}Z`, IVORY, '#a99b9e', 1);
  svg += bow(200, y + 3, 9, '#34333b', '#171923');
  for (const offset of [15, 24]) svg += `<circle cx="200" cy="${f1(y + offset)}" r="1.5" fill="#45404b"/>`;
  for (const s of [-1, 1]) {
    svg += stroke(`M${200 + s * 27} ${f1(M.chestY + 7)}Q${200 + s * 20} ${f1(M.waistY - 13)} ${200 + s * 24} ${f1(M.waistY + 10)}`, '#77707c', 1, 'opacity=".7"');
    svg += fillOnly(`M${200 + s * 28} ${f1(M.chestY - 7)}Q${200 + s * 37} ${f1(M.chestY + 4)} ${200 + s * 29} ${f1(M.chestY + 18)}Q${200 + s * 19} ${f1(M.chestY + 4)} ${200 + s * 28} ${f1(M.chestY - 7)}Z`, '#d5ccd3', 'opacity=".16"');
  }
  return [
    { bone: 'root', z: 170, svg: cel(smooth(mirror(half)), p.fill, p.ink, 1.4, { dx: -7, dy: 0 }) },
    { bone: 'spine', z: 171, svg },
  ];
}
