// Adult character baselines: posture and temperament are independent of outfits
// and faces. These are starting points, not limits on an editable character.
import { BODY_PRESETS } from './body-shape.js';
const shape=id=>({...BODY_PRESETS.find(p=>p.id===id).values});
export const ARCHETYPES=[
  {id:'elegant',name:'Elegant',detail:'Tall · poised · unhurried',pose:'elegant',body:{...shape('slender'),height:.78,build:.4,hips:.52,legs:.45,bounce:.24,damping:.76},tempo:.72,head:.55,fingers:.7,idle:[['think',4],['behind',2],['hum',3],['sit',2],['stretch',1]]},
  {id:'bright',name:'Bright',detail:'Compact · lively · expressive',pose:'stand',body:{...shape('balanced'),height:.28,bounce:.42,damping:.56},tempo:1.18,head:1,fingers:1,idle:[['wave',3],['admire',3],['hum',3],['stretch',2],['twirl',1]]},
  {id:'athletic',name:'Athletic',detail:'Strong · balanced · energetic',pose:'ready',body:{...shape('athletic'),height:.62,bounce:.28,damping:.7},tempo:1,head:.7,fingers:.6,idle:[['stretch',4],['hips',3],['think',2],['hum',2]]},
  {id:'gentle',name:'Gentle',detail:'Soft · reserved · calm',pose:'reserved',body:{...shape('soft'),height:.42,bounce:.22,damping:.8},tempo:.78,head:.45,fingers:.45,idle:[['shy',3],['hum',3],['sit',3],['think',2],['stretch',1]]},
];
export const archetypeFor=id=>ARCHETYPES.find(a=>a.id===id)||ARCHETYPES[0];
