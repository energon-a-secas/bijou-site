import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelField,MODEL_CONTROLS,MODEL_DEFAULTS,MODEL_PRESETS,cleanModelShape} from '../js/model-shape.js';
import {createFaceField,cleanAppearance,ADULT_AGES,FACE_STYLES} from '../js/model-appearance.js';
import {cleanClothes,CLOTHES_DEFAULTS} from '../js/model-clothes.js';
import {weldedSurfaceNormals} from '../js/model-normals.js';
const torso={torso:1,head:0,arm:0,leg:0},head={head:1,torso:0,arm:0,leg:0};
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('neutral shape is identity and invalid values cannot enter a draft',()=>{
  const f=createModelField();for(const p of [[.1,1.2,.08],[-.1,.7,-.04],[.02,1.6,.09]])assert.deepEqual(f.point(...p),p);
  const clean=cleanModelShape({height:Infinity,waistWidth:100,hipDepth:NaN,arms:'1',unknown:42});
  assert.equal(clean.height,168);assert.equal(clean.waistWidth,1);assert.equal(clean.hipDepth,0);assert.equal(clean.arms,0);assert(!('unknown' in clean));
});
test('abdomen changes front surface, preserves back, arms and head',()=>{
  const f=createModelField({bellyUpper:1,bellyLower:1});assert(f.point(.03,1.06,.09,torso)[2]>.11);
  assert.deepEqual(f.point(.03,1.06,-.07,torso),[.03,1.06,-.07]);
  assert.deepEqual(f.point(.32,1.06,.05,{torso:0,arm:1,head:0,leg:0}),[.32,1.06,.05]);
  assert.deepEqual(f.point(.03,1.55,.08,head),[.03,1.55,.08]);
});
test('chest volume changes projection below collarbone and leaves spine intact',()=>{
  const f=createModelField({chestVolume:1});assert(f.point(.063,1.24,.08,torso)[2]>.11);
  assert.deepEqual(f.point(.063,1.36,.08,torso),[.063,1.36,.08]);
  assert.deepEqual(f.point(0,1.24,-.06,torso),[0,1.24,-.06]);
});
test('height keeps the floor, preserves head dimensions, and stays monotone',()=>{
  for(const height of [150,195]){
    const f=createModelField({height});near(f.point(0,0,0)[1],0);near(f.point(0,1.68,0,head)[1],height/100);
    near(f.point(0,1.68,0,head)[1]-f.point(0,1.45,0,head)[1],.23);
    let previous=-1;for(let y=0;y<1.7;y+=.005){const next=f.vertical(y);assert(next>previous);previous=next;}
  }
});
test('fields are mirrored and bounded across combined extremes and presets',()=>{
  const shapes=[...MODEL_PRESETS.map(p=>p.values),...[-1,1].map(s=>Object.fromEntries(MODEL_CONTROLS.map(c=>[c.id,s>0?c.max:c.min])))];
  for(const values of shapes){const f=createModelField(values);
    for(let y=.05;y<=1.68;y+=.03)for(const x of [.03,.08,.15])for(const z of [-.1,.1]){
      const right=f.point(x,y,z),left=f.point(-x,y,z);near(right[0],-left[0]);near(right[1],left[1]);near(right[2],left[2]);
      assert(right.every(Number.isFinite));assert(Math.abs(right[0]-x)<.13);assert(Math.abs(right[1]-y)<.30);assert(Math.abs(right[2]-z)<.15);
    }
  }
});
test('negative chest range approaches the ribcage without inverting front layers',()=>{
  const flat=createModelField({chestVolume:-1});
  const front=flat.point(.063,1.24,.18,torso),below=flat.point(.063,1.24,.12,torso);
  assert(front[2]<.085);assert(front[2]>below[2]);
  assert.deepEqual(flat.point(.063,1.36,.08,torso),[.063,1.36,.08]);
  assert.deepEqual(flat.point(.063,1.24,-.08,torso),[.063,1.24,-.08]);
});
test('hip and build fields stay continuous at the centre line',()=>{
  const f=createModelField({hipWidth:1,build:1});
  const left=f.point(-1e-7,.93,.1,torso),right=f.point(1e-7,.93,.1,torso);
  assert(Math.abs(left[0]-right[0])<1e-5);
});
test('slender preset reduces waist and thigh cross sections and flattens the chest',()=>{
  const f=createModelField(MODEL_PRESETS.find(p=>p.id==='slender').values);
  assert(f.point(.12,1.08,.09,torso)[0]<.1);
  const thigh=f.point(.16,.74,.1,{leg:1,torso:0,head:0,arm:0});assert(thigh[0]<.14&&thigh[2]<.09);
  assert(f.point(.063,1.24,.18,torso)[2]<.075);
});
test('face and adult age fields preserve body, scalp and back of head',()=>{
  assert.equal(cleanAppearance({age:12}).age,25);
  for(const age of ADULT_AGES)for(const face of FACE_STYLES){
    const f=createFaceField({age:age.id,face:face.id});
    for(const p of [[.04,1.25,.08],[.04,1.67,.08],[.04,1.52,-.08]])assert.deepEqual(f.point(...p),p);
    assert(f.point(.04,1.515,.08).every(Number.isFinite));
  }
  const neutral=createFaceField(),heroine=createFaceField({face:'heroine'}),mature=createFaceField({age:65});
  const p=[.039,1.525,.08];assert.deepEqual(neutral.point(...p),p);assert.notDeepEqual(heroine.point(...p),p);assert.notDeepEqual(mature.point(...p),p);
});
test('clothing schema rejects unknown pieces and unsafe colors, clamps fit',()=>{
  const c=cleanClothes({top:'unknown',bottom:'jeans',topColor:'url(x)',bottomColor:'#ABCDEF',topFit:100,bottomFit:NaN,legLength:-2});
  assert.equal(c.top,'source');assert.equal(c.bottom,'jeans');assert.equal(c.topColor,CLOTHES_DEFAULTS.topColor);assert.equal(c.bottomColor,'#ABCDEF');assert.equal(c.topFit,1);assert.equal(c.bottomFit,.15);assert.equal(c.legLength,0);
});
test('joint centres move with shoulder and hip spacing without limb inflation',()=>{
  const arm={arm:1,torso:0,head:0,leg:0},f=createModelField({shoulders:1,arms:1});
  near(f.point(.25,1.105,.01,arm,true)[0],.278);
  const calf=createModelField({calves:1});assert.deepEqual(calf.point(.1,.32,.015,{leg:1,head:0,arm:0,torso:0},true),[.1,.32,.015]);
});
test('mixed shoulder weights do not tear the central neck under slim edits',()=>{
  const f=createModelField(MODEL_PRESETS.find(p=>p.id==='slender').values),mask={head:.1,arm:.5,torso:.4,leg:0};
  const left=f.point(-1e-7,1.32,.065,mask),right=f.point(1e-7,1.32,.065,mask);
  assert(Math.abs(left[0]-right[0])<1e-5);assert(Math.abs(right[0])<1e-5);
});
test('garment extrusion shares a direction across UV seams without changing shading normals',()=>{
  const positions=[0,0,0,1,0,0,0,1,0, 0,0,0,0,1,0,0,0,1];
  const p={count:6,getX:i=>positions[i*3],getY:i=>positions[i*3+1],getZ:i=>positions[i*3+2]};
  const normal={array:new Float32Array([0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0])},before=normal.array.slice();
  const n=weldedSurfaceNormals({attributes:{position:p,normal}},[[0,3],[2,4]]);
  assert.deepEqual(n.slice(0,3),n.slice(9,12));assert.deepEqual(n.slice(6,9),n.slice(12,15));
  assert(Math.abs(n[0]-Math.SQRT1_2)<1e-6);assert(Math.abs(n[2]-Math.SQRT1_2)<1e-6);
  assert.deepEqual(normal.array,before);
});

test('arm lengths change actual segments independently and keep hands rigid',()=>{
  const arm={arm:1,torso:0,head:0,leg:0},hand={...arm,hand:1},a=createModelField().landmarks;
  const shoulder=[a.shoulderX,a.shoulder,.015],elbow=[a.elbowX,a.elbowY,.015],wrist=[a.wristX,a.wristY,.035];
  const distance=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));
  for(const u of [-1,0,1])for(const v of [-1,0,1]){
    const f=createModelField({upperArmLength:u,forearmLength:v}),s=f.point(...shoulder,arm,true),e=f.point(...elbow,arm,true),w=f.point(...wrist,hand,true);
    near(distance(s,e)/distance(shoulder,elbow),1+.18*u);near(distance(e,w)/distance(elbow,wrist),1+.18*v);
    assert.deepEqual(s,shoulder);
  }
  for(const height of [150,195]){
    const f=createModelField({height,upperArmLength:1,forearmLength:-1}),p=[.38,.86,.04],q=[.40,.84,.05],fp=f.point(...p,hand),fq=f.point(...q,hand);
    near(distance(p,q),distance(fp,fq));near(f.point(0,1.68,0,head)[1],height/100);
  }
});
test('body presets include distinct limb proportions',()=>{
  const p=MODEL_PRESETS.find(p=>p.id==='petite').values,w=MODEL_PRESETS.find(p=>p.id==='willow').values;
  assert(p.upperArmLength<w.upperArmLength&&p.forearmLength<w.forearmLength);
  assert.equal(cleanModelShape({height:160}).upperArmLength,0);
});
