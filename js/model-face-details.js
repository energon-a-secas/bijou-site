import {bell,smooth} from './model-shape.js';

export const FACE_REGIONS=[
  {id:'proportions',name:'Face & jaw',hint:'Balance the silhouette, cheek volume and chin in front and profile.'},
  {id:'eyes',name:'Eyes & brows',hint:'Shape both eyes together. Gaze and blinking follow the edited features.'},
  {id:'nose',name:'Nose',hint:'Refine the bridge, tip and nostrils. Use the side view to judge projection.'},
  {id:'mouth',name:'Mouth & lips',hint:'Adjust the mouth position, contour and lip volume independently.'},
  {id:'ears',name:'Ears',hint:'Small changes to the ears; rotate to inspect beneath the hair.'}
];
const group=(region,items)=>items.map(([id,label])=>({id,label,region,min:-1,max:1,value:0}));
export const FACE_CONTROLS=[
  ...group('proportions',[['faceWidth','Face width'],['faceLength','Face length'],['cheekWidth','Cheekbone width'],['cheekFullness','Cheek fullness'],['jawWidth','Jaw width'],['chinWidth','Chin width'],['chinLength','Chin length'],['chinProjection','Chin projection']]),
  ...group('eyes',[['eyeSize','Eye size'],['eyeWidth','Eye width'],['eyeHeight','Eye height'],['eyeSpacing','Eye spacing'],['eyeTilt','Outer corner tilt'],['eyeDepth','Eye depth'],['upperLid','Upper lid height'],['lowerLid','Lower lid height'],['browHeight','Brow height'],['browAngle','Brow angle']]),
  ...group('nose',[['noseBridge','Bridge projection'],['noseWidth','Nose width'],['noseLength','Nose length'],['noseTip','Tip projection'],['nostrilWidth','Nostril width']]),
  ...group('mouth',[['mouthWidth','Mouth width'],['mouthHeight','Mouth position'],['upperLip','Upper lip fullness'],['lowerLip','Lower lip fullness'],['lipProjection','Lip projection'],['mouthCorners','Corner lift']]),
  ...group('ears',[['earSize','Ear size'],['earAngle','Ear angle']])
];
export const FACE_DETAIL_DEFAULTS=Object.freeze(Object.fromEntries(FACE_CONTROLS.map(c=>[c.id,0])));
export function cleanFaceDetails(value){return Object.fromEntries(FACE_CONTROLS.map(c=>[c.id,typeof value?.[c.id]==='number'&&Number.isFinite(value[c.id])?Math.max(-1,Math.min(1,value[c.id])):0]));}

// Measurements are in the imported rest space. Add local displacements from
// that space so changing one slider never accumulates a previous deformation.
export function faceDetailOffset(x,y,z,mask,a,anchors){
  const eye=anchors.eye,mouth=anchors.mouth,chin=anchors.chin,ax=Math.abs(x),side=Math.sign(x);
  if((mask.head??1)<=0||y<chin-.026||y>eye+.072||z<-.030||ax>.116)return [0,0,0];
  const front=smooth(.015,.05,z)*(mask.head??1),vertical=smooth(chin-.022,chin+.018,y)*(1-smooth(eye+.038,eye+.07,y));
  const face=front*vertical*(1-smooth(.071,.105,ax));
  const ex=side*(anchors.eyeX??.043),dx=x-ex,dy=y-eye+.007;
  const eyes=bell(dx,0,.041)*bell(dy,0,.037)*face,cheek=bell(y,eye-.039,.04)*face;
  const jaw=bell(y,mouth-.012,.042)*face,tip=bell(y,chin+.004,.026)*face;
  let px=x*.105*a.faceWidth*face+x*.095*a.cheekWidth*cheek+x*.105*a.jawWidth*jaw+x*.14*a.chinWidth*tip;
  let py=(y-eye)*.08*a.faceLength*face-.0045*a.chinLength*tip;
  let pz=.0045*a.cheekFullness*cheek*bell(ax,.038,.046)+.0045*a.chinProjection*tip;
  // Shared eye sockets keep the iris, lash edge and surrounding skin joined.
  px+=(dx*(a.eyeSize*.085+a.eyeWidth*.115)+side*.0045*a.eyeSpacing)*eyes;
  py+=(dy*(a.eyeSize*.085+a.eyeHeight*.12)+dx*side*.14*a.eyeTilt)*eyes;
  pz+=.0035*a.eyeDepth*eyes;
  py+=(.0025*a.upperLid*bell(dy,.008,.010)+.002*a.lowerLid*bell(dy,-.009,.010))*eyes;
  const brow=bell(y,eye+.024,.016)*bell(dx,0,.038)*face;
  py+=(.0045*a.browHeight+side*dx*.13*a.browAngle)*brow;
  const nose=bell(x,0,.022)*bell(y,eye-.036,.04)*face,bridge=bell(x,0,.012)*bell(y,eye-.021,.031)*face;
  const noseEnd=bell(x,0,.016)*bell(y,mouth+.025,.018)*face;
  px+=x*.20*a.noseWidth*nose+x*.19*a.nostrilWidth*bell(y,mouth+.022,.014)*nose;
  py-=.004*a.noseLength*nose;
  pz+=.0045*a.noseBridge*bridge+.0045*a.noseTip*noseEnd;
  const lips=bell(x,0,.035)*bell(y,mouth,.021)*face;
  px+=x*.15*a.mouthWidth*lips;py+=.0035*a.mouthHeight*lips;
  py+=.002*a.upperLip*bell(y,mouth+.003,.009)*lips-.002*a.lowerLip*bell(y,mouth-.005,.009)*lips;
  py+=.004*a.mouthCorners*bell(ax,.026,.015)*lips;
  pz+=(.0035*a.lipProjection+.0018*a.upperLip*bell(y,mouth+.003,.009)+.0018*a.lowerLip*bell(y,mouth-.005,.009))*lips;
  const ear=bell(ax,.088,.023)*bell(y,eye-.023,.046)*smooth(-.027,.002,z)*(1-smooth(.039,.065,z))*(mask.head??1)*(1-smooth(.104,.116,ax))*smooth(chin-.026,chin+.005,y)*(1-smooth(eye+.054,eye+.072,y));
  px+=(x-side*.075)*.13*a.earSize*ear+side*.005*a.earAngle*ear;
  py+=(y-eye+.023)*.12*a.earSize*ear;pz-=.004*a.earAngle*ear;
  return [px,py,pz];
}
