// Immutable clothing patterns and validated, portable tailoring parameters.
// No renderer dependency: storage, SVG and 3D all resolve the same item data.
const make=(id,name,slot,kind,template,params,color,fabric)=>({
  id:`studio-${id}`,name,slot,kind,template,params,colors:{main:color,trim:color},
  pattern:null,tags:['cozy','elegant'],unlock:{free:true},fabric,
});
export const TEMPLATE_ITEMS=[
  make('underwear','Everyday underwear','swim','swim2','underwear',{top:'band',bottom:'high'},'#9b697c','jersey'),
  make('jeans','Classic jeans','bottom','pants','jeans',{len:'long',wide:.2},'#547da1','denim'),
  make('leggings','Soft leggings','bottom','pants','leggings',{len:'long'},'#423c50','jersey'),
  make('jeggings','Stretch jeggings','bottom','pants','jeggings',{len:'long'},'#435e83','denim'),
  make('crop','Crop top','top','top','crop',{neck:'scoop',sleeve:'short',hem:'crop'},'#eed4d5','cotton'),
  make('tee','Everyday tee','top','top','tee',{neck:'crew',sleeve:'short',hem:'hip'},'#ece5d8','cotton'),
  make('cami','Camisole','top','top','cami',{neck:'square',sleeve:'none',hem:'waist'},'#9caaa0','jersey'),
  make('sweater','Oversized sweater','top','top','sweater',{neck:'crew',sleeve:'long',hem:'hip',loose:5},'#c7afb2','knit'),
  make('skirt','Everyday skirt','bottom','skirt','skirt',{len:'short',flare:.5},'#a58a9c','cotton'),
  make('dress','Day dress','dress','dress','dress',{neck:'scoop',sleeve:'short',len:'knee',flare:.45},'#719590','cotton'),
];
export const FABRICS=[{id:'cotton',name:'Cotton'},{id:'jersey',name:'Stretch jersey'},{id:'denim',name:'Denim'},{id:'knit',name:'Soft knit'},{id:'satin',name:'Satin'}];
export const NECKLINES=[{id:'crew',name:'Crew'},{id:'scoop',name:'Scoop'},{id:'square',name:'Square'},{id:'v',name:'V-neck'}];
export const FIT_REGIONS=[{id:'chestEase',name:'Chest'},{id:'waistEase',name:'Waist'},{id:'hipEase',name:'Hips'},{id:'armEase',name:'Sleeves'},{id:'legEase',name:'Legs'}];
export const CUTS={
  top:[['length','Hem length','Cropped','Long'],['sleeves','Sleeve length','Sleeveless','Long']],
  pants:[['length','Leg length','Shorts','Full length'],['rise','Waist rise','Low','High']],
  skirt:[['length','Skirt length','Short','Midi'],['flare','Flare','Straight','Full']],
  dress:[['length','Skirt length','Short','Midi'],['sleeves','Sleeve length','Sleeveless','Long'],['flare','Flare','Straight','Full']],
  swim2:[['rise','Bottom rise','Low','High'],['straps','Strap width','Fine','Wide']],
};
const NUMBERS=['length','sleeves','rise','flare','straps','ease','stretch',...FIT_REGIONS.map(r=>r.id)];
export function templateDefaults(item){
  const type=item.template,p=item.params;
  return {color:item.colors.main,trim:item.colors.trim||item.colors.main,fabric:item.fabric||'jersey',neckline:p.neck||'scoop',
    length:type==='crop'?.20:type==='cami'?.57:['skirt','dress'].includes(type)?.38:.95,
    sleeves:p.sleeve==='none'?0:p.sleeve==='long'?1:.32,rise:type==='underwear'?.55:type==='bikini'?.23:.65,flare:p.flare??.4,straps:.35,
    ease:type==='sweater'?.7:type==='jeans'?.25:['leggings','jeggings','underwear','bikini'].includes(type)?0:.18,
    stretch:['leggings','jeggings','underwear','bikini'].includes(type)?.9:type==='jeans'?.25:.5,
    chestEase:0,waistEase:0,hipEase:0,armEase:0,legEase:0};
}
export function cleanGarment(item,value){
  const defaults=templateDefaults(item),v=value&&typeof value==='object'?value:{};
  return {...Object.fromEntries(NUMBERS.map(k=>[k,Number.isFinite(v[k])?Math.max(0,Math.min(1,v[k])):defaults[k]])),
    color:/^#[\da-f]{6}$/i.test(v.color)?v.color:defaults.color,trim:/^#[\da-f]{6}$/i.test(v.trim)?v.trim:defaults.trim,
    fabric:FABRICS.some(f=>f.id===v.fabric)?v.fabric:defaults.fabric,
    neckline:NECKLINES.some(n=>n.id===v.neckline)?v.neckline:defaults.neckline};
}
export function customizeItem(item,settings){
  if(!item?.template)return item;
  const v=cleanGarment(item,settings?.[item.id]),top=item.kind==='top'||item.kind==='dress';
  const params={...item.params,fit:v,neck:v.neckline};
  if(top){params.sleeve=v.sleeves<.04?'none':v.sleeves<.44?'short':'long';params.sleeveX=.134+.406*v.sleeves;params.hemY=item.kind==='dress'?.98:1.205-.22*v.length;params.hem=v.length<.38?'crop':v.length<.75?'waist':'hip';params.loose=v.ease*8;}
  if(item.kind==='pants'){params.len=v.length<.2?'short':'long';params.legY=.82-.695*v.length;params.waistY=1.003+.108*v.rise;params.wide=v.ease;}
  if(item.kind==='skirt'||item.kind==='dress'){params.skirtY=.84-.45*v.length;params.len=v.length<.35?'short':v.length<.62?'knee':'midi';params.flare=v.flare;}
  if(item.kind==='swim2'){params.bottom=v.rise>.55?'high':'brief';params.waistY=.97+.087*v.rise;params.strapWidth=.005+.013*v.straps;}
  return {...item,params,colors:{...item.colors,main:v.color,trim:v.trim},fabric:v.fabric};
}
export function fitRegions(item){
  const ids=item?.kind==='pants'?['waistEase','hipEase','legEase']:item?.kind==='skirt'?['waistEase','hipEase']:item?.kind==='swim2'?['chestEase','hipEase']:['chestEase','waistEase','hipEase','armEase'];
  return FIT_REGIONS.filter(r=>ids.includes(r.id));
}
// Positive ease grows fabric outwards. Stretch softens tension marks, it never
// scales the body or creates transparency. Units are metres in model rest space.
export function garmentEase(item,x,y){
  const v=item?.params.fit;if(!v)return null;
  const bell=(center,width)=>Math.exp(-(((y-center)/width)**2));
  let local=v.waistEase*bell(1.10,.09)+v.hipEase*bell(.99,.09);
  if(y>1.27&&Math.abs(x)>.13)local=v.armEase;
  else if(y<.91)local=v.legEase;
  else local+=v.chestEase*bell(1.26,.09);
  return .002+v.ease*.045+local*.045;
}
