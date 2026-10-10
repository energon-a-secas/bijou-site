import * as T from './vendor/avatar-engine.js';
import { createHairChain } from './hair-chain.js';

const shaderSource=`
attribute float bjHairT;
attribute vec3 bjHairTangent;
uniform vec3 bjHairOffset[6];
vec3 bjHairMove(float t){
  float f=clamp(t,0.,1.)*5.;int i=min(4,int(f));float u=f-float(i);
  vec3 a=bjHairOffset[max(0,i-1)],b=bjHairOffset[i],c=bjHairOffset[i+1],d=bjHairOffset[min(5,i+2)];
  return .5*(2.*b+(-a+c)*u+(2.*a-5.*b+4.*c-d)*u*u+(-a+3.*b-3.*c+d)*u*u*u);
}
vec3 bjHairNormal(vec3 n){
  vec3 a=normalize(bjHairTangent),b=normalize(bjHairTangent+(bjHairMove(bjHairT+.003)-bjHairMove(bjHairT-.003))/.006);
  vec3 k=cross(a,b);return n+cross(k,n)+cross(k,cross(k,n))/max(.05,1.+dot(a,b));
}
`;
export function createHairMotion(bones,rest){
  let strands=[],head={},editing=false;
  const media=matchMedia('(prefers-reduced-motion: reduce)'),v=new T.Vector3(),inverse=new T.Matrix4();
  function add(mesh,curve){
    if(!mesh.geometry.attributes.bjHairT)return;
    const targets=Array.from({length:6},(_,i)=>curve.getPoint(i/5)),offsets=targets.map(()=>new T.Vector3());
    const chain=createHairChain(targets.map(p=>p.toArray())),entry={mesh,targets,offsets,chain,started:false};strands.push(entry);
    function patch(mat){
      const original=mat.onBeforeCompile.bind(mat),cache=mat.customProgramCacheKey();
      mat.onBeforeCompile=(shader,renderer)=>{
        original(shader,renderer);shader.uniforms.bjHairOffset={value:offsets};
        shader.vertexShader=shaderSource+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=bjHairMove(bjHairT);');
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=bjHairNormal(objectNormal);');
      };
      mat.customProgramCacheKey=()=>`${cache}|bijou-strand-1`;mat.needsUpdate=true;
    }
    const source=mesh.material;mesh.material=source.clone();
    mesh.material.onBeforeCompile=source.onBeforeCompile;mesh.material.customProgramCacheKey=source.customProgramCacheKey;patch(mesh.material);
    mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});patch(mesh.customDepthMaterial);
  }
  function collider(c,bone,origin){
    const m=bone.matrixWorld,e=m.elements;
    const axes=[new T.Vector3(e[0],e[1],e[2]),new T.Vector3(e[4],e[5],e[6]),new T.Vector3(e[8],e[9],e[10])];
    const radii=c.radii.map((r,i)=>r*axes[i].length());
    return {name:c.name,center:new T.Vector3().fromArray(c.center).sub(origin).applyMatrix4(m).toArray(),axes:axes.map(a=>a.normalize().toArray()),radii};
  }
  function update(dt,bodyColliders=[]){
    bones.head.updateWorldMatrix(true,true);
    const disabled=editing||media.matches||!head.hairMotion;
    const colliders=bodyColliders.map(c=>collider(c,c.name==='head'?bones.head:bones.chest,c.name==='head'?rest.head:rest.chest));
    for(const strand of strands){
      const {mesh,targets,chain,offsets}=strand;mesh.updateWorldMatrix(true,false);
      const world=targets.map(p=>p.clone().applyMatrix4(mesh.matrixWorld).toArray());
      if(!strand.started||disabled){chain.reset(world);strand.started=true;}
      const positions=disabled?world:chain.step(dt,world,{strength:head.hairMotion,stiffness:head.hairStiffness,damping:head.hairDamping,colliders});
      inverse.copy(mesh.matrixWorld).invert();
      for(let i=0;i<6;i++)offsets[i].copy(v.fromArray(positions[i]).applyMatrix4(inverse)).sub(targets[i]);
    }
  }
  return {add,update,clear(){strands=[];},configure(value){head=value;},set editing(value){editing=value;},get diagnostics(){return {strands:strands.length,maxDisplacement:Math.max(0,...strands.flatMap(s=>s.offsets.map(v=>v.length()))),reduced:media.matches};}};
}
