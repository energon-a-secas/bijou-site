import * as T from './vendor/avatar-engine.js';

// Fine longitudinal variation complements the broad sculpted locks. Reusable
// local maps export with the hair; this is a strand finish, not a strand groom.
export function createHairSurface(){
  const width=256,height=512,color=new Uint8Array(width*height*4),normal=new Uint8Array(color.length),rough=new Uint8Array(color.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,phase=u*Math.PI*128+Math.sin(v*9.)*.25;
    const fiber=Math.sin(phase)*.016+Math.sin(phase*1.7+2.)*.018,broad=.95+.025*Math.cos(u*Math.PI*12),at=(y*width+x)*4;
    const tone=Math.round((broad+fiber)*255),bump=Math.cos(phase)*5.;
    color.set([tone,tone,tone,255],at);normal.set([Math.round(128+bump),128,254,255],at);rough.set([255,Math.round((.82-fiber)*255),0,255],at);
  }
  const texture=(data,space)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);const t=new T.CanvasTexture(canvas);t.flipY=false;t.colorSpace=space;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  const map=texture(color,T.SRGBColorSpace),normalMap=texture(normal,T.NoColorSpace),roughnessMap=texture(rough,T.NoColorSpace);
  return {map,normalMap,roughnessMap,dispose(){map.dispose();normalMap.dispose();roughnessMap.dispose();}};
}
