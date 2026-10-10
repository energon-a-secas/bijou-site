import * as T from './vendor/avatar-engine.js';
import { smoothNormals } from './avatar-surface.js';
import { jointCorrection, smooth } from './pose-support.js';

// Relative pose shapes share the body's regional field and clothing envelopes.
// Geometry is replaced on reshaping because Three caches morph-target textures.
export function createCorrectives(meshes,bones){
  const disabled=new URLSearchParams(location.search).has('nocorrectives');
  const targets=[['underarm','right',1],['underarm','left',-1],['hip','right',1],['hip','left',-1]];
  const weights=[0,0,0,0],a=new T.Vector3(),b=new T.Vector3();
  function rebuild(field){
    for(const mesh of meshes){
      const old=mesh.geometry,g=new T.BufferGeometry();
      for(const [name,attribute] of Object.entries(old.attributes))g.setAttribute(name,attribute.clone());
      g.setIndex(old.index.clone());g.groups=old.groups.map(group=>({...group}));g.userData={...old.userData};
      g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
      const pos=g.attributes.position,rest=g.attributes.bjRest,normal=g.attributes.normal,base=mesh.userData.shapeBase;
      const temp=new T.BufferGeometry();temp.setIndex(g.index);temp.setAttribute('bjRest',rest);temp.userData={...g.userData};
      temp.setAttribute('position',pos.clone());smoothNormals(temp);const baselineNormals=temp.attributes.normal.array.slice();
      for(const [kind,side,sign] of targets){
        const delta=new Float32Array(pos.count*3),surface=pos.array.slice();
        for(let i=0;i<pos.count;i++){
          const d=jointCorrection([rest.getX(i),rest.getY(i),rest.getZ(i)],kind,sign),j=i*3;
          if(d.every(v=>Math.abs(v)<1e-7))continue;
          const p=field.point(base[j]+d[0],base[j+1]+d[1],base[j+2]+d[2]),origin=field.point(base[j],base[j+1],base[j+2]);
          for(let k=0;k<3;k++){delta[j+k]=p[k]-origin[k];surface[j+k]+=delta[j+k];}
        }
        temp.setAttribute('position',new T.Float32BufferAttribute(surface,3));smoothNormals(temp);
        const n=temp.attributes.normal,normalDelta=new Float32Array(delta.length);
        for(let i=0;i<normalDelta.length;i++)normalDelta[i]=n.array[i]-baselineNormals[i];
        const target=new T.Float32BufferAttribute(delta,3);target.name=`${side}-${kind}`;
        g.morphAttributes.position.push(target);g.morphAttributes.normal.push(new T.Float32BufferAttribute(normalDelta,3));
      }
      g.computeBoundingSphere();mesh.geometry=g;mesh.updateMorphTargets();old.dispose();
    }
  }
  function update(){
    for(let i=0;i<targets.length;i++){
      const [kind,side]=targets[i],parent=kind==='underarm'?bones.chest:bones.hips;
      const start=bones[`${side}${kind==='underarm'?'UpperArm':'UpperLeg'}`],end=bones[`${side}${kind==='underarm'?'LowerArm':'LowerLeg'}`];
      parent.updateWorldMatrix(true,true);
      parent.worldToLocal(start.getWorldPosition(a));parent.worldToLocal(end.getWorldPosition(b));b.sub(a).normalize();
      weights[i]=kind==='underarm'?smooth(.05,.85,b.y):smooth(.28,1.45,Math.atan2(-b.z,-b.y));
    }
    if(disabled)weights.fill(0);
    for(const mesh of meshes)for(let i=0;i<weights.length;i++)mesh.morphTargetInfluences[i]=weights[i];
  }
  return {rebuild,update,get diagnostics(){return Object.fromEntries(targets.map(([kind,side],i)=>[`${side}-${kind}`,weights[i]]));}};
}
