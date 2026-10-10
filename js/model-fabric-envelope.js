// A small fabric bridge over fine chest contours. This is a rest-fit envelope,
// not cloth simulation. It is bounded, outward only, and never rewrites skin.
export function createFabricEnvelope(positions,a){
  const cell=.016,radius=.032,grid=new Map();
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],y=positions[i+1],z=positions[i+2];
    if(Math.abs(x)>a.shoulderX*.9||y<a.waist+.04||y>a.chest+.10||z<.05)continue;
    const key=Math.floor(x/cell)+','+Math.floor(y/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
  }
  return (x,y,z)=>{
    if(z<.045||Math.abs(x)>a.shoulderX*.9||y<a.waist+.04||y>a.chest+.10)return z;
    let front=z;const gx=Math.floor(x/cell),gy=Math.floor(y/cell);
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const i of grid.get((gx+dx)+','+(gy+dy))||[]){
      const distance2=(positions[i]-x)**2+(positions[i+1]-y)**2;if(distance2>radius*radius)continue;
      front=Math.max(front,positions[i+2]-distance2*12);
    }
    const edge=Math.min(1,(y-a.waist-.04)/.04,(a.chest+.10-y)/.04,(a.shoulderX*.9-Math.abs(x))/.025);
    return z+Math.min(.012,front-z)*Math.max(0,edge);
  };
}
