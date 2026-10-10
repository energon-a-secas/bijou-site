import * as T from './vendor/avatar-engine.js';
import { createModelField, cleanModelShape } from './model-shape.js';
import { createFaceField, cleanAppearance, APPEARANCE_DEFAULTS } from './model-appearance.js';
import { createAtlasSampler } from './model-surface.js';
import {smoothStudyNormals} from './model-smooth-normals.js';
import {fitFaceNormals} from './model-face-normals.js';

function boneMask(name){
  const head=/head|neck/i.test(name)?1:0,arm=/arm|hand|shoulder/i.test(name)?1:0,leg=/leg|foot|toe/i.test(name)?1:0;
  return {head,arm,leg,torso:1-head-arm-leg,hand:/hand/i.test(name)?1:0,foot:/foot|toe/i.test(name)?1:0};
}
function vertexMask(mesh,index){
  const skin=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight;
  const result={head:0,arm:0,leg:0,torso:0,hand:0,foot:0};
  if(!skin||!weight)return {};
  for(let k=0;k<4;k++){
    const bone=mesh.skeleton.bones[skin.array[index*4+k]],w=weight.array[index*4+k];
    const mask=boneMask(bone?.name||'');for(const key of Object.keys(result))result[key]+=mask[key]*w;
  }
  return result;
}
function normalGroups(geometry){
  const groups=new Map(),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(5)).join(',');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
  }
  return [...groups.values()].filter(g=>g.length>1);
}
// Call after the immutable outer group has normalized the imported rest pose.
export function createModelSculpt(root,clips=[]){
  root.updateWorldMatrix(true,true);
  const calibration=root.userData.bijouFace,cleanTopology=root.userData.bijouCleanTopology===true;
  const faceAt=y=>new T.Vector3(0,y,0).applyMatrix4(root.matrixWorld).y;
  const calibratedFace=root.userData.bijouAnimeFace||(calibration?{eye:faceAt(calibration.eye),mouth:faceAt(calibration.mouth),chin:faceAt(calibration.chin),eyeX:Math.abs(calibration.eyes[0].x)}:null);
  const calibratedEyes=calibration?.eyes.map(eye=>{const p=new T.Vector3(eye.x,eye.y,eye.z).applyMatrix4(root.matrixWorld);return {...eye,...{x:p.x,y:p.y,z:p.z}};});
  const bones=[],meshes=[],world=new T.Vector3(),skeletons=new Set(),seams=new Map();
  // Meshy's rig has metre vertices under a centimetre Armature, compensated by
  // a nonstandard bind matrix. Resolve the actual rest surface into mesh-local
  // coordinates once before adopting standard Three/glTF bind transforms.
  root.traverse(node=>{
    if(!node.isSkinnedMesh)return;
    seams.set(node,normalGroups(node.geometry));
    const p=node.geometry.attributes.position,rest=new Float32Array(p.array.length);
    for(let i=0;i<p.count;i++)node.getVertexPosition(i,world).toArray(rest,i*3);
    p.array.set(rest);p.needsUpdate=true;
  });
  root.traverse(node=>{
    if(node.isBone)bones.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),world:node.getWorldPosition(new T.Vector3()),mask:boneMask(node.name)});
    if(node.isMesh){
      const geometry=node.geometry,base=geometry.attributes.position.array.slice(),points=[],masks=[],surface=[],sample=createAtlasSampler(node);
      for(let i=0;i<base.length/3;i++){
        points.push(...world.fromArray(base,i*3).applyMatrix4(node.matrixWorld).toArray());masks.push(vertexMask(node,i));surface.push(sample(i));
      }
      const groups=seams.get(node)||normalGroups(geometry);
      geometry.setAttribute('studyRest',new T.Float32BufferAttribute(points,3));
      // Atlas seams can carry different weights despite coincident source
      // positions. Share their morph classification and skin weights so edits
      // and walking cannot pull the two sides apart.
      for(const group of groups){
        const averaged={head:0,arm:0,leg:0,torso:0,hand:0,foot:0},influences=new Map();
        for(const id of group){for(const key of Object.keys(averaged))averaged[key]+=masks[id][key]/group.length;
          for(let k=0;k<4;k++){const bone=geometry.attributes.skinIndex.array[id*4+k],w=geometry.attributes.skinWeight.array[id*4+k]/group.length;influences.set(bone,(influences.get(bone)||0)+w);}}
        const ranked=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,v)=>n+v[1],0);
        for(const id of group){masks[id]={...averaged};for(let k=0;k<4;k++){geometry.attributes.skinIndex.array[id*4+k]=ranked[k]?.[0]||0;geometry.attributes.skinWeight.array[id*4+k]=(ranked[k]?.[1]||0)/sum;}}
      }
      geometry.attributes.skinIndex.needsUpdate=true;geometry.attributes.skinWeight.needsUpdate=true;
      const count=geometry.index?.count??geometry.attributes.position.count,wearable=new Uint8Array(count/3),skinHint=new Float32Array(geometry.attributes.position.count),hairHint=new Float32Array(skinHint.length),clothHint=new Float32Array(skinHint.length),neighbors=new Uint16Array(skinHint.length);
      for(let at=0;at<count;at+=3){
        const ids=[0,1,2].map(k=>geometry.index?geometry.index.getX(at+k):at+k),s=sample.triangle(...ids);
        wearable[at/3]=Math.max(s.cloth,s.skin)>.2?1:0;
        const skin=s.color[0]>.48&&s.skin>.3&&s.cloth<.1?1:0;
        const hair=wearable[at/3]===0&&ids.reduce((n,id)=>n+points[id*3+1],0)/3>.95?1:0;
        for(const id of ids){skinHint[id]+=skin;hairHint[id]+=hair;clothHint[id]+=s.cloth;neighbors[id]++;}
      }
      for(let i=0;i<skinHint.length;i++){skinHint[i]/=Math.max(1,neighbors[i]);hairHint[i]/=Math.max(1,neighbors[i]);clothHint[i]/=Math.max(1,neighbors[i]);}
      const semantic=node.userData.bijouSurface;
      if(node.userData.bijouAnimeBody)hairHint.fill(-1);
      if(semantic){skinHint.fill(semantic==='skin'?1:0);hairHint.fill(semantic==='hair'?1:-1);clothHint.fill(semantic==='cloth'?1:0);wearable.fill(semantic==='skin'||semantic==='cloth'?1:0);}
      geometry.setAttribute('studySurface',new T.Float32BufferAttribute(skinHint,1));
      geometry.setAttribute('studyHair',new T.Float32BufferAttribute(hairHint,1));
      geometry.setAttribute('studyCloth',new T.Float32BufferAttribute(clothHint,1));
      geometry.setAttribute('studyEye',new T.Float32BufferAttribute(new Float32Array(skinHint.length).fill(semantic?Number(semantic==='eye'):1),1));
      const neckY=root.getObjectByName('neck')?.getWorldPosition(new T.Vector3()).y;
      const anchors=calibratedFace||{eye:neckY===undefined?1.537:neckY+.176,chin:neckY===undefined?1.421:neckY+.060};
      const cleanNormals=cleanTopology||node.userData.bijouCleanNormals,rest=new Float32Array(points),normal=cleanNormals?geometry.attributes.normal.array.slice():smoothStudyNormals(rest,geometry.attributes.normal.array,masks,anchors);
      const worldNormals=new Float32Array(normal.length),toWorld=new T.Matrix3().getNormalMatrix(node.matrixWorld),toLocal=new T.Matrix3().getNormalMatrix(node.matrixWorld.clone().invert());
      const direction=new T.Vector3();for(let i=0;i<normal.length;i+=3)direction.fromArray(normal,i).applyMatrix3(toWorld).normalize().toArray(worldNormals,i);
      const fitted=cleanNormals?worldNormals:fitFaceNormals(rest,worldNormals,masks,anchors,hairHint);
      for(let i=0;i<normal.length;i+=3)direction.fromArray(fitted,i).applyMatrix3(toLocal).normalize().toArray(normal,i);
      meshes.push({node,base,points:rest,masks,surface,wearable,index:geometry.index.clone(),groups,normal});
      if(node.skeleton)skeletons.add(node.skeleton);
    }
  });
  const byName=new Map(bones.map(b=>[b.node.name,b]));
  const at=name=>byName.get(name)?.world;
  const l=at('LeftArm'),el=at('LeftForeArm'),wr=at('LeftHand'),hip=at('LeftUpLeg'),knee=at('LeftLeg'),ankle=at('LeftFoot'),neck=at('neck');
  const landmarks=l&&hip&&neck?{neck:neck.y,shoulder:l.y,chest:l.y-.09,waist:hip.y+.17,pelvis:hip.y+.045,
    shoulderX:Math.abs(l.x),shoulderZ:l.z,elbowX:Math.abs(el.x),elbowY:el.y,elbowZ:el.z,wristX:Math.abs(wr.x),wristY:wr.y,wristZ:wr.z,
    hipX:Math.abs(hip.x),kneeX:Math.abs(knee.x),kneeY:knee.y,ankleX:Math.abs(ankle.x),ankleY:ankle.y}:{};
  const faceAnchors=calibratedFace||{eye:landmarks.neck+.176,mouth:landmarks.neck+.105,chin:landmarks.neck+.060};
  let field=createModelField({},landmarks),faceField=createFaceField({},faceAnchors),appearance={...APPEARANCE_DEFAULTS},adjustedClips=[];
  function restore(){
    for(const b of bones){b.node.position.copy(b.position);b.node.quaternion.copy(b.quaternion);b.node.scale.copy(b.scale);}
    root.updateWorldMatrix(true,true);
  }
  function apply(input,face=appearance){
    const shape=cleanModelShape(input);appearance=cleanAppearance(face);faceField=createFaceField(appearance,faceAnchors);field=createModelField(shape,landmarks);restore();
    // Traverse order is parent-first. Reposition pivots in world metres, then
    // convert through each already-updated parent, preserving rest rotations.
    for(const b of bones){
      const rest=b.world.toArray(),pivot=cleanTopology?faceField.point(...rest,b.mask):rest;
      world.fromArray(field.point(...pivot,b.mask,true));
      b.node.parent.worldToLocal(world);b.node.position.copy(world);b.node.updateWorldMatrix(false,false);
    }
    root.updateWorldMatrix(true,true);
    const jacobian=new T.Matrix3(),normal=new T.Vector3(),epsilon=.0002;
    const deform=(x,y,z,mask)=>field.point(...faceField.point(x,y,z,mask),mask);
    for(const m of meshes){
      const inverse=m.node.matrixWorld.clone().invert(),p=m.node.geometry.attributes.position;
      const toWorldNormal=new T.Matrix3().getNormalMatrix(m.node.matrixWorld),toLocalNormal=new T.Matrix3().getNormalMatrix(inverse),normals=m.node.geometry.attributes.normal;
      const isOriginal=Object.entries(shape).every(([key,value])=>value===(key==='height'?168:0))&&(appearance.face==='oval'&&appearance.age===25||appearance.strength===0)&&appearance.expression==='neutral'&&Object.values(appearance.details).every(v=>v===0);
      for(let i=0;i<p.count;i++){
        if(isOriginal)p.setXYZ(i,...m.base.subarray(i*3,i*3+3));
        else{
          const x=m.points[i*3],y=m.points[i*3+1],z=m.points[i*3+2],mask=m.masks[i],point=deform(x,y,z,mask);
          world.fromArray(point).applyMatrix4(inverse);p.setXYZ(i,world.x,world.y,world.z);
          // Preserve the source's authored smooth normals, transformed by the
          // local deformation derivative. Rebuilding normals from the remesh
          // creates faceted cheeks even when the head itself did not change.
          const dx=deform(x+epsilon,y,z,mask),dy=deform(x,y+epsilon,z,mask),dz=deform(x,y,z+epsilon,mask);
          jacobian.set((dx[0]-point[0])/epsilon,(dy[0]-point[0])/epsilon,(dz[0]-point[0])/epsilon,
            (dx[1]-point[1])/epsilon,(dy[1]-point[1])/epsilon,(dz[1]-point[1])/epsilon,
            (dx[2]-point[2])/epsilon,(dy[2]-point[2])/epsilon,(dz[2]-point[2])/epsilon).invert().transpose();
          normal.fromArray(m.normal,i*3).applyMatrix3(toWorldNormal).applyMatrix3(jacobian).applyMatrix3(toLocalNormal).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);
        }
      }
      p.needsUpdate=true;
      if(isOriginal&&m.normal){m.node.geometry.attributes.normal.array.set(m.normal);m.node.geometry.attributes.normal.needsUpdate=true;}
      else normals.needsUpdate=true;
      if(m.node.geometry.attributes.tangent){const visible=m.node.geometry.index;m.node.geometry.setIndex(m.index);m.node.geometry.computeTangents();m.node.geometry.setIndex(visible);}
      m.node.geometry.computeBoundingBox();m.node.geometry.computeBoundingSphere();
    }
    for(const skeleton of skeletons)skeleton.calculateInverses();
    for(const m of meshes)if(m.node.isSkinnedMesh){m.node.bind(m.node.skeleton,m.node.matrixWorld);m.node.skeleton.update();m.node.computeBoundingBox();m.node.computeBoundingSphere();}
    adjustedClips=clips.filter(c=>c.duration>.1).map(clip=>{
      const result=clip.clone();
      for(const track of result.tracks){
        const binding=T.PropertyBinding.parseTrackName(track.name),b=byName.get(binding.nodeName);
        if(!b||binding.propertyName!=='position')continue;
        for(let i=0;i<track.values.length;i+=3)for(let axis=0;axis<3;axis++){
          const key=['x','y','z'][axis],before=b.position[key],after=b.node.position[key];
          const ratio=Math.abs(before)>.001?after/before:1;
          track.values[i+axis]=after+(track.values[i+axis]-before)*Math.max(.7,Math.min(1.3,ratio));
        }
      }
      return result;
    });
    return shape;
  }
  function inspect(){
    root.updateWorldMatrix(true,true);
    const box=new T.Box3();for(const m of meshes){if(m.node.isSkinnedMesh)m.node.computeBoundingBox();box.union(new T.Box3().setFromObject(m.node));}
    return {min:box.min.toArray(),max:box.max.toArray(),height:box.max.y-box.min.y,landmarks,
      bones:bones.length,vertices:meshes.reduce((n,m)=>n+m.base.length/3,0),clips:adjustedClips.map(c=>({name:c.name,duration:c.duration}))};
  }
  function snapshot(){return meshes.map(m=>Array.from(m.node.geometry.attributes.position.array));}
  apply({});
  return {apply,inspect,snapshot,get field(){return field;},get appearance(){return appearance;},get records(){return meshes;},get bones(){return byName;},get faceAnchors(){return faceAnchors;},get gazeAnchors(){return root.userData.bijouAnimeFace?.eyes;},get eyeAnchors(){return calibratedEyes;},mapFacePoint(x,y,z){return field.point(...faceField.point(x,y,z,{head:1}),{head:1});},get clips(){return adjustedClips;},get meshes(){return meshes.map(m=>m.node);}};
}
