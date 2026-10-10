import * as T from './vendor/avatar-engine.js';
import { toon } from './avatar-materials.js';

export function ball(parent, x, y, z, rx, ry, rz, color) {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), typeof color === 'string' ? toon(color) : color);
  mesh.position.set(x,y,z); mesh.scale.set(rx,ry,rz); parent.add(mesh); return mesh;
}

export function tube(parent, points, radius, color) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const mesh = new T.Mesh(new T.TubeGeometry(path, Math.max(12,points.length*8), radius, 8, false), toon(color));
  parent.add(mesh); return mesh;
}

export function plaque(parent, shape, z, color, depth=.012, bevel=.007) {
  const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, {depth, steps:1, bevelEnabled:true, bevelSegments:3, bevelSize:bevel, bevelThickness:bevel, curveSegments:16}), toon(color));
  mesh.position.z=z; parent.add(mesh); return mesh;
}

export function ribbon(parent, x,y,z,size,color) {
  for(const s of [-1,1]){
    const shape=new T.Shape();shape.moveTo(x,y);
    shape.bezierCurveTo(x+s*size*.8,y+size*.7,x+s*size*1.2,y+size*.5,x+s*size,y-size*.35);
    shape.quadraticCurveTo(x+s*size*.55,y-size*.55,x,y);
    plaque(parent,shape,z,color,.006,.003);
  }
  ball(parent,x,y,z-.007,size*.2,size*.23,size*.23,color);
}

/** Rounded, elliptical fabric with true folds around its circumference. */
export function skirt(parent, {top=1.095,bottom=.72,waist=.095,radius=.245,depth=.7,pleats=16,fold=.008,material,ruffle=0}) {
  const sides=96,rows=22,positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++){
    const t=j/rows, ease=t*t*(3-2*t);
    const r=waist+(radius-waist)*(ruffle ? Math.pow(t,.6) : .08*t+.92*Math.pow(Math.sin(t*Math.PI/2),1.55));
    for(let i=0;i<=sides;i++){
      const a=i/sides*Math.PI*2;
      const rr=r+fold*Math.sin(a*pleats)*Math.pow(t,.8);
      const y=top+(bottom-top)*t+(ruffle||.004)*Math.sin(a*pleats)*t*t+.009*Math.cos(a)*t;
      positions.push(Math.sin(a)*rr,y,Math.cos(a)*rr*depth+.006);
      uv.push(i/sides,1-t);
      if(j<rows&&i<sides){const n=j*(sides+1)+i;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2)}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);parent.add(mesh);mesh.userData.skirt=true;return mesh;
}

export function band(parent, y, rx, rz, color, radius=.006) {
  const points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;points.push([Math.sin(a)*rx,y,Math.cos(a)*rz])}
  return tube(parent,points,radius,color);
}

export function disposeGroup(group) {
  group.traverse(o=>{
    o.geometry?.dispose();
    o.customDepthMaterial?.dispose();
    if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
  });
  group.removeFromParent();
}
