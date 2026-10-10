import {addStudioColor} from './model-surface-color.js';
import {STYLE_DEFAULTS} from './model-style.js';
import * as T from './vendor/avatar-engine.js';

// Studio-only material treatment. Physical and cel previews share color masks;
// the physical mode keeps actual light response and controlled microdetail.
export function applyModelFinish(material,style,anchors={},eyes=null,hairColor=null,settings=STYLE_DEFAULTS,clothes=null,landmarks={}){
  if(style==='clay')return material;
  const anime=['anime3d','anime2d'].includes(style);
  material.normalScale?.setScalar(anime?.08+settings.detail*.18:.08+settings.detail*.5);
  material.aoMapIntensity=anime?.15:.35;material.roughness=1;material.metalness=0;material.roughnessMap=null;material.metalnessMap=null;
  material.envMapIntensity=anime?.12:.55;
  addStudioColor(material,settings,anchors,eyes,hairColor,false,clothes,landmarks);
  const original=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    original(shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=studioRoughness(studioOriginal);');
    if(!anime){
      const physical=T.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`
        float studyWrap=studio_lightWrap*.35*studioSkin(material.diffuseColor);
        float studyWrapped=max(0.,dot(geometryNormal,directLight.direction)+studyWrap)/pow(1.+studyWrap,2.);
        reflectedLight.directDiffuse += studyWrapped*directLight.color*BRDF_Lambert(material.diffuseColor);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',physical);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float studyPore=sin(studyPoint.x*6200.)*sin(studyPoint.y*5700.+studyPoint.z*3700.);
        float studySkin=studioSkin(diffuseColor.rgb);
        normal=normalize(normal+vec3(studyPore,sin(studyPoint.y*7200.)*.5,0.)*studio_pores*studySkin*.025);
      `);return;
    }
    const lighting=`
      vec3 studyBase=diffuseColor.rgb;
      float studyFace=smoothstep(${(anchors.eye??1.537)-.17},${(anchors.eye??1.537)-.10},studyPoint.y)*step(.02,studyPoint.z);
      float studyLight=dot(normal,normalize(vec3(-.42,.65,.64)));
      #if NUM_DIR_LIGHTS > 0
        studyLight=dot(normal,directionalLights[0].direction);
      #endif
      float studyBand=${style==='anime2d'?'smoothstep(.02,.05,studyLight)':'smoothstep(-.42,.82,studyLight)'};
      vec3 studyShade=mix(vec3(.69,.56,.66),vec3(.85,.76,.79),studyFace);
      studyShade=mix(studyShade,vec3(.51,.37,.43),studioCovered);
      outgoingLight=studyBase*mix(studyShade,vec3(1.04,1.02,1.),studyBand);
      float studyHair=studioHairMask(studioOriginal);
      vec3 studyHalf=normalize(normalize(vViewPosition)+vec3(-.30,.72,.64));
      float studySheen=pow(max(0.,dot(normal,studyHalf)),22.);
      outgoingLight+=studyHair*mix(studyBase,vec3(.18,.155,.20),.5)*studySheen*${style==='anime2d'?'.14':'.36'};
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',lighting+'\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>cache+'|finish-'+style;material.needsUpdate=true;return material;
}
