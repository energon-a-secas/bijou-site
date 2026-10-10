// Saved art direction is independent of rendering resolution and shadows.
export const RENDER_STYLES=[
  {id:'anime3d',name:'3D anime',detail:'Soft figurine shading'},
  {id:'anime2d',name:'2D animation',detail:'Crisp cel shadows'},
  {id:'realistic',name:'Realistic',detail:'Physical light and surface detail'},
];
export const cleanRenderStyle=value=>RENDER_STYLES.some(s=>s.id===value)?value:'anime3d';
