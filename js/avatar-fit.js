// Fit clothing after the body is shaped. Fabric allowance must never feed
// back into the anatomical region classifier or distort its bind skeleton.
import { resolvedItem } from './catalog.js';
import { surfaceMaterial } from './avatar-materials.js';
import { garmentEase } from './garment-templates.js';
import { smoothNormals } from './avatar-surface.js';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

// Elliptical sections bridge the chest instead of duplicating concave skin folds.
function torsoEnvelope(body,item){
  const p=body.attributes.position,r=body.attributes.bjRest,rows=[];
  for(let y=.96;y<=1.43;y+=.012){
    let radius=.08,depth=.04;const points=[];
    for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-y)<.021&&Math.abs(r.getX(i))<.155&&r.getZ(i)<-.008){
      radius=Math.max(radius,Math.abs(p.getX(i))+.022);points.push([p.getX(i),p.getZ(i)]);
    }
    for(const [x,z] of points)depth=Math.max(depth,(.018-z)/Math.sqrt(Math.max(.12,1-(x/radius)**2)));
    rows.push({y,radius,depth});
  }
  // Loose fabric bridges from the chest to the hem instead of reproducing the
  // under-chest fold. Keep fuller abdomen sections outside that hanging panel.
  const hem=Math.max(.98,item.params.hemY??.98),loose=smooth(.05,.70,item.params.fit?.ease??.18);
  const base=rows.reduce((a,b)=>Math.abs(a.y-hem)<Math.abs(b.y-hem)?a:b).depth;
  const peak=Math.max(...rows.filter(r=>r.y>1.23&&r.y<1.31).map(r=>r.depth));
  for(const row of rows)if(row.y<1.27&&row.y>hem){
    const hanging=base+(peak-base)*smooth(hem,1.27,row.y);
    row.depth+=Math.max(0,hanging-row.depth)*loose;
  }
  // Average section noise before differentiating normals; an oversized panel
  // should not inherit a separate horizontal ridge at each sampled row.
  for(let pass=0;pass<2;pass++){
    const copy=rows.map(r=>({...r}));
    for(let i=1;i<rows.length-1;i++)for(const key of ['radius','depth'])rows[i][key]=(copy[i-1][key]+2*copy[i][key]+copy[i+1][key])/4;
  }
  return (y,x,puff)=>{
    const f=Math.max(0,Math.min(rows.length-1.001,(y-.96)/.012)),i=Math.floor(f),t=f-i;
    const cubic=key=>{const a=rows[Math.max(0,i-1)][key],b=rows[i][key],c=rows[i+1][key],d=rows[Math.min(rows.length-1,i+2)][key];return .5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);};
    const radius=cubic('radius')+puff,depth=cubic('depth')+puff;
    return .018-depth*Math.sqrt(Math.max(0,1-(x/radius)**2));
  };
}

export function createFit(skin){
  const meshes=skin.map(body=>{
    const layer=body.clone(false);layer.geometry=body.geometry.clone();layer.geometry.clearGroups();layer.geometry.addGroup(0,layer.geometry.index.count,0);
    layer.name=`fit-${body.name}`;layer.userData={region:'body'};layer.frustumCulled=false;body.parent.add(layer);return layer;
  });
  let material=null,materialKey='',cfg;
  function build(next){
    cfg=next;
    const key=JSON.stringify([cfg.outfit,cfg.garments,cfg.renderStyle])+cfg.body.skin;
    if(key!==materialKey){material?.dispose();material=surfaceMaterial(cfg,true);materialKey=key;}
    for(const mesh of meshes){mesh.material=material;mesh.userData.shapeBase=mesh.geometry.attributes.bjRest.array.slice();}
  }
  function refit(){
    const item=slot=>resolvedItem(cfg.outfit[slot],cfg.garments);
    const clothes=item('outer')||item('dress')||item('top'),pants=item('bottom'),boots=item('shoes'),socks=item('legwear'),swim=item('swim');
    const sleeves=cfg.outfit.outer||clothes?.id==='dress-captain'?'long':clothes?.params.sleeve;
    const hem=clothes?.params.hemY??.98,waist=pants?.kind==='pants'?(pants.params.waistY??1.015):.87;
    for(let n=0;n<meshes.length;n++){
      const mesh=meshes[n],pos=mesh.geometry.attributes.position,rest=mesh.geometry.attributes.bjRest;
      const body=skin[n].geometry.attributes.position,normal=skin[n].geometry.attributes.normal,front=clothes?torsoEnvelope(skin[n].geometry,clothes):null;
      const panels=[];
      for(let i=0;i<pos.count;i++){
        const x=rest.getX(i),y=rest.getY(i),z=rest.getZ(i),px=body.getX(i),py=body.getY(i),pz=body.getZ(i);
        let puff=.0018,fitted=null;
        if(clothes&&y>hem-.025&&y<1.44){
          if(Math.abs(x)<.17)puff=clothes.params.loose?.018:.010;
          if(y>1.28&&Math.abs(x)>.115&&Math.abs(x)<(sleeves==='long'||sleeves==='wide'?.56:.27))puff=['puff','wide'].includes(sleeves)?.03:.014;
          puff=garmentEase(clothes,x,y)??puff;fitted=clothes;
        }
        if(swim&&y>.86&&y<1.41){puff=garmentEase(swim,x,y)??.002;fitted=swim;}
        if(pants?.kind==='pants'&&y<waist+.015&&y>(pants.params.legY??(pants.params.len==='short'?.78:.125))-.02){puff=garmentEase(pants,x,y)??(.014+(pants.params.wide||0)*.03);fitted=pants;}
        if(socks?.params.style==='warmers'&&y>.16&&y<.49)puff=.018;
        if(['captain','rainboot','boot'].includes(boots?.params.style)&&y<.56&&y>.15)puff=Math.max(puff,.009);
        if(fitted?.params.fit){
          const fold=Math.exp(-(((y-1.08)/.055)**2))+Math.exp(-(((y-.535)/.04)**2));
          puff+=Math.sin(y*320+Math.abs(x)*40)*fold*Math.min(.0015,puff*.15)*(1-fitted.params.fit.stretch);
        }
        if(clothes&&fitted===clothes&&y>1.33)puff*=1-smooth(1.33,1.41,y)*(1-smooth(.055,.17,Math.abs(x)))*.85;
        let nx=px+normal.getX(i)*puff,ny=py+normal.getY(i)*puff,nz=pz+normal.getZ(i)*puff;
        if(fitted===pants&&y<1.17)ny=py;
        if(fitted===clothes&&front&&Math.abs(x)<.205&&y>Math.max(.99,hem-.02,waist)&&y<1.42&&z<-.008){
          const blend=smooth(.205,.12,Math.abs(x))*smooth(-.008,-.04,z)*smooth(1.42,1.37,y);
          const panelY=y,panelX=px;
          nx+=(panelX-nx)*blend;ny+=(panelY-ny)*blend;
          nz+=(front(panelY,panelX,puff)-nz)*blend;
          const dx=(front(panelY,panelX+.001,puff)-front(panelY,panelX-.001,puff))/.002;
          const dy=(front(panelY+.001,panelX,puff)-front(panelY-.001,panelX,puff))/.002;
          const len=Math.hypot(dx,dy,1);panels.push([i,dx/len,dy/len,-1/len,blend]);
        }
        pos.setXYZ(i,nx,ny,nz);
      }
      pos.needsUpdate=true;smoothNormals(mesh.geometry);mesh.geometry.computeBoundingSphere();
      const normals=mesh.geometry.attributes.normal;
      for(const [i,x,y,z,w] of panels){
        const nx=normals.getX(i)*(1-w)+x*w,ny=normals.getY(i)*(1-w)+y*w,nz=normals.getZ(i)*(1-w)+z*w,len=Math.hypot(nx,ny,nz)||1;
        normals.setXYZ(i,nx/len,ny/len,nz/len);
      }normals.needsUpdate=true;
    }
  }
  return {build,refit,meshes};
}
