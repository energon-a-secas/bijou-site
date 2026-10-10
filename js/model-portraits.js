import {cleanAppearance} from './model-appearance.js';
import {FACE_CONTROLS} from './model-face-details.js';
import {cleanModelStyle,REALISM_STYLE} from './model-style.js';
import {cleanHair,HAIR_DEFAULTS} from './model-persona.js';

export const PORTRAIT_STARTS=[
  {id:'nightbloom',name:'Nightbloom',face:'fantasy',age:25,hair:'#302c3b',eyes:'#739ca9',skin:'#edc9b2',details:{chinWidth:.55,chinLength:-.3,jawWidth:.18,noseTip:.05,upperLip:.4,lowerLip:.45,cheekFullness:.35}},
  {id:'snowdrop',name:'Snowdrop',face:'fantasy',age:25,hair:'#b7bec9',eyes:'#829aaa',skin:'#f4dacc',details:{eyeTilt:.18,eyeWidth:-.12,noseWidth:-.15,chinWidth:.35,chinLength:-.18,upperLip:.3,lowerLip:.35}},
  {id:'amber',name:'Amber',face:'heroine',age:35,hair:'#795344',eyes:'#af7638',skin:'#d7ad8d',details:{faceWidth:.12,cheekFullness:.3,jawWidth:-.1,eyeSpacing:.1,upperLip:.35,lowerLip:.4,noseBridge:-.15}},
  {id:'jade',name:'Jade',face:'fantasy',age:35,hair:'#45413b',eyes:'#668368',skin:'#c69e7e',details:{faceLength:.15,chinWidth:.3,eyeTilt:.2,browHeight:.15,cheekWidth:.1,noseWidth:.18,lipProjection:.2}},
  {id:'lilac',name:'Lilac',face:'oval',age:25,hair:'#aca0ba',eyes:'#8876b3',skin:'#f0d0c4',details:{eyeSize:-.4,eyeHeight:-.25,cheekFullness:.25,chinWidth:.35,chinLength:-.2,noseBridge:.3,upperLip:.4,lowerLip:.4}},
  {id:'ember',name:'Ember',face:'defined',age:45,hair:'#7a4633',eyes:'#866040',skin:'#9b6b4b',details:{eyeSize:-.12,jawWidth:-.12,chinWidth:.3,cheekWidth:.15,cheekFullness:.2,noseWidth:.25,upperLip:.5,lowerLip:.45}}
];
export function portraitLook(id){
  const p=PORTRAIT_STARTS.find(p=>p.id===id)||PORTRAIT_STARTS[0];
  return {appearance:cleanAppearance({face:p.face,age:p.age,details:p.details}),
    style:cleanModelStyle({...REALISM_STYLE,skinColor:p.skin,skinBlend:1,eyeColor:p.eyes,freckles:['amber','jade'].includes(id)?.22:.08}),
    hair:cleanHair({...HAIR_DEFAULTS,style:'textured',color:p.hair})};
}
// Stable seeds produce reviewable variations, rather than unbounded anatomy.
export function varyPortrait(seed,adultAge=25){
  let state=Number(seed)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const p=portraitLook(PORTRAIT_STARTS[Math.floor(random()*PORTRAIT_STARTS.length)].id);
  p.appearance=cleanAppearance({...p.appearance,age:adultAge,details:Object.fromEntries(FACE_CONTROLS.map(c=>[c.id,p.appearance.details[c.id]+(random()-.5)*.30]))});
  p.style.blush=.1+random()*.2;p.style.freckles=random()*.25;p.style.lipGloss=.2+random()*.4;
  return p;
}
