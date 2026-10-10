// Render the real model into local wardrobe and face previews. Server + Playwright required.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:650,height:900},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const dir=path.join(__dirname,'../assets/previews');await fs.mkdir(dir,{recursive:true});
    await page.goto('http://localhost:8897/dev/model.html');await page.waitForFunction(()=>window.ready);
    for(const id of ['seaglass','captain','midnight']){
      const data=await page.evaluate(async id=>{
        const{COLLECTIONS}=await import('../js/collections.js'),{DEFAULT_BODY}=await import('../js/looks.js');
        const look=COLLECTIONS.find(c=>c.id===id);study.build({body:{...DEFAULT_BODY},head:{...look.head},outfit:{...look.outfit}});study.setPose(look.pose);study.step();
        return study.doll.capture({height:640,mime:'image/webp'});
      },id);
      await fs.writeFile(path.join(dir,`${id}.webp`),Buffer.from(data.split(',')[1],'base64'));
    }
    for(const face of ['soft','oval','heart','defined']){
      const data=await page.evaluate(async face=>{
        const{DEFAULT_BODY,DEFAULT_HEAD}=await import('../js/looks.js');study.build({body:{...DEFAULT_BODY},head:{...DEFAULT_HEAD,front:'split',face},outfit:{}});study.setPose('shape');study.step();
        const source=document.querySelector('.avatar-canvas'),c=document.createElement('canvas');c.width=c.height=240;
        c.getContext('2d').drawImage(source,245,145,164,164,0,0,240,240);return c.toDataURL('image/webp',.88);
      },face);
      await fs.writeFile(path.join(dir,`face-${face}.webp`),Buffer.from(data.split(',')[1],'base64'));
    }
    if(errors.length)throw Error(errors.join('\n'));console.log('Rendered 3 ensembles and 4 face variants.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
