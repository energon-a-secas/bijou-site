// Volume-preserving dual-quaternion skinning. The same deformation is used for
// body, clothing, normals and shadow depth; source joint weights are retained.
import * as T from './vendor/avatar-engine.js';
import { transformDQ } from './skinning-math.js';

const helpers=`
#ifdef USE_SKINNING
uniform sampler2D bjBoneDQ;
vec4 bjBone(float i, int part){return texelFetch(bjBoneDQ,ivec2(int(i)*3+part,0),0);}
vec3 bjRotate(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
#endif
`;
const base=`
#ifdef USE_SKINNING
vec4 r0=bjBone(skinIndex.x,0),r1=bjBone(skinIndex.y,0),r2=bjBone(skinIndex.z,0),r3=bjBone(skinIndex.w,0);
vec4 w=skinWeight*vec4(1.,dot(r0,r1)<0.?-1.:1.,dot(r0,r2)<0.?-1.:1.,dot(r0,r3)<0.?-1.:1.);
vec4 bjReal=r0*w.x+r1*w.y+r2*w.z+r3*w.w;
float bjLength=max(length(bjReal),.00001);
vec4 bjDual=(bjBone(skinIndex.x,1)*w.x+bjBone(skinIndex.y,1)*w.y+bjBone(skinIndex.z,1)*w.z+bjBone(skinIndex.w,1)*w.w)/bjLength;
bjReal/=bjLength;bjDual-=bjReal*dot(bjReal,bjDual);
vec3 bjScale=bjBone(skinIndex.x,2).xyz*skinWeight.x+bjBone(skinIndex.y,2).xyz*skinWeight.y+bjBone(skinIndex.z,2).xyz*skinWeight.z+bjBone(skinIndex.w,2).xyz*skinWeight.w;
#endif
`;
const position=`
#ifdef USE_SKINNING
vec3 bjTranslation=2.*(bjReal.w*bjDual.xyz-bjDual.w*bjReal.xyz+cross(bjReal.xyz,bjDual.xyz));
transformed=bjRotate(bjReal,transformed*bjScale)+bjTranslation;
#endif
`;
const normal=`
#ifdef USE_SKINNING
objectNormal=bjRotate(bjReal,objectNormal/max(bjScale,vec3(.0001)));
#ifdef USE_TANGENT
objectTangent=bjRotate(bjReal,objectTangent);
#endif
#endif
`;

export function createSkinning(meshes){
  const skeleton=meshes[0].skeleton,values=new Float32Array(skeleton.bones.length*12);
  const texture=new T.DataTexture(values,skeleton.bones.length*3,1,T.RGBAFormat,T.FloatType);
  texture.needsUpdate=true;const uniform={value:texture},patched=new WeakSet();
  const matrix=new T.Matrix4(),inverse=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),dual=new T.Quaternion();
  function patch(material){
    if(patched.has(material))return;patched.add(material);
    const original=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      original(shader,renderer);shader.uniforms.bjBoneDQ=uniform;
      shader.vertexShader=helpers+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',base).replace('#include <skinnormal_vertex>',normal).replace('#include <skinning_vertex>',position);
    };
    material.customProgramCacheKey=()=>`${cache}|bijou-dq-1`;material.needsUpdate=true;
  }
  function attach(mesh){if(new URLSearchParams(location.search).has('linear'))return;patch(mesh.material);if(mesh.customDepthMaterial)patch(mesh.customDepthMaterial);}
  function update(){
    meshes[0].updateWorldMatrix(true,false);skeleton.bones[0].updateWorldMatrix(true,true);skeleton.update();
    // Strip the shared world transform before decomposition. Nonuniform stage
    // scaling otherwise introduces shear and displaces even rigid finger joints.
    inverse.copy(meshes[0].matrixWorld).invert();
    for(let i=0;i<skeleton.bones.length;i++){
      matrix.copy(inverse).multiply(skeleton.bones[i].matrixWorld).multiply(skeleton.boneInverses[i]).multiply(meshes[0].bindMatrix).decompose(p,q,scale);
      dual.set(p.x,p.y,p.z,0).multiply(q);const j=i*12;
      values.set([q.x,q.y,q.z,q.w,dual.x*.5,dual.y*.5,dual.z*.5,dual.w*.5,scale.x,scale.y,scale.z,0],j);
    }
    texture.needsUpdate=true;
  }
  function point(mesh,index,out){
    const g=mesh.geometry,a=g.attributes,p=[a.position.getX(index),a.position.getY(index),a.position.getZ(index)];
    for(let i=0;i<(g.morphAttributes.position?.length||0);i++){
      const weight=mesh.morphTargetInfluences[i];if(!weight)continue;
      const delta=g.morphAttributes.position[i];p[0]+=delta.getX(index)*weight;p[1]+=delta.getY(index)*weight;p[2]+=delta.getZ(index)*weight;
    }
    out.fromArray(transformDQ(p,a.skinIndex.array.subarray(index*4,index*4+4),a.skinWeight.array.subarray(index*4,index*4+4),values));
    return out;
  }
  return {attach,update,point};
}
