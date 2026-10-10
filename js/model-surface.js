import { smooth } from './model-shape.js';

// Read the original atlas for semantic masks; never rewrite its pixels.
export function createAtlasSampler(mesh){
  const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material,texture=material.map,image=texture?.image;
  if(!image){const sample=()=>({cloth:0,skin:1,color:[1,.8,.7]});sample.triangle=sample;return sample;}
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const {data}=context.getImageData(0,0,canvas.width,canvas.height),uv=mesh.geometry.attributes.uv;
  function read(u,rawV){
    const x=Math.max(0,Math.min(canvas.width-1,Math.floor(u*canvas.width)));
    const v=texture.flipY?1-rawV:rawV,y=Math.max(0,Math.min(canvas.height-1,Math.floor(v*canvas.height)));
    const at=(y*canvas.width+x)*4,r=data[at]/255,g=data[at+1]/255,b=data[at+2]/255;
    return {cloth:smooth(.05,.18,(Math.min(g,b)-r)/(.1+Math.max(r,g,b))),skin:smooth(.012,.075,r-Math.min(g,b)),color:[r,g,b]};
  }
  const sample=index=>read(uv.getX(index),uv.getY(index));
  // Sample inside the UV island. Border vertices can land on unpadded gray
  // atlas pixels and falsely cut holes at the source shorts/skin boundary.
  sample.triangle=(a,b,c)=>read((uv.getX(a)+uv.getX(b)+uv.getX(c))/3,(uv.getY(a)+uv.getY(b)+uv.getY(c))/3);
  return sample;
}
