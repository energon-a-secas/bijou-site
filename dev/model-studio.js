import { createModelStage, CANDIDATES } from './model-studio-stage.js';
import { MODEL_REGIONS, MODEL_CONTROLS, MODEL_DEFAULTS, MODEL_PRESETS, cleanModelShape } from '../js/model-shape.js';
import { ADULT_AGES, FACE_STYLES, APPEARANCE_DEFAULTS, cleanAppearance } from '../js/model-appearance.js';
import { MODEL_TOPS, MODEL_BOTTOMS, CLOTHES_DEFAULTS, OUTFIT_PRESETS, cleanClothes } from '../js/model-clothes.js';
import { HAIR_STYLES,HAIR_DEFAULTS,SOURCE_HAIR,cleanHair,GAZE_DEFAULTS,SOURCE_GAZE,cleanGaze,EXPRESSIONS } from '../js/model-persona.js';
import {STYLE_DEFAULTS,LIGHT_DEFAULTS,REALISM_STYLE,cleanModelStyle,cleanModelLight} from '../js/model-style.js';
import {createDetailEditor} from './model-studio-details.js';
import {PORTRAIT_STARTS,portraitLook,varyPortrait} from '../js/model-portraits.js';
const $=id=>document.getElementById(id),key=(id,v=4)=>`bijou:model-studio:v${v}:${id}`;
let candidate='sculpt',shape={...MODEL_DEFAULTS},appearance=cleanAppearance(),clothes={...CLOTHES_DEFAULTS},hair={...HAIR_DEFAULTS},gaze={...GAZE_DEFAULTS},style=cleanModelStyle(),lighting=cleanModelLight();
let past=[],future=[],before=null,busy=false,loaded=false,frame=0,panel='body';
const freshHime=()=>({shape:cleanModelShape(MODEL_PRESETS.find(p=>p.id==='figurine').values),appearance:APPEARANCE_DEFAULTS,hair:HAIR_DEFAULTS,gaze:GAZE_DEFAULTS,style:STYLE_DEFAULTS,lighting:LIGHT_DEFAULTS,clothes:cleanClothes({top:'tee',bottom:'jeans',topColor:'#923d5a',bottomColor:'#435b76',topFit:.14,bottomFit:.16})});
const freshHeroine=()=>({...freshHime(),appearance:cleanAppearance({face:'heroine'}),hair:cleanHair({...HAIR_DEFAULTS,style:'textured'})});
const stage=createModelStage(document.querySelector('canvas'),playing=>{$('walk').checked=playing;});
const announce=text=>{$('status').textContent=text;};
const snapshot=()=>({shape:{...shape},appearance:{...appearance,details:{...appearance.details}},clothes:{...clothes},hair:{...hair},gaze:{...gaze},style:{...style},lighting:{...lighting}});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function restore(value){shape=cleanModelShape(value?.shape);appearance=cleanAppearance(value?.appearance);clothes=cleanClothes(value?.clothes);hair=cleanHair(value?.hair||(value?SOURCE_HAIR:HAIR_DEFAULTS));gaze=cleanGaze(value?.gaze||(value?SOURCE_GAZE:GAZE_DEFAULTS));style=cleanModelStyle(value?.style);lighting=cleanModelLight(value?.lighting);}
function saved(id){
  try{const data=JSON.parse(localStorage.getItem(key(id))||localStorage.getItem(key(id,3))||localStorage.getItem(key(id,2))||localStorage.getItem(key(id,1)));return [1,2,3,4].includes(data?.version)&&data.candidate===id?data:null;}catch{return null;}
}
function persist(){
  try{localStorage.setItem(key(candidate),JSON.stringify(recipe()));announce('Look saved on this device.');}
  catch{announce('Browser storage is unavailable. Use Save look file to keep your edits.');}
}
function recipe(){return {version:4,candidate,...snapshot()};}
function sync(){
  const compare=$('compare').checked;
  for(const c of MODEL_CONTROLS){$(c.id).value=shape[c.id];$(`${c.id}-value`).value=c.id==='height'?`${Math.round(shape[c.id])} cm`:`${shape[c.id]>0?'+':''}${Math.round(shape[c.id]*100)}%`;}
  $('undo').disabled=busy||!past.length||compare;$('redo').disabled=busy||!future.length||compare;
  document.querySelectorAll('[data-preset]').forEach(button=>{const p=MODEL_PRESETS.find(p=>p.id===button.dataset.preset);button.setAttribute('aria-pressed',String(same(shape,cleanModelShape(p.values))));});
  document.querySelectorAll('[data-age]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.age)===appearance.age)));
  $('face-style').value=appearance.face;$('face-strength').value=appearance.strength;$('face-strength-value').value=Math.round(appearance.strength*100)+'%';
  const face=FACE_STYLES.find(f=>f.id===appearance.face);$('face-hint').textContent=candidate==='human'&&appearance.face==='oval'?'Balanced proportions with an oval silhouette.':face.hint;$('character-label').textContent=`${candidate==='heroine'?'GAME HEROINE':'HIME'} / ${face.name.toUpperCase()}`;
  for(const slot of ['top','bottom']){
    $(slot+'-style').value=clothes[slot];$(slot+'-color').value=clothes[slot+'Color'];$(slot+'-fit').value=clothes[slot+'Fit'];
    $(slot+'-fit-value').value=clothes[slot+'Fit']<.15?'Fitted':clothes[slot+'Fit']>.65?'Relaxed':'Close';
    $(slot+'-color').disabled=$(slot+'-fit').disabled=clothes[slot]==='source';
  }
  $('leg-length').value=clothes.legLength;$('leg-length-value').value=Math.round(clothes.legLength*100)+'%';$('leg-length').disabled=!['jeans','leggings'].includes(clothes.bottom);
  document.querySelectorAll('[data-outfit]').forEach(button=>button.setAttribute('aria-pressed',String(same(clothes,cleanClothes(OUTFIT_PRESETS.find(o=>o.id===button.dataset.outfit).values)))));
  $('expression').value=appearance.expression;
  $('hair-style').value=hair.style;$('hair-color').value=hair.color;
  for(const id of ['length','volume','shine','motion']){$('hair-'+id).value=hair[id];$('hair-'+id+'-value').value=Math.round(hair[id]*100)+'%';$('hair-'+id).disabled=['source','textured'].includes(hair.style);}
  $('hair-color').disabled=hair.style==='source';document.querySelectorAll('[data-hair-color]').forEach(button=>button.disabled=hair.style==='source'||busy||compare);
  $('hair-hint').textContent=['source','textured'].includes(hair.style)?'This hairstyle keeps its authored shape. Choose a sculpted hairstyle to adjust length, volume, sheen and sway.':'Layered bangs and tapered locks follow the head. Longer hair clears the torso and sways gently with movement.';
  $('animated-eyes').checked=gaze.mode==='animated';$('auto-blink').checked=gaze.blink;$('gaze-follow').checked=gaze.follow;$('head-follow').checked=gaze.headFollow;
  for(const id of ['x','y']){$('gaze-'+id).value=gaze[id];$('gaze-'+id+'-value').value=Math.round(gaze[id]*100)+'%';}
  for(const id of ['auto-blink','gaze-x','gaze-y','gaze-follow','head-follow','blink-preview'])$(id).disabled=gaze.mode!=='animated';
  document.querySelectorAll('[data-starter]').forEach(button=>button.disabled=busy||!loaded||compare);
  document.querySelectorAll('[data-portrait]').forEach(button=>{const look=portraitLook(button.dataset.portrait);button.setAttribute('aria-pressed',String(same(appearance,look.appearance)&&same(hair,look.hair)&&same(style,look.style)));});
  for(const id of ['editor','face-editor','hair-editor','style-editor','clothes-editor'])$(id).disabled=busy||!loaded||compare;
  for(const id of ['export-model','export-shape'])$(id).disabled=busy||!loaded||compare;
  details.sync();
}
function flush(){if(frame)cancelAnimationFrame(frame);frame=0;stage.setLook($('compare').checked?MODEL_DEFAULTS:shape,$('compare').checked?APPEARANCE_DEFAULTS:appearance,$('compare').checked?CLOTHES_DEFAULTS:clothes,$('compare').checked?SOURCE_HAIR:hair,$('compare').checked?SOURCE_GAZE:gaze);stage.setStyle($('compare').checked?{...STYLE_DEFAULTS,render:style.render,skinBlend:0,blush:0,lipTint:0,pores:0,detail:1,eyeliner:0}:style);stage.setLight(lighting);sync();}
function update(values,kind='shape'){
  if(kind==='shape')shape=cleanModelShape({...shape,...values});
  if(kind==='appearance')appearance=cleanAppearance({...appearance,...values,details:{...appearance.details,...values.details}});
  if(kind==='clothes')clothes=cleanClothes({...clothes,...values});
  if(kind==='hair')hair=cleanHair({...hair,...values});
  if(kind==='gaze')gaze=cleanGaze({...gaze,...values});
  if(kind==='style')style=cleanModelStyle({...style,...values});
  if(kind==='lighting')lighting=cleanModelLight({...lighting,...values});
  if(!frame)frame=requestAnimationFrame(flush);sync();
}
function begin(){if(!before)before=snapshot();}
function commit(){if(before&&!same(before,snapshot())){past.push(before);if(past.length>40)past.shift();future=[];persist();}before=null;sync();}
function change(values,kind='shape'){begin();update(values,kind);commit();}
function regionChanged(){
  const id=$('region').value,r=MODEL_REGIONS.find(r=>r.id===id);
  document.querySelectorAll('[data-region]').forEach(p=>{p.hidden=p.dataset.region!==id;});$('region-hint').textContent=r.hint;
  if(panel==='body')stage.focusRegion(id);
}
function selectPanel(value){
  commit();panel=value;
  document.querySelectorAll('[data-panel]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.panel===value));button.tabIndex=button.dataset.panel===value?0:-1;});
  for(const [id,name]of [['editor','body'],['face-editor','face'],['hair-editor','hair'],['style-editor','style'],['clothes-editor','clothes']])$(id).hidden=value!==name;
  stage.focusRegion(['face','hair'].includes(value)?value:value==='style'?'face':value==='clothes'?'figure':$('region').value);
  if(value==='face')details.faceRegion();if(value==='style')details.styleRegion();
}
function setBusy(value){
  busy=value;$('candidate').disabled=value;
  for(const id of ['import-shape','surface','walk','wire','skeleton','compare'])$(id).disabled=value||!loaded||(id==='walk'&&!stage.sculpt?.clips.length);sync();
}
async function selectCandidate(id){
  if(!Object.hasOwn(CANDIDATES,id))return;commit();flush();setBusy(true);loaded=false;candidate=id;$('candidate').value=id;$('compare').checked=false;
  restore(saved(id)||(id==='human'?{shape:MODEL_DEFAULTS,appearance:APPEARANCE_DEFAULTS,hair:{...HAIR_DEFAULTS,style:'textured'},gaze:GAZE_DEFAULTS,style:{...REALISM_STYLE,skinBlend:1,pores:.10,freckles:0,lipTint:.7},clothes:{...CLOTHES_DEFAULTS,top:'tee',bottom:'jeans',topColor:'#dad6db',bottomColor:'#435b76',topFit:.45,bottomFit:.32}}:id==='heroine'?freshHeroine():freshHime()));past=[];future=[];before=null;$('loading').hidden=false;$('loading').textContent='Preparing your model…';window.ready=false;
  try{
    stage.setStyle(style);stage.setLight(lighting);await stage.load(id,shape,appearance,clothes,hair,gaze);loaded=true;$('model-detail').textContent=id==='human'?'Internal anatomy study':id==='heroine'?'Earlier face · detailed body · rigged':`${id==='sculpt'?'Detailed':'Light'} body · anime face · rigged`;
    $('loading').hidden=true;$('skeleton').checked=false;regionChanged();selectPanel(panel);announce('Ready. Your look saves automatically on this device.');window.ready=true;
  }catch(error){$('loading').textContent='Could not load this model. Choose a model to retry.';announce('Model unavailable. Your saved look is safe.');console.error(error);}
  finally{setBusy(false);}
}
function bindInput(input,read,kind='shape'){
  input.addEventListener('pointerdown',begin);input.addEventListener('keydown',begin);
  input.addEventListener('input',()=>{begin();update(read(),kind);});input.addEventListener('change',commit);input.addEventListener('blur',commit);
  input.addEventListener('pointercancel',()=>{if(before){restore(before);before=null;flush();}});
}
const details=createDetailEditor({bindInput,change,begin,update,commit,cancel:()=>{if(before){restore(before);before=null;flush();}},stage,getState:()=>({appearance,style,lighting,hair,busy:busy||!loaded})});
for(const p of MODEL_PRESETS){
  const button=document.createElement('button');button.dataset.preset=p.id;button.type='button';button.textContent=p.name;
  const small=document.createElement('small');small.textContent=p.description;button.append(small);button.addEventListener('click',()=>change(cleanModelShape(p.values)));$('presets').append(button);
}
for(const r of MODEL_REGIONS){
  const option=document.createElement('option');option.value=r.id;option.textContent=r.name;$('region').append(option);
  const section=document.createElement('div');section.dataset.region=r.id;
  for(const c of MODEL_CONTROLS.filter(c=>c.region===r.id)){
    const label=document.createElement('label');label.className='control';label.htmlFor=c.id;
    const line=document.createElement('span');line.className='control-line';line.append(document.createTextNode(c.label));
    const output=document.createElement('output');output.id=`${c.id}-value`;output.htmlFor=c.id;line.append(output);
    const input=document.createElement('input');Object.assign(input,{id:c.id,type:'range',min:c.min,max:c.max,step:c.id==='height'?1:.01,value:c.value});
    bindInput(input,()=>({[c.id]:Number(input.value)}));label.append(line,input);section.append(label);
  }$('controls').append(section);
}
for(const age of ADULT_AGES){const button=document.createElement('button');button.textContent=age.label;button.dataset.age=age.id;button.addEventListener('click',()=>change({age:age.id},'appearance'));$('ages').append(button);}
for(const face of FACE_STYLES){const option=document.createElement('option');option.value=face.id;option.textContent=face.name;$('face-style').append(option);}
$('face-style').addEventListener('change',event=>change({face:event.target.value},'appearance'));
bindInput($('face-strength'),()=>({strength:Number($('face-strength').value)}),'appearance');
$('reset-face').addEventListener('click',()=>change(APPEARANCE_DEFAULTS,'appearance'));$('inspect-face').addEventListener('click',()=>stage.focusRegion('face'));
for(const [slot,choices]of [['top',MODEL_TOPS],['bottom',MODEL_BOTTOMS]]){
  for(const choice of choices){const option=document.createElement('option');option.value=choice.id;option.textContent=choice.name;$(slot+'-style').append(option);}
  $(slot+'-style').addEventListener('change',event=>change({[slot]:event.target.value},'clothes'));
  bindInput($(slot+'-color'),()=>({[slot+'Color']:$(slot+'-color').value}),'clothes');
  bindInput($(slot+'-fit'),()=>({[slot+'Fit']:Number($(slot+'-fit').value)}),'clothes');
}
bindInput($('leg-length'),()=>({legLength:Number($('leg-length').value)}),'clothes');
for(const outfit of OUTFIT_PRESETS){const button=document.createElement('button');button.textContent=outfit.name;button.dataset.outfit=outfit.id;button.addEventListener('click',()=>change(cleanClothes(outfit.values),'clothes'));$('outfit-presets').append(button);}
$('reset-clothes').addEventListener('click',()=>change(CLOTHES_DEFAULTS,'clothes'));
for(const expression of EXPRESSIONS){const option=document.createElement('option');option.value=expression.id;option.textContent=expression.name;$('expression').append(option);}
$('expression').addEventListener('change',()=>change({expression:$('expression').value},'appearance'));
for(const style of HAIR_STYLES){const option=document.createElement('option');option.value=style.id;option.textContent=style.name;$('hair-style').append(option);}
$('hair-style').addEventListener('change',()=>change({style:$('hair-style').value},'hair'));
bindInput($('hair-color'),()=>({color:$('hair-color').value}),'hair');
for(const [id,title]of [['length','Length'],['volume','Volume'],['shine','Sheen'],['motion','Sway']]){
  const label=document.createElement('label');label.className='control';label.htmlFor='hair-'+id;
  const span=document.createElement('span');span.className='control-line';span.textContent=title;
  const output=document.createElement('output');output.id='hair-'+id+'-value';output.htmlFor='hair-'+id;span.append(output);
  const input=document.createElement('input');Object.assign(input,{id:'hair-'+id,type:'range',min:0,max:1,step:.01});
  bindInput(input,()=>({[id]:Number(input.value)}),'hair');label.append(span,input);$('hair-sliders').append(label);
}
document.querySelectorAll('[data-hair-color]').forEach(button=>button.addEventListener('click',()=>change({color:button.dataset.hairColor},'hair')));
$('reset-hair').addEventListener('click',()=>change(HAIR_DEFAULTS,'hair'));$('inspect-hair').addEventListener('click',()=>stage.focusRegion('hair'));
$('animated-eyes').addEventListener('change',()=>change({mode:$('animated-eyes').checked?'animated':'source'},'gaze'));
for(const [id,key]of [['auto-blink','blink'],['gaze-follow','follow'],['head-follow','headFollow']])$(id).addEventListener('change',()=>change({[key]:$(id).checked},'gaze'));
for(const id of ['x','y'])bindInput($('gaze-'+id),()=>({[id]:Number($('gaze-'+id).value)}),'gaze');
$('reset-gaze').addEventListener('click',()=>change({x:0,y:0,follow:false,headFollow:false},'gaze'));$('blink-preview').addEventListener('click',()=>stage.gaze.blink());
function starter(id){
  begin();appearance=cleanAppearance({face:id==='fantasy'?'fantasy':id==='figurine'?'figurine':id==='heroine'?'heroine':'oval',expression:id==='figurine'?'smile':'neutral',details:id==='fantasy'?{chinWidth:.12,chinLength:-.12,noseTip:.15,upperLip:.3,lowerLip:.3,cheekFullness:.1}:undefined});
  hair=cleanHair({...HAIR_DEFAULTS,style:id==='hime'||id==='fantasy'?'hime':'swept',color:id==='figurine'?'#d36599':id==='fantasy'?'#302c3b':'#39303e'});gaze=cleanGaze(GAZE_DEFAULTS);
  style=cleanModelStyle(id==='fantasy'?REALISM_STYLE:STYLE_DEFAULTS);lighting=cleanModelLight(id==='fantasy'?{...LIGHT_DEFAULTS,stage:'midnight',azimuth:-.27,fill:.5,rim:.65}:LIGHT_DEFAULTS);
  if(id==='figurine'){shape=cleanModelShape(MODEL_PRESETS.find(p=>p.id==='figurine').values);clothes=cleanClothes({top:'longsleeve',bottom:'shorts',topColor:'#bc3c58',bottomColor:'#e8e0dc',topFit:.18,bottomFit:.12});}
  if(id==='fantasy'){const look=portraitLook('nightbloom');appearance=look.appearance;hair=look.hair;style=look.style;}
  commit();flush();if(id==='fantasy'){$('face-region').value='proportions';selectPanel('face');}stage.setView(id==='fantasy'?'front':'three');stage.focusRegion(id==='fantasy'?'face':'figure');
}
document.querySelectorAll('[data-starter]').forEach(button=>button.addEventListener('click',()=>starter(button.dataset.starter)));
function applyPortrait(look){begin();appearance=look.appearance;hair=look.hair;style=look.style;lighting=cleanModelLight({...lighting,stage:'midnight'});commit();flush();$('face-region').value='proportions';selectPanel('face');stage.setView('front');stage.focusRegion('face');}
for(const p of PORTRAIT_STARTS){const button=document.createElement('button'),img=document.createElement('img');img.src=`../assets/studies/portraits/${p.id}.png`;img.alt='';img.loading='lazy';img.width=320;img.height=400;button.append(img,document.createTextNode(p.name));button.dataset.portrait=p.id;button.addEventListener('click',()=>applyPortrait(portraitLook(p.id)));$('portrait-starts').append(button);}
$('vary-portrait').addEventListener('click',()=>{const seed=crypto.getRandomValues(new Uint32Array(1))[0];applyPortrait(varyPortrait(seed,appearance.age));announce('A new portrait variation is saved. Undo restores the previous look.');});
const tabs=[...document.querySelectorAll('[data-panel]')];
for(const [i,button]of tabs.entries()){
  button.addEventListener('click',()=>selectPanel(button.dataset.panel));
  button.addEventListener('keydown',event=>{const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next!==null){event.preventDefault();tabs[next].focus();selectPanel(tabs[next].dataset.panel);}});
}
$('candidate').addEventListener('change',event=>selectCandidate(event.target.value));$('region').addEventListener('change',()=>{commit();regionChanged();});
$('reset').addEventListener('click',()=>change(MODEL_DEFAULTS));
$('region-reset').addEventListener('click',()=>change(Object.fromEntries(MODEL_CONTROLS.filter(c=>c.region===$('region').value).map(c=>[c.id,c.value]))));
$('undo').addEventListener('click',()=>{commit();if(!past.length)return;future.push(snapshot());restore(past.pop());flush();persist();});
$('redo').addEventListener('click',()=>{if(!future.length)return;past.push(snapshot());restore(future.pop());flush();persist();});
$('compare').addEventListener('change',()=>{commit();flush();announce($('compare').checked?'Showing the original model. Your look is kept.':'Showing your edited look.');});
$('surface').addEventListener('change',event=>change({render:event.target.value},'style'));
$('walk').addEventListener('change',event=>{const play=event.target.checked;flush();if(play)stage.setMotion(true);});
$('wire').addEventListener('change',event=>stage.setWire(event.target.checked));$('skeleton').addEventListener('change',event=>stage.setSkeleton(event.target.checked));
$('full-figure').addEventListener('click',()=>stage.focusRegion('figure'));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{stage.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-shape').addEventListener('click',()=>{commit();download(JSON.stringify(recipe(),null,2),`bijou-${candidate}-look.json`,'application/json');announce('Look file downloaded with body, face, hair, skin, eyes, clothes and lighting.');});
$('export-model').addEventListener('click',async()=>{
  commit();flush();setBusy(true);announce('Preparing the edited model…');
  try{const data=await stage.exportGLB();download(data,`bijou-${candidate}-edited.glb`,'model/gltf-binary');announce('Edited model downloaded with clothes, textures and skeleton'+(stage.sculpt.clips.length?' and walking clip.':'.'));}
  catch(error){announce('Export failed. Your look is still saved.');console.error(error);}finally{setBusy(false);}
});
$('import-shape').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>30000)throw Error('This look file is too large.');const data=JSON.parse(await file.text());
    if(![1,2,3,4].includes(data.version)||!Object.hasOwn(CANDIDATES,data.candidate)||!data.shape||typeof data.shape!=='object')throw Error('Choose a Bijou model studio look or shape file.');
    if(data.candidate!==candidate)throw Error(`Choose ${CANDIDATES[data.candidate].name} before loading this look.`);
    if(MODEL_CONTROLS.some(c=>!['build','upperArmLength','forearmLength'].includes(c.id)&&(typeof data.shape[c.id]!=='number'||!Number.isFinite(data.shape[c.id]))))throw Error('This file has missing or invalid shape values.');
    $('compare').checked=false;begin();restore(data);commit();flush();announce('Look loaded and saved on this device.');
  }catch(error){announce(error.message);}finally{event.target.value='';}
});
window.modelStudio={stage,selectCandidate,selectPanel,change:values=>{change(values);flush();},setAppearance:values=>{change(values,'appearance');flush();},setClothes:values=>{change(values,'clothes');flush();},setHair:values=>{change(values,'hair');flush();},setGaze:values=>{change(values,'gaze');flush();},setStyle:values=>{change(values,'style');flush();},setLight:values=>{change(values,'lighting');flush();},portrait:id=>applyPortrait(portraitLook(id)),vary:seed=>applyPortrait(varyPortrait(seed,appearance.age)),starter,recipe,flush,get style(){return {...style};},get lighting(){return {...lighting};},get hair(){return {...hair};},get gaze(){return {...gaze};},get shape(){return {...shape};},get appearance(){return {...appearance,details:{...appearance.details}};},get clothes(){return {...clothes};}};
regionChanged();sync();const requested=new URLSearchParams(location.search).get('model');selectCandidate(Object.hasOwn(CANDIDATES,requested)&&!CANDIDATES[requested].internal?requested:'sculpt');
