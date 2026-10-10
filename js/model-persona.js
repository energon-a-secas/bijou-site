const number=(value,fallback,min=0,max=1)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
export const HAIR_STYLES=[{id:'hime',name:'Sculpted Hime'},{id:'swept',name:'Side swept'},{id:'bob',name:'Rounded bob'},{id:'textured',name:'Original sculpt · recolorable'},{id:'source',name:'Original mesh'}];
export const HAIR_DEFAULTS=Object.freeze({style:'hime',color:'#39303e',length:.65,volume:.45,shine:.45,motion:.45});
export const SOURCE_HAIR=Object.freeze({...HAIR_DEFAULTS,style:'source'});
export function cleanHair(value){return {style:HAIR_STYLES.some(s=>s.id===value?.style)?value.style:HAIR_DEFAULTS.style,color:color(value?.color,HAIR_DEFAULTS.color),length:number(value?.length,.65),volume:number(value?.volume,.45),shine:number(value?.shine,.45),motion:number(value?.motion,.45)};}
export const GAZE_DEFAULTS=Object.freeze({mode:'animated',x:0,y:0,blink:true,follow:false,headFollow:false});
export const SOURCE_GAZE=Object.freeze({...GAZE_DEFAULTS,mode:'source',blink:false});
export function cleanGaze(value){return {mode:value?.mode==='source'?'source':'animated',x:number(value?.x,0,-1,1),y:number(value?.y,0,-1,1),blink:typeof value?.blink==='boolean'?value.blink:true,follow:value?.follow===true,headFollow:value?.headFollow===true};}
export const EXPRESSIONS=[{id:'neutral',name:'Neutral'},{id:'smile',name:'Gentle smile'},{id:'bright',name:'Bright smile'},{id:'serene',name:'Serene'},{id:'wink',name:'Wink'}];
