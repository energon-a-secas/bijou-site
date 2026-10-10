// Model preparation and customization. Every mutable surface belongs to this
// renderer instance; the source geometry is never modified by outfit changes.
import * as T from './vendor/avatar-engine.js';
import { personalizeMaterials, surfaceMaterial, surfaceDepthMaterial } from './avatar-materials.js';
import { createWardrobe } from './avatar-wardrobe.js';
import { createFit } from './avatar-fit.js';
import { createHair } from './avatar-hair.js';
import { createFace } from './avatar-face.js';
import { createArmSolver } from './avatar-arms.js';
import { createMorphRig } from './avatar-morph.js';
import { createDynamics } from './avatar-dynamics.js';
import { refineBody } from './avatar-surface.js';
import { createSkinning } from './avatar-skinning.js';
import { createNails } from './avatar-nails.js';
import { SHAPE_KEYS, SHAPE_DEFAULTS } from './body-shape.js';
import { applyFinish } from './avatar-finish.js';
import { createCorrectives } from './avatar-correctives.js';
import { createSupport } from './avatar-support.js';

export function prepareModel(vrm) {
  vrm.springBoneManager?.reset();vrm.springBoneManager=null;
  vrm.humanoid.autoUpdateHumanBones=false;
  vrm.scene.updateMatrixWorld(true);
  const rest={},bones={};
  for(const [name,{node}] of Object.entries(vrm.humanoid.rawHumanBones)){
    bones[name]=node;rest[name]=vrm.scene.worldToLocal(node.getWorldPosition(new T.Vector3()));
  }
  const skin=[],hair=[],face=[];
  vrm.scene.traverse(o=>{
    if(!o.isMesh)return;
    o.frustumCulled=false;
    const mat=Array.isArray(o.material)?o.material[0]:o.material;
    if(/Body_00_SKIN/.test(mat.name)){
      o.geometry=o.geometry.clone();o.geometry.clearGroups();o.geometry.addGroup(0,o.geometry.index.count,0);
      o.geometry.setAttribute('bjRest',new T.Float32BufferAttribute(o.geometry.attributes.position.array.slice(),3));
      o.userData.baseNormals=o.geometry.attributes.normal.array.slice();
      o.userData.region='body';skin.push(o);
    }else if(/HAIR/.test(mat.name)){
      o.geometry=o.geometry.clone();o.userData.basePositions=o.geometry.attributes.position.array.slice();o.userData.region='head';hair.push(o);
    }else{
      o.userData.region='head';face.push(o);
    }
  });
  // The source body is split into material primitives. Refine it as one surface
  // so shoulders, abdomen and knees share continuous edges and smooth normals.
  const geometry=refineBody(skin),bodyMesh=skin[0];
  for(const mesh of skin){mesh.geometry.dispose();if(mesh!==bodyMesh)mesh.removeFromParent();}
  skin.splice(0,skin.length,bodyMesh);bodyMesh.geometry=geometry;
  geometry.setAttribute('bjRest',new T.Float32BufferAttribute(geometry.attributes.position.array.slice(),3));
  bodyMesh.userData.baseNormals=geometry.attributes.normal.array.slice();
  const sourceRest=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v.clone()]));
  const wardrobe=createWardrobe(vrm,sourceRest),fit=createFit(skin),hairdresser=createHair(hair,bones,sourceRest),faces=createFace(face);
  const arms=createArmSolver(bones,rest);
  const dynamics=createDynamics();
  const skinning=createSkinning(skin);
  const nails=createNails(bones,skin[0],rest,skinning);
  const morph=createMorphRig(vrm,bones,rest,skin,fit.meshes,wardrobe);
  const correctives=createCorrectives([...skin,...fit.meshes],bones);
  const support=createSupport(vrm,bones,rest,skin,wardrobe,skinning);
  let skinMat=null,skinKey='',shapeKey='',garmentSettings={};
  function build(cfg){
    garmentSettings=cfg.garments||{};
    personalizeMaterials(vrm,cfg);
    const key=JSON.stringify([cfg.outfit,cfg.garments,cfg.renderStyle])+cfg.body.skin;
    if(key!==skinKey){skinMat?.dispose();skinMat=surfaceMaterial(cfg);skin.forEach(o=>o.material=skinMat);skinKey=key;}
    fit.build(cfg);faces.build(cfg.head);hairdresser.build(cfg.head,!!cfg.outfit.hat,cfg.renderStyle);wardrobe.build(cfg);
    for(const group of wardrobe.groups)group.traverse(o=>{if(o.isMesh)applyFinish(o.material,cfg.renderStyle);});
    morph.rememberFit();morph.rememberWardrobe();updateBody(cfg.body,cfg.outfit,true);
    vrm.scene.traverseVisible(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    for(const mesh of [...skin,...fit.meshes]){mesh.customDepthMaterial?.dispose();mesh.customDepthMaterial=surfaceDepthMaterial(mesh.material);dynamics.attach(mesh);skinning.attach(mesh);}
    for(const group of wardrobe.groups)group.traverse(o=>{if(o.isMesh)dynamics.attach(o,!!o.userData.skirt||group.name==='wear-skirt');});
    return {bones,rest};
  }
  function updateBody(body,outfit,force=false){
    const key=SHAPE_KEYS.map(k=>body[k]??SHAPE_DEFAULTS[k]).join('|');
    if(force||shapeKey!==key){morph.apply(body);fit.refit();correctives.rebuild(morph.field);support.configure();shapeKey=key;}
    arms.configure(body,outfit,garmentSettings);dynamics.configure(body);
    nails.build(body);
  }
  return {build,updateBody,bones,rest,wardrobe,skin,face,arms,morph,dynamics,skinning,correctives,support,hairMotion:hairdresser.motion};
}
