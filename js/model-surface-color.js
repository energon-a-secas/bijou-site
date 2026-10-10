import * as T from './vendor/avatar-engine.js';
import {cleanModelStyle} from './model-style.js';

// The same color and roughness expressions run in the interactive material and
// the UV-space export bake. Masks live in immutable rest metres, not the camera.
export function studioColorParts(input={},anchors={},eyes=null,hairColor=null,clothes=null,landmarks={}){
  const s=cleanModelStyle(input),eye=anchors.eye??1.537,mouth=anchors.mouth??1.465;
  const centers=eyes||[{x:-.043,y:eye-.006},{x:.043,y:eye-.006}];
  const uniforms={};
  for(const [id,value]of Object.entries(s))if(typeof value==='number')uniforms['studio_'+id]={value};
  for(const id of ['skinColor','blushColor','lipColor','eyeColor'])uniforms['studio_'+id]={value:new T.Color(s[id])};
  uniforms.studio_hairColor={value:new T.Color(hairColor||'#39303e')};uniforms.studio_hairTint={value:hairColor?1:0};
  uniforms.studio_topColor={value:new T.Color(clothes?.topColor||'#829da3')};uniforms.studio_bottomColor={value:new T.Color(clothes?.bottomColor||'#354953')};
  uniforms.studio_topTint={value:clothes&&clothes.top!=='source'?1:0};uniforms.studio_bottomTint={value:clothes&&clothes.bottom!=='source'?1:0};
  const header=`varying vec3 studyPoint; varying float studySkinHint; varying float studyHairHint; varying float studyEyeHint; varying float studyClothHint;
    ${Object.keys(uniforms).map(id=>`uniform ${uniforms[id].value.isColor?'vec3':'float'} ${id};`).join('\n')}
    float studioBell(float v,float center,float radius){float t=(v-center)/radius;return exp(-t*t*3.);}
    float studioHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    vec2 studioEyeCenter(){return studyPoint.x<0.?vec2(${centers[0].x},${centers[0].y}):vec2(${centers[1].x},${centers[1].y});}
    float studioEyeRadius(){return studyPoint.x<0.?${centers[0].radius||.0128}:${centers[1].radius||.0128};}
    float studioEyeMask(){return studyEyeHint*(1.-smoothstep(.83,1.08,length((studyPoint.xy-studioEyeCenter())/vec2(.0295,.0145))))*smoothstep(.045,.065,studyPoint.z)*(1.-smoothstep(.091,.101,studyPoint.z));}
    float studioLowerFace(){return (1.-smoothstep(.048,.070,abs(studyPoint.x)))*smoothstep(${eye-.150},${eye-.120},studyPoint.y)*(1.-smoothstep(${eye-.024},${eye-.018},studyPoint.y))*smoothstep(.030,.058,studyPoint.z);}
    float studioSkin(vec3 base){
      float hue=smoothstep(.006,.05,base.r-min(base.g,base.b))*smoothstep(.10,.35,base.r)*smoothstep(.40,.63,base.g/max(.001,base.r));
      float face=studioLowerFace(),hint=smoothstep(.10,.50,studySkinHint);
      return max(max(hue,hint),face)*max(max(face,hint),smoothstep(.055,.15,max(base.r,max(base.g,base.b))))*(1.-studioEyeMask());
    }
    float studioHairMask(vec3 base){
      float dark=1.-smoothstep(.020,.090,max(base.r,max(base.g,base.b)));
      float semantic=smoothstep(.18,.65,studyHairHint)*(1.-smoothstep(.18,.60,studySkinHint));
      float eyeBorder=(1.-smoothstep(.80,1.12,length(vec2((abs(studyPoint.x)-.040)/.033,(studyPoint.y-${eye-.008})/.020))))*(1.-smoothstep(.092,.100,studyPoint.z));
      return step(-.5,studyHairHint)*max(semantic,dark*max(studyHairHint,smoothstep(${eye-.300},${eye-.270},studyPoint.y)))*(1.-eyeBorder)*(1.-studioLowerFace());
    }
    vec3 studioRestoredEye(vec3 base){
      vec2 p=studyPoint.xy-studioEyeCenter();
      float r=length(p/studioEyeRadius()/(1.+studio_irisScale*.25)),angle=atan(p.y,p.x);
      float fiber=.78+.10*sin(angle*61.+r*23.)+.06*sin(angle*113.-r*11.);
      vec3 pigment=mix(vec3(.20,.078,.035),studio_eyeColor,studio_eyeTint);
      vec3 iris=pigment*fiber*(.70+.30*studioBell(r,.60,.38));
      iris*=1.-studio_limbal*.72*smoothstep(.77,1.,r);
      float pupil=1.-smoothstep(.23+studio_pupilSize*.13,.30+studio_pupilSize*.13,r);
      iris=mix(iris,vec3(.003,.005,.007),pupil);
      float corner=smoothstep(.018,.029,abs(p.x));
      vec3 sclera=mix(vec3(.78,.76,.73),vec3(.56,.32,.30),corner*.25);
      vec3 surface=mix(sclera,iris,1.-smoothstep(.95,1.04,r));
      float lum=dot(base,vec3(.2126,.7152,.0722));
      float lash=(1.-smoothstep(.014,.055,lum))*smoothstep(.70,1.1,r);
      // Preserve the captured lash silhouette and small authored catchlights.
      surface=mix(surface,base,lash);
      return mix(surface,base,smoothstep(.62,.92,lum)*(1.-smoothstep(.65,.88,r)));
    }
    float studioLipMask(){return studioBell(studyPoint.x,0.,.030)*studioBell(studyPoint.y,${mouth},.0075)*smoothstep(.05,.075,studyPoint.z);}
    float studioRoughness(vec3 base){
      float skin=studioSkin(base),lip=studioLipMask(),eyes=studioEyeMask()*smoothstep(.010,.045,dot(base,vec3(.2126,.7152,.0722)));
      float result=mix(.68,.30+studio_roughness*.48,skin);
      result=mix(result,.24+studio_hairRoughness*.48,studioHairMask(base));
      result=mix(result,.49-studio_lipGloss*.35,lip);
      return mix(result,.30-studio_eyeGloss*.22,eyes);
    }
  `;
  const color=`
    vec3 studioOriginal=diffuseColor.rgb;
    float studioEyes=studioEyeMask();float studioSkinWeight=studioSkin(studioOriginal);
    float studioLum=dot(studioOriginal,vec3(.2126,.7152,.0722));
    vec3 studioClean=studio_skinColor*(.97+.04*clamp(studioLum/.6,0.,1.2));
    diffuseColor.rgb=mix(studioOriginal,studioClean,studio_skinBlend*studioSkinWeight);
    float studioCheek=(studioBell(abs(studyPoint.x),.044,.030)*studioBell(studyPoint.y,${eye-.035},.023)+studioBell(studyPoint.x,0.,.012)*studioBell(studyPoint.y,${eye-.04},.012)*.35)*studioSkinWeight;
    diffuseColor.rgb=mix(diffuseColor.rgb,studio_blushColor,studioCheek*studio_blush*.32);
    vec2 studioCell=floor(studyPoint.xy*720.),studioCellUV=fract(studyPoint.xy*720.)-.5;
    float studioDot=1.-smoothstep(.075,.145,length(studioCellUV+vec2(studioHash(studioCell+2.)-.5,studioHash(studioCell+7.)-.5)*.45));
    float studioFreckle=studioDot*step(1.-studio_freckles*.40,studioHash(studioCell))*studioCheek;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.095,.049),studioFreckle*.65);
    float studioLip=studioLipMask();
    diffuseColor.rgb=mix(diffuseColor.rgb,studio_lipColor,studioLip*studio_lipTint*.8);
    float studioLipCurve=${mouth}-.0015+.0018*pow(clamp(abs(studyPoint.x)/.027,0.,1.),2.);
    float studioLipSeam=studioBell(studyPoint.y,studioLipCurve,.0015)*studioBell(studyPoint.x,0.,.028)*smoothstep(.05,.075,studyPoint.z);
    diffuseColor.rgb*=1.-studioLipSeam*studio_lipTint*.30;
    vec2 studioIrisUV=(studyPoint.xy-studioEyeCenter())/vec2(.0165,.019)/(1.+studio_irisScale*.23);
    float studioIrisRadius=length(studioIrisUV),studioAngle=atan(studioIrisUV.y,studioIrisUV.x);
    float studioIris=(1.-smoothstep(.91,1.06,studioIrisRadius))*studioEyes;
    float studioFibers=.91+.045*sin(studioAngle*47.+studioIrisRadius*19.)+.04*sin(studioAngle*91.-studioIrisRadius*14.);
    vec3 studioIrisColor=studio_eyeColor*studioFibers*(.50+min(.70,studioLum*2.2));
    studioIrisColor*=1.-studio_limbal*.42*smoothstep(.73,1.,studioIrisRadius);
    float studioPupil=(1.-smoothstep(.22+studio_pupilSize*.08,.31+studio_pupilSize*.08,studioIrisRadius))*max(0.,studio_pupilSize);
    studioIrisColor=mix(studioIrisColor,vec3(.006,.008,.012),studioPupil);
    // The original white/lash border limits the iris treatment to the opening.
    float studioOriginalIris=(1.-smoothstep(.48,.64,studioOriginal.g/max(.001,studioOriginal.r)))*smoothstep(.005,.015,studioOriginal.r)*(1.-smoothstep(.4,.6,studioOriginal.r))*studioEyes;
    vec3 studioRecolored=studio_eyeColor*(.55+studioLum*1.8);
    diffuseColor.rgb=mix(diffuseColor.rgb,studioRecolored,studioOriginalIris*studio_eyeTint);
    diffuseColor.rgb=mix(diffuseColor.rgb,studioIrisColor,studioIris*studioOriginalIris*studio_eyeTint);
    diffuseColor.rgb=mix(diffuseColor.rgb,studioRestoredEye(studioOriginal),studioEyes*studio_eyeRestoration);
    float studioLash=(1.-smoothstep(.012,.07,studioLum))*studioEyes;
    diffuseColor.rgb*=1.-studioLash*studio_eyeliner*.38;
    float studioUpper=step(${(landmarks.waist??1.08)-.065},studyPoint.y);
    float studioCovered=smoothstep(.18,.55,studyClothHint)*mix(studio_bottomTint,studio_topTint,studioUpper);
    vec3 studioFabric=mix(studio_bottomColor,studio_topColor,studioUpper)*(.78+.22*clamp(studioLum/.20,0.,1.));
    diffuseColor.rgb=mix(diffuseColor.rgb,studioFabric,studioCovered);
    float studioHair=studioHairMask(studioOriginal)*studio_hairTint;
    float studioHairPhase=atan(studyPoint.x,studyPoint.z+.025)*540.+sin(studyPoint.y*14.)*.35;
    float studioFiberFade=1.-smoothstep(.6,1.6,fwidth(studioHairPhase));
    float studioStrands=1.+studio_hairDetail*studioFiberFade*(sin(studioHairPhase)*.12+sin(studioHairPhase*1.71+2.)*.07);
    diffuseColor.rgb=mix(diffuseColor.rgb,studio_hairColor*(.82+min(.18,studioOriginal.r*4.))*studioStrands,studioHair);
  `;
  return {uniforms,header,color};
}
export function addStudioColor(material,input,anchors,eyes,hairColor,roughnessBake=false,clothes=null,landmarks={}){
  const parts=studioColorParts(input,anchors,eyes,hairColor,clothes,landmarks),previous=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous(shader,renderer);Object.assign(shader.uniforms,parts.uniforms);
    shader.vertexShader='attribute vec3 studyRest; attribute float studySurface; attribute float studyHair; attribute float studyEye; attribute float studyCloth; varying vec3 studyPoint; varying float studySkinHint; varying float studyHairHint; varying float studyEyeHint; varying float studyClothHint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstudyPoint=studyRest; studySkinHint=studySurface; studyHairHint=studyHair; studyEyeHint=studyEye; studyClothHint=studyCloth;');
    shader.fragmentShader=parts.header+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+(roughnessBake?'diffuseColor.rgb=vec3(1.,studioRoughness(diffuseColor.rgb),0.);':parts.color));
  };
  material.customProgramCacheKey=()=>JSON.stringify(['studio-color-6',input,anchors,eyes,hairColor,roughnessBake,clothes,landmarks]);
  return material;
}
