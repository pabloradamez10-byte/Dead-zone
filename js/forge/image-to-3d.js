import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { exportGLB } from "./exporter.js";

const COLAB_URL = "https://colab.research.google.com/github/pabloradamez10-byte/Dead-zone/blob/main/notebooks/atlas-forge-engine-0.6-api.ipynb";
const IMAGE_LIBRARY_KEY = "forge_image_library_v1";
const DB_NAME = "forge3d-assets";
const DB_STORE = "image3d-glb";

const state = {
  scene: null,
  group: null,
  image: null,
  file: null,
  fileName: "image_asset",
  engineBase: (localStorage.getItem("atlas_forge_engine_base") || "").replace(/\/$/, ""),
  drafts: new Map(),
};

const previousAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function (...objects) {
  state.scene = this;
  return previousAdd.apply(this, objects);
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeCurrent() {
  if (state.group?.parent) state.group.parent.remove(state.group);
  state.group = null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function imageData(img, resolution) {
  const canvas = document.createElement("canvas");
  const aspect = img.width / img.height;
  canvas.width = aspect >= 1 ? resolution : Math.max(12, Math.round(resolution * aspect));
  canvas.height = aspect >= 1 ? Math.max(12, Math.round(resolution / aspect)) : resolution;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

function buildRelief(img, { resolution = 52, depth = 0.18, threshold = 20 } = {}) {
  const { canvas, data } = imageData(img, resolution);
  const cols = canvas.width;
  const rows = canvas.height;
  const cell = 1 / Math.max(cols, rows);
  const geometry = new THREE.BoxGeometry(cell * 0.98, cell * 0.98, 1);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05 });
  let count = 0;
  for (let i = 0; i < data.data.length; i += 4) if (data.data[i + 3] >= threshold) count++;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let n = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data.data[i] / 255;
      const g = data.data[i + 1] / 255;
      const b = data.data[i + 2] / 255;
      const a = data.data[i + 3];
      if (a < threshold) continue;
      const lum = (r + g + b) / 3;
      const d = Math.max(0.035, depth * (0.35 + lum * 0.9));
      dummy.position.set((x - (cols - 1) / 2) * cell, ((rows - 1) / 2 - y) * cell, d / 2);
      dummy.scale.set(1, 1, d);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      color.setRGB(r, g, b, THREE.SRGBColorSpace);
      mesh.setColorAt(n, color);
      n++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const group = new THREE.Group();
  group.name = "FORGE_IMAGE_3D";
  group.userData.forgeHint = "image relief";
  group.add(mesh);
  group.scale.setScalar(1.35 / Math.max(cols * cell, rows * cell));
  group.rotation.x = -0.12;
  return group;
}

function loadExternalModel(url) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => loader.load(url, gltf => resolve(gltf.scene), undefined, reject));
}

function loadModelBuffer(buffer) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => loader.parse(buffer, "", gltf => resolve(gltf.scene), reject));
}

function showGroup(group) {
  removeCurrent();
  state.group = group;
  if (!state.scene) throw new Error("Cena 3D ainda não foi inicializada.");
  state.scene.add(group);
}

function setStatus(text, kind = "") {
  const el = document.getElementById("img3d-status");
  if (el) {
    el.textContent = text;
    el.dataset.kind = kind;
  }
}

function setProgress(value) {
  const wrap = document.getElementById("img3d-progress");
  const bar = document.getElementById("img3d-progress-bar");
  if (!wrap || !bar) return;
  wrap.classList.toggle("hidden", value == null);
  if (value != null) bar.style.width = `${Math.max(3, Math.min(100, value))}%`;
}

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/$/, "").replace(/\/(image-to-3d|image-to-3d-status)$/, "");
}

function absoluteUrl(base, url) {
  return new URL(url, `${base}/`).href;
}

function countModelStats(group) {
  let verts = 0;
  let tris = 0;
  let meshes = 0;
  group.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    meshes++;
    const geometry = object.geometry;
    verts += geometry.attributes?.position?.count || 0;
    tris += geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((geometry.attributes?.position?.count || 0) / 3);
  });
  return { verts, tris, meshes };
}

function weightInfo(stats, sizeKB) {
  if (stats.tris > 80000 || sizeKB > 6000) return { label: "PESADO", level: "heavy" };
  if (stats.tris > 30000 || sizeKB > 2500) return { label: "MÉDIO", level: "medium" };
  return { label: "LEVE", level: "light" };
}

function serializeGroup(group) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(group, result => {
      if (result instanceof ArrayBuffer) resolve(result);
      else resolve(new TextEncoder().encode(JSON.stringify(result)).buffer);
    }, reject, { binary: true, onlyVisible: true });
  });
}

function captureViewer() {
  try {
    return document.getElementById("canvas-3d")?.toDataURL("image/webp", 0.72) || state.image?.src || "";
  } catch {
    return state.image?.src || "";
  }
}

function readImageLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMAGE_LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeImageLibrary(items) {
  localStorage.setItem(IMAGE_LIBRARY_KEY, JSON.stringify(items.slice(0, 60)));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function databasePut(id, buffer) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(buffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function databaseGet(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function databaseDelete(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function ensureLibraryZone() {
  const rightPanel = document.getElementById("right-panel");
  const existingGrid = document.getElementById("library-grid");
  if (!rightPanel || !existingGrid) return null;
  let zone = document.getElementById("image3d-library-zone");
  if (zone) return zone;
  zone = document.createElement("section");
  zone.id = "image3d-library-zone";
  zone.innerHTML = `
    <div class="image3d-zone-head"><div><b>AVALIAÇÃO 3D</b><span>Você decide o que será salvo</span></div><span id="image3d-zone-count">0</span></div>
    <div id="image3d-pending-list"></div>
    <div class="image3d-approved-title">ASSETS APROVADOS</div>
    <div id="image3d-approved-list"></div>`;
  rightPanel.insertBefore(zone, existingGrid);
  return zone;
}

function escapeText(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function assetCard(item, pending) {
  const weight = weightInfo(item.stats, item.sizeKB);
  const card = document.createElement("article");
  card.className = `image3d-asset-card ${pending ? "pending" : "approved"}`;
  card.dataset.id = item.id;
  card.innerHTML = `
    <div class="image3d-card-thumb"><img src="${item.thumbnail || ""}" alt="Prévia do asset"></div>
    <div class="image3d-card-body">
      <div class="image3d-card-top"><strong>${escapeText(item.name)}</strong><span class="asset-weight ${weight.level}">${weight.label}</span></div>
      <div class="image3d-card-source">${pending ? "PRÉVIA — NÃO SALVA" : "SALVO"} • ${escapeText(item.engine)}</div>
      <div class="image3d-card-stats"><span>${item.stats.verts.toLocaleString("pt-BR")} verts</span><span>${item.stats.tris.toLocaleString("pt-BR")} tris</span><span>${item.sizeKB.toLocaleString("pt-BR")} KB</span></div>
      <div class="image3d-card-actions">
        <button data-action="open">ABRIR</button>
        ${pending ? '<button data-action="optimize">OTIMIZAR</button><button class="approve" data-action="save">SALVAR</button><button class="danger" data-action="discard">DESCARTAR</button>' : '<button class="danger" data-action="delete">EXCLUIR</button>'}
      </div>
    </div>`;
  card.addEventListener("click", async event => {
    const action = event.target.closest("button")?.dataset.action;
    if (!action) return;
    try {
      if (action === "open") await openAsset(item.id, pending);
      if (action === "optimize") await optimizeDraft(item.id);
      if (action === "save") await saveDraft(item.id);
      if (action === "discard") discardDraft(item.id);
      if (action === "delete") await deleteApproved(item.id);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Falha ao trabalhar com o asset.", "error");
    }
  });
  return card;
}

function renderImageLibrary() {
  if (!ensureLibraryZone()) return;
  const pendingList = document.getElementById("image3d-pending-list");
  const approvedList = document.getElementById("image3d-approved-list");
  const count = document.getElementById("image3d-zone-count");
  const pending = [...state.drafts.values()];
  const approved = readImageLibrary();
  pendingList.innerHTML = "";
  approvedList.innerHTML = "";
  pending.forEach(item => pendingList.appendChild(assetCard(item, true)));
  approved.forEach(item => approvedList.appendChild(assetCard(item, false)));
  if (!pending.length) pendingList.innerHTML = '<p class="image3d-empty">Nenhum modelo aguardando avaliação.</p>';
  if (!approved.length) approvedList.innerHTML = '<p class="image3d-empty">Nenhum asset de imagem foi salvo.</p>';
  count.textContent = `${pending.length} avaliar • ${approved.length} salvos`;
}

async function createDraft(engine) {
  if (!state.group) return;
  setStatus("Preparando prévia para avaliação…", "loading");
  await sleep(120);
  const buffer = await serializeGroup(state.group);
  const stats = countModelStats(state.group);
  const id = `image3d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const draft = {
    id,
    name: state.fileName || "asset_image3d",
    engine,
    createdAt: Date.now(),
    thumbnail: captureViewer(),
    sizeKB: Math.max(1, Math.round(buffer.byteLength / 1024)),
    stats,
    buffer,
    group: state.group,
  };
  state.drafts.set(id, draft);
  renderImageLibrary();
  document.getElementById("image3d-library-zone")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setStatus("Modelo pronto para avaliação. Abra, otimize, salve ou descarte no painel da direita.", "ok");
}

async function openAsset(id, pending) {
  if (pending) {
    const draft = state.drafts.get(id);
    if (!draft) throw new Error("Esta prévia não está mais disponível.");
    showGroup(draft.group);
    setStatus("Prévia aberta no painel 3D. Ela ainda não foi salva.", "ok");
    return;
  }
  const inMemory = state.drafts.get(id);
  let buffer = inMemory?.buffer || await databaseGet(id);
  if (!buffer) throw new Error("O arquivo local deste asset não foi encontrado.");
  const group = await loadModelBuffer(buffer);
  group.name = "FORGE_SAVED_IMAGE_ASSET";
  showGroup(group);
  setStatus("Asset salvo aberto no painel 3D.", "ok");
}

async function optimizeDraft(id) {
  const draft = state.drafts.get(id);
  if (!draft) throw new Error("Prévia não encontrada.");
  setStatus("Aplicando otimização leve e segura…", "loading");
  draft.group.traverse(object => {
    if (!object.isMesh || !object.geometry || object.isSkinnedMesh || object.isInstancedMesh) return;
    const geometry = object.geometry.clone();
    try {
      const merged = mergeVertices(geometry, 0.0001);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      object.geometry.dispose();
      object.geometry = merged;
    } catch {
      geometry.dispose();
    }
  });
  draft.buffer = await serializeGroup(draft.group);
  draft.stats = countModelStats(draft.group);
  draft.sizeKB = Math.max(1, Math.round(draft.buffer.byteLength / 1024));
  draft.thumbnail = captureViewer();
  renderImageLibrary();
  setStatus("Otimização leve concluída sem remover textura. Confira e salve somente se aprovar.", "ok");
}

async function saveDraft(id) {
  const draft = state.drafts.get(id);
  if (!draft) throw new Error("Prévia não encontrada.");
  setStatus("Salvando asset aprovado no navegador…", "loading");
  await databasePut(id, draft.buffer);
  const approved = readImageLibrary().filter(item => item.id !== id);
  approved.unshift({
    id: draft.id,
    name: draft.name,
    engine: draft.engine,
    createdAt: draft.createdAt,
    thumbnail: draft.thumbnail,
    sizeKB: draft.sizeKB,
    stats: draft.stats,
  });
  writeImageLibrary(approved);
  state.drafts.delete(id);
  renderImageLibrary();
  setStatus("Asset aprovado e salvo na biblioteca local.", "ok");
}

function discardDraft(id) {
  state.drafts.delete(id);
  renderImageLibrary();
  setStatus("Prévia descartada. Nada foi salvo.", "ok");
}

async function deleteApproved(id) {
  if (!confirm("Excluir este asset aprovado da biblioteca?")) return;
  writeImageLibrary(readImageLibrary().filter(item => item.id !== id));
  await databaseDelete(id).catch(() => {});
  renderImageLibrary();
  setStatus("Asset excluído da biblioteca.", "ok");
}

async function connectEngine(baseOverride = "") {
  const input = document.getElementById("atlas-engine-url");
  const button = document.getElementById("atlas-connect");
  const base = normalizeBase(baseOverride || input?.value);
  if (!base) throw new Error("Abra o notebook 0.6 e conecte o motor.");
  if (button) button.disabled = true;
  setStatus("Testando conexão com o Atlas Forge Engine 0.6…", "loading");
  try {
    const response = await fetch(`${base}/`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error("O endereço não respondeu como Atlas Forge Engine.");
    if (String(result.version || "") !== "0.6") throw new Error(`Motor antigo detectado (${result.version || "sem versão"}). Abra o notebook 0.6.`);
    state.engineBase = base;
    localStorage.setItem("atlas_forge_engine_base", base);
    if (input) input.value = base;
    const badge = document.getElementById("atlas-connection");
    if (badge) {
      badge.textContent = "● CONECTADO — MOTOR 0.6";
      badge.dataset.connected = "true";
    }
    setStatus("Atlas Forge Colab 0.6 conectado. Já pode gerar o modelo completo.", "ok");
    return true;
  } finally {
    if (button) button.disabled = false;
  }
}

async function generateLocal() {
  if (!state.image) throw new Error("Escolha uma imagem primeiro.");
  setProgress(25);
  setStatus("Gerando com o motor gráfico local…", "loading");
  await sleep(80);
  const resolution = Number(document.getElementById("img3d-resolution").value || 52);
  const depth = Number(document.getElementById("img3d-depth").value || 18) / 100;
  showGroup(buildRelief(state.image, { resolution, depth }));
  setProgress(100);
  setTimeout(() => setProgress(null), 800);
}

async function pollColab(jobId) {
  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(attempt < 8 ? 2500 : 5000);
    const response = await fetch(`${state.engineBase}/image-to-3d-status/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || result.message || "Falha ao consultar o Colab.");
    const progress = Number(result.progress || Math.min(92, 10 + attempt * 2));
    setProgress(progress);
    setStatus(result.message || `Processando no Colab… ${progress}%`, "loading");
    if (result.modelUrl || ["done", "success", "completed", "succeeded"].includes(String(result.status).toLowerCase())) return result;
    if (["error", "failed", "cancelled"].includes(String(result.status).toLowerCase())) throw new Error(result.message || "O motor Colab falhou.");
  }
  throw new Error("O processamento demorou mais que o esperado.");
}

async function generateColab() {
  if (!state.file) throw new Error("Escolha uma imagem primeiro.");
  if (!state.engineBase) throw new Error("Abra o Atlas Forge 0.6 no Colab e conecte o motor.");
  const health = await fetch(`${state.engineBase}/`, { cache: "no-store" }).then(response => response.json()).catch(() => null);
  if (!health || String(health.version) !== "0.6") throw new Error("A sessão conectada ainda usa o motor antigo. Abra e rode o notebook 0.6.");
  const form = new FormData();
  form.append("image", state.file);
  form.append("quality", document.getElementById("img3d-quality").value);
  form.append("removeBackground", String(document.getElementById("img3d-remove-bg").checked));
  form.append("prompt", document.getElementById("img3d-prompt").value.trim());
  setProgress(5);
  setStatus("Enviando imagem para a GPU do Colab…", "loading");
  const response = await fetch(`${state.engineBase}/image-to-3d`, { method: "POST", body: form });
  let result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || result.message || `Colab respondeu ${response.status}.`);
  if (!result.modelUrl && result.jobId) result = await pollColab(result.jobId);
  if (!result.modelUrl) throw new Error("O motor não retornou o GLB.");
  const modelUrl = absoluteUrl(state.engineBase, result.modelUrl);
  setProgress(96);
  setStatus("Abrindo o GLB gerado…", "loading");
  const group = await loadExternalModel(modelUrl);
  group.name = "ATLAS_FORGE_COLAB_MODEL";
  group.userData.sourceModelUrl = modelUrl;
  showGroup(group);
  setProgress(100);
  setTimeout(() => setProgress(null), 1000);
}

function installStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .image3d-panel{border:1px solid rgba(170,255,0,.25)}.beta{font-size:9px;color:#aaff00}
    .engine-choice{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0}.engine-card{padding:10px!important;border:1px solid #334238!important;background:#111712!important;text-align:left!important;border-radius:9px!important}.engine-card.active{border-color:#aaff00!important}.engine-card b,.engine-card span{display:block}.engine-card b{font-size:10px}.engine-card span{font-size:9px;color:#849088;margin-top:4px}
    .colab-workflow{background:#0d120e;border:1px solid #2f4033;border-radius:9px;padding:9px;margin-bottom:9px}.colab-open{display:block;text-align:center;background:#202b22;color:#aaff00;border:1px solid #405344;padding:9px;border-radius:7px;text-decoration:none;font-size:10px;font-weight:700}.colab-step{font-size:10px;color:#9ca79f;padding:9px 2px}.connect-row{display:flex;gap:6px}.connect-row input{min-width:0}.connect-row button{width:auto!important;margin:0!important}.connection-state{font-size:9px;color:#879188;margin-top:7px}.connection-state[data-connected=true]{color:#aaff00}
    .img3d-drop{min-height:105px;border:1px dashed #405044;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;background:#0d120e;margin:8px 0}.img3d-drop img{display:none;width:100%;height:140px;object-fit:contain}.img3d-drop.has-image img{display:block}.img3d-drop.has-image span{display:none}.image3d-panel .hidden{display:none!important}.image3d-panel>button{width:100%;margin-top:7px}.img3d-check{font-size:11px}.img3d-progress{height:7px;background:#172018;border-radius:8px;overflow:hidden;margin:10px 0}.img3d-progress div{height:100%;width:3%;background:#aaff00;transition:width .35s}#img3d-status[data-kind=ok]{color:#aaff00}#img3d-status[data-kind=loading]{color:#ffd166}#img3d-status[data-kind=error]{color:#ff7b7b}
    #image3d-library-zone{border-top:1px solid #26352a;border-bottom:1px solid #26352a;padding:12px;margin:0 0 12px}.image3d-zone-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:9px}.image3d-zone-head b,.image3d-zone-head span{display:block}.image3d-zone-head b{font-size:11px;color:#aaff00}.image3d-zone-head div span{font-size:9px;color:#859188;margin-top:2px}.image3d-zone-head>span{font-size:9px;color:#b3bdb5}.image3d-approved-title{font-size:9px;color:#78857c;margin:12px 0 7px}
    .image3d-asset-card{display:grid;grid-template-columns:72px 1fr;gap:8px;background:#0d120e;border:1px solid #2a382d;border-radius:9px;padding:7px;margin-bottom:7px}.image3d-asset-card.pending{border-color:#8e7a24}.image3d-asset-card.approved{border-color:#36543c}.image3d-card-thumb{height:72px;border-radius:6px;overflow:hidden;background:#080b09}.image3d-card-thumb img{width:100%;height:100%;object-fit:cover}.image3d-card-top{display:flex;justify-content:space-between;gap:5px}.image3d-card-top strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:125px}.asset-weight{font-size:7px;padding:2px 4px;border-radius:4px}.asset-weight.light{color:#aaff00;background:#1d331f}.asset-weight.medium{color:#ffd166;background:#3a3117}.asset-weight.heavy{color:#ff8080;background:#3a1c1c}.image3d-card-source{font-size:8px;color:#909a92;margin:3px 0}.image3d-card-stats{display:flex;flex-wrap:wrap;gap:5px;font-size:8px;color:#aab3ac}.image3d-card-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.image3d-card-actions button{font-size:7px!important;padding:5px!important;width:auto!important;margin:0!important;border:1px solid #405044!important;background:#172019!important;color:#dce5de!important;border-radius:4px!important}.image3d-card-actions .approve{border-color:#6c982e!important;color:#aaff00!important}.image3d-card-actions .danger{border-color:#653838!important;color:#ff9494!important}.image3d-empty{font-size:9px;color:#68746c;margin:7px 0 10px}
  `;
  document.head.appendChild(style);
}

function install() {
  const host = document.getElementById("left-panel");
  if (!host || document.getElementById("image-to-3d-panel")) return;
  const panel = document.createElement("section");
  panel.id = "image-to-3d-panel";
  panel.className = "panel-section image3d-panel";
  panel.innerHTML = `
    <label class="section-label">📷 IMAGEM → 3D <span class="beta">ATLAS FORGE 0.6</span></label>
    <div class="engine-choice"><button class="engine-card active" data-engine="local"><b>🧊 MOTOR GRÁFICO</b><span>Rápido, local e sem Colab</span></button><button class="engine-card" data-engine="colab"><b>⚡ ATLAS FORGE COLAB</b><span>TripoSR com GPU e modelo completo</span></button></div>
    <input id="img3d-mode" type="hidden" value="local">
    <div id="colab-workflow" class="colab-workflow hidden"><a id="open-colab" class="colab-open" href="${COLAB_URL}" target="_blank" rel="noopener">1. ABRIR ATLAS FORGE 0.6 NO COLAB</a><div class="colab-step">2. Conecte a T4 GPU e execute as células.</div><div class="field"><label>CONEXÃO MANUAL DE RESERVA</label><div class="connect-row"><input id="atlas-engine-url" placeholder="https://....trycloudflare.com"><button id="atlas-connect">CONECTAR</button></div></div><div id="atlas-connection" class="connection-state">○ DESCONECTADO</div></div>
    <div class="img3d-drop" id="img3d-drop"><input id="img3d-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><img id="img3d-preview" alt="Prévia"><span>Toque para escolher PNG, JPG ou WEBP</span></div>
    <div id="colab-options" class="hidden"><div class="panel-grid"><div class="field"><label>QUALIDADE</label><select id="img3d-quality"><option value="fast">Rápida</option><option value="balanced" selected>Padrão</option><option value="high">Alta</option></select></div><div class="field"><label>INSTRUÇÃO</label><input id="img3d-prompt" placeholder="ex: personagem low poly"></div></div><label class="img3d-check"><input id="img3d-remove-bg" type="checkbox" checked> Remover fundo</label></div>
    <div id="local-options"><div class="panel-grid"><div class="field"><label>DETALHE</label><select id="img3d-resolution"><option value="36">Rápido</option><option value="52" selected>Equilibrado</option><option value="72">Detalhado</option></select></div><div class="field"><label>PROFUNDIDADE <span id="img3d-depth-value">18</span>%</label><input id="img3d-depth" type="range" min="4" max="45" value="18"></div></div></div>
    <div id="img3d-progress" class="img3d-progress hidden"><div id="img3d-progress-bar"></div></div><button id="img3d-generate" class="secondary-btn">✨ GERAR 3D DA IMAGEM</button><button id="img3d-export" class="export-btn primary" disabled>⬇️ EXPORTAR GLB</button><p id="img3d-status" class="hint">Escolha o motor e envie uma imagem.</p>`;
  host.insertBefore(panel, host.querySelector(".panel-section.small"));
  installStyles();
  ensureLibraryZone();
  renderImageLibrary();

  const mode = document.getElementById("img3d-mode");
  const cards = [...document.querySelectorAll(".engine-card")];
  cards.forEach(card => card.addEventListener("click", () => {
    cards.forEach(item => item.classList.remove("active"));
    card.classList.add("active");
    mode.value = card.dataset.engine;
    const colab = mode.value === "colab";
    document.getElementById("colab-workflow").classList.toggle("hidden", !colab);
    document.getElementById("colab-options").classList.toggle("hidden", !colab);
    document.getElementById("local-options").classList.toggle("hidden", colab);
    setStatus(colab ? "Abra o notebook 0.6 e rode as células." : "Motor gráfico local selecionado.");
  }));

  const engineInput = document.getElementById("atlas-engine-url");
  engineInput.value = state.engineBase;
  document.getElementById("atlas-connect").addEventListener("click", () => connectEngine().catch(error => setStatus(error.message, "error")));
  const params = new URLSearchParams(location.search);
  const autoBase = params.get("atlas_engine");
  if (autoBase) {
    engineInput.value = autoBase;
    history.replaceState({}, "", location.pathname);
    setTimeout(() => connectEngine(autoBase).catch(error => setStatus(error.message, "error")), 300);
  } else if (state.engineBase) {
    setTimeout(() => connectEngine(state.engineBase).catch(() => {
      localStorage.removeItem("atlas_forge_engine_base");
      state.engineBase = "";
    }), 300);
  }

  const fileInput = document.getElementById("img3d-file");
  const drop = document.getElementById("img3d-drop");
  const preview = document.getElementById("img3d-preview");
  const generate = document.getElementById("img3d-generate");
  const exportBtn = document.getElementById("img3d-export");
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    state.file = file;
    state.image = await loadImage(file);
    state.fileName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_") || "image_asset";
    preview.src = state.image.src;
    drop.classList.add("has-image");
    setStatus(`Imagem pronta: ${file.name}`);
  });
  document.getElementById("img3d-depth").addEventListener("input", event => {
    document.getElementById("img3d-depth-value").textContent = event.target.value;
  });
  generate.addEventListener("click", async () => {
    generate.disabled = true;
    exportBtn.disabled = true;
    try {
      if (mode.value === "colab") await generateColab();
      else await generateLocal();
      exportBtn.disabled = !state.group;
      await createDraft(mode.value === "colab" ? "Atlas Forge Colab" : "Motor gráfico local");
    } catch (error) {
      console.error(error);
      setProgress(null);
      setStatus(error.message || "Falha ao gerar.", "error");
    } finally {
      generate.disabled = false;
    }
  });
  exportBtn.addEventListener("click", async () => {
    if (!state.group) return;
    const result = await exportGLB(state.group, `${state.fileName}_image3d`);
    setStatus(`GLB exportado (${result.sizeKB} kb).`, "ok");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
else install();
