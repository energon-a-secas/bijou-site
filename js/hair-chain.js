// Fixed-step constrained strand motion, independent of renderer and frame rate.
const length=v=>Math.hypot(...v),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createHairChain(rest){
  let points=rest.map(p=>[...p]),old=rest.map(p=>[...p]),accumulator=0;
  function reset(targets=rest){points=targets.map(p=>[...p]);old=targets.map(p=>[...p]);accumulator=0;}
  function step(dt,targets,{strength=.55,stiffness=.65,damping=.6,colliders=[]}={}){
    if(!strength||length(sub(targets[0],points[0]))>.45){reset(targets);return points;}
    accumulator+=clamp(dt,0,.05);const h=1/120;
    while(accumulator>=h){
      accumulator-=h;
      const lengths=targets.slice(1).map((p,i)=>length(sub(p,targets[i])));
      points[0]=[...targets[0]];old[0]=[...targets[0]];
      for(let i=1;i<points.length;i++){
        const previous=[...points[i]],friction=Math.exp(-(3+damping*14)*h),k=25+stiffness*160;
        points[i]=points[i].map((v,j)=>v+(v-old[i][j])*friction+(targets[i][j]-v)*k*h*h+(j===1?-.8*strength*h*h:0));
        old[i]=previous;
      }
      for(let pass=0;pass<6;pass++)for(let i=1;i<points.length;i++){
        const d=sub(points[i],points[i-1]),n=Math.max(1e-7,length(d));
        points[i]=points[i-1].map((v,j)=>v+d[j]*lengths[i-1]/n);
        if(i>1)for(const c of colliders){
          if(c.name==='head'&&i<4)continue;
          const delta=sub(points[i],c.center),local=c.axes.map(axis=>dot(delta,axis));
          const q=length(local.map((v,j)=>v/(c.radii[j]+.006)));
          if(q<1&&q>1e-6)for(let j=0;j<3;j++)for(let k=0;k<3;k++)points[i][k]+=c.axes[j][k]*local[j]*(1/q-1);
        }
        const offset=sub(points[i],targets[i]),limit=.018+strength*.09,span=length(offset);
        if(span>limit)points[i]=targets[i].map((v,j)=>v+offset[j]*limit/span);
      }
    }
    return points;
  }
  return {step,reset,get points(){return points;}};
}
