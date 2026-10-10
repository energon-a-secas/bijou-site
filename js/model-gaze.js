import * as T from './vendor/avatar-engine.js';
import { cleanGaze } from './model-persona.js';
import { smooth } from './model-shape.js';
import { createEyelids } from './model-eyelids.js';

export function eyeOffset(x,y,eye,gazeX,gazeY,blink){
  const u=(x-eye.x)/.027,v=(y-eye.y)/.017,r=Math.hypot(u,v);
  const follow=1-smooth(.48,1.45,r),close=1-smooth(.78,1.5,r);
  return [gazeX*.006*follow,gazeY*.004*follow*(1-blink)-(y-eye.y)*blink*.965*close,0];
}
export function blinkAt(time){const phase=time%4.7;return phase>3.45&&phase<3.67?Math.sin((phase-3.45)/.22*Math.PI)**2:0;}
function eyeAnchors(sculpt){
  if(sculpt.eyeAnchors)return sculpt.eyeAnchors;
  if(sculpt.gazeAnchors)return sculpt.gazeAnchors;
  const neck=sculpt.field.landmarks.neck,eyes=[];
  for(const side of [-1,1]){
    const points=[];
    for(const record of sculpt.records)for(let i=0;i<record.masks.length;i++){
      const x=record.points[i*3],y=record.points[i*3+1],z=record.points[i*3+2],[r,g,b]=record.surface[i].color;
      if(side*x<.02||side*x>.066||y<neck+.155||y>neck+.198||z<.05)continue;
      if(g<r*.65&&b<r*.9&&r>.09&&r<.85)points.push([x,y,z]);
    }
    const median=k=>points.map(p=>p[k]).sort((a,b)=>a-b)[Math.floor(points.length/2)];
    eyes.push(points.length>8?{x:median(0),y:median(1),z:median(2)}:{x:side*.043,y:neck+.176,z:.08});
  }
  return eyes;
}
export function createModelGaze(sculpt){
  let settings=cleanGaze(),entries=[],pose=null,headBase=null,current=[0,0],target=[0,0],clock=0,last='',blinkOverride=0;
  const anchors=eyeAnchors(sculpt),head=sculpt.bones.get('Head')?.node,normal=new T.Vector3(),world=new T.Vector3(),jacobian=new T.Matrix3(),tangent=new T.Vector3(),tangentJacobian=new T.Matrix3();
  const eyelids=createEyelids(sculpt,anchors);
  const independent=anchors.map(a=>a.bone===undefined?null:sculpt.records.find(r=>r.node.userData.bijouSurface==='eye')?.node.skeleton.bones[a.bone]);
  let eyeBase=[];
  function restoreHead(){if(headBase&&head){head.quaternion.copy(headBase);headBase=null;head.updateWorldMatrix(false,true);}}
  function capture(){
    restoreHead();eyelids.fit();entries=[];last='';
    eyeBase=independent.map(b=>b?.quaternion.clone());
    for(const r of sculpt.records){
      if(sculpt.eyeAnchors)continue;
      if((r.node.userData.bijouSurface==='eye'&&!r.node.geometry.attributes.studyBlinkL)||['hair','cloth'].includes(r.node.userData.bijouSurface))continue;
      const p=r.node.geometry.attributes.position,n=r.node.geometry.attributes.normal,matrix=r.node.matrixWorld.clone(),inverse=matrix.clone().invert();
      const normalWorld=new T.Matrix3().getNormalMatrix(matrix),normalLocal=new T.Matrix3().getNormalMatrix(inverse),directionWorld=new T.Matrix3().setFromMatrix4(matrix),tangentLocal=new T.Matrix3().setFromMatrix4(inverse),vertices=[],t=r.node.geometry.attributes.tangent;
      if(r.node.geometry.attributes.studyBlinkL){
        const g=r.node.geometry.attributes;
        for(let i=0;i<p.count;i++){
          const rest=Array.from(r.points.subarray(i*3,i*3+3)),mapped=sculpt.mapFacePoint(...rest),axes=[0,1,2].map(k=>{const q=[...rest];q[k]+=.0001;return new T.Vector3().fromArray(sculpt.mapFacePoint(...q)).sub(new T.Vector3().fromArray(mapped)).multiplyScalar(10000);});
          const blink=[g.studyBlinkL,g.studyBlinkR].map(a=>{const d=new T.Vector3().fromBufferAttribute(a,i),q=rest.map((v,k)=>v+d.getComponent(k));return new T.Vector3().fromArray(sculpt.mapFacePoint(...q)).sub(new T.Vector3().fromArray(mapped));});
          const normalTransform=new T.Matrix3().set(axes[0].x,axes[1].x,axes[2].x,axes[0].y,axes[1].y,axes[2].y,axes[0].z,axes[1].z,axes[2].z).invert().transpose();
          const blinkNormals=[g.studyBlinkNormalL,g.studyBlinkNormalR].map(a=>new T.Vector3().fromBufferAttribute(a,i).applyMatrix3(normalTransform));
          vertices.push({id:i,authored:true,iris:r.node.userData.bijouIris,axisX:axes[0],axisY:axes[1],blink,blinkNormals,point:new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix),normal:new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalWorld).normalize()});
        }
        entries.push({r,vertices,inverse,normalLocal,tangentLocal});continue;
      }
      for(let i=0;i<p.count;i++){
        const x=r.points[i*3],y=r.points[i*3+1],z=r.points[i*3+2],eye=anchors[x<0?0:1];
        if(Math.abs(x-eye.x)>.046||Math.abs(y-eye.y)>.032||z<.045||z>.108-Math.abs(x)*.25)continue;
        const mapped=sculpt.mapFacePoint(x,y,z),axisX=sculpt.mapFacePoint(x+.0001,y,z).map((v,k)=>(v-mapped[k])/.0001),axisY=sculpt.mapFacePoint(x,y+.0001,z).map((v,k)=>(v-mapped[k])/.0001);
        vertices.push({id:i,x,y,eye,axisX,axisY,influence:sculpt.eyeAnchors?1:1-smooth(.084,.097,z),point:new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix),normal:new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalWorld).normalize(),tangent:t?new T.Vector3().fromBufferAttribute(t,i).applyMatrix3(directionWorld).normalize():null,w:t?.getW(i)});
      }
      entries.push({r,vertices,inverse,normalLocal,tangentLocal});
    }
  }
  function set(value){restoreHead();settings=cleanGaze(value);last='';current=[settings.x,settings.y];}
  function update(dt,disabled=false,forcedTime){
    if(forcedTime!==undefined)clock=forcedTime;else clock+=Math.min(.05,dt);
    const desired=settings.mode==='animated'&&settings.follow&&!disabled?target:[settings.x,settings.y],alpha=1-Math.exp(-Math.max(0,dt)*12);
    current=current.map((v,i)=>disabled||forcedTime!==undefined?desired[i]:v+(desired[i]-v)*alpha);
    const expression=sculpt.appearance.expression||'neutral',automatic=settings.blink&&!disabled?blinkAt(clock):0;
    blinkOverride=Math.max(0,blinkOverride-dt);
    const blink=Math.max(automatic,blinkOverride>0?Math.sin(Math.PI*(1-blinkOverride/.22))**2:0),blinks=[expression==='wink'?1:expression==='serene'?.30:blink,expression==='serene'?.30:blink];
    pose={x:current[0],y:current[1],blinks,active:settings.mode==='animated'};
    eyelids.set(settings.mode==='animated'||['wink','serene'].includes(expression)?blinks:[0,0]);
    const signature=JSON.stringify([settings.mode,...current.map(v=>v.toFixed(5)),...blinks.map(v=>v.toFixed(5))]);let changed=last!==signature;
    if(changed){
      last=signature;
      independent.forEach((b,i)=>{if(!b)return;b.quaternion.copy(eyeBase[i]);const parent=b.parent.getWorldQuaternion(new T.Quaternion()),q=new T.Quaternion().setFromEuler(new T.Euler(-current[1]*.24,current[0]*.32,0,'YXZ'));if(settings.mode==='animated')b.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));b.updateWorldMatrix(false,true);});
      for(const {r,vertices,inverse,normalLocal,tangentLocal}of entries){
        const p=r.node.geometry.attributes.position,n=r.node.geometry.attributes.normal,t=r.node.geometry.attributes.tangent;
        for(const v of vertices){
          if(v.authored){
            const b=settings.mode==='animated'||['wink','serene'].includes(expression)?blinks:[0,0];
            world.copy(v.point).addScaledVector(v.blink[0],b[0]).addScaledVector(v.blink[1],b[1]);
            if(v.iris&&settings.mode==='animated')world.addScaledVector(v.axisX,current[0]*.006*(1-Math.max(...b))).addScaledVector(v.axisY,current[1]*.004*(1-Math.max(...b)));
            world.applyMatrix4(inverse);p.setXYZ(v.id,world.x,world.y,world.z);
            normal.copy(v.normal).addScaledVector(v.blinkNormals[0],b[0]).addScaledVector(v.blinkNormals[1],b[1]).applyMatrix3(normalLocal).normalize();n.setXYZ(v.id,normal.x,normal.y,normal.z);continue;
          }
          const side=v.x<0?0:1,b=(settings.mode==='animated'||['wink','serene'].includes(expression)?blinks[side]:0)*v.influence,gx=(settings.mode==='animated'&&!sculpt.eyeAnchors?current[0]:0)*v.influence,gy=(settings.mode==='animated'&&!sculpt.eyeAnchors?current[1]:0)*v.influence;
          const delta=eyeOffset(v.x,v.y,v.eye,gx,gy,b),dx=eyeOffset(v.x+.0001,v.y,v.eye,gx,gy,b),dy=eyeOffset(v.x,v.y+.0001,v.eye,gx,gy,b);
          world.copy(v.point);for(let k=0;k<3;k++)world.setComponent(k,world.getComponent(k)+v.axisX[k]*delta[0]+v.axisY[k]*delta[1]);world.applyMatrix4(inverse);p.setXYZ(v.id,world.x,world.y,world.z);
          jacobian.set(1+(dx[0]-delta[0])/.0001,(dy[0]-delta[0])/.0001,0,(dx[1]-delta[1])/.0001,1+(dy[1]-delta[1])/.0001,0,0,0,1);tangentJacobian.copy(jacobian);jacobian.invert().transpose();
          normal.copy(v.normal).applyMatrix3(jacobian).normalize();
          if(t&&v.tangent){tangent.copy(v.tangent).applyMatrix3(tangentJacobian);tangent.addScaledVector(normal,-tangent.dot(normal)).applyMatrix3(tangentLocal).normalize();t.setXYZW(v.id,tangent.x,tangent.y,tangent.z,v.w);}
          normal.applyMatrix3(normalLocal).normalize();n.setXYZ(v.id,normal.x,normal.y,normal.z);
        }
        p.needsUpdate=true;n.needsUpdate=true;if(t)t.needsUpdate=true;
      }
    }
    if(head&&settings.mode==='animated'&&settings.headFollow&&!disabled){
      headBase=head.quaternion.clone();const parentRotation=head.parent.getWorldQuaternion(new T.Quaternion()),delta=new T.Quaternion().setFromEuler(new T.Euler(-current[1]*.09,current[0]*.15,0,'YXZ'));
      delta.premultiply(parentRotation.clone().invert()).multiply(parentRotation);head.quaternion.premultiply(delta);head.updateWorldMatrix(false,true);changed=true;
    }
    return changed;
  }
  capture();
  return {capture,set,update,restoreHead,setSurface(id,style){eyelids.setSurface?.(id,style);},get lidMeshes(){return eyelids.meshes||[];},dispose(){restoreHead();eyelids.dispose();},setTarget(x,y){target=[Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y))];},blink(){blinkOverride=.22;},reset(){restoreHead();clock=0;blinkOverride=0;current=[settings.x,settings.y];last='';update(0,true);},get settings(){return {...settings};},get diagnostics(){return {anchors,independentEyes:independent.filter(Boolean).length,vertices:entries.reduce((n,e)=>n+e.vertices.length,0),...pose};}};
}
