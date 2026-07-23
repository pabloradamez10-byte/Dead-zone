import * as THREE from "three";
import { ensureProceduralRig } from "./rigging.js";
import { buildAnimationClips } from "./animationSystem.js";

const state = {
  activeGroup: null,
  clips: [],
  mixer: null,
  action: null,
  enabled: true,
  selectedClip: "",
  hint: ""
};

window.FORGE_EXPORT_ANIMATED = true;

function stopCurrent(){
  if(state.action){
    state.action.stop();
    state.action = null;
  }
  if(state.mixer && state.activeGroup){
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(state.activeGroup);
  }
  state.mixer = null;
}

function getHint(){
  return (document.getElementById("current-label")?.textContent || "").toLowerCase();
}

function updateClipUI(){
  const select = document.getElementById("select-clip");
  const badge = document.getElementById("clip-badge");
  if(!select || !badge) return;

  select.innerHTML = "";
  if(!state.clips.length){
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sem clips";
    select.appendChild(option);
    select.disabled = true;
    badge.textContent = "0 CLIPS";
    return;
  }

  select.disabled = false;
  for(const clip of state.clips){
    const option = document.createElement("option");
    option.value = clip.name;
    option.textContent = `${clip.name} (${clip.duration.toFixed(1)}s)`;
    select.appendChild(option);
  }

  state.selectedClip = state.clips[0].name;
  select.value = state.selectedClip;
  badge.textContent = `${state.clips.length} CLIP${state.clips.length === 1 ? "" : "S"} • ${state.clips.map(c=>c.name).join(" / ")}`;
}

function playClip(name){
  if(!state.activeGroup || !state.clips.length) return;
  const clip = state.clips.find(item=>item.name === name) || state.clips[0];
  state.selectedClip = clip.name;

  if(!state.mixer){
    state.mixer = new THREE.AnimationMixer(state.activeGroup);
  }
  if(state.action){
    state.action.stop();
  }

  const next = state.mixer.clipAction(clip);
  next.reset();
  next.setLoop(clip.name === "Death" ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = clip.name === "Death";
  next.play();
  next.paused = !state.enabled;
  state.action = next;

  const button = document.getElementById("btn-clip-play");
  if(button){
    button.classList.toggle("active", state.enabled);
    button.textContent = state.enabled ? "▶ Clip ON" : "⏸ Clip OFF";
  }
}

function prepareGroup(group){
  if(!group || group === state.activeGroup || !group.children?.length) return;
  stopCurrent();
  state.activeGroup = group;

  requestAnimationFrame(()=>{
    state.hint = getHint();
    group.userData.forgeHint = state.hint;
    ensureProceduralRig(group, state.hint);
    state.clips = buildAnimationClips(group, state.hint);
    group.userData.forgeAnimationClips = state.clips.map(clip=>clip.name);
    updateClipUI();
    playClip(state.clips[0]?.name);
  });
}

const originalSceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function(...objects){
  const result = originalSceneAdd.apply(this, objects);
  for(const object of objects){
    if(object?.isGroup && object.children?.length){
      prepareGroup(object);
    }
  }
  return result;
};

function installControls(){
  const host = document.querySelector(".view-controls");
  if(!host || document.getElementById("select-clip")) return;

  const badge = document.createElement("span");
  badge.id = "clip-badge";
  badge.className = "mini-btn active";
  badge.textContent = "0 CLIPS";
  badge.title = "Clips realmente embutidos no arquivo GLB";

  const select = document.createElement("select");
  select.id = "select-clip";
  select.className = "mini-btn";
  select.title = "Escolha o clip para visualizar";
  select.innerHTML = '<option value="">Aguardando asset...</option>';
  select.addEventListener("change", ()=> playClip(select.value));

  const playButton = document.createElement("button");
  playButton.id = "btn-clip-play";
  playButton.className = "mini-btn active";
  playButton.textContent = "▶ Clip ON";
  playButton.title = "Reproduzir ou pausar o clip selecionado";
  playButton.addEventListener("click", ()=>{
    state.enabled = !state.enabled;
    if(state.action) state.action.paused = !state.enabled;
    playButton.classList.toggle("active", state.enabled);
    playButton.textContent = state.enabled ? "▶ Clip ON" : "⏸ Clip OFF";
  });

  const exportButton = document.createElement("button");
  exportButton.id = "btn-export-animation";
  exportButton.className = "mini-btn active";
  exportButton.textContent = "GLB Animado ON";
  exportButton.title = "Incluir todos os clips no arquivo GLB exportado";
  exportButton.addEventListener("click", ()=>{
    window.FORGE_EXPORT_ANIMATED = window.FORGE_EXPORT_ANIMATED === false;
    const active = window.FORGE_EXPORT_ANIMATED !== false;
    exportButton.classList.toggle("active", active);
    exportButton.textContent = active ? "GLB Animado ON" : "GLB Animado OFF";
  });

  host.prepend(exportButton);
  host.prepend(playButton);
  host.prepend(select);
  host.prepend(badge);
}

const clock = new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const delta = Math.min(clock.getDelta(), 0.05);
  if(state.mixer && state.enabled){
    state.mixer.update(delta);
  }
}

installControls();
requestAnimationFrame(loop);
