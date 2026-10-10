export const SURFACE_STYLES=[{id:'anime3d',name:'Anime 3D'},{id:'anime2d',name:'Anime 2D'},{id:'realistic',name:'Fantasy realism'},{id:'clay',name:'Sculpting clay'}];
export const STYLE_CONTROLS=[
  {id:'skinBlend',label:'Skin tone coverage',group:'skin',value:.35},
  {id:'roughness',label:'Skin matte finish',group:'skin',value:.55,physical:true},
  {id:'detail',label:'Original texture detail',group:'skin',value:.2},
  {id:'pores',label:'Fine pores',group:'skin',value:.15,physical:true},
  {id:'lightWrap',label:'Soft light falloff',group:'skin',value:.2,physical:true},
  {id:'freckles',label:'Freckles',group:'skin',value:0},
  {id:'blush',label:'Blush',group:'makeup',value:.12},
  {id:'lipTint',label:'Lip color coverage',group:'makeup',value:.25},
  {id:'lipGloss',label:'Lip gloss',group:'makeup',value:.35,physical:true},
  {id:'eyeliner',label:'Lash definition',group:'makeup',value:.3},
  {id:'eyeTint',label:'Iris color coverage',group:'eyes',value:0},
  {id:'eyeRestoration',label:'Eye surface clarity',group:'eyes',value:0},
  {id:'irisScale',label:'Iris pattern size',group:'eyes',value:0,min:-1,max:1},
  {id:'pupilSize',label:'Pupil definition',group:'eyes',value:0},
  {id:'limbal',label:'Iris edge definition',group:'eyes',value:.4},
  {id:'eyeGloss',label:'Eye gloss',group:'eyes',value:.6,physical:true},
  {id:'hairDetail',label:'Strand definition',group:'hair',value:.25},
  {id:'hairRoughness',label:'Hair matte finish',group:'hair',value:.5,physical:true}
];
export const STYLE_COLORS={skinColor:'#f4d4bc',blushColor:'#d87388',lipColor:'#b87379',eyeColor:'#79503d'};
export const STYLE_DEFAULTS=Object.freeze({render:'anime3d',...STYLE_COLORS,...Object.fromEntries(STYLE_CONTROLS.map(c=>[c.id,c.value]))});
export function cleanModelStyle(value){
  const result={render:SURFACE_STYLES.some(s=>s.id===value?.render)?value.render:STYLE_DEFAULTS.render};
  for(const [key,fallback]of Object.entries(STYLE_COLORS))result[key]=typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key])?value[key]:fallback;
  for(const c of STYLE_CONTROLS)result[c.id]=typeof value?.[c.id]==='number'&&Number.isFinite(value[c.id])?Math.max(c.min??0,Math.min(c.max??1,value[c.id])):result.render==='realistic'?REALISM_STYLE[c.id]:c.value;
  return result;
}
export const LIGHT_STAGES=[{id:'ivory',name:'Ivory atelier'},{id:'midnight',name:'Midnight studio'},{id:'slate',name:'Neutral slate'}];
export const LIGHT_DEFAULTS=Object.freeze({stage:'ivory',azimuth:-.42,elevation:.55,exposure:1,fill:.55,rim:.45});
export const LIGHT_CONTROLS=[
  {id:'azimuth',label:'Key light · left / right',min:-1,max:1},
  {id:'elevation',label:'Key light · low / high',min:0,max:1},
  {id:'exposure',label:'Exposure',min:.5,max:1.6},
  {id:'fill',label:'Fill light',min:0,max:1},
  {id:'rim',label:'Rim light',min:0,max:1}
];
export function cleanModelLight(value){
  const result={stage:LIGHT_STAGES.some(s=>s.id===value?.stage)?value.stage:'ivory'};
  for(const c of LIGHT_CONTROLS)result[c.id]=typeof value?.[c.id]==='number'&&Number.isFinite(value[c.id])?Math.max(c.min,Math.min(c.max,value[c.id])):LIGHT_DEFAULTS[c.id];
  return result;
}
export const REALISM_STYLE=Object.freeze({...STYLE_DEFAULTS,render:'realistic',skinColor:'#edc9b2',skinBlend:.95,roughness:.52,detail:.10,pores:.3,lightWrap:.35,freckles:.15,blush:.20,lipTint:.5,lipGloss:.5,eyeColor:'#739ca9',eyeTint:1,eyeRestoration:1,irisScale:-.08,pupilSize:.3,hairDetail:.7,hairRoughness:.42});
