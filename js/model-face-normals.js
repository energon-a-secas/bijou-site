import {smooth} from './model-shape.js';

// Fit z(u,v) locally instead of retaining the generated sculpt's noisy normal
// creases. This only changes shading directions, never positions or topology.
// Input/output normals are in normalized world rest space, as are the points.
export function fitFaceNormals(points,normals,masks,anchors={},hair=null){
  const radius=.023,eye=anchors.eye??1.537,chin=anchors.chin??1.421,buckets=new Map(),keys=[],seen=new Set();
  for(let i=0;i<points.length/3;i++){
    const p=points.subarray(i*3,i*3+3),key=Array.from(p,n=>Math.floor(n/radius));keys.push(key);
    const id=Array.from(p,n=>n.toFixed(5)).join(',');if(seen.has(id))continue;seen.add(id);
    const bucket=key.join(',');if(!buckets.has(bucket))buckets.set(bucket,[]);buckets.get(bucket).push(i);
  }
  const result=normals.slice();
  for(let i=0;i<points.length/3;i++){
    const at=i*3,x=points[at],y=points[at+1],z=points[at+2];
    const weight=(masks[i].head??0)*smooth(.025,.055,z)*(1-smooth(.05,.076,Math.abs(x)))
      *smooth(chin-.005,chin+.025,y)*(1-smooth(eye-.018,eye+.002,y))*.85;
    if(weight<.01||normals[at+2]<.1||(hair?.[i]??0)>.5)continue;
    const a=Array.from({length:6},()=>new Float64Array(7));let count=0;const key=keys[i];
    for(let jx=-1;jx<=1;jx++)for(let jy=-1;jy<=1;jy++)for(let jz=-1;jz<=1;jz++){
      const list=buckets.get([key[0]+jx,key[1]+jy,key[2]+jz].join(','));if(!list)continue;
      for(const j of list){
        const bt=j*3,u=(points[bt]-x)/radius,v=(points[bt+1]-y)/radius,h=(points[bt+2]-z)/radius,d=u*u+v*v+h*h;
        if(d>1.8||points[bt+2]<.018||(masks[j].head??0)<.6||normals[bt+2]<.1||(hair?.[j]??0)>.5)continue;
        const w=Math.exp(-d*2),b=[1,u,v,u*u,u*v,v*v];
        for(let row=0;row<6;row++){for(let col=0;col<6;col++)a[row][col]+=b[row]*b[col]*w;a[row][6]+=b[row]*h*w;}count++;
      }
    }
    if(count<12)continue;
    for(let k=0;k<6;k++)a[k][k]+=1e-4;
    const solution=solve(a);if(!solution)continue;
    const next=[-solution[1],-solution[2],1],length=Math.hypot(...next);
    let dot=0;for(let k=0;k<3;k++){next[k]/=length;dot+=next[k]*normals[at+k];}
    const blend=weight*smooth(.25,.75,dot);
    for(let k=0;k<3;k++)next[k]=normals[at+k]*(1-blend)+next[k]*blend;
    const unit=Math.hypot(...next);if(!Number.isFinite(unit)||unit<1e-9)continue;
    for(let k=0;k<3;k++)result[at+k]=next[k]/unit;
  }
  return result;
}
function solve(a){
  for(let col=0;col<6;col++){
    let pivot=col;for(let row=col+1;row<6;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-10)return null;[a[col],a[pivot]]=[a[pivot],a[col]];
    const divisor=a[col][col];for(let k=col;k<=6;k++)a[col][k]/=divisor;
    for(let row=0;row<6;row++)if(row!==col){const factor=a[row][col];for(let k=col;k<=6;k++)a[row][k]-=factor*a[col][k];}
  }
  return a.map(row=>row[6]);
}
