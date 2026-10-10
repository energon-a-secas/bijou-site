import * as T from './vendor/avatar-engine.js';
import { toon } from './avatar-materials.js';
import { ball, tube } from './avatar-shapes.js';

export function addShoes(group,item,foot){
  const {style}=item.params,c=item.colors,x=foot.x;
  const sole=new T.Shape();
  sole.moveTo(x-.026,.062);sole.quadraticCurveTo(x-.043,.034,x-.046,-.076);
  sole.bezierCurveTo(x-.046,-.16,x+.046,-.16,x+.046,-.076);
  sole.quadraticCurveTo(x+.042,.034,x+.026,.062);sole.quadraticCurveTo(x,.077,x-.026,.062);
  const geo=new T.ExtrudeGeometry(sole,{depth:.013,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.005,bevelThickness:.004,curveSegments:16});
  const flat=style==='sandal'||style==='slipper';
  const bottom=new T.Mesh(geo,toon(c.accent||c.trim||c.main));bottom.rotation.x=Math.PI/2;bottom.position.y=flat?.019:.032;group.add(bottom);
  if(style==='sandal'){
    for(const z of [-.085,-.018])tube(group,[[x-.042,.039,z],[x,.068,z],[x+.042,.039,z]],.008,c.main);
  }else{
    // The rounded toe is a continuous volume, not the source model's frilled shoe.
    const shoe=ball(group,x,.058,-.045,.045,.042,.103,c.main);
    for(let i=0;i<shoe.geometry.attributes.position.count;i++){
      const p=shoe.geometry.attributes.position;
      if(p.getY(i)<-.45)p.setY(i,-.45+(p.getY(i)+.45)*.15);
    }
    shoe.geometry.attributes.position.needsUpdate=true;shoe.geometry.computeVertexNormals();
    if(style==='maryjane')tube(group,[[x-.04,.067,-.005],[x,.108,-.005],[x+.04,.067,-.005]],.005,c.trim||c.main);
    if(style==='sneaker'){
      for(let i=0;i<4;i++)tube(group,[[x-.021,.091+i*.001,-.045+i*.016],[x+.021,.091+i*.001,-.037+i*.016]],.0027,c.trim||'#eeeeee');
    }
    if(style==='loafer')tube(group,[[x-.037,.069,-.043],[x,.097,-.042],[x+.037,.069,-.043]],.007,c.trim||c.main);
    if(style==='slipper')for(const s of [-1,1])ball(group,x+s*.022,.102,-.066,.012,.036,.012,c.main);
  }
  if(!flat){
    const heel=new T.Mesh(new T.CylinderGeometry(style==='pump'?.012:.029,style==='pump'?.009:.029,.045,20),toon(c.main));heel.position.set(x,.025,.039);group.add(heel);
  }
}
