import * as THREE from "three";

window.FORGE_EXPORT_ANIMATED = true;

const state = {
  activeGroup: null,
  enabled: true,
  mode: "auto",
  startedAt: performance.now(),
  base: null,
  label: ""
};

function snapshot(group){
  return {
    position: group.position.clone(),
    rotation: group.rotation.clone(),
    scale: group.scale.clone()
  };
}

function persistBase(group, base){
  if(!group || !base) return;
  group.userData.forgeBaseTransform = {
    position: base.position.toArray(),
    rotation: [base.rotation.x,base.rotation.y,base.rotation.z,base.rotation.order],
    scale: base.scale.toArray()
  };
}

function restore(){
  const group = state.activeGroup;
  const base = state.base;
  if(!group || !base) return;
  group.position.copy(base.position);
  group.rotation.copy(base.rotation);
  group.scale.copy(base.scale);
}

function setActiveGroup(group){
  if(!group || group === state.activeGroup) return;
  restore();
  state.activeGroup = group;
  state.base = snapshot(group);
  persistBase(group,state.base);
  state.startedAt = performance.now();
  requestAnimationFrame(()=>{
    state.label = (document.getElementById("current-label")?.textContent || "").toLowerCase();
    group.userData.forgeHint = state.label;
    group.userData.forgeAnimationMode = resolveMode();
    if(!group.name) group.name = "FORGE_ASSET";
  });
}

const originalSceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function(...objects){
  const result = originalSceneAdd.apply(this, objects);
  for(const object of objects){
    if(object?.isGroup && object.children?.length){
      setActiveGroup(object);
    }
  }
  return result;
};

function resolveMode(){
  if(state.mode !== "auto") return state.mode;
  const label = state.label;
  if(/human|zombie|character|personagem|humano|zumbi/.test(label)) return "idle";
  if(/tree|árvore|arvore|pine|oak|mushroom|nature/.test(label)) return "sway";
  if(/sword|axe|gun|weapon|espada|machado|arma/.test(label)) return "attack";
  if(/vehicle|car|veículo|veiculo|drone/.test(label)) return "hover";
  if(/gem|potion|poção|pocao|crystal|magic/.test(label)) return "pulse";
  return "float";
}

function animateGroup(now){
  const group = state.activeGroup;
  const base = state.base;
  if(!group || !base) return;

  if(!state.enabled || state.mode === "none"){
    restore();
    return;
  }

  const t = (now - state.startedAt) / 1000;
  const mode = resolveMode();
  group.userData.forgeAnimationMode = mode;

  group.position.copy(base.position);
  group.rotation.copy(base.rotation);
  group.scale.copy(base.scale);

  if(mode === "idle"){
    group.position.y += Math.sin(t * 3.2) * 0.018;
    group.rotation.z += Math.sin(t * 1.6) * 0.025;
    group.rotation.y += Math.sin(t * 0.8) * 0.035;
  }else if(mode === "sway"){
    group.rotation.z += Math.sin(t * 1.25) * 0.07;
    group.rotation.x += Math.sin(t * 0.85) * 0.025;
  }else if(mode === "attack"){
    const phase = (t % 1.6) / 1.6;
    const strike = phase < 0.28 ? Math.sin((phase / 0.28) * Math.PI) : 0;
    group.rotation.z += strike * 0.72;
    group.rotation.y += Math.sin(t * 1.1) * 0.045;
  }else if(mode === "hover"){
    group.position.y += 0.05 + Math.sin(t * 2.1) * 0.035;
    group.rotation.y += Math.sin(t * 0.55) * 0.08;
  }else if(mode === "pulse"){
    const pulse = 1 + Math.sin(t * 3.4) * 0.045;
    group.scale.copy(base.scale).multiplyScalar(pulse);
    group.position.y += Math.sin(t * 2.2) * 0.025;
    group.rotation.y += t * 0.45;
  }else if(mode === "spin"){
    group.rotation.y += t * 0.9;
  }else{
    group.position.y += Math.sin(t * 2) * 0.03;
    group.rotation.y += Math.sin(t * 0.65) * 0.08;
  }
}

function installControls(){
  const host = document.querySelector(".view-controls");
  if(!host || document.getElementById("btn-motion")) return;

  const select = document.createElement("select");
  select.id = "select-motion";
  select.className = "mini-btn";
  select.title = "Tipo de movimento procedural";
  select.innerHTML = `
    <option value="auto">Movimento Auto</option>
    <option value="idle">Idle / Respiração</option>
    <option value="sway">Balanço / Vento</option>
    <option value="attack">Ataque</option>
    <option value="hover">Flutuar</option>
    <option value="pulse">Pulso mágico</option>
    <option value="spin">Girar asset</option>
    <option value="none">Sem movimento</option>`;

  const button = document.createElement("button");
  button.id = "btn-motion";
  button.className = "mini-btn active";
  button.textContent = "Movimento ON";
  button.title = "Ativar ou pausar o movimento do asset";

  const exportButton = document.createElement("button");
  exportButton.id = "btn-export-motion";
  exportButton.className = "mini-btn active";
  exportButton.textContent = "GLB Animado ON";
  exportButton.title = "Incluir clips de animação e rig procedural no arquivo GLB";

  select.addEventListener("change", ()=>{
    restore();
    state.mode = select.value;
    state.startedAt = performance.now();
    if(state.activeGroup) state.activeGroup.userData.forgeAnimationMode = resolveMode();
  });

  button.addEventListener("click", ()=>{
    state.enabled = !state.enabled;
    button.classList.toggle("active", state.enabled);
    button.textContent = state.enabled ? "Movimento ON" : "Movimento OFF";
    if(!state.enabled) restore();
    else state.startedAt = performance.now();
  });

  exportButton.addEventListener("click", ()=>{
    window.FORGE_EXPORT_ANIMATED = !window.FORGE_EXPORT_ANIMATED;
    exportButton.classList.toggle("active", window.FORGE_EXPORT_ANIMATED);
    exportButton.textContent = window.FORGE_EXPORT_ANIMATED ? "GLB Animado ON" : "GLB Animado OFF";
    const glbButton = document.getElementById("btn-export-glb");
    if(glbButton) glbButton.textContent = window.FORGE_EXPORT_ANIMATED ? "⬇️ .GLB ANIMADO" : "⬇️ .GLB";
  });

  host.prepend(exportButton);
  host.prepend(button);
  host.prepend(select);

  const glbButton = document.getElementById("btn-export-glb");
  if(glbButton) glbButton.textContent = "⬇️ .GLB ANIMADO";
}

function loop(now){
  animateGroup(now);
  requestAnimationFrame(loop);
}

installControls();
requestAnimationFrame(loop);
