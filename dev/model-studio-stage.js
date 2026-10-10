import * as T from '../js/vendor/avatar-engine.js';
import { GLTFExporter } from '../js/vendor/model-exporter.js';
import { createModelSculpt } from '../js/model-sculpt.js';
import { applyModelFinish } from '../js/model-finish.js';
import { createModelWardrobe } from '../js/model-wardrobe.js';
import { cleanAppearance } from '../js/model-appearance.js';
import { createModelHair } from '../js/model-hair.js';
import { createModelGaze } from '../js/model-gaze.js';
import { SOURCE_HAIR,SOURCE_GAZE } from '../js/model-persona.js';
import {bakeStudioAtlas} from '../js/model-atlas-bake.js';
import {STYLE_DEFAULTS,cleanModelStyle} from '../js/model-style.js';
import {createStudioLight} from './model-studio-light.js';
import {attachAnimeHead} from '../js/model-anime-head.js';

export const CANDIDATES={
  t2:{name:'Hime · light mesh',path:'meshy-hime-t2',triangles:15052},
  sculpt:{name:'Hime · detailed mesh',path:'meshy-hime-v1',triangles:102921},
  heroine:{name:'Game heroine · original face',path:'meshy-hime-v1',triangles:102921,originalHead:true},
  human:{name:'Adult · anatomy study',path:'human-adult-v1',file:'anatomy.glb',triangles:68144,internal:true}
};
export function createModelStage(canvas,onMotion=()=>{}){
  const viewport=canvas.parentElement,scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.01,50);
  scene.background=new T.Color('#f4eee8');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const lighting=createStudioLight(scene,renderer,viewport);
  const holder=new T.Group();holder.name='Bijou_model';scene.add(holder);
  let root,sculpt,wardrobe,hair,gaze,mixer,action,helper,loadId=0,dirty=true,shape={},appearance=cleanAppearance(),surface='anime3d',style=cleanModelStyle(STYLE_DEFAULTS),wire=false,exporting=false;
  let yaw=.15,pitch=.025,distance=4.2,focus=new T.Vector3(0,.86,0),region='figure';
  const originals=new Map(),materials=new Set(),pointers=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function cameraChanged(){
    camera.position.set(focus.x+distance*Math.cos(pitch)*Math.sin(yaw),focus.y+distance*Math.sin(pitch),focus.z+distance*Math.cos(pitch)*Math.cos(yaw));
    camera.lookAt(focus);dirty=true;
  }
  function resize(){renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();if(region==='figure')focusRegion(region);dirty=true;}
  new ResizeObserver(resize).observe(viewport);
  function setView(id){yaw={front:0,side:Math.PI/2,back:Math.PI,three:Math.PI/4}[id]??0;pitch=.025;cameraChanged();}
  function focusRegion(id,resetDistance=true){
    region=id;const a=sculpt?.field.landmarks||{},f=sculpt?.faceAnchors||{eye:1.537,mouth:1.465},v={figure:[0,.86,4.2],face:[0,f.eye-.025,.85],'face-proportions':[0,f.eye-.025,.85],'face-eyes':[0,f.eye,.60],'face-nose':[0,f.eye-.038,.56],'face-mouth':[0,f.mouth,.53],'face-ears':[.045,f.eye-.026,.65],hair:[0,1.43,1.8],chest:[0,a.chest||1.24,1.15],waist:[0,a.waist||1.06,1.1],hips:[0,.72,2.3],arms:[.20,1.22,1.45]}[id]||[0,.86,4.2];
    const clearance=id==='figure'?Math.max(1,1+(700-viewport.clientHeight)/800):1;
    focus.set(v[0],sculpt?sculpt.field.vertical(v[1]):v[1],0);if(resetDistance)distance=v[2]*(id==='figure'?(shape.height||168)/168:1)*clearance;cameraChanged();
  }
  function setSurface(id){
    surface=id;for(const m of materials)m.dispose();materials.clear();
    for(const [mesh,list]of originals){
      const clones=list.map(m=>{
        const next=id==='clay'?new T.MeshStandardMaterial({color:'#c5b0a4',roughness:.82,side:m.side}):new T.MeshPhysicalMaterial();
        if(id!=='clay'){if(m.isMeshPhysicalMaterial)next.copy(m);else T.MeshStandardMaterial.prototype.copy.call(next,m);next.specularIntensity=m.isMeshPhysicalMaterial?m.specularIntensity:.65;}
        next.fog=false;
        applyModelFinish(next,id,sculpt?.faceAnchors,gaze?.diagnostics.anchors,id!=='clay'&&hair?.settings.style!=='source'?hair.settings.color:null,style,wardrobe?.settings,sculpt?.field.landmarks);
        next.wireframe=wire;materials.add(next);return next;
      });mesh.material=clones.length===1?clones[0]:clones;
    }wardrobe?.setSurface(id);for(const mesh of wardrobe?.meshes||[])for(const m of [mesh.material].flat())m.fog=false;hair?.setSurface(id);gaze?.setSurface(id,style);dirty=true;
  }
  function setStyle(value){const next=cleanModelStyle(value);if(JSON.stringify(next)===JSON.stringify(style)&&surface===next.render)return;style=next;setSurface(style.render);}
  function setLight(value){lighting.set(value);dirty=true;}
  function stopMotion(){gaze?.restoreHead();if(mixer){mixer.stopAllAction();mixer.uncacheRoot(root);}mixer=null;action=null;onMotion(false);}
  function relaxedArms(){
    if(!root?.userData.bijouAnimeHead)return;
    for(const name of ['LeftArm','RightArm']){
      const bone=sculpt.bones.get(name).node,parent=bone.parent.getWorldQuaternion(new T.Quaternion()),side=Math.sign(bone.getWorldPosition(new T.Vector3()).x);
      const delta=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-side*.24);
      bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));bone.updateWorldMatrix(false,true);
    }
  }
  function setShape(values,face=appearance,refit=true){
    if(!sculpt)return;stopMotion();appearance=cleanAppearance(face);shape=sculpt.apply(values,appearance);if(refit)wardrobe?.fit();hair?.fit();gaze?.capture();gaze?.reset();relaxedArms();focusRegion(region,false);dirty=true;
  }
  function setLook(values,face,clothes,hairSettings=hair?.settings||SOURCE_HAIR,gazeSettings=gaze?.settings||SOURCE_GAZE){
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(same(values,shape)&&same(face,appearance)&&same(clothes,wardrobe?.settings)&&same(hairSettings,hair?.settings)){
      gaze?.set(gazeSettings);gaze?.reset();dirty=true;return;
    }
    const previous=hair?.settings,previousClothes=wardrobe?.settings;setShape(values,face,false);wardrobe?.set(clothes);wardrobe?.meshes.forEach(m=>{m.castShadow=true;for(const material of [m.material].flat())material.fog=false;});hair?.set(hairSettings);gaze?.set(gazeSettings);gaze?.reset();if(!same(previousClothes,clothes)||previous?.color!==hairSettings.color||(previous?.style==='source')!==(hairSettings.style==='source'))setSurface(surface);dirty=true;
  }
  function setMotion(play){
    if(!sculpt)return false;
    if(!play){setShape(shape);return false;}
    if(reduced.matches||!sculpt.clips.length){onMotion(false);return false;}
    stopMotion();mixer=new T.AnimationMixer(root);action=mixer.clipAction(sculpt.clips[0]);action.play();onMotion(true);return true;
  }
  function setTime(seconds){
    if(!sculpt?.clips.length)return;
    gaze?.restoreHead();
    if(!mixer){mixer=new T.AnimationMixer(root);action=mixer.clipAction(sculpt.clips[0]);action.play();}
    action.paused=false;mixer.setTime(seconds);action.paused=true;root.updateWorldMatrix(true,true);dirty=true;
  }
  function disposeTree(tree){
    const geoms=new Set(),mats=new Set(),textures=new Set(),skeletons=new Set();
    tree.traverse(n=>{if(!n.isMesh)return;geoms.add(n.geometry);if(n.skeleton)skeletons.add(n.skeleton);for(const m of (originals.get(n)||[n.material]).flat())mats.add(m);});
    for(const m of mats){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
    for(const t of textures)t.dispose();for(const g of geoms)g.dispose();for(const s of skeletons)s.dispose();
  }
  async function load(id,values={},face={},clothes={},hairSettings=SOURCE_HAIR,gazeSettings=SOURCE_GAZE){
    const candidate=CANDIDATES[id];if(!candidate)throw Error('Unknown model');const token=++loadId;
    const gltf=await new T.GLTFLoader().loadAsync(new URL(`../assets/studies/${candidate.path}/${candidate.file||'walking.glb'}`,import.meta.url).href);
    if(token!==loadId){disposeTree(gltf.scene);return false;}
    stopMotion();helper?.removeFromParent();helper?.dispose();helper=null;
    hair?.dispose();hair=null;gaze?.dispose();gaze=null;wardrobe?.dispose();wardrobe=null;
    for(const m of materials)m.dispose();materials.clear();if(root)disposeTree(root);originals.clear();
    holder.clear();holder.scale.setScalar(1);holder.position.set(0,0,0);holder.updateMatrixWorld(true);
    root=gltf.scene;
    const box=new T.Box3().setFromObject(root),center=box.getCenter(new T.Vector3()),scale=1.68/(box.max.y-box.min.y);
    holder.add(root);if(!root.userData.bijouCleanTopology){holder.scale.setScalar(scale);holder.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);}holder.updateMatrixWorld(true);
    const headTriangles=!candidate.internal&&!candidate.originalHead?await attachAnimeHead(root):0;
    root.traverse(node=>{if(node.isMesh){
      const list=Array.isArray(node.material)?node.material:[node.material];originals.set(node,list);node.frustumCulled=false;node.castShadow=true;
      // The generated atlases have insufficient island padding. Mip levels
      // blend their empty borders into skin/hair, producing pale seam flecks.
      // Keep original pixels and use linear sampling in this close-up studio.
      for(const material of list)for(const texture of Object.values(material))if(texture?.isTexture){texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;}
    }});
    sculpt=createModelSculpt(root,gltf.animations);appearance=cleanAppearance(face);shape=sculpt.apply(values,appearance);
    wardrobe=createModelWardrobe(sculpt);wardrobe.set(clothes);wardrobe.setWire(wire);wardrobe.meshes.forEach(m=>{m.castShadow=true;});
    hair=createModelHair(sculpt);hair.set(hairSettings);hair.setWire(wire);gaze=createModelGaze(sculpt);gaze.set(gazeSettings);gaze.reset();
    relaxedArms();
    helper=new T.SkeletonHelper(root);helper.visible=false;scene.add(helper);
    setSurface(surface);focusRegion(region);return {headTriangles};
  }
  async function exportGLB(){
    if(!root)throw Error('The model is still loading.');setShape(shape);gaze?.reset();hair?.update(0,true);exporting=true;wardrobe?.setSurface('realistic');hair?.setSurface('realistic');gaze?.setSurface('realistic',style);
    const preview=new Map(),exportMaterials=[],tinted=[];try{for(const [mesh,list]of originals){
      preview.set(mesh,mesh.material);const copies=list.map(m=>{
        if(!m.map)return m;const clone=new T.MeshPhysicalMaterial(),record=sculpt.records.find(r=>r.node===mesh);
        if(m.isMeshPhysicalMaterial)clone.copy(m);else T.MeshStandardMaterial.prototype.copy.call(clone,m);clone.metalness=0;clone.roughness=1;clone.specularIntensity=m.isMeshPhysicalMaterial?m.specularIntensity:.65;
        const tint=hair?.settings.style==='source'?null:hair.settings.color;
        clone.map=bakeStudioAtlas(renderer,record,m.map,style,tint,sculpt.faceAnchors,gaze.diagnostics.anchors,false,wardrobe.settings,sculpt.field.landmarks);
        clone.roughnessMap=bakeStudioAtlas(renderer,record,m.map,style,tint,sculpt.faceAnchors,gaze.diagnostics.anchors,true,wardrobe.settings,sculpt.field.landmarks);clone.metalnessMap=null;clone.normalScale?.setScalar(.08+style.detail*.5);
        tinted.push(clone.map,clone.roughnessMap);exportMaterials.push(clone);return clone;
      });mesh.material=copies.length===1?copies[0]:copies;
    }
    for(const mesh of gaze?.lidMeshes||[])if(mesh.visible){
      const m=mesh.material;if(!m.map)continue;preview.set(mesh,m);const clone=new T.MeshPhysicalMaterial().copy(m),record={node:mesh,index:mesh.geometry.index};
      clone.map=bakeStudioAtlas(renderer,record,m.map,style,null,sculpt.faceAnchors,gaze.diagnostics.anchors);
      clone.roughnessMap=bakeStudioAtlas(renderer,record,m.map,style,null,sculpt.faceAnchors,gaze.diagnostics.anchors,true);clone.roughness=1;
      tinted.push(clone.map,clone.roughnessMap);exportMaterials.push(clone);mesh.material=clone;
    }
    return await new GLTFExporter().parseAsync(holder,{binary:true,animations:sculpt.clips,onlyVisible:true});}
    finally{for(const [mesh,material]of preview)mesh.material=material;for(const m of exportMaterials)m.dispose();for(const t of tinted)t.dispose();wardrobe?.setSurface(surface);hair?.setSurface(surface);gaze?.setSurface(surface,style);exporting=false;dirty=true;}
  }
  function bounds(){
    const report=sculpt.inspect(),modelBox=new T.Box3(new T.Vector3().fromArray(report.min),new T.Vector3().fromArray(report.max));
    for(const mesh of wardrobe?.meshes||[]){mesh.computeBoundingBox();modelBox.union(new T.Box3().setFromObject(mesh));}
    if(hair?.group)modelBox.union(new T.Box3().setFromObject(hair.group));
    report.min=modelBox.min.toArray();report.max=modelBox.max.toArray();report.garments=wardrobe?.meshes.length||0;
    camera.updateMatrixWorld(true);const box=new T.Box3();
    for(const x of [report.min[0],report.max[0]])for(const y of [report.min[1],report.max[1]])for(const z of [report.min[2],report.max[2]])box.expandByPoint(new T.Vector3(x,y,z).project(camera));
    return {...report,screenMin:box.min.toArray(),screenMax:box.max.toArray()};
  }
  canvas.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    const last=pointers.get(event.pointerId);if(!last){const box=canvas.getBoundingClientRect();gaze?.setTarget((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2);return;}
    const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)?.[1];
    if(other){const before=Math.hypot(last.x-other.x,last.y-other.y),after=Math.hypot(event.clientX-other.x,event.clientY-other.y);if(after>5)distance=T.MathUtils.clamp(distance*before/after,.4,7);}
    else{yaw-=(event.clientX-last.x)*.006;pitch=T.MathUtils.clamp(pitch+(event.clientY-last.y)*.004,-.9,.9);}
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});cameraChanged();
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>pointers.delete(event.pointerId));
  canvas.addEventListener('pointerleave',()=>gaze?.setTarget(0,0));
  canvas.addEventListener('wheel',event=>{event.preventDefault();distance=T.MathUtils.clamp(distance*Math.exp(event.deltaY*.001),.4,7);cameraChanged();},{passive:false});
  canvas.addEventListener('keydown',event=>{let handled=true;
    if(event.key==='ArrowLeft')yaw-=.12;else if(event.key==='ArrowRight')yaw+=.12;
    else if(event.key==='ArrowUp')pitch=Math.min(.9,pitch+.08);else if(event.key==='ArrowDown')pitch=Math.max(-.9,pitch-.08);
    else if(event.key==='+'||event.key==='=')distance=Math.max(.4,distance*.9);else if(event.key==='-')distance=Math.min(7,distance/.9);else handled=false;
    if(handled){event.preventDefault();cameraChanged();}
  });
  reduced.addEventListener('change',()=>{if(reduced.matches)setMotion(false);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setMotion(false);});
  let last=0;
  function tick(time){const dt=Math.min(.05,(time-last)/1000);last=time;
    if(exporting){requestAnimationFrame(tick);return;}
    gaze?.restoreHead();
    if(action&&!action.paused){mixer.update(dt);dirty=true;}
    if(gaze?.update(dt,reduced.matches||document.hidden))dirty=true;
    if(hair?.update(dt,reduced.matches||document.hidden))dirty=true;
    if(dirty&&!exporting){renderer.render(scene,camera);dirty=false;}requestAnimationFrame(tick);
  }
  resize();cameraChanged();requestAnimationFrame(tick);
  return {load,setShape,setLook,setView,focusRegion,setSurface,setStyle,setLight,setMotion,setTime,exportGLB,bounds,
    setWire(value){wire=value;for(const m of materials)m.wireframe=value;wardrobe?.setWire(value);hair?.setWire(value);dirty=true;},
    setSkeleton(value){if(helper)helper.visible=value;dirty=true;},
    get cameraState(){return {region,focus:focus.toArray(),distance,yaw,pitch};},get style(){return {...style,render:surface};},get lighting(){return lighting.settings;},get sculpt(){return sculpt;},get wardrobe(){return wardrobe;},get hair(){return hair;},get gaze(){return gaze;},get root(){return root;},get stats(){return {...renderer.info.memory,triangles:renderer.info.render.triangles};}};
}
