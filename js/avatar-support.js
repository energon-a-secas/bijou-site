import * as T from './vendor/avatar-engine.js';
import { solveLeg } from './pose-support.js';

// Grounded leg IK and measured seat contact in the avatar's model coordinates.
export function createSupport(vrm,bones,rest,skin,wardrobe,skinning){
  const mesh=skin[0],hipBase=new T.Vector3(),v=new T.Vector3(),axis=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion(),matrix=new T.Matrix4();
  const feet={},seat=[];let baseOffset=.033,seatHeight=null,lastPlant=0,lastSeat=0;
  function configure(){
    hipBase.copy(bones.hips.position);seat.length=0;
    const p=mesh.geometry.attributes.position,r=mesh.geometry.attributes.bjRest;
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1,sole=[],boot=[];
      let minimum=Infinity;
      for(let i=0;i<p.count;i++)if(p.getY(i)<.125&&p.getX(i)*sign>0)minimum=Math.min(minimum,p.getY(i));
      for(let i=0;i<p.count;i++)if(p.getY(i)<minimum+.006&&p.getX(i)*sign>0)sole.push(i);
      for(const group of wardrobe.groups)if(group.name==='wear-shoes'&&group.userData.bone===`${side}Foot`){
        group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,indices=[];let y=Infinity;
          for(let i=0;i<a.count;i++)y=Math.min(y,a.getY(i));
          for(let i=0;i<a.count;i++)if(a.getY(i)<y+.002)indices.push(i);
          boot.push({mesh:o,indices});
        });
      }
      if(boot.length)minimum=Math.min(...boot.flatMap(entry=>entry.indices.map(i=>entry.mesh.geometry.attributes.position.getY(i))));
      feet[side]={sole,boot,minimum,hip:[],knee:[],ankle:[]};
    }
    baseOffset=Math.min(feet.left.minimum,feet.right.minimum);
    for(let i=0;i<r.count;i++)if(r.getY(i)>.895&&r.getY(i)<1.03&&Math.abs(r.getX(i))<.13&&r.getZ(i)>.025)seat.push(i);
  }
  function rawPosition(bone,out){bone.getWorldPosition(out);return vrm.scene.worldToLocal(out);}
  function orient(bone,restAxis,direction){
    q.setFromUnitVectors(axis.copy(restAxis).normalize(),v.fromArray(direction).normalize());
    matrix.copy(bone.parent.matrixWorld).invert().multiply(vrm.scene.matrixWorld);parentQ.setFromRotationMatrix(matrix);
    bone.quaternion.copy(q.premultiply(parentQ));bone.updateWorldMatrix(false,true);
  }
  function seatBottom(){let y=Infinity;for(const i of seat){skinning.point(mesh,i,v);mesh.localToWorld(v);y=Math.min(y,v.y);}return y;}
  function soleBottom(side){
    const f=feet[side];let y=Infinity;
    if(f.boot.length){for(const {mesh:o,indices} of f.boot)for(const i of indices){v.fromBufferAttribute(o.geometry.attributes.position,i);o.localToWorld(v);y=Math.min(y,v.y);}}
    else for(const i of f.sole){skinning.point(mesh,i,v);mesh.localToWorld(v);y=Math.min(y,v.y);}
    return y;
  }
  function update(frame,character,poufTop=null){
    const plant=frame.root.airborne?0:(frame.bones.root?.plant??1),seated=frame.bones.root?.seat??0;
    lastPlant=plant;lastSeat=seated;seatHeight=poufTop;
    bones.hips.position.copy(hipBase);bones.hips.updateWorldMatrix(true,true);
    for(let pass=0;pass<(seated>.995?2:1);pass++){
      if(seated>0&&poufTop!==null){
        skinning.update();const bottom=seatBottom();
        if(Number.isFinite(bottom))character.position.y+=(poufTop-bottom)*seated;
        character.updateWorldMatrix(true,true);
      }
      if(plant<.0001)break;
      const ground=-character.position.y/character.scale.y,targets={},lengths={};
      let drop=seated>.1?0:.004;
      for(const side of ['left','right']){
        const thigh=bones[`${side}UpperLeg`],shin=bones[`${side}LowerLeg`],foot=bones[`${side}Foot`];
        const p=rawPosition(foot,new T.Vector3()).sub(rest.hips).applyAxisAngle(axis.set(0,0,1),-bones.hips.rotation.z).add(rest.hips);
        targets[side]=[p.x,ground+rest[`${side}Foot`].y-feet[side].minimum,p.z];
        lengths[side]=[shin.position.length(),foot.position.length()];
        const h=rawPosition(thigh,new T.Vector3()),horizontal=Math.hypot(h.x-p.x,h.z-p.z),reach=lengths[side][0]+lengths[side][1]-.001;
        drop=Math.max(drop,h.y-targets[side][1]-Math.sqrt(Math.max(.001,reach*reach-horizontal*horizontal)));
      }
      if(seated<.1){bones.hips.position.y-=Math.max(0,drop)*plant;bones.hips.updateWorldMatrix(false,true);}
      for(const side of ['left','right']){
        const thigh=bones[`${side}UpperLeg`],shin=bones[`${side}LowerLeg`],foot=bones[`${side}Foot`],h=rawPosition(thigh,new T.Vector3()).toArray();
        const pole=[h[0],h[1]-.28,h[2]-.45],solution=solveLeg(h,targets[side],lengths[side],pole);
        const thighQ=thigh.quaternion.clone(),shinQ=shin.quaternion.clone(),footQ=foot.quaternion.clone();
        orient(thigh,shin.position,solution.knee.map((n,i)=>n-h[i]));thigh.quaternion.slerp(thighQ,1-plant);thigh.updateWorldMatrix(false,true);
        orient(shin,foot.position,solution.ankle.map((n,i)=>n-solution.knee[i]));shin.quaternion.slerp(shinQ,1-plant);shin.updateWorldMatrix(false,true);
        matrix.copy(foot.parent.matrixWorld).invert().multiply(vrm.scene.matrixWorld);parentQ.setFromRotationMatrix(matrix);
        const screen=side==='left'?'R':'L',sign=side==='left'?1:-1;
        q.setFromAxisAngle(axis.set(0,1,0),-sign*(.05+(frame.bones[`foot${screen}`]?.a||0)*.005));
        foot.quaternion.copy(parentQ).multiply(q).slerp(footQ,1-plant);foot.updateWorldMatrix(false,true);
        feet[side].hip=h;feet[side].knee=rawPosition(shin,new T.Vector3()).toArray();feet[side].ankle=rawPosition(foot,new T.Vector3()).toArray();
      }
    }
  }
  return {configure,update,get baseOffset(){return baseOffset;},get diagnostics(){
    return {plant:lastPlant,seat:lastSeat,soles:{left:soleBottom('left'),right:soleBottom('right')},seatGap:seatHeight===null||lastSeat<.99?null:seatBottom()-seatHeight,
      legs:Object.fromEntries(Object.entries(feet).map(([side,f])=>[side,{hip:f.hip,knee:f.knee,ankle:f.ankle}]))};
  }};
}
