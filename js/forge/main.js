import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initGenerators, getGenerator, preprocessVoxel } from "./generators.js";
import { parsePrompt, listAllKeywords } from "./promptParser.js";
import { makeRNG, PALETTES, countStats, centeredGroup } from "./utils.js";
import { exportGLB, exportOBJ, exportSTL, screenshot } from "./exporter.js";

// DOM refs
const canvas = document.getElementById("canvas-3d");
const promptInput = document.getElementById("prompt-input");
const selectCategory = document.getElementById("select-category");
const selectStyle = document.getElementById("select-style");
const sliderComplexity = document.getElementById("slider-complexity");
const valComplexity = document.getElementById("val-complexity");
const inputSeed = document.getElementById("input-seed");
const btnRandomSeed = document.getElementById("btn-random-seed");
const btnGenerate = document.getElementById("btn-generate");
const btnGeneratePack = document.getElementById("btn-generate-pack");
const paletteEl = document.getElementById("palette");
const statVerts = document.getElementById("stat-verts");
const statTris = document.getElementById("stat-tris");
const statMeshes = document.getElementById("stat-meshes");
const statSize = document.getElementById("stat-size");
const btnExportGLB = document.getElementById("btn-export-glb");
const btnExportOBJ = document.getElementById("btn-export-obj");
const btnExportSTL = document.getElementById("btn-export-stl");
const btnScreenshot = document.getElementById("btn-screenshot");
const currentLabel = document.getElementById("current-label");
const btnWireframe = document.getElementById("btn-wireframe");
const btnAutoRotate = document.getElementById("btn-auto-rotate");
const btnResetCam = document.getElementById("btn-reset-cam");
const loadingOverlay = document.getElementById("loading-overlay");
const libraryGrid = document.getElementById("library-grid");
const libCount = document.getElementById("lib-count");
const libSearch = document.getElementById("lib-search");
const btnClearLib = document.getElementById("btn-clear-lib");
const btnHelp = document.getElementById("btn-help");
const modalHelp = document.getElementById("modal-help");
const btnCloseHelp = document.getElementById("btn-close-help");
const keywordsList = document.getElementById("keywords-list");

initGenerators(THREE);

// Three setup
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0b0f0c");
scene.fog = new THREE.Fog("#0b0f0c", 8, 18);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(1.8,1.2,1.6);

const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.08;
controls.minDistance=0.6;
controls.maxDistance=8;
controls.target.set(0,0.5,0);
controls.autoRotate=false;
controls.autoRotateSpeed=1.2;

let activePalette = "auto";
let autoRotateEnabled = true;
controls.autoRotate = autoRotateEnabled;

// lights
const ambient = new THREE.AmbientLight(0xffffff,0.45);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xc8e8ff, 0x2a3326, 0.5);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff,1.2);
dir.position.set(3,5,3);
dir.castShadow=true;
dir.shadow.mapSize.set(1024,1024);
scene.add(dir);
const rim = new THREE.DirectionalLight(0xaaff00,0.4);
rim.position.set(-3,2,-3);
scene.add(rim);

// ground
const groundGeo = new THREE.CircleGeometry(4,64);
const groundMat = new THREE.MeshStandardMaterial({color:"#121812", roughness:0.9, metalness:0.05});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x=-Math.PI/2;
ground.receiveShadow=true;
ground.position.y=0;
scene.add(ground);

const grid = new THREE.GridHelper(6,12,0x1e3325,0x1e3325);
grid.position.y=0.001;
scene.add(grid);

// asset holder
let currentGroup = null;
let currentConfig = null;
let wireframeEnabled=false;

function resize(){
  const vw = document.getElementById("viewport");
  if(!vw) return;
  const w = vw.clientWidth;
  const h = vw.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function setLoading(v){
  if(v) loadingOverlay.classList.remove("hidden");
  else loadingOverlay.classList.add("hidden");
}

let library = [];
try{
  library = JSON.parse(localStorage.getItem("forge_library")||"[]");
}catch{ library=[]; }

function saveLibrary(){
  try{ localStorage.setItem("forge_library", JSON.stringify(library.slice(0,100))); }catch{}
}

function getPaletteColors(key, rng, parsed){
  if(key==="auto"){
    if(parsed?.colors && parsed.colors.length>0) return parsed.colors;
    // pick based on hints
    if(parsed?.hints.icy) return PALETTES.ice;
    if(parsed?.hints.glowing) return PALETTES.cyber;
    if(parsed?.hints.rusty || parsed?.hints.metal) return PALETTES.deadzone;
    if(parsed?.hints.wood) return PALETTES.forest;
    // random palette weighted
    const keys = Object.keys(PALETTES).filter(k=>k!=="auto");
    const k = rng.pick(keys);
    return PALETTES[k];
  }
  return PALETTES[key] || PALETTES.deadzone;
}

function updateStats(group, sizeKB=0){
  const s = countStats(group);
  statVerts.textContent = s.verts;
  statTris.textContent = s.tris;
  statMeshes.textContent = s.meshes;
  if(sizeKB) statSize.textContent = sizeKB+"kb";
}

function centerAndFrame(group){
  const {size} = centeredGroup(group);
  // adjust camera to fit
  const centerY = 0.5;
  controls.target.set(0, centerY, 0);
  const maxDim = Math.max(size.x,size.y,size.z);
  const dist = maxDim*1.8 + 0.8;
  // keep current azimuth but move back
  const dirVec = camera.position.clone().sub(controls.target).normalize().multiplyScalar(dist);
  camera.position.copy(controls.target.clone().add(dirVec));
  camera.position.y = Math.max(camera.position.y, 0.6);
  controls.update();
}

async function generateFromPrompt(promptText, override={}){
  setLoading(true);
  await new Promise(r=> setTimeout(r, 80)); // micro tick for UI

  try{
    const parsed = parsePrompt(promptText || "caixa surpresa");
    const categorySel = override.category || selectCategory.value;
    let actualCategory = parsed.category;
    let actualType = parsed.type;
    if(categorySel !== "auto"){
      // if forced category, pick type within that category that matches or fallback random
      actualCategory = categorySel;
      // if parsed category matches forced, keep type, else pick fallback but try to keep keyword if it belongs
      const belongs = Object.keys((await import("./promptParser.js")).then? {}:{}); // dummy
      // simple: if parsed.category != forced, assign fallback type
      if(parsed.category !== actualCategory){
        // choose type that maybe still contains prompt substring? simpler pick first of map
        const {CATEGORY_FALLBACKS} = await import("./promptParser.js");
        actualType = CATEGORY_FALLBACKS[actualCategory] || actualType;
        // try to keep related if prompt contained type from new cat
        const {KEYWORDS} = await import("./promptParser.js");
        const typesInCat = KEYWORDS[actualCategory]||{};
        for(const [t, words] of Object.entries(typesInCat)){
          for(const w of words){
            if(parsed.text.includes(w.toLowerCase())){
              actualType = t;
              break;
            }
          }
        }
      }
    }

    if(override.type) actualType = override.type;

    const seed = override.seed !== undefined ? override.seed : parseInt(inputSeed.value)|| Math.floor(Math.random()*99999);
    const complexity = override.complexity || parseInt(sliderComplexity.value);
    const style = override.style || selectStyle.value;
    const paletteKey = override.palette || activePalette;

    const rng = makeRNG(seed);

    const paletteColors = getPaletteColors(paletteKey, rng, parsed);

    const opts = {
      seed,
      complexity,
      style,
      palette: paletteColors,
      colors: parsed.colors || (paletteColors?paletteColors.slice(0,3):null),
      hints: parsed.hints,
      scaleHint: parsed.scaleHint,
      type: actualType,
      category: actualCategory,
      prompt: promptText
    };

    const generatorFn = getGenerator(actualType);
    let group = generatorFn(rng, opts);
    group.traverse(o=>{
      if(o.isMesh){
        o.castShadow=true;
        o.receiveShadow=true;
      }
    });

    if(style==="voxel"){
      preprocessVoxel(group,rng);
    }

    // apply scale hint
    group.scale.multiplyScalar(opts.scaleHint);

    // clear previous
    if(currentGroup){
      scene.remove(currentGroup);
    }
    currentGroup = group;
    scene.add(currentGroup);
    centerAndFrame(currentGroup);
    const stats = countStats(currentGroup);
    updateStats(currentGroup);

    // approximate GLB size? quick compute later
    currentConfig = {
      prompt: promptText || `${actualType} ${actualCategory}`,
      category: actualCategory,
      type: actualType,
      seed,
      complexity,
      style,
      palette: paletteKey,
      timestamp: Date.now(),
      stats
    };
    currentLabel.textContent = `${actualType.toUpperCase()} • ${actualCategory} • seed ${seed} • ${style}`;

    // async estimate glb size + thumbnail
    setTimeout(async ()=>{
      try{
        // capture thumbnail first
        const thumb = renderer.domElement.toDataURL("image/webp",0.6);
        // add to library
        addToLibrary({
          ...currentConfig,
          thumbnail: thumb
        });
      }catch(e){}
      // estimate size
      try{
        const {GLTFExporter} = await import("three/addons/exporters/GLTFExporter.js");
        const exporter = new GLTFExporter();
        exporter.parse(currentGroup, (res)=>{
          let size=0;
          if(res instanceof ArrayBuffer) size = res.byteLength;
          else size = JSON.stringify(res).length;
          statSize.textContent = Math.round(size/1024)+"kb";
          if(library[0]) library[0].sizeKB = Math.round(size/1024);
          saveLibrary();
        }, ()=>{}, {binary:true});
      }catch{}
    }, 150);

    return group;

  } finally {
    setLoading(false);
  }
}

function addToLibrary(entry){
  entry.id = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  library.unshift(entry);
  if(library.length>120) library = library.slice(0,120);
  saveLibrary();
  renderLibrary();
}

function renderLibrary(filter=""){
  const q = filter.toLowerCase().trim();
  let list = library;
  if(q){
    list = library.filter(e=> (e.prompt+" "+e.type+" "+e.category).toLowerCase().includes(q));
  }
  libCount.textContent = `${list.length} assets`;
  libraryGrid.innerHTML="";
  for(const item of list){
    const card=document.createElement("div");
    card.className="lib-card";
    card.innerHTML=`
      <div class="thumb"><img src="${item.thumbnail||""}" alt=""/></div>
      <div class="meta"><strong title="${item.prompt}">${item.prompt||item.type}</strong><span>${item.type} • seed ${item.seed} • ${item.style}</span></div>
    `;
    card.addEventListener("click", ()=>{
      promptInput.value=item.prompt||item.type;
      inputSeed.value=item.seed;
      sliderComplexity.value=item.complexity;
      valComplexity.textContent=item.complexity;
      selectStyle.value=item.style;
      activePalette=item.palette||"auto";
      document.querySelectorAll(".color-dot").forEach(d=> d.classList.toggle("active", d.dataset.palette===activePalette));
      if(item.category) selectCategory.value=item.category;
      generateFromPrompt(item.prompt, {seed:item.seed, complexity:item.complexity, style:item.style, palette:item.palette, type:item.type, category:item.category});
    });
    // context menu to delete?
    card.addEventListener("contextmenu", (e)=>{
      e.preventDefault();
      if(confirm("Remover este asset da biblioteca?")){
        library = library.filter(x=>x.id!==item.id);
        saveLibrary();
        renderLibrary(libSearch.value);
      }
    });
    libraryGrid.appendChild(card);
  }
}

// pack generation
async function generatePack(){
  setLoading(true);
  const basePrompt = promptInput.value||"";
  const baseParsed = parsePrompt(basePrompt);
  const typesPool = ["sword","axe","gun","crate","barrel","chest","rock","tree_pine","tree_oak","house","zombie","human","car","gem","mushroom"];
  // mix of categories
  const packSeeds = [];
  for(let i=0;i<9;i++){
    const seed = Math.floor(Math.random()*999999);
    const type = baseParsed.type? baseParsed.type : typesPool[i%typesPool.length];
    // add variation to prompt
    const variantPrompt = `${basePrompt} variação ${i+1} ${type}`;
    await generateFromPrompt(variantPrompt, {seed, type, category: undefined});
    // small delay to render
    await new Promise(r=> setTimeout(r, 250));
  }
  setLoading(false);
}

// events
promptInput.addEventListener("keydown", (e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    const prompt = promptInput.value.trim()||"caixa misteriosa deadzone";
    generateFromPrompt(prompt);
  }
});
btnGenerate.addEventListener("click", ()=>{
  const p = promptInput.value.trim()||"caixa misteriosa deadzone low poly";
  generateFromPrompt(p);
});
btnGeneratePack.addEventListener("click", generatePack);

sliderComplexity.addEventListener("input", ()=>{
  valComplexity.textContent=sliderComplexity.value;
});
btnRandomSeed.addEventListener("click", ()=>{
  const s=Math.floor(Math.random()*999999);
  inputSeed.value=s;
});
paletteEl.addEventListener("click", (e)=>{
  const btn=e.target.closest(".color-dot");
  if(!btn) return;
  document.querySelectorAll(".color-dot").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  activePalette=btn.dataset.palette;
});

document.querySelectorAll("[data-prompt]").forEach(b=>{
  b.addEventListener("click", ()=>{
    promptInput.value=b.dataset.prompt;
    generateFromPrompt(b.dataset.prompt);
  });
});

btnExportGLB.addEventListener("click", async ()=>{
  if(!currentGroup) return alert("Gere um asset primeiro!");
  const fileName = (currentConfig?.type||"asset")+"_"+(currentConfig?.seed||"");
  const {sizeKB} = await exportGLB(currentGroup, fileName);
  statSize.textContent=sizeKB+"kb";
});
btnExportOBJ.addEventListener("click", ()=>{
  if(!currentGroup) return alert("Gere um asset primeiro!");
  const fileName = (currentConfig?.type||"asset")+"_"+(currentConfig?.seed||"");
  exportOBJ(currentGroup, fileName);
});
btnExportSTL.addEventListener("click", ()=>{
  if(!currentGroup) return alert("Gere um asset primeiro!");
  const fileName = (currentConfig?.type||"asset")+"_"+(currentConfig?.seed||"");
  exportSTL(currentGroup, fileName);
});
btnScreenshot.addEventListener("click", ()=>{
  if(!currentGroup) return;
  const fileName = (currentConfig?.type||"asset")+"_"+(currentConfig?.seed||"");
  screenshot(renderer, fileName);
});

btnWireframe.addEventListener("click", ()=>{
  wireframeEnabled=!wireframeEnabled;
  btnWireframe.classList.toggle("active", wireframeEnabled);
  if(currentGroup){
    currentGroup.traverse(o=>{
      if(o.isMesh){
        o.material.wireframe=wireframeEnabled;
      }
    });
  }
});
btnAutoRotate.addEventListener("click", ()=>{
  autoRotateEnabled=!autoRotateEnabled;
  controls.autoRotate=autoRotateEnabled;
  btnAutoRotate.classList.toggle("active", autoRotateEnabled);
});
btnResetCam.addEventListener("click", ()=>{
  if(currentGroup) centerAndFrame(currentGroup);
  else { camera.position.set(1.8,1.2,1.6); controls.target.set(0,0.5,0); controls.update(); }
});

libSearch.addEventListener("input", ()=>{
  renderLibrary(libSearch.value);
});
btnClearLib.addEventListener("click", ()=>{
  if(confirm("Limpar toda a biblioteca local?")){
    library=[]; saveLibrary(); renderLibrary();
  }
});

btnHelp.addEventListener("click", ()=> modalHelp.classList.remove("hidden"));
btnCloseHelp.addEventListener("click", ()=> modalHelp.classList.add("hidden"));
modalHelp.addEventListener("click", (e)=>{ if(e.target===modalHelp) modalHelp.classList.add("hidden"); });

keywordsList.textContent = listAllKeywords();

// loop
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();

// initial generation demo
function initialDemo(){
  const demos = [
    "espada rúnica enferrujada low poly deadzone",
    "árvore pinheiro neve low poly",
    "baú de tesouro pirata enferrujado",
    "zumbi tank mutante deadzone"
  ];
  const pick = demos[Math.floor(Math.random()*demos.length)];
  promptInput.value=pick;
  generateFromPrompt(pick, {seed: parseInt(inputSeed.value)});
  renderLibrary();
}
initialDemo();

// PWA still
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  });
}
