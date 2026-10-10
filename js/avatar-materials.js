// Shared, softly banded materials. Garment colours live on the skinned surface,
// so there are no separate elbow or knee cutouts.
import * as T from './vendor/avatar-engine.js';
import { SKIN, HAIR, EYES, byId } from './looks.js';
import { resolvedItem } from './catalog.js';
import { applyFinish } from './avatar-finish.js';
import { fabricId, textileShader } from './avatar-fabric.js';

const ramp = new T.DataTexture(new Uint8Array([72,72,72,255, 110,110,110,255, 191,191,191,255, 255,255,255,255]), 4, 1, T.RGBAFormat);
ramp.minFilter = T.LinearFilter; ramp.magFilter = T.LinearFilter; ramp.needsUpdate = true;
export function toon(color, extra = {}) {
  return new T.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
}

let microSurface;
function skinDetail(){
  if(microSurface)return microSurface;
  const size=256,pixels=new Uint8Array(size*size*4);let seed=8191;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=124+(seed>>>27);pixels.set([value,value,value,255],i*4);
  }
  microSurface=new T.DataTexture(pixels,size,size,T.RGBAFormat);
  microSurface.wrapS=microSurface.wrapT=T.RepeatWrapping;microSurface.repeat.set(16,16);
  microSurface.minFilter=T.LinearMipmapLinearFilter;microSurface.magFilter=T.LinearFilter;microSurface.generateMipmaps=true;microSurface.needsUpdate=true;
  return microSurface;
}

export const colorCode = color => {
  const c = new T.Color(color || '#ffffff');
  return `vec3(${c.r.toFixed(5)},${c.g.toFixed(5)},${c.b.toFixed(5)})`;
};

/** Rest-position coordinates survive skinning, keeping fabric attached to skin. */
export function surfaceMaterial(cfg, layer = false) {
  const it = slot => resolvedItem(cfg.outfit[slot],cfg.garments);
  const dress = it('dress'), swim = it('swim'), top = it('top'), outer = it('outer');
  const bottom = it('bottom'), socks = it('legwear'), shoes = it('shoes');
  const main = dress || swim || top;
  const captain = dress?.id === 'dress-captain', tux = swim?.id === 'swim-tuxedo';
  const shirt = main?.colors.main || '#f3dbe7';
  const pants = bottom?.kind === 'pants';
  const long = main?.params.sleeve === 'long' || main?.params.sleeve === 'wide' || captain || !!outer;
  const short = ['short', 'puff'].includes(main?.params.sleeve);
  const sleeveX = main?.params.sleeveX??(long ? .53 : short ? .235 : .125);
  const neckY = captain ? 1.397 : top?.id === 'top-tie' ? 1.39 : main?.params.neck === 'square' ? 1.285 : main?.params.neck === 'v' ? 1.285 : 1.365;
  const code = [];
  const paint = (test, color,cloth=null) => code.push(`if (${test}) { diffuseColor.rgb = ${colorCode(color)}; bjClothed = true; bjTextile=${fabricId(cloth?.fabric)}; bjTension=${(1-(cloth?.params.fit?.stretch??1)).toFixed(3)}; }`);
  const torso = 'abs(bjP.x) < .175 && bjP.y > .98 && bjP.y < 1.397';
  // The permanent modest base garment is also drawn when all slots are empty.
  const twoPiece=swim?.kind==='swim2';
  const topBottom=main?.params.hemY??(twoPiece&&swim.params.top!=='tank'?1.19:.98);
  if(twoPiece&&swim.params.top!=='tank'){
    const cupTop='(1.292 + .026*max(0.,1.-pow(abs(abs(bjP.x)-.055)/.067,2.)))';
    paint(`${torso} && bjP.y>1.202 && bjP.y<${cupTop}`,shirt,swim);
    paint(`${torso} && bjP.y>1.202 && bjP.y<1.208`,swim.colors.trim||shirt);
    if(swim.params.top==='halter'){
      paint(`bjP.y>1.29 && bjP.y<1.40 && abs(abs(bjP.x)-max(.025,.081-(bjP.y-1.29)*.52))<${swim.params.strapWidth??.008}`,shirt,swim);
    }
    if(swim.template==='underwear')paint(`bjP.y>1.29 && bjP.y<1.397 && abs(abs(bjP.x)-.068)<${swim.params.strapWidth}`,shirt,swim);
  }else {
    const frontNeck=main?.template&&main.params.neck==='scoop'?'(1.31+.048*pow(min(1.,abs(bjP.x)/.085),2.))':main?.template&&main.params.neck==='v'?'(1.286+min(.09,abs(bjP.x)*.9))':main?.template&&main.params.neck==='crew'?'(1.359+.027*pow(min(1.,abs(bjP.x)/.080),2.))':neckY;
    const neck=main?.template?`(bjP.z>0.?1.386:${frontNeck})`:frontNeck;
    paint(`${torso} && bjP.y > ${topBottom} && bjP.y < ${neck}`, shirt,main);
    if(main?.template)paint(`${torso} && bjP.y>${topBottom} && bjP.y<${topBottom+.007}`,main.colors.trim);
  }
  if (!swim) paint('abs(bjP.x) < .14 && bjP.y > .87 && bjP.y < 1.04', bottom?.colors.main || shirt,bottom);
  else if(!twoPiece) paint('abs(bjP.x) < .145 && bjP.y > (.895 + abs(bjP.x)*.45) && bjP.y < 1.29', shirt);
  if (long || short) paint(`abs(bjP.x) < ${sleeveX} && abs(bjP.x) > .11 && bjP.y > 1.29 && bjP.y < 1.405`, shirt,main);
  if (main?.params.neck === 'crew'&&!main?.template) paint('abs(bjP.x)<.044 && bjP.y>1.33 && bjP.y<1.385', shirt);
  if(main?.template==='cami'&&main.params.sleeve==='none')paint('bjP.y>1.28 && bjP.y<1.385 && abs(abs(bjP.x)-.09)<.013',shirt,main);
  if (pants) {
    const waist=bottom.params.waistY??1.015,leg=bottom.params.legY??(bottom.params.len==='short'?.78:.125);
    paint(`bjP.y < ${waist} && bjP.y > ${leg}`, bottom.colors.main,bottom);
    if(bottom.template)paint(`bjP.y<${waist} && bjP.y>${waist-.017}`,bottom.colors.trim,bottom);
  }
  if (socks) {
    const max = { tights: 1.01, over: .78, knee: .56, ruffle: .21, warmers: .49 }[socks.params.style] || .56;
    paint(`bjP.y < ${max} && bjP.y > .045`, socks.colors.main);
    if (socks.pattern === 'stripes') paint(`bjP.y<${max} && bjP.y>.11 && mod(bjP.y,.055)<.02`, socks.colors.pattern);
    paint(`bjP.y < ${max} && bjP.y > ${max-.018}`, socks.colors.trim || socks.colors.main);
  }
  if (swim) {
    const rise=swim.params.waistY??(swim.params.bottom==='high'?1.055:.99);
    paint(`abs(bjP.x) < .175 && bjP.y > (.87 + abs(bjP.x)*.58) && bjP.y < ${twoPiece?rise:1.31}`, shirt,swim);
    if(twoPiece)paint(`abs(bjP.x)<.175 && bjP.y>${rise-.007} && bjP.y<${rise}`,swim.colors.trim||shirt);
  }
  if(main?.pattern){
    const test=main.pattern==='stripes'||main.pattern==='knit'?'mod(bjP.y,.05)<.013':'length(fract(bjP.xy*32.)-.5)<.13';
    paint(`${torso} && bjP.y>${topBottom} && bjP.y<1.30 && ${test}`, main.colors.pattern||main.colors.trim||'#fff2df');
  }
  if (shoes && ['captain', 'rainboot', 'boot'].includes(shoes.params.style)) {
    const high = shoes.params.style === 'captain' ? .57 : .39;
    paint(`bjP.y < ${high}`, shoes.colors.main);
    paint(`bjP.y<${high} && bjP.y>${high-.012}`, shoes.colors.trim || shoes.colors.main);
  }
  if (outer) {
    paint(torso, outer.colors.main);
    paint('abs(bjP.x)<.54 && abs(bjP.x)>.11 && bjP.y>1.29 && bjP.y<1.405', outer.colors.main);
    paint('bjP.z < -.015 && bjP.y>1.21 && bjP.y<1.395 && abs(bjP.x)<(bjP.y-1.21)*.40', '#fff5e9');
  }
  if (captain) {
    paint('abs(bjP.x)<.041 && bjP.y>1.345 && bjP.y<1.418', shirt);
    paint('abs(bjP.x)<.041 && bjP.y>1.375 && bjP.y<1.418 && (abs(bjP.x)>.029 || abs(bjP.x)<.004)', '#fff4e8');
    paint('abs(bjP.x)>.49 && abs(bjP.x)<.535 && bjP.y>1.285', '#fff4e8');
    paint('abs(bjP.x)<.123 && bjP.y>.997 && bjP.y<1.024', '#39222c');
    paint('bjP.z<-.035 && abs(bjP.x-.07)<.004 && bjP.y>1.03 && bjP.y<1.34', '#e8c787');
  }
  if (tux) {
    paint('bjP.z<-.015 && bjP.y>1.265 && bjP.y<1.40 && abs(bjP.x)<(bjP.y-1.265)*.28', '#fff9ee');
    paint('abs(bjP.x)<.039 && bjP.y>1.357 && bjP.y<1.397', '#fff9ee');
  }
  if (top?.id === 'top-tie' && !outer) paint('abs(bjP.x)<.13 && bjP.y>1.31 && bjP.y<1.39', '#f8f4ed');
  const mat = new T.MeshStandardMaterial({color:byId(SKIN, cfg.body.skin).base,roughness:layer?(swim?.46:.68):.58,metalness:0,bumpMap:cfg.renderStyle==='realistic'?skinDetail():null,bumpScale:layer?.00005:.00012});
  mat.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec3 bjRest;\nvarying vec3 bjP;\nvarying vec3 bjShapeP;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nbjP = bjRest;bjShapeP=position;');
    shader.fragmentShader = `varying vec3 bjP;\nvarying vec3 bjShapeP;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>\nbool bjClothed = false;int bjTextile=0;float bjTension=0.;\n${code.join('\n')}\n${textileShader}\n${layer?'if(!bjClothed) discard;':`if(!bjClothed){float ky=(bjP.y-.51)/.038,ex=(abs(bjP.x)-.33)/.028;float knee=exp(-ky*ky);float elbow=exp(-ex*ex)*step(1.30,bjP.y);diffuseColor.rgb=mix(diffuseColor.rgb,${colorCode(byId(SKIN,cfg.body.skin).shadow)},max(knee,elbow)*.10);}`}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(bjTextile>0)roughnessFactor=bjTextile==5?.3:bjTextile==3?.87:bjTextile==4?.94:bjTextile==2?.72:.82;');
  };
  mat.userData.coverage=code.join('\n');mat.userData.fitLayer=layer;
  mat.customProgramCacheKey = () => `bijou-surface-3|${cfg.body.skin}|${layer}|${code.join(';')}`;
  return applyFinish(mat,cfg.renderStyle,layer?'fabric':'skin');
}

export function surfaceDepthMaterial(surface){
  const material=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
  const code=surface.userData.coverage,layer=surface.userData.fitLayer;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute vec3 bjRest;varying vec3 bjP;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nbjP=bjRest;');
    shader.fragmentShader=`varying vec3 bjP;\n${shader.fragmentShader}`.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\nbool bjClothed=false;int bjTextile=0;float bjTension=0.;${code}\n${layer?'if(!bjClothed)discard;':''}`);
  };
  material.customProgramCacheKey=()=>`bijou-coverage-depth|${layer}|${code}`;return material;
}

const greyMaps = new WeakMap();
function neutralMap(map) {
  if (!map?.image) return map;
  if (greyMaps.has(map)) return greyMaps.get(map);
  const canvas = document.createElement('canvas');
  canvas.width = map.image.width; canvas.height = map.image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(map.image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i=0; i<data.data.length; i+=4) {
    const l = Math.max(data.data[i], data.data[i+1], data.data[i+2]);
    data.data[i] = data.data[i+1] = data.data[i+2] = l;
  }
  ctx.putImageData(data, 0, 0);
  const out = new T.CanvasTexture(canvas); out.flipY = map.flipY; out.colorSpace = T.SRGBColorSpace;
  greyMaps.set(map, out); return out;
}

export function personalizeMaterials(vrm, cfg) {
  const hair = byId(HAIR, cfg.head.hair), eyes = byId(EYES, cfg.head.eyes);
  const skin = byId(SKIN, cfg.body.skin);
  for (const mat of vrm.materials) {
    if (/HAIR/.test(mat.name)) {
      if (!mat.userData.bijouMap) mat.userData.bijouMap = neutralMap(mat.map);
      mat.map = mat.userData.bijouMap;
      mat.shadeMultiplyTexture=mat.map;
      mat.color.set(hair.base); mat.shadeColorFactor?.set(hair.shadow);
      mat.emissive?.set('#000000'); mat.matcapFactor?.set(cfg.renderStyle==='realistic'?'#46323d':'#000000');mat.parametricRimColorFactor?.set('#000000');
      mat.outlineColorFactor?.set(hair.line); mat.outlineWidthFactor = .001;
      mat.shadingToonyFactor = .78; mat.shadingShiftFactor = -.1;
      applyFinish(mat,cfg.renderStyle,'hair');
    } else if (/EyeIris/.test(mat.name)) {
      if (!mat.userData.bijouMap) mat.userData.bijouMap = neutralMap(mat.map);
      mat.map = mat.userData.bijouMap; mat.color.set(eyes.base); mat.shadeColorFactor?.set(eyes.base);
      mat.shadeMultiplyTexture=mat.map;
    } else if (/Face_00_SKIN/.test(mat.name)) {
      if(!mat.userData.bijouMap)mat.userData.bijouMap=neutralMap(mat.map);
      mat.map=mat.userData.bijouMap;mat.shadeMultiplyTexture=mat.map;
      mat.color.set(skin.base); mat.shadeColorFactor?.set(skin.shadow);
      mat.outlineWidthFactor = cfg.renderStyle==='anime2d'?.0013:.0008; mat.shadingToonyFactor = cfg.renderStyle==='realistic'?.15:.85;
      applyFinish(mat,cfg.renderStyle,'face');
    } else if (/FaceBrow/.test(mat.name)) mat.color.set(hair.deep);
    mat.needsUpdate = true;
  }
}

const fabricMaps = new Map();
const grainMaps=new Map();
function clothGrain(kind){
  if(grainMaps.has(kind))return grainMaps.get(kind);
  const size=256,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const weave=kind==='denim'?Math.sin((x+y)*Math.PI/3):kind==='knit'?Math.sin((x+Math.abs(y%16-8))*.65):kind==='satin'?Math.sin(y*.06):Math.sin(x*1.7)*Math.sin(y*2.3);
    const value=Math.round(245+weave*(kind==='knit'?10:kind==='denim'?9:3));pixels.set([value,value,value,255],(y*size+x)*4);
  }
  const map=new T.DataTexture(pixels,size,size,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4,2);map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  grainMaps.set(kind,map);return map;
}
export function fabric(item,style) {
  const mat = style==='realistic'?new T.MeshStandardMaterial({color:item.colors.main,roughness:{satin:.3,denim:.87,knit:.94,jersey:.72}[item.fabric]||.82,side:T.DoubleSide}):toon(item.colors.main, { side: T.DoubleSide });
  if(item.fabric&&!item.pattern){mat.map=clothGrain(item.fabric);return mat;}
  if (!item.pattern) return mat;
  const key=JSON.stringify([item.id,item.colors,item.pattern]);
  if (!fabricMaps.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = item.colors.main; ctx.fillRect(0,0,256,256);
    ctx.fillStyle = item.colors.pattern || item.colors.trim || '#ffffff';
    if (['plaid','gingham'].includes(item.pattern)) {
      ctx.globalAlpha=.3;
      for(let i=0;i<256;i+=64){ctx.fillRect(i,0,25,256);ctx.fillRect(0,i,256,25)}
      ctx.globalAlpha=.75;
      for(let i=6;i<256;i+=64){ctx.fillRect(i,0,2,256);ctx.fillRect(0,i,256,2)}
    } else if (item.pattern==='stripes'||item.pattern==='knit') {
      ctx.globalAlpha=.35;for(let i=0;i<256;i+=24)ctx.fillRect(0,i,256,7);
    } else {
      ctx.globalAlpha=.55;for(let x=20;x<256;x+=48)for(let y=20;y<256;y+=48){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()}
    }
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(3,1.4);
    fabricMaps.set(key,tex);
  }
  mat.map=fabricMaps.get(key);mat.color.set('#ffffff');return mat;
}
