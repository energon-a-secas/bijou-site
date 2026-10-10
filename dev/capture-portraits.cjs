// Render portrait thumbnails from the real detailed model and saved recipes.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../assets/studies/portraits');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:8897/dev/model-studio.html');await page.waitForFunction(()=>window.ready,null,{timeout:60000});
    const ids=await page.evaluate(async()=>(await import('/js/model-portraits.js')).PORTRAIT_STARTS.map(p=>p.id));
    await page.addStyleTag({content:'main{display:block!important;height:400px!important;width:320px!important}aside{display:none!important}#viewport{width:320px!important;height:400px!important;min-height:0!important;position:relative!important}.stage-heading,.stage-hint,.camera-bar{display:none!important}'});
    await page.setViewportSize({width:320,height:400});
    for(const id of ids){await page.evaluate(id=>{modelStudio.portrait(id);modelStudio.setGaze({blink:false,x:0,y:0,follow:false,headFollow:false});modelStudio.stage.focusRegion('face');modelStudio.stage.setView('front');},id);await page.waitForTimeout(100);await page.screenshot({path:path.join(output,id+'.png')});}
    if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({portraits:ids,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
