const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const output=path.join(os.tmpdir(),'bijou-model-details');fs.mkdirSync(output,{recursive:true});
const near=(a,b,e=.0002)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true}),errors=[],reports={};
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://localhost:8897/dev/model-studio.html');await page.waitForFunction(()=>window.ready,null,{timeout:60000});
    assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'oval');assert.equal(await page.evaluate(()=>modelStudio.hair.style),'hime');
    for(const candidate of ['sculpt','t2']){
      await page.evaluate(id=>modelStudio.selectCandidate(id),candidate);
      reports[candidate]=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),{FACE_CONTROLS}=await import('/js/model-face-details.js'),{APPEARANCE_DEFAULTS,cleanAppearance}=await import('/js/model-appearance.js');
        const {MODEL_DEFAULTS}=await import('/js/model-shape.js'),{CLOTHES_DEFAULTS}=await import('/js/model-clothes.js'),{SOURCE_HAIR,SOURCE_GAZE}=await import('/js/model-persona.js');
        const s=modelStudio.stage,look=face=>s.setLook(MODEL_DEFAULTS,cleanAppearance(face),CLOTHES_DEFAULTS,SOURCE_HAIR,SOURCE_GAZE);
        look(APPEARANCE_DEFAULTS);const base=s.sculpt.snapshot(),neck=s.sculpt.field.landmarks.neck,scales=s.sculpt.records.map(r=>r.node.getWorldScale(new T.Vector3()).x);
        let cases=0,maxDelta=0;
        for(const c of FACE_CONTROLS)for(const sign of [-1,1]){
          look({...APPEARANCE_DEFAULTS,details:{[c.id]:sign}});const moved=s.sculpt.snapshot();let changed=0;
          for(let m=0;m<base.length;m++){
            const r=s.sculpt.records[m];if(!r.node.geometry.attributes.normal.array.every(Number.isFinite))throw Error('Nonfinite normal: '+c.id);
            for(let i=0;i<base[m].length;i++){
              const d=Math.abs(moved[m][i]-base[m][i])*scales[m];if(d>.000001)changed++;maxDelta=Math.max(maxDelta,d);
              if(!Number.isFinite(d))throw Error('Nonfinite geometry');if(r.points[Math.floor(i/3)*3+1]<neck&&d>.000001)throw Error('Face changed body: '+c.id);
            }
          }
          if(changed<3)throw Error(c.id+' does not change the imported mesh');cases++;
        }
        look(APPEARANCE_DEFAULTS);const restored=s.sculpt.snapshot();
        for(let m=0;m<base.length;m++)for(let i=0;i<base[m].length;i++)if(Math.abs(restored[m][i]-base[m][i])>.00001)throw Error('Face reset drift');
        return {detailCases:cases,maxDeltaMeters:maxDelta};
      });
      // Real controls, focus transitions and atomic history.
      await page.click('[data-starter=fantasy]');await page.click('[data-panel=face]');await page.uncheck('#auto-blink');
      await page.selectOption('#face-region','nose');assert.equal(await page.evaluate(()=>modelStudio.stage.cameraState.region),'face-nose');
      await page.locator('#detail-noseBridge').fill('0.6');await page.evaluate(()=>modelStudio.flush());near(await page.evaluate(()=>modelStudio.appearance.details.noseBridge),.6);
      await page.click('#undo');near(await page.evaluate(()=>modelStudio.appearance.details.noseBridge),0);await page.click('#redo');near(await page.evaluate(()=>modelStudio.appearance.details.noseBridge),.6);
      await page.click('[data-panel=body]');assert.equal(await page.evaluate(()=>modelStudio.stage.cameraState.region),'figure');
      await page.click('[data-panel=style]');await page.selectOption('#style-region','eyes');await page.click('[data-eye-color="#69906c"]');
      assert.equal(await page.evaluate(()=>modelStudio.style.eyeColor),'#69906c');await page.click('#undo');await page.click('#redo');
      const beforeLight=await page.evaluate(()=>modelStudio.lighting.azimuth);await page.locator('#lighting-pad').focus();await page.keyboard.press('ArrowRight');
      near(await page.evaluate(()=>modelStudio.lighting.azimuth),beforeLight+.05);await page.click('#undo');near(await page.evaluate(()=>modelStudio.lighting.azimuth),beforeLight);
      // Source sculpt has color, but no pretend silhouette/physics sliders.
      await page.click('[data-panel=hair]');assert.equal(await page.locator('#hair-length').isDisabled(),true);assert.equal(await page.locator('#hair-color').isDisabled(),false);
      await page.click('[data-panel=style]');await page.selectOption('#style-region','hair');assert.equal(await page.locator('#style-hairDetail').isDisabled(),false);
      await page.selectOption('#surface','clay');assert.equal(await page.locator('#style-hairDetail').isDisabled(),true);assert.equal(await page.locator('#skin-color').isDisabled(),true);
      await page.selectOption('#surface','realistic');assert.equal(await page.locator('#style-hairRoughness').isDisabled(),false);
      const prior=await page.evaluate(()=>modelStudio.recipe());await page.evaluate(()=>modelStudio.vary(42));
      assert.deepEqual(await page.evaluate(()=>modelStudio.shape),prior.shape);assert.deepEqual(await page.evaluate(()=>modelStudio.clothes),prior.clothes);
      await page.click('#undo');assert.deepEqual(await page.evaluate(()=>modelStudio.recipe()),prior);
      await page.evaluate(()=>{modelStudio.portrait('nightbloom');modelStudio.setHair({color:'#b16d42'});modelStudio.setStyle({skinColor:'#b88769',skinBlend:1,eyeColor:'#4a976e',eyeTint:1,roughness:.3,eyeRestoration:1,hairDetail:.7,hairRoughness:.3,lightWrap:.4});modelStudio.setGaze({blink:false,x:.25});modelStudio.selectPanel('style');});
      await page.selectOption('#style-region','skin');await page.click('[data-view=front]');await page.waitForTimeout(100);await page.screenshot({path:path.join(output,candidate+'-realism.png')});
      reports[candidate].export=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),s=modelStudio.stage,body=s.sculpt.records[0],original=body.node.material.map.image;
        const read=(texture,u,v)=>{const c=document.createElement('canvas');c.width=texture.image.width;c.height=texture.image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);return Array.from(ctx.getImageData(Math.floor(u*c.width),Math.floor((texture.flipY?1-v:v)*c.height),1,1).data).slice(0,3);};
        let skin,iris,hair;const eye=s.gaze.diagnostics.anchors[1];
        for(const r of s.sculpt.records){
        if(!r.node.visible||!r.node.material.map)continue;
        const tex=r.node.material.map,uv=r.node.geometry.attributes.uv;
        for(let i=0;i<r.index.count;i+=3){
          const ids=[r.index.getX(i),r.index.getX(i+1),r.index.getX(i+2)],p=[0,1,2].map(k=>ids.reduce((n,j)=>n+r.points[j*3+k],0)/3),u=ids.reduce((n,j)=>n+uv.getX(j),0)/3,v=ids.reduce((n,j)=>n+uv.getY(j),0)/3;
          if(!skin&&p[0]>.025&&p[0]<.05&&p[1]>s.sculpt.faceAnchors.eye-.055&&p[1]<s.sculpt.faceAnchors.eye-.029&&p[2]>.060)skin={name:r.node.name,u,v,before:read(tex,u,v)};
          if(!iris&&Math.abs(p[0]-eye.x)<.009&&Math.abs(p[1]-eye.y)<.008&&p[2]>.055&&p[2]<.09){const color=read(tex,u,v);if(color[0]>55&&color[0]<180&&color[1]<color[0]*.55)iris={name:r.node.name,u,v,before:color};}
          if(!hair&&p[1]>s.sculpt.faceAnchors.eye+.075&&Math.abs(p[0])<.09&&p[2]>.02){const color=read(tex,u,v);if(Math.max(...color)<60)hair={name:r.node.name,u,v,before:color};}
          if(skin&&iris&&hair)break;
        }
        if(skin&&iris&&hair)break;}
        if(!skin||!iris||!hair)throw Error('Missing atlas probes');
        const data=await s.exportGLB();if(body.node.material.map.image!==original)throw Error('Export mutated source atlas');
        const gltf=await new T.GLTFLoader().parseAsync(data,''),probe=(p,channel='map')=>read(gltf.scene.getObjectByName(p.name).material[channel],p.u,p.v);
        const sample={skin:{...skin,after:probe(skin)},iris:{...iris,after:probe(iris)},hair:{...hair,after:probe(hair)},roughness:probe(skin,'roughnessMap'),hairRoughness:probe(hair,'roughnessMap')};
        const box=new T.Box3().setFromObject(gltf.scene),source=s.bounds(),skeletons=new Set(),materials=new Set(),textures=new Set();
        gltf.scene.traverse(n=>{if(n.isMesh){n.geometry.dispose();if(n.skeleton)skeletons.add(n.skeleton);for(const m of [n.material].flat())materials.add(m);}});
        for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();for(const skeleton of skeletons)skeleton.dispose();
        return {bytes:data.byteLength,sample,source,min:box.min.toArray(),max:box.max.toArray()};
      });
      const exp=reports[candidate].export;for(let k=0;k<3;k++){near(exp.source.min[k],exp.min[k]);near(exp.source.max[k],exp.max[k]);}
      assert(Math.hypot(...exp.sample.skin.after.map((v,k)=>v-exp.sample.skin.before[k]))>20,'Skin color did not export');
      assert(Math.hypot(...exp.sample.iris.after.map((v,k)=>v-exp.sample.iris.before[k]))>20,'Iris color did not export');assert(exp.sample.iris.after[1]>exp.sample.iris.after[0],'Iris hue incorrect');
      assert(exp.sample.roughness[1]>95&&exp.sample.roughness[1]<145,'Roughness did not export');
      assert(exp.sample.hair.after[0]>exp.sample.hair.before[0]+50,'Hair color did not export');assert(exp.sample.hair.after[0]>exp.sample.hair.after[1],'Hair hue incorrect');
      assert(exp.sample.hairRoughness[1]>90&&exp.sample.hairRoughness[1]<110,'Hair roughness did not export');
      const download=page.waitForEvent('download');await page.click('#export-shape');const file=await download,filename=path.join(output,candidate+'-look.json');await file.saveAs(filename);
      const recipe=JSON.parse(fs.readFileSync(filename));assert.equal(recipe.version,4);assert.equal(recipe.style.eyeColor,'#4a976e');assert.equal(recipe.hair.style,'textured');assert.equal(recipe.style.eyeRestoration,1);assert.equal(recipe.style.hairRoughness,.3);assert.equal(recipe.style.lightWrap,.4);
      await page.click('[data-starter=hime]');await page.locator('#import-shape').setInputFiles(filename);await page.waitForFunction(()=>modelStudio.style.eyeColor==='#4a976e');assert.deepEqual(await page.evaluate(()=>modelStudio.recipe()),recipe);
      console.log(JSON.stringify({candidate,detailCases:reports[candidate].detailCases,export:exp.bytes,sample:exp.sample}));
    }
    // v3 migration leaves the old treatment intact and gives neutral new fields.
    const old=await page.evaluate(()=>modelStudio.recipe());old.version=3;delete old.style;delete old.lighting;delete old.appearance.details;
    const filename=path.join(output,'v3-look.json');fs.writeFileSync(filename,JSON.stringify(old));await page.locator('#import-shape').setInputFiles(filename);
    assert.equal(await page.evaluate(()=>modelStudio.style.render),'anime3d');assert.equal(await page.evaluate(()=>Object.values(modelStudio.appearance.details).every(v=>v===0)),true);
    const memory=[];for(let cycle=0;cycle<2;cycle++){
      for(const candidate of ['sculpt','t2']){await page.evaluate(id=>modelStudio.selectCandidate(id),candidate);await page.evaluate(()=>{modelStudio.starter('fantasy');modelStudio.setStyle({render:'anime2d'});modelStudio.setStyle({render:'realistic'});});}
      await page.waitForTimeout(100);memory.push(await page.evaluate(()=>modelStudio.stage.stats));
    }assert.deepEqual(memory[0],memory[1]);
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>modelStudio.setGaze({follow:true,headFollow:true,blink:true}));await page.mouse.move(100,100);await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>modelStudio.stage.gaze.diagnostics.blinks[0]),0);
    await page.setViewportSize({width:390,height:844});await page.click('[data-panel=face]');await page.selectOption('#face-region','eyes');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({reports,memory,errors},null,2));console.log(JSON.stringify({checks:'passed',artifacts:output,memory}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
