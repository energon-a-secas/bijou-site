import * as T from './vendor/avatar-engine.js';

const key=p=>p.map(v=>v.toFixed(6)).join(','),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

export function smoothNormals(geometry){
  geometry.computeVertexNormals();
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  let groups=geometry.userData.normalGroups;
  if(!groups){
    const map=new Map(),base=geometry.attributes.bjRest||p;
    for(let i=0;i<p.count;i++){
      const id=key([base.getX(i),base.getY(i),base.getZ(i)]);
      if(!map.has(id))map.set(id,[]);map.get(id).push(i);
    }
    groups=geometry.userData.normalGroups=[...map.values()].filter(g=>g.length>1);
  }
  const sum=new T.Vector3(),v=new T.Vector3();
  for(const group of groups){
    sum.set(0,0,0);for(const i of group)sum.add(v.fromBufferAttribute(n,i));sum.normalize();
    for(const i of group)n.setXYZ(i,sum.x,sum.y,sum.z);
  }
  n.needsUpdate=true;
}

// One Loop subdivision of the continuous body, welding geometric seams while
// retaining independent UV corners. Bone influences remain normalized.
export function refineBody(meshes){
  const vertices=[],faces=[],vertexMap=new Map(),points=[],pointMap=new Map();
  const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,edges=new Map();
  for(const mesh of meshes){
    const a=mesh.geometry.attributes,index=mesh.geometry.index,remap=new Map();
    for(let j=0;j<index.count;j++){
      const i=index.getX(j);
      if(!remap.has(i)){
        const p=[a.position.getX(i),a.position.getY(i),a.position.getZ(i)],uv=[a.uv.getX(i),a.uv.getY(i)];
        const joints=[0,1,2,3].map(k=>a.skinIndex.array[i*4+k]),weights=[0,1,2,3].map(k=>a.skinWeight.array[i*4+k]);
        const id=`${key(p)}|${key(uv)}|${joints}|${weights}`;
        if(!vertexMap.has(id)){
          const pk=key(p);if(!pointMap.has(pk)){pointMap.set(pk,points.length);points.push({p,near:new Set(),boundary:false});}
          vertexMap.set(id,vertices.length);vertices.push({p,uv,joints,weights,point:pointMap.get(pk)});
        }
        remap.set(i,vertexMap.get(id));
      }
      if(j%3===2)faces.push([remap.get(index.getX(j-2)),remap.get(index.getX(j-1)),remap.get(i)]);
    }
  }
  for(const face of faces)for(let i=0;i<3;i++){
    const a=vertices[face[i]].point,b=vertices[face[(i+1)%3]].point,c=vertices[face[(i+2)%3]].point;
    points[a].near.add(b);points[b].near.add(a);
    const id=edgeKey(a,b);if(!edges.has(id))edges.set(id,{a,b,opposite:[]});edges.get(id).opposite.push(c);
  }
  for(const e of edges.values())if(e.opposite.length!==2){points[e.a].boundary=true;points[e.b].boundary=true;}
  for(const v of points){
    const count=v.near.size,beta=count===3?3/16:3/(8*count);
    v.smooth=v.boundary||!count?v.p:v.p.map((n,k)=>(1-count*beta)*n+beta*[...v.near].reduce((sum,i)=>sum+points[i].p[k],0));
    if(v.p[1]>1.415)v.smooth=v.p;
  }
  const out=vertices.map(v=>({...v,p:points[v.point].smooth})),edgeVertices=new Map(),indices=[];
  function middle(a,b){
    const id=edgeKey(a,b);if(edgeVertices.has(id))return edgeVertices.get(id);
    const va=vertices[a],vb=vertices[b],e=edges.get(edgeKey(va.point,vb.point));
    let p=mix(va.p,vb.p,.5);
    if(e.opposite.length===2&&p[1]<1.415)p=p.map((_,k)=>(va.p[k]+vb.p[k])*.375+e.opposite.reduce((sum,i)=>sum+points[i].p[k],0)*.125);
    const influence=new Map();
    for(const v of [va,vb])v.joints.forEach((joint,i)=>influence.set(joint,(influence.get(joint)||0)+v.weights[i]*.5));
    const pairs=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4);while(pairs.length<4)pairs.push([0,0]);
    const total=pairs.reduce((sum,p)=>sum+p[1],0)||1,n=out.length;
    out.push({p,uv:mix(va.uv,vb.uv,.5),joints:pairs.map(p=>p[0]),weights:pairs.map(p=>p[1]/total)});edgeVertices.set(id,n);return n;
  }
  for(const [a,b,c] of faces){const ab=middle(a,b),bc=middle(b,c),ca=middle(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(out.flatMap(v=>v.p),3));
  g.setAttribute('uv',new T.Float32BufferAttribute(out.flatMap(v=>v.uv),2));
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(out.flatMap(v=>v.joints),4));
  g.setAttribute('skinWeight',new T.Float32BufferAttribute(out.flatMap(v=>v.weights),4));
  g.setIndex(indices);smoothNormals(g);g.computeBoundingSphere();return g;
}
