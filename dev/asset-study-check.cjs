// Local GLB evaluation checks; never calls Meshy's API.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');

(async()=>{
  const out=path.join(os.tmpdir(),'bijou-meshy-study');fs.mkdirSync(out,{recursive:true});
  const files={generated:'generated.glb',working:'working.glb',rigged:'rigged.glb',walking:'walking.glb',t2:'../meshy-hime-t2/generated.glb',t2rig:'../meshy-hime-t2/rigged.glb',t2walk:'../meshy-hime-t2/walking.glb'};
  const assets=Object.keys(files).filter(key=>fs.existsSync(path.join(__dirname,'../assets/studies/meshy-hime-v1',files[key])));
  assert(assets.length,'No downloaded study models.');
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1300,height:1050},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto('http://localhost:8897/dev/asset-study.html');
    await page.waitForFunction(()=>window.ready,{timeout:60000});
    const reports={},memory=[];
    for(let cycle=0;cycle<2;cycle++){
      for(const asset of assets){
        await page.evaluate(asset=>assetStudy.loadAsset(asset),asset);
        assert(await page.evaluate(()=>window.ready),asset+' did not load');
        reports[asset]=await page.evaluate(()=>assetStudy.report);
        assert(reports[asset].triangles>0);assert(reports[asset].materials.length>0);
        const bounds=await page.evaluate(()=>assetStudy.bounds());
        assert(Math.abs(bounds.min[1])<.00001,asset+' ground shifted when switching models');
        assert(Math.abs(bounds.max[1]-1.68)<.00001,asset+' height changed when switching models');
        assert(bounds.screenMin[1]>-1&&bounds.screenMax[1]<1,asset+' full figure is clipped');
        reports[asset].neutralBounds=bounds;
        for(const surface of ['realistic','anime3d','anime2d','clay','unlit']){
          await page.selectOption('#surface',surface);
          await page.waitForTimeout(180);
          if(cycle===0&&['realistic','anime3d','clay'].includes(surface))await page.screenshot({path:path.join(out,`${asset}-${surface}.png`)});
        }
        await page.check('#wire');await page.check('#skeleton');await page.waitForTimeout(100);
        await page.uncheck('#wire');await page.uncheck('#skeleton');
        await page.selectOption('#surface','realistic');
        await page.click('[data-view=side]');
        if(cycle===0)await page.screenshot({path:path.join(out,`${asset}-side.png`)});
        await page.click('[data-view=front]');
        if(reports[asset].animations.some(clip=>clip.duration>.1)){
          for(const time of [.1,.45,.9]){
            await page.locator('#scrub').fill(String(time));
            await page.waitForTimeout(150);
            const movingBounds=await page.evaluate(()=>assetStudy.bounds());
            assert(movingBounds.min[1]>-.02&&movingBounds.min[1]<.1,'Walking model left the floor area');
            assert(movingBounds.max[1]<1.9,'Walking model left the full-figure camera frame');
            assert(movingBounds.screenMin[1]>-1&&movingBounds.screenMax[1]<1,'Walking feet/head are clipped');
            if(cycle===0)await page.screenshot({path:path.join(out,`${asset}-frame-${time}.png`)});
          }
          await page.check('#play');await page.waitForTimeout(250);await page.uncheck('#play');
          assert((await page.locator('#scrub').inputValue())!=='0');
          await page.evaluate(()=>assetStudy.setTime(0));
        }else assert(await page.locator('#play').isDisabled(),'Static pose should not offer playback');
      }
      await page.waitForTimeout(150);memory.push(await page.evaluate(()=>assetStudy.stats));
    }
    assert.deepEqual(memory[0],memory[1],'GPU resource counts changed across the same asset cycle');
    await page.selectOption('#focus','torso');
    const canvas=page.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('+');await page.mouse.wheel(0,-120);
    await page.mouse.move(850,420);await page.mouse.down();await page.mouse.move(940,450,{steps:5});await page.mouse.up();
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#play').isChecked(),false);
    await page.setViewportSize({width:390,height:844});
    await page.selectOption('#focus','figure');await page.waitForTimeout(200);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
    await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    const result={assets,reports,memory,errors,artifacts:out};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
