import * as T from './vendor/avatar-engine.js';
import { createBodyField } from './body-shape.js';

// Average normals across duplicated UV vertices, preserving a continuous surface.
function smoothNormals(geometry){
  geometry.computeVertexNormals();
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  let groups=geometry.userData.normalGroups;
  if(!groups){
    const map=new Map();
    const base=geometry.attributes.bjRest||p;
    for(let i=0;i<p.count;i++){
      const key=[base.getX(i),base.getY(i),base.getZ(i)].map(v=>v.toFixed(5)).join(',');
      if(!map.has(key))map.set(key,[]);map.get(key).push(i);
    }
    groups=geometry.userData.normalGroups=[...map.values()].filter(g=>g.length>1);
  }
  for(const group of groups){
    const sum=new T.Vector3();for(const i of group)sum.add(new T.Vector3().fromBufferAttribute(n,i));sum.normalize();
    for(const i of group)n.setXYZ(i,sum.x,sum.y,sum.z);
  }
  n.needsUpdate=true;
}
function deform(mesh,field,mode='body'){
  const pos=mesh.geometry.attributes.position,base=mesh.userData.shapeBase;
  for(let i=0;i<pos.count;i++)pos.setXYZ(i,...field.point(base[i*3],base[i*3+1],base[i*3+2],mode));
  pos.needsUpdate=true;smoothNormals(mesh.geometry);mesh.geometry.computeBoundingSphere();
}

export function createMorphRig(vrm,bones,rest,skin,fit,wardrobe){
  const nodes=[],skinned=[],sourceRest=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v.clone()]));
  vrm.scene.traverse(o=>{
    if(o.isBone)nodes.push({node:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),world:vrm.scene.worldToLocal(o.getWorldPosition(new T.Vector3()))});
    if(o.isSkinnedMesh)skinned.push(o);
  });
  for(const mesh of skin)mesh.userData.shapeBase=mesh.geometry.attributes.bjRest.array.slice();
  let field=createBodyField();
  const p=new T.Vector3();
  function rememberFit(){for(const mesh of fit)mesh.userData.shapeBase=mesh.geometry.attributes.bjRest.array.slice();}
  function rememberWardrobe(){
    for(const group of wardrobe.groups){
      group.updateWorldMatrix(true,true);
      const inverse=group.matrixWorld.clone().invert(),meshes=[];
      group.traverse(o=>{if(o.isMesh)meshes.push(o);});
      for(const mesh of meshes){
        const matrix=inverse.clone().multiply(mesh.matrixWorld);
        mesh.geometry.applyMatrix4(matrix);group.add(mesh);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);
        mesh.userData.shapeBase=mesh.geometry.attributes.position.array.slice();
      }
    }
  }
  function apply(body){
    field=createBodyField(body);
    // Recalculate the bind pose in rest space, never from a currently held pose.
    for(const r of nodes){r.node.position.copy(r.position);r.node.quaternion.copy(r.quaternion);r.node.scale.copy(r.scale);}
    vrm.scene.updateMatrixWorld(true);
    for(const r of nodes){
      p.fromArray(field.point(...r.world.toArray()));vrm.scene.localToWorld(p);r.node.parent.worldToLocal(p);r.node.position.copy(p);r.node.updateWorldMatrix(false,false);
    }
    vrm.scene.updateMatrixWorld(true);
    for(const [name,node] of Object.entries(bones))rest[name].copy(vrm.scene.worldToLocal(node.getWorldPosition(p)));
    const skeletons=new Set(skinned.map(o=>o.skeleton));for(const s of skeletons)s.calculateInverses();
    for(const mesh of skinned)mesh.bind(mesh.skeleton,mesh.matrixWorld);
    for(const mesh of skin)if(mesh.userData.shapeBase)deform(mesh,field);
    for(const group of wardrobe.groups){
      const bone=group.userData.bone;
      if(bone)group.position.copy(rest[bone]).multiplyScalar(-1);
      group.traverse(o=>{if(o.isMesh&&o.userData.shapeBase)deform(o,field,o.userData.skirt||group.name==='wear-skirt'?'skirt':'body');});
    }
    vrm.scene.updateMatrixWorld(true);
  }
  return {apply,rememberFit,rememberWardrobe,sourceRest,get field(){return field;}};
}
