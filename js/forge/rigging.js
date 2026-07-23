import * as THREE from "three";

const RIG_MARKER = "FORGE_RIG_ROOT";

function normalizedHint(hint=""){
  return String(hint).toLowerCase();
}

export function isCharacterAsset(group, hint=""){
  const text = `${normalizedHint(hint)} ${normalizedHint(group?.userData?.forgeHint)}`;
  return /character|personagem|human|humano|zombie|zumbi|survivor|sobrevivente/.test(text);
}

function makeBone(name, x, y, z){
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(x, y, z);
  return bone;
}

function classifyMesh(localCenter, bounds){
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const width = Math.max(bounds.max.x - bounds.min.x, 0.001);
  const y = (localCenter.y - bounds.min.y) / height;
  const x = (localCenter.x - (bounds.min.x + bounds.max.x) * 0.5) / width;

  if(y > 0.78) return "Head";
  if(y > 0.48 && Math.abs(x) > 0.22) return x < 0 ? "UpperArm_L" : "UpperArm_R";
  if(y < 0.43 && Math.abs(x) > 0.08) return x < 0 ? "Thigh_L" : "Thigh_R";
  if(y < 0.23) return x < 0 ? "Shin_L" : "Shin_R";
  if(y > 0.58) return "Chest";
  return "Hips";
}

export function ensureProceduralRig(group, hint=""){
  if(!group || !isCharacterAsset(group, hint)) return null;

  const existing = group.getObjectByName(RIG_MARKER);
  if(existing){
    return {
      root: existing,
      bones: Object.fromEntries(existing.userData.boneNames.map(name=>[name, group.getObjectByName(name)]).filter(([,bone])=>bone))
    };
  }

  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  if(size.y <= 0.001) return null;

  const center = bounds.getCenter(new THREE.Vector3());
  const minY = bounds.min.y;
  const h = size.y;
  const shoulder = Math.max(size.x * 0.24, h * 0.10);

  const root = makeBone(RIG_MARKER, center.x, minY, center.z);
  const hips = makeBone("Hips", 0, h * 0.38, 0);
  const spine = makeBone("Spine", 0, h * 0.16, 0);
  const chest = makeBone("Chest", 0, h * 0.15, 0);
  const head = makeBone("Head", 0, h * 0.18, 0);

  const upperArmL = makeBone("UpperArm_L", -shoulder, h * 0.02, 0);
  const forearmL = makeBone("Forearm_L", -shoulder * 0.95, 0, 0);
  const upperArmR = makeBone("UpperArm_R", shoulder, h * 0.02, 0);
  const forearmR = makeBone("Forearm_R", shoulder * 0.95, 0, 0);

  const thighL = makeBone("Thigh_L", -shoulder * 0.42, -h * 0.02, 0);
  const shinL = makeBone("Shin_L", 0, -h * 0.22, 0);
  const thighR = makeBone("Thigh_R", shoulder * 0.42, -h * 0.02, 0);
  const shinR = makeBone("Shin_R", 0, -h * 0.22, 0);

  root.add(hips);
  hips.add(spine, thighL, thighR);
  spine.add(chest);
  chest.add(head, upperArmL, upperArmR);
  upperArmL.add(forearmL);
  upperArmR.add(forearmR);
  thighL.add(shinL);
  thighR.add(shinR);

  const bones = {
    Hips: hips, Spine: spine, Chest: chest, Head: head,
    UpperArm_L: upperArmL, Forearm_L: forearmL,
    UpperArm_R: upperArmR, Forearm_R: forearmR,
    Thigh_L: thighL, Shin_L: shinL,
    Thigh_R: thighR, Shin_R: shinR
  };

  root.userData.boneNames = Object.keys(bones);
  root.userData.forgeRigVersion = 1;
  group.add(root);
  group.updateMatrixWorld(true);

  // Rig rígido para modelos low-poly segmentados: cada mesh é anexado ao osso
  // mais provável, preservando sua transformação mundial.
  const meshes = [];
  group.traverse(obj=>{
    if(obj.isMesh && !obj.userData.forgeRigAssigned) meshes.push(obj);
  });

  for(const mesh of meshes){
    const meshBox = new THREE.Box3().setFromObject(mesh);
    const worldCenter = meshBox.getCenter(new THREE.Vector3());
    const localCenter = group.worldToLocal(worldCenter.clone());
    const targetName = classifyMesh(localCenter, bounds);
    const targetBone = bones[targetName] || hips;
    targetBone.attach(mesh);
    mesh.userData.forgeRigAssigned = targetName;
  }

  group.userData.forgeRigged = true;
  group.userData.forgeRigType = "procedural-rigid-humanoid";
  group.updateMatrixWorld(true);
  return {root, bones};
}
