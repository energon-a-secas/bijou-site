import test from 'node:test';
import assert from 'node:assert/strict';
import {FACE_CONTROLS,FACE_DETAIL_DEFAULTS,cleanFaceDetails} from '../js/model-face-details.js';
import {createFaceField,cleanAppearance,FACE_STYLES,ADULT_AGES} from '../js/model-appearance.js';
import {STYLE_DEFAULTS,cleanModelStyle,cleanModelLight} from '../js/model-style.js';
import {PORTRAIT_STARTS,portraitLook,varyPortrait} from '../js/model-portraits.js';
import {smoothStudyNormals} from '../js/model-smooth-normals.js';
import {fitFaceNormals} from '../js/model-face-normals.js';
import {createFabricEnvelope} from '../js/model-fabric-envelope.js';

test('old looks receive neutral face details; malformed detail/material/light values are bounded',()=>{
  assert.deepEqual(cleanAppearance({face:'heroine'}).details,FACE_DETAIL_DEFAULTS);
  const details=cleanFaceDetails({faceWidth:100,eyeSize:NaN,jawWidth:'1',chinLength:0});assert.equal(details.faceWidth,1);assert.equal(details.eyeSize,0);assert.equal(details.jawWidth,0);assert.equal(details.chinLength,0);
  const style=cleanModelStyle({skinColor:'url(x)',eyeColor:'#ABCDEF',roughness:Infinity,eyeTint:9,pupilSize:-9});
  assert.equal(style.skinColor,STYLE_DEFAULTS.skinColor);assert.equal(style.eyeColor,'#ABCDEF');assert.equal(style.roughness,.55);assert.equal(style.eyeTint,1);assert.equal(style.pupilSize,0);
  assert.deepEqual(cleanModelLight({stage:'bad',azimuth:Infinity,exposure:9,fill:-2,elevation:0}),{stage:'ivory',azimuth:-.42,elevation:0,exposure:1.6,fill:0,rim:.45});
});
test('every detail has a geometric effect, remains mirrored and leaves the body/scalp/back intact',()=>{
  for(const c of FACE_CONTROLS){
    const f=createFaceField({details:{[c.id]:1}});let max=0;
    for(let x=0;x<.115;x+=.007)for(let y=1.405;y<1.61;y+=.007)for(const z of [.025,.055,.085]){
      const p=[x,y,z],r=f.point(...p),l=f.point(-x,y,z);max=Math.max(max,Math.hypot(...r.map((n,k)=>n-p[k])));
      assert(Math.abs(l[0]+r[0])<1e-10);assert(Math.abs(l[1]-r[1])<1e-10);assert(Math.abs(l[2]-r[2])<1e-10);
    }
    assert(max>.0001,c.id+' has no useful effect');assert(max<.012,c.id+' exceeds the edit bound');
    for(const p of [[.03,1.2,.08],[.03,1.68,.08],[.04,1.53,-.08]])assert.deepEqual(f.point(...p),p);
  }
});
test('combined extremes preserve a positive local volume across styles and adult ages',()=>{
  for(const face of FACE_STYLES)for(const age of ADULT_AGES)for(const sign of [-1,1]){
    const f=createFaceField({face:face.id,age:age.id,details:Object.fromEntries(FACE_CONTROLS.map(c=>[c.id,sign]))});
    for(let x=-.10;x<=.10;x+=.01)for(let y=1.41;y<=1.60;y+=.01){
      const z=.085,h=.00001,p=f.point(x,y,z),a=f.point(x+h,y,z).map((v,k)=>(v-p[k])/h),b=f.point(x,y+h,z).map((v,k)=>(v-p[k])/h),c=f.point(x,y,z+h).map((v,k)=>(v-p[k])/h);
      const det=a[0]*(b[1]*c[2]-b[2]*c[1])-b[0]*(a[1]*c[2]-a[2]*c[1])+c[0]*(a[1]*b[2]-a[2]*b[1]);
      assert(det>.015,`${face.id}, ${age.id}, ${sign}: folded local field`);
    }
  }
});
test('portrait starts and variations are reproducible, editable adult recipes',()=>{
  for(const p of PORTRAIT_STARTS){const look=portraitLook(p.id);assert(look.appearance.age>=25);assert.equal(look.hair.style,'textured');assert.equal(look.style.render,'realistic');}
  assert.deepEqual(varyPortrait(42,55),varyPortrait(42,55));assert.notDeepEqual(varyPortrait(42),varyPortrait(43));
  for(let seed=0;seed<100;seed++){const v=varyPortrait(seed,45);assert.equal(v.appearance.age,45);assert(!('shape' in v));assert(!('clothes' in v));assert(Object.values(v.appearance.details).every(n=>Number.isFinite(n)&&Math.abs(n)<=1));}
});
test('normal repair retains unit normals, rejects opposite surfaces and leaves source arrays intact',()=>{
  const points=new Float32Array([0,0,0,.001,0,0,.001,0,0]),normals=new Float32Array([0,0,1,.2,0,Math.sqrt(.96),0,0,-1]),copy=normals.slice();
  const repaired=smoothStudyNormals(points,normals,[{head:1},{head:1},{head:1}]);
  assert.deepEqual(normals,copy);assert(repaired[0]>0);assert.deepEqual(Array.from(repaired.slice(6)),[0,0,-1]);
  for(let i=0;i<repaired.length;i+=3)assert(Math.abs(Math.hypot(...repaired.slice(i,i+3))-1)<1e-6);
});
test('local surface fitting reduces shading noise without moving the mesh or mixing back surfaces',()=>{
  const p=[],n=[],masks=[],expected=[-.10,.16,1],length=Math.hypot(...expected);for(let k=0;k<3;k++)expected[k]/=length;
  for(let row=0;row<21;row++)for(let col=0;col<21;col++){
    const x=(col-10)*.004,y=1.48+(row-10)*.004,z=.073+x*.10-(y-1.48)*.16;
    const nx=expected[0]+(col%2?.18:-.18),ny=expected[1]+(row%2?.14:-.14),unit=Math.hypot(nx,ny,expected[2]);
    p.push(x,y,z);n.push(nx/unit,ny/unit,expected[2]/unit);masks.push({head:1});
  }
  const forward=p.length/3;p.push(0,1.48,.070,0,1.1,.070,0,1.67,.070);n.push(0,0,-1,0,0,1,0,1,0);masks.push({head:1},{head:0},{head:1});
  const points=new Float32Array(p),normals=new Float32Array(n),pointsCopy=points.slice(),normalCopy=normals.slice(),fitted=fitFaceNormals(points,normals,masks);
  assert.deepEqual(points,pointsCopy);assert.deepEqual(normals,normalCopy);let before=0,after=0;
  for(let i=0;i<forward;i++){
    if(Math.abs(points[i*3])<.025&&Math.abs(points[i*3+1]-1.48)<.01){before+=Math.hypot(...expected.map((v,k)=>v-normals[i*3+k]));after+=Math.hypot(...expected.map((v,k)=>v-fitted[i*3+k]));}
    assert(Math.abs(Math.hypot(...fitted.subarray(i*3,i*3+3))-1)<1e-6);
  }
  assert(after<before*.35,'Shading noise was not reduced');assert.deepEqual(fitted.subarray(forward*3),normals.subarray(forward*3));
});
test('older physical looks receive the refinement baseline and explicit values are retained',()=>{
  const old=cleanModelStyle({render:'realistic',eyeTint:.7});assert.equal(old.eyeRestoration,1);assert.equal(old.hairDetail,.7);assert.equal(old.eyeTint,.7);
  const explicit=cleanModelStyle({render:'realistic',eyeRestoration:0,hairRoughness:-2,lightWrap:9});assert.equal(explicit.eyeRestoration,0);assert.equal(explicit.hairRoughness,0);assert.equal(explicit.lightWrap,1);
  assert.equal(cleanModelStyle({render:'anime3d'}).eyeRestoration,0);
});
test('fabric bridges fine contours outward, stays bounded and leaves skin/back/hem intact',()=>{
  const positions=new Float32Array([.05,1.2,.15,.06,1.2,.14,.07,1.2,.14,.05,1.05,.09,.05,1.2,-.06]),copy=positions.slice();
  const envelope=createFabricEnvelope(positions,{shoulderX:.16,waist:1.05,chest:1.2});
  const fit=envelope(.06,1.2,.14);assert(fit>.145&&fit<=.152);assert.deepEqual(positions,copy);
  assert(Math.abs(envelope(.05,1.2,.15)-.15)<1e-7);assert.equal(envelope(.05,1.2,-.06),-.06);assert.equal(envelope(.05,1.05,.09),.09);assert.equal(envelope(.20,1.2,.10),.10);
});
