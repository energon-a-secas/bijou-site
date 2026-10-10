// Shared, bounded rest-space morphs. No renderer or storage dependencies.
export const BODY_REGIONS = [
  { id:'shoulders', name:'Shoulders', y:1.365, x:.10 },
  { id:'armpits', name:'Armpits', y:1.32, x:-.13 },
  { id:'bust', name:'Chest', y:1.285, x:0 },
  { id:'torso', name:'Torso', y:1.195, x:0 },
  { id:'waist', name:'Waist', y:1.105, x:0 },
  { id:'belly', name:'Belly', y:1.065, x:.08 },
  { id:'hips', name:'Hips', y:.98, x:0 },
  { id:'arms', name:'Arms', y:1.19, x:.23 },
  { id:'legs', name:'Legs', y:.77, x:.085 },
];
export const BELLY_KEYS=['bellyUpper','bellyLower','bellyHeight'];
export const BUST_KEYS=['bustVolume','bustSpacing','bustLift'];
export const FULLNESS_REGIONS=['torso','waist','belly','hips','arms','legs'];
export const FULLNESS_KEYS=FULLNESS_REGIONS.map(k=>`${k}Fullness`);
export const SHAPE_KEYS = ['build', ...BODY_REGIONS.flatMap(r=>[r.id,`${r.id}Depth`]),...BELLY_KEYS,...BUST_KEYS,...FULLNESS_KEYS];
export const SHAPE_DEFAULTS = Object.fromEntries(SHAPE_KEYS.map(k=>[k,FULLNESS_KEYS.includes(k)?0:.5]));
export const MOTION_DEFAULTS = {bounce:.35,damping:.65};
export const NAIL_DEFAULTS={nailLength:.15,nailShape:'natural',nailColor:'natural'};
export const NAIL_SHAPES=[{id:'natural',name:'Natural'},{id:'round',name:'Round'},{id:'almond',name:'Almond'},{id:'square',name:'Square'}];
export const NAIL_COLORS=[{id:'natural',name:'Natural',color:'#eecac4'},{id:'ivory',name:'Ivory',color:'#f6eee5'},{id:'rose',name:'Rose',color:'#c36c84'},{id:'ruby',name:'Ruby',color:'#8e294c'},{id:'teal',name:'Teal',color:'#427f86'},{id:'ink',name:'Ink',color:'#292434'}];
const preset=(id,name,values)=>({id,name,values:{...SHAPE_DEFAULTS,...values}});
export const BODY_PRESETS = [
  preset('balanced','Balanced',{}),
  preset('slender','Slender',{build:.22,shoulders:.4,torso:.28,torsoDepth:.3,waist:.3,hips:.35,hipsDepth:.35,arms:.25,armsDepth:.3,legs:.25,legsDepth:.3}),
  preset('soft','Soft',{build:.64,torso:.62,torsoDepth:.65,waist:.65,waistDepth:.64,bellyDepth:.66,bellyLower:.6,hips:.65,hipsDepth:.64,arms:.62,armsDepth:.6,legs:.66,legsDepth:.63}),
  preset('rounded','Rounded',{build:.68,torso:.72,torsoDepth:.8,waist:.44,waistDepth:.56,bellyDepth:.6,hips:.82,hipsDepth:.82,arms:.6,armsDepth:.66,legs:.78,legsDepth:.8}),
  preset('athletic','Athletic',{build:.55,shoulders:.8,shouldersDepth:.65,torso:.53,torsoDepth:.42,waist:.42,hips:.45,hipsDepth:.48,arms:.7,armsDepth:.62,legs:.65,legsDepth:.6}),
];
export const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:.5));
const smooth=(a,b,v)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const regions=[[.90,'hips'],[1.01,'hips'],[1.105,'waist'],[1.25,'torso'],[1.365,'shoulders'],[1.455,null]];

export function createBodyField(body={}) {
  const value=k=>clamp01(body[k]??.5)-.5+(FULLNESS_REGIONS.includes(k.replace(/Depth$/,''))?clamp01(body[`${k.replace(/Depth$/,'')}Fullness`]??0)*.7:0);
  const mass=value('build')*.20;
  const bell=(v,center,width)=>Math.exp(-(((v-center)/width)**2));
  function abdomen(x,y,z){
    const height=value('bellyHeight')*.07,front=smooth(-.012,-.06,z);
    const upper=bell(y,1.145+height,.062),lower=bell(y,1.055+height,.065);
    const spread=bell(x,0,.079+value('belly')*.05);
    const depth=value('bellyDepth'),projection=depth*(depth>0?.14:.03);
    const offset=(projection*bell(y,1.085+height,.10)+value('bellyUpper')*.075*upper+value('bellyLower')*.085*lower)*spread*front;
    return [x*(1+value('belly')*.28*bell(y,1.08+height,.095)*front),y,z-offset];
  }
  function details(x,y,z,sourceX=x,sourceY=y){
    const ax=Math.abs(sourceX),weight=bell(ax,.135,.037)*bell(sourceY,1.318,.030)*(1-smooth(1.345,1.37,sourceY));
    x+=Math.sign(x)*value('armpits')*.035*weight;
    y+=value('armpits')*.017*weight;
    z+=Math.sign(z)*value('armpitsDepth')*.025*weight;
    const side=Math.sign(x)||1,front=smooth(-.038,-.085,z),cup=bell(Math.abs(sourceX),.066,.073)*bell(sourceY,1.285,.059)*front*smooth(.006,.024,Math.abs(sourceX))*(1-smooth(1.335,1.385,sourceY));
    const volume=value('bustVolume');
    x+=((x-side*.066)*(volume*.75+value('bust')*.6)+side*value('bustSpacing')*.024)*cup;
    y+=((y-1.285)*volume*.8+value('bustLift')*.04)*cup;
    z+=((z+.065)*volume*1.15-value('bustDepth')*.05)*cup;
    return abdomen(x,y,z);
  }
  function profile(y,depth=false){
    const key=id=>{
      if(!id)return 1;
      const factor=1+value(id+(depth?'Depth':''))*(depth?.65:.55)+mass;
      // A full torso still needs enough shoulder socket width to articulate.
      return id==='shoulders'&&!depth?Math.max(factor,.88+mass+Math.max(0,value('torso'))*.28):factor;
    };
    for(let i=1;i<regions.length;i++)if(y<regions[i][0]){
      const [a,ka]=regions[i-1],[b,kb]=regions[i];return mix(key(ka),key(kb),smooth(a,b,y));
    }
    return 1;
  }
  function point(x,y,z,mode='body') {
    if(y>1.455||y<.14)return [x,y,z];
    const tx=x*profile(y),tz=z*profile(y,true),ax=Math.abs(x),side=Math.sign(x)||1;
    if(mode==='skirt')return details(tx,y,tz,x,y);
    if(y>1.26&&ax>.13){
      const armBlend=smooth(.13,.21,ax)*smooth(1.26,1.33,y),hand=1-smooth(.45,.54,ax);
      const dx=(profile(1.378)-1)*.109;
      const armY=1.373+(y-1.373)*(1+(value('arms')*.65+mass)*hand);
      const armZ=z*(1+(value('armsDepth')*.65+mass)*hand);
      return details(mix(tx,x+side*dx,armBlend),mix(y,armY,armBlend),mix(tz,armZ,armBlend),x,y);
    }
    if(y<1.015){
      const t=smooth(.16,.95,y),legWeight=1-smooth(.92,1.015,y);
      const center=mix(.044,.077,t),spread=value('hips')*.035*t+mass*.02*t;
      const width=1+(value('legs')*.70+mass)*smooth(.15,.4,y);
      const depth=1+(value('legsDepth')*.70+mass)*smooth(.15,.4,y);
      const lx=side*(center+spread)+(x-side*center)*width;
      return details(mix(tx,lx,legWeight),y,mix(tz,z*depth,legWeight),x,y);
    }
    return details(tx,y,tz,x,y);
  }
  return {point,profile,body:{...body}};
}

export function matchingBody(body){return BODY_PRESETS.find(p=>SHAPE_KEYS.every(k=>Math.abs((body[k]??SHAPE_DEFAULTS[k])-p.values[k])<.001))?.id||null;}
