import * as T from './vendor/avatar-engine.js';
import {addStudioColor} from './model-surface-color.js';

// Render the exact preview color masks in UV space. No CPU approximation and
// no readback/mutation of a source texture. Empty islands retain source pixels.
export function bakeStudioAtlas(renderer,record,texture,style,hairColor,anchors,eyes,roughness=false,clothes=null,landmarks={}){
  const image=texture.image,width=image.width,height=image.height;
  const target=new T.WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false});
  target.texture.colorSpace=roughness?T.NoColorSpace:T.SRGBColorSpace;
  const material=addStudioColor(new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true,blending:T.NoBlending}),style,anchors,eyes,hairColor,roughness,clothes,landmarks);
  const compile=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,r)=>{compile(shader,r);shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`gl_Position=vec4(uv.x*2.-1.,${texture.flipY?'1.-uv.y*2.':'uv.y*2.-1.'},0.,1.);`);};
  const geometry=record.node.geometry.clone();geometry.setIndex(record.index.clone());
  const scene=new T.Scene(),mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  const camera=new T.Camera(),previousTarget=renderer.getRenderTarget(),previousTone=renderer.toneMapping,previousAuto=renderer.autoClear;
  const previousColor=renderer.getClearColor(new T.Color()),previousAlpha=renderer.getClearAlpha();
  try{
    renderer.toneMapping=T.NoToneMapping;renderer.autoClear=true;renderer.setClearColor(0,0);renderer.setRenderTarget(target);renderer.render(scene,camera);
    const data=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,data);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});
    if(roughness){context.fillStyle='#ffad00';context.fillRect(0,0,width,height);}else context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,width,height);
    for(let i=0;i<data.length;i+=4)if(data[i+3]){pixels.data[i]=data[i];pixels.data[i+1]=data[i+1];pixels.data[i+2]=data[i+2];pixels.data[i+3]=roughness?255:data[i+3];}
    context.putImageData(pixels,0,0);
    const baked=texture.clone();baked.source=new T.Source(canvas);baked.colorSpace=roughness?T.NoColorSpace:texture.colorSpace;baked.needsUpdate=true;return baked;
  }finally{
    renderer.setRenderTarget(previousTarget);renderer.setClearColor(previousColor,previousAlpha);renderer.toneMapping=previousTone;renderer.autoClear=previousAuto;
    material.dispose();geometry.dispose();target.dispose();
  }
}
