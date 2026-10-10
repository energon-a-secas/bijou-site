// Procedural fabric is attached to rest coordinates and antialiased at distance.
// Local surface area change supplies tension detail as the body is reshaped.
export const fabricId=name=>({cotton:1,jersey:2,denim:3,knit:4,satin:5}[name]||0);
export const textileShader=`
  if(bjTextile>0){
    float footprint=max(length(dFdx(bjP)),length(dFdy(bjP)));
    float detail=1.-smoothstep(.00012,.0005,footprint);
    float area=length(cross(dFdx(bjP),dFdy(bjP)));
    float shaped=length(cross(dFdx(bjShapeP),dFdy(bjShapeP)));
    float strain=clamp(sqrt(shaped/max(area,1.e-12))-1.,0.,1.);
    float weave=sin((bjP.x+bjP.y)*6300.)*sin((bjP.x-bjP.y)*4700.);
    float grain=weave*.024*detail;
    if(bjTextile==3){
      grain=sin((bjP.x+bjP.y)*5800.)*.065*detail;
      float wash=exp(-pow((bjP.y-.75)/.15,2.))*.055+exp(-pow((bjP.y-.5)/.06,2.))*.045;
      grain+=wash;
      float sideX=mix(.055,.141,smoothstep(.26,.91,bjP.y));
      float seam=1.-smoothstep(.0009,.0025,abs(abs(bjP.x)-sideX));
      float stitch=seam*step(.44,fract(bjP.y*220.));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.46,.31,.15),stitch*.42);
    }
    if(bjTextile==4)grain=(sin(bjP.x*1800.)*.06+sin(bjP.y*3400.)*.025)*detail;
    if(bjTextile==5)grain=sin(bjP.y*42.)*.02;
    float tension=sin(bjP.y*370.+abs(bjP.x)*55.)*exp(-pow((bjP.y-1.08)/.055,2.));
    float kneeFold=sin(bjP.y*290.+bjP.x*30.)*exp(-pow((bjP.y-.53)/.038,2.));
    grain+=(tension+kneeFold)*(.012+strain*.09)*bjTension;
    diffuseColor.rgb*=1.+grain;
  }
`;
