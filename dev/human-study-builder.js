import * as T from '../js/vendor/avatar-engine.js';
import {GLTFExporter} from '../js/vendor/model-exporter.js';
import {hairCrown,hairLock} from '../js/model-hair-geometry.js';

function solidMap(color,size=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,size,size);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
function eyeMap(radius){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e5e0dc';ctx.fillRect(0,0,512,256);
  const r=Math.asin(.0063/radius)/Math.PI*256;
  ctx.fillStyle='#574a39';ctx.beginPath();ctx.arc(128,128,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#141820';ctx.beginPath();ctx.arc(128,128,r*.31,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fafaff';ctx.beginPath();ctx.arc(128-r*.25,128-r*.25,r*.12,0,Math.PI*2);ctx.fill();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
function weldNormals(geometry,ids){
  geometry.computeVertexNormals();const n=geometry.attributes.normal,groups=new Map(),sum=new T.Vector3();
  for(let i=0;i<n.count;i++){const id=ids?.[i]??Array.from(geometry.attributes.position.array.subarray(i*3,i*3+3)).map(v=>v.toFixed(6)).join(',');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(i);}
  for(const group of groups.values()){
    sum.set(0,0,0);for(const i of group)sum.add(new T.Vector3().fromBufferAttribute(n,i));sum.normalize();
    for(const i of group)n.setXYZ(i,sum.x,sum.y,sum.z);
  }
  geometry.computeTangents();
}
function cutGarment(body,low,high){
  const p=body.attributes.position,n=body.attributes.normal,uv=body.attributes.uv,si=body.attributes.skinIndex,sw=body.attributes.skinWeight,positions=[],normals=[],texcoords=[],joints=[],weights=[],indices=[];
  const mixed=(a,b,t)=>({point:a.point.map((v,k)=>v+(b.point[k]-v)*t),normal:a.normal.map((v,k)=>v+(b.normal[k]-v)*t),uv:a.uv.map((v,k)=>v+(b.uv[k]-v)*t),weights:new Map([...new Set([...a.weights.keys(),...b.weights.keys()])].map(k=>[k,(a.weights.get(k)||0)*(1-t)+(b.weights.get(k)||0)*t]))});
  const clip=(polygon,distance)=>{const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a.point),db=distance(b.point);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(mixed(a,b,da/(da-db)));}return out;};
  function add(v){
    const normal=new T.Vector3(...v.normal).normalize(),ranked=[...v.weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0),at=positions.length/3;
    positions.push(...v.point.map((p,k)=>p+normal.getComponent(k)*.003));normals.push(...normal.toArray());texcoords.push(...v.uv);
    for(let k=0;k<4;k++){joints.push(ranked[k]?.[0]||0);weights.push((ranked[k]?.[1]||0)/sum);}return at;
  }
  for(let at=0;at<body.index.count;at+=3){
    let polygon=[0,1,2].map(k=>{const id=body.index.getX(at+k),w=new Map();for(let j=0;j<4;j++)w.set(si.getComponent(id,j),(w.get(si.getComponent(id,j))||0)+sw.getComponent(id,j));return {point:[p.getX(id),p.getY(id),p.getZ(id)],normal:[n.getX(id),n.getY(id),n.getZ(id)],uv:[uv.getX(id),uv.getY(id)],weights:w};});
    for(const distance of [v=>v[1]-low,v=>high-v[1],v=>.22-v[0],v=>.22+v[0]])polygon=clip(polygon,distance);
    for(let i=1;i<polygon.length-1;i++)indices.push(...[polygon[0],polygon[i],polygon[i+1]].map(add));
  }
  const geometry=new T.BufferGeometry();
  for(const [name,values,size]of [['position',positions,3],['normal',normals,3],['uv',texcoords,2],['skinWeight',weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(values,size));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setIndex(indices);return geometry;
}
function fringePatch(i){
  const rows=32,cols=8,positions=[],uv=[],indices=[],phi=i*.185;
  for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
    const t=j/rows,u=k/cols*2-1,angle=.055+t*(1.29+Math.abs(i)*.008),p=phi+u*.097;
    const ridge=.0018*Math.cos(u*Math.PI/2),radial=Math.sin(angle);
    positions.push(Math.sin(p)*radial*(.0896+ridge),1.569+Math.cos(angle)*.125+.0012*u*u*t**6,Math.cos(p)*radial*(.1258+ridge)-.0069);
    uv.push(k/cols,t);if(j<rows&&k<cols){const n=j*(cols+1)+k;indices.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export async function buildHumanStudy(){
  const source=await (await fetch('../assets/studies/human-adult-v1/source.json')).json();
  const scene=new T.Scene();scene.name='Bijou_adult_anatomy';
  scene.userData={bijouCleanTopology:true,bijouCompleteBody:true,bijouFace:source.face,bijouSource:'MakeHuman CC0 adult anatomy study'};
  const bones=source.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;return bone;});
  source.bones.forEach((b,i)=>{
    const parent=b.parent===null?scene:bones[b.parent];parent.add(bones[i]);
    bones[i].position.fromArray(b.position);if(b.parent!==null)bones[i].position.sub(new T.Vector3().fromArray(source.bones[b.parent].position));
  });
  scene.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones),meshes=[];
  function mesh(geometry,material,name,surface,ids){
    if(!geometry.attributes.skinIndex){
      const count=geometry.attributes.position.count,joint=source.bones.findIndex(b=>b.name==='Head'),indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
      for(let i=0;i<count;i++){indices[i*4]=joint;weights[i*4]=1;}
      geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    }
    if(!geometry.attributes.normal)geometry.computeVertexNormals();geometry.computeTangents();
    const m=new T.SkinnedMesh(geometry,material);m.name=name;m.userData.bijouSurface=surface;if(name.startsWith('Hime_fringe'))m.userData.bijouFringe=true;m.frustumCulled=false;scene.add(m);m.bind(skeleton);meshes.push({mesh:m,ids});return m;
  }
  const body=new T.BufferGeometry();
  body.setAttribute('position',new T.Float32BufferAttribute(source.positions,3));body.setAttribute('uv',new T.Float32BufferAttribute(source.uvs,2));
  body.setAttribute('skinIndex',new T.Uint16BufferAttribute(source.skinIndices,4));body.setAttribute('skinWeight',new T.Float32BufferAttribute(source.skinWeights,4));body.setIndex(source.indices);
  weldNormals(body,source.originalIds);
  mesh(body,new T.MeshPhysicalMaterial({map:solidMap('#ecc2ac',1024),roughness:.58,metalness:0,specularIntensity:.45}),'Adult_continuous_body','skin',source.originalIds);
  for(const [i,eye]of source.face.eyes.entries()){
    const geometry=new T.SphereGeometry(eye.sphereRadius,64,32);geometry.translate(eye.x,eye.y,eye.z);
    const indices=new Uint16Array(geometry.attributes.position.count*4),weights=new Float32Array(indices.length);
    for(let v=0;v<indices.length/4;v++){indices[v*4]=eye.bone;weights[v*4]=1;}
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    mesh(geometry,new T.MeshPhysicalMaterial({map:eyeMap(eye.sphereRadius),roughness:.18,clearcoat:1,clearcoatRoughness:.08,specularIntensity:.75}),'Independent_eye_'+i,'eye');
  }
  // Mandatory opaque coverage shares the source weights and follows all edits.
  for(const [name,low,high,color]of [['Base_top',1.02,1.29,'#638095'],['Base_shorts',.72,1.035,'#718399']]){
    mesh(cutGarment(body,low,high),new T.MeshPhysicalMaterial({map:solidMap(color,512),roughness:.85,side:T.DoubleSide}),name,'cloth');
  }
  const hairMaterial=new T.MeshPhysicalMaterial({map:solidMap('#44384a',512),roughness:.42,anisotropy:.5,anisotropyRotation:Math.PI/2,side:T.DoubleSide});
  const top=1.694,eye=source.face.eye;
  const crown=hairCrown(top,.3);crown.scale(.74,1,.86);mesh(crown,hairMaterial,'Authored_hair_crown','hair');
  for(let i=-4;i<=4;i++){
    const x=i*.020,{geometry}=hairLock([[x*.2,top-.020,-.03],[x*.85,top-.095,-.084],[x*1.06,1.44,-.096],[x*1.24,1.21+Math.abs(i)*.010,-.080],[x*1.35,1.19+Math.abs(i)*.010,-.060]],.024,.010);
    mesh(geometry,hairMaterial,'Hair_back_'+(i+4),'hair');
  }
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*(.076+i*.003),{geometry}=hairLock([[side*.050,top-.035,.032-i*.025],[x,eye+.018,.036-i*.025],[x*1.03,1.43,.035-i*.025],[x*1.12,1.32+i*.014,.030-i*.025]],.022,.008);
    mesh(geometry,hairMaterial,'Hair_temple_'+side+'_'+i,'hair');
  }
  for(let i=-4;i<=4;i++){
    mesh(fringePatch(i),hairMaterial,'Hime_fringe_'+(i+4),'hair');
  }
  function align(name,end,direction){
    const b=bones.find(b=>b.name===name),tail=bones.find(b=>b.name===end),start=b.getWorldPosition(new T.Vector3());
    const current=tail.getWorldPosition(new T.Vector3()).sub(start).normalize(),q=new T.Quaternion().setFromUnitVectors(current,new T.Vector3(...direction).normalize()),parent=b.parent.getWorldQuaternion(new T.Quaternion());
    b.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));scene.updateMatrixWorld(true);
  }
  for(const [prefix,side]of [['Left',1],['Right',-1]]){
    align(prefix+'Arm',prefix+'ForeArm',[side*.050,-.23,.025]);align(prefix+'ForeArm',prefix+'Hand',[side*.045,-.24,.025]);
  }
  skeleton.update();const baked=meshes.map(({mesh:m})=>{
    const p=m.geometry.attributes.position,rest=new Float32Array(p.array.length),v=new T.Vector3();
    for(let i=0;i<p.count;i++)m.getVertexPosition(i,v).toArray(rest,i*3);return rest;
  });
  skeleton.calculateInverses();
  meshes.forEach(({mesh:m,ids},i)=>{m.geometry.attributes.position.array.set(baked[i]);weldNormals(m.geometry,ids);m.bind(skeleton,m.matrixWorld);});
  skeleton.update();scene.updateMatrixWorld(true);
  const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
  return {binary,report:{bones:bones.length,meshes:meshes.length,triangles:meshes.reduce((n,{mesh:m})=>n+m.geometry.index.count/3,0),bytes:binary.byteLength}};
}
