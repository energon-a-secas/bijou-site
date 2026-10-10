import * as T from '../js/vendor/avatar-engine.js';
import {cleanModelLight} from '../js/model-style.js';

function studioEnvironment(renderer){
  const width=256,height=128,data=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,softbox=(cx,cy,rx,ry)=>Math.exp(-(((u-cx)/rx)**8+((v-cy)/ry)**8));
    const warm=softbox(.24,.37,.055,.21)*3.5,cool=softbox(.70,.4,.03,.18)*2.2;
    const at=(y*width+x)*4;data[at]=.12+warm+cool*.74;data[at+1]=.13+warm*.92+cool*.84;data[at+2]=.16+warm*.84+cool;data[at+3]=1;
  }
  const source=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);source.mapping=T.EquirectangularReflectionMapping;source.needsUpdate=true;
  const pmrem=new T.PMREMGenerator(renderer),result=pmrem.fromEquirectangular(source);source.dispose();pmrem.dispose();return result;
}
export function createStudioLight(scene,renderer,viewport){
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.42;
  const hemi=new T.HemisphereLight('#fff4ec','#66708c',.7),key=new T.DirectionalLight('#fff1e8',2.4),fill=new T.DirectionalLight('#d9e6ff',.6),rim=new T.DirectionalLight('#d6e7ff',1.4);
  key.target.position.set(0,1.25,0);fill.position.set(3,2,4);rim.position.set(2,3,-4);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.5;key.shadow.camera.right=1.5;key.shadow.camera.top=1.7;key.shadow.camera.bottom=-1.7;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.bias=-.00008;key.shadow.normalBias=.002;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene.add(hemi,key,key.target,fill,rim);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#e8dcd3',roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);
  let settings=cleanModelLight();
  function set(input){
    settings=cleanModelLight(input);const {stage,azimuth,elevation,exposure}=settings;
    const backgrounds={ivory:'#f4eee8',midnight:'#121b2b',slate:'#353e49'},floors={ivory:'#e8dcd3',midnight:'#151e2e',slate:'#343e4a'};
    scene.background=new T.Color(backgrounds[stage]);scene.fog=new T.Fog(backgrounds[stage],2.5,10);floor.material.color.set(floors[stage]);viewport.dataset.studioStage=stage;
    const yaw=azimuth*Math.PI*.72,vertical=.2+elevation*1.12;
    key.position.set(Math.sin(yaw)*Math.cos(vertical)*5,1.25+Math.sin(vertical)*5,Math.cos(yaw)*Math.cos(vertical)*5);
    hemi.intensity=.3+settings.fill*.85;fill.intensity=settings.fill*1.2;rim.intensity=settings.rim*2.6;renderer.toneMappingExposure=exposure;
  }
  set(settings);return {set,get settings(){return {...settings};},dispose(){environment.dispose();floor.geometry.dispose();floor.material.dispose();key.shadow.dispose();}};
}
