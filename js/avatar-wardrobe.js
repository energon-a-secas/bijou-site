// Volumetric skirts, collars and accessories accompany the fitted, skinned
// fabric surface. All positions here are model rest coordinates, in metres.
import * as T from './vendor/avatar-engine.js';
import { resolvedItem } from './catalog.js';
import { toon, fabric } from './avatar-materials.js';
import { ball, tube, plaque, ribbon, skirt, band, disposeGroup } from './avatar-shapes.js';
import { addHat, addHairAccessory, addHeld, addGlasses } from './avatar-accessories.js';
import { addShoes } from './avatar-shoes.js';

export function createWardrobe(vrm, rest) {
  let groups=[];
  const attach = (bone, slot) => {
    const g = new T.Group();g.name=`wear-${slot}`;
    g.userData.bone=bone;
    g.userData.region=bone==='head'?'head':'body';
    g.position.copy(rest[bone]).multiplyScalar(-1);
    vrm.humanoid.getRawBoneNode(bone).add(g);groups.push(g);return g;
  };
  function build(cfg) {
    groups.forEach(disposeGroup);groups=[];
    const item=slot=>resolvedItem(cfg.outfit[slot],cfg.garments);
    const dress=item('dress'),swim=item('swim'),bottom=item('bottom'),outer=item('outer'),top=item('top');
    const captain=dress?.id==='dress-captain', tux=swim?.id==='swim-tuxedo';
    const torso=attach('chest','bodice'), hips=attach('hips','skirt');
    // A skirt remains the default lower half of the permanent base slip.
    const skirtItem=dress || (bottom?.kind==='skirt'?bottom:null);
    if(captain){
      skirt(torso,{top:1.12,bottom:1.014,radius:.123,depth:.69,fold:.002,material:toon(dress.colors.main,{side:T.DoubleSide})});
      skirt(hips,{top:1.025,bottom:.89,radius:.18,fold:.016,ruffle:.009,material:toon('#eee5e4',{side:T.DoubleSide})});
      skirt(hips,{top:1.001,bottom:.835,radius:.225,fold:.022,ruffle:.01,material:toon('#fff7eb',{side:T.DoubleSide})});
      band(hips,1.024,.112,.076,'#d6b477',.009);
      for(const s of [-1,1]){
        ball(torso,s*.136,1.365,-.002,.057,.016,.052,'#d7b767');
        for(let k=0;k<7;k++)tube(torso,[[s*(.108+k*.009),1.351,-.043],[s*(.11+k*.009),1.313,-.054]],.004,'#fff5e6');
      }
      for(let k=0;k<3;k++){
        ball(torso,-.049+k*.017,1.268,-.13,.006,.01,.003,'#dab767');
        tube(torso,[[-.056+k*.017,1.29,-.126],[-.049+k*.017,1.273,-.132]],.0028,'#dfbd6e');
      }
      tube(torso,[[-.065,1.294,-.128],[-.006,1.294,-.14]],.005,'#d9b269');
      for(const s of [-1,1])ball(torso,s*.055,1.017,-.091,.011,.013,.004,'#d6b477');
    } else if(skirtItem || (!swim && !bottom)){
      const p=skirtItem?.params||{},type=p.len||'short';
      const end=p.skirtY??({short:.78,knee:.62,midi:.40,long:.21}[type]||.74);
      const extraWaist=(p.fit?.waistEase||0)*.035+(p.fit?.ease||0)*.02;
      const radius=.17+(p.flare??.4)*.17+(p.fit?.hipEase||0)*.04+(p.fit?.ease||0)*.035;
      const fold=p.pleats?.014:.003+(1-(p.fit?.stretch??.5))*.006;
      skirt(hips,{bottom:end,waist:.095+extraWaist,radius,fold,material:skirtItem?fabric(skirtItem,cfg.renderStyle):toon('#f3dbe7',{side:T.DoubleSide})});
      if(p.lace||p.petticoat||p.tiers){
        const count=p.tiers||1;
        for(let i=0;i<count;i++){
          const y=end+.06+i*.07;
          skirt(hips,{top:y+.055,bottom:y,radius:radius-(i*.014),fold:.009,ruffle:.006,material:toon(p.lace||skirtItem.colors.trim||skirtItem.colors.main,{side:T.DoubleSide})});
        }
      }
      if(p.circuit){
        for(let i=0;i<16;i++){
          const a=i/16*Math.PI*2;
          const pts=[[Math.sin(a)*(radius-.025),end+.045,Math.cos(a)*(radius-.025)*.7+.009],[Math.sin(a)*radius,end+.015,Math.cos(a)*radius*.7+.009]];
          tube(hips,pts,.0025,p.circuit);
        }
      }
      band(hips,1.095,.098+extraWaist,.07+extraWaist*.7,skirtItem?.colors.trim||skirtItem?.colors.main||'#e9afc8',.008);
    } else if(swim?.params.skirt||swim?.params.bottom==='skirt'){
      skirt(hips,{top:.99,bottom:.85,radius:.165,fold:.015,ruffle:.007,material:fabric(swim,cfg.renderStyle)});
    }
    if(outer){
      const c=outer.colors;
      skirt(torso,{top:1.14,bottom:1.006,radius:.145,depth:.66,fold:.002,material:toon(c.main,{side:T.DoubleSide})});
      for(const s of [-1,1]){
        const lapel=new T.Shape();lapel.moveTo(s*.048,1.366);lapel.lineTo(s*.087,1.306);lapel.lineTo(s*.055,1.291);lapel.lineTo(s*.068,1.259);lapel.lineTo(s*.008,1.189);lapel.closePath();
        plaque(torso,lapel,-.126,c.main,.006,.003);
        tube(torso,[[s*.051,1.361,-.132],[s*.083,1.308,-.136],[s*.053,1.290,-.137],[s*.064,1.259,-.143],[s*.013,1.202,-.12]],.002,c.trim||c.main);
      }
      for(let y=1.05;y<1.20;y+=.062)ball(torso,0,y,-.104,.004,.004,.004,c.trim||'#cfaa75');
    }
    if(tux||top?.id==='top-tie')ribbon(torso,0,1.344,-.081,.035,'#292631');
    if(top?.id==='top-tie')for(const s of [-1,1])tube(torso,[[s*.01,1.33,-.09],[s*.022,1.26,-.136],[s*.035,1.23,-.129]],.006,'#292631');
    const p=dress?.params||top?.params||{};
    if(p.bow)ribbon(torso,0,p.bowAt==='waist'?1.10:1.326,p.bowAt==='waist'?-.089:-.105,.032,p.bow);
    if(p.belt||p.obi)band(hips,1.095,.105,.072,p.belt||p.obi,p.obi?.029:.012);
    if(p.collar){
      for(const s of [-1,1])ball(torso,s*.035,1.343,-.066,.038,.016,.025,dress?.colors.trim||'#fff6ed');
    }
    if(item('hat'))addHat(attach('head','hat'),item('hat'));
    if(item('hairacc'))addHairAccessory(attach('head','hairacc'),item('hairacc'));
    if(item('glasses'))addGlasses(attach('head','glasses'),item('glasses'));
    if(item('held'))addHeld(attach('rightHand','held'),item('held'),rest.rightHand);
    if(item('shoes'))for(const side of ['leftFoot','rightFoot'])addShoes(attach(side,'shoes'),item('shoes'),rest[side]);
    const wrist=item('wrist');
    if(wrist){
      const sides=wrist.params.style==='cuffs'?['leftHand','rightHand']:['leftHand'];
      for(const side of sides){
        const g=attach(side,'wrist'),r=rest[side];
        if(wrist.params.style==='cuffs'){
          const cuff=new T.Mesh(new T.CylinderGeometry(.032,.032,.045,24),toon(wrist.colors.main));
          cuff.rotation.z=Math.PI/2;cuff.position.copy(r);g.add(cuff);
          ball(g,r.x,r.y,r.z-.033,.006,.006,.003,wrist.colors.trim);
        }else{
          for(let i=0;i<10;i++){const a=i/10*Math.PI*2;ball(g,r.x,r.y+Math.sin(a)*.025,r.z+Math.cos(a)*.025,.008,.008,.008,['#ebbe60','#90bebe','#eb96b4','#8caacf'][i%4]);}
        }
      }
    }
    const neck=item('neck');
    if(neck){
      const g=attach('chest','neck');
      if(neck.params.style==='scarf'){
        band(g,1.391,.045,.039,neck.colors.main,.018);
        tube(g,[[.026,1.38,-.05],[.06,1.28,-.133],[.07,1.20,-.12]],.016,neck.colors.main);
      }else{
        const y=neck.params.style==='choker'?1.395:1.345;
        band(g,y,.04,.043,neck.colors.main,neck.params.style==='choker'?.008:.003);
        if(neck.params.style==='pearls')for(let i=0;i<16;i++){const a=i/16*Math.PI*2;ball(g,Math.sin(a)*.042,y,Math.cos(a)*.044,.005,.005,.005,neck.colors.main)}
        else ball(g,0,y-.012,-.045,.01,.012,.004,neck.colors.trim||neck.colors.main);
      }
    }
    // Front details sit on the fabric envelope, rather than inside its surface.
    for(const mesh of torso.children){
      if(!mesh.isMesh||mesh.userData.skirt)continue;
      if(mesh.position.z<-.03)mesh.position.z-=.027;
      else if(mesh.geometry){
        mesh.geometry.computeBoundingBox();
        if(mesh.geometry.boundingBox.max.z<-.03)mesh.geometry.translate(0,0,-.026);
      }
    }
  }
  return {build,get groups(){return groups;}};
}
