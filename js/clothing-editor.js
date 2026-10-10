// Tailoring changes resolve the same immutable templates used by the renderer.
import { CATALOG, itemById } from './catalog.js';
import { CUTS, FABRICS, NECKLINES, FIT_REGIONS, cleanGarment, templateDefaults, fitRegions } from './garment-templates.js';
import { save } from './state.js';
import { $ } from './utils.js';

const range=(key,label,low,high)=>`<div class="body-range" data-tailor-row="${key}"><label for="tailor-${key}">${label}<output id="tailor-value-${key}"></output></label><input id="tailor-${key}" class="range" type="range" min="0" max="100" step="1" data-tailor-range="${key}"><div class="range-labels" aria-hidden="true"><span>${low}</span><span>${high}</span></div></div>`;
export function createClothingEditor({state,onEquip,onChanged}){
  const box=$('clothingControls'),templates=CATALOG.filter(it=>it.template);
  let selected=Object.values(state.outfit).find(id=>itemById(id)?.template)||'studio-crop',pending=0;
  const cuts=[...new Map(Object.values(CUTS).flat().map(c=>[c[0],c])).values()];
  box.innerHTML=`<details class="tailor"><summary>Clothing studio <span>Cut, fabric & fit</span></summary><div class="tailor-content">
    <label class="field__label" for="garmentPattern">Pattern</label><div class="tailor-pattern"><select class="input" id="garmentPattern">${templates.map(it=>`<option value="${it.id}">${it.name}</option>`).join('')}</select><button class="btn btn--secondary btn--sm" type="button" data-tailor-wear>Wear</button></div>
    <p class="panel__hint" id="tailorStatus" role="status"></p>
    <div class="tailor-colors"><label>Fabric color<input type="color" data-tailor-color="color" aria-label="Fabric color"></label><label>Trim color<input type="color" data-tailor-color="trim" aria-label="Trim color"></label></div>
    <div class="tailor-selects"><label for="tailor-fabric">Fabric<select class="input" id="tailor-fabric" data-tailor-choice="fabric">${FABRICS.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}</select></label><label for="tailor-neckline" id="tailorNeckline">Neckline<select class="input" id="tailor-neckline" data-tailor-choice="neckline">${NECKLINES.map(n=>`<option value="${n.id}">${n.name}</option>`).join('')}</select></label></div>
    <details class="body-details" open><summary>Cut</summary><div>${cuts.map(c=>range(...c)).join('')}</div></details>
    <fieldset class="control-row"><legend class="field__label">Fit quick start</legend><div class="chips">${['fitted','relaxed','oversized'].map(id=>`<button class="chip" type="button" data-tailor-fit="${id}">${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}</div></fieldset>
    ${range('ease','Overall room','Fitted','Oversized')}${range('stretch','Fabric stretch','Structured','Stretchy')}
    <details class="body-details"><summary>Regional fit</summary><div>${FIT_REGIONS.map(r=>range(r.id,r.name,'Follow body','Extra room')).join('')}</div><p class="panel__hint">Adds room around the shape you made in Body.</p></details>
    <button class="btn btn--ghost btn--sm" type="button" data-tailor-reset>Reset this pattern</button>
  </div></details>`;
  function sync(prefer){
    if(itemById(prefer)?.template){selected=prefer;box.querySelector('.tailor').open=true;}
    const item=itemById(selected),values=cleanGarment(item,state.garments[selected]);
    const worn=state.outfit[item.slot]===selected;
    box.querySelector('#garmentPattern').value=selected;
    box.querySelector('[data-tailor-wear]').disabled=worn;
    $('tailorStatus').textContent=worn?'Wearing this pattern. Changes update on the figure.':'Wear this pattern to preview your changes.';
    const visible=CUTS[item.kind]||[],fit=fitRegions(item).map(r=>r.id);
    for(const row of box.querySelectorAll('[data-tailor-row]')){
      const key=row.dataset.tailorRow,cut=visible.find(c=>c[0]===key);
      row.hidden=!['ease','stretch'].includes(key)&&!fit.includes(key)&&!cut;
      if(cut){row.querySelector('label').firstChild.textContent=cut[1];const ends=row.querySelectorAll('.range-labels span');ends[0].textContent=cut[2];ends[1].textContent=cut[3];}
      const input=row.querySelector('input'),value=Math.round(values[key]*100);
      input.value=value;input.setAttribute('aria-valuetext',`${value}%`);row.querySelector('output').value=`${value}%`;
    }
    for(const input of box.querySelectorAll('[data-tailor-color]'))input.value=values[input.dataset.tailorColor];
    for(const input of box.querySelectorAll('[data-tailor-choice]'))input.value=values[input.dataset.tailorChoice];
    $('tailorNeckline').hidden=!['top','dress'].includes(item.kind);
  }
  function update(values){
    state.garments={...state.garments,[selected]:cleanGarment(itemById(selected),{...cleanGarment(itemById(selected),state.garments[selected]),...values})};
    if(!pending)pending=requestAnimationFrame(()=>{pending=0;onChanged();});
    save(state);sync();
  }
  box.addEventListener('input',e=>{
    const key=e.target.dataset.tailorRange||e.target.dataset.tailorColor;
    if(key)update({[key]:e.target.dataset.tailorRange?Number(e.target.value)/100:e.target.value});
  });
  box.addEventListener('change',e=>{
    if(e.target.id==='garmentPattern'){selected=e.target.value;onEquip(selected);sync();}
    const key=e.target.dataset.tailorChoice;if(key)update({[key]:e.target.value});
  });
  box.addEventListener('click',e=>{
    if(e.target.closest('[data-tailor-wear]')){onEquip(selected);sync();}
    if(e.target.closest('[data-tailor-reset]'))update(templateDefaults(itemById(selected)));
    const fit=e.target.closest('[data-tailor-fit]')?.dataset.tailorFit;
    if(fit)update({ease:{fitted:0,relaxed:.28,oversized:.75}[fit],...Object.fromEntries(FIT_REGIONS.map(r=>[r.id,0]))});
  });
  sync();return {sync};
}
