// Body controls and transactional sculpt gestures share one validated state path.
import { BODY_REGIONS, BODY_PRESETS, BELLY_KEYS, BUST_KEYS, FULLNESS_REGIONS, NAIL_SHAPES, NAIL_COLORS, SHAPE_KEYS, SHAPE_DEFAULTS, matchingBody, clamp01 } from './body-shape.js';
import { cleanBody, save } from './state.js';
import { $ } from './utils.js';
import { ARCHETYPES } from './archetypes.js';
import { RENDER_QUALITIES } from './render-quality.js';

const editable=['height',...SHAPE_KEYS,'bounce','damping','nailLength','nailShape','nailColor','archetype'];
const snapshot=body=>Object.fromEntries(editable.map(k=>[k,body[k]]));
const same=(a,b)=>editable.every(k=>a[k]===b[k]);
const range=(key,label,low,high)=>`<div class="body-range"><label for="body-${key}">${label}<output id="value-${key}"></output></label><input class="range" id="body-${key}" data-body-range="${key}" type="range" min="0" max="100" step="1"><div class="range-labels" aria-hidden="true"><span>${low}</span><span>${high}</span></div></div>`;

export function createBodyEditor({state,doll,motion,behavior,onChanged=()=>{}}){
  const box=$('bodyControls'),stage=$('stage'),past=[],future=[],pointers=new Map();
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let region='waist',view='front',editing=false,before=null,gesture=null,pending=0,tool='sculpt',orbitGesture=null;
  box.innerHTML=`
    <div class="body-heading"><div><h2 class="panel__title">Body studio</h2><p id="bodyPresetName" class="panel__hint"></p></div><button class="btn btn--secondary btn--sm" type="button" data-body-action="edit" aria-pressed="false">Shape on canvas</button></div>
    <fieldset class="control-row"><legend class="field__label">Archetype quick start</legend><div class="archetypes">${ARCHETYPES.map(a=>`<button class="archetype" type="button" data-archetype="${a.id}" aria-pressed="false"><strong>${a.name}</strong><span>${a.detail}</span></button>`).join('')}</div><p class="panel__hint">Sets proportions and mannerisms. Refine any detail below.</p></fieldset>
    <fieldset class="control-row"><legend class="field__label">Starting shape</legend><div class="chips">${BODY_PRESETS.map(p=>`<button class="chip" type="button" data-body-preset="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}</div></fieldset>
    <fieldset class="control-row"><legend class="field__label">Region</legend><div class="body-regions">${BODY_REGIONS.map(r=>`<button class="chip" type="button" data-body-region="${r.id}" aria-pressed="false">${r.name}</button>`).join('')}</div></fieldset>
    <div class="body-region-heading"><h3 id="bodyRegionName">Waist</h3><button class="btn btn--ghost btn--sm" type="button" data-body-action="reset-region">Reset region</button></div>
    ${range('width','Width','Narrower','Fuller')}${range('depth','Depth','Flatter','Rounder')}
    <div id="bellyDetails" hidden>${range('bellyUpper','Upper belly','Flatter','Fuller')}${range('bellyLower','Lower belly','Flatter','Fuller')}${range('bellyHeight','Fullness position','Lower','Higher')}</div>
    <div id="bustDetails" hidden>${range('bustVolume','Cup volume','Smaller','Fuller')}${range('bustSpacing','Spacing','Closer','Wider')}${range('bustLift','Placement','Lower','Higher')}</div>
    <div id="fullnessDetails" hidden>${range('fullness','Extra fullness','Standard range','Extended range')}</div>
    <p class="panel__hint" id="bodyDepthHint">Use Profile view to see depth changes.</p>
    <div class="body-history"><button class="chip" type="button" data-body-action="undo" disabled>↶ Undo</button><button class="chip" type="button" data-body-action="redo" disabled>↷ Redo</button><button class="chip" type="button" data-body-action="reset">Reset shape</button></div>
    <details class="body-details"><summary>Overall proportions</summary><div>${range('height','Height','Petite','Tall')}${range('build','Build','Light','Full')}</div></details>
    <details class="body-details"><summary>Nails</summary><div><div class="chips">${NAIL_SHAPES.map(s=>`<button class="chip" type="button" data-nail-shape="${s.id}" aria-pressed="false">${s.name}</button>`).join('')}</div>${range('nailLength','Length','Short','Long')}<div class="swatches">${NAIL_COLORS.map(c=>`<button class="swatch" type="button" style="--sw:${c.color}" data-nail-color="${c.id}" aria-pressed="false" aria-label="${c.name} nails"></button>`).join('')}</div><button class="chip" type="button" data-body-action="inspect-hands">Inspect hands</button></div></details>
    <details class="body-details" open><summary>Soft motion</summary><div>${range('bounce','Bounce','Off','Lively')}${range('damping','Damping','Springy','Gentle')}<div class="body-motion-bottom"><p class="panel__hint" id="bodyMotionHint">Motion pauses while shaping.</p><button class="chip" type="button" data-body-action="bounce">Test bounce</button></div></div></details>
    <details class="body-details"><summary>Rendering detail</summary><div class="chips">${RENDER_QUALITIES.map(q=>`<button class="chip" type="button" data-quality="${q.id}" aria-pressed="false">${q.name}</button>`).join('')}</div><p class="panel__hint">Adjusts resolution and shadows. Body proportions stay the same.</p></details>
    <p class="sr-only" id="bodyStatus" role="status"></p>`;
  const overlay=document.createElement('div');overlay.className='shape-overlay';overlay.hidden=true;
  overlay.innerHTML=`<div class="shape-viewbar" role="group" aria-label="Character view">${[['front','Front'],['profile','Profile'],['back','Back']].map(([id,name])=>`<button class="chip" type="button" data-shape-view="${id}" aria-pressed="${id==='front'}">${name}</button>`).join('')}<button class="chip" type="button" data-shape-done>Done</button></div>
    <div class="shape-tools" role="group" aria-label="Canvas tool"><button type="button" class="chip" data-shape-tool="sculpt" aria-pressed="true">Sculpt</button><button type="button" class="chip" data-shape-tool="rotate" aria-pressed="false">Rotate view</button><button type="button" class="chip" data-shape-zoom="in" aria-label="Zoom in">＋</button><button type="button" class="chip" data-shape-zoom="out" aria-label="Zoom out">−</button></div><div class="shape-guides">${BODY_REGIONS.map(r=>`<button class="shape-dot" type="button" data-shape-region="${r.id}" aria-label="Shape ${r.name.toLowerCase()}: drag horizontally or use arrow keys" aria-pressed="false"><span>${r.name}</span></button>`).join('')}</div>
    <label class="shape-focus">Inspect <select aria-label="Inspection framing" id="shapeFocus"><option value="figure">Full figure</option><option value="region">Selected region</option><option value="hands">Hands</option><option value="face">Face</option></select></label><p class="shape-instruction"><strong id="shapeSelection">Waist · width</strong><span>Drag to reshape · pinch to expand or narrow</span></p>`;
  stage.append(overlay);
  const field=key=>key==='width'?region:key==='depth'?`${region}Depth`:key==='fullness'?`${region}Fullness`:key;
  const announce=message=>{$('bodyStatus').textContent=message;};
  function sync(){
    const selected=matchingBody(state.body),name=BODY_REGIONS.find(r=>r.id===region).name;
    $('bodyPresetName').textContent=BODY_PRESETS.find(p=>p.id===selected)?.name||'Custom shape';
    $('bodyRegionName').textContent=name;
    $('bellyDetails').hidden=region!=='belly';
    $('bustDetails').hidden=region!=='bust';$('fullnessDetails').hidden=!FULLNESS_REGIONS.includes(region);
    for(const input of box.querySelectorAll('[data-body-range]')){
      const key=input.dataset.bodyRange,value=Math.round((state.body[field(key)]??0)*100);
      input.value=value;input.setAttribute('aria-valuetext',`${value}%`);$(`value-${key}`).value=`${value}%`;
      if(key==='depth'||key==='fullness'||BELLY_KEYS.includes(key)||BUST_KEYS.includes(key)||region==='bust'&&key==='width')input.disabled=!doll.is3D;
    }
    box.querySelectorAll('[data-body-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bodyPreset===selected)));
    box.querySelectorAll('[data-archetype]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.archetype===state.body.archetype)));
    box.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===state.renderQuality)));
    box.querySelectorAll('[data-body-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bodyRegion===region)));
    box.querySelectorAll('[data-nail-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nailShape===state.body.nailShape)));
    box.querySelectorAll('[data-nail-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nailColor===state.body.nailColor)));
    overlay.querySelectorAll('[data-shape-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shapeRegion===region)));
    overlay.querySelectorAll('[data-shape-view]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.shapeView===view));b.disabled=!doll.is3D&&b.dataset.shapeView!=='front';});
    box.querySelector('[data-body-action="undo"]').disabled=!past.length;
    box.querySelector('[data-body-action="redo"]').disabled=!future.length;
    const edit=box.querySelector('[data-body-action="edit"]');edit.textContent=editing?'Done shaping':'Shape on canvas';edit.setAttribute('aria-pressed',String(editing));
    box.querySelector('[data-body-action="bounce"]').disabled=media.matches||state.body.bounce===0;
    $('bodyMotionHint').textContent=media.matches?'Bounce is off with your reduced-motion setting.':'Motion pauses while shaping.';
    $('bodyDepthHint').textContent=doll.is3D?'Use Profile view to see depth changes.':'Depth and rotating views are available in 3D. Width controls work in 2D.';
    overlay.querySelector('#shapeSelection').textContent=tool==='rotate'?`${name} · rotate view`:`${name} · ${view==='profile'?'depth':'width'}`;
    overlay.querySelector('.shape-instruction span').textContent=tool==='rotate'?'Drag to orbit · pinch or scroll to zoom · arrow keys to rotate':'Drag to reshape · pinch to expand or narrow';
    overlay.querySelectorAll('[data-shape-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shapeTool===tool)));
    stage.classList.toggle('is-orbiting',editing&&tool==='rotate');
  }
  function place(){
    if(!editing)return;
    const rect=stage.getBoundingClientRect();
    for(const p of doll.shapePoints()){
      const dot=overlay.querySelector(`[data-shape-region="${p.id}"]`);
      dot.hidden=tool==='rotate'||p.x<rect.left+20||p.x>rect.right-20||p.y<rect.top+90||p.y>rect.bottom-85;
      dot.style.transform=`translate(${p.x-rect.left}px,${p.y-rect.top}px) translate(-50%,-50%)`;
    }
  }
  function flush(){pending=0;doll.updateBody(state.body);motion.retarget();place();onChanged();}
  function apply(values){state.body=cleanBody({...state.body,...values});if(!pending)pending=requestAnimationFrame(flush);sync();}
  function begin(){if(!before)before=snapshot(state.body);}
  function commit(){
    if(before&&!same(before,state.body)){past.push(before);if(past.length>40)past.shift();future.length=0;save(state);announce('Body shape saved.');}
    before=null;sync();
  }
  function cancel(){if(before)apply(before);before=null;gesture=null;for(const id of pointers.keys())if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);pointers.clear();sync();}
  function setEditing(on){
    if(!on){if(gesture)cancel();orbitGesture=null;const ids=[...pointers.keys()];pointers.clear();for(const id of ids)if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);}editing=on;overlay.hidden=!on;stage.classList.toggle('is-shaping',on);
    doll.setEditing(on);behavior.setEditing(on);motion.setPointer(null);
    if(!on){overlay.querySelector('#shapeFocus').value='figure';view='front';orbitGesture=null;}
    if(on){if(state.ui.tab!=='body')$('tab-body').click();place();if(matchMedia('(max-width: 820px)').matches)stage.scrollIntoView({block:'start',behavior:media.matches?'auto':'smooth'});}sync();
  }
  function history(direction){
    const source=direction==='undo'?past:future,dest=direction==='undo'?future:past;if(!source.length)return;
    before=null;dest.push(snapshot(state.body));apply(source.pop());save(state);announce(direction==='undo'?'Shape change undone.':'Shape change restored.');
  }
  function choose(id,focus=true){if(BODY_REGIONS.some(r=>r.id===id)){region=id;doll.inspectionRegion=id;if(focus){if(!editing)setEditing(true);doll.inspection='region';overlay.querySelector('#shapeFocus').value='region';}sync();}}
  box.addEventListener('click',e=>{
    const preset=e.target.closest('[data-body-preset]')?.dataset.bodyPreset;
    const selected=e.target.closest('[data-body-region]')?.dataset.bodyRegion;
    const action=e.target.closest('[data-body-action]')?.dataset.bodyAction;
    const archetype=e.target.closest('[data-archetype]')?.dataset.archetype;
    const quality=e.target.closest('[data-quality]')?.dataset.quality;
    if(quality){state.renderQuality=quality;doll.setQuality(quality);save(state);sync();}
    if(archetype){const a=ARCHETYPES.find(a=>a.id===archetype);begin();apply({...a.body,archetype});commit();if(!editing)behavior.choosePose(a.pose);}
    const nailShape=e.target.closest('[data-nail-shape]')?.dataset.nailShape,nailColor=e.target.closest('[data-nail-color]')?.dataset.nailColor;
    if(nailShape||nailColor){begin();apply(nailShape?{nailShape}:{nailColor});commit();}
    if(preset){begin();apply(BODY_PRESETS.find(p=>p.id===preset).values);commit();}
    if(selected)choose(selected);
    if(action==='edit')setEditing(!editing);
    if(action==='inspect-hands'){setEditing(true);doll.inspection='hands';overlay.querySelector('#shapeFocus').value='hands';}
    if(action==='undo'||action==='redo')history(action);
    if(action==='reset-region'){begin();apply({[region]:.5,[`${region}Depth`]:.5,[`${region}Fullness`]:0,...Object.fromEntries((region==='belly'?BELLY_KEYS:region==='bust'?BUST_KEYS:[]).map(k=>[k,.5]))});commit();}
    if(action==='reset'){begin();apply({...SHAPE_DEFAULTS,height:.5});commit();}
    if(action==='bounce'){if(editing)setEditing(false);doll.impulse(1.3);}
  });
  box.addEventListener('pointerdown',e=>{if(e.target.matches('[data-body-range]'))begin();});
  box.addEventListener('keydown',e=>{if(e.target.matches('[data-body-range]'))begin();});
  box.addEventListener('input',e=>{const key=e.target.dataset.bodyRange;if(key){begin();apply({[field(key)]:Number(e.target.value)/100});}});
  box.addEventListener('change',e=>{if(e.target.dataset.bodyRange)commit();});
  overlay.addEventListener('click',e=>{
    const selected=e.target.closest('[data-shape-region]')?.dataset.shapeRegion;if(selected)choose(selected);
    const angle=e.target.closest('[data-shape-view]')?.dataset.shapeView;
    if(angle){view=angle;doll.shapeView=view;sync();place();}
    const canvasTool=e.target.closest('[data-shape-tool]')?.dataset.shapeTool;if(canvasTool){tool=canvasTool;if(tool==='sculpt'&&view==='custom'){view='front';doll.shapeView=view;}sync();}
    const zoom=e.target.closest('[data-shape-zoom]')?.dataset.shapeZoom;if(zoom)doll.zoomBy(zoom==='in'?.2:-.2);
    if(e.target.closest('[data-shape-done]')){setEditing(false);box.querySelector('[data-body-action="edit"]').focus();}
  });
  overlay.querySelector('#shapeFocus').addEventListener('change',e=>{doll.inspection=e.target.value;});
  stage.addEventListener('pointerdown',e=>{
    if(!editing||e.button>0)return;
    let selected=e.target.closest('[data-shape-region]')?.dataset.shapeRegion;
    if(!selected&&e.target.closest('button,a,input,select,textarea,label'))return;
    if(tool==='rotate'&&!selected){e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture(e.pointerId);orbitGesture={x:e.clientX,y:e.clientY,distance:null};return;}
    if(!gesture&&!selected){
      const hit=doll.is3D?doll.hitTest(e.clientX,e.clientY):e.target.closest('[data-b]');
      if(!hit||hit==='head')return;
      selected=doll.shapePoints().sort((a,b)=>Math.hypot(a.x-e.clientX,a.y-e.clientY)-Math.hypot(b.x-e.clientX,b.y-e.clientY))[0]?.id;
    }
    if(!gesture){choose(selected||region,false);begin();gesture={x:e.clientX,value:state.body[view==='profile'||e.shiftKey?`${region}Depth`:region],key:view==='profile'||e.shiftKey?`${region}Depth`:region,scale:Math.max(100,stage.clientHeight*.23)};}
    e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture(e.pointerId);
    if(pointers.size===2){const[a,b]=[...pointers.values()];gesture.distance=Math.max(12,Math.hypot(a.x-b.x,a.y-b.y));gesture.value=state.body[gesture.key];gesture.pinch=true;}
  });
  stage.addEventListener('pointermove',e=>{
    if(orbitGesture&&pointers.has(e.pointerId)){
      if(view!=='custom'){view='custom';sync();}
      e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const[a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(orbitGesture.distance)doll.zoomBy(Math.log(Math.max(8,distance)/Math.max(8,orbitGesture.distance)));orbitGesture.distance=distance;}
      else doll.orbitBy(-(e.clientX-orbitGesture.x)*.007,(e.clientY-orbitGesture.y)*.006);
      orbitGesture.x=e.clientX;orbitGesture.y=e.clientY;return;
    }
    if(!gesture||!pointers.has(e.pointerId)||gesture.released)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});e.preventDefault();let delta;
    if(gesture.pinch&&pointers.size===2){const[a,b]=[...pointers.values()];delta=Math.log(Math.max(8,Math.hypot(a.x-b.x,a.y-b.y))/gesture.distance)/1.4;}
    else delta=(e.clientX-gesture.x)/gesture.scale;
    apply({[gesture.key]:clamp01(gesture.value+delta)});
  });
  function release(e){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
    if(orbitGesture){if(!pointers.size)orbitGesture=null;else{const p=[...pointers.values()][0];orbitGesture={...p,distance:null};}return;}
    if(gesture?.pinch)gesture.released=true;
    if(!pointers.size){gesture=null;commit();}
  }
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',()=>{if(gesture)cancel();orbitGesture=null;pointers.clear();});
  stage.addEventListener('wheel',e=>{if(editing&&tool==='rotate'){e.preventDefault();doll.zoomBy(-e.deltaY*.0015);}},{passive:false});
  stage.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId)){if(gesture)cancel();else{pointers.delete(e.pointerId);orbitGesture=null;}}});
  function keydown(e){
    if(editing&&tool==='rotate'&&e.target.closest('[data-shape-tool="rotate"]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='-')doll.zoomBy(e.key==='+'?.15:-.15);else{view='custom';doll.orbitBy(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0);sync();}return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');}
    if(e.key==='Escape'&&editing){e.preventDefault();if(gesture)cancel();else setEditing(false);}
    const id=e.target.closest('[data-shape-region]')?.dataset.shapeRegion;
    if(id&&['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();choose(id);begin();const key=view==='profile'?`${region}Depth`:region;
      apply({[key]:clamp01(state.body[key]+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.05:.01))});commit();
    }
  }
  stage.addEventListener('keydown',keydown);box.addEventListener('keydown',keydown);
  doll.onShapeFrame=place;media.addEventListener('change',sync);doll.ready.then(sync);sync();
  return {sync,setEditing,get editing(){return editing;}};
}
