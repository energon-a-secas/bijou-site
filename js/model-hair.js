import * as T from './vendor/avatar-engine.js';
import { cleanHair, SOURCE_HAIR } from './model-persona.js';
import { hairCrown,hairGuides,hairLock } from './model-hair-geometry.js';
import { createStudioHairMotion } from './model-hair-motion.js';
import { applyFinish } from './avatar-finish.js';
import {createHairSurface} from './model-hair-surface.js';

function prepareHairMask(sculpt){
  const a=sculpt.field.landmarks,eye=a.neck+.176;
  for(const r of sculpt.records){
    if(r.node.userData.bijouAnimeBody){r.withoutHairIndex=r.index.clone();continue;}
    if(r.node.userData.bijouSurface){r.withoutHairIndex=r.node.userData.bijouSurface==='hair'&&!r.node.userData.bijouFringe?new T.Uint32BufferAttribute([],1):r.index.clone();continue;}
    const kept=[],original=r.index;
    for(let at=0;at<original.count;at+=3){
      const ids=[original.getX(at),original.getX(at+1),original.getX(at+2)],p=[0,1,2].map(k=>ids.reduce((sum,id)=>sum+r.points[id*3+k],0)/3);
      // The fringe and temple hair share their surface with the face. Retain
      // that front shell and tint its hair pixels; replace the outer hair/crown.
      const [x,y,z]=p,face=!r.node.userData.bijouAnimeBody&&z>.012&&Math.abs(x)<.104&&y>a.neck+.020;
      const hair=y>eye+.080||(y>a.waist-.11&&!r.wearable[at/3]&&!face);
      if(!hair)kept.push(...ids);
    }
    r.withoutHairIndex=new T.Uint32BufferAttribute(kept,1);
  }
}
export function createModelHair(sculpt){
  const head=sculpt.bones.get('Head')?.node,chest=sculpt.bones.get('Spine')?.node;
  let settings=cleanHair(SOURCE_HAIR),group=null,finish='anime3d',wire=false,hidden=false,surfaceMaps=null;
  const motion=createStudioHairMotion(),chestRestInverse=new T.Matrix4(),headRestInverse=new T.Matrix4();prepareHairMask(sculpt);
  let anatomyCollider=null;
  function sourceHair(show){
    if(hidden===!show)return;hidden=!show;
    for(const r of sculpt.records){
      if(r.node.userData.bijouAnimeBody)continue;
      if(r.node.userData.bijouSurface){if(r.node.userData.bijouSurface==='hair'&&(!r.node.userData.bijouFringe||r.node.userData.bijouAnimeHead))r.node.visible=show;continue;}
      r.node.geometry.dispose();r.node.geometry.setIndex(show?r.index:r.withoutHairIndex);
    }
  }
  function material(){
    const physical=finish==='realistic',m=new T.MeshPhysicalMaterial({color:finish==='clay'?'#c5b0a4':settings.color,roughness:.68-settings.shine*.32,metalness:0,side:T.DoubleSide,wireframe:wire,anisotropy:physical?.7:0,anisotropyRotation:Math.PI/2,envMapIntensity:.65,fog:false});
    if(finish!=='clay'){surfaceMaps||=createHairSurface();m.map=surfaceMaps.map;m.normalMap=surfaceMaps.normalMap;m.normalScale.setScalar(physical?.28:.1);m.roughnessMap=surfaceMaps.roughnessMap;}
    applyFinish(m,['anime3d','anime2d'].includes(finish)?finish:'realistic','hair');
    const compile=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey(),shine=settings.shine;
    m.onBeforeCompile=(shader,renderer)=>{
      compile(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('diffuseColor.rgb*.18*pow',`diffuseColor.rgb*${(.06+shine*.27).toFixed(4)}*pow`);
      shader.fragmentShader=shader.fragmentShader.replace('outgoingLight=bjLit;',`bjLit+=mix(diffuseColor.rgb,vec3(.18,.155,.20),.5)*${(.10+shine*.48).toFixed(4)}*pow(max(0.,dot(normal,normalize(normalize(vViewPosition)+vec3(-.30,.72,.64)))),22.); outgoingLight=bjLit;`);
    };
    m.customProgramCacheKey=()=>key+'|shine-'+shine;return m;
  }
  function clear(){if(group){group.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose();}});group.removeFromParent();group=null;}surfaceMaps?.dispose();surfaceMaps=null;motion.clear();}
  function attach(){if(!group)return;group.matrix.copy(headRestInverse).multiply(new T.Matrix4().makeTranslation(0,(sculpt.field.shape.height-168)/100,0));group.matrix.decompose(group.position,group.quaternion,group.scale);group.matrixWorldNeedsUpdate=true;group.updateWorldMatrix(false,true);motion.update(0,0,[],true);}
  function fit(){
    if(!head)return;head.updateWorldMatrix(true,false);headRestInverse.copy(head.matrixWorld).invert();
    const previousCollider=JSON.stringify(anatomyCollider),body=sculpt.records.find(r=>r.masks.some(m=>m.torso>.4));
    if(body){
      const a=sculpt.field.landmarks,p=body.node.geometry.attributes.position,m=body.node.matrixWorld,v=new T.Vector3();let width=0,front=-Infinity,back=Infinity;
      for(let i=0;i<p.count;i++)if(body.masks[i].torso>.4&&body.points[i*3+1]>a.waist-.08&&body.points[i*3+1]<a.shoulder+.03){v.fromBufferAttribute(p,i).applyMatrix4(m);width=Math.max(width,Math.abs(v.x));front=Math.max(front,v.z);back=Math.min(back,v.z);}
      if(Number.isFinite(front))anatomyCollider={center:new T.Vector3(0,sculpt.field.vertical(a.chest-.04),(front+back)*.5),radii:[width+.018,.23,(front-back)*.5+.025]};
    }
    chest?.updateWorldMatrix(true,false);if(chest)chestRestInverse.copy(chest.matrixWorld).invert();motion.update(0,0,[],true);
    if(group&&previousCollider!==JSON.stringify(anatomyCollider))build();else attach();
  }
  function build(){
    clear();const imported=['source','textured'].includes(settings.style);sourceHair(imported);if(imported||!head)return;
    group=new T.Group();group.name='Bijou_sculpted_hair';group.matrixAutoUpdate=false;head.add(group);
    const calibrated=!!sculpt.eyeAnchors,scale=calibrated?.74:1,depthScale=calibrated?.86:1;
    const crown=new T.Mesh(hairCrown(calibrated?1.694:1.689,settings.volume),material());crown.geometry.scale(scale,1,depthScale);crown.name='Hair_crown';crown.castShadow=true;group.add(crown);
    for(const [i,guide]of hairGuides(settings,sculpt.field.landmarks.neck,sculpt.faceAnchors.eye).entries()){
      let points=guide.points.map(([x,y,z])=>[x*scale+(calibrated?Math.sign(x)*.008:0),y,z*depthScale+(calibrated&&z>.025?.014:0)]);
      if(guide.moving&&anatomyCollider){
        const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),c=anatomyCollider;
        points=Array.from({length:13},(_,i)=>{
          const p=path.getPoint(i/12),dy=(p.y+(sculpt.field.shape.height-168)/100-c.center.y)/c.radii[1],band=Math.sqrt(Math.max(.01,1-dy*dy));
          if(Math.abs(dy)<1){const rx=(c.radii[0]+.010)*band,rz=(c.radii[2]+.014)*band,q=Math.hypot(p.x/rx,(p.z-c.center.z)/rz);if(q>0&&q<1){p.x/=q;p.z=c.center.z+(p.z-c.center.z)/q;}}
          return p.toArray();
        });
      }
      const {geometry,curve}=hairLock(points,guide.width*scale,guide.depth*depthScale),m=material();m.vertexColors=true;
      const mesh=new T.Mesh(geometry,m);mesh.name=`Hair_lock_${i}`;mesh.frustumCulled=false;mesh.castShadow=true;group.add(mesh);if(guide.moving)motion.add(mesh,curve);
    }
    attach();
  }
  function set(value){
    const next=cleanHair(value),rebuild=['style','length','volume','color','shine'].some(k=>next[k]!==settings[k]);settings=next;if(rebuild)build();else fit();
  }
  function update(dt,disabled=false){
    if(!group)return false;const a=sculpt.field.landmarks;
    const matrix=chest?chest.matrixWorld.clone().multiply(chestRestInverse):new T.Matrix4(),scale=1+sculpt.field.shape.build*.15;
    const center=(anatomyCollider?.center.clone()||new T.Vector3(0,sculpt.field.vertical(a.chest-.04),-.005)).applyMatrix4(matrix),e=matrix.elements;
    const collider={name:'torso',center:center.toArray(),radii:anatomyCollider?.radii||[.15*scale,.23,.105*scale],axes:[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]]};
    motion.update(dt,disabled?0:settings.motion,[collider],disabled);return !disabled&&settings.motion>0;
  }
  function setSurface(value){finish=value;if(group)build();}
  function dispose(){clear();sourceHair(true);}
  fit();
  return {set,fit,update,dispose,setSurface,setWire(value){wire=value;group?.traverse(n=>{if(n.isMesh)n.material.wireframe=value;});},get group(){return group;},get settings(){return {...settings};},get diagnostics(){return {...motion.diagnostics,hiddenSourceTriangles:sculpt.records.reduce((n,r)=>n+(hidden?(r.node.userData.bijouSurface==='hair'&&!r.node.visible?r.index.count:r.index.count-r.withoutHairIndex.count)/3:0),0)};}};
}
