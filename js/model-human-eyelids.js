import * as T from './vendor/avatar-engine.js';
import {applyModelFinish} from './model-finish.js';

// Separate spherical eyes keep their volume while authored skin-colored covers
// close over the visible opening. No neighboring face vertices are collapsed.
export function createHumanEyelids(sculpt,eyes){
  const head=sculpt.bones.get('Head').node,group=new T.Group(),caps=[],lines=[];
  group.name='Bijou_anatomical_eyelids';head.add(group);group.matrixAutoUpdate=false;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#ecc2ac';ctx.fillRect(0,0,64,64);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  let material=new T.MeshPhysicalMaterial({map,roughness:.6,specularIntensity:.45,side:T.DoubleSide,fog:false}),last=[0,0],signature='';
  const lash=new T.MeshBasicMaterial({color:'#493642'});
  for(const [side,eye]of eyes.entries()){
    for(const upper of [true,false]){
      const cols=32,rows=8,geometry=new T.BufferGeometry(),count=(cols+1)*(rows+1),index=[],uv=[];
      geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(count*3),3));
      geometry.setAttribute('studyRest',new T.Float32BufferAttribute(new Float32Array(count*3),3));
      for(const [name,value]of [['studySurface',1],['studyHair',0],['studyEye',0]])geometry.setAttribute(name,new T.Float32BufferAttribute(new Float32Array(count).fill(value),1));
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        uv.push(i/cols,j/rows);if(j<rows&&i<cols){const n=j*(cols+1)+i;index.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
      }
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);
      const mesh=new T.Mesh(geometry,material);mesh.name=(upper?'Upper':'Lower')+'_lid_'+side;mesh.frustumCulled=false;group.add(mesh);caps.push({mesh,eye,side,upper,cols,rows});
    }
    const curve=new T.CatmullRomCurve3(Array.from({length:9},(_,i)=>{
      const u=i/4-1,x=u*eye.sphereRadius*.95,y=-.0015-.0008*u*u,z=Math.sqrt(Math.max(0,eye.sphereRadius**2-x*x-y*y));
      return new T.Vector3(eye.x+x,eye.y+y,eye.z+z+.001);
    }));
    const line=new T.Mesh(new T.TubeGeometry(curve,32,.0005,6,false),lash);line.name='Closed_lash_'+side;group.add(line);lines.push({mesh:line,side,base:line.geometry.attributes.position.array.slice()});
  }
  function set(blinks){
    const next=blinks.join(',');if(signature===next)return;signature=next;
    last=[...blinks];
    for(const {mesh,eye,side,upper,cols,rows}of caps){
      const b=blinks[side],p=mesh.geometry.attributes.position,rest=mesh.geometry.attributes.studyRest;mesh.visible=b>.002;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const u=i/cols*2-1,x=u*eye.sphereRadius*.95,ellipse=Math.sqrt(Math.max(0,1-u*u));
        const open=(upper?.0070:-.0060)*ellipse,closed=(-.0015-.0008*u*u)*ellipse,y=open+(closed-open)*b*j/rows;
        const z=Math.sqrt(Math.max(0,eye.sphereRadius**2-x*x-y*y)),raw=[eye.x+x,eye.y+y,eye.z+z+.0008],at=j*(cols+1)+i;
        rest.setXYZ(at,...raw);p.setXYZ(at,...sculpt.mapFacePoint(...raw));
      }
      rest.needsUpdate=true;p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    lines.forEach(({mesh,side})=>mesh.visible=blinks[side]>.86);
  }
  function fit(){
    head.updateWorldMatrix(true,false);group.matrix.copy(head.matrixWorld).invert();group.matrix.decompose(group.position,group.quaternion,group.scale);group.matrixWorldNeedsUpdate=true;
    for(const {mesh,base}of lines){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,...sculpt.mapFacePoint(...base.subarray(i*3,i*3+3)));p.needsUpdate=true;mesh.geometry.computeBoundingSphere();}
    signature='';set(last);
  }
  fit();
  return {fit,set,get meshes(){return caps.map(c=>c.mesh);},setSurface(id,style){material.dispose();material=new T.MeshPhysicalMaterial({color:id==='clay'?'#c5b0a4':'#ffffff',map:id==='clay'?null:map,specularIntensity:.45,side:T.DoubleSide,fog:false});applyModelFinish(material,id,sculpt.faceAnchors,eyes,null,style);for(const {mesh}of caps)mesh.material=material;},dispose(){for(const {mesh}of [...caps,...lines])mesh.geometry.dispose();material.dispose();map.dispose();lash.dispose();group.removeFromParent();}};
}
