import * as T from './vendor/avatar-engine.js';
import {smooth} from './model-shape.js';

// Bake only at export. Interactive recoloring uses the same geometric mask in
// the preview shader; the immutable source image is never changed.
export function bakeHairTint(record,texture,color,eye){
  const source=texture.image,canvas=document.createElement('canvas'),mask=document.createElement('canvas');
  canvas.width=mask.width=source.width;canvas.height=mask.height=source.height;
  const context=canvas.getContext('2d',{willReadFrequently:true}),paint=mask.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);
  const uv=record.node.geometry.attributes.uv,index=record.index,points=record.points;
  for(let at=0;at<index.count;at+=3){
    const ids=[index.getX(at),index.getX(at+1),index.getX(at+2)],p=[0,1,2].map(k=>ids.reduce((n,i)=>n+points[i*3+k],0)/3);
    const eyeMask=(1-smooth(.8,1.12,Math.hypot((Math.abs(p[0])-.040)/.033,(p[1]-eye+.008)/.020)))*(1-smooth(.092,.100,p[2]));
    const weight=(1-eyeMask)*smooth(eye-.300,eye-.270,p[1]);if(weight<.001)continue;
    paint.fillStyle=`rgba(255,255,255,${weight})`;paint.beginPath();
    for(const [j,i]of ids.entries()){const x=uv.getX(i)*canvas.width,y=(texture.flipY?1-uv.getY(i):uv.getY(i))*canvas.height;if(j===0)paint.moveTo(x,y);else paint.lineTo(x,y);}
    paint.closePath();paint.fill();
  }
  const pixels=context.getImageData(0,0,canvas.width,canvas.height),alpha=paint.getImageData(0,0,canvas.width,canvas.height).data,hair=new T.Color(color).toArray();
  const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,srgb=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
  for(let i=0;i<pixels.data.length;i+=4){
    if(!alpha[i+3])continue;const rgb=[0,1,2].map(k=>linear(pixels.data[i+k]/255)),weight=(1-smooth(.020,.090,Math.max(...rgb)))*alpha[i+3]/255;if(weight<.001)continue;
    for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(Math.min(1,srgb(rgb[k]*(1-weight)+hair[k]*(.78+Math.min(.22,rgb[0]*4))*weight))*255);
  }
  context.putImageData(pixels,0,0);const result=texture.clone();result.source=new T.Source(canvas);result.needsUpdate=true;return result;
}
