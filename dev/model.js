// Live renderer study, without behaviour timers. Query: ?look=captain&pose=salute
import { createAvatar } from '../js/avatar.js';
import { DEFAULT_BODY, DEFAULT_HEAD } from '../js/looks.js';
import { COLLECTIONS } from '../js/collections.js';
import { POSES, resolvePose } from '../js/poses.js';
import { ARCHETYPES } from '../js/archetypes.js';
const params=new URLSearchParams(location.search);
const collection=COLLECTIONS.find(c=>c.id===params.get('look'))||COLLECTIONS[0];
const archetype=ARCHETYPES.find(a=>a.id===params.get('archetype'));
const doll=createAvatar(document.querySelector('#doll'));
let cfg={body:{...DEFAULT_BODY,...archetype?.body,...(archetype?{archetype:archetype.id}:{})},head:{...DEFAULT_HEAD,...collection.head},outfit:{...collection.outfit},renderStyle:params.get('finish')||'anime3d'};
let pose=POSES[params.get('pose')]||POSES[archetype?.pose]||POSES.stand,turn={front:0,profile:Math.PI/2,back:Math.PI}[params.get('view')]||0;
function build(next){cfg=structuredClone(next);doll.build(cfg);setPose(pose.id);}
function setPose(id){pose=POSES[id]||POSES.stand;doll.setPoseLook({hands:pose.hands,bands:pose.band});doll.setProp(pose.prop);doll.setExpression(pose.expr);}
function step(){const target=resolvePose(doll.M,pose);doll.render({bones:target.bones,root:{x:0,y:target.rootY,turnY:turn}},{yaw:0,pitch:0,look:{x:0,y:0}});}
build(cfg);await doll.ready;
window.study={doll,build,setPose,step,get cfg(){return cfg;},set turn(value){turn=value;}};
function tick(){step();requestAnimationFrame(tick)}tick();window.ready=true;
