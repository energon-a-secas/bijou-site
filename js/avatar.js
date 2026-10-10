// A skinned anime character with the original doll interface.
// The SVG is the resilient fallback and the shared screen-coordinate bridge.
import * as T from './vendor/avatar-engine.js';
import { createDoll } from './doll.js';
import { pivots, solve } from './rig.js';
import { prepareModel } from './avatar-model.js';
import { applyAvatarPose } from './avatar-pose.js';
import { toon } from './avatar-materials.js';
import { BODY_REGIONS } from './body-shape.js';
import { qualityFor } from './render-quality.js';

export function createAvatar(svg) {
  const fallback=createDoll(svg),stage=svg.parentElement;
  let renderer,vrm,model,cfg,canvas,lastFrame,lastView,lastTime=0,active=false;
  let expression='smile',hands={L:'rest',R:'rest'},bands={L:'mid',R:'mid'};
  let editing=false,editView='front',onShapeFrame=null,inspection='figure',inspectionRegion='waist',quality='balanced';
  let orbitYaw=0,orbitPitch=0,zoomRatio=1,cameraYaw=0,cameraPitch=0;
  const scene=new T.Scene();
  const motionMedia=matchMedia('(prefers-reduced-motion: reduce)');
  const HEIGHT=2.18,UNIT=820/HEIGHT;
  const camera=new T.OrthographicCamera(-.5,.5,HEIGHT/2,-HEIGHT/2,.1,20);
  const cameraFocus=new T.Vector3(0,1.01,0);
  camera.position.set(0,1.01,5);camera.lookAt(cameraFocus);
  const character=new T.Group();scene.add(character);
  const ambient=new T.HemisphereLight('#fff4e8','#8b8297',1.15);scene.add(ambient);
  const key=new T.DirectionalLight('#fff7ef',2.5);key.position.set(-3,4,5);scene.add(key);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.2;key.shadow.camera.right=1.2;key.shadow.camera.top=1.25;key.shadow.camera.bottom=-1.25;
  key.shadow.camera.near=.1;key.shadow.camera.far=8;key.shadow.bias=-.0002;key.shadow.normalBias=.006;key.shadow.radius=2;
  key.target.position.set(0,1,0);scene.add(key.target);
  const fill=new T.DirectionalLight('#e9ddff',.65);fill.position.set(2,1.5,-2);scene.add(fill);
  const raycaster=new T.Raycaster(),point=new T.Vector3();
  const status=document.createElement('span');status.className='avatar-status';status.textContent='Bringing Bijou to life…';status.setAttribute('role','status');stage.append(status);
  stage.setAttribute('aria-busy','true');svg.classList.add('avatar-loading');
  let stool=null,stoolWanted=false;
  // A soft contact shadow makes the character belong to the illustrated room.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const context=shadowCanvas.getContext('2d'),gradient=context.createRadialGradient(64,64,8,64,64,64);
  gradient.addColorStop(0,'rgba(90,54,48,.20)');gradient.addColorStop(1,'rgba(90,54,48,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(.67,.075),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.position.set(0,.001,-.34);scene.add(shadow);

  function resize() {
    if(!renderer)return;
    const w=svg.clientWidth,h=svg.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);
    const half=HEIGHT*w/h/2;
    camera.left=-half;camera.right=half;camera.updateProjectionMatrix();
  }
  function setQuality(value){
    const q=qualityFor(value);quality=q.id;if(cfg)cfg.quality=q.id;
    if(!renderer)return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q.pixelRatio)*(q.id==='detailed'&&window.devicePixelRatio===1?1.5:1));
    if(key.shadow.mapSize.x!==q.shadow){key.shadow.map?.dispose();key.shadow.map=null;key.shadow.mapSize.set(q.shadow,q.shadow);key.shadow.needsUpdate=true;}
    resize();
  }
  function showFallback(message){
    active=false;stage.dataset.renderer='svg';svg.classList.remove('avatar-loading','avatar-ready');
    if(canvas)canvas.hidden=true;stage.removeAttribute('aria-busy');
    status.textContent=message;status.hidden=false;
  }
  const ready=(async()=>{
    try{
      canvas=document.createElement('canvas');canvas.className='doll avatar-canvas';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;svg.after(canvas);
      renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      const loader=new T.GLTFLoader();loader.register(parser=>new T.VRMLoaderPlugin(parser));
      const gltf=await loader.loadAsync(new URL('../assets/models/bijou.vrm',import.meta.url).href);
      vrm=gltf.userData.vrm;T.VRMUtils.rotateVRM0(vrm);
      T.VRMUtils.removeUnnecessaryVertices(vrm.scene);T.VRMUtils.combineSkeletons(vrm.scene);
      character.add(vrm.scene);model=prepareModel(vrm);
      if(cfg)model.build(cfg);
      active=true;canvas.hidden=false;svg.classList.remove('avatar-loading');svg.classList.add('avatar-ready');
      stage.dataset.renderer='3d';stage.removeAttribute('aria-busy');status.hidden=true;
      new ResizeObserver(resize).observe(svg);setQuality(cfg?.quality||quality);
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFallback('3D paused. Bijou is still here in 2D.');});
      canvas.addEventListener('webglcontextrestored',()=>{active=true;canvas.hidden=false;svg.classList.add('avatar-ready');stage.dataset.renderer='3d';status.hidden=true;resize();});
      if(lastFrame)render(lastFrame,lastView);
      return true;
    }catch(error){
      console.warn('Bijou: the 3D renderer could not start.',error);
      showFallback('3D is unavailable in this browser. Showing Bijou in 2D.');
      renderer?.dispose();return false;
    }
  })();

  function build(next){cfg=structuredClone(next);if(cfg.quality&&cfg.quality!==quality)setQuality(cfg.quality);const m=fallback.build(next);if(model)model.build(cfg);return m;}
  function updateBody(body){cfg.body={...body};fallback.build(cfg);model?.updateBody(cfg.body,cfg.outfit);}
  function render(frame,view){
    lastFrame=frame;lastView=view;
    if(!active||!cfg){const result=fallback.render(frame,view);if(editing)onShapeFrame?.();return result;}
    const now=performance.now(),dt=Math.min(.04,lastTime?(now-lastTime)/1000:1/60);lastTime=now;
    const height=.94+cfg.body.height*.12,width=1.14;
    character.scale.set(width,height*(frame.root.sy??1),1.04);
    character.position.set((editing?0:frame.root.x)/UNIT,-frame.root.y/UNIT-model.support.baseOffset*height,0);
    character.rotation.y=editing?0:-.10+(frame.root.turnY||0);
    applyAvatarPose(vrm,model,frame,editing?{yaw:0,pitch:0,look:{x:0,y:0}}:view,cfg,hands,bands,expression,svg,dt,{still:editing||motionMedia.matches,time:now/1000});
    model.correctives.update();
    model.support.update(frame,character,stool?.43:null);
    model.correctives.update();
    model.dynamics.update(frame,dt);
    model.skinning.update();
    model.hairMotion.update(dt,model.arms.colliders);
    const zoom=editing?zoomRatio*(inspection==='figure'?1:inspection==='hands'?4:inspection==='face'?3.5:2.7):1;
    const focus=new T.Vector3(0,1.01,0);
    if(editing&&inspection!=='figure'){
      if(inspection==='hands')model.bones.leftHand.getWorldPosition(focus);
      else if(inspection==='face')model.bones.head.getWorldPosition(focus).add(new T.Vector3(0,.10,0));
      else{
        const r=BODY_REGIONS.find(r=>r.id===inspectionRegion)||BODY_REGIONS[4];
        if(r.id==='arms'||r.id==='legs'){
          const part=r.id==='arms'?'Arm':'Leg';model.bones[`leftUpper${part}`].getWorldPosition(focus);focus.lerp(model.bones[`leftLower${part}`].getWorldPosition(new T.Vector3()),.55);
        }else{focus.fromArray(model.morph.field.point(-r.x,r.y,r.id==='bust'?-.12:-.035));vrm.scene.localToWorld(focus);}
      }
    }
    const ease=motionMedia.matches?1:1-Math.exp(-dt*12);camera.zoom+=(zoom-camera.zoom)*ease;
    cameraFocus.lerp(focus,ease);
    const targetYaw=editing?orbitYaw:0;cameraYaw+=Math.atan2(Math.sin(targetYaw-cameraYaw),Math.cos(targetYaw-cameraYaw))*ease;
    cameraPitch+=((editing?orbitPitch:0)-cameraPitch)*ease;
    camera.position.copy(cameraFocus).add(new T.Vector3(Math.sin(cameraYaw)*Math.cos(cameraPitch)*5,Math.sin(cameraPitch)*5,Math.cos(cameraYaw)*Math.cos(cameraPitch)*5));
    camera.lookAt(cameraFocus);camera.updateProjectionMatrix();
    shadow.position.x=frame.root.x/UNIT;shadow.scale.setScalar(Math.max(.5,1+frame.root.y/500));
    if(stool)stool.position.x=frame.root.x/UNIT;
    if(stool&&!stoolWanted&&(frame.bones.root?.seat??0)<.005){stool.geometry.dispose();stool.material.dispose();scene.remove(stool);stool=null;}
    renderer.render(scene,camera);
    if(editing)onShapeFrame?.();
    return solve(fallback.M,pivots(fallback.M),frame);
  }
  function setExpression(name){expression=name;fallback.setExpression(name);}
  function setPoseLook(look){hands={...look.hands};bands={...look.bands};fallback.setPoseLook(look);}
  function setProp(kind,x=0){
    fallback.setProp(kind,x);
    stoolWanted=kind==='pouf';
    if(stoolWanted&&!stool){
      stool=new T.Mesh(new T.CylinderGeometry(.19,.175,.42,48,1),toon('#cab1c9'));
      stool.position.set(x/UNIT,.22,-.035);scene.add(stool);
    }
  }
  function worldOf(bone,x,y){
    if(!active||bone!=='head')return fallback.worldOf(bone,x,y);
    point.set(-(x-200)*.00215,1.465+(244-y)*.00215,-.07).sub(model.rest.head);
    model.bones.head.localToWorld(point);point.project(camera);
    const width=(camera.right-camera.left)*UNIT;
    return {x:200+point.x*width/2,y:(1-point.y)*410};
  }
  function hitTest(clientX,clientY){
    if(!active)return null;
    const rect=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
    vrm.scene.updateMatrixWorld(true);
    const meshes=[];vrm.scene.traverseVisible(o=>{if(o.isMesh){if(o.isSkinnedMesh)o.computeBoundingSphere();meshes.push(o);}});
    const hit=raycaster.intersectObjects(meshes,false)[0];
    if(!hit)return null;
    for(let node=hit.object;node;node=node.parent)if(node.userData.region)return node.userData.region==='head'?'head':'spine';
    return 'spine';
  }
  function capture({height=0,mime='image/png'}={}){
    if(!active)return null;
    renderer.render(scene,camera);
    const copy=document.createElement('canvas'),h=canvas.height,ratio=Math.min(.70,canvas.width/h),w=h*ratio;
    copy.height=height||h;copy.width=Math.round(copy.height*ratio);
    copy.getContext('2d').drawImage(canvas,(canvas.width-w)/2,0,w,h,0,0,copy.width,copy.height);
    return copy.toDataURL(mime,.85);
  }
  function shapePoints(){
    if(!active){
      const M=fallback.M,m=svg.getScreenCTM();if(!m)return [];
      const ys={shoulders:M.shoulderY,armpits:M.shoulderY+25,bust:M.chestY,torso:M.chestY,waist:M.waistY,belly:(M.waistY+M.hipY)/2,hips:M.hipY,arms:M.elbow.R.y,legs:(M.hipY+M.kneeY)/2};
      return BODY_REGIONS.map(r=>({id:r.id,x:m.a*(200+r.x*300)+m.e,y:m.d*ys[r.id]+m.f}));
    }
    const rect=canvas.getBoundingClientRect(),p=new T.Vector3();
    vrm.scene.updateMatrixWorld(true);
    return BODY_REGIONS.map(r=>{
      if(r.id==='arms'||r.id==='legs'){
        const type=r.id==='arms'?'Arm':'Leg';
        p.copy(model.bones[`leftUpper${type}`].getWorldPosition(new T.Vector3())).lerp(model.bones[`leftLower${type}`].getWorldPosition(new T.Vector3()),.55);
      }else{
        const bone=r.id==='hips'?'hips':'chest';
        p.fromArray(model.morph.field.point(-r.x,r.y,-.135,'skirt')).sub(model.rest[bone]);
        model.bones[bone].localToWorld(p);
      }
      p.project(camera);return {id:r.id,x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
    });
  }
  function setEditing(on){editing=on;if(!on){inspection='figure';zoomRatio=1;orbitYaw=0;orbitPitch=0;editView='front';}if(model){model.dynamics.editing=on;model.hairMotion.editing=on;}}
  return {svg,uid:fallback.uid,ready,build,updateBody,render,setExpression,setPoseLook,setProp,worldOf,hitTest,capture,shapePoints,setEditing,setQuality,
    set shapeView(value){editView=value;orbitYaw={front:0,profile:Math.PI/2,back:Math.PI}[value]||0;orbitPitch=0;},set onShapeFrame(fn){onShapeFrame=fn;},get editing(){return editing;},
    set inspection(value){inspection=value;zoomRatio=1;},set inspectionRegion(value){inspectionRegion=value;},
    orbitBy(x,y){orbitYaw+=x;orbitPitch=Math.max(-.65,Math.min(.65,orbitPitch+y));},zoomBy(amount){zoomRatio=Math.max(.65,Math.min(2.5,zoomRatio*Math.exp(amount)));},
    impulse(strength){model?.dynamics.impulse(strength);},
    get M(){return fallback.M;},get flags(){return fallback.flags;},get expression(){return expression;},get is3D(){return active;},
    get diagnostics(){return model?{...model.arms.diagnostics,motion:model.dynamics.diagnostics,hair:model.hairMotion.diagnostics,correctives:model.correctives.diagnostics,support:model.support.diagnostics}:null;},
    get stats(){return renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...renderer.info.memory}:null;}};
}
