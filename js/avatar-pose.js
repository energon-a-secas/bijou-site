// Retarget the existing, outward-positive pose language onto the continuous rig.
import { archetypeFor } from './archetypes.js';
const RAD=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function applyAvatarPose(vrm, model, frame, view, cfg, hands, bands, expression, svg, dt, {still=false,time=0}={}) {
  const b=model.bones, f=frame.bones, angle=name=>(f[name]?.a||0)*RAD;
  const character=archetypeFor(cfg.body.archetype),t=time*character.tempo;
  // Raw VRM0 coordinates face -Z; the scene rotates them toward the camera.
  for(const [screen,side,s] of [['L','right',-1],['R','left',1]]){
    const hand=b[`${side}Hand`];
    hand.rotation.set(0,s*.10,-s*angle(`hand${screen}`));
    const thigh=b[`${side}UpperLeg`],shin=b[`${side}LowerLeg`],foot=b[`${side}Foot`];
    const fold=Math.acos(clamp(f[`thigh${screen}`]?.sy??1,.25,1))*1.21;
    thigh.rotation.set(fold,0,-s*angle(`thigh${screen}`));
    shin.rotation.set(-fold,0,-s*angle(`shin${screen}`));
    foot.rotation.set(0,-s*.06,-s*angle(`foot${screen}`)*.25);
    const gesture=hands[screen];
    for(const finger of ['Thumb','Index','Middle','Ring','Little']){
      const open=gesture==='open'||(gesture==='peace'&&['Index','Middle'].includes(finger))||(gesture==='point'&&finger==='Index');
      const fingerIndex=['Thumb','Index','Middle','Ring','Little'].indexOf(finger);
      const curl=open?.04:gesture==='rest'?.23+(still?0:.045*character.fingers*Math.sin(t*.85+fingerIndex*.72+s)):gesture==='curl'?.65:1.0;
      const joints=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
      for(const [i,joint] of joints.entries()){
        const node=b[`${side}${finger}${joint}`];if(!node)continue;
        node.rotation.set(0,(finger==='Thumb'?s*.35:0),s*curl*(i===0?.55:1));
      }
    }
    if(gesture==='peace'){
      b[`${side}IndexProximal`].rotation.y=-s*.15;
      b[`${side}MiddleProximal`].rotation.y=s*.14;
    }
  }
  b.hips.rotation.set(0,0,angle('root'));
  b.spine.rotation.set(0,0,angle('spine')*.6);
  b.chest.rotation.set(0,0,angle('spine')*.4);
  b.neck.rotation.set(0,0,angle('neck'));
  b.head.rotation.set(-view.pitch*.10,view.yaw*.24,angle('head'));
  if(!still&&expression!=='sleep'){
    b.neck.rotation.y=.012*character.head*Math.sin(t*.39);
    b.head.rotation.y+=.018*character.head*Math.sin(t*.51+.7);
    b.head.rotation.x+=.009*character.head*Math.sin(t*.63+1.2);
  }
  b.spine.scale.y=1;
  model.arms.solve(frame,dt);
  for(const [screen,side] of [['L','right'],['R','left']]){
    if(hands[screen]==='peace'||(hands[screen]==='open'&&(f[`upperArm${screen}`]?.a||0)>75))model.arms.upright(side,screen);
  }
  const manager=vrm.expressionManager;
  for(const name of ['happy','relaxed','angry','sad','surprised','aa','oh','blink','blinkLeft','blinkRight'])manager.setValue(name,0);
  const blink=svg.dataset.blink==='2'?1:svg.dataset.blink==='1'?.5:0;
  manager.setValue('blink',expression==='sleep'?1:expression==='sleepy'?.65:Math.max(blink,cfg.head.eyeStyle==='sleepy'?.3:0));
  let smile=cfg.head.mouth==='small'?.06:cfg.head.mouth==='cat'?.28:.12;
  if(['happy','grin'].includes(expression))smile=.32;
  if(['joy','love'].includes(expression))smile=.7;
  manager.setValue('happy',smile);
  if(expression==='wink')manager.setValue('blinkLeft',1);
  if(expression==='pout')manager.setValue('angry',.65);
  if(['blush','flustered'].includes(expression))manager.setValue('sad',.2);
  if(expression==='surprised')manager.setValue('oh',.6);
  if(svg.dataset.talk==='1')manager.setValue('aa',.35);
  else if(['happy','joy','grin','love'].includes(expression))manager.setValue('aa',.18);
  if(cfg.head.eyeStyle==='cat')manager.setValue('angry',.16);
  if(cfg.head.eyeStyle==='soft')manager.setValue('relaxed',.15);
  for(const side of ['left','right'])if(b[`${side}Eye`])b[`${side}Eye`].rotation.set(-view.look.y*.065,view.look.x*.075,0);
  vrm.update(dt);
}
