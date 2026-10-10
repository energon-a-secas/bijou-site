// Fixed-step, bounded spring integration shared by the renderer and tests.
export function createSoftSpring({stiffness=85,limit=.022}={}){
  const position=[0,0,0],velocity=[0,0,0];let remainder=0;
  function reset(){position.fill(0);velocity.fill(0);remainder=0;}
  function impulse(v){for(let i=0;i<3;i++)velocity[i]+=Math.max(-.4,Math.min(.4,v[i]||0));}
  function step(dt,force=[0,0,0],damping=.65){
    remainder+=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
    const h=1/120,drag=5+Math.max(0,Math.min(1,damping))*19;
    while(remainder>=h){
      for(let i=0;i<3;i++){
        velocity[i]+=(-stiffness*position[i]-drag*velocity[i]+Math.max(-10,Math.min(10,force[i]||0)))*h;
        position[i]+=velocity[i]*h;
        if(Math.abs(position[i])>limit){position[i]=Math.sign(position[i])*limit;velocity[i]=0;}
        if(Math.abs(position[i])<1e-7&&Math.abs(velocity[i])<1e-6){position[i]=0;velocity[i]=0;}
      }
      remainder-=h;
    }
    return position;
  }
  return {step,impulse,reset,position,velocity};
}
