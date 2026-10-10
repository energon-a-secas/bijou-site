// A shared lighting treatment keeps painted faces, sculpted hair and skin in
// the same visual language. Physical rendering remains available separately.
import { cleanRenderStyle } from './render-style.js';

export function applyFinish(material,value='anime3d',kind='fabric'){
  if(material.isMeshBasicMaterial)return material;
  const style=cleanRenderStyle(value);
  if(material.userData.finish){
    const changed=material.userData.finish.style!==style;
    material.userData.finish.style=style;material.userData.finish.kind=kind;
    if(changed)material.needsUpdate=true;
    return material;
  }
  const settings={style,kind};material.userData.finish=settings;
  const compile=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);
    const {style,kind}=settings;if(style==='realistic'||material.isOutline)return;
    const face=kind==='face',hair=kind==='hair',flat=style==='anime2d';
    // View-space light direction works when the inspection camera orbits.
    const lighting=`
      float bjLight=dot(normal,normalize(vec3(-.42,.65,.64)));
      #if NUM_DIR_LIGHTS > 0
        bjLight=dot(normal,directionalLights[0].direction);
      #endif
      float bjBand=${flat?'smoothstep(.04,.065,bjLight)':'smoothstep(-.35,.94,bjLight)'};
      vec3 bjShade=diffuseColor.rgb*vec3(${hair?'0.48,0.40,0.62':face?'0.79,0.61,0.65':flat?'0.70,0.53,0.61':'0.51,0.37,0.43'});
      vec3 bjLit=mix(bjShade,diffuseColor.rgb,bjBand);
      ${hair&&!flat?'bjLit+=diffuseColor.rgb*.18*pow(max(0.,bjLight),8.);':''}
      ${!face?'bjLit*=mix(.91,1.,getShadowMask());':''}
    `;
    if(!face&&!shader.fragmentShader.includes('#include <shadowmask_pars_fragment>'))shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
    const mtoon=shader.fragmentShader.includes('vec3 col = reflectedLight.directDiffuse');
    if(mtoon){
      shader.fragmentShader=shader.fragmentShader.replace('vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',`${lighting}\nvec3 col = bjLit;`);
    }else{
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`${lighting}\noutgoingLight=bjLit;\n#include <opaque_fragment>`);
    }
  };
  material.customProgramCacheKey=()=>`${key()}|finish-v1|${settings.style}|${settings.kind}`;
  material.needsUpdate=true;return material;
}
