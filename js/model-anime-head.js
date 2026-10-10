import * as T from './vendor/avatar-engine.js';
import {createAtlasSampler} from './model-surface.js';

// Reuse the project's attributed CC0 face, not a generated face texture fused
// to hair. Everything is resolved into the studio's normalized +Z rest space.
function compactGeometry(source,indices,point){
  const ids=[...new Set(indices)],remap=new Map(ids.map((id,i)=>[id,i])),g=new T.BufferGeometry();
  for(const name of ['position','normal','uv','skinIndex','skinWeight']){
    const a=source.attributes[name];if(!a)continue;
    const array=new a.array.constructor(ids.length*a.itemSize);
    ids.forEach((id,i)=>array.set(a.array.subarray(id*a.itemSize,(id+1)*a.itemSize),i*a.itemSize));
    g.setAttribute(name,new T.BufferAttribute(array,a.itemSize,a.normalized));
  }
  if(point){const p=g.attributes.position;ids.forEach((id,i)=>p.setXYZ(i,...point(id)));}
  g.setIndex(indices.map(id=>remap.get(id)));return g;
}
function disposeSource(scene,keptTextures){
  const geometries=new Set(),materials=new Set(),skeletons=new Set(),textures=new Set();
  scene.traverse(n=>{if(!n.isMesh)return;geometries.add(n.geometry);if(n.skeleton)skeletons.add(n.skeleton);for(const m of [n.material].flat())materials.add(m);});
  for(const m of materials){for(const v of Object.values(m))if(v?.isTexture&&!keptTextures.has(v))textures.add(v);m.dispose();}
  for(const g of geometries)g.dispose();for(const s of skeletons)s.dispose();for(const t of textures)t.dispose();
}
function removeHairFragments(mesh,neckY){
  const g=mesh.geometry,points=[],ids=[],welded=new Map(),parent=[],sample=createAtlasSampler(mesh);
  for(let i=0;i<g.attributes.position.count;i++){
    const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld),key=p.toArray().map(v=>v.toFixed(5)).join(',');
    points.push(p);if(!welded.has(key)){welded.set(key,parent.length);parent.push(parent.length);}ids.push(welded.get(key));
  }
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let at=0;at<g.index.count;at+=3){const a=find(ids[g.index.getX(at)]);for(let k=1;k<3;k++)parent[find(ids[g.index.getX(at+k)])]=a;}
  const groups=new Map();
  for(let i=0;i<ids.length;i++){
    const key=find(ids[i]);if(!groups.has(key))groups.set(key,{count:0,dark:0,minY:Infinity,maxZ:-Infinity});
    const group=groups.get(key),color=sample(i);group.count++;group.dark+=Number(Math.max(...color.color)<.30&&color.cloth<.25);group.minY=Math.min(group.minY,points[i].y);group.maxZ=Math.max(group.maxZ,points[i].z);
  }
  const largest=Math.max(...[...groups.values()].map(g=>g.count)),kept=[];
  for(let at=0;at<g.index.count;at+=3){
    const group=groups.get(find(ids[g.index.getX(at)]));
    if(group.count<largest&&group.minY>neckY-.45&&(group.dark/group.count>.55||(group.count<largest*.06&&group.maxZ<-.045)))continue;
    kept.push(g.index.getX(at),g.index.getX(at+1),g.index.getX(at+2));
  }
  mesh.geometry=compactGeometry(g,kept);g.dispose();
}
export async function attachAnimeHead(root){
  root.updateWorldMatrix(true,true);
  const head=root.getObjectByName('Head'),neck=root.getObjectByName('neck');
  if(!head||!neck)throw Error('The anime head needs the Hime head and neck joints.');
  const neckY=neck.getWorldPosition(new T.Vector3()).y,cut=neckY+.012;
  // A horizontal cut through the neck also removes the upper shoulder caps.
  // Raise the boundary outside the neck, still below the original face.
  const cutDistance=p=>cut+.060*T.MathUtils.smoothstep(Math.abs(p.x),.060,.140)-p.y;
  const original=[];root.traverse(n=>{if(n.isSkinnedMesh)original.push(n);});
  for(const mesh of original){
    const g=mesh.geometry,p=g.attributes.position,points=[];
    for(let i=0;i<p.count;i++)points.push(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
    const kept=[],names=['position','normal','uv','skinIndex','skinWeight'],arrays=Object.fromEntries(names.map(name=>[name,Array.from(g.attributes[name].array)]));
    const add=(ids,bary)=>{
      const index=arrays.position.length/3;
      for(const name of ['position','normal','uv']){const a=g.attributes[name];for(let k=0;k<a.itemSize;k++)arrays[name].push(ids.reduce((sum,id,j)=>sum+a.array[id*a.itemSize+k]*bary[j],0));}
      const influences=new Map();for(const [j,id]of ids.entries())for(let k=0;k<4;k++){const bone=g.attributes.skinIndex.array[id*4+k],w=g.attributes.skinWeight.array[id*4+k]*bary[j];influences.set(bone,(influences.get(bone)||0)+w);}
      const ranked=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),total=ranked.reduce((n,entry)=>n+entry[1],0);
      for(let k=0;k<4;k++){arrays.skinIndex.push(ranked[k]?.[0]||0);arrays.skinWeight.push((ranked[k]?.[1]||0)/total);}return index;
    };
    for(let at=0;at<g.index.count;at+=3){
      const ids=[0,1,2].map(k=>g.index.getX(at+k));
      if(ids.every(id=>cutDistance(points[id])<0))continue;
      if(ids.every(id=>cutDistance(points[id])>=0)){kept.push(...ids);continue;}
      const polygon=[];
      for(let i=0;i<3;i++){
        const a=ids[i],b=ids[(i+1)%3],da=cutDistance(points[a]),db=cutDistance(points[b]);
        if(da>=0)polygon.push(a);
        if((da>=0)!==(db>=0)){const t=da/(da-db),bary=ids.map(id=>id===a?1-t:id===b?t:0);polygon.push(add(ids,bary));}
      }
      for(let i=1;i<polygon.length-1;i++)kept.push(polygon[0],polygon[i],polygon[i+1]);
    }
    const clipped=new T.BufferGeometry();for(const name of names){const a=g.attributes[name];clipped.setAttribute(name,new T.BufferAttribute(new a.array.constructor(arrays[name]),a.itemSize,a.normalized));}
    mesh.geometry=compactGeometry(clipped,kept);g.dispose();clipped.dispose();
    removeHairFragments(mesh,neckY);
    mesh.userData.bijouAnimeBody=true;
  }
  const source=await new T.GLTFLoader().loadAsync(new URL('../assets/models/bijou.vrm',import.meta.url).href);
  source.scene.updateWorldMatrix(true,true);
  const scale=.94,offset=1.680-1.71574*scale,centerX=.00047774;
  const worldToRoot=root.matrixWorld.clone().invert(),point=new T.Vector3(),normal=new T.Vector3();
  const map=p=>{
    const q=new T.Vector3(-(p.x-centerX)*scale,p.y*scale+offset,-p.z*scale+.009);
    const ex=Math.exp(-(((Math.abs(q.x)-.040)/.036)**4)),ey=Math.exp(-(((q.y-1.5335)/.046)**4));
    if(q.z>.045){q.y-=(q.y-1.5335)*.24*ex*ey;q.x-=(q.x-Math.sign(q.x)*.040)*.10*ex*ey;}
    return q;
  };
  const blinkGroups=source.parser.json.extensions.VRM.blendShapeMaster.blendShapeGroups;
  const blinkIndices=['blink_r','blink_l'].map(name=>blinkGroups.find(g=>g.presetName===name).binds[0].index);
  const mappedNormal=(n,p)=>{
    const e=.0001,q=map(p),dx=map(p.clone().add(new T.Vector3(e,0,0))).sub(q).multiplyScalar(1/e),dy=map(p.clone().add(new T.Vector3(0,e,0))).sub(q).multiplyScalar(1/e),dz=map(p.clone().add(new T.Vector3(0,0,e))).sub(q).multiplyScalar(1/e);
    const matrix=new T.Matrix3().set(dx.x,dy.x,dz.x,dx.y,dy.y,dz.y,dx.z,dy.z,dz.z).invert().transpose();return n.clone().applyMatrix3(matrix).normalize();
  };
  const bones=original[0].skeleton.bones,skeleton=new T.Skeleton(bones),headIndex=bones.indexOf(head),neckIndex=bones.indexOf(neck);
  const textures=new Set(),hairMaps=new Map(),skinMaps=new Map(),irisMaps=new Map(),eyePoints=[[],[]],facePoints=[],mouthPoints=[];let triangles=0;
  const cached=(cache,map,make)=>{if(!cache.has(map))cache.set(map,make(map));return cache.get(map);};
  source.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;const mat=mesh.material,name=mat.name;
    const face=/Face|Eye/.test(name),fringe=/HAIR_02/.test(name),scalp=/HairBack/.test(name);
    const backHead=/Body/.test(name)&&mesh.name==='Bodybaked_3';
    if(!face&&!fringe&&!scalp&&!backHead)return;
    const positions=new Map(),indices=[];
    for(const id of new Set(mesh.geometry.index.array))positions.set(id,mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
    for(let at=0;at<mesh.geometry.index.count;at+=3){
      const ids=[0,1,2].map(k=>mesh.geometry.index.getX(at+k));
      indices.push(...ids);
    }
    if(!indices.length)return;
    const g=compactGeometry(mesh.geometry,indices,id=>map(positions.get(id)).toArray()),p=g.attributes.position;
    const toWorld=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),ids=[...new Set(indices)];
    for(let i=0;i<p.count;i++){
      normal.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(toWorld).normalize();normal.copy(mappedNormal(normal,positions.get(ids[i])));g.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);
      g.attributes.skinIndex.setXYZW(i,headIndex,neckIndex,0,0);g.attributes.skinWeight.setXYZW(i,1,0,0,0);
      point.fromBufferAttribute(p,i);
      if(/EyeIris/.test(name))eyePoints[point.x<0?0:1].push(point.clone());
      if(/Face_00_SKIN/.test(name)&&!backHead)facePoints.push(point.clone());
      if(/FaceMouth/.test(name))mouthPoints.push(point.clone());
    }
    if(face&&mesh.morphTargetInfluences)for(const [side,target]of blinkIndices.entries()){
      const delta=[],normalDelta=[],sourceNormal=mesh.geometry.attributes.normal,morphNormal=mesh.geometry.morphAttributes.normal[target];
      mesh.morphTargetInfluences[target]=1;
      for(const [i,id]of ids.entries()){
        const sourcePoint=mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld),closed=map(sourcePoint),base=new T.Vector3().fromBufferAttribute(p,i);
        delta.push(...closed.sub(base).toArray());
        normal.fromBufferAttribute(sourceNormal,id).add(new T.Vector3().fromBufferAttribute(morphNormal,id)).applyMatrix3(toWorld).normalize();
        normal.copy(mappedNormal(normal,sourcePoint)).sub(new T.Vector3().fromBufferAttribute(g.attributes.normal,i));normalDelta.push(...normal.toArray());
      }
      mesh.morphTargetInfluences[target]=0;
      g.setAttribute(side?'studyBlinkR':'studyBlinkL',new T.Float32BufferAttribute(delta,3));g.setAttribute(side?'studyBlinkNormalR':'studyBlinkNormalL',new T.Float32BufferAttribute(normalDelta,3));
    }
    const material=new T.MeshPhysicalMaterial({color:mat.color,map:mat.map,transparent:mat.transparent,opacity:mat.opacity,alphaTest:mat.alphaTest,side:mat.side,depthWrite:mat.depthWrite,depthTest:mat.depthTest});
    material.name='Anime_'+name;material.metalness=0;material.roughness=.65;material.normalMap=null;material.aoMap=null;
    if(/Face_00_SKIN/.test(name))material.map=cached(skinMaps,mat.map,faceSkinMap);
    if(/EyeIris/.test(name))material.map=cached(irisMaps,mat.map,amberIrisMap);
    if(fringe||scalp)material.map=cached(hairMaps,mat.map,neutralHairMap);
    for(const v of Object.values(material))if(v?.isTexture)textures.add(v);
    const next=new T.SkinnedMesh(g,material);next.name='Anime_'+mesh.name;
    next.matrix.copy(worldToRoot);next.matrix.decompose(next.position,next.quaternion,next.scale);next.frustumCulled=false;
    next.userData.bijouCleanNormals=true;next.userData.bijouAnimeHead=true;
    next.userData.bijouIris=/EyeIris|EyeHighlight|EyeExtra/.test(name);
    next.userData.bijouSurface=fringe||scalp?'hair':/SKIN/.test(name)?'skin':/Eye/.test(name)?'eye':'feature';
    if(fringe)next.userData.bijouFringe=true;
    root.add(next);next.updateWorldMatrix(true,false);next.bind(skeleton,next.matrixWorld);triangles+=indices.length/3;
  });
  const neckGeometry=new T.CylinderGeometry(.026,.040,1.490-(cut-.030),48,10,true);neckGeometry.translate(0,(1.490+cut-.030)/2,-.006);
  const np=neckGeometry.attributes.position,joints=[],weights=[];
  for(let i=0;i<np.count;i++){
    const y=np.getY(i),blend=T.MathUtils.smoothstep(y,cut,1.485);np.setZ(i,(np.getZ(i)+.006)*.84-.006);
    joints.push(headIndex,neckIndex,0,0);weights.push(blend,1-blend,0,0);
  }
  neckGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));neckGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));neckGeometry.computeVertexNormals();
  const neckMaterial=new T.MeshPhysicalMaterial({map:solidSkinMap(),roughness:.65}),bridge=new T.SkinnedMesh(neckGeometry,neckMaterial);
  bridge.name='Anime_neck';bridge.matrix.copy(worldToRoot);bridge.matrix.decompose(bridge.position,bridge.quaternion,bridge.scale);bridge.userData={bijouSurface:'skin',bijouCleanNormals:true,bijouAnimeHead:true};bridge.frustumCulled=false;
  root.add(bridge);bridge.updateWorldMatrix(true,false);bridge.bind(skeleton,bridge.matrixWorld);textures.add(neckMaterial.map);triangles+=neckGeometry.index.count/3;
  const mean=ps=>ps.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/ps.length);
  const eyes=eyePoints.map(ps=>({...mean(ps),radius:.017}));
  root.userData.bijouAnimeHead=true;
  root.userData.bijouAnimeFace={eye:(eyes[0].y+eyes[1].y)*.5,eyeX:Math.abs(eyes[0].x),mouth:mean(mouthPoints).y,chin:Math.min(...facePoints.map(p=>p.y)),eyes};
  disposeSource(source.scene,textures);
  return triangles;
}
function neutralHairMap(source){
  const c=document.createElement('canvas');c.width=source.image.width;c.height=source.image.height;
  const ctx=c.getContext('2d');ctx.drawImage(source.image,0,0);const image=ctx.getImageData(0,0,c.width,c.height);
  const tint=new T.Color('#39303e'),pixel=new T.Color();
  for(let i=0;i<image.data.length;i+=4){const light=Math.max(...image.data.subarray(i,i+3))/255;pixel.setRGB(light,light,light,T.SRGBColorSpace).multiply(tint).convertLinearToSRGB();image.data[i]=pixel.r*255;image.data[i+1]=pixel.g*255;image.data[i+2]=pixel.b*255;}
  ctx.putImageData(image,0,0);const map=new T.CanvasTexture(c);map.flipY=source.flipY;map.colorSpace=T.SRGBColorSpace;return map;
}
function solidSkinMap(){
  const c=document.createElement('canvas');c.width=c.height=4;const ctx=c.getContext('2d');ctx.fillStyle='#f1d4bd';ctx.fillRect(0,0,4,4);
  const map=new T.CanvasTexture(c);map.flipY=false;map.colorSpace=T.SRGBColorSpace;return map;
}
function faceSkinMap(source){
  const c=document.createElement('canvas');c.width=source.image.width;c.height=source.image.height;const ctx=c.getContext('2d');ctx.drawImage(source.image,0,0);
  const image=ctx.getImageData(0,0,c.width,c.height),tint=new T.Color('#efdfd4'),pixel=new T.Color();
  for(let i=0;i<image.data.length;i+=4){pixel.setRGB(image.data[i]/255,image.data[i+1]/255,image.data[i+2]/255,T.SRGBColorSpace).multiply(tint).convertLinearToSRGB();image.data[i]=pixel.r*255;image.data[i+1]=pixel.g*255;image.data[i+2]=pixel.b*255;}
  ctx.putImageData(image,0,0);const map=new T.CanvasTexture(c);map.flipY=source.flipY;map.colorSpace=T.SRGBColorSpace;return map;
}
function amberIrisMap(source){
  const c=document.createElement('canvas');c.width=source.image.width;c.height=source.image.height;
  const ctx=c.getContext('2d');ctx.drawImage(source.image,0,0);const image=ctx.getImageData(0,0,c.width,c.height);
  for(let i=0;i<image.data.length;i+=4){
    const rgb=image.data.subarray(i,i+3),hi=Math.max(...rgb),lo=Math.min(...rgb);
    if(hi-lo>12&&hi>25){image.data[i]=hi*.86;image.data[i+1]=hi*.47;image.data[i+2]=hi*.30;}
  }
  ctx.putImageData(image,0,0);const map=new T.CanvasTexture(c);map.flipY=source.flipY;map.colorSpace=T.SRGBColorSpace;return map;
}
