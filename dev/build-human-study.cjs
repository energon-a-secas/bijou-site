const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();page.on('pageerror',e=>console.error(e));
    await page.goto('http://localhost:8897/dev/model-studio.html');
    const result=await page.evaluate(async()=>{
      const {buildHumanStudy}=await import('./human-study-builder.js'),{binary,report}=await buildHumanStudy(),bytes=new Uint8Array(binary);
      let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {data:btoa(raw),report};
    });
    const dir=path.resolve('assets/studies/human-adult-v1');fs.writeFileSync(path.join(dir,'anatomy.glb'),Buffer.from(result.data,'base64'));
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));manifest.prepared=result.report;fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    console.log(JSON.stringify(result.report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
