// Metres, +Y up, +Z front. Imported A-pose models only; independent of VRM fields.
import { armLengthOffset, editedWristY } from './model-limbs.js';
export const MODEL_REGIONS = [
  {id:'figure',name:'Proportions',hint:'Start with height and the overall silhouette.',controls:[
    ['height','Height',150,195,168,'cm'],['build','Overall build'],['shoulders','Shoulder width'],['torsoDepth','Ribcage depth']]},
  {id:'chest',name:'Chest',hint:'Volume, spacing and lift leave the upper ribcage intact.',controls:[
    ['chestVolume','Volume'],['chestSpacing','Spacing'],['chestLift','Lift']]},
  {id:'waist',name:'Waist & abdomen',hint:'Inspect from the side to see the upper and lower abdomen.',controls:[
    ['waistWidth','Waist width'],['waistDepth','Waist depth'],['bellyUpper','Upper abdomen'],['bellyLower','Lower abdomen'],['bellyPosition','Fullness position']]},
  {id:'hips',name:'Hips & legs',hint:'Leg volume tapers before the knees and ankles.',controls:[
    ['hipWidth','Hip width'],['hipDepth','Hip depth'],['thighs','Thigh volume'],['calves','Calf volume']]},
  {id:'arms',name:'Arms & shoulders',hint:'Length moves the elbows and wrists with the sleeves. Hands keep their size.',controls:[
    ['upperArmLength','Upper-arm length'],['forearmLength','Forearm length'],['arms','Arm volume'],['underarm','Underarm contour']]}
];
export const MODEL_CONTROLS=MODEL_REGIONS.flatMap(r=>r.controls.map(([id,label,min=-1,max=1,value=0,unit=''])=>({id,label,min,max,value,unit,region:r.id})));
export const MODEL_DEFAULTS=Object.freeze(Object.fromEntries(MODEL_CONTROLS.map(c=>[c.id,c.value])));
export const MODEL_PRESETS=[
  {id:'source',name:'Original',description:'Source proportions',values:{}},
  {id:'figurine',name:'Figurine',description:'Balanced anime proportions',values:{height:166,build:-.25,shoulders:-.12,torsoDepth:-.1,waistWidth:.08,hipWidth:-.14,hipDepth:-.18,thighs:-.16,calves:-.12,arms:-.22,chestVolume:-.35,upperArmLength:-.18,forearmLength:-.12}},
  {id:'slender',name:'Slender',description:'Slim build, flat chest',values:{upperArmLength:-0.15,forearmLength:-0.1,height:164,build:-.72,shoulders:-.12,torsoDepth:-.12,waistWidth:-.28,waistDepth:-.2,hipWidth:-.4,hipDepth:-.48,thighs:-.45,calves:-.34,arms:-.4,chestVolume:-1}},
  {id:'petite',name:'Petite',description:'Shorter adult frame',values:{upperArmLength:-0.48,forearmLength:-0.35,height:154,build:-.45,shoulders:-.15,waistWidth:-.15,hipWidth:-.22,hipDepth:-.22,thighs:-.25,arms:-.3,chestVolume:-.75}},
  {id:'willow',name:'Willow',description:'Tall and slender',values:{upperArmLength:0.35,forearmLength:0.25,height:182,build:-.5,waistWidth:-.22,hipWidth:-.3,hipDepth:-.25,thighs:-.3,calves:-.2,arms:-.3,chestVolume:-.8}},
  {id:'soft',name:'Soft',description:'Rounded silhouette',values:{upperArmLength:-0.1,forearmLength:-0.16,height:162,build:.18,waistWidth:.18,waistDepth:.12,hipWidth:.3,hipDepth:.16,bellyUpper:.2,bellyLower:.28,thighs:.25,chestVolume:.15}},
  {id:'curvy',name:'Curvy',description:'Fuller chest and hips',values:{upperArmLength:0.05,forearmLength:0.05,height:170,build:.22,waistWidth:-.1,hipWidth:.55,hipDepth:.45,thighs:.3,chestVolume:.55}},
  {id:'athletic',name:'Athletic',description:'Defined shoulders and limbs',values:{upperArmLength:0.18,forearmLength:0.12,height:170,build:-.1,shoulders:.42,torsoDepth:.12,waistWidth:.05,thighs:.2,calves:.16,arms:.25,chestVolume:-.25}},
  {id:'full',name:'Full',description:'Broader, softer frame',values:{upperArmLength:0.08,forearmLength:-0.04,height:172,build:.65,waistWidth:.35,waistDepth:.35,hipWidth:.45,hipDepth:.35,bellyUpper:.4,bellyLower:.5,thighs:.35,arms:.25,chestVolume:.25}}
];
export function cleanModelShape(input){
  return Object.fromEntries(MODEL_CONTROLS.map(c=>[c.id,typeof input?.[c.id]==='number'&&Number.isFinite(input[c.id])?Math.min(c.max,Math.max(c.min,input[c.id])):c.value]));
}
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const bell=(value,center,radius)=>{const t=Math.abs(value-center)/radius;return t>=1?0:(1-t*t)**3;};
export const DEFAULT_LANDMARKS=Object.freeze({neck:1.36,shoulder:1.325,chest:1.24,waist:1.08,pelvis:.92,
  shoulderX:.155,elbowX:.25,elbowY:1.105,wristX:.34,wristY:.90,
  hipX:.075,kneeX:.105,kneeY:.52,ankleX:.115,ankleY:.115});

// mask: torso/head/arm/leg are rest skin-weight sums, side = signed limb side.
// With no mask, useful for anatomical probes. Skeleton mode moves joint centres
// without inflating them; volumes belong to the surface, not bone scale.
export function createModelField(input={},landmarks={}){
  const s=cleanModelShape(input),a={...DEFAULT_LANDMARKS,...landmarks},heightDelta=s.height/100-1.68;
  const wristY=editedWristY(s,a);
  function vertical(y){return y+heightDelta*smooth(.08,a.neck,y);}
  function point(x,y,z,mask={},skeleton=false){
    let px=x,py=y,pz=z;
    const head=mask.head??smooth(a.neck-.025,a.neck+.02,y),arm=mask.arm??0,leg=mask.leg??smooth(a.pelvis,a.pelvis-.10,y);
    const torso=(mask.torso??Math.max(0,1-head-arm-leg))*(1-smooth(a.shoulder-.025,a.neck,y));
    const side=mask.side??Math.sign(x),midline=x/Math.sqrt(x*x+.03*.03);
    const bodyWidth=1-smooth(.14,.21,Math.abs(x));
    const shoulderShift=.028*s.shoulders+.019*s.build;
    px+=side*shoulderShift*(arm*Math.min(1,Math.abs(x)/(a.shoulderX*.8))+torso*smooth(a.waist,a.shoulder,y)*Math.min(1,Math.abs(x)/a.shoulderX));
    const hipShift=.025*s.hipWidth*bell(y,a.pelvis,.22);
    px+=midline*hipShift*(torso+leg);
    px+=midline*.012*s.build*(leg+torso*bell(y,a.pelvis,.16));
    if(!skeleton){
      const waist=bell(y,a.waist,.16)*torso,hip=bell(y,a.pelvis,.15)*torso;
      px+=x*(.24*s.waistWidth*waist+.1*s.hipWidth*hip);
      px+=x*.18*s.build*torso;pz+=z*.20*s.build*torso;
      pz+=z*(.25*s.waistDepth*waist+.22*s.hipDepth*bell(y,a.pelvis,.19)*(torso+leg));
      pz+=z*.2*s.torsoDepth*bell(y,a.chest,.16)*torso;
      const front=smooth(.015,.065,z)*torso*bodyWidth;
      const cup=bell(y,a.chest,.105)*bell(Math.abs(x),.063,.075)*front;
      if(s.chestVolume>=0)pz+=.035*s.chestVolume*cup;
      else{
        // Shrink the existing mound toward a ribcage envelope. A fixed negative
        // offset leaves the source mound intact and can dent the sternum.
        const rib=.035+.047*Math.sqrt(Math.max(0,1-(x/(a.shoulderX*.96))**2));
        const band=smooth(a.chest-.17,a.chest-.09,y)*(1-smooth(a.chest+.025,a.chest+.115,y));
        const depthScale=Math.max(.4,1+.20*s.build+.20*s.torsoDepth*bell(y,a.chest,.16));
        pz-=Math.max(0,z-rib)*(-s.chestVolume)*.94*depthScale*band*torso*bodyWidth;
      }
      px+=side*.015*s.chestSpacing*cup;py+=.02*s.chestLift*cup;
      const bellyY=a.waist-.01+s.bellyPosition*.025;
      const abdomen=(.032*s.bellyUpper*bell(y,bellyY+.037,.10)+.04*s.bellyLower*bell(y,bellyY-.052,.10))*front;
      pz+=abdomen;
      const under=bell(Math.abs(x),a.shoulderX,.065)*bell(y,a.shoulder-.06,.10)*(torso+arm);
      px+=side*.012*s.underarm*under;pz+=.007*s.underarm*under*smooth(-.015,.03,z);
      // Inflate around limb centrelines rather than stretching their distance
      // from the midline. Hands/feet and the knee/elbow rings stay unchanged.
      if(arm>0){
        const lateral=smooth(a.shoulderX*.68,a.shoulderX,Math.abs(x));
        const t=smooth(a.elbowY,a.shoulder,y),cx=a.elbowX+(a.shoulderX-a.elbowX)*t;
        const w=bell(y,(a.elbowY+a.shoulder)/2,(a.shoulder-a.elbowY)*.55)*arm*lateral;
        px+=(x-side*cx)*(s.arms*.35+s.build*.18)*w;pz+=(z-.015)*(s.arms*.35+s.build*.18)*w;
        const fore=bell(y,(a.wristY+a.elbowY)/2,(a.elbowY-a.wristY)*.48)*arm*lateral;
        const ft=smooth(a.wristY,a.elbowY,y),fc=a.wristX+(a.elbowX-a.wristX)*ft;
        px+=(x-side*fc)*(s.arms*.2+s.build*.12)*fore;pz+=(z-.035)*(s.arms*.2+s.build*.12)*fore;
      }
      if(leg>0){
        const legSide=x/Math.sqrt(x*x+.012*.012);
        const thigh=bell(y,(a.pelvis+a.kneeY)/2,(a.pelvis-a.kneeY)*.6)*leg;
        const t=smooth(a.kneeY,a.pelvis,y),cx=a.kneeX+(a.hipX-a.kneeX)*t;
        const whole=leg*smooth(a.ankleY,a.ankleY+.08,y)*(1-smooth(a.pelvis-.08,a.pelvis+.06,y));
        px+=(x-legSide*cx)*.27*s.build*whole;pz+=(z-.03)*.27*s.build*whole;
        px+=(x-legSide*cx)*.3*s.thighs*thigh;pz+=(z-.035)*.3*s.thighs*thigh;
        const calf=bell(y,(a.kneeY+a.ankleY)/2,(a.kneeY-a.ankleY)*.49)*leg;
        px+=(x-legSide*a.kneeX)*.28*s.calves*calf;pz+=(z-.015)*.28*s.calves*calf;
      }
    }
    const lengthOffset=armLengthOffset(x,y,z,mask,s,a);px+=lengthOffset[0];py+=lengthOffset[1];pz+=lengthOffset[2];
    const hand=mask.hand??0,foot=mask.foot??0;
    const dy=(vertical(py)-py)*Math.max(0,1-head-hand-foot)+heightDelta*head+(vertical(wristY)-wristY)*hand;
    return [px,py+dy,pz];
  }
  return {point,vertical,shape:s,landmarks:a};
}
