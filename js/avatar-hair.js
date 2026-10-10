import * as T from './vendor/avatar-engine.js';
import { HAIR, byId } from './looks.js';
import { toon } from './avatar-materials.js';
import { ball, tube, disposeGroup } from './avatar-shapes.js';
import { createHairMotion } from './avatar-hair-motion.js';
import { smoothNormals } from './avatar-surface.js';
import { applyFinish } from './avatar-finish.js';

let strandMap;
function hairMaterial(color,style){
  if(!strandMap){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,256,256);
    for(let x=0;x<256;x++){
      const light=220+Math.sin(x*.25)*8+Math.sin(x*.087)*7;
      ctx.fillStyle=`rgb(${light},${light},${light})`;ctx.fillRect(x,0,1,256);
    }
    const g=ctx.createLinearGradient(0,0,0,256);g.addColorStop(0,'#ffffff08');g.addColorStop(.25,'#ffffff70');g.addColorStop(.38,'#ffffff00');g.addColorStop(1,'#51404a20');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
    strandMap=new T.CanvasTexture(c);strandMap.colorSpace=T.SRGBColorSpace;
  }
  return applyFinish(new T.MeshStandardMaterial({color,map:style==='anime2d'?null:strandMap,side:T.DoubleSide,roughness:.62}),style,'hair');
}

/** A tapered, convex lock: rounded across its width, with a fine pointed tip. */
function lock(group,points,width,depth,material){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const rows=32,sides=12,pos=[],uv=[],ind=[],hairT=[],tangents=[];
  const side=new T.Vector3(),front=new T.Vector3(),ref=new T.Vector3(0,0,1);
  for(let j=0;j<=rows;j++){
    const t=j/rows,p=curve.getPoint(t),tangent=curve.getTangent(t);
    side.crossVectors(tangent,ref).normalize();front.crossVectors(side,tangent).normalize();
    const taper=Math.max(.015,Math.pow(Math.sin((.11+.89*t)*Math.PI),.45));
    for(let i=0;i<=sides;i++){
      const a=i/sides*Math.PI*2;
      const v=p.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(front,Math.sin(a)*depth*taper);
      pos.push(v.x,v.y,v.z);uv.push(i/sides,t);hairT.push(t);
      const derivative=curve.getPoint(Math.min(1,t+.002)).sub(curve.getPoint(Math.max(0,t-.002))).multiplyScalar(1/(t===0||t===1?.002:.004));tangents.push(derivative.x,derivative.y,derivative.z);
      if(j<rows&&i<sides){const n=j*(sides+1)+i;ind.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2)}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('bjHairT',new T.Float32BufferAttribute(hairT,1));geo.setAttribute('bjHairTangent',new T.Float32BufferAttribute(tangents,3));geo.setIndex(ind);smoothNormals(geo);
  const mesh=new T.Mesh(geo,material);mesh.frustumCulled=false;group.add(mesh);group.userData.motion?.add(mesh,curve);return mesh;
}

export function createHair(meshes,bones,rest){
  let additions=null;const motion=createHairMotion(bones,rest);
  function build(head,hasHat,finish){
    const style=head.back;
    for(const mesh of meshes){
      const pos=mesh.geometry.attributes.position,base=mesh.userData.basePositions;
      const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
      const bangs=/HAIR_02/.test(mat.name);
      for(let i=0;i<pos.count;i++){
        let x=base[i*3],y=base[i*3+1],z=base[i*3+2];
        if(bangs){
          const t=Math.max(0,(1.69-y)/.11);
          if(head.front==='swept'){x+=.032*t;y+=.022*t*Math.max(0,-x*10);}
          if(head.front==='split'){x+=Math.sign(x||.01)*.018*t;y+=.025*t*(1-Math.min(1,Math.abs(x)/.09));}
          if(head.front==='messy'||head.front==='wispy'){
            y+=.008*t*Math.sin(x*82);y-=t*.044*Math.exp(-Math.pow((x-.008)/.021,2));
          }
        }
        pos.setXYZ(i,x,y,z);
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
    if(additions)disposeGroup(additions);
    motion.clear();motion.configure(head);
    additions=new T.Group();additions.name='bijou-hair';additions.userData.region='head';additions.position.copy(rest.head).multiplyScalar(-1);bones.head.add(additions);
    additions.userData.motion=motion;
    const color=byId(HAIR,head.hair),material=hairMaterial(color.base,finish);
    const crown=new T.Mesh(new T.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2),material);
    crown.position.set(0,1.611,.014);crown.scale.set(.12,.13,.12);additions.add(crown);
    const short=['ponytail','twintails','buns','braid'].includes(style);
    const end=style==='pixie'?1.55:short?1.48:style==='bob'?1.445:1.398;
    // A continuous back volume prevents see-through gaps between sculpted locks.
    const hem=style==='long'||style==='wavy'?1.10:end+.018;
    const rows=32,cols=40,pos=[],uv=[],idx=[],ts=[],tangents=[];
    const shellCurve=new T.CatmullRomCurve3([new T.Vector3(0,1.70,.07),new T.Vector3(0,1.58,.123),new T.Vector3(0,hem,.115)]);
    for(let j=0;j<=rows;j++){
      const t=j/rows,p=shellCurve.getPoint(t),radius=.091+.027*Math.sin(Math.min(1,t*3)*Math.PI/2),rz=.105;
      const tangent=shellCurve.getTangent(t).multiplyScalar(1.70-hem);
      for(let i=0;i<=cols;i++){
        const a=(i/cols-.5)*3.3;
        pos.push(Math.sin(a)*radius,p.y,Math.cos(a)*rz+.008);uv.push(i/cols,t);ts.push(t);tangents.push(tangent.x,tangent.y,tangent.z);
        if(j<rows&&i<cols){const n=j*(cols+1)+i;idx.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
      }
    }
    const shellGeometry=new T.BufferGeometry();shellGeometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));shellGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shellGeometry.setAttribute('bjHairT',new T.Float32BufferAttribute(ts,1));shellGeometry.setAttribute('bjHairTangent',new T.Float32BufferAttribute(tangents,3));shellGeometry.setIndex(idx);shellGeometry.computeVertexNormals();
    const shell=new T.Mesh(shellGeometry,material);shell.frustumCulled=false;additions.add(shell);motion.add(shell,shellCurve);
    // Layered, rounded back hair replaces all source tied-hair geometry.
    for(let i=-3;i<=3;i++){
      const x=i*.03,z=.125-Math.abs(i)*.005;
      lock(additions,[[x*.3,1.72,.044],[x*1.04,1.64,z],[x*1.12,1.50,z+.013],[x*.94,end+.009*Math.abs(i),z-.005]],.029,.012,material);
    }
    for(const s of [-1,1])for(let i=0;i<4;i++){
      const z=-.008+i*.036,x=s*(.113-i*.006);
      const curl=(style==='wavybob'||style==='wavy')?.020:0;
      lock(additions,[[s*(.06-i*.011),1.716,.028+i*.015],[x,1.63,z],[x+s*.008,1.50,z+.008],[x-s*.006+s*curl,end+i*.006,z-.002]],.027,.011,material);
    }
    if(style!=='pixie')for(const s of [-1,1])lock(additions,[[s*.072,1.683,-.066],[s*.108,1.576,-.060],[s*.119,1.477,-.052],[s*.106,end-.003,-.037]],.015,.008,material);
    if(style==='buns')for(const s of [-1,1]){
      ball(additions,s*.126,1.668,.052,.055,.055,.049,material);
      for(let k=0;k<4;k++)tube(additions,[[s*.127,1.714,.026+k*.013],[s*.166,1.667,.026+k*.013],[s*.124,1.625,.026+k*.013]],.003,color.shadow);
    }
    if(['ponytail','twintails','halfup'].includes(style)){
      const sides=style==='twintails'?[-1,1]:[0];
      for(const s of sides){
        const x=s*.126,z=s?.055:.14;
        for(let i=0;i<5;i++){
          const spread=(i-2)*.017;
          lock(additions,[[x,1.68,z],[x+s*.065+spread,1.53,z+.055],[x+s*.044+spread,1.29,z+.015],[x+s*.074+spread*.4,1.13+i*.012,z-.028]],.029,.012,material);
        }
      }
    }
    if(style==='long'||style==='wavy'){
      for(const s of [-1,1])for(let i=0;i<4;i++){
        const x=s*(.094+i*.009),z=.041+i*.025;
        lock(additions,[[x,1.63,z],[s*(.13+i*.013),1.43,z+.02],[s*(.12+i*.018),1.22,z],[s*(style==='wavy'?.17:.145)+i*.003*s,1.065+i*.016,z-.014]],.022,.009,material);
      }
    }
    if(style==='braid'){
      lock(additions,[[.07,1.68,.10],[.15,1.50,.07],[.16,1.42,-.04],[.145,1.31,-.10]],.043,.023,material);
      for(let j=0;j<8;j++)for(const s of [-1,1]){
        const y=1.37-j*.035,x=.149+Math.sin(j*.7)*.013;
        lock(additions,[[x+s*.02,y,-.107],[x-s*.005,y-.024,-.122],[x-s*.021,y-.037,-.11]],.017,.012,material);
      }
      lock(additions,[[.14,1.095,-.11],[.154,1.047,-.115],[.148,1.014,-.118]],.02,.01,material);
    }
    if(style==='pixie')for(const s of [-1,1])for(let i=0;i<3;i++)lock(additions,[[s*.07,1.715,.025+i*.035],[s*.12,1.65,.022+i*.04],[s*.132,1.565-i*.012,.015+i*.036]],.025,.008,material);
    if(head.ahoge&&!hasHat)lock(additions,[[.015,1.72,0],[.02,1.802,0],[.066,1.816,0],[.075,1.778,0]],.008,.004,material);
  }
  return {build,motion};
}
