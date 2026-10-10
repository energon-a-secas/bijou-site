import * as T from './vendor/avatar-engine.js';
import { NAIL_COLORS, SHAPE_KEYS } from './body-shape.js';
import { disposeGroup } from './avatar-shapes.js';

// Nail plates sample the actual fingertip surface and share its skin weights.
// Rigid attachments would lift away from the skin when the fingers curl.
export function createNails(bones,body,rest,skinning){
  let meshes=[],key='';
  function build(config){
    const next=[config.nailLength,config.nailShape,config.nailColor,...SHAPE_KEYS.map(k=>config[k])].join('|');if(next===key)return;key=next;
    meshes.forEach(disposeGroup);meshes=[];
    const color=NAIL_COLORS.find(c=>c.id===config.nailColor)?.color||NAIL_COLORS[0].color,length=.009+(config.nailLength??.15)*.014;
    const attrs=body.geometry.attributes;
    for(const side of ['left','right'])for(const finger of ['Thumb','Index','Middle','Ring','Little']){
      const id=`${side}${finger}Distal`,bone=bones[id];if(!bone)continue;
      const origin=rest[id],direction=(bone.children.find(o=>o.isBone)?.position||bone.position).clone().normalize();
      const up=new T.Vector3(0,1,0),across=new T.Vector3().crossVectors(direction,up).normalize(),samples=[];
      const width=finger==='Thumb'?.0052:finger==='Little'?.003:.0038;
      for(let i=0;i<attrs.position.count;i++){
        const p=new T.Vector3().fromBufferAttribute(attrs.position,i).sub(origin),along=p.dot(direction),cross=p.dot(across);
        if(along<-.002||along>.036||Math.abs(cross)>.01||Math.abs(p.y)>.014||attrs.normal.getY(i)<.15)continue;
        samples.push({i,along,cross,height:p.y});
      }
      if(!samples.length)continue;
      const rows=14,cols=12,pos=[],uv=[],indices=[],joints=[],weights=[];
      for(let j=0;j<=rows;j++){
        const t=j/rows,shape=config.nailShape;
        const tip=shape==='square'?1:shape==='almond'?Math.sqrt(Math.max(.025,1-t*t)):.35+.65*Math.sin(Math.PI*(.18+.70*t));
        for(let i=0;i<=cols;i++){
          const u=i/cols*2-1,along=.009+t*length,cross=u*width*tip;
          const nearby=samples.map(s=>({...s,d:(s.along-Math.min(.023,along))**2+(s.cross-cross)**2})).sort((a,b)=>a.d-b.d).slice(0,3);
          const total=nearby.reduce((n,s)=>n+1/Math.max(1e-7,s.d),0),influences=new Map();let height=0;
          for(const s of nearby){
            const w=1/Math.max(1e-7,s.d)/total;height+=s.height*w;
            for(let k=0;k<4;k++){const joint=attrs.skinIndex.array[s.i*4+k];influences.set(joint,(influences.get(joint)||0)+attrs.skinWeight.array[s.i*4+k]*w);}
          }
          const p=origin.clone().addScaledVector(direction,along).addScaledVector(across,cross).addScaledVector(up,height+.00035);
          pos.push(p.x,p.y,p.z);uv.push(i/cols,t);
          const pairs=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4);while(pairs.length<4)pairs.push([0,0]);const sum=pairs.reduce((n,p)=>n+p[1],0);
          joints.push(...pairs.map(p=>p[0]));weights.push(...pairs.map(p=>p[1]/sum));
          if(j<rows&&i<cols){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
        }
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(indices);g.computeVertexNormals();
      const mat=new T.MeshPhysicalMaterial({color,roughness:.25,clearcoat:.65,clearcoatRoughness:.22,side:T.DoubleSide});
      const mesh=body.clone(false);mesh.name='nails';mesh.geometry=g;mesh.material=mat;mesh.userData={region:'body'};mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
      body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);skinning.attach(mesh);meshes.push(mesh);
    }
  }
  return {build};
}
