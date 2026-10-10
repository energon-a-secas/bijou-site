// Renderer-independent joint helpers. Coordinates are model rest metres.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const length=v=>Math.hypot(...v),scale=(v,s)=>v.map(n=>n*s);

export function shoulderMotion(shoulder,target,side){
  const d=sub(target,shoulder),elevation=Math.acos(clamp(-d[1]/Math.max(1e-7,length(d)),-1,1));
  return {lift:side*.27*smooth(.65,2.7,elevation),forward:side*.10*clamp(-d[2]/.23,-.4,1)};
}

export function solveLeg(hip,target,lengths,pole){
  const delta=sub(target,hip),distance=length(delta),axis=distance>1e-7?scale(delta,1/distance):[0,-1,0];
  const [a,b]=lengths,d=clamp(distance,Math.abs(a-b)+.01,a+b-.0005);
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  let bend=sub(pole,hip);bend=bend.map((v,i)=>v-axis[i]*dot(sub(pole,hip),axis));
  if(length(bend)<1e-6){const guide=Math.abs(axis[2])<.9?[0,0,-1]:[0,-1,0];bend=guide.map((v,i)=>v-axis[i]*dot(guide,axis));}
  bend=scale(bend,1/Math.max(1e-7,length(bend)));
  return {hip:[...hip],knee:hip.map((v,i)=>v+axis[i]*along+bend[i]*height),ankle:hip.map((v,i)=>v+axis[i]*d)};
}

export function jointCorrection([x,y,z],kind,side){
  if(x*side<0||y<.78||y>1.425)return [0,0,0];
  const bell=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
  if(kind==='underarm'){
    const w=bell(x*side,.142,.044)*bell(y,1.331,.066)*bell(z,0,.083);
    return [-side*.009*w,.022*w,z*.04*w];
  }
  const crease=bell(x*side,.07,.060)*bell(y,.958,.063)*bell(z,-.066,.061);
  const back=bell(x*side,.074,.065)*bell(y,.958,.071)*bell(z,.073,.065);
  return [side*.003*back,-.004*back,.014*crease+.007*back];
}
