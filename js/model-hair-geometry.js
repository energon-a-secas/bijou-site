import * as T from './vendor/avatar-engine.js';
// Convex, closed cross sections with broad ridges and tapered tips. Coordinates
// are normalized rest metres, +Z front, before the head attachment transform.
export function hairLock(points,width,depth){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),rows=36,cols=20,pos=[],uv=[],index=[],ts=[],tangents=[],colors=[];
  const side=new T.Vector3(),front=new T.Vector3(),ref=new T.Vector3(0,0,1);
  for(let j=0;j<=rows;j++){
    const t=j/rows,p=curve.getPoint(t),tangent=curve.getTangent(t);side.crossVectors(tangent,ref).normalize();front.crossVectors(side,tangent).normalize();
    const root=.35+.65*Math.sin(Math.min(1,t*4)*Math.PI/2),tip=Math.pow(Math.min(1,(1-t)/.38),.72),taper=Math.max(.001,root*tip);
    const derivative=curve.getPoint(Math.min(1,t+.002)).sub(curve.getPoint(Math.max(0,t-.002))).multiplyScalar(1/(t===0||t===1?.002:.004));
    for(let i=0;i<=cols;i++){
      const a=i/cols*Math.PI*2,v=p.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(front,Math.sin(a)*(1+.06*Math.cos(a*4))*depth*taper);
      pos.push(v.x,v.y,v.z);uv.push(i/cols,t);ts.push(t);tangents.push(...derivative.toArray());
      const light=.96-.04*t+.018*Math.cos(a*3);colors.push(light,light,light);
      if(j<rows&&i<cols){const n=j*(cols+1)+i;index.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
    }
  }
  for(const [row,flip]of [[0,false],[rows,true]]){
    const p=curve.getPoint(row/rows),center=pos.length/3;pos.push(...p.toArray());uv.push(.5,row/rows);ts.push(row/rows);tangents.push(...curve.getTangent(row/rows).toArray());colors.push(.94,.94,.94);
    for(let i=0;i<cols;i++){const a=row*(cols+1)+i;index.push(center,flip?a+1:a,flip?a:a+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('bjHairT',new T.Float32BufferAttribute(ts,1));geometry.setAttribute('bjHairTangent',new T.Float32BufferAttribute(tangents,3));geometry.setIndex(index);geometry.computeVertexNormals();smoothSeam(geometry,rows,cols);
  return {geometry,curve};
}
export function hairCrown(top,volume){
  const rows=28,cols=72,pos=[],uv=[],index=[],width=.110+volume*.012,depth=.124+volume*.010,cy=top-.123;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const phi=i/cols*Math.PI*2,front=Math.max(0,Math.cos(phi)),theta=j/rows*(2.15-front*.80);
    const ridge=1+.010*Math.cos(phi*14)*Math.sin(theta)**2;
    pos.push(Math.sin(phi)*Math.sin(theta)*width*ridge,cy+Math.cos(theta)*.123,Math.cos(phi)*Math.sin(theta)*depth*ridge-.008);uv.push(i/cols,j/rows);
    if(j<rows&&i<cols){const n=j*(cols+1)+i;index.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();smoothSeam(geometry,rows,cols);
  for(let i=0;i<=cols;i++)geometry.attributes.normal.setXYZ(i,0,1,0);return geometry;
}
function smoothSeam(geometry,rows,cols){
  const n=geometry.attributes.normal,v=new T.Vector3();
  for(let j=0;j<=rows;j++){const a=j*(cols+1),b=a+cols;v.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
}
export function hairGuides(settings,neck,eye=neck+.176){
  const top=1.689,side=settings.style==='bob',end=side?neck+.020+(1-settings.length)*.055:neck-.04-settings.length*.38,wide=.94+settings.volume*.14,result=[];
  const add=(points,w,d,moving=true)=>result.push({points:points.map(([x,y,z])=>[x*wide,y,z]),width:w*wide,depth:d,moving});
  if(settings.style!=='swept')for(let i=-3;i<=3;i++){
    const x=i*.021;
    add([[x*.20,top-.010,.025],[x*.77,eye+.111,.093],[x,eye+.072,.124-Math.abs(i)*.003],[x+.004*Math.sign(i),eye+.025+Math.abs(i)*.003,.118-Math.abs(i)*.003]],.020-Math.abs(i)*.001,.0055,false);
  }
  // Overlapping back locks provide coverage without a hanging flat sheet.
  for(let i=-5;i<=5;i++){
    const x=i*.019,z=-.106+.0018*Math.abs(i),tip=end+.009*Math.abs(i);
    add([[x*.26,top-.022,-.025],[x*.90,eye+.060,z-.010],[x*1.08,neck+.018,z-.030],[x*1.15,tip+.08,z-.043],[x*(side?1.23:1.42),tip+.006,z-.026]],.022,.006);
  }
  for(const s of [-1,1])for(let i=0;i<4;i++){
    const x=s*(.101+i*.003),z=.015-i*.029,tip=end+.026+i*.018;
    if(side){const tip=end+i*.010;add([[s*.048,top-.040,z*.5],[x,eye+.032,z],[s*(.110+i*.004),(eye+end)*.5,z-.004],[s*(.119+i*.005),tip+.036,z-.004],[s*(.107+i*.009),tip,z+.013]],.021,.006);continue;}
    add([[s*.048,top-.040,z*.5],[x,eye+.037,z],[s*(.136+i*.006),neck+.015,z-.016],[s*(.166+i*.009),tip+.074,z-.024],[s*(.181+i*.009),tip+.038,z+.006]],.021,.0055);
  }
  if(settings.style==='swept'){
    for(let i=0;i<4;i++)add([[.045-i*.008,top-.018,.045],[.021-i*.017,top-.058,.112],[-.025-i*.017,eye+.077-i*.010,.126-i*.004],[-.073-i*.009,eye+.006-i*.012,.097-i*.004]],.020,.006,false);
    for(let i=0;i<2;i++)add([[.045+i*.012,top-.026,.045],[.079+i*.012,top-.068,.097],[.095+i*.009,eye+.025,.083],[.097+i*.011,neck+.065,.062]],.018,.006,false);
  }
  for(const s of [-1,1])add([[s*.060,eye+.085,.075],[s*.084,eye+.020,.096],[s*.099,neck+.100,.080],[s*.106,side?neck+.053:neck+.015,.061]],.013,.005);
  for(const s of [-1,1])add([[s*.100,eye+.055,.018],[s*.117,neck+.040,.006],[s*.130,end+.13,.008],[s*.156,end+.065,.032]],.006,.0028);
  return result;
}
