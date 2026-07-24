import * as THREE from "three";

function q(x=0,y=0,z=0){
  const quat = new THREE.Quaternion();
  quat.setFromEuler(new THREE.Euler(x,y,z));
  return [quat.x,quat.y,quat.z,quat.w];
}

function quatTrack(target, times, eulers){
  return new THREE.QuaternionKeyframeTrack(
    `${target}.quaternion`,
    times,
    eulers.flatMap(v=>q(v[0],v[1],v[2]))
  );
}

function vectorTrack(target, property, times, values){
  return new THREE.VectorKeyframeTrack(`${target}.${property}`, times, values.flat());
}

export function inferAnimationPreset(group, hint=""){
  const text = `${hint} ${group?.userData?.forgeHint || ""}`.toLowerCase();
  if(/human|humano|character|personagem|zombie|zumbi|survivor|sobrevivente|creature|criatura/.test(text)) return "character";
  if(/chest|baú|bau|crate|caixa|barrel|barril|open/.test(text)) return "open";
  if(/tree|árvore|arvore|pine|oak|mushroom|nature|natureza/.test(text)) return "wind";
  if(/sword|axe|gun|weapon|espada|machado|arma|pistola|faca|knife/.test(text)) return "attack";
  if(/vehicle|car|veículo|veiculo|drone|ship|carro/.test(text)) return "hover";
  if(/gem|potion|poção|pocao|crystal|magic|mágic|magico/.test(text)) return "pulse";
  return "float";
}

function rootName(group){
  if(!group.name) group.name = "FORGE_ASSET";
  return group.name;
}

function genericClip(group, preset){
  const target = rootName(group);
  const basePos = group.position.toArray();
  const baseScale = group.scale.toArray();

  if(preset === "wind"){
    return new THREE.AnimationClip("Wind", 3.2, [
      quatTrack(target,[0,0.8,1.6,2.4,3.2],[[0,0,-0.06],[0.02,0,0.07],[0,0,-0.04],[-0.02,0,0.06],[0,0,-0.06]])
    ]);
  }

  if(preset === "attack"){
    return new THREE.AnimationClip("Attack", 1.35, [
      quatTrack(target,[0,0.25,0.48,0.72,1.35],[[0,0,-0.12],[0,0,-0.62],[0,0,0.8],[0,0,0.12],[0,0,-0.12]])
    ]);
  }

  if(preset === "open"){
    return new THREE.AnimationClip("Open", 1.4, [
      quatTrack(target,[0,0.25,0.65,1.05,1.4],[[0,0,0],[-0.08,0,0],[-0.24,0,0],[-0.08,0,0],[0,0,0]]),
      vectorTrack(target,"position",[0,0.35,0.7,1.05,1.4],[
        basePos,
        [basePos[0],basePos[1]+0.025,basePos[2]],
        [basePos[0],basePos[1]+0.055,basePos[2]],
        [basePos[0],basePos[1]+0.025,basePos[2]],
        basePos
      ])
    ]);
  }

  if(preset === "hover"){
    return new THREE.AnimationClip("Hover", 2.4, [
      vectorTrack(target,"position",[0,0.6,1.2,1.8,2.4],[
        basePos,
        [basePos[0],basePos[1]+0.055,basePos[2]],
        basePos,
        [basePos[0],basePos[1]-0.025,basePos[2]],
        basePos
      ]),
      quatTrack(target,[0,1.2,2.4],[[0,-0.07,0],[0,0.07,0],[0,-0.07,0]])
    ]);
  }

  if(preset === "pulse"){
    return new THREE.AnimationClip("Pulse", 1.8, [
      vectorTrack(target,"scale",[0,0.45,0.9,1.35,1.8],[
        baseScale,
        baseScale.map(v=>v*1.07),
        baseScale,
        baseScale.map(v=>v*0.97),
        baseScale
      ]),
      quatTrack(target,[0,0.9,1.8],[[0,0,0],[0,Math.PI,0],[0,Math.PI*2,0]])
    ]);
  }

  return new THREE.AnimationClip("Float", 2.2, [
    vectorTrack(target,"position",[0,0.55,1.1,1.65,2.2],[
      basePos,
      [basePos[0],basePos[1]+0.035,basePos[2]],
      basePos,
      [basePos[0],basePos[1]-0.018,basePos[2]],
      basePos
    ]),
    quatTrack(target,[0,1.1,2.2],[[0,-0.05,0],[0,0.05,0],[0,-0.05,0]])
  ]);
}

function characterClips(group){
  const clips = [];
  const root = rootName(group);
  const basePos = group.position.toArray();

  clips.push(new THREE.AnimationClip("Idle",2.4,[
    quatTrack(root,[0,0.6,1.2,1.8,2.4],[[0,-0.025,0],[0.015,0.02,0],[0,0.025,0],[-0.015,0.01,0],[0,-0.025,0]]),
    vectorTrack(root,"position",[0,0.6,1.2,1.8,2.4],[
      basePos,
      [basePos[0],basePos[1]+0.012,basePos[2]],
      basePos,
      [basePos[0],basePos[1]+0.01,basePos[2]],
      basePos
    ]),
    quatTrack("Spine",[0,0.6,1.2,1.8,2.4],[[0,0,-0.025],[0.025,0,0.02],[0,0,-0.025],[-0.02,0,0.02],[0,0,-0.025]]),
    quatTrack("Head",[0,1.2,2.4],[[0,-0.035,0],[0,0.035,0],[0,-0.035,0]])
  ]));

  clips.push(new THREE.AnimationClip("Walk",1.0,[
    quatTrack(root,[0,0.25,0.5,0.75,1],[[0,-0.035,0],[0,0.035,0],[0,-0.035,0],[0,0.035,0],[0,-0.035,0]]),
    quatTrack("Thigh_L",[0,0.25,0.5,0.75,1],[[0.42,0,0],[0,0,0],[-0.42,0,0],[0,0,0],[0.42,0,0]]),
    quatTrack("Thigh_R",[0,0.25,0.5,0.75,1],[[-0.42,0,0],[0,0,0],[0.42,0,0],[0,0,0],[-0.42,0,0]]),
    quatTrack("UpperArm_L",[0,0.25,0.5,0.75,1],[[-0.32,0,0],[0,0,0],[0.32,0,0],[0,0,0],[-0.32,0,0]]),
    quatTrack("UpperArm_R",[0,0.25,0.5,0.75,1],[[0.32,0,0],[0,0,0],[-0.32,0,0],[0,0,0],[0.32,0,0]]),
    vectorTrack(root,"position",[0,0.25,0.5,0.75,1],[
      basePos,
      [basePos[0],basePos[1]+0.026,basePos[2]],
      basePos,
      [basePos[0],basePos[1]+0.026,basePos[2]],
      basePos
    ])
  ]));

  clips.push(new THREE.AnimationClip("Attack",0.95,[
    quatTrack(root,[0,0.22,0.48,0.72,0.95],[[0,0,0],[0,-0.22,0],[0,0.38,0],[0,0.1,0],[0,0,0]]),
    vectorTrack(root,"position",[0,0.22,0.48,0.72,0.95],[
      basePos,
      [basePos[0],basePos[1],basePos[2]-0.045],
      [basePos[0],basePos[1],basePos[2]+0.085],
      [basePos[0],basePos[1],basePos[2]+0.025],
      basePos
    ]),
    quatTrack("Spine",[0,0.22,0.48,0.72,0.95],[[0,0,0],[0,-0.2,0],[0,0.32,0],[0,0.08,0],[0,0,0]]),
    quatTrack("UpperArm_R",[0,0.22,0.48,0.72,0.95],[[0,0,-0.15],[-0.65,0,-0.4],[0.85,0,0.2],[0.15,0,0],[0,0,-0.15]])
  ]));

  clips.push(new THREE.AnimationClip("Death",1.5,[
    quatTrack(root,[0,0.55,1.1,1.5],[[0,0,0],[0,0,0.18],[0,0,1.1],[0,0,1.48]]),
    vectorTrack(root,"position",[0,0.55,1.1,1.5],[
      basePos,
      [basePos[0],basePos[1]+0.02,basePos[2]],
      [basePos[0],basePos[1]+0.01,basePos[2]],
      basePos
    ]),
    quatTrack("Head",[0,0.75,1.5],[[0,0,0],[0.45,0,0],[0.7,0,0]])
  ]));

  return clips;
}

export function buildAnimationClips(group, hint=""){
  if(!group) return [];
  const preset = inferAnimationPreset(group,hint);
  const hasRig = Boolean(group.getObjectByName("FORGE_RIG_ROOT"));
  if(hasRig || preset === "character") return characterClips(group);
  if(preset === "open") return [genericClip(group,"open"), genericClip(group,"float")];
  if(preset === "attack") return [genericClip(group,"attack"), genericClip(group,"float")];
  return [genericClip(group,preset)];
}
