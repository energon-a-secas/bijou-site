const clamp=n=>Math.max(0,Math.min(1,n));
// Project onto the two actual rest segments. Width and length are independent,
// and downstream joints inherit the full displacement of each upstream segment.
export function armLengthOffset(x,y,z,mask,shape,a){
  const arm=mask.arm||0;if(!arm)return [0,0,0];
  const side=Math.sign(x),px=Math.abs(x),hand=mask.hand||0;
  const shoulder=[a.shoulderX,a.shoulder,a.shoulderZ??.015],elbow=[a.elbowX,a.elbowY,a.elbowZ??.015],wrist=[a.wristX,a.wristY,a.wristZ??.035];
  const upper=elbow.map((v,i)=>v-shoulder[i]),lower=wrist.map((v,i)=>v-elbow[i]);
  const point=[px,y,z],along=(start,segment)=>clamp(segment.reduce((sum,v,i)=>sum+(point[i]-start[i])*v,0)/segment.reduce((sum,v)=>sum+v*v,0));
  const u=along(shoulder,upper)*(1-hand)+hand,v=along(elbow,lower)*(1-hand)+hand;
  const lateral=clamp((px-a.shoulderX*.65)/(a.shoulderX*.35)),weight=arm*lateral*lateral*(3-2*lateral);
  return upper.map((n,i)=>(n*(shape.upperArmLength||0)*.18*u+lower[i]*(shape.forearmLength||0)*.18*v)*weight*(i===0?side:1));
}
export function editedWristY(shape,a){
  return a.wristY+.18*((a.elbowY-a.shoulder)*(shape.upperArmLength||0)+(a.wristY-a.elbowY)*(shape.forearmLength||0));
}
