import {FACE_CONTROLS,FACE_REGIONS} from '../js/model-face-details.js';
import {STYLE_CONTROLS,STYLE_DEFAULTS,LIGHT_CONTROLS,LIGHT_DEFAULTS} from '../js/model-style.js';

export function createDetailEditor({bindInput,change,begin,update,commit,cancel,stage,getState}){
  const $=id=>document.getElementById(id);
  function slider(parent,id,title,min,max,read,kind){
    const label=document.createElement('label');label.className='control';label.htmlFor=id;
    const line=document.createElement('span');line.className='control-line';line.textContent=title;
    const output=document.createElement('output');output.id=id+'-value';output.htmlFor=id;line.append(output);
    const input=document.createElement('input');Object.assign(input,{id,type:'range',min,max,step:.01});
    bindInput(input,()=>read(Number(input.value)),kind);label.append(line,input);parent.append(label);
  }
  function faceRegion(frame=true){
    const id=$('face-region').value,r=FACE_REGIONS.find(r=>r.id===id);
    document.querySelectorAll('[data-face-region]').forEach(node=>node.hidden=node.dataset.faceRegion!==id);$('face-region-hint').textContent=r.hint;
    if(frame&&$('face-close-up').checked)stage.focusRegion('face-'+id);
  }
  for(const region of FACE_REGIONS){
    const option=document.createElement('option');option.value=region.id;option.textContent=region.name;$('face-region').append(option);
    const section=document.createElement('div');section.dataset.faceRegion=region.id;
    for(const c of FACE_CONTROLS.filter(c=>c.region===region.id))slider(section,'detail-'+c.id,c.label,-1,1,value=>({details:{[c.id]:value}}),'appearance');
    $('face-controls').append(section);
  }
  $('face-region').addEventListener('change',()=>faceRegion());
  $('inspect-feature').addEventListener('click',()=>stage.focusRegion('face-'+$('face-region').value));
  $('reset-face-region').addEventListener('click',()=>change({details:Object.fromEntries(FACE_CONTROLS.filter(c=>c.region===$('face-region').value).map(c=>[c.id,0]))},'appearance'));
  for(const c of STYLE_CONTROLS)slider($('style-'+c.group+'-controls'),'style-'+c.id,c.label,c.min??0,c.max??1,value=>({[c.id]:value}),'style');
  for(const [id,key]of [['skin-color','skinColor'],['eye-color','eyeColor'],['blush-color','blushColor'],['lip-color','lipColor']])bindInput($(id),()=>({[key]:$(id).value,...(key==='eyeColor'?{eyeTint:1}:{})}),'style');
  document.querySelectorAll('[data-skin-color]').forEach(b=>b.addEventListener('click',()=>change({skinColor:b.dataset.skinColor,skinBlend:1},'style')));
  document.querySelectorAll('[data-eye-color]').forEach(b=>b.addEventListener('click',()=>change({eyeColor:b.dataset.eyeColor,eyeTint:1},'style')));
  $('reset-style').addEventListener('click',()=>change(STYLE_DEFAULTS,'style'));$('inspect-style').addEventListener('click',()=>stage.focusRegion('face'));
  function styleRegion(frame=true){
    const id=$('style-region').value;document.querySelectorAll('[data-style-group]').forEach(n=>n.hidden=n.dataset.styleGroup!==id);
    if(frame)stage.focusRegion(id==='eyes'?'face-eyes':id==='makeup'?'face-mouth':id==='hair'?'hair':'face');
  }
  $('style-region').addEventListener('change',()=>styleRegion());
  for(const c of LIGHT_CONTROLS)slider($('light-controls'),'light-'+c.id,c.label,c.min,c.max,value=>({[c.id]:value}),'lighting');
  $('light-stage').addEventListener('change',()=>change({stage:$('light-stage').value},'lighting'));
  $('reset-light').addEventListener('click',()=>change(LIGHT_DEFAULTS,'lighting'));
  $('light-soft').addEventListener('click',()=>change({azimuth:-.25,elevation:.55,fill:.7,rim:.4,exposure:1},'lighting'));
  $('light-side').addEventListener('click',()=>change({azimuth:.63,elevation:.42,fill:.22,rim:.65,exposure:1},'lighting'));
  const pad=$('lighting-pad');let pointer=null;
  const position=e=>{const b=pad.getBoundingClientRect();update({azimuth:(e.clientX-b.left)/b.width*2-1,elevation:1-(e.clientY-b.top)/b.height},'lighting');};
  pad.addEventListener('pointerdown',e=>{begin();pointer=e.pointerId;pad.setPointerCapture(pointer);position(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer)position(e);});
  for(const name of ['pointerup','lostpointercapture'])pad.addEventListener(name,()=>{if(pointer!==null){pointer=null;commit();}});
  pad.addEventListener('pointercancel',()=>{pointer=null;cancel();});
  pad.addEventListener('keydown',e=>{const d={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]}[e.key];if(d){e.preventDefault();const l=getState().lighting;change({azimuth:l.azimuth+d[0],elevation:l.elevation+d[1]},'lighting');}});
  faceRegion(false);styleRegion(false);
  return {sync(){
    const {appearance,style,lighting,hair,busy}=getState();
    for(const c of FACE_CONTROLS){$('detail-'+c.id).value=appearance.details[c.id];$('detail-'+c.id+'-value').value=Math.round(appearance.details[c.id]*100)+'%';}
    for(const c of STYLE_CONTROLS){$('style-'+c.id).value=style[c.id];$('style-'+c.id+'-value').value=Math.round(style[c.id]*100)+'%';$('style-'+c.id).disabled=style.render==='clay'||!!c.physical&&style.render!=='realistic'||c.group==='hair'&&hair.style!=='textured';}
    for(const [id,key]of [['skin-color','skinColor'],['eye-color','eyeColor'],['blush-color','blushColor'],['lip-color','lipColor']]){$(id).value=style[key];$(id).disabled=style.render==='clay';}
    document.querySelectorAll('[data-skin-color],[data-eye-color]').forEach(b=>b.disabled=style.render==='clay');
    $('surface').value=style.render;$('light-stage').value=lighting.stage;
    for(const c of LIGHT_CONTROLS){$('light-'+c.id).value=lighting[c.id];$('light-'+c.id+'-value').value=c.id==='exposure'?lighting[c.id].toFixed(2):Math.round(lighting[c.id]*100)+'%';$('light-'+c.id).disabled=busy;}
    for(const id of ['lighting-pad','light-stage','light-soft','light-side','reset-light'])$(id).disabled=busy;
    pad.style.setProperty('--light-x',`${(lighting.azimuth+1)*50}%`);pad.style.setProperty('--light-y',`${(1-lighting.elevation)*100}%`);
    pad.setAttribute('aria-label',`Key light position: horizontal ${Math.round(lighting.azimuth*100)}%, elevation ${Math.round(lighting.elevation*100)}%. Drag or use arrow keys.`);
  },faceRegion,styleRegion};
}
