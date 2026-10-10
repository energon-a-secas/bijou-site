// Local geometry/edit/export tests. No Meshy API calls or paid jobs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const output=path.join(os.tmpdir(),'bijou-model-studio');fs.mkdirSync(output,{recursive:true});
const near=(a,b,eps=.0001)=>assert(Math.abs(a-b)<eps,`${a} differs from ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1,acceptDownloads:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://localhost:8897/dev/model-studio.html');await page.waitForFunction(()=>window.ready,{timeout:60000});
    const reports={};
    for(const id of ['sculpt','t2']){
      await page.evaluate(id=>modelStudio.selectCandidate(id),id);
      await page.click('#reset');await page.evaluate(()=>{modelStudio.setHair({style:'source'});modelStudio.setGaze({mode:'source',blink:false});modelStudio.flush();});
      const source=await page.evaluate(()=>modelStudio.stage.bounds());near(source.min[1],0);near(source.height,1.68);
      assert(source.screenMin[1]>-1&&source.screenMax[1]<1,'Full figure is clipped');
      const validation=await page.evaluate(async()=>{
        const {MODEL_CONTROLS,MODEL_DEFAULTS,MODEL_PRESETS}=await import('/js/model-shape.js');
        const s=modelStudio.stage,neutral=s.sculpt.snapshot(),timings=[],audits=[];
        for(const values of [...MODEL_PRESETS.map(p=>p.values),...MODEL_CONTROLS.map(c=>({...MODEL_DEFAULTS,[c.id]:c.max})),
          Object.fromEntries(MODEL_CONTROLS.map(c=>[c.id,c.min])),Object.fromEntries(MODEL_CONTROLS.map(c=>[c.id,c.max]))]){
          const start=performance.now();s.setShape({...MODEL_DEFAULTS,...values});timings.push(performance.now()-start);
          const b=s.bounds();if(![...b.min,...b.max].every(Number.isFinite))throw Error('Nonfinite bounds');
          if(Math.abs(b.height-(values.height||168)/100)>.002)throw Error('Incorrect height');
          if(Math.abs(b.min[1])>.0001)throw Error('Rest feet left the floor');
          for(const mesh of s.sculpt.meshes)if(!mesh.geometry.attributes.position.array.every(Number.isFinite))throw Error('Nonfinite vertices');
          audits.push(b.height);
        }
        s.setTime(.45);s.setShape(MODEL_DEFAULTS);
        const restored=s.sculpt.snapshot();let maxResetError=0;
        for(let m=0;m<neutral.length;m++)for(let i=0;i<neutral[m].length;i++)maxResetError=Math.max(maxResetError,Math.abs(neutral[m][i]-restored[m][i]));
        return {cases:audits.length,maxResetError,medianEditMs:timings.sort((a,b)=>a-b)[Math.floor(timings.length/2)]};
      });
      near(validation.maxResetError,0,1e-10);
      const appearanceAndClothes=await page.evaluate(async()=>{
        const {MODEL_DEFAULTS,MODEL_PRESETS}=await import('/js/model-shape.js');
        const {ADULT_AGES,FACE_STYLES,APPEARANCE_DEFAULTS}=await import('/js/model-appearance.js');
        const {CLOTHES_DEFAULTS}=await import('/js/model-clothes.js');
        const T=await import('/js/vendor/avatar-engine.js');
        const stage=modelStudio.stage;stage.setLook(MODEL_DEFAULTS,APPEARANCE_DEFAULTS,CLOTHES_DEFAULTS);
        const neutral=stage.sculpt.snapshot();let faceCases=0,clothingCases=0,maxBodyError=0,maxSeamGap=0,minNormal=1,maxNormal=1;
        for(const age of ADULT_AGES)for(const face of FACE_STYLES){
          stage.setShape(MODEL_DEFAULTS,{age:age.id,face:face.id});let changed=0;
          for(const [m,r]of stage.sculpt.records.entries()){
            const p=r.node.geometry.attributes.position,n=r.node.geometry.attributes.normal,scale=r.node.getWorldScale(new T.Vector3()).x;
            for(let i=0;i<p.count;i++){
              const error=Math.max(...[0,1,2].map(k=>Math.abs(p.array[i*3+k]-neutral[m][i*3+k])));
              if(r.points[i*3+1]<stage.sculpt.field.landmarks.neck)maxBodyError=Math.max(maxBodyError,error*scale);
              if(error>1e-5)changed++;
              const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(!Number.isFinite(length))throw Error('Nonfinite face normal');minNormal=Math.min(minNormal,length);maxNormal=Math.max(maxNormal,length);
            }
          }
          if((age.id!==25||face.id!=='oval')&&changed<50)throw Error('Face treatment has no meaningful vertex effect');faceCases++;
        }
        // Every top/bottom combination on both ends of the body range.
        for(const preset of ['slender','full'])for(const top of ['tank','tee','longsleeve'])for(const bottom of ['shorts','leggings','jeans']){
          stage.setLook({...MODEL_DEFAULTS,...MODEL_PRESETS.find(p=>p.id===preset).values},APPEARANCE_DEFAULTS,
            {...CLOTHES_DEFAULTS,top,bottom,topFit:preset==='full'?1:0,bottomFit:preset==='full'?1:0,legLength:bottom==='leggings'?0:1});
          const b=stage.bounds();if(b.garments<2)throw Error('Missing clothing layer');
          for(const mesh of stage.wardrobe.meshes){
            if(mesh.geometry.attributes.position.count<300)throw Error('Empty garment');
            for(const name of ['position','normal','skinWeight'])if(!mesh.geometry.attributes[name].array.every(Number.isFinite))throw Error('Nonfinite garment attribute');
            const weights=mesh.geometry.attributes.skinWeight;
            for(let i=0;i<weights.count;i++)if(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)>.00001)throw Error('Unnormalized clothing weights');
          }
          for(const r of stage.sculpt.records){
            const p=r.node.geometry.attributes.position,scale=r.node.getWorldScale(new T.Vector3()).x;
            for(const group of r.groups)for(const id of group)maxSeamGap=Math.max(maxSeamGap,Math.hypot(p.getX(id)-p.getX(group[0]),p.getY(id)-p.getY(group[0]),p.getZ(id)-p.getZ(group[0]))*scale);
          }
          stage.setTime(.45);if(!stage.bounds().min.every(Number.isFinite))throw Error('Invalid clothed animation');clothingCases++;
        }
        modelStudio.flush();return {faceCases,clothingCases,maxBodyError,maxSeamGap,minNormal,maxNormal};
      });
      near(appearanceAndClothes.maxBodyError,0,1e-6);assert(appearanceAndClothes.maxSeamGap<.00015);assert(appearanceAndClothes.minNormal>.99&&appearanceAndClothes.maxNormal<1.01);
      await page.selectOption('#region','waist');await page.locator('#bellyLower').fill('0.6');await page.evaluate(()=>modelStudio.flush());
      near(await page.evaluate(()=>modelStudio.shape.bellyLower),.6);
      await page.click('#undo');near(await page.evaluate(()=>modelStudio.shape.bellyLower),0);
      await page.click('#redo');near(await page.evaluate(()=>modelStudio.shape.bellyLower),.6);
      await page.check('#compare');assert(await page.locator('#bellyLower').isDisabled());near(await page.evaluate(()=>modelStudio.stage.sculpt.field.shape.bellyLower),0);
      await page.uncheck('#compare');near(await page.evaluate(()=>modelStudio.stage.sculpt.field.shape.bellyLower),.6);
      await page.click('[data-view=side]');await page.screenshot({path:path.join(output,id+'-abdomen.png')});
      await page.click('[data-preset=athletic]');await page.selectOption('#region','figure');await page.locator('#height').fill('180');await page.evaluate(()=>modelStudio.flush());
      await page.check('#walk');assert(await page.locator('#walk').isChecked());await page.waitForTimeout(150);
      await page.locator('#shoulders').fill('0.45');await page.evaluate(()=>modelStudio.flush());assert.equal(await page.locator('#walk').isChecked(),false);
      await page.click('[data-panel=face]');await page.click('[data-age="45"]');await page.selectOption('#face-style','heroine');
      await page.click('#undo');assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'oval');
      await page.click('#redo');assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'heroine');
      await page.screenshot({path:path.join(output,id+'-heroine.png')});
      await page.click('[data-panel=clothes]');await page.click('[data-outfit=everyday]');await page.evaluate(()=>modelStudio.flush());
      await page.check('#compare');assert.equal(await page.evaluate(()=>modelStudio.stage.wardrobe.meshes.length),0);
      near(await page.evaluate(()=>modelStudio.stage.sculpt.appearance.age),25);
      await page.uncheck('#compare');assert(await page.evaluate(()=>modelStudio.stage.wardrobe.meshes.length>=2));
      const edited=await page.evaluate(()=>modelStudio.stage.bounds());near(edited.height,1.80);
      // Export, parse again through the actual GLTFLoader, and compare both bind
      // pose and animated bounds. This catches unit and inverse-bind mistakes.
      const exported=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),stage=modelStudio.stage,data=await stage.exportGLB();
        const gltf=await new T.GLTFLoader().parseAsync(data,''),boxFor=()=>{
          gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(n=>{if(n.isSkinnedMesh)n.computeBoundingBox();});
          const b=new T.Box3().setFromObject(gltf.scene);return {min:b.min.toArray(),max:b.max.toArray()};
        };
        const rest=boxFor(),clips=gltf.animations,mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(clips[0]).play();
        const frames=[];
        for(const t of [.1,.45,.9]){stage.setTime(t);mixer.setTime(t);frames.push({source:stage.bounds(),exported:boxFor()});}
        let bones=0,vertices=0,textured=0,finiteWeights=true;
        const mats=new Set(),textures=new Set(),skeletons=new Set();
        gltf.scene.traverse(n=>{if(n.isBone)bones++;if(n.isMesh){vertices+=n.geometry.attributes.position.count;
          if(n.material.map)textured++;if(n.skeleton){skeletons.add(n.skeleton);finiteWeights&&=n.geometry.attributes.skinWeight.array.every(Number.isFinite);}
          n.geometry.dispose();for(const m of [n.material].flat())mats.add(m);
        }});
        for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();for(const s of skeletons)s.dispose();
        stage.setMotion(false);return {bytes:data.byteLength,rest,frames,bones,vertices,textured,finiteWeights,clipDuration:clips[0].duration};
      });
      for(let k=0;k<3;k++){near(exported.rest.min[k],edited.min[k]);near(exported.rest.max[k],edited.max[k]);}
      for(const f of exported.frames)for(let k=0;k<3;k++){near(f.source.min[k],f.exported.min[k],.0002);near(f.source.max[k],f.exported.max[k],.0002);}
      assert.equal(exported.bones,24);assert(exported.textured>=3);assert(exported.finiteWeights);assert(exported.clipDuration>1);assert(exported.bytes>1000000);
      await page.click('[data-view=front]');await page.click('#full-figure');await page.screenshot({path:path.join(output,id+'-edited.png')});
      const recipeDownload=page.waitForEvent('download');await page.click('#export-shape');const file=await recipeDownload;const recipePath=path.join(output,id+'-shape.json');await file.saveAs(recipePath);
      const recipe=JSON.parse(fs.readFileSync(recipePath,'utf8'));assert.equal(recipe.version,4);assert.equal(recipe.candidate,id);near(recipe.shape.height,180);assert.equal(recipe.appearance.age,45);assert.equal(recipe.appearance.face,'heroine');assert.equal(recipe.clothes.bottom,'jeans');
      await page.click('[data-panel=body]');await page.click('#reset');await page.locator('#import-shape').setInputFiles(recipePath);await page.waitForFunction(()=>modelStudio.shape.height===180);
      reports[id]={source,validation,appearanceAndClothes,edited,exported};
      console.log(JSON.stringify({candidate:id,validation,exportBytes:exported.bytes,roundtrip:'passed'}));
    }
    // Drafts survive reload independently, with companion storage untouched.
    await page.evaluate(()=>localStorage.setItem('bijou-site:save','{"studioTest":"untouched"}'));
    await page.reload();await page.waitForFunction(()=>window.ready,{timeout:60000});
    assert.equal(await page.locator('#candidate').inputValue(),'sculpt');near(await page.evaluate(()=>modelStudio.shape.height),180);
    assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'heroine');assert.equal(await page.evaluate(()=>modelStudio.clothes.bottom),'jeans');
    await page.selectOption('#candidate','t2');await page.waitForFunction(()=>window.ready);near(await page.evaluate(()=>modelStudio.shape.height),180);
    assert.equal(await page.evaluate(()=>localStorage.getItem('bijou-site:save')),'{"studioTest":"untouched"}');
    await page.locator('[data-panel=body]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-panel=face]').getAttribute('aria-selected'),'true');
    await page.keyboard.press('End');assert.equal(await page.locator('[data-panel=clothes]').getAttribute('aria-selected'),'true');
    // Equal model/material cycles must not accumulate GPU resources.
    const memory=[];
    for(let cycle=0;cycle<2;cycle++){
      for(const id of ['sculpt','t2']){
        await page.evaluate(id=>modelStudio.selectCandidate(id),id);
        for(const finish of ['realistic','anime2d','clay','anime3d'])await page.selectOption('#surface',finish);
        await page.check('#skeleton');await page.check('#wire');await page.waitForTimeout(100);await page.uncheck('#skeleton');await page.uncheck('#wire');
      }
      await page.waitForTimeout(100);memory.push(await page.evaluate(()=>modelStudio.stage.stats));
    }
    assert.deepEqual(memory[0],memory[1]);
    await page.check('#walk');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);assert.equal(await page.locator('#walk').isChecked(),false);
    await page.evaluate(()=>modelStudio.stage.setMotion(true));assert.equal(await page.locator('#walk').isChecked(),false);
    await page.setViewportSize({width:390,height:844});await page.click('#full-figure');await page.waitForTimeout(200);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
    const clearance=await page.evaluate(()=>{
      const canvas=document.querySelector('canvas').getBoundingClientRect(),bar=document.querySelector('.camera-bar').getBoundingClientRect(),b=modelStudio.stage.bounds();
      return {footY:canvas.top+(1-b.screenMin[1])*.5*canvas.height,barY:bar.top};
    });assert(clearance.footY<clearance.barY-8,'Camera controls obscure the feet');
    await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    // A v1 shape-only draft migrates without inventing a face or outfit choice.
    const old=await browser.newPage();await old.goto('http://localhost:8897/dev/model-studio.html');await old.waitForFunction(()=>window.ready,{timeout:60000});
    await old.evaluate(async()=>{const {MODEL_DEFAULTS}=await import('/js/model-shape.js');const shape={...MODEL_DEFAULTS,height:160,waistWidth:-.4};delete shape.build;localStorage.setItem('bijou:model-studio:v1:sculpt',JSON.stringify({version:1,candidate:'sculpt',shape}));});
    await old.reload();await old.waitForFunction(()=>window.ready,{timeout:60000});
    assert.equal(await old.evaluate(()=>modelStudio.shape.height),160);assert.equal(await old.evaluate(()=>modelStudio.shape.build),0);assert.equal(await old.evaluate(()=>modelStudio.appearance.face),'oval');assert.equal(await old.evaluate(()=>modelStudio.clothes.top),'source');
    await old.evaluate(()=>modelStudio.change({height:161}));assert.equal(await old.evaluate(()=>JSON.parse(localStorage.getItem('bijou:model-studio:v4:sculpt')).version),4);await old.close();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({reports,memory,errors},null,2));
    console.log(JSON.stringify({checks:'passed',reports,memory,artifacts:output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
