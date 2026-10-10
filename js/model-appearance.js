import { bell, smooth } from './model-shape.js';
import { EXPRESSIONS } from './model-persona.js';
import {FACE_DETAIL_DEFAULTS,cleanFaceDetails,faceDetailOffset} from './model-face-details.js';

export const ADULT_AGES=[{id:25,label:'20s'},{id:35,label:'30s'},{id:45,label:'40s'},{id:55,label:'50s'},{id:65,label:'60s'}];
export const FACE_STYLES=[
  {id:'oval',name:'Oval',hint:'The original soft anime face.'},
  {id:'figurine',name:'Anime figurine',hint:'Rounded cheeks, a smaller nose and a lighter anime profile.'},
  {id:'heroine',name:'Game heroine',hint:'Tifa Remake inspired: smaller almond eyes, defined cheeks and a clearer nose bridge.'},
  {id:'fantasy',name:'Fantasy realism',hint:'Smaller eyes, a defined nose and fuller lips for a grounded game character.'},
  {id:'soft',name:'Soft',hint:'A rounder jaw and softer cheeks.'},
  {id:'defined',name:'Defined',hint:'A stronger jaw with more sculpted cheekbones.'}
];
export const APPEARANCE_DEFAULTS=Object.freeze({age:25,face:'oval',strength:1,expression:'neutral',details:FACE_DETAIL_DEFAULTS});
export function cleanAppearance(value){return {
  age:ADULT_AGES.some(a=>a.id===value?.age)?value.age:25,
  face:FACE_STYLES.some(f=>f.id===value?.face)?value.face:'oval',
  expression:EXPRESSIONS.some(e=>e.id===value?.expression)?value.expression:'neutral',
  details:cleanFaceDetails(value?.details),
  strength:typeof value?.strength==='number'&&Number.isFinite(value.strength)?Math.max(0,Math.min(1,value.strength)):1
};}
// Local stylized sculpt treatments. Age never sets height, body size or clothing.
// All details are geometric and exportable; no shader-only age label.
export function createFaceField(input={},anchors={}){
  const a=cleanAppearance(input),eye=anchors.eye??1.537,mouth=anchors.mouth??1.465,chin=anchors.chin??1.421;
  const age=(a.age-25)/40,amount=a.strength,style={oval:[0,0,0,0],figurine:[-.12,.045,-1.25,-.35],heroine:[-.42,-.075,.8,.45],fantasy:[-.45,-.025,.85,.4],soft:[.05,.09,-.2,-.5],defined:[-.08,.05,.3,1]}[a.face];
  const hasDetails=Object.values(a.details).some(v=>v!==0);
  function point(x,y,z,mask={}){
    const front=smooth(.018,.053,z),head=mask.head??1;
    // Avoid the scalp/fringe. The face treatment joins the unedited neck and
    // outer hair smoothly, while iris and eyelid geometry move together.
    const face=front*head*(1-smooth(.057,.092,Math.abs(x)))*smooth(chin-.015,chin+.025,y)*(1-smooth(eye+.035,eye+.069,y));
    const detail=hasDetails?faceDetailOffset(x,y,z,mask,a.details,{...anchors,eye,mouth,chin}):[0,0,0];
    if(face===0)return [x+detail[0],y+detail[1],z+detail[2]];
    let px=x+detail[0],py=y+detail[1],pz=z+detail[2];
    const eyeCenter=anchors.eyeX??.033,eyeRegion=bell(Math.abs(x),eyeCenter,.033)*bell(y,eye,.035)*face;
    py+=(y-eye)*(style[0]-.22*age)*eyeRegion*amount;
    py-=.0035*age*bell(Math.abs(x),.052,.018)*bell(y,eye,.023)*face*amount;
    px+=(x-Math.sign(x)*eyeCenter)*style[0]*.22*eyeRegion*amount;
    const cheek=bell(y,eye-.045,.065)*face,jaw=bell(y,mouth-.013,.06)*face;
    px+=x*(style[1]*cheek+style[3]*.06*jaw-age*.06*cheek+age*.1*jaw)*amount;
    pz+=(.005*style[2]*bell(x,0,.019)*bell(y,eye-.034,.045)+.0035*style[3]*bell(Math.abs(x),.046,.025)*bell(y,eye-.029,.025))*face*amount;
    // Mature appearances: less cheek fullness, a softer jaw edge, under-eye
    // folds and nasolabial definition. Subtle by design at this model density.
    pz-=age*.007*bell(Math.abs(x),.039,.035)*bell(y,mouth+.028,.036)*face*amount;
    py-=age*.005*jaw*amount;
    py-=age*.0025*bell(Math.abs(x),.024,.014)*bell(y,mouth,.016)*face*amount;
    const eyeFold=bell(y,eye-.014-.04*Math.max(0,Math.abs(x)-.03),.0035)*bell(Math.abs(x),.039,.029);
    const creaseX=.016+Math.max(0,eye-.04-y)*.32;
    const smileFold=bell(Math.abs(x),creaseX,.0028)*bell(y,mouth+.015,.027);
    pz-=age*(.0018*eyeFold+.0022*smileFold)*face*amount;
    const smile={neutral:0,smile:.55,bright:1,serene:.25,wink:.8}[a.expression];
    py+=smile*.006*bell(Math.abs(x),.025,.025)*bell(y,mouth,.024)*face;
    pz-=smile*.0015*bell(x,0,.028)*bell(y,mouth,.018)*face;
    py+=smile*.002*bell(Math.abs(x),.038,.032)*bell(y,eye+.029,.013)*face;
    return [px,py,pz];
  }
  return {point,appearance:a,anchors:{eye,mouth,chin}};
}
