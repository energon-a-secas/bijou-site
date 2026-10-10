export const MODEL_TOPS=[{id:'source',name:'Original tank'},{id:'tank',name:'Fitted tank'},{id:'tee',name:'T-shirt'},{id:'longsleeve',name:'Long sleeve'}];
export const MODEL_BOTTOMS=[{id:'source',name:'Original shorts'},{id:'shorts',name:'Fitted shorts'},{id:'leggings',name:'Leggings'},{id:'jeans',name:'Jeans'}];
export const CLOTHES_DEFAULTS=Object.freeze({top:'source',bottom:'source',topColor:'#829da3',bottomColor:'#354953',topFit:.15,bottomFit:.15,legLength:1});
export const OUTFIT_PRESETS=[
  {id:'original',name:'Original',values:CLOTHES_DEFAULTS},
  {id:'everyday',name:'Everyday',values:{top:'tee',bottom:'jeans',topColor:'#ece4d7',bottomColor:'#394f6e',topFit:.3,bottomFit:.28}},
  {id:'training',name:'Training',values:{top:'tank',bottom:'leggings',topColor:'#b98295',bottomColor:'#383441',topFit:.05,bottomFit:.03}},
  {id:'cozy',name:'Soft knit',values:{top:'longsleeve',bottom:'leggings',topColor:'#9eaaa0',bottomColor:'#4b464f',topFit:.5,bottomFit:.12}},
  {id:'heroine',name:'Heroine',values:{top:'tank',bottom:'shorts',topColor:'#e8e1d7',bottomColor:'#322f39',topFit:.08,bottomFit:.1}}
];
export function cleanClothes(value){
  const result={...CLOTHES_DEFAULTS};
  if(MODEL_TOPS.some(t=>t.id===value?.top))result.top=value.top;
  if(MODEL_BOTTOMS.some(t=>t.id===value?.bottom))result.bottom=value.bottom;
  for(const key of ['topColor','bottomColor'])if(typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key];
  for(const key of ['topFit','bottomFit','legLength'])if(typeof value?.[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.min(1,Math.max(0,value[key]));
  return result;
}
