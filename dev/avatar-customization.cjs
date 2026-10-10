// Real-browser checks for inspection, tailoring, style persistence and support.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const url=process.env.BIJOU_URL||'http://localhost:8897',out=path.join(os.tmpdir(),'bijou-customization');
async function inspect(page,errors){
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/js/avatar.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('return {svg,uid:','return {get camera(){return camera;},get model(){return model;},get character(){return character;},svg,uid:')});});
  await page.route('**/js/app.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('bindEvents({ doll, motion, behavior, fx });','bindEvents({ doll, motion, behavior, fx });window.checks={doll,motion,behavior};')});});
}
const body=p=>p.evaluate(async()=>(await import('/js/state.js')).state.body);
(async()=>{
  const browser=await chromium.launch(),errors=[];await fs.mkdir(out,{recursive:true});
  try{
    const p=await browser.newPage({viewport:{width:1440,height:1040}});await inspect(p,errors);await p.goto(url);await p.waitForSelector('[data-renderer="3d"]');
    await p.locator('.tailor > summary').click();
    for(const id of ['studio-underwear','studio-leggings','studio-jeggings','studio-jeans','studio-crop','studio-tee','studio-cami','studio-sweater','studio-skirt','studio-dress']){
      await p.locator('#garmentPattern').selectOption(id);
      assert.equal(await p.evaluate(async id=>Object.values((await import('/js/state.js')).state.outfit).includes(id),id),true);
    }
    await p.locator('#garmentPattern').selectOption('studio-jeans');await p.locator('#tailor-length').fill('83');await p.locator('#tailor-rise').fill('77');
    await p.locator('#garmentPattern').selectOption('studio-crop');await p.locator('#tailor-length').fill('25');await p.locator('#tailor-fabric').selectOption('knit');
    await p.locator('[data-tailor-color="color"]').fill('#8f769a');await p.locator('[data-tailor-fit="relaxed"]').click();
    await p.locator('.tailor summary').filter({hasText:'Regional fit'}).click();await p.locator('#tailor-waistEase').fill('35');
    await p.waitForTimeout(500);
    const tailored=await p.evaluate(async()=>structuredClone((await import('/js/state.js')).state.garments));
    assert.equal(tailored['studio-jeans'].length,.83);assert.equal(tailored['studio-crop'].waistEase,.35);assert.equal(tailored['studio-crop'].color,'#8f769a');
    await p.screenshot({path:path.join(out,'tailoring.png')});
    await p.locator('#tab-body').click();await p.locator('[data-body-region="bust"]').click();
    await p.waitForFunction(()=>checks.doll.camera.zoom>2.6);assert.equal(await p.locator('#shapeFocus').inputValue(),'region');
    await p.locator('#body-bustVolume').fill('78');await p.locator('#body-bustSpacing').fill('58');
    await p.locator('[data-body-region="belly"]').click();await p.locator('#body-fullness').fill('55');
    const before=await body(p);await p.locator('[data-shape-tool="rotate"]').click();
    const rect=await p.locator('.avatar-canvas').boundingBox(),x=rect.x+rect.width*.5,y=rect.y+rect.height*.44;
    const rotation=await p.evaluate(()=>checks.doll.camera.quaternion.toArray());
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+120,y+40,{steps:12});await p.mouse.up();await p.locator('[data-shape-zoom="in"]').click();
    await p.waitForFunction(()=>checks.doll.camera.zoom>3);assert.notDeepEqual(await p.evaluate(()=>checks.doll.camera.quaternion.toArray()),rotation);assert.deepEqual(await body(p),before);
    await p.locator('[data-shape-tool="rotate"]').focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('+');
    await p.screenshot({path:path.join(out,'orbit-closeup.png')});
    await p.locator('#tab-style').click();await p.waitForFunction(()=>Math.abs(checks.doll.camera.zoom-1)<.01&&Math.abs(checks.doll.camera.quaternion.y)<.01);
    assert.equal(await p.evaluate(()=>checks.doll.editing),false);
    const pictures=[];
    for(const id of ['anime3d','realistic','anime2d']){
      await p.locator(`[data-render-style="${id}"]`).click();await p.waitForTimeout(350);
      assert.equal(await p.evaluate(async()=>(await import('/js/state.js')).state.renderStyle),id);
      pictures.push(await p.evaluate(()=>checks.doll.capture({height:400})));
      await p.locator('#stage').screenshot({path:path.join(out,`finish-${id}.png`)});
    }
    assert.equal(new Set(pictures).size,3,'art finishes produce different images');
    await p.locator('#tab-looks').click();await p.locator('#lookName').fill('Tailoring study');await p.locator('#lookForm button').click();await p.waitForTimeout(550);
    await p.reload();await p.waitForSelector('[data-renderer="3d"]');
    const saved=await p.evaluate(async()=>{const {state}=await import('/js/state.js');return {garments:state.garments,style:state.renderStyle,look:state.looks[0]}});
    assert.deepEqual(saved.garments,tailored);assert.equal(saved.style,'anime2d');assert.deepEqual(saved.look.garments,tailored);assert.equal(saved.look.renderStyle,'anime2d');
    await p.locator('#tab-wardrobe').click();await p.locator('.tailor > summary').click();await p.locator('#garmentPattern').selectOption('studio-crop');await p.locator('#tailor-length').fill('65');
    await p.locator('#tab-style').click();await p.locator('[data-render-style="realistic"]').click();await p.locator('#tab-looks').click();await p.locator('[data-look]').first().click();
    assert.equal(await p.evaluate(async()=>(await import('/js/state.js')).state.renderStyle),'anime2d');assert.deepEqual(await p.evaluate(async()=>(await import('/js/state.js')).state.garments),tailored);
    console.log('PASS all tailoring patterns, cuts/fit/colors, independent chest/fullness, orbit/zoom, camera return, finish and saved-look roundtrip');
    await p.locator('#tab-wardrobe').click();await p.locator('[data-cat="basics"]').click();assert.equal(await p.locator('#items [data-id]').count(),11);
    await p.locator('[data-collection="seaglass"]').click();if(!await p.locator('.tailor').evaluate(el=>el.open))await p.locator('.tailor > summary').click();await p.locator('#garmentPattern').selectOption('swim-bikini');
    await p.locator('[data-tailor-color="color"]').fill('#9b697c');
    assert.equal(await p.evaluate(async()=>{const {state}=await import('/js/state.js'),{matchingCollection}=await import('/js/collections.js');return !!matchingCollection(state);}),false);
    await p.locator('[data-collection="seaglass"]').click();
    const restored=await p.evaluate(async()=>{const {state}=await import('/js/state.js'),{matchingCollection}=await import('/js/collections.js');return {id:matchingCollection(state)?.id,garments:state.garments};});
    assert.equal(restored.id,'seaglass');assert.equal(restored.garments['swim-bikini'],undefined);assert.deepEqual(restored.garments['studio-crop'],tailored['studio-crop']);
    console.log('PASS Basics and signature palette restoration preserve other tailored patterns');await p.close();

    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),m=await context.newPage();await inspect(m,errors);await m.goto(url);await m.waitForSelector('[data-renderer="3d"]');
    await m.locator('#tab-body').click();await m.locator('[data-body-region="waist"]').click();await m.locator('#stage').scrollIntoViewIfNeeded();await m.locator('[data-shape-tool="rotate"]').click();await m.waitForTimeout(700);
    const beforeTouch=await body(m),box=await m.locator('.avatar-canvas').boundingBox(),mx=box.x+box.width*.5,my=box.y+box.height*.43;
    const cdp=await context.newCDPSession(m),point=(id,x,y)=>({id,x,y,radiusX:3,radiusY:3,force:1}),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    await touch('touchStart',[point(1,mx-20,my)]);await touch('touchStart',[point(1,mx-20,my),point(2,mx+20,my)]);
    await touch('touchMove',[point(1,mx-25,my),point(2,mx+25,my)]);await touch('touchMove',[point(1,mx-45,my),point(2,mx+45,my)]);await touch('touchEnd',[]);
    await m.waitForFunction(()=>checks.doll.camera.zoom>3.3);assert.deepEqual(await body(m),beforeTouch,'camera pinching does not sculpt');
    await m.locator('[data-shape-done]').click();await m.waitForFunction(()=>Math.abs(checks.doll.camera.zoom-1)<.01);
    await m.locator('#tab-wardrobe').click();await m.locator('.tailor > summary').click();await m.locator('#garmentPattern').selectOption('studio-sweater');
    for(const width of [390,320]){await m.setViewportSize({width,height:844});assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await m.screenshot({path:path.join(out,'mobile-tailor.png')});await context.close();console.log('PASS touch camera pinch, exit and mobile tailoring layout');

    const model=await browser.newPage({viewport:{width:480,height:650}});await inspect(model,errors);await model.goto(`${url}/dev/model.html`);await model.waitForFunction(()=>window.ready);
    const support=await model.evaluate(async()=>{
      const {BODY_PRESETS}=await import('/js/body-shape.js'),original=structuredClone(study.cfg);
      const bodies=[...BODY_PRESETS.map(p=>({...original.body,...p.values})),{...original.body,height:0},{...original.body,height:1},{...original.body,waistFullness:1,bellyFullness:1,hipsFullness:1,legsFullness:1,bustVolume:1}];
      let floor=0,seat=0,lengthError=0,cases=0;study.doll.setEditing(true);
      for(const body of bodies)for(const shoes of [null,'shoes-sneaker','shoes-captain']){
        study.build({...original,body,outfit:{top:'studio-tee',bottom:'studio-leggings',...(shoes?{shoes}:{})}});
        for(const pose of ['stand','elegant','stretch','sit']){
          study.setPose(pose);for(let i=0;i<3;i++)study.step();const d=study.doll.diagnostics.support,rest=study.doll.model.bones;
          floor=Math.max(floor,...Object.values(d.soles).map(Math.abs));if(d.seatGap!==null)seat=Math.max(seat,Math.abs(d.seatGap));
          for(const [side,leg] of Object.entries(d.legs)){
            const length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
            lengthError=Math.max(lengthError,Math.abs(length(leg.hip,leg.knee)-rest[`${side}LowerLeg`].position.length()),Math.abs(length(leg.knee,leg.ankle)-rest[`${side}Foot`].position.length()));
          }cases++;
        }await new Promise(requestAnimationFrame);
      }
      study.build({...original,body:{...original.body,bellyFullness:.65,hipsFullness:.6,legsFullness:.6},outfit:{top:'studio-sweater',bottom:'studio-jeans'},garments:{'studio-sweater':{ease:.75,waistEase:.3}}});study.setPose('elegant');study.step();
      return {floor,seat,lengthError,cases};
    });
    assert.ok(support.floor<.008,`floor contact: ${support.floor}m`);assert.ok(support.seat<.008,`seat contact: ${support.seat}m`);assert.ok(support.lengthError<1e-6,'support never stretches leg bones');
    await model.screenshot({path:path.join(out,'fullness-and-oversized.png')});console.log('PASS body/height/shoes support matrix',support);
    const textiles=await model.evaluate(async()=>{
      const {FABRICS}=await import('/js/garment-templates.js'),original=structuredClone(study.cfg),memory=[];let cases=0;
      for(let cycle=0;cycle<2;cycle++){
        for(const id of ['studio-skirt','studio-dress'])for(const fabric of FABRICS)for(const renderStyle of ['anime3d','anime2d','realistic']){
          const slot=id==='studio-skirt'?'bottom':'dress';
          study.build({...original,renderStyle,outfit:{[slot]:id,...(slot==='bottom'?{top:'studio-tee'}:{})},garments:{[id]:{fabric:fabric.id,color:cycle?'#719590':'#a58a9c'}}});study.step();await new Promise(requestAnimationFrame);cases++;
        }
        memory.push({...study.doll.stats});
      }
      const geometry=settings=>{
        study.build({...original,outfit:{bottom:'studio-skirt',top:'studio-tee'},garments:{'studio-skirt':settings}});study.step();
        const skirt=study.doll.model.wardrobe.groups.flatMap(g=>g.children).find(m=>m.userData.skirt);
        return [...skirt.geometry.attributes.position.array];
      };
      const base=geometry({ease:0,stretch:0}),deltas={};
      for(const key of ['ease','waistEase','hipEase','stretch']){const changed=geometry({ease:0,stretch:0,[key]:1});deltas[key]=Math.max(...changed.map((v,i)=>Math.abs(v-base[i])));}
      return {cases,memory,deltas};
    });
    assert.equal(textiles.memory[0].textures,textiles.memory[1].textures,'fabric color changes reuse textures');assert.equal(textiles.memory[0].geometries,textiles.memory[1].geometries,'garment rebuilds release geometry');
    for(const [key,delta] of Object.entries(textiles.deltas))assert.ok(delta>.001,`${key} changes the skirt surface`);
    console.log('PASS 60 skirt/dress fabric-finish cases, regional ease, stretch and resource stability',textiles);
    assert.deepEqual(errors,[],'no JavaScript or shader errors');console.log(`Screenshots: ${out}`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
