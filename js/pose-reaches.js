// 3D wrist targets and elbow poles in raw VRM rest space (front is -Z).
// X is outward distance and is mirrored for the two screen sides.
const reach=(target,pole)=>({target,pole});
const down=reach([.195,.960,-.046],[.165,1.175,.025]);
const hip=reach([.15,1.11,-.105],[.34,1.19,-.035]);
const both=r=>({L:r,R:r});
export const REACHES = {
  stand:both(down),
  elegant:{L:down,R:reach([.192,.972,-.058],[.17,1.18,.018])},
  ready:both(reach([.215,.964,-.045],[.185,1.18,.016])),
  reserved:both(reach([.135,1.05,-.185],[.24,1.20,-.07])),
  wave:{L:down,R:reach([.27,1.665,-.085],[.36,1.43,-.06])},
  shy:both(reach([.044,1.045,-.16],[.26,1.19,-.065])),
  behind:both(reach([.065,1.06,.17],[.28,1.20,.10])),
  peace:{L:down,R:reach([.175,1.535,-.16],[.33,1.35,-.09])},
  salute:{L:down,R:reach([.13,1.60,-.13],[.34,1.42,-.07])},
  hips:both(hip),
  stretch:both(reach([.145,1.785,-.055],[.28,1.63,-.02])),
  heart:both(reach([.042,1.30,-.24],[.29,1.23,-.065])),
  think:{L:down,R:reach([.065,1.49,-.19],[.29,1.22,-.075])},
  cheer:both(reach([.275,1.705,-.065],[.35,1.52,-.03])),
  curtsy:both(reach([.245,1.01,-.12],[.30,1.20,-.065])),
  sit:both(reach([.17,1.10,-.29],[.30,1.22,-.12])),
  sleep:both(reach([.055,1.11,-.29],[.27,1.22,-.12])),
  admire:both(reach([.29,1.055,-.09],[.32,1.24,-.03])),
  dangle:both(reach([.41,1.21,-.045],[.32,1.34,-.015])),
  hop:both(reach([.39,1.25,-.065],[.34,1.36,-.03])),
  spin:both(reach([.44,1.32,-.055],[.33,1.35,-.015])),
  shape:both(reach([.36,1.025,-.035],[.235,1.20,-.03])),
};

export function reachFor(id,side,holding=false){
  const r=holding&&side==='L'&&REACHES[id]?.L===down
    ?reach([.21,1.15,-.23],[.32,1.22,-.08]):(REACHES[id]||REACHES.stand)[side];
  const sign=side==='L'?1:-1;
  return {tx:sign*r.target[0],ty:r.target[1],tz:r.target[2],px:sign*r.pole[0],py:r.pole[1],pz:r.pole[2]};
}
