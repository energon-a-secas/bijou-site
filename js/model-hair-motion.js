import * as T from './vendor/avatar-engine.js';
import { createHairChain } from './hair-chain.js';
const shaderSource=`
attribute float bjHairT;
attribute vec3 bjHairTangent;
uniform vec3 bjHairOffset[6];
vec3 studyHairMove(float t){float f=clamp(t,0.,1.)*5.;int i=min(4,int(f));float u=f-float(i);vec3 a=bjHairOffset[max(0,i-1)],b=bjHairOffset[i],c=bjHairOffset[i+1],d=bjHairOffset[min(5,i+2)];return .5*(2.*b+(-a+c)*u+(2.*a-5.*b+4.*c-d)*u*u+(-a+3.*b-3.*c+d)*u*u*u);}
vec3 studyHairNormal(vec3 n){vec3 a=normalize(bjHairTangent),b=normalize(bjHairTangent+(studyHairMove(bjHairT+.003)-studyHairMove(bjHairT-.003))/.006);vec3 k=cross(a,b);return n+cross(k,n)+cross(k,cross(k,n))/max(.05,1.+dot(a,b));}
`;
export function createStudioHairMotion(){
  let strands=[],maxDisplacement=0;const inverse=new T.Matrix4(),point=new T.Vector3();
  function add(mesh,curve){
    const targets=Array.from({length:6},(_,i)=>curve.getPoint(i/5)),offsets=targets.map(()=>new T.Vector3()),chain=createHairChain(targets.map(p=>p.toArray()));
    const original=mesh.material.onBeforeCompile.bind(mesh.material),key=mesh.material.customProgramCacheKey();
    mesh.material.onBeforeCompile=(shader,renderer)=>{original(shader,renderer);shader.uniforms.bjHairOffset={value:offsets};shader.vertexShader=shaderSource+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=studyHairMove(bjHairT);').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=studyHairNormal(objectNormal);');};
    mesh.material.customProgramCacheKey=()=>key+'|studio-hair-motion-1';mesh.material.needsUpdate=true;strands.push({mesh,targets,offsets,chain,started:false});
  }
  function update(dt,strength,colliders=[],reset=false){
    maxDisplacement=0;
    for(const s of strands){
      s.mesh.updateWorldMatrix(true,false);const world=s.targets.map(p=>p.clone().applyMatrix4(s.mesh.matrixWorld).toArray());
      if(!s.started||reset||!strength){s.chain.reset(world);s.started=true;}
      const positions=reset||!strength?world:s.chain.step(dt,world,{strength,stiffness:.82,damping:.8,colliders});inverse.copy(s.mesh.matrixWorld).invert();
      for(let i=0;i<6;i++){s.offsets[i].copy(point.fromArray(positions[i]).applyMatrix4(inverse)).sub(s.targets[i]);maxDisplacement=Math.max(maxDisplacement,s.offsets[i].length());}
    }
    return maxDisplacement;
  }
  return {add,update,clear(){strands=[];maxDisplacement=0;},get diagnostics(){return {strands:strands.length,maxDisplacement};}};
}
