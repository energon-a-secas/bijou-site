import * as T from './vendor/avatar-engine.js';
import { toon } from './avatar-materials.js';
import { ball, tube, plaque, ribbon, band } from './avatar-shapes.js';

export function addHat(g,item){
  const p=item.params,c=item.colors;
  if(p.style==='captain'){
    const shape=new T.Shape();shape.moveTo(-.205,1.673);
    shape.bezierCurveTo(-.29,1.73,-.195,1.901,-.047,2.008);
    shape.quadraticCurveTo(0,2.039,.047,2.008);
    shape.bezierCurveTo(.195,1.901,.29,1.73,.205,1.673);
    shape.quadraticCurveTo(.12,1.63,0,1.694);shape.quadraticCurveTo(-.12,1.63,-.205,1.673);
    plaque(g,shape,.065,c.main,.025,.014);
    tube(g,[[-.20,1.686,.047],[-.125,1.678,.04],[0,1.711,.041],[.125,1.678,.04],[.20,1.686,.047]],.005,c.trim);
    // The tiny gold crest sits above the fringe, facing the camera.
    tube(g,[[-.10,1.887,.037],[-.085,1.907,.036],[-.066,1.888,.036],[-.082,1.87,.036],[-.10,1.887,.037]],.004,c.trim);
  }else if(p.style==='bunny'||p.style==='catears'){
    tube(g,[[-.113,1.613,.008],[-.105,1.707,-.001],[0,1.738,-.006],[.105,1.707,-.001],[.113,1.613,.008]],.009,c.main);
    for(const s of [-1,1]){
      const shape=new T.Shape();shape.moveTo(s*.061,1.728);
      if(p.style==='bunny'){
        shape.bezierCurveTo(s*.068,1.84,s*.12,2.01,s*.16,2.016);
        shape.bezierCurveTo(s*.204,2.01,s*.172,1.80,s*.105,1.728);
      }else{shape.lineTo(s*.145,1.872);shape.quadraticCurveTo(s*.167,1.793,s*.126,1.712)}
      shape.closePath();plaque(g,shape,-.018,c.main,.018,.009);
      const inner=shape.clone();const mesh=plaque(g,inner,-.029,c.trim||'#d883a0',.002,.003);
      mesh.scale.set(.66,.84,1);mesh.position.x=s*.033;mesh.position.y=.303;
    }
  }else if(p.style==='sunhat'||p.style==='witch'){
    ball(g,0,1.717,.01,.23,.015,.16,c.main);
    if(p.style==='witch'){
      const cone=new T.Mesh(new T.ConeGeometry(.135,.31,40),toon(c.main));cone.position.set(0,1.85,.015);cone.rotation.z=.10;g.add(cone);
    }else ball(g,0,1.749,.005,.131,.064,.121,c.main);
    band(g,1.73,.129,.119,c.trim||'#c29b64',.009);
  }else if(p.style==='crown'){
    band(g,1.705,.123,.12,'#789776',.005);
    for(let i=0;i<11;i++){
      const a=i/11*Math.PI*2,x=Math.sin(a)*.125,z=Math.cos(a)*.124;
      for(let k=0;k<5;k++){const t=k/5*Math.PI*2;ball(g,x+Math.cos(t)*.014,1.71+Math.sin(t)*.012,z-.007,.009,.01,.006,k%2?c.main:c.trim)}
      ball(g,x,1.71,z-.014,.006,.006,.004,'#e9bb5e');
    }
  }else{
    ball(g,p.style==='beret'?.021:0,1.732,.013,.14,p.style==='beret'?.04:.093,.124,c.main);
    if(p.style==='beanie')ball(g,0,1.827,.01,.031,.031,.031,c.trim||'#ffffff');
  }
}

export function addHairAccessory(g,item){
  const c=item.colors,p=item.params;
  if(p.style==='loops'){
    for(const s of [-1,1]){
      tube(g,[[s*.085,1.715,.007],[s*.172,1.775,.01],[s*.179,1.674,.005],[s*.085,1.715,.007]],.008,c.main);
      tube(g,[[s*.105,1.709,.01],[s*.153,1.683,.006],[s*.182,1.655,.005]],.007,c.main);
    }
  }else if(p.style==='ribbon'||p.style==='headband'){
    if(p.style==='headband')tube(g,[[-.11,1.62,-.03],[-.107,1.711,-.02],[0,1.742,-.013],[.11,1.70,-.02]],.008,c.main);
    ribbon(g,-.081,1.718,-.07,.053,c.main);
  }else{
    for(const s of [-1,1]){
      if(p.style==='strawberry'){
        ball(g,s*.087,1.63,-.076,.017,.022,.009,c.main);
        ball(g,s*.087,1.65,-.078,.014,.006,.009,'#69946c');
      }else{
        const sh=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.008:.02,x=s*.085+Math.sin(a)*r,y=1.64+Math.cos(a)*r;i?sh.lineTo(x,y):sh.moveTo(x,y)}sh.closePath();plaque(g,sh,-.078,c.main,.006,.002);
      }
    }
  }
}

export function addGlasses(g,item){
  const c=item.colors,p=item.params;
  for(const s of [-1,1]){
    const pts=[];
    for(let i=0;i<=48;i++){
      const a=i/48*Math.PI*2,rr=p.style==='stars'?.021*(1+.2*Math.cos(a*5)):.024;
      pts.push([s*.047+Math.cos(a)*rr,1.56+Math.sin(a)*rr*.78,-.1]);
    }
    tube(g,pts,.0022,c.main);
    if(p.style!=='round')ball(g,s*.047,1.56,-.099,.022,.017,.002,toon('#403444',{transparent:true,opacity:.6}));
  }
  tube(g,[[-.025,1.561,-.1],[0,1.567,-.113],[.025,1.561,-.1]],.002,c.main);
  for(const s of [-1,1])tube(g,[[s*.072,1.565,-.1],[s*.11,1.565,.014]],.002,c.main);
}

export function addHeld(g,item,hand){
  // The right hand is screen-left in the model's forward-facing pose.
  const c=item.colors,p=item.params,x=hand.x-.025,y=hand.y,z=hand.z-.035;
  if(p.style==='phone'||p.style==='book'){
    const w=p.style==='book'?.067:.031,h=p.style==='book'?.09:.058;
    const shape=new T.Shape();shape.moveTo(x-w,y-h);shape.lineTo(x+w,y-h);shape.lineTo(x+w,y+h);shape.lineTo(x-w,y+h);shape.closePath();plaque(g,shape,z,c.main,.013,.004);
    if(p.style==='phone'){
      const screen=new T.Mesh(new T.PlaneGeometry(w*1.75,h*1.65),new T.MeshBasicMaterial({color:'#a4cfdd',side:T.DoubleSide}));screen.position.set(x,y,z-.005);g.add(screen);
      ball(g,x,y,z-.006,.015,.015,.002,'#e791bb');
    }
  }else if(p.style==='boba'||p.style==='icecream'){
    const geo=p.style==='boba'?new T.CylinderGeometry(.032,.023,.085,24):new T.ConeGeometry(.028,.077,24);
    const cup=new T.Mesh(geo,toon(p.style==='boba'?c.main:'#d1a566'));cup.position.set(x,y-.015,z);if(p.style==='icecream')cup.rotation.z=Math.PI;g.add(cup);
    if(p.style==='boba'){
      tube(g,[[x+.006,y+.012,z],[x+.012,y+.105,z]],.004,'#efe2d2');
      for(let i=0;i<7;i++)ball(g,x+Math.sin(i*2)*.017,y-.036+Math.cos(i*3)*.007,z-.022,.004,.004,.004,'#513f37');
    }else ball(g,x,y+.035,z,.034,.035,.031,c.main);
  }else if(p.style==='parasol'){
    tube(g,[[x,y-.045,z],[x,y+.36,z]],.004,'#a08574');
    const mesh=new T.Mesh(new T.ConeGeometry(.23,.09,24,1,true),toon(c.main,{side:T.DoubleSide}));mesh.position.set(x,y+.35,z);g.add(mesh);
  }else if(p.style==='bouquet'){
    for(let i=0;i<7;i++){
      const a=i*2.4,px=x+Math.sin(a)*.047,py=y+.047+Math.cos(a)*.027;
      tube(g,[[x,y-.02,z],[px,py,z]],.003,c.main);ball(g,px,py,z,.021,.022,.018,c.trim||'#e8a1be');
    }
  }else{
    ball(g,x,y,z,.051,.058,.036,c.main);ball(g,x,y+.062,z-.006,.042,.038,.032,c.main);
    for(const s of [-1,1]){
      ball(g,x+s*.023,y+.111,z,.013,.035,.012,c.main);
      ball(g,x+s*.017,y+.068,z-.036,.003,.004,.002,'#4e3645');
      ball(g,x+s*.032,y-.051,z,.022,.025,.019,c.main);
    }
  }
}
