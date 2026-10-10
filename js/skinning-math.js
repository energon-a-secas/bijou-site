// CPU counterpart of the GPU's blended dual-quaternion position transform.
// Used for surface contact probes, including the posed garment/body boundary.
export function transformDQ(point,joints,weights,bones){
  const real=[0,0,0,0],dual=[0,0,0,0],scale=[0,0,0],anchor=joints[0]*12;
  for(let i=0;i<4;i++){
    const j=joints[i]*12,w=weights[i];if(!w)continue;
    const sign=bones[anchor]*bones[j]+bones[anchor+1]*bones[j+1]+bones[anchor+2]*bones[j+2]+bones[anchor+3]*bones[j+3]<0?-1:1;
    for(let k=0;k<4;k++){real[k]+=bones[j+k]*w*sign;dual[k]+=bones[j+4+k]*w*sign;}
    for(let k=0;k<3;k++)scale[k]+=bones[j+8+k]*w;
  }
  const n=Math.max(1e-8,Math.hypot(...real));for(let k=0;k<4;k++){real[k]/=n;dual[k]/=n;}
  const projection=real.reduce((s,v,i)=>s+v*dual[i],0);for(let k=0;k<4;k++)dual[k]-=real[k]*projection;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const p=point.map((v,i)=>v*scale[i]),qp=cross(real,p),q2=cross(real,qp),qd=cross(real,dual);
  return p.map((v,i)=>v+2*(real[3]*qp[i]+q2[i])+2*(real[3]*dual[i]-dual[3]*real[i]+qd[i]));
}
