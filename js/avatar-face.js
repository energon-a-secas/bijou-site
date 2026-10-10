// Face variants reshape the actual surface and keep the expression morph rig.
import * as T from './vendor/avatar-engine.js';

const shapes={soft:{width:1.065,jaw:1.16,chin:.005},oval:{width:.97,jaw:1.02,chin:-.005},heart:{width:1.02,jaw:.92,chin:.001},defined:{width:1,jaw:.99,chin:-.002}};

export function createFace(meshes){
  const uniforms=[];
  const seen=new Set();
  for(const mesh of meshes){
    mesh.geometry=mesh.geometry.clone();mesh.userData.faceBase=mesh.geometry.attributes.position.array.slice();
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(!/Face_00_SKIN/.test(mat.name)||seen.has(mat))continue;seen.add(mat);
      const u={blush:{value:1},freckles:{value:0},mark:{value:0}};uniforms.push(u);
      const original=mat.onBeforeCompile.bind(mat);
      mat.onBeforeCompile=(shader,renderer)=>{
        original(shader,renderer);shader.uniforms.bjBlush=u.blush;shader.uniforms.bjFreckles=u.freckles;shader.uniforms.bjMark=u.mark;
        shader.vertexShader=`varying vec3 bjFace;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nbjFace=position;');
        shader.fragmentShader=`varying vec3 bjFace;\nuniform float bjBlush;\nuniform float bjFreckles;\nuniform float bjMark;\n${shader.fragmentShader}`.replace('// #include <color_fragment>',`
          vec2 cheek=(vec2(abs(bjFace.x),bjFace.y)-vec2(.054,1.528))/vec2(.026,.012);
          float blush=exp(-dot(cheek,cheek)*1.5)*step(bjFace.z,-.035);
          vec3 neutral=vec3(diffuseColor.r,diffuseColor.r*.87,diffuseColor.r*.78);
          diffuseColor.rgb=mix(diffuseColor.rgb,neutral,blush*(1.-min(bjBlush,1.))*.8);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.80,.29,.30),blush*bjBlush*.12);
          if(bjFreckles>.5 && bjFace.z<-.04){
            for(int j=0;j<4;j++){
              vec2 delta=vec2(abs(bjFace.x),bjFace.y)-vec2(.042+float(j)*.007,1.53+sin(float(j)*2.)*.004);
              float spot=1.-smoothstep(.0006,.0015,length(delta));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.13,.09),spot*.65);
            }
          }
          if(abs(bjMark)>.5 && bjFace.z<-.025){
            float dotMark=1.-smoothstep(.001,.002,length(bjFace.xy-vec2(bjMark*.068,1.525)));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.055,.045),dotMark);
          }
          // #include <color_fragment>`);
      };
      mat.customProgramCacheKey=()=>`bijou-face-v1-${mat.isOutline?'outline':'skin'}`;
      mat.needsUpdate=true;
    }
  }
  function build(head){
    const shape=shapes[head.face]||shapes.soft;
    for(const mesh of meshes){
      const pos=mesh.geometry.attributes.position,base=mesh.userData.faceBase;
      for(let i=0;i<pos.count;i++){
        let x=base[i*3],y=base[i*3+1],z=base[i*3+2];
        const cheek=Math.max(0,Math.min(1,(1.56-y)/.085));
        x*=shape.width*(1+(shape.jaw-1)*Math.sin(cheek*Math.PI));
        y+=shape.chin*Math.pow(cheek,2);
        pos.setXYZ(i,x,y,z);
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
    for(const u of uniforms){u.blush.value=head.blush;u.freckles.value=head.freckles?1:0;u.mark.value=head.mark==='L'?1:head.mark==='R'?-1:0;}
  }
  return {build};
}
