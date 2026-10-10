export const RENDER_QUALITIES=[
  {id:'light',name:'Light',pixelRatio:1,shadow:512},
  {id:'balanced',name:'Balanced',pixelRatio:1.5,shadow:1024},
  {id:'detailed',name:'Detailed',pixelRatio:2,shadow:2048},
];
export const qualityFor=id=>RENDER_QUALITIES.find(q=>q.id===id)||RENDER_QUALITIES[1];
