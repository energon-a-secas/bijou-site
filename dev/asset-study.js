// Isolated imported-asset inspection; no app state or remote API access.
import * as T from '../js/vendor/avatar-engine.js';
import { applyFinish } from '../js/avatar-finish.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas'),viewport=$('viewport');
const rootPath='../assets/studies/meshy-hime-v1/';
const files={generated:'generated.glb',working:'working.glb',rigged:'rigged.glb',walking:'walking.glb',t2:'../meshy-hime-t2/generated.glb',t2rig:'../meshy-hime-t2/rigged.glb',t2walk:'../meshy-hime-t2/walking.glb'};
const scene=new T.Scene();scene.background=new T.Color('#f4eee8');
const camera=new T.PerspectiveCamera(30,1,.01,100);
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
scene.add(new T.HemisphereLight('#fff6ee','#8c8495',1.4));
const key=new T.DirectionalLight('#fff5ef',2.7);key.position.set(-3,5,4);scene.add(key);
const fill=new T.DirectionalLight('#e9e4ff',.8);fill.position.set(3,2,-3);scene.add(fill);
const holder=new T.Group();scene.add(holder);
const floor=new T.Mesh(new T.CircleGeometry(1.05,64),new T.MeshBasicMaterial({color:'#e8dfd9',transparent:true,opacity:.55}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
let gltf=null,helper=null,mixer=null,action=null,report=null,loadId=0,needsRender=true;
let yaw=0,pitch=.03,distance=4.2,focus=new T.Vector3(0,.86,0),drag=null;
let activeMaterials=[],meshes=[],restBones=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');

function positionCamera(){
  needsRender=true;
  camera.position.set(focus.x+distance*Math.cos(pitch)*Math.sin(yaw),focus.y+distance*Math.sin(pitch),focus.z+distance*Math.cos(pitch)*Math.cos(yaw));
  camera.lookAt(focus);
}
function resize(){
  needsRender=true;
  renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
  camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
function setView(view){yaw={front:0,side:Math.PI/2,back:Math.PI,three:Math.PI/4}[view]??0;pitch=.03;positionCamera();
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));}
function setFocus(value){
  $('focus').value=value;
  const setting={figure:[.86,4.2],face:[1.51,.85],torso:[1.05,1.8],legs:[.43,1.85]}[value]||[.86,4.2];
  focus.set(0,setting[0],0);distance=setting[1];positionCamera();
}
function setSurface(value){
  needsRender=true;
  $('surface').value=value;
  for(const material of activeMaterials)material.dispose();activeMaterials=[];
  for(const mesh of meshes){
    const materials=mesh.userData.studyOriginal.map(original=>{
      let material;
      if(value==='clay')material=new T.MeshStandardMaterial({color:'#ceb9aa',roughness:.85,side:original.side});
      else if(value==='unlit')material=new T.MeshBasicMaterial({map:original.map,color:original.color,side:original.side});
      else{material=original.clone();if(value!=='realistic')applyFinish(material,value,'skin');}
      material.wireframe=$('wire').checked;activeMaterials.push(material);return material;
    });
    mesh.material=mesh.userData.studyArray?materials:materials[0];
  }
}
function analyze(gltf){
  const materials=new Set(),geometries=new Set(),skeletons=new Set(),bones=[];
  let vertices=0,triangles=0,morphs=0,skinned=0;
  gltf.scene.traverse(node=>{
    if(node.isBone)bones.push(node.name);
    if(!node.isMesh)return;
    meshes.push(node);node.frustumCulled=false;
    node.userData.studyArray=Array.isArray(node.material);
    node.userData.studyOriginal=Array.isArray(node.material)?node.material:[node.material];
    node.userData.studyOriginal.forEach(material=>materials.add(material));
    if(node.isSkinnedMesh){skinned++;skeletons.add(node.skeleton);}
    if(!geometries.has(node.geometry)){
      geometries.add(node.geometry);vertices+=node.geometry.attributes.position.count;
      triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
    }
    morphs=Math.max(morphs,node.morphTargetInfluences?.length||0);
  });
  const box=new T.Box3().setFromObject(gltf.scene),size=box.getSize(new T.Vector3());
  return {meshes:meshes.length,vertices,triangles,skinnedMeshes:skinned,skeletons:skeletons.size,bones,morphTargets:morphs,
    sourceSize:size.toArray(),animations:gltf.animations.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length})),
    materials:[...materials].map(m=>({name:m.name,type:m.type,colorMap:!!m.map,normalMap:!!m.normalMap,roughnessMap:!!m.roughnessMap,metalnessMap:!!m.metalnessMap,alpha:m.alphaTest||m.transparent}))};
}
function clearModel(){
  if(mixer){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}mixer=null;action=null;
  helper?.removeFromParent();helper?.dispose();helper=null;
  const materials=new Set(activeMaterials),textures=new Set(),skeletons=new Set();
  for(const mesh of meshes){mesh.geometry.dispose();if(mesh.skeleton)skeletons.add(mesh.skeleton);mesh.userData.studyOriginal.forEach(m=>materials.add(m));}
  for(const skeleton of skeletons)skeleton.dispose();
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures)texture.dispose();activeMaterials=[];meshes=[];restBones=[];
  holder.clear();holder.scale.setScalar(1);holder.position.set(0,0,0);holder.updateMatrixWorld(true);gltf=null;
}
async function loadAsset(value){
  if(!files[value])throw new Error('Unknown study asset');
  $('asset').value=value;
  const id=++loadId;$('status').textContent='Loading candidate…';window.ready=false;
  $('play').checked=false;$('play').disabled=true;$('scrub').disabled=true;
  try{
    const loaded=await new T.GLTFLoader().loadAsync(new URL(rootPath+files[value],import.meta.url).href);
    if(id!==loadId){disposeUnused(loaded.scene);return;}
    clearModel();gltf=loaded;report=analyze(gltf);
    const box=new T.Box3().setFromObject(gltf.scene),center=box.getCenter(new T.Vector3()),height=box.max.y-box.min.y;
    holder.add(gltf.scene);
    const scale=1.68/height;holder.scale.setScalar(scale);holder.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    gltf.scene.traverse(node=>{if(node.isBone)restBones.push({node,position:node.position.clone(),quaternion:node.quaternion.clone()});});
    helper=new T.SkeletonHelper(gltf.scene);helper.visible=$('skeleton').checked;scene.add(helper);
    const motion=gltf.animations.find(clip=>clip.duration>.1);
    if(motion){mixer=new T.AnimationMixer(gltf.scene);action=mixer.clipAction(motion);action.play();action.paused=true;$('play').disabled=false;$('scrub').disabled=false;}
    setSurface($('surface').value);setFocus($('focus').value);
    $('metrics').replaceChildren();
    for(const [name,value]of Object.entries({Triangles:Math.round(report.triangles).toLocaleString(),Meshes:report.meshes,Bones:report.bones.length,'Morph targets':report.morphTargets,'Motion clips':report.animations.filter(clip=>clip.duration>.1).length})){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;$('metrics').append(dt,dd);
    }
    $('structure').textContent=JSON.stringify(report,null,2);$('status').textContent='Ready to inspect';
    $('download').href=new URL(rootPath+files[value],import.meta.url).href;window.ready=true;
  }catch(error){if(id===loadId){$('status').textContent='This candidate is not available yet. Choose another asset.';console.error('Asset study load failed',error);}}
}
function disposeUnused(root){
  const materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(node=>{if(!node.isMesh)return;node.geometry.dispose();if(node.skeleton)skeletons.add(node.skeleton);
    (Array.isArray(node.material)?node.material:[node.material]).forEach(material=>materials.add(material));});
  for(const skeleton of skeletons)skeleton.dispose();
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures)texture.dispose();
}
function setTime(seconds){if(!action)return;action.paused=false;mixer.setTime(seconds);action.paused=true;scene.updateMatrixWorld(true);needsRender=true;}
function setJoint(name,axis,degrees){const rest=restBones.find(b=>b.node.name===name);if(!rest||!['x','y','z'].includes(axis))return false;
  rest.node.quaternion.copy(rest.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),degrees*Math.PI/180));needsRender=true;return true;}
function resetJoints(){for(const rest of restBones){rest.node.position.copy(rest.position);rest.node.quaternion.copy(rest.quaternion);}needsRender=true;}
function bounds(){scene.updateMatrixWorld(true);for(const mesh of meshes)if(mesh.isSkinnedMesh)mesh.computeBoundingBox();
  const box=new T.Box3().setFromObject(holder),projected=new T.Box3();camera.updateMatrixWorld(true);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])projected.expandByPoint(new T.Vector3(x,y,z).project(camera));
  return {min:box.min.toArray(),max:box.max.toArray(),screenMin:projected.min.toArray(),screenMax:projected.max.toArray()};}
$('asset').addEventListener('change',event=>loadAsset(event.target.value));
$('surface').addEventListener('change',event=>setSurface(event.target.value));
$('focus').addEventListener('change',event=>setFocus(event.target.value));
$('wire').addEventListener('change',()=>{for(const m of activeMaterials)m.wireframe=$('wire').checked;needsRender=true;});
$('skeleton').addEventListener('change',()=>{if(helper)helper.visible=$('skeleton').checked;needsRender=true;});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('play').addEventListener('change',()=>{if(action)action.paused=!$('play').checked;});
$('scrub').addEventListener('input',()=>{$('play').checked=false;setTime(Number($('scrub').value)*action.getClip().duration);});
reduced.addEventListener('change',()=>{if(reduced.matches){$('play').checked=false;if(action)action.paused=true;}});
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw-=(event.clientX-drag.x)*.006;pitch=T.MathUtils.clamp(pitch+(event.clientY-drag.y)*.004,-1,1);drag={x:event.clientX,y:event.clientY};positionCamera();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
canvas.addEventListener('wheel',event=>{event.preventDefault();distance=T.MathUtils.clamp(distance*Math.exp(event.deltaY*.001),.35,7);positionCamera();},{passive:false});
canvas.addEventListener('keydown',event=>{let handled=true;
  if(event.key==='ArrowLeft')yaw-=.12;else if(event.key==='ArrowRight')yaw+=.12;
  else if(event.key==='ArrowUp')pitch=Math.min(1,pitch+.08);else if(event.key==='ArrowDown')pitch=Math.max(-1,pitch-.08);
  else if(event.key==='+'||event.key==='=')distance=Math.max(.35,distance*.9);else if(event.key==='-')distance=Math.min(7,distance/ .9);else handled=false;
  if(handled){event.preventDefault();positionCamera();}
});
let last=0;
function tick(time){const delta=Math.min(.05,(time-last)/1000);last=time;
  if(action&&!action.paused){mixer.update(delta);$('scrub').value=action.time/action.getClip().duration;needsRender=true;}
  if(needsRender){renderer.render(scene,camera);needsRender=false;}requestAnimationFrame(tick);
}
window.assetStudy={loadAsset,setView,setFocus,setSurface,setTime,setJoint,resetJoints,bounds,get report(){return report;},get model(){return gltf?.scene;},get stats(){return {...renderer.info.memory,triangles:renderer.info.render.triangles};}};
const initial=new URLSearchParams(location.search).get('asset');if(files[initial])$('asset').value=initial;
positionCamera();resize();requestAnimationFrame(tick);loadAsset($('asset').value);
