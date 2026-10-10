import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanHair,cleanGaze,HAIR_DEFAULTS,EXPRESSIONS} from '../js/model-persona.js';
import {eyeOffset,blinkAt} from '../js/model-gaze.js';
import {hairLock,hairGuides} from '../js/model-hair-geometry.js';
import {createFaceField} from '../js/model-appearance.js';

test('hair and gaze reject invalid settings and keep explicit zero values',()=>{
  const h=cleanHair({style:'invalid',color:'url(secret)',length:0,volume:Infinity,shine:2,motion:NaN});
  assert.equal(h.style,'hime');assert.equal(h.color,HAIR_DEFAULTS.color);assert.equal(h.length,0);assert.equal(h.volume,.45);assert.equal(h.shine,1);assert.equal(h.motion,.45);
  assert.deepEqual(cleanGaze({mode:'bad',x:-9,y:Infinity,blink:false,follow:'true',headFollow:1}),{mode:'animated',x:-1,y:0,blink:false,follow:false,headFollow:false});
});
test('gaze is bounded, local, reversible and blinking preserves vertex order',()=>{
  const eye={x:.04,y:1.53};assert.deepEqual(eyeOffset(eye.x,eye.y,eye,0,0,0),[0,0,0]);
  assert.deepEqual(eyeOffset(0,1.4,eye,1,1,1),[0,0,0]);
  for(const blink of [0,.5,1])for(const x of [.02,.04,.06]){
    let previous=-Infinity;
    for(let y=1.49;y<=1.57;y+=.0001){const delta=eyeOffset(x,y,eye,0,0,blink);assert(y+delta[1]>previous);previous=y+delta[1];assert(Math.abs(delta[1])<.02);}
  }
  const left=eyeOffset(eye.x,eye.y,eye,-1,1,0),right=eyeOffset(eye.x,eye.y,eye,1,1,0);assert.equal(left[0],-right[0]);assert.equal(left[1],right[1]);
  assert.equal(blinkAt(0),0);assert.equal(blinkAt(3.56),1);assert.equal(blinkAt(3.8),0);assert(Math.abs(blinkAt(8.26)-1)<1e-9);
});
test('expressions change facial geometry without moving neck, body or scalp',()=>{
  const p=[.025,1.465,.09],neutral=createFaceField().point(...p);
  for(const expression of EXPRESSIONS.filter(e=>e.id!=='neutral')){
    const f=createFaceField({expression:expression.id});assert.notDeepEqual(f.point(...p),neutral);
    for(const point of [[0,1.68,.08],[.1,1.2,.08],[0,1.35,.03]])assert.deepEqual(f.point(...point),point);
  }
});
test('hair locks have finite normals and a smooth wrapped seam at both length extremes',()=>{
  for(const style of ['hime','swept','bob'])for(const length of [0,1])for(const volume of [0,1]){
    for(const guide of hairGuides({...HAIR_DEFAULTS,style,length,volume},1.36)){
      const {geometry:g}=hairLock(guide.points,guide.width,guide.depth),p=g.attributes.position,n=g.attributes.normal;
      assert(p.array.every(Number.isFinite));assert(n.array.every(Number.isFinite));assert(g.index.array.every(i=>i<p.count));
      for(let row=0;row<=36;row++){const a=row*21,b=a+20;assert(Math.hypot(n.getX(a)-n.getX(b),n.getY(a)-n.getY(b),n.getZ(a)-n.getZ(b))<1e-6);}
      g.dispose();
    }
  }
});
