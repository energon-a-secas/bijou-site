import * as T from './vendor/avatar-engine.js';
import { cleanClothes } from './model-clothes.js';
import { smooth } from './model-shape.js';
import { applyFinish } from './avatar-finish.js';
import { weldedSurfaceNormals } from './model-normals.js';
import { createFabricEnvelope } from './model-fabric-envelope.js';

function clothTexture(kind){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=((x*17+y*31+x*y*7)%23)/23;
    const weave=kind==='denim'?((x+y)%8<3?.90:1):kind==='knit'?(Math.cos(x*Math.PI/4+Math.sin(y*.45))*.055+.92):((x%4===0||y%4===0)?.94:1);
    const value=Math.round(255*Math.min(1,weave*(.97+noise*.03))),i=(y*size+x)*4;data.set([value,value,value,255],i);
  }
  const texture=new T.DataTexture(data,size,size);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
// Clip triangles at real cut lines. Barycentric coordinates retain an exact
// attachment to the deformed source and interpolate skin weights at each cut.
function clipTriangle(vertices){
  const out=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],inside=a.d>=0;
    if(inside)out.push(a);
    if(inside!==(b.d>=0)){
      const t=a.d/(a.d-b.d);out.push({d:0,weights:a.weights.map((w,j)=>w+(b.weights[j]-w)*t)});
    }
  }
  return out;
}
function mask(record,i,slot,settings,a){
  const x=record.points[i*3],y=record.points[i*3+1],z=record.points[i*3+2],body=record.masks[i],cloth=record.surface[i].cloth;
  // Geometric hems stay straight. Thresholding mixed wrist/ankle bone weights
  // instead leaves a ragged cuff that follows the rig's influence boundary.
  if(y>a.shoulder+.110)return -1;
  const anatomical=record.node.userData.bijouSurface==='skin',completeUpper=anatomical||record.node.userData.bijouAnimeBody,torso=(body.torso||0)+(body.leg||0)+(completeUpper?(body.head||0):0),kind=settings[slot];
  if(slot==='bottom'){
    const lower=kind==='shorts'?a.pelvis-.235:a.ankleY+.02+(1-settings.legLength)*.20;
    return Math.min(torso-.4,(a.waist-.02-y)*8,(y-lower)*8);
  }
  const source=Math.min(cloth-.035,(y-(a.waist-.05))*8);
  if(kind==='tank')return Math.max(Math.min(source,torso-.4),Math.min(torso-.4,(y-(a.waist-.05))*8,(a.shoulder-.065-y)*8));
  const back=1-smooth(-.035,.06,z);
  const neckline=completeUpper?a.neck-.013+.030*back+.075*smooth(.045,.110,Math.abs(x)):a.shoulder-.022+.08*smooth(.04,.105,Math.abs(x));
  const center=Math.min(torso-.25,(y-(a.waist-.05))*8,(neckline-y)*8);
  const armDx=a.elbowX-a.shoulderX,armDy=a.elbowY-a.shoulder;
  const t=((Math.abs(x)-a.shoulderX)*armDx+(y-a.shoulder)*armDy)/(armDx*armDx+armDy*armDy);
  const sleeve=kind==='tee'?(.56-t)*2:(y-(a.wristY+.018))*8;
  return Math.min((neckline-y)*8,Math.max(completeUpper?-1:source,center,Math.min((body.arm||0)-.25,sleeve)));
}
function createPiece(record,slot,settings,a,material){
  const original=record.node,source=original.geometry,index=record.index;
  const references=[],uv=[],joints=[],weights=[],basePoints=[],temp=new T.Vector3();
  const masks=new Float32Array(source.attributes.position.count);
  for(let i=0;i<masks.length;i++)masks[i]=mask(record,i,slot,settings,a);
  function add(ids,bary){
    const weighted=new Map();temp.set(0,0,0);
    for(let k=0;k<3;k++){
      const id=ids[k],weight=bary[k];temp.x+=record.points[id*3]*weight;temp.y+=record.points[id*3+1]*weight;temp.z+=record.points[id*3+2]*weight;
      for(let j=0;j<4;j++){const bone=source.attributes.skinIndex.array[id*4+j],w=source.attributes.skinWeight.array[id*4+j]*weight;weighted.set(bone,(weighted.get(bone)||0)+w);}
    }
    const ranked=[...weighted].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0);
    for(let k=0;k<4;k++){joints.push(ranked[k]?.[0]||0);weights.push((ranked[k]?.[1]||0)/sum);}
    uv.push(temp.x*10,temp.y*10);basePoints.push(...temp.toArray());references.push({ids,bary});
  }
  const count=index?.count??source.attributes.position.count;
  for(let at=0;at<count;at+=3){
    // Lower hair strands can carry torso/arm weights. Classify the material
    // inside each UV triangle, where border padding cannot create false holes.
    const ids=[0,1,2].map(k=>index?index.getX(at+k):at+k);
    const meanY=ids.reduce((sum,id)=>sum+record.points[id*3+1],0)/3,meanZ=ids.reduce((sum,id)=>sum+record.points[id*3+2],0)/3;
    if(!record.node.userData.bijouAnimeBody&&!record.wearable[at/3]&&meanY>a.waist-.12&&meanZ<.01)continue;
    if(ids.every(i=>masks[i]<0))continue;
    const vertices=ids.map((id,k)=>({d:masks[id],weights:[0,1,2].map(j=>j===k?1:0)}));
    const polygon=clipTriangle(vertices);
    for(let k=1;k<polygon.length-1;k++)for(const v of [polygon[0],polygon[k],polygon[k+1]])add(ids,v.weights);
  }
  if(!references.length)return null;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(references.length*3),3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(references.length*3),3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name=`Bijou_${slot}_${settings[slot]}`;mesh.frustumCulled=false;
  mesh.position.copy(original.position);mesh.quaternion.copy(original.quaternion);mesh.scale.copy(original.scale);
  original.parent.add(mesh);mesh.bind(original.skeleton,original.bindMatrix);
  const grouped=new Map();for(let i=0;i<basePoints.length;i+=3){const key=basePoints.slice(i,i+3).map(v=>v.toFixed(5)).join(',');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(i/3);}
  return {mesh,record,references,basePoints,slot,groups:[...grouped.values()].filter(g=>g.length>1)};
}
export function createModelWardrobe(sculpt){
  let settings=cleanClothes(),pieces=[],surface='anime3d',wire=false;
  const textures={cotton:clothTexture('cotton'),denim:clothTexture('denim'),knit:clothTexture('knit')};
  const materials={top:new T.MeshStandardMaterial({side:T.DoubleSide}),bottom:new T.MeshStandardMaterial({side:T.DoubleSide})};
  function coverSource(){
    for(const record of sculpt.records){
      if(!record.node.userData.bijouAnimeBody)continue;
      const kept=[],index=record.index,a=sculpt.field.landmarks;
      for(let at=0;at<index.count;at+=3){
        const ids=[index.getX(at),index.getX(at+1),index.getX(at+2)];
        const covered=['top','bottom'].some(slot=>settings[slot]!=='source'&&ids.every(id=>mask(record,id,slot,settings,a)>=0));
        if(!covered)kept.push(...ids);
      }
      const geometry=record.node.geometry;
      geometry.dispose();geometry.setIndex(kept.length===index.count?index:new T.Uint32BufferAttribute(kept,1));
    }
  }
  function style(){
    for(const slot of ['top','bottom']){
      const m=materials[slot],kind=settings[slot];m.color.set(surface==='clay'?'#c5b0a4':settings[slot+'Color']);
      m.map=surface==='clay'?null:textures[kind==='jeans'?'denim':kind==='longsleeve'?'knit':'cotton'];
      m.roughness=kind==='leggings'?.76:.92;m.metalness=0;m.wireframe=wire;applyFinish(m,['anime3d','anime2d'].includes(surface)?surface:'realistic','fabric');m.needsUpdate=true;
    }
  }
  const p=new T.Vector3(),n=new T.Vector3(),outward=new T.Vector3(),sample=new T.Vector3();
  function fit(){
    const directions=new Map(),envelopes=new Map();
    for(const piece of pieces){
      const {mesh,record,references,slot}=piece,source=record.node.geometry,positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
      record.node.updateWorldMatrix(true,false);const matrix=record.node.matrixWorld,inverse=matrix.clone().invert(),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
      const ease=.0012+settings[slot+'Fit']*.012;
      if(!directions.has(record)){const visible=source.index;source.setIndex(record.index);directions.set(record,weldedSurfaceNormals(source,record.groups));source.setIndex(visible);}
      const anatomical=record.node.userData.bijouSurface==='skin';
      if(anatomical&&slot==='top'&&!envelopes.has(record)){const a=sculpt.field.landmarks;envelopes.set(record,createFabricEnvelope(source.attributes.position.array,{...a,waist:sculpt.field.vertical(a.waist),chest:sculpt.field.vertical(a.chest)}));}
      const offsetNormals=directions.get(record);
      for(let i=0;i<references.length;i++){
        const ref=references[i];p.set(0,0,0);n.set(0,0,0);outward.set(0,0,0);
        for(let k=0;k<3;k++){const id=ref.ids[k],w=ref.bary[k];p.addScaledVector(sample.fromBufferAttribute(source.attributes.position,id),w);n.addScaledVector(sample.fromBufferAttribute(source.attributes.normal,id),w);outward.addScaledVector(sample.fromArray(offsetNormals,id*3),w);}
        const overlap=slot==='top'&&settings.bottom!=='source'?(1-smooth(sculpt.field.landmarks.waist-.04,sculpt.field.landmarks.waist+.02,piece.basePoints[i*3+1]))*(.002+settings.bottomFit*.012):0;
        n.normalize();normals.setXYZ(i,n.x,n.y,n.z);
        if(anatomical&&slot==='top')p.z+=(envelopes.get(record)(p.x,p.y,p.z)-p.z)*(.55+settings.topFit*.45);
        p.applyMatrix4(matrix);outward.applyMatrix3(normalMatrix).normalize();p.addScaledVector(outward,ease+overlap).applyMatrix4(inverse);positions.setXYZ(i,p.x,p.y,p.z);
      }
      if(anatomical){normals.array.set(weldedSurfaceNormals(mesh.geometry,piece.groups));}
      positions.needsUpdate=true;normals.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.updateWorldMatrix(true,false);mesh.bind(record.node.skeleton,mesh.matrixWorld);
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
  }
  function set(input){
    const next=cleanClothes(input),rebuild=next.top!==settings.top||next.bottom!==settings.bottom||next.legLength!==settings.legLength;
    settings=next;
    if(rebuild){
      for(const p of pieces){p.mesh.removeFromParent();p.mesh.geometry.dispose();}pieces=[];
      for(const slot of ['top','bottom'])if(settings[slot]!=='source')for(const record of sculpt.records){
        if(record.node.userData.bijouSurface&&record.node.userData.bijouSurface!=='skin')continue;
        const piece=createPiece(record,slot,settings,sculpt.field.landmarks,materials[slot]);if(piece)pieces.push(piece);
      }
      coverSource();
    }
    style();fit();
  }
  function dispose(){for(const p of pieces){p.mesh.removeFromParent();p.mesh.geometry.dispose();}pieces=[];for(const record of sculpt.records)if(record.node.userData.bijouAnimeBody){record.node.geometry.dispose();record.node.geometry.setIndex(record.index);}for(const m of Object.values(materials))m.dispose();for(const t of Object.values(textures))t.dispose();}
  return {set,fit,dispose,setSurface(value){surface=value;style();},setWire(value){wire=value;style();},
    get settings(){return {...settings};},get meshes(){return pieces.map(p=>p.mesh);}};
}
