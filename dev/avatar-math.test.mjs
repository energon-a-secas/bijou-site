import test from 'node:test';
import assert from 'node:assert/strict';
import { createBodyField, BODY_PRESETS, SHAPE_KEYS } from '../js/body-shape.js';
import { solveArm3D, bodyColliders, pointClearance } from '../js/avatar-collision.js';
import { REACHES, reachFor } from '../js/pose-reaches.js';
import { createSoftSpring } from '../js/soft-spring.js';
import { createHairChain } from '../js/hair-chain.js';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const shapes=[...BODY_PRESETS,...[0,1].map(v=>({id:`limit-${v}`,values:Object.fromEntries(SHAPE_KEYS.map(k=>[k,v]))})),
  {id:'mixed',values:{build:1,shoulders:0,torso:1,torsoDepth:1,hips:1,arms:1,waist:0,legs:0}},
  {id:'maximum-bounce',values:{...BODY_PRESETS[0].values,bounce:1}}];
function setup(body,side=1){
  const field=createBodyField(body),shoulder=field.point(side*.109,1.378,.0038),elbow=field.point(side*.328,1.368,.002),hand=field.point(side*.542,1.368,-.0156);
  return {field,shoulder,lengths:[distance(shoulder,elbow),distance(elbow,hand)],colliders:bodyColliders(field,.019+(body.bounce??.35)*.024),radius:.031*(1+((body.arms??.5)-.5+(body.armsFullness??0)*.7)*.65)+.012,side};
}
function check(chain,config,label){
  assert.ok(chain.elbow.every(Number.isFinite)&&chain.hand.every(Number.isFinite),`${label}: finite joints`);
  assert.ok(Math.abs(distance(chain.shoulder,chain.elbow)-config.lengths[0])<1e-6,`${label}: upper-arm length`);
  assert.ok(Math.abs(distance(chain.elbow,chain.hand)-config.lengths[1])<1e-6,`${label}: forearm length`);
  // Independent denser sampling catches a collision between the solver's samples.
  let clearance=1;
  for(const [a,b,r,skip] of [[chain.shoulder,chain.elbow,config.radius,.115],[chain.elbow,chain.hand,config.radius*.88,0]]){
    for(let i=0;i<=64;i++){
      if(distance(a,b)*i/64<skip)continue;
      const p=lerp(a,b,i/64);for(const c of config.colliders)clearance=Math.min(clearance,pointClearance(p,c,r));
    }
  }
  assert.ok(clearance>-.003,`${label}: collider penetration ${(clearance*1000).toFixed(2)} mm`);
}

test('all poses keep both arm lengths and body clearance across presets and shape limits',()=>{
  for(const shape of shapes)for(const pose of Object.keys(REACHES)){
    let other=null;
    for(const [screen,side] of [['L',1],['R',-1]]){
      const config=setup(shape.values,side),r=reachFor(pose,screen);
      const chain=solveArm3D({...config,target:config.field.point(r.tx,r.ty,r.tz),pole:config.field.point(r.px,r.py,r.pz),other});
      check(chain,config,`${shape.id}/${pose}/${screen}`);other=chain;
    }
  }
});

test('pose transitions remain collision constrained, including front-to-back reaches',()=>{
  for(const shape of shapes)for(const from of Object.keys(REACHES))for(const to of Object.keys(REACHES)){
    const config=setup(shape.values),a=reachFor(from,'L'),b=reachFor(to,'L');let previous=null;
    for(const t of [.2,.4,.6,.8]){
      const p=Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+(b[k]-a[k])*t]));
      const chain=solveArm3D({...config,target:config.field.point(p.tx,p.ty,p.tz),pole:config.field.point(p.px,p.py,p.pz),previous});
      check(chain,config,`${shape.id}/${from}->${to}@${t}`);previous=chain;
    }
  }
});

test('roomy sleeves retain body clearance at maximum soft-motion allowance',()=>{
  for(const shape of shapes)for(const pose of Object.keys(REACHES)){
    let other=null;
    for(const [screen,side] of [['L',1],['R',-1]]){
      const config=setup({...shape.values,bounce:1},side),r=reachFor(pose,screen);
      config.radius+=.016;config.colliders=bodyColliders(config.field,.036);
      const chain=solveArm3D({...config,target:config.field.point(r.tx,r.ty,r.tz),pole:config.field.point(r.px,r.py,r.pz),other});
      check(chain,config,`${shape.id}/roomy/${pose}/${screen}`);other=chain;
    }
  }
});

test('morphs stay finite and retain head and foot proportions',()=>{
  for(const body of [...shapes.map(s=>s.values),{hips:NaN,waist:Infinity,torso:-20,legs:99}]){
    const f=createBodyField(body);
    for(let y=.04;y<1.8;y+=.023)for(let x=-.6;x<=.6;x+=.07)assert.ok(f.point(x,y,-.07).every(Number.isFinite));
    assert.deepEqual(f.point(.06,1.6,-.07),[.06,1.6,-.07]);
    assert.deepEqual(f.point(.06,.1,-.07),[.06,.1,-.07]);
  }
  const slim=createBodyField(BODY_PRESETS[1].values),round=createBodyField(BODY_PRESETS[3].values);
  assert.ok(round.point(.1,1.25,-.1)[0]>slim.point(.1,1.25,-.1)[0]);
  assert.ok(round.point(.1,.98,-.1)[2]<slim.point(.1,.98,-.1)[2]);
});

test('front/back transitions do not jump and settle near the intended hand target',()=>{
  for(const shape of BODY_PRESETS)for(const [from,to] of [['heart','behind'],['behind','shy'],['stand','stretch']]){
    const config=setup(shape.values),a=reachFor(from,'L'),b=reachFor(to,'L');let previous=null;
    for(let i=0;i<=100;i++){
      const t=Math.min(1,i/60),p=Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+(b[k]-a[k])*t]));
      const chain=solveArm3D({...config,target:config.field.point(p.tx,p.ty,p.tz),pole:config.field.point(p.px,p.py,p.pz),previous});
      if(previous)for(const joint of ['elbow','hand'])assert.ok(distance(chain[joint],previous[joint])<.035,`${shape.id}/${from}->${to}: ${joint} jump`);
      previous=chain;
    }
    const target=config.field.point(b.tx,b.ty,b.tz),pole=config.field.point(b.px,b.py,b.pz),settled=solveArm3D({...config,target,pole});
    assert.ok(distance(previous.hand,target)<distance(settled.hand,target)+.04,`${shape.id}/${to}: reach settles`);
  }
});

test('soft motion is bounded, settles, and agrees at 30/60/120 Hz',()=>{
  const results=[];
  for(const fps of [30,60,120]){
    const s=createSoftSpring();s.impulse([.15,-.32,.12]);
    for(let i=0;i<fps;i++){s.step(1/fps,[0,0,0],.5);assert.ok(s.position.every(v=>Math.abs(v)<=.022));}
    results.push([...s.position]);
    for(let i=0;i<fps*5;i++)s.step(1/fps,[0,0,0],.5);
    assert.ok(s.position.every(v=>Math.abs(v)<1e-5));
    s.step(20,[100,-100,100],0);assert.ok(s.position.every(v=>Math.abs(v)<=.022));
    s.reset();assert.deepEqual(s.position,[0,0,0]);assert.deepEqual(s.velocity,[0,0,0]);
  }
  assert.ok(distance(results[0],results[1])<1e-5);assert.ok(distance(results[1],results[2])<1e-5);
});

test('belly controls are local, independent, and continuous across the pelvis blend',()=>{
  const neutral=createBodyField(),upper=createBodyField({bellyUpper:1}),lower=createBodyField({bellyLower:1});
  const displacement=(field,y)=>neutral.point(0,y,-.08)[2]-field.point(0,y,-.08)[2];
  assert.ok(displacement(upper,1.145)>displacement(upper,1.055)*3,'upper control favors upper abdomen');
  assert.ok(displacement(lower,1.055)>displacement(lower,1.145)*3,'lower control favors lower abdomen');
  const full=createBodyField({belly:1,bellyDepth:1,bellyUpper:1,bellyLower:1});
  for(const p of [[0,1.1,.06],[0,1.1,0],[.4,1.37,0],[0,1.6,-.08]])assert.deepEqual(full.point(...p),neutral.point(...p),'back, spine, hands and head retain their shape');
  assert.ok(distance(full.point(.035,1.015-.00001,-.08),full.point(.035,1.015+.00001,-.08))<.0001,'no discontinuity at leg branch');
  const high=createBodyField({bellyDepth:1,bellyHeight:1}),low=createBodyField({bellyDepth:1,bellyHeight:0});
  assert.ok(displacement(high,1.13)>displacement(low,1.13));
  assert.ok(displacement(low,1.04)>displacement(high,1.04));
});

test('armpit contours remain local and preserve shoulder pivots',()=>{
  const neutral=createBodyField(),full=createBodyField({armpits:1,armpitsDepth:1});
  assert.ok(distance(full.point(.135,1.318,-.05),neutral.point(.135,1.318,-.05))>.01);
  for(const p of [[.109,1.378,.004],[.3,1.37,0],[0,1.1,-.07]])assert.ok(distance(full.point(...p),neutral.point(...p))<.0001);
});

test('hair roots stay anchored, strands settle, and motion agrees at 30/60/120 Hz',()=>{
  const rest=Array.from({length:6},(_,i)=>[.015+i*.003,.6-i*.1,.01]),results=[];
  const targets=rest.map(p=>[p[0]+.025,p[1],p[2]]);
  for(const fps of [30,60,120]){
    const chain=createHairChain(rest);
    for(let i=0;i<fps*2;i++){
      chain.step(1/fps,targets);
      assert.deepEqual(chain.points[0],targets[0]);
      chain.points.forEach((p,j)=>assert.ok(distance(p,targets[j])<=.0675001,'bounded displacement'));
    }
    results.push(chain.points.map(p=>[...p]));
    for(let i=0;i<fps*6;i++)chain.step(1/fps,targets);
    const previous=chain.points.map(p=>[...p]);chain.step(1/fps,targets);
    chain.points.forEach((p,i)=>assert.ok(distance(p,previous[i])<1e-6,'motion settles'));
    chain.step(20,rest,{strength:0});assert.deepEqual(chain.points,rest,'off restores authored hairstyle');
    const teleported=rest.map(p=>p.map(v=>v+2));chain.step(1/fps,teleported);assert.deepEqual(chain.points,teleported,'teleports reset instead of exploding');
  }
  for(let r=1;r<results.length;r++)results[r].forEach((p,i)=>assert.ok(distance(p,results[0][i])<1e-7,'fixed-step frame rate agreement'));
});

test('hair strands resolve shoulder contact without stretching at rest',()=>{
  const rest=Array.from({length:6},(_,i)=>[.015+i*.003,.6-i*.1,.01]);
  const collider={name:'torso',center:[0,.29,.01],radii:[.035,.055,.045],axes:[[1,0,0],[0,1,0],[0,0,1]]};
  const chain=createHairChain(rest);
  for(let i=0;i<720;i++)chain.step(1/120,rest,{colliders:[collider]});
  chain.points.slice(2).forEach(p=>assert.ok(Math.hypot(...p.map((v,i)=>(v-collider.center[i])/(collider.radii[i]+.006)))>=.999,'outside padded contact volume'));
  chain.points.slice(1).forEach((p,i)=>assert.ok(Math.abs(distance(p,chain.points[i])-distance(rest[i],rest[i+1]))<.0001,'segment length preserved after settling'));
});
