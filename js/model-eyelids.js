import * as T from './vendor/avatar-engine.js';
import {createHumanEyelids} from './model-human-eyelids.js';

// A curved lash line completes the closed-eye silhouette. The source skin
// supplies the lid surface, so no floating skin-colored cover is necessary.
export function createEyelids(sculpt,anchors){
  if(sculpt.eyeAnchors)return createHumanEyelids(sculpt,anchors);
  if(sculpt.records.some(r=>r.node.geometry.attributes.studyBlinkL))return {fit(){},set(){},dispose(){}};
  const head=sculpt.bones.get('Head').node,group=new T.Group(),lids=[],rest=new Map();
  group.name='Bijou_eyelids';head.add(group);group.matrixAutoUpdate=false;
  const material=new T.MeshBasicMaterial({color:'#423039'});
  for(const [side,eye]of anchors.entries()){
    const curve=new T.CatmullRomCurve3(Array.from({length:7},(_,i)=>{const u=i/3-1;return new T.Vector3(eye.x+u*(eye.sphereRadius?eye.sphereRadius*.9:.023),eye.y+.0015-.003*u*u,eye.sphereRadius?eye.z+eye.sphereRadius+.0005-.008*u*u:.096-.016*u*u);}));
    const mesh=new T.Mesh(new T.TubeGeometry(curve,24,.00085,6,false),material);mesh.name='Closed_eye_'+side;group.add(mesh);lids.push(mesh);rest.set(mesh,mesh.geometry.attributes.position.array.slice());
  }
  function fit(){
    head.updateWorldMatrix(true,false);group.matrix.copy(head.matrixWorld).invert();group.matrix.decompose(group.position,group.quaternion,group.scale);group.matrixWorldNeedsUpdate=true;
    for(const mesh of lids){const p=mesh.geometry.attributes.position,base=rest.get(mesh);
      for(let i=0;i<p.count;i++)p.setXYZ(i,...sculpt.mapFacePoint(...base.subarray(i*3,i*3+3)));
      p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
  }
  fit();return {fit,set(blinks){lids.forEach((lid,i)=>lid.visible=blinks[i]>.86);},dispose(){for(const lid of lids)lid.geometry.dispose();material.dispose();group.removeFromParent();}};
}
