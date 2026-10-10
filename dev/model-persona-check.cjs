// Movable eyes, head tracking, sculpted hair and limb-length regression checks.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const output=path.join(os.tmpdir(),'bijou-model-persona');fs.mkdirSync(output,{recursive:true});
const near=(a,b,e=.00001)=>assert(Math.abs(a-b)<e,`${a} differs from ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true}),errors=[],reports={};
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://localhost:8897/dev/model-studio.html');await page.waitForFunction(()=>window.ready,{timeout:60000});
    assert.equal(await page.evaluate(()=>modelStudio.hair.style),'hime');assert.equal(await page.evaluate(()=>modelStudio.appearance.face),'oval');
    for(const candidate of ['sculpt','t2']){
      await page.evaluate(id=>modelStudio.selectCandidate(id),candidate);
      reports[candidate]=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),{MODEL_DEFAULTS,MODEL_PRESETS}=await import('/js/model-shape.js'),{APPEARANCE_DEFAULTS,FACE_STYLES}=await import('/js/model-appearance.js'),{CLOTHES_DEFAULTS}=await import('/js/model-clothes.js'),{HAIR_DEFAULTS,GAZE_DEFAULTS,SOURCE_HAIR,SOURCE_GAZE,EXPRESSIONS}=await import('/js/model-persona.js');
        const s=modelStudio.stage,finite=()=>{for(const r of s.sculpt.records){for(const key of ['position','normal','tangent'])if(r.node.geometry.attributes[key]&&!r.node.geometry.attributes[key].array.every(Number.isFinite))throw Error('Nonfinite '+key);
          const n=r.node.geometry.attributes.normal,t=r.node.geometry.attributes.tangent;if(t)for(let i=0;i<n.count;i++){const dot=n.getX(i)*t.getX(i)+n.getY(i)*t.getY(i)+n.getZ(i)*t.getZ(i);if(Math.abs(dot)>.0005)throw Error('Tangent is not perpendicular to the edited normal');}
        }};
        const look=(shape=MODEL_DEFAULTS,face=APPEARANCE_DEFAULTS,hair=HAIR_DEFAULTS,gaze={...GAZE_DEFAULTS,blink:false})=>s.setLook(shape,face,CLOTHES_DEFAULTS,hair,gaze);
        look();const points=()=>s.sculpt.bones.get('LeftHand').node.getWorldPosition(new T.Vector3());
        const neutral=points(),a=s.sculpt.field.landmarks,segments=[];
        for(const u of [-1,1])for(const v of [-1,1]){
          look({...MODEL_DEFAULTS,upperArmLength:u,forearmLength:v});
          const shoulder=s.sculpt.bones.get('LeftArm').node.getWorldPosition(new T.Vector3()),elbow=s.sculpt.bones.get('LeftForeArm').node.getWorldPosition(new T.Vector3()),wrist=points();
          const upper=Math.hypot(a.elbowX-a.shoulderX,a.elbowY-a.shoulder,a.elbowZ-a.shoulderZ),lower=Math.hypot(a.wristX-a.elbowX,a.wristY-a.elbowY,a.wristZ-a.elbowZ);
          if(Math.abs(shoulder.distanceTo(elbow)/upper-(1+.18*u))>.00001||Math.abs(elbow.distanceTo(wrist)/lower-(1+.18*v))>.00001)throw Error('Arm segment did not resize');segments.push([u,v,wrist.distanceTo(neutral)]);finite();
        }
        let eyeCases=0,maxEyeDelta=0;const meshScale=s.sculpt.records.map(r=>r.node.getWorldScale(new T.Vector3()).x);
        for(const height of [150,195])for(const face of FACE_STYLES){
          look({...MODEL_DEFAULTS,height},{...APPEARANCE_DEFAULTS,face:face.id});const base=s.sculpt.snapshot();
          for(const [x,y]of [[-1,-1],[1,1]]){
            s.gaze.set({...GAZE_DEFAULTS,x,y,blink:false});s.gaze.update(0,false,0);finite();
            const moved=s.sculpt.snapshot();let changed=0;
            for(let m=0;m<base.length;m++)for(let i=0;i<base[m].length;i++){
              const delta=Math.abs(moved[m][i]-base[m][i]);if(delta>.00001)changed++;maxEyeDelta=Math.max(maxEyeDelta,delta*meshScale[m]);
              const vertex=Math.floor(i/3);if(s.sculpt.records[m].points[vertex*3+1]<a.neck&&delta>.00001)throw Error('Gaze changed body');
            }
            if(changed<50)throw Error('Gaze does not move eyes');eyeCases++;
          }
          s.gaze.set({...GAZE_DEFAULTS,blink:false});s.gaze.reset();const reset=s.sculpt.snapshot();for(let m=0;m<base.length;m++)for(let i=0;i<base[m].length;i++)if(Math.abs(reset[m][i]-base[m][i])>.00001)throw Error('Gaze reset drift');
        }
        let expressionCases=0;for(const e of EXPRESSIONS){look(MODEL_DEFAULTS,{...APPEARANCE_DEFAULTS,expression:e.id});s.gaze.update(0,false,0);finite();if(e.id==='wink'&&s.gaze.diagnostics.blinks[0]!==1)throw Error('Wink missing');expressionCases++;}
        look();s.gaze.set({...GAZE_DEFAULTS,blink:true});s.gaze.update(0,false,3.56);if(s.gaze.diagnostics.blinks[0]<.99)throw Error('Automatic blink missing');s.gaze.update(0,false,3.8);if(s.gaze.diagnostics.blinks[0]!==0)throw Error('Blink stuck');
        s.gaze.set({...GAZE_DEFAULTS,blink:false});s.gaze.blink();s.gaze.update(.11,false,0);if(s.gaze.diagnostics.blinks[0]<.99)throw Error('Preview blink missing');s.gaze.reset();
        const head=s.sculpt.bones.get('Head').node,rest=head.quaternion.clone();s.gaze.set({...GAZE_DEFAULTS,x:1,y:1,follow:true,headFollow:true,blink:false});s.gaze.setTarget(-.8,.6);
        for(let i=0;i<30;i++){s.gaze.restoreHead();s.gaze.update(1/60,false,i/60);}
        const headAngle=head.quaternion.angleTo(rest);if(headAngle<.05||headAngle>.18)throw Error('Unbounded or missing head following');s.gaze.restoreHead();if(head.quaternion.angleTo(rest)>.000001)throw Error('Head failed to restore');
        s.gaze.set({...SOURCE_GAZE,headFollow:true,x:1});s.gaze.update(.1,false,0);if(head.quaternion.angleTo(rest)>.000001)throw Error('Disabled eyes still track');
        let hairCases=0;for(const style of ['hime','swept','bob','source'])for(const length of [0,1]){
          look(MODEL_DEFAULTS,APPEARANCE_DEFAULTS,{...HAIR_DEFAULTS,style,length,volume:length,color:'#d36599'});finite();
          if(style==='source'){if(s.hair.group||s.hair.diagnostics.hiddenSourceTriangles!==0)throw Error('Source hair restoration failed');for(const r of s.sculpt.records)if(r.node.geometry.index!==r.index)throw Error('Changed original index');}
          else {if(s.hair.group.children.length<10||s.hair.group.parent.name!=='Head')throw Error('Hair attachment missing');if(s.hair.diagnostics.hiddenSourceTriangles<100)throw Error('Outer source hair not omitted');}
          hairCases++;
        }
        look();s.setTime(.45);s.hair.update(1/30);const before=s.hair.group.matrix.clone();s.setSurface('realistic');if(!s.hair.group.matrix.equals(before))throw Error('Finish change detached animated hair');s.setShape(MODEL_DEFAULTS);
        s.gaze.set({...GAZE_DEFAULTS,headFollow:true,x:1,blink:false});let motion=0;
        for(let i=0;i<60;i++){s.gaze.restoreHead();s.gaze.update(1/60,false,i/60);s.hair.update(1/60);motion=Math.max(motion,s.hair.diagnostics.maxDisplacement);}
        if(!Number.isFinite(motion)||motion>.12)throw Error('Unbounded hair motion');s.hair.update(0,true);if(s.hair.diagnostics.maxDisplacement>1e-6)throw Error('Hair reset drift');
        look();s.setSurface('anime3d');return {segments,eyeCases,expressionCases,hairCases,maxEyeDeltaMeters:maxEyeDelta,headAngle,maxHairDisplacement:motion};
      });
      // Exercise real controls/history and retain a reviewable screenshot.
      await page.click('[data-starter=figurine]');await page.click('[data-panel=face]');await page.uncheck('#auto-blink');await page.locator('#gaze-x').fill('0.6');await page.locator('#gaze-y').fill('0.2');await page.evaluate(()=>modelStudio.flush());
      near(await page.evaluate(()=>modelStudio.gaze.x),.6);await page.click('#undo');near(await page.evaluate(()=>modelStudio.gaze.y),0);await page.click('#redo');near(await page.evaluate(()=>modelStudio.gaze.y),.2);
      await page.check('#compare');assert.equal(await page.evaluate(()=>modelStudio.stage.gaze.settings.mode),'source');assert.equal(await page.evaluate(()=>modelStudio.stage.hair.settings.style),'source');await page.uncheck('#compare');
      await page.check('#gaze-follow');await page.check('#head-follow');await page.mouse.move(950,200);await page.waitForFunction(()=>modelStudio.stage.gaze.diagnostics.x>.2,{timeout:5000});
      assert(await page.evaluate(()=>modelStudio.stage.gaze.diagnostics.x)>.2);await page.click('#reset-gaze');await page.selectOption('#expression','wink');await page.evaluate(()=>modelStudio.flush());
      await page.click('[data-view=front]');await page.screenshot({path:path.join(output,candidate+'-wink.png')});
      await page.selectOption('#expression','smile');await page.click('[data-panel=hair]');await page.selectOption('#hair-style','bob');await page.click('[data-hair-color="#d36599"]');
      await page.click('#undo');await page.click('#redo');await page.evaluate(()=>modelStudio.flush());
      await page.screenshot({path:path.join(output,candidate+'-hair.png')});
      await page.click('[data-starter=figurine]');await page.evaluate(()=>{modelStudio.setGaze({blink:false,x:.5,y:.15});modelStudio.flush();});
      reports[candidate].export=await page.evaluate(async()=>{
        const T=await import('/js/vendor/avatar-engine.js'),s=modelStudio.stage,sourceImage=s.sculpt.records[0].node.material.map.image,data=await s.exportGLB();
        if(s.sculpt.records[0].node.material.map.image!==sourceImage)throw Error('Export changed original texture image');
        const gltf=await new T.GLTFLoader().parseAsync(data,''),source=s.bounds(),box=new T.Box3().setFromObject(gltf.scene),hair=gltf.scene.getObjectByName('Bijou_sculpted_hair');
        if(!hair||hair.children.length<10)throw Error('Export lacks sculpted hair');
        const frames=[],mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();
        for(const time of [.1,.45,.9]){s.setTime(time);mixer.setTime(time);gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(n=>{if(n.isSkinnedMesh)n.computeBoundingBox();});const b=new T.Box3().setFromObject(gltf.scene);frames.push({source:s.bounds(),min:b.min.toArray(),max:b.max.toArray()});}
        const mats=new Set(),textures=new Set(),skeletons=new Set();gltf.scene.traverse(n=>{if(n.isMesh){n.geometry.dispose();for(const m of [n.material].flat())mats.add(m);if(n.skeleton)skeletons.add(n.skeleton);}});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();for(const s of skeletons)s.dispose();
        s.setMotion(false);return {bytes:data.byteLength,source,min:box.min.toArray(),max:box.max.toArray(),hairMeshes:hair.children.length,frames};
      });
      const exported=reports[candidate].export;for(let k=0;k<3;k++){near(exported.source.min[k],exported.min[k],.0002);near(exported.source.max[k],exported.max[k],.0002);}for(const f of exported.frames)for(let k=0;k<3;k++){near(f.source.min[k],f.min[k],.0003);near(f.source.max[k],f.max[k],.0003);}
      const download=page.waitForEvent('download');await page.click('#export-shape');const file=await download,recipePath=path.join(output,candidate+'-look.json');await file.saveAs(recipePath);const recipe=JSON.parse(fs.readFileSync(recipePath));assert.equal(recipe.version,4);assert.equal(recipe.gaze.x,.5);assert.equal(recipe.hair.color,'#d36599');
      await page.click('[data-starter=hime]');await page.locator('#import-shape').setInputFiles(recipePath);await page.waitForFunction(()=>modelStudio.hair.color==='#d36599');
      await page.click('#full-figure');await page.click('[data-view=three]');await page.screenshot({path:path.join(output,candidate+'-figurine.png')});
      console.log(JSON.stringify({candidate,...reports[candidate],export:{bytes:exported.bytes,hairMeshes:exported.hairMeshes,roundtrip:'passed'}}));
    }
    await page.reload();await page.waitForFunction(()=>window.ready,{timeout:60000});assert.equal(await page.evaluate(()=>modelStudio.hair.color),'#d36599');near(await page.evaluate(()=>modelStudio.gaze.x),.5);
    const memory=[];for(let cycle=0;cycle<2;cycle++){for(const candidate of ['sculpt','t2']){await page.evaluate(id=>modelStudio.selectCandidate(id),candidate);for(const finish of ['realistic','anime2d','clay','anime3d'])await page.selectOption('#surface',finish);}await page.waitForTimeout(100);memory.push(await page.evaluate(()=>modelStudio.stage.stats));}assert.deepEqual(memory[0],memory[1]);
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{modelStudio.setGaze({blink:true,follow:true,headFollow:true});modelStudio.flush();});await page.mouse.move(1000,100);await page.waitForTimeout(300);const reduced=await page.evaluate(()=>({eyes:modelStudio.stage.gaze.diagnostics,hair:modelStudio.stage.hair.diagnostics}));assert.deepEqual(reduced.eyes.blinks,[0,0]);near(reduced.hair.maxDisplacement,0);
    await page.setViewportSize({width:390,height:844});await page.click('[data-panel=face]');await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({reports,memory,reduced,errors},null,2));console.log(JSON.stringify({checks:'passed',memory,artifacts:output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
