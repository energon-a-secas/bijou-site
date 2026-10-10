// Corrective anime-head integration checks. Uses local assets; no paid jobs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('assets/studies'),near=(a,b,e=.0002)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],reports={};
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://localhost:8897/dev/model-studio.html');await page.waitForFunction(()=>window.ready,{timeout:60000});
    assert.equal(await page.evaluate(()=>modelStudio.hair.style),'hime');assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'oval');
    assert.equal(await page.locator('#candidate option[value=human]').count(),0);
    for(const candidate of ['sculpt','t2']){
      await page.evaluate(id=>modelStudio.selectCandidate(id),candidate);
      reports[candidate]=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),{FACE_CONTROLS}=await import('/js/model-face-details.js');
        const {MODEL_DEFAULTS,MODEL_PRESETS}=await import('/js/model-shape.js'),{APPEARANCE_DEFAULTS}=await import('/js/model-appearance.js');
        const s=modelStudio.stage,recipe=modelStudio.recipe(),base=()=>s.setLook(MODEL_DEFAULTS,APPEARANCE_DEFAULTS,recipe.clothes,recipe.hair,{mode:'animated',blink:false});
        if(!s.root.userData.bijouAnimeHead)throw Error('Clean anime head missing');base();
        const rest=s.sculpt.snapshot(),body=s.sculpt.records.find(r=>r.node.userData.bijouAnimeBody),bodyIndex=body.node.geometry.index;
        const iris=s.sculpt.records.find(r=>/EyeIris/.test(r.node.material.name)),eyeRest=iris.node.geometry.attributes.position.array.slice();
        s.gaze.set({mode:'animated',x:.8,y:.5,blink:false});s.gaze.update(0,true);
        const eyeMoved=iris.node.geometry.attributes.position.array;let gazeDelta=0;
        for(let i=0;i<eyeRest.length;i++)gazeDelta=Math.max(gazeDelta,Math.abs(eyeMoved[i]-eyeRest[i]));
        if(gazeDelta<.003)throw Error('Iris does not follow manual gaze');
        let bodyGazeError=0;for(let i=0;i<body.base.length;i++)bodyGazeError=Math.max(bodyGazeError,Math.abs(body.node.geometry.attributes.position.array[i]-rest[s.sculpt.records.indexOf(body)][i]));
        if(bodyGazeError>1e-8)throw Error('Gaze changed body');
        base();const lids=s.sculpt.records.find(r=>/Face_00_SKIN/.test(r.node.material.name)),lidRest=lids.node.geometry.attributes.position.array.slice();
        s.gaze.set({mode:'animated',blink:true});s.gaze.update(0,false,3.56);
        let blinkDelta=0;for(let i=0;i<lidRest.length;i++)blinkDelta=Math.max(blinkDelta,Math.abs(lids.node.geometry.attributes.position.array[i]-lidRest[i]));
        if(blinkDelta<.008||s.gaze.diagnostics.blinks[0]<.99)throw Error('Authored blink did not close: '+JSON.stringify({blinkDelta,pose:s.gaze.diagnostics}));base();
        let detailCases=0,maxBodyError=0,resetError=0;
        for(const c of FACE_CONTROLS)for(const value of [-1,1]){
          s.setShape(MODEL_DEFAULTS,{...APPEARANCE_DEFAULTS,details:{[c.id]:value}});let changed=0;
          for(const [m,r]of s.sculpt.records.entries()){
            const g=r.node.geometry;if(!g.attributes.position.array.every(Number.isFinite)||!g.attributes.normal.array.every(Number.isFinite))throw Error('Invalid face surface: '+c.id);
            const scale=r.node.getWorldScale(new T.Vector3()).x;
            for(let i=0;i<rest[m].length;i++){const d=Math.abs(g.attributes.position.array[i]-rest[m][i])*scale;if(d>1e-6)changed++;
              if(r.points[Math.floor(i/3)*3+1]<s.sculpt.field.landmarks.neck)maxBodyError=Math.max(maxBodyError,d);}
          }
          if(changed<3)throw Error('Ineffective face control: '+c.id);detailCases++;
        }
        base();for(const [m,r]of s.sculpt.records.entries())for(let i=0;i<rest[m].length;i++)resetError=Math.max(resetError,Math.abs(rest[m][i]-r.node.geometry.attributes.position.array[i]));
        const shapeCases=[];
        for(const id of ['figurine','slender','full']){
          const preset=MODEL_PRESETS.find(p=>p.id===id);s.setLook({...MODEL_DEFAULTS,...preset.values},APPEARANCE_DEFAULTS,recipe.clothes,recipe.hair,{blink:false});
          const b=s.bounds();if(![...b.min,...b.max].every(Number.isFinite)||Math.abs(b.min[1])>.0001)throw Error('Invalid body/floor');
          for(const mesh of s.wardrobe.meshes){
            const g=mesh.geometry;if(!g.attributes.position.count||!g.attributes.position.array.every(Number.isFinite))throw Error('Empty/nonfinite garment');
            const w=g.attributes.skinWeight;for(let i=0;i<w.count;i++)if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>1e-5)throw Error('Invalid garment weights');
          }shapeCases.push({id,height:b.height,garments:b.garments});
        }
        base();s.gaze.set({mode:'animated',x:.8,headFollow:true,blink:false});let hairDisplacement=0;
        for(let f=0;f<60;f++){s.gaze.restoreHead();s.gaze.update(1/60,false,f/60);s.hair.update(1/60);hairDisplacement=Math.max(hairDisplacement,s.hair.diagnostics.maxDisplacement);}
        s.gaze.restoreHead();s.hair.update(0,true);if(!Number.isFinite(hairDisplacement)||hairDisplacement>.12||s.hair.diagnostics.maxDisplacement>1e-6)throw Error('Unbounded hair/reset drift');
        base();for(const style of ['source','hime','bob','swept']){s.hair.set({...recipe.hair,style});if(body.node.geometry.index!==bodyIndex&&body.node.geometry.index.count!==bodyIndex.count)throw Error('Hairstyle removed cleaned body triangles');}
        s.wardrobe.set({top:'source',bottom:'source'});if(body.node.geometry.index.count!==body.index.count)throw Error('Original outfit did not restore');
        s.wardrobe.set(recipe.clothes);if(body.node.geometry.index.count>=body.index.count)throw Error('Covered outfit remained visible');
        s.setLook(recipe.shape,recipe.appearance,recipe.clothes,recipe.hair,{...recipe.gaze,blink:false,follow:false,headFollow:false});
        return {detailCases,gazeDeltaMeters:gazeDelta,blinkDeltaMeters:blinkDelta,maxBodyError,resetError,shapeCases,hairDisplacement};
      });
      near(reports[candidate].resetError,0,1e-8);near(reports[candidate].maxBodyError,0,1e-7);
      reports[candidate].export=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),s=modelStudio.stage;
        const pixels=texture=>{const c=document.createElement('canvas');c.width=texture.image.width;c.height=texture.image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);return {data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height,flipY:texture.flipY};};
        const sample=(p,u,v)=>Array.from(p.data.subarray((Math.min(p.height-1,Math.max(0,Math.floor((p.flipY?1-v:v)*p.height)))*p.width+Math.min(p.width-1,Math.max(0,Math.floor(u*p.width))))*4,(Math.min(p.height-1,Math.max(0,Math.floor((p.flipY?1-v:v)*p.height)))*p.width+Math.min(p.width-1,Math.max(0,Math.floor(u*p.width))))*4+4));
        const probes=[];
        for(const r of s.sculpt.records){
          if(!r.node.visible||!r.node.userData.bijouAnimeHead||!r.node.material.map||!(r.node.material.transparent||r.node.material.alphaTest))continue;
          const p=pixels(r.node.material.map),uv=r.node.geometry.attributes.uv;let found=null;
          for(let at=0;at<r.index.count&&!found;at+=3){const ids=[r.index.getX(at),r.index.getX(at+1),r.index.getX(at+2)];
            for(const b of [[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]]){const u=ids.reduce((v,id,k)=>v+uv.getX(id)*b[k],0),v=ids.reduce((v,id,k)=>v+uv.getY(id)*b[k],0),rgba=sample(p,u,v);if(rgba[3]<30){found={name:r.node.name,u,v,alpha:rgba[3]};break;}}
          }if(found)probes.push(found);
        }
        if(!probes.length)throw Error('No transparent facial edge probes');
        const sourceMaps=s.sculpt.records.map(r=>r.node.material.map),buffer=await s.exportGLB(),loaded=await new T.GLTFLoader().parseAsync(buffer,''),box=new T.Box3(),skeletons=new Set();let normalized=true;
        loaded.scene.updateMatrixWorld(true);loaded.scene.traverse(n=>{if(n.isSkinnedMesh){n.computeBoundingBox();skeletons.add(n.skeleton.bones.length);const w=n.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)normalized&&=Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5;}});
        box.setFromObject(loaded.scene);const bounds=s.bounds(),alpha=probes.map(p=>({...p,exportAlpha:sample(pixels(loaded.scene.getObjectByName(p.name).material.map),p.u,p.v)[3]}));
        if(alpha.some(p=>p.exportAlpha>45))throw Error('Export made transparent face edges opaque');
        if(s.sculpt.records.some((r,i)=>r.node.material.map!==sourceMaps[i]))throw Error('Export changed preview maps');
        const parsed=new DataView(buffer),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,parsed.getUint32(12,true))));
        const matCount=json.materials.length,textureCount=json.textures.length;
        const geometries=new Set(),materials=new Set(),textures=new Set(),skins=new Set();loaded.scene.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);if(n.skeleton)skins.add(n.skeleton);for(const m of [n.material].flat())materials.add(m);}});
        for(const g of geometries)g.dispose();for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();for(const sk of skins)sk.dispose();
        return {bytes:buffer.byteLength,source:bounds,min:box.min.toArray(),max:box.max.toArray(),skeletons:[...skeletons],normalized,alpha,matCount,textureCount};
      });
      const exp=reports[candidate].export;for(let k=0;k<3;k++){near(exp.source.min[k],exp.min[k]);near(exp.source.max[k],exp.max[k]);}assert(exp.normalized);assert(exp.skeletons.every(n=>n===24));
      await page.evaluate(()=>{modelStudio.setGaze({blink:false,follow:false,headFollow:false});modelStudio.stage.setView('front');modelStudio.selectPanel('face');});await page.waitForTimeout(100);
      await page.screenshot({path:path.join(output,`model-anime-${candidate}-face.png`)});
      await page.evaluate(()=>modelStudio.stage.setView('three'));await page.waitForTimeout(100);await page.screenshot({path:path.join(output,`model-anime-${candidate}-three.png`)});
      await page.evaluate(()=>{modelStudio.setAppearance({expression:'wink'});modelStudio.stage.setView('front');});await page.waitForTimeout(100);await page.screenshot({path:path.join(output,`model-anime-${candidate}-wink.png`)});
      await page.evaluate(()=>{modelStudio.setAppearance({expression:'neutral'});modelStudio.selectPanel('body');modelStudio.stage.focusRegion('figure');});await page.waitForTimeout(100);await page.screenshot({path:path.join(output,`model-anime-${candidate}-body.png`)});
      console.log(JSON.stringify({candidate,details:reports[candidate].detailCases,exportBytes:exp.bytes,alphaProbes:exp.alpha.length}));
    }
    await page.evaluate(()=>{localStorage.setItem('bijou-site:save','{"keep":"companion"}');localStorage.setItem('bijou:model-studio:v4:human','{"keep":"anatomy draft"}');});
    const recipe=await page.evaluate(()=>modelStudio.recipe());await page.reload();await page.waitForFunction(()=>window.ready,{timeout:60000});await page.evaluate(()=>modelStudio.selectCandidate('t2'));
    assert.deepEqual(await page.evaluate(()=>modelStudio.recipe()),recipe);assert.equal(await page.evaluate(()=>localStorage.getItem('bijou-site:save')),'{"keep":"companion"}');
    await page.goto('http://localhost:8897/dev/model-studio.html?model=human');await page.waitForFunction(()=>window.ready,{timeout:60000});
    assert.equal(await page.locator('#candidate').inputValue(),'sculpt');assert.equal(await page.evaluate(()=>localStorage.getItem('bijou:model-studio:v4:human')),'{"keep":"anatomy draft"}');
    await page.evaluate(()=>modelStudio.selectCandidate('heroine'));assert.equal(await page.evaluate(()=>!!modelStudio.stage.root.userData.bijouAnimeHead),false);assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'heroine');
    const memory=[];for(let cycle=0;cycle<2;cycle++){for(const id of ['sculpt','t2'])await page.evaluate(id=>modelStudio.selectCandidate(id),id);await page.waitForTimeout(100);memory.push(await page.evaluate(()=>modelStudio.stage.stats));}
    assert.deepEqual(memory[0],memory[1]);
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{modelStudio.setGaze({blink:true,follow:true,headFollow:true});modelStudio.stage.focusRegion('figure');});await page.waitForTimeout(100);near(await page.evaluate(()=>modelStudio.stage.gaze.diagnostics.blinks[0]),0);
    await page.setViewportSize({width:390,height:844});await page.click('#full-figure');await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const clearance=await page.evaluate(()=>{const canvas=document.querySelector('canvas').getBoundingClientRect(),bar=document.querySelector('.camera-bar').getBoundingClientRect(),b=modelStudio.stage.bounds();return {footY:canvas.top+(1-b.screenMin[1])*.5*canvas.height,barY:bar.top};});assert(clearance.footY<clearance.barY-8);
    await page.screenshot({path:path.join(output,'model-anime-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'model-anime-check.json'),JSON.stringify({reports,memory,clearance,errors},null,2)+'\n');console.log(JSON.stringify({checks:'passed',memory,artifacts:output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
