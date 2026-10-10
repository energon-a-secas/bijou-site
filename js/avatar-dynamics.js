import * as T from './vendor/avatar-engine.js';
import { createSoftSpring } from './soft-spring.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const deformSource=`
uniform vec3 bjTorsoMotion;
uniform vec3 bjHipMotion;
uniform float bjSeat;
uniform float bjFlare;
float bjBell(float y, float center, float width) {
  float d=(y-center)/width;
  return exp(-d*d);
}
vec3 bjDeform(vec3 p, float skirt) {
  if(dot(bjTorsoMotion,bjTorsoMotion)+dot(bjHipMotion,bjHipMotion)<.0000000025 && (skirt<.5 || (bjSeat<.001 && bjFlare<.001))) return p;
  float torso=bjBell(p.y,1.24,.115)* (1.-smoothstep(.125,.235,abs(p.x)));
  float hips=bjBell(p.y,.98,.15)* (1.-smoothstep(.15,.29,abs(p.x)));
  p+=bjTorsoMotion*torso + bjHipMotion*hips;
  if(skirt>.5){
    float drape=(1.-smoothstep(.96,1.10,p.y))*(1.-smoothstep(-.08,.10,p.z)*.86);
    float angle=bjSeat*drape;
    float drop=p.y-.99;
    p.y=.99+cos(angle)*drop+.018*sin(angle);
    p.z+=sin(angle)*drop;
    p.z-=sin(bjSeat)*.070*bjBell(p.y,1.035,.095)*(1.-smoothstep(-.08,.04,p.z));
    p.xz*=1.+bjFlare*(1.-smoothstep(.70,1.10,p.y));
  }
  return p;
}`;

export function createDynamics(){
  const torso=createSoftSpring(),hips=createSoftSpring({stiffness:65,limit:.019});
  const u={bjTorsoMotion:{value:new T.Vector3()},bjHipMotion:{value:new T.Vector3()},bjSeat:{value:0},bjFlare:{value:0}};
  const patched=new WeakSet(),media=matchMedia('(prefers-reduced-motion: reduce)');
  let body={},editing=false,previous=null,previousV=[0,0,0];
  function reset(){torso.reset();hips.reset();previous=null;previousV=[0,0,0];u.bjTorsoMotion.value.set(0,0,0);u.bjHipMotion.value.set(0,0,0);}
  function patch(material,drape){
    if(patched.has(material))return;patched.add(material);
    const original=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
    const originalKey=key();
    material.onBeforeCompile=(shader,renderer)=>{
      original(shader,renderer);Object.assign(shader.uniforms,u);
      shader.vertexShader=deformSource+'\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed=bjDeform(transformed,${drape?'1.':'0.'});`);
      // Finite-difference tangent transform keeps highlights on the deformed surface.
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        if(dot(bjTorsoMotion,bjTorsoMotion)+dot(bjHipMotion,bjHipMotion)>.000004 || (${drape?'true':'false'} && (bjSeat>.001 || bjFlare>.001))) {
        vec3 bn=normalize(objectNormal);
        vec3 bt=normalize(cross(bn,abs(bn.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.)));
        vec3 bb=cross(bn,bt);
        vec3 bp=bjDeform(position,${drape?'1.':'0.'});
        objectNormal=normalize(cross(bjDeform(position+bt*.0005,${drape?'1.':'0.'})-bp,bjDeform(position+bb*.0005,${drape?'1.':'0.'})-bp)); }`);
    };
    material.customProgramCacheKey=()=>`${originalKey}|bijou-motion-2|${drape}`;material.needsUpdate=true;
  }
  function attach(mesh,drape=false){
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])patch(mat,drape);
    if(!mesh.customDepthMaterial){mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});}
    patch(mesh.customDepthMaterial,drape);
  }
  function update(frame,dt){
    u.bjSeat.value=Math.acos(clamp(frame.bones.thighL?.sy??1,.25,1));
    u.bjFlare.value=clamp((frame.bones.skirt?.sx??1)-1,0,.35);
    if(editing||media.matches||!body.bounce){reset();return;}
    const reach=((frame.bones.handL?.ty??1)+(frame.bones.handR?.ty??1)-2)*.045;
    const pos=[frame.root.x/376,-frame.root.y/376,(frame.bones.spine?.a||0)*.003+reach];
    const h=Math.max(1/240,dt),velocity=previous?pos.map((x,i)=>clamp((x-previous[i])/h,-4,4)):[0,0,0];
    const force=velocity.map((v,i)=>clamp(-(v-previousV[i])/h*.075,-4,4));
    force[2]+=Math.sin(frame.root.turnY||0)*.45;
    previous=pos;previousV=velocity;
    u.bjTorsoMotion.value.fromArray(torso.step(dt,force,body.damping)).multiplyScalar(body.bounce);
    u.bjHipMotion.value.fromArray(hips.step(dt,force.map(v=>v*.65),body.damping)).multiplyScalar(body.bounce);
  }
  function impulse(strength=1){if(media.matches||editing||!body.bounce)return;torso.impulse([.06*strength,-.32*strength,.14*strength]);hips.impulse([-.04*strength,-.19*strength,.07*strength]);}
  return {attach,update,impulse,reset,configure(next){body=next;if(!body.bounce)reset();},set editing(on){editing=on;reset();},
    get diagnostics(){return {torso:u.bjTorsoMotion.value.toArray(),hips:u.bjHipMotion.value.toArray(),reduced:media.matches};}};
}
