import * as THREE from "three";

const state = { active: null };

function hasRenderableMesh(object) {
  let found = false;
  object?.traverse?.(child => {
    if (child.isMesh || child.isInstancedMesh || child.isSkinnedMesh) found = true;
  });
  return found;
}

function isImportedRoot(object) {
  if (!object?.isGroup || !hasRenderableMesh(object)) return false;
  const name = String(object.name || "").toUpperCase();
  return Boolean(
    object.userData?.sourceModelUrl ||
    object.userData?.forgeImageAsset ||
    name.includes("ATLAS_FORGE") ||
    name.includes("FORGE_IMAGE_3D") ||
    name.includes("FORGE_SAVED_IMAGE_ASSET")
  );
}

function sourceText(group) {
  const imagePrompt = document.getElementById("img3d-prompt")?.value || "";
  const fileName = document.getElementById("img3d-file")?.files?.[0]?.name || "";
  return `${imagePrompt} ${fileName} ${group.name || ""} ${group.userData?.forgeHint || ""}`.toLowerCase();
}

function boundsOf(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  return {
    box,
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
  };
}

function classify(group, size) {
  const text = sourceText(group);
  if (/personagem|character|human|humano|homem|mulher|zumbi|zombie|criatura|creature|survivor|sobrevivente/.test(text)) return "character humano personagem";
  if (/espada|sword|machado|axe|arma|weapon|pistola|gun|faca|knife/.test(text)) return "weapon arma attack";
  if (/baú|bau|chest|caixa|crate|barrel|barril/.test(text)) return "prop chest bau open";
  if (/carro|car|vehicle|veículo|veiculo|drone/.test(text)) return "vehicle veiculo hover";
  const horizontal = Math.max(size.x, size.z, 0.001);
  if (size.y / horizontal >= 1.38) return "character humano personagem imported";
  return "prop item imported";
}

function rotateLongestAxisUp(group) {
  let { size } = boundsOf(group);
  if (size.x > size.y * 1.18 && size.x >= size.z) {
    group.rotateZ(Math.PI / 2);
  } else if (size.z > size.y * 1.18 && size.z > size.x) {
    group.rotateX(-Math.PI / 2);
  }
  group.updateMatrixWorld(true);
}

function fitAndGround(group) {
  let data = boundsOf(group);
  const hint = classify(group, data.size);
  const isCharacter = /character|personagem|humano/.test(hint);
  const reference = isCharacter ? data.size.y : Math.max(data.size.x, data.size.y, data.size.z);
  const target = isCharacter ? 1.72 : 1.45;
  if (reference > 0.0001) group.scale.multiplyScalar(target / reference);

  data = boundsOf(group);
  group.position.x -= data.center.x;
  group.position.z -= data.center.z;
  group.position.y -= data.box.min.y;
  group.updateMatrixWorld(true);

  group.userData.forgeHint = hint;
  group.userData.forgeImageAsset = true;
  group.userData.forgeImportNormalized = true;
  const label = document.getElementById("current-label");
  if (label) label.textContent = `${isCharacter ? "CHARACTER" : hint.includes("weapon") ? "WEAPON" : "PROP"} • IMAGE 3D • ${isCharacter ? "IDLE / WALK / ATTACK / DEATH" : hint.includes("weapon") ? "IDLE / ATTACK" : hint.includes("open") ? "IDLE / OPEN" : "IDLE / FLOAT"}`;
}

function normalize(group, force = false) {
  if (!group || (!force && group.userData?.forgeImportNormalized)) return;
  if (force) {
    group.rotation.set(0, 0, 0);
    group.position.set(0, 0, 0);
  }
  rotateLongestAxisUp(group);
  fitAndGround(group);
}

function removePreviousAssets(scene, incoming) {
  for (const child of [...scene.children]) {
    if (child === incoming) continue;
    if (child.isGroup && hasRenderableMesh(child)) scene.remove(child);
  }
}

function addOrientationControls() {
  const host = document.querySelector(".view-controls");
  if (!host || document.getElementById("btn-import-upright")) return;

  const upright = document.createElement("button");
  upright.id = "btn-import-upright";
  upright.className = "mini-btn";
  upright.textContent = "EM PÉ";
  upright.title = "Tentar colocar o modelo importado em pé";
  upright.addEventListener("click", () => {
    if (!state.active) return;
    state.active.userData.forgeImportNormalized = false;
    normalize(state.active, true);
  });

  const rotateX = document.createElement("button");
  rotateX.className = "mini-btn";
  rotateX.textContent = "GIRAR X";
  rotateX.addEventListener("click", () => {
    if (!state.active) return;
    state.active.rotateX(Math.PI / 2);
    fitAndGround(state.active);
  });

  const rotateZ = document.createElement("button");
  rotateZ.className = "mini-btn";
  rotateZ.textContent = "GIRAR Z";
  rotateZ.addEventListener("click", () => {
    if (!state.active) return;
    state.active.rotateZ(Math.PI / 2);
    fitAndGround(state.active);
  });

  host.append(upright, rotateX, rotateZ);
}

const originalAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function (...objects) {
  for (const object of objects) {
    if (!isImportedRoot(object)) continue;
    removePreviousAssets(this, object);
    normalize(object);
    state.active = object;
    requestAnimationFrame(addOrientationControls);
  }
  return originalAdd.apply(this, objects);
};

document.addEventListener("DOMContentLoaded", addOrientationControls);
