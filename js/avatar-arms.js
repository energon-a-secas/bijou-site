import * as T from './vendor/avatar-engine.js';
import { solveArm3D, bodyColliders } from './avatar-collision.js';
import { createBodyField } from './body-shape.js';
import { reachFor } from './pose-reaches.js';
import { resolvedItem } from './catalog.js';
import { shoulderMotion } from './pose-support.js';

export function createArmSolver(bones,rest){
  let field=createBodyField(),colliders=bodyColliders(field),radius=.035,chains={};
  const v=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion(),relative=new T.Matrix4();
  function configure(body,outfit,settings){
    field=createBodyField(body);
    const garment=resolvedItem(outfit.outer,settings)||resolvedItem(outfit.dress,settings)||resolvedItem(outfit.top,settings)||resolvedItem(outfit.swim,settings);
    const fit=garment?.params.fit;
    const cloth=fit?Math.min(.025,.002+.045*(fit.ease+Math.max(fit.chestEase,fit.waistEase,fit.hipEase))):outfit.outer?.includes('coat')||garment?.params.loose ? .025 : outfit.outer ? .019 : .012;
    // Reserve the entire bounded displacement, even at maximum bounce.
    colliders=bodyColliders(field,cloth+(body.bounce??.35)*.024);
    const sleeve=fit&&garment?.params.sleeve!=='none'?Math.min(.018,.002+.045*(fit.ease+fit.armEase)):['puff','wide'].includes(garment?.params.sleeve) ? .028 : (outfit.outer||outfit.dress?.includes('captain')) ? .012 : .004;
    radius=.031*(1+((body.arms??.5)-.5+(body.armsFullness??0)*.7)*.65)+sleeve;
    chains={};
  }
  function orient(bone,axis,direction){
    q.setFromUnitVectors(axis.clone().normalize(),v.fromArray(direction).normalize());
    relative.copy(bone.parent.matrixWorld).invert().multiply(bones.chest.matrixWorld);
    parentQ.setFromRotationMatrix(relative);bone.quaternion.copy(q.premultiply(parentQ));
    bone.updateWorldMatrix(false,true);
  }
  function solve(frame,dt){
    for(const [screen,side,sign] of [['L','right',1],['R','left',-1]]){
      const bone=bones[`${side}Shoulder`],r=frame.bones[`hand${screen}`];
      if(!bone||r?.tx===undefined)continue;
      const motion=shoulderMotion(rest[`${side}UpperArm`].toArray(),field.point(r.tx,r.ty,r.tz),sign);
      bone.rotation.set(0,motion.forward,motion.lift);
    }
    bones.chest.updateWorldMatrix(true,true);
    const next={};
    for(const [screen,side,sign] of [['L','right',1],['R','left',-1]]){
      const arm=bones[`${side}UpperArm`],fore=bones[`${side}LowerArm`],hand=bones[`${side}Hand`];
      const r=frame.bones[`hand${screen}`]?.tx!==undefined?frame.bones[`hand${screen}`]:reachFor('stand',screen);
      const target=field.point(r.tx,r.ty,r.tz),pole=field.point(r.px,r.py,r.pz);
      // Preserve a wave's motion without changing the elbow's bend direction.
      const wristAngle=frame.bones[`foreArm${screen}`]?.a||0;
      if(r.ty>1.63&&Math.abs(r.tx)>.23)target[0]+=sign*Math.sin(wristAngle*Math.PI/180)*.023;
      const shoulder=bones.chest.worldToLocal(arm.getWorldPosition(v)).add(rest.chest).toArray();
      const lengths=[fore.position.length(),hand.position.length()];
      const chain=solveArm3D({shoulder,target,pole,lengths,colliders,radius,side:sign,previous:chains[screen],other:screen==='R'?next.L:null,maxStep:Math.max(.008,Math.min(.055,dt*1.65))});
      orient(arm,fore.position,chain.elbow.map((n,i)=>n-shoulder[i]));
      orient(fore,hand.position,chain.hand.map((n,i)=>n-chain.elbow[i]));
      next[screen]=chain;
    }
    chains=next;
  }
  function upright(side,screen){
    const hand=bones[`${side}Hand`];
    q.setFromAxisAngle(new T.Vector3(0,0,1),screen==='L'?Math.PI/2:-Math.PI/2);
    relative.copy(hand.parent.matrixWorld).invert().multiply(bones.chest.matrixWorld);
    parentQ.setFromRotationMatrix(relative);hand.quaternion.copy(q.premultiply(parentQ));
  }
  return {configure,solve,upright,get colliders(){return colliders;},get diagnostics(){
    const actual={};
    for(const [screen,side] of [['L','right'],['R','left']]){
      actual[screen]=Object.fromEntries([['elbow','LowerArm'],['hand','Hand']].map(([key,bone])=>[key,bones.chest.worldToLocal(bones[`${side}${bone}`].getWorldPosition(new T.Vector3())).add(rest.chest).toArray()]));
    }
    return {chains,colliders,radius,actual};
  }};
}
