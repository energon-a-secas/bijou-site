// Smooth inconsistent remesh normals over a small world-space neighborhood.
// Angle rejection protects sharp joins and prevents opposing surfaces mixing.
// This changes shading only; positions/topology and the source asset stay intact.
export function smoothStudyNormals(points,normals,masks,anchors={}){
  const cell=.018,buckets=new Map(),count=points.length/3,keys=[],eye=anchors.eye??1.537;
  for(let i=0;i<count;i++){
    const key=[0,1,2].map(k=>Math.floor(points[i*3+k]/cell));keys.push(key);const id=key.join(',');
    if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(i);
  }
  const output=normals.slice();
  for(let i=0;i<count;i++){
    const at=i*3,p=points.subarray(at,at+3),n=normals.subarray(at,at+3),key=keys[i],sum=[0,0,0];
    const head=(masks[i].head??0)>.6,face=head&&p[2]>.025&&Math.abs(p[0])<.075&&p[1]<eye+.025;
    const lid=face&&Math.abs(Math.abs(p[0])-.043)<.028&&Math.abs(p[1]-eye+.007)<.016;
    const radius=face&&!lid?.018:head?.009:.0075,r2=radius*radius,angle=face&&!lid?.55:.72,blend=face&&!lid?1:head?.88:.65;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const group=buckets.get([key[0]+x,key[1]+y,key[2]+z].join(','));if(!group)continue;
      for(const j of group){const offset=j*3,d=(points[offset]-p[0])**2+(points[offset+1]-p[1])**2+(points[offset+2]-p[2])**2;
        if(d>r2||n[0]*normals[offset]+n[1]*normals[offset+1]+n[2]*normals[offset+2]<angle)continue;
        const weight=Math.exp(-d/r2*2.);for(let k=0;k<3;k++)sum[k]+=normals[offset+k]*weight;
      }
    }
    const length=Math.hypot(...sum);if(length<1e-9)continue;
    const next=sum.map((v,k)=>v/length*blend+n[k]*(1-blend)),unit=Math.hypot(...next);
    for(let k=0;k<3;k++)output[at+k]=next[k]/unit;
  }
  return output;
}
