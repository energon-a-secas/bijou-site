const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('assets/studies'),near=(a,b,e=.00001)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://localhost:8897/dev/model-studio.html?model=t2');await page.waitForFunction(()=>window.ready,{timeout:60000});
    await page.evaluate(()=>modelStudio.selectCandidate('human'));
    assert(await page.locator('#walk').isDisabled());assert.equal(await page.locator('#candidate option[value=human]').count(),0);
    const report=await page.evaluate(async()=>{
      const T=await import('/js/vendor/avatar-engine.js'),{MODEL_CONTROLS,MODEL_DEFAULTS,MODEL_PRESETS}=await import('/js/model-shape.js'),{FACE_CONTROLS}=await import('/js/model-face-details.js');
      const {APPEARANCE_DEFAULTS}=await import('/js/model-appearance.js'),{CLOTHES_DEFAULTS}=await import('/js/model-clothes.js'),{HAIR_DEFAULTS,SOURCE_GAZE}=await import('/js/model-persona.js');
      const s=modelStudio.stage,sourceHair={...HAIR_DEFAULTS,style:'textured'},look=(shape=MODEL_DEFAULTS,face=APPEARANCE_DEFAULTS,clothes=CLOTHES_DEFAULTS,hair=sourceHair)=>s.setLook(shape,face,clothes,hair,SOURCE_GAZE);
      look();const base=s.sculpt.snapshot(),body=s.sculpt.records.find(r=>r.node.name==='Adult_continuous_body'),times=[];
      if(s.sculpt.bones.size!==163||s.sculpt.clips.length!==0)throw Error('Wrong anatomical rig');
      if(s.gaze.diagnostics.independentEyes!==2)throw Error('Separate eyes missing');
      const inspect=()=>{
        for(const r of s.sculpt.records){
          const g=r.node.geometry;if(!g.attributes.position.array.every(Number.isFinite)||!g.attributes.normal.array.every(Number.isFinite)||!g.attributes.tangent.array.every(Number.isFinite))throw Error('Nonfinite surface');
          for(let i=0;i<g.attributes.position.count;i++){
            const n=new T.Vector3().fromBufferAttribute(g.attributes.normal,i),t=new T.Vector3().fromBufferAttribute(g.attributes.tangent,i);
            if(Math.abs(n.dot(t))>.0005)throw Error('Stale tangent');
            const w=g.attributes.skinWeight;if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>.00001)throw Error('Invalid skin weight');
          }
        }
        for(const name of ['Base_top','Base_shorts'])if(!s.root.getObjectByName(name).visible)throw Error('Base coverage lost');
      };
      let bodyCases=0,faceCases=0;
      for(const shape of [...MODEL_PRESETS.map(p=>({...MODEL_DEFAULTS,...p.values})),...MODEL_CONTROLS.flatMap(c=>[c.min,c.max].map(v=>({...MODEL_DEFAULTS,[c.id]:v})))]){
        const start=performance.now();look(shape);times.push(performance.now()-start);inspect();
        body.node.computeBoundingBox();const box=new T.Box3().setFromObject(body.node);
        if(Math.abs(box.min.y)>.00001||Math.abs(box.max.y-shape.height/100)>.001)throw Error('Height/floor drift');bodyCases++;
      }
      for(const c of FACE_CONTROLS)for(const value of [-1,1]){
        look(MODEL_DEFAULTS,{...APPEARANCE_DEFAULTS,details:{[c.id]:value}});inspect();const p=body.node.geometry.attributes.position.array;let count=0;
        for(let i=0;i<p.length;i++){const delta=Math.abs(p[i]-base[s.sculpt.records.indexOf(body)][i]);if(delta>.000001)count++;if(body.points[Math.floor(i/3)*3+1]<s.sculpt.field.landmarks.neck&&delta>.000001)throw Error('Face touched torso');}
        if(count<3)throw Error(c.id+' has no effect');faceCases++;
      }
      look();const reset=s.sculpt.snapshot();let drift=0;for(let m=0;m<base.length;m++)for(let i=0;i<base[m].length;i++)drift=Math.max(drift,Math.abs(base[m][i]-reset[m][i]));if(drift>1e-9)throw Error('Reset drift');
      let hairMotion=0;
      for(const style of ['hime','bob','swept','textured']){look(MODEL_DEFAULTS,APPEARANCE_DEFAULTS,CLOTHES_DEFAULTS,{...HAIR_DEFAULTS,style});if(body.node.geometry.index.count!==body.index.count)throw Error('Hair removed body topology');inspect();
        if(style!=='textured'){s.gaze.set({mode:'animated',x:.8,headFollow:true,blink:false});for(let frame=0;frame<60;frame++){s.gaze.restoreHead();s.gaze.update(1/60,false,frame/60);s.hair.update(1/60);hairMotion=Math.max(hairMotion,s.hair.diagnostics.maxDisplacement);}if(!Number.isFinite(hairMotion)||hairMotion>.12)throw Error('Unbounded hair');s.gaze.restoreHead();s.hair.update(0,true);if(s.hair.diagnostics.maxDisplacement>1e-6)throw Error('Hair reset drift');}
      }
      look();s.gaze.set({mode:'animated',x:.8,y:.2,blink:false});s.gaze.update(0,true,0);
      const angles=s.sculpt.eyeAnchors.map(a=>body.node.skeleton.bones[a.bone].quaternion.angleTo(new T.Quaternion()));if(angles.some(v=>v<.2))throw Error('Eyes did not rotate');
      s.gaze.set({mode:'animated',blink:true});s.gaze.update(0,false,3.56);
      let closed=0;s.root.traverse(n=>{if(n.name.startsWith('Upper_lid_')&&n.visible){closed++;if(!n.geometry.attributes.position.array.every(Number.isFinite))throw Error('Invalid lid');}});if(closed!==2)throw Error('Blink did not cover eyes');
      look();times.sort((a,b)=>a-b);return {bones:163,bodyCases,faceCases,resetDrift:drift,eyeAngles:angles,closedLids:closed,maxHairDisplacement:hairMotion,medianEditMs:times[Math.floor(times.length/2)]};
    });
    console.log(JSON.stringify(report));
    await page.evaluate(()=>{modelStudio.flush();modelStudio.setGaze({blink:false,x:.4,y:.12});modelStudio.stage.focusRegion('figure');modelStudio.stage.setView('front');});
    await page.waitForTimeout(200);await page.screenshot({path:path.join(output,'model-human-body.png')});
    await page.click('[data-panel=face]');await page.selectOption('#face-region','nose');await page.locator('#detail-noseBridge').fill('0.5');await page.evaluate(()=>modelStudio.flush());
    near(await page.evaluate(()=>modelStudio.appearance.details.noseBridge),.5);await page.click('#undo');near(await page.evaluate(()=>modelStudio.appearance.details.noseBridge),0);await page.click('#redo');
    const recipe=await page.evaluate(()=>modelStudio.recipe());await page.reload();await page.waitForFunction(()=>window.ready,{timeout:60000});await page.evaluate(()=>modelStudio.selectCandidate('human'));assert.deepEqual(await page.evaluate(()=>modelStudio.recipe()),recipe);
    await page.evaluate(()=>{modelStudio.setAppearance({details:{noseBridge:0}});modelStudio.setGaze({blink:false});modelStudio.selectPanel('face');modelStudio.stage.setView('front');});await page.waitForTimeout(200);
    await page.screenshot({path:path.join(output,'model-human-face.png')});
    await page.evaluate(()=>modelStudio.stage.setView('side'));await page.waitForTimeout(200);await page.screenshot({path:path.join(output,'model-human-profile.png')});
    const exported=await page.evaluate(async()=>{
      const T=await import('/js/vendor/avatar-engine.js'),s=modelStudio.stage,data=await s.exportGLB(),loaded=await new T.GLTFLoader().parseAsync(data,''),eyes=[],names=[],skeletons=new Set();
      loaded.scene.traverse(n=>{if(n.isSkinnedMesh){names.push(n.name);skeletons.add(n.skeleton.bones.length);if(n.userData.bijouSurface==='eye')eyes.push({name:n.name,clearcoat:n.material.clearcoat,roughnessMap:!!n.material.roughnessMap});if(!n.geometry.attributes.position.array.every(Number.isFinite))throw Error('Export nonfinite');}});
      if(!names.includes('Adult_continuous_body')||!names.includes('Base_top')||!names.includes('Base_shorts')||eyes.length!==2||!skeletons.has(163)||loaded.animations.length)throw Error('Export lost components');
      if(eyes.some(e=>e.clearcoat!==1||!e.roughnessMap))throw Error('Export lost eye finish');return {bytes:data.byteLength,meshes:names.length,bones:[...skeletons],eyes,clips:loaded.animations.length};
    });
    const wink=await page.evaluate(async()=>{
      const m=modelStudio,s=m.stage,result={};m.setAppearance({expression:'wink'});m.setStyle({skinBlend:0});
      for(const render of ['realistic','clay']){
        m.setStyle({render});const buffer=await s.exportGLB(),view=new DataView(buffer),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))));
        const upper=gltf.nodes.find(n=>n.name==='Upper_lid_0'),lower=gltf.nodes.find(n=>n.name==='Lower_lid_0'),line=gltf.nodes.find(n=>n.name==='Closed_lash_0');if(!upper||!lower||!line)throw Error('Wink surfaces lost');
        const pbr=gltf.materials[gltf.meshes[upper.mesh].primitives[0].material].pbrMetallicRoughness;if(!pbr.baseColorTexture||!pbr.metallicRoughnessTexture)throw Error('Wink finish lost');
        if(s.style.render!==render)throw Error('Export changed preview');result[render]={bytes:buffer.byteLength,lidColorTexture:true,lidRoughnessTexture:true};
      }
      m.setStyle({render:'realistic',skinBlend:1});m.setAppearance({expression:'neutral'});return result;
    });
    await page.evaluate(()=>{modelStudio.stage.focusRegion('figure');modelStudio.stage.setView('front');modelStudio.flush();});await page.waitForTimeout(200);const before=await page.evaluate(()=>modelStudio.stage.stats);
    await page.evaluate(()=>{for(let i=0;i<4;i++){modelStudio.setClothes({top:'longsleeve',bottom:'leggings'});modelStudio.setHair({style:'hime'});modelStudio.setHair({style:'textured'});modelStudio.setClothes({top:'tee',bottom:'jeans'});}});await page.waitForTimeout(200);const after=await page.evaluate(()=>modelStudio.stage.stats);assert.deepEqual(after,before);
    assert.deepEqual(errors,[]);const result={...report,export:exported,winkExport:wink,memory:{before,after},errors};fs.writeFileSync(path.join(output,'model-human-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
