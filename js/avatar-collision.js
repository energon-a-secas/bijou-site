// Analytic two-bone IK with capsule/ellipsoid clearance. Pure math so the
// same solver can be exercised without WebGL or a particular animation rate.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a),unit=a=>mul(a,1/Math.max(1e-8,length(a)));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function pointClearance(p,collider,radius=0){
  const q=p.map((v,i)=>(v-collider.center[i])/(collider.radii[i]+radius));
  return (length(q)-1)*Math.min(...collider.radii);
}
function segmentClearance(a,b,colliders,radius,skip=0){
  const delta=sub(b,a),span=length(delta);let min=1;
  if(span<skip)return min;
  for(const c of colliders){
    const start=a.map((v,i)=>(v-c.center[i])/(c.radii[i]+radius));
    const direction=delta.map((v,i)=>v/(c.radii[i]+radius));
    const t=clamp(-dot(start,direction)/Math.max(1e-10,dot(direction,direction)),skip/Math.max(span,1e-8),1);
    min=Math.min(min,pointClearance(add(a,mul(delta,t)),c,radius));
  }
  return min;
}
function segmentDistance(p1,q1,p2,q2){
  const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r),b=dot(d1,d2),c=dot(d1,r);
  let s=clamp((b*f-c*e)/Math.max(1e-9,a*e-b*b),0,1),t=(b*s+f)/e;
  if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}
  return length(sub(add(p1,mul(d1,s)),add(p2,mul(d2,t))));
}
export function chainClearance(chain,colliders,radius=.032,other=null){
  // The proximal arm joins the shoulder/armpit and intentionally shares tissue.
  let value=Math.min(segmentClearance(chain.shoulder,chain.elbow,colliders,radius,.115),segmentClearance(chain.elbow,chain.hand,colliders,radius*.88));
  if(other)for(const [a,b] of [[chain.shoulder,chain.elbow],[chain.elbow,chain.hand]])for(const [c,d] of [[other.shoulder,other.elbow],[other.elbow,other.hand]])value=Math.min(value,segmentDistance(a,b,c,d)-radius*1.8);
  return value;
}
function chainAt(shoulder,target,pole,l1,l2,swivel){
  const v=sub(target,shoulder),d=clamp(length(v),Math.sqrt(l1*l1+l2*l2-1.732*l1*l2),l1+l2-.002),axis=length(v)<1e-8?[0,-1,0]:unit(v);
  const hand=add(shoulder,mul(axis,d)),along=(l1*l1-l2*l2+d*d)/(2*d);
  let bend=sub(sub(pole,shoulder),mul(axis,dot(sub(pole,shoulder),axis)));
  if(length(bend)<.001)bend=cross(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0]);
  bend=unit(bend);const tangent=cross(axis,bend);
  const offset=add(mul(bend,Math.cos(swivel)),mul(tangent,Math.sin(swivel)));
  const elbow=add(add(shoulder,mul(axis,along)),mul(offset,Math.sqrt(Math.max(0,l1*l1-along*along))));
  return {shoulder,elbow,hand};
}

export function solveArm3D({shoulder,target,pole,lengths,colliders=[],radius=.032,side=1,other=null,previous=null,maxStep=.028}){
  // A front-to-back transition goes around the outside of the body. Switching
  // front/back offsets at the centre plane would teleport the elbow.
  function route(point){
    point=[...point];
    for(const c of colliders){
      const ry=c.radii[1]+radius,rz=c.radii[2]+radius;
      const yz=((point[1]-c.center[1])/ry)**2+((point[2]-c.center[2])/rz)**2;
      if(yz<1&&pointClearance(point,c,radius)<.002){
        const outside=Math.sqrt(1-yz)*(c.radii[0]+radius+.004);
        point[0]=c.center[0]+side*Math.max(side*(point[0]-c.center[0]),outside);
      }
    }
    return point;
  }
  target=route(target);
  let best=null,bestScore=Infinity;
  const rear=target[2]>.07?1:-1;
  const offsets=[[0,0,0],[0,0,.035],[.035,0,.035],[0,0,.075],[.07,0,.06],[.115,0,0],[.055,0,.13],[.16,0,.03],
    [0,.04,0],[.04,.04,.04],[.08,.04,.07],[.12,.04,.03],[0,.08,.03],[.07,.08,.07],[.13,.08,.07],[.18,.10,.03],[.10,.14,.10],
    [.07,.07,-.055],[.13,.07,-.055],[.18,.12,-.06],[.20,.16,0]];
  const swivels=[0,.3,-.3,.65,-.65,1,-1,1.5,-1.5,2.2,-2.2,Math.PI];
  const reference=chainAt(shoulder,target,pole,...lengths,0);
  function consider(chain,swivel,advance=true){
    const clearance=chainClearance(chain,colliders,radius,other);
    const upper=sub(chain.elbow,shoulder);
    const violation=Math.max(0,-side*upper[0]-.012,upper[2]-.165);
    const preferred=length(sub(chain.elbow,reference.elbow));
    const step=previous?Math.max(length(sub(chain.elbow,previous.elbow)),length(sub(chain.hand,previous.hand))):0;
    if(advance&&previous&&step>maxStep){
      // Advance toward alternate clear reaches as well as the direct target.
      // A direct-only step can stall at the body when the elbow must lift first.
      const amount=Math.min(1,maxStep*.7/step);
      const carry=route(add(previous.hand,mul(sub(chain.hand,previous.hand),amount)));
      const guide=add(previous.elbow,mul(sub(chain.elbow,previous.elbow),amount));
      consider(chainAt(shoulder,carry,guide,...lengths,0),0,false);
    }
    const score=(Math.max(0,-clearance)**2+violation**2)*100000+Math.max(0,step-maxStep)**2*10000+length(sub(chain.hand,target))**2+preferred*preferred*.10+(previous?length(sub(chain.elbow,previous.elbow))**2*.12:0);
    if(score<bestScore){best={...chain,clearance,swivel};bestScore=score;}
  }
  if(previous){
    const move=sub(target,previous.hand),distance=length(move),direction=unit(move);
    for(const amount of [0,maxStep*.22,maxStep*.5,maxStep*.93]){
      const carry=amount?route(add(previous.hand,mul(direction,Math.min(amount,distance)))):previous.hand;
      for(const swivel of [0,.08,-.08,.18,-.18])consider(chainAt(shoulder,carry,previous.elbow,...lengths,swivel),swivel);
    }
  }
  for(const [dx,dy,dz] of offsets){
    const adjusted=add(target,[side*dx,dy,rear*dz]);
    if(previous){
      consider(chainAt(shoulder,adjusted,previous.elbow,...lengths,0),0);
      const guided=add(mul(previous.elbow,.82),mul(pole,.18));
      consider(chainAt(shoulder,adjusted,guided,...lengths,0),0);
    }
    for(const swivel of swivels){
      const chain=chainAt(shoulder,adjusted,pole,...lengths,swivel);
      consider(chain,swivel);
      if(dx===0&&dy===0&&dz===0&&swivel===0&&best.clearance>=.001&&(!previous||(length(sub(chain.elbow,previous.elbow))<.008&&length(sub(chain.hand,previous.hand))<.02)))return best;
    }
    if(best.clearance>=.001&&bestScore<.001)break;
  }
  // Unusually full shapes and wide sleeves need a local refinement beyond the
  // standard pose candidates. Search around the best chain without stretching.
  for(let pass=0;pass<5&&best.clearance<.0005;pass++){
    const seed=best,step=.02+pass*.008;
    for(const offset of [[side*step,0,0],[0,step,0],[0,-step,0],[0,0,step],[0,0,-step],[side*step,step,-step],[side*step,step,step]]){
      for(const swivel of [0,.15,-.15,.35,-.35])consider(chainAt(shoulder,add(seed.hand,offset),seed.elbow,...lengths,swivel),swivel);
    }
  }
  return best;
}

export function bodyColliders(field,padding=.016){
  return [
    ['torso',[0,1.23,-.021],[.115,.102,.132]],
    ['waist',[0,1.11,0],[.105,.105,.093]],
    ['hips',[0,.973,.005],[.131,.117,.104]],
    ['head',[0,1.603,-.005],[.115,.136,.112]],
  ].map(([name,center,radii])=>{
    const front=field.point(center[0],center[1],center[2]-radii[2],'skirt'),back=field.point(center[0],center[1],center[2]+radii[2],'skirt');
    if(name==='torso')for(const x of [-.066,.066])front[2]=Math.min(front[2],field.point(x,center[1],center[2]-radii[2],'skirt')[2]);
    const c=field.point(...center,'skirt');c[2]=(front[2]+back[2])*.5;
    return {name,center:c,radii:radii.map((v,i)=>(i===2?(back[2]-front[2])*.5:v*(name==='head'?1:i===0?field.profile(center[1]):1))+(name==='head'?.012:padding))};
  });
}
