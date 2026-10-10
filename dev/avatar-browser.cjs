// Requires Playwright and a server: make serve; node dev/avatar-browser.cjs
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const url=process.env.BIJOU_URL||'http://localhost:8897';
const out=path.join(os.tmpdir(),'bijou-checks');
const stateBody=p=>p.evaluate(async()=>({...((await import('/js/state.js')).state.body)}));
const wait=p=>p.waitForTimeout(150);
async function main(){
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch(),errors=[];
  function listen(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_FAILED'))errors.push(m.text());});}
  try{
    const desktop=await browser.newContext({viewport:{width:1440,height:1040}}),p=await desktop.newPage();listen(p);
    await p.goto(url);await p.waitForSelector('[data-renderer="3d"]');
    const originalStyle=await p.evaluate(async()=>{const {state}=await import('/js/state.js');return {head:state.head,outfit:state.outfit}});
    assert.equal(originalStyle.head.face,'oval');assert.equal(originalStyle.head.back,'long');assert.equal(originalStyle.head.hair,'raven');
    assert.deepEqual(originalStyle.outfit,{swim:'swim-bikini'});assert.equal(await p.locator('[data-collection="crimson"]').count(),0);
    await p.locator('#tab-body').click();await p.locator('[data-body-action="edit"]').click();
    await p.waitForSelector('.stage.is-shaping');await p.waitForTimeout(600);
    const heights=[];
    for(const id of ['bright','athletic','gentle','elegant']){
      await p.locator(`[data-archetype="${id}"]`).click();await wait(p);
      const body=await stateBody(p);assert.equal(body.archetype,id);heights.push(body.height);
      assert.deepEqual(await p.evaluate(async()=>{const {state}=await import('/js/state.js');return {head:state.head,outfit:state.outfit}}),originalStyle,'archetypes preserve face and clothing');
    }
    assert.equal(new Set(heights).size,4,'archetypes start at distinct heights');
    await p.locator('[data-body-region="belly"]').click();
    await p.locator('#body-bellyUpper').fill('85');await p.locator('#body-bellyLower').fill('25');await wait(p);
    assert.equal((await stateBody(p)).bellyUpper,.85);assert.equal((await stateBody(p)).bellyLower,.25);
    await p.locator('#shapeFocus').selectOption('region');
    await p.locator('[data-shape-view="profile"]').click();await p.waitForTimeout(400);
    await p.screenshot({path:path.join(out,'belly-closeup.png')});
    await p.locator('summary').filter({hasText:/^Nails$/}).click();await p.locator('[data-nail-shape="almond"]').click();await p.locator('[data-nail-color="ruby"]').click();
    await p.locator('#body-nailLength').fill('60');await p.locator('[data-body-action="inspect-hands"]').click();await wait(p);
    assert.equal((await stateBody(p)).nailLength,.6);assert.equal((await stateBody(p)).nailColor,'ruby');
    assert.equal(await p.locator('#shapeFocus').inputValue(),'hands');
    await p.locator('[data-shape-done]').click();await p.locator('[data-body-action="edit"]').click();
    assert.equal(await p.locator('#shapeFocus').inputValue(),'figure','framing selector resets when reopening Shape mode');
    await p.locator('summary').filter({hasText:/^Rendering detail$/}).click();await p.locator('[data-quality="detailed"]').click();
    assert.equal(await p.evaluate(async()=>(await import('/js/state.js')).state.renderQuality),'detailed');
    await p.locator('[data-quality="balanced"]').click();
    await p.locator('[data-body-region="waist"]').click();await p.locator('[data-shape-view="front"]').click();await p.waitForTimeout(600);
    console.log('PASS Hime/oval default, bikini, archetypes, belly, nails, inspection, rendering quality');
    await p.locator('[data-body-preset="rounded"]').click();await wait(p);
    const before=(await stateBody(p)).waist,knob=await p.locator('[data-shape-region="waist"]').boundingBox();
    await p.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2);await p.mouse.down();
    await p.mouse.move(knob.x+knob.width/2+45,knob.y+knob.height/2,{steps:8});await p.mouse.up();await wait(p);
    const changed=(await stateBody(p)).waist;assert.ok(changed>before+.1,'mouse drag reshapes waist');
    await p.locator('[data-body-action="undo"]').click();assert.equal((await stateBody(p)).waist,before);
    await p.locator('[data-body-action="redo"]').click();assert.equal((await stateBody(p)).waist,changed);
    await p.locator('[data-shape-view="profile"]').click();await wait(p);
    await p.screenshot({path:path.join(out,'body-profile.png')});
    await p.locator('[data-shape-view="front"]').click();
    await p.locator('[data-shape-region="waist"]').focus();await p.keyboard.press('ArrowLeft');
    assert.ok((await stateBody(p)).waist<changed,'keyboard equivalent for shaping');
    const savedBody=await stateBody(p);
    await p.locator('#tab-looks').click();assert.equal(await p.locator('.stage.is-shaping').count(),0);
    await p.locator('#lookName').fill('Body regression');await p.locator('#lookForm button').click();await p.waitForTimeout(500);
    const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('bijou-site:save')).data);
    assert.equal(stored.looks[0].body.waist,savedBody.waist);assert.match(stored.looks[0].preview,/^data:image\/webp/);
    await p.reload();await p.waitForSelector('[data-renderer="3d"]');assert.equal((await stateBody(p)).waist,savedBody.waist);
    assert.equal((await stateBody(p)).nailColor,'ruby');assert.equal((await stateBody(p)).archetype,'elegant');
    const downloadPromise=p.waitForEvent('download');await p.locator('#snapshot').click();const download=await downloadPromise;
    await download.saveAs(path.join(out,'snapshot.png'));assert.ok((await fs.stat(path.join(out,'snapshot.png'))).size>25000);
    // Older saves gain neutral morph defaults and validated limits.
    await p.evaluate(()=>localStorage.setItem('bijou-site:save',JSON.stringify({__v:1,data:{body:{height:.7,build:.2,skin:'honey'},head:{back:'bob'},outfit:{},looks:[{id:'old',name:'Old look',body:{height:.3,build:.8,skin:'peach'}}]}})));
    await p.reload();await p.waitForSelector('[data-renderer="3d"]');const migrated=await stateBody(p);
    assert.equal(migrated.height,.7);assert.equal(migrated.waist,.5);assert.equal(migrated.bounce,.35);
    console.log('PASS desktop shaping, keyboard, undo/redo, persistence, migration, snapshot');

    if(await p.evaluate(()=>'documentPictureInPicture' in window)){
      const opened=desktop.waitForEvent('page');await p.locator('#popOut').click();const pip=await opened;
      await pip.waitForSelector('#stage[data-renderer="3d"]');await pip.screenshot({path:path.join(out,'pop-out.png')});
      await pip.close();await p.waitForSelector('#stage[data-renderer="3d"]');console.log('PASS pop-out and return');
    }

    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const m=await mobile.newPage();listen(m);await m.goto(url);await m.waitForSelector('[data-renderer="3d"]');
    await m.locator('#tab-body').click();await m.locator('[data-body-action="edit"]').click();await m.locator('#stage').scrollIntoViewIfNeeded();await m.waitForTimeout(600);
    const dot=await m.locator('[data-shape-region="waist"]').boundingBox(),x=dot.x+dot.width/2,y=dot.y+dot.height/2;
    const cdp=await mobile.newCDPSession(m),point=(id,x,y)=>({id,x,y,radiusX:3,radiusY:3,force:1});
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const start=(await stateBody(m)).waist;
    await touch('touchStart',[point(1,x,y)]);await touch('touchStart',[point(1,x,y),point(2,x+20,y)]);
    await touch('touchMove',[point(1,x-14,y),point(2,x+38,y)]);await wait(m);
    assert.ok((await stateBody(m)).waist>start+.2,'two-finger pinch changes region');
    await touch('touchCancel',[]);await wait(m);assert.equal((await stateBody(m)).waist,start,'cancel restores pre-gesture body');
    await touch('touchStart',[point(1,x,y)]);await touch('touchStart',[point(1,x,y),point(2,x+20,y)]);
    await touch('touchMove',[point(1,x-12,y),point(2,x+32,y)]);await touch('touchEnd',[]);await wait(m);
    assert.ok((await stateBody(m)).waist>start+.1);
    await m.screenshot({path:path.join(out,'body-mobile.png')});
    assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px layout does not overflow');
    await m.setViewportSize({width:320,height:760});await wait(m);assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px layout does not overflow');
    console.log('PASS touch pinch, cancellation, 320px and 390px layouts');

    await desktop.close();await mobile.close();
    const renderContext=await browser.newContext({viewport:{width:360,height:520}});
    const model=await renderContext.newPage();listen(model);await model.goto(`${url}/dev/model.html`);await model.waitForFunction(()=>window.ready);
    const counts=await model.evaluate(async()=>{
      const {CATALOG}=await import('/js/catalog.js'),{BODY_PRESETS}=await import('/js/body-shape.js'),{POSES}=await import('/js/poses.js');
      const {BACK_STYLES,FACE_SHAPES,SKIN}=await import('/js/looks.js');
      const original=structuredClone(study.cfg);let maxJointError=0;
      for(const preset of BODY_PRESETS){
        study.build({...original,body:{...original.body,...preset.values}});
        for(const pose of Object.keys(POSES)){
          study.setPose(pose);study.step();const d=study.doll.diagnostics;
          for(const side of ['L','R'])for(const part of ['hand','elbow'])maxJointError=Math.max(maxJointError,Math.hypot(...d.chains[side][part].map((v,i)=>v-d.actual[side][part][i])));
        }
        await new Promise(requestAnimationFrame);
      }
      for(const hair of BACK_STYLES){for(const face of FACE_SHAPES){study.build({...original,head:{...original.head,back:hair.id,face:face.id}});study.step();}await new Promise(requestAnimationFrame);}
      for(const skin of SKIN){study.build({...original,body:{...original.body,skin:skin.id}});study.step();}
      study.setPose('stand');const checkpoint=[];
      for(let cycle=0;cycle<2;cycle++){
        for(const [i,item] of CATALOG.entries()){study.build({...original,outfit:{[item.slot]:item.id}});study.step();if(i%10===9)await new Promise(requestAnimationFrame);}
        study.build(original);study.step();checkpoint.push(study.doll.stats);
      }
      return {items:CATALOG.length,poses:Object.keys(POSES).length,presets:BODY_PRESETS.length,heads:BACK_STYLES.length*FACE_SHAPES.length,maxJointError,checkpoint};
    });
    assert.ok(counts.maxJointError<1e-6,'rendered joint positions match collision solver');
    assert.ok(counts.checkpoint[1].geometries<=counts.checkpoint[0].geometries+2,'outfit rebuilds release geometries');
    assert.ok(counts.checkpoint[1].textures<=counts.checkpoint[0].textures+2,'outfit rebuilds release textures');
    console.log('PASS renderer matrix',JSON.stringify(counts));
    await model.evaluate(()=>study.doll.impulse(1.5));await model.waitForTimeout(150);
    assert.ok(await model.evaluate(()=>study.doll.diagnostics.motion.torso.some(v=>Math.abs(v)>.0001)),'bounce responds');
    await model.emulateMedia({reducedMotion:'reduce'});await wait(model);
    assert.deepEqual(await model.evaluate(()=>study.doll.diagnostics.motion.torso),[0,0,0]);
    assert.ok(await model.evaluate(()=>study.doll.diagnostics.hair.maxDisplacement<1e-8),'reduced motion pauses hair');
    await model.emulateMedia({reducedMotion:'no-preference'});
    await model.evaluate(()=>{const cfg=structuredClone(study.cfg);cfg.body.bounce=0;cfg.head.hairMotion=0;study.build(cfg);study.doll.impulse(2)});await wait(model);
    assert.deepEqual(await model.evaluate(()=>study.doll.diagnostics.motion.torso),[0,0,0]);
    assert.ok(await model.evaluate(()=>study.doll.diagnostics.hair.maxDisplacement<1e-8),'hair off restores hairstyle');
    await model.evaluate(()=>{const cfg=structuredClone(study.cfg);cfg.head.hairMotion=.55;study.build(cfg);study.turn=.7});await model.waitForTimeout(350);
    assert.ok(await model.evaluate(()=>{const h=study.doll.diagnostics.hair;return h.strands>0&&h.maxDisplacement>.0001&&h.maxDisplacement<.09}),'hair responds within a bounded displacement');
    console.log('PASS body/hair motion, off, and dynamic reduced-motion setting');

    await model.close();
    const fallback=await renderContext.newPage();listen(fallback);await fallback.route('**/assets/models/bijou.vrm',r=>r.abort());
    await fallback.goto(url);await fallback.waitForSelector('[data-renderer="svg"]');await fallback.locator('#tab-body').click();
    assert.equal(await fallback.locator('#body-depth').isDisabled(),true);await fallback.locator('[data-body-preset="soft"]').click();
    assert.equal((await stateBody(fallback)).hips,.65);assert.ok(await fallback.locator('#doll .bj-parts').count());
    console.log('PASS failed-model SVG fallback');
    assert.deepEqual(errors,[],'no JavaScript or shader errors');
    console.log(`Screenshots: ${out}`);
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
