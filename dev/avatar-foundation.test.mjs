import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLeg, shoulderMotion, jointCorrection } from '../js/pose-support.js';
import { transformDQ } from '../js/skinning-math.js';
import { createBodyField, FULLNESS_REGIONS } from '../js/body-shape.js';
import { TEMPLATE_ITEMS, cleanGarment, customizeItem, garmentEase } from '../js/garment-templates.js';
import { cleanGarments } from '../js/catalog.js';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('leg IK preserves bone lengths, reaches the floor, and bends toward the pole',()=>{
  for(const hip of [[.08,1,0],[-.08,.6,.2],[.11,.9,-.05]])for(const target of [[.12,.13,-.02],[-.1,.13,-.3],[0,-2,0],hip]){
    const pole=[hip[0],hip[1]-.2,hip[2]-.4],r=solveLeg(hip,target,[.4,.42],pole);
    assert.ok(r.knee.every(Number.isFinite)&&r.ankle.every(Number.isFinite));
    assert.ok(Math.abs(distance(r.hip,r.knee)-.4)<1e-9);
    assert.ok(Math.abs(distance(r.knee,r.ankle)-.42)<1e-9);
    if(distance(hip,target)<.8195&&distance(hip,target)>.03)assert.ok(distance(r.ankle,target)<1e-9);
  }
  const r=solveLeg([0,.9,0],[0,.13,0],[.4,.42],[0,.6,-.4]);assert.ok(r.knee[2]<0,'knees bend forward');
});

test('clavicle motion and joint corrections stay bounded, local, and mirrored',()=>{
  const down=shoulderMotion([.1,1.38,0],[.18,.95,-.05],1),up=shoulderMotion([.1,1.38,0],[.15,1.9,-.05],1);
  assert.equal(down.lift,0);assert.ok(up.lift>.2&&up.lift<=.27);
  assert.equal(shoulderMotion([-.1,1.38,0],[-.15,1.9,-.05],-1).lift,-up.lift);
  for(const kind of ['underarm','hip'])for(let y=.8;y<1.5;y+=.013)for(let x=.01;x<.6;x+=.021){
    const a=jointCorrection([x,y,-.04],kind,1),b=jointCorrection([-x,y,-.04],kind,-1);
    assert.ok(Math.hypot(...a)<.025);assert.ok(distance(a,[-b[0],b[1],b[2]])<1e-12);
  }
  assert.deepEqual(jointCorrection([0,1.6,-.04],'underarm',1),[0,0,0]);
});

test('surface probes match rigid DQ translation/rotation and antipodal blends',()=>{
  const identity=[0,0,0,1,.1,.15,.2,0,1,1,1,0];
  assert.ok(distance(transformDQ([1,2,3],[0,0,0,0],[1,0,0,0],identity),[1.2,2.3,3.4])<1e-9);
  const s=Math.SQRT1_2,q=[0,0,s,s],d=[.25*s,.05*s,.2*s,-.2*s];
  const bone=[...q,...d,1,1,1,0],negative=[...q.map(v=>-v),...d.map(v=>-v),1,1,1,0];
  assert.ok(distance(transformDQ([1,0,0],[0,0,0,0],[1,0,0,0],bone),[.2,1.3,.4])<1e-9);
  assert.ok(distance(transformDQ([1,0,0],[0,1,0,0],[.5,.5,0,0],[...bone,...negative]),[.2,1.3,.4])<1e-9);
});

test('cup volume changes width, height and projection while retaining the ribcage and back',()=>{
  const small=createBodyField({bustVolume:0}),full=createBodyField({bustVolume:1}),neutral=createBodyField();
  const p=[.105,1.305,-.14],a=small.point(...p),b=full.point(...p);
  assert.ok(b[0]>a[0]+.01);assert.ok(b[1]>a[1]+.004);assert.ok(b[2]<a[2]-.025);
  for(const p of [[0,1.25,0],[.07,1.25,.07],[.07,1.39,-.038],[.02,1.60,-.08]])assert.deepEqual(full.point(...p),neutral.point(...p));
  const lift=createBodyField({bustLift:1}),spacing=createBodyField({bustSpacing:1});
  assert.ok(lift.point(.065,1.25,-.13)[1]>neutral.point(.065,1.25,-.13)[1]+.01);
  assert.ok(spacing.point(.065,1.25,-.13)[0]>neutral.point(.065,1.25,-.13)[0]+.008);
});

test('extended fullness stays symmetric and increases the selected regional envelope',()=>{
  const positions={torso:[.11,1.25,-.08],waist:[.08,1.105,-.07],belly:[.06,1.065,-.09],hips:[.12,.99,-.08],arms:[.33,1.34,-.02],legs:[.10,.70,-.04]};
  for(const id of FULLNESS_REGIONS){
    const f=createBodyField({[id]:1,[`${id}Depth`]:1,[`${id}Fullness`]:1}),base=createBodyField({[id]:1,[`${id}Depth`]:1}),p=positions[id];
    assert.ok(distance(f.point(...p),base.point(...p))>.006,id);
    const a=f.point(...p),b=f.point(-p[0],p[1],p[2]);assert.ok(distance(a,[-b[0],b[1],b[2]])<1e-9);
  }
});

test('clothing settings validate, preserve prototypes and distinguish body fit from fabric ease',()=>{
  for(const item of TEMPLATE_ITEMS){
    const original=JSON.stringify(item),settings=cleanGarment(item,{color:'javascript:bad',length:Infinity,ease:-2,stretch:5,neckline:'invalid',fabric:'unknown'});
    assert.match(settings.color,/^#[\da-f]{6}$/i);assert.equal(settings.ease,0);assert.equal(settings.stretch,1);
    const a=customizeItem(item,{[item.id]:{ease:0,waistEase:0}}),b=customizeItem(item,{[item.id]:{ease:0,waistEase:1}});
    assert.ok(garmentEase(b,.07,1.10)>garmentEase(a,.07,1.10)+.04);
    assert.ok(Math.abs(garmentEase(b,.07,.50)-garmentEase(a,.07,.50))<1e-6);
    assert.equal(JSON.stringify(item),original);
  }
  assert.deepEqual(cleanGarments({unknown:{color:'#ffffff'},'studio-jeans':{ease:5}})['studio-jeans'].ease,1);
  assert.equal('unknown' in cleanGarments({unknown:{}}),false);
});
