// Garment displacement must use one direction at every coincident UV seam.
// Authored shading normals can differ there; extruding along them opens cracks.
// Keep these geometric directions separate from the source's smooth shading.
export function weldedSurfaceNormals(geometry,groups){
  const p=geometry.attributes.position,index=geometry.index,work=new Float32Array(p.count*3);
  const count=index?.count??p.count;
  for(let i=0;i<count;i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    const ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a),vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a);
    const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
    for(const id of [a,b,c]){work[id*3]+=x;work[id*3+1]+=y;work[id*3+2]+=z;}
  }
  for(const group of groups){
    let x=0,y=0,z=0;for(const id of group){x+=work[id*3];y+=work[id*3+1];z+=work[id*3+2];}
    for(const id of group){work[id*3]=x;work[id*3+1]=y;work[id*3+2]=z;}
  }
  for(let i=0;i<p.count;i++){
    const at=i*3,length=Math.hypot(work[at],work[at+1],work[at+2]);
    if(length>1e-12)for(let k=0;k<3;k++)work[at+k]/=length;
    else for(let k=0;k<3;k++)work[at+k]=geometry.attributes.normal.array[at+k];
  }
  return work;
}
