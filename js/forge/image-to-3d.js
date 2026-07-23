import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { exportGLB } from "./exporter.js";

const state = { scene:null, group:null, image:null, fileName:"image_asset", mode:"local" };
const previousAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function(...objects){
  state.scene = this;
  return previousAdd.apply(this, objects);
};

function removeCurrent(){
  if(state.group?.parent) state.group.parent.remove(state.group);
  state.group = null;
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    img.src=URL.createObjectURL(file);
  });
}

function imageData(img, resolution){
  const canvas=document.createElement("canvas");
  const aspect=img.width/img.height;
  canvas.width=aspect>=1?resolution:Math.max(12,Math.round(resolution*aspect));
  canvas.height=aspect>=1?Math.max(12,Math.round(resolution/aspect)):resolution;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return {canvas, data:ctx.getImageData(0,0,canvas.width,canvas.height)};
}

function buildRelief(img,{resolution=52,depth=0.18,threshold=20}={}){
  const {canvas,data}=imageData(img,resolution);
  const cols=canvas.width, rows=canvas.height;
  const cell=1/Math.max(cols,rows);
  const geometry=new THREE.BoxGeometry(cell*0.98,cell*0.98,1);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.72,metalness:0.05});
  let count=0;
  for(let i=0;i<data.data.length;i+=4){ if(data.data[i+3]>=threshold) count++; }
  const mesh=new THREE.InstancedMesh(geometry,material,count);
  const dummy=new THREE.Object3D();
  const color=new THREE.Color();
  let n=0;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const i=(y*cols+x)*4;
      const r=data.data[i]/255,g=data.data[i+1]/255,b=data.data[i+2]/255,a=data.data[i+3];
      if(a<threshold) continue;
      const lum=(r+g+b)/3;
      const d=Math.max(0.035,depth*(0.35+lum*0.9));
      dummy.position.set((x-(cols-1)/2)*cell,((rows-1)/2-y)*cell,d/2);
      dummy.scale.set(1,1,d);
      dummy.updateMatrix();
      mesh.setMatrixAt(n,dummy.matrix);
      color.setRGB(r,g,b,THREE.SRGBColorSpace);
      mesh.setColorAt(n,color);
      n++;
    }
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=true; mesh.receiveShadow=true;
  const group=new THREE.Group();
  group.name="FORGE_IMAGE_3D";
  group.userData.forgeHint="image to 3d relief";
  group.userData.source="image-to-3d-local";
  group.add(mesh);
  const scale=1.35/Math.max(cols*cell,rows*cell);
  group.scale.setScalar(scale);
  group.rotation.x=-0.12;
  return group;
}

async function loadExternalModel(url){
  const loader=new GLTFLoader();
  return new Promise((resolve,reject)=>loader.load(url,gltf=>resolve(gltf.scene),undefined,reject));
}

function showGroup(group){
  removeCurrent();
  state.group=group;
  if(!state.scene) throw new Error("Cena 3D ainda não foi inicializada.");
  state.scene.add(group);
}

function setStatus(text,kind=""){
  const el=document.getElementById("img3d-status");
  if(!el) return;
  el.textContent=text;
  el.dataset.kind=kind;
}

async function generateLocal(){
  if(!state.image) throw new Error("Escolha uma imagem primeiro.");
  const resolution=Number(document.getElementById("img3d-resolution").value||52);
  const depth=Number(document.getElementById("img3d-depth").value||18)/100;
  setStatus("Gerando relevo 3D no navegador…","loading");
  await new Promise(r=>setTimeout(r,60));
  const group=buildRelief(state.image,{resolution,depth});
  showGroup(group);
  setStatus("Modelo 3D gerado. Você já pode girar, testar e exportar.","ok");
}

async function generateExternal(file){
  const endpoint=(localStorage.getItem("forge_external_3d_endpoint")||"").trim();
  if(!endpoint) throw new Error("Defina o endpoint externo no campo Atlas Forge Endpoint.");
  setStatus("Enviando imagem para o processamento externo…","loading");
  const form=new FormData(); form.append("image",file); form.append("format","glb");
  const response=await fetch(endpoint,{method:"POST",body:form});
  if(!response.ok) throw new Error(`Serviço externo respondeu ${response.status}.`);
  const result=await response.json();
  const modelUrl=result.modelUrl||result.glbUrl||result.url;
  if(!modelUrl) throw new Error("O serviço não retornou modelUrl/glbUrl/url.");
  setStatus("Carregando o GLB retornado…","loading");
  const group=await loadExternalModel(modelUrl);
  group.name="FORGE_EXTERNAL_IMAGE_3D";
  group.userData.forgeHint="external image to 3d";
  showGroup(group);
  setStatus("Modelo externo carregado com sucesso.","ok");
}

function install(){
  const host=document.getElementById("left-panel");
  if(!host||document.getElementById("image-to-3d-panel")) return;
  const panel=document.createElement("section");
  panel.id="image-to-3d-panel";
  panel.className="panel-section image3d-panel";
  panel.innerHTML=`
    <label class="section-label">📷 IMAGEM → 3D <span class="beta">BETA</span></label>
    <div class="img3d-drop" id="img3d-drop">
      <input id="img3d-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
      <img id="img3d-preview" alt="Prévia da imagem">
      <span id="img3d-drop-label">Toque para escolher PNG, JPG ou WEBP</span>
    </div>
    <div class="panel-grid img3d-options">
      <div class="field"><label>MODO</label><select id="img3d-mode"><option value="local">Relevo 3D local</option><option value="external">Processamento externo</option></select></div>
      <div class="field"><label>DETALHE</label><select id="img3d-resolution"><option value="36">Rápido</option><option value="52" selected>Equilibrado</option><option value="72">Detalhado</option></select></div>
    </div>
    <div class="field"><label>PROFUNDIDADE <span id="img3d-depth-value">18</span>%</label><input id="img3d-depth" type="range" min="4" max="45" value="18"></div>
    <div id="img3d-external" class="field hidden"><label>ATLAS FORGE ENDPOINT</label><input id="img3d-endpoint" placeholder="https://.../image-to-3d"></div>
    <button id="img3d-generate" class="secondary-btn">✨ GERAR 3D DA IMAGEM</button>
    <button id="img3d-export" class="export-btn primary" disabled>⬇️ EXPORTAR GLB DA IMAGEM</button>
    <p id="img3d-status" class="hint">Envie uma imagem com fundo limpo para obter o melhor resultado.</p>`;
  host.insertBefore(panel,host.querySelector(".panel-section.small"));

  const style=document.createElement("style");
  style.textContent=`
    .image3d-panel{border:1px solid rgba(170,255,0,.2);background:linear-gradient(180deg,rgba(170,255,0,.035),transparent)}
    .image3d-panel .beta{font-size:9px;color:#aaff00;border:1px solid rgba(170,255,0,.35);padding:2px 5px;border-radius:10px}
    .img3d-drop{min-height:112px;border:1px dashed #405044;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;position:relative;background:#0d120e;margin:8px 0 10px}
    .img3d-drop img{display:none;width:100%;height:150px;object-fit:contain;background:repeating-conic-gradient(#101510 0 25%,#151b15 0 50%) 50%/18px 18px}
    .img3d-drop.has-image img{display:block}.img3d-drop.has-image span{display:none}
    .img3d-drop span{font-size:11px;color:#8d9b90;text-align:center;padding:18px}
    .img3d-panel .hidden{display:none!important}.img3d-panel button{width:100%;margin-top:7px}
    #img3d-status[data-kind="ok"]{color:#aaff00}#img3d-status[data-kind="loading"]{color:#ffd166}
  `;
  document.head.appendChild(style);

  const fileInput=document.getElementById("img3d-file");
  const drop=document.getElementById("img3d-drop");
  const preview=document.getElementById("img3d-preview");
  const generate=document.getElementById("img3d-generate");
  const exportBtn=document.getElementById("img3d-export");
  const mode=document.getElementById("img3d-mode");
  const endpoint=document.getElementById("img3d-endpoint");
  endpoint.value=localStorage.getItem("forge_external_3d_endpoint")||"";
  drop.addEventListener("click",()=>fileInput.click());
  fileInput.addEventListener("change",async()=>{
    const file=fileInput.files?.[0]; if(!file) return;
    state.image=await loadImage(file); state.fileName=file.name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"_")||"image_asset";
    preview.src=state.image.src; drop.classList.add("has-image"); exportBtn.disabled=true;
    setStatus(`Imagem pronta: ${file.name}`);
  });
  mode.addEventListener("change",()=>document.getElementById("img3d-external").classList.toggle("hidden",mode.value!=="external"));
  endpoint.addEventListener("change",()=>localStorage.setItem("forge_external_3d_endpoint",endpoint.value.trim()));
  document.getElementById("img3d-depth").addEventListener("input",e=>document.getElementById("img3d-depth-value").textContent=e.target.value);
  generate.addEventListener("click",async()=>{
    try{
      if(mode.value==="external") await generateExternal(fileInput.files?.[0]); else await generateLocal();
      exportBtn.disabled=!state.group;
    }catch(error){ console.error(error); setStatus(error.message||"Falha ao gerar o modelo.","error"); }
  });
  exportBtn.addEventListener("click",async()=>{
    if(!state.group) return;
    setStatus("Preparando GLB…","loading");
    const result=await exportGLB(state.group,`${state.fileName}_image3d`);
    setStatus(`GLB exportado (${result.sizeKB} kb).`,"ok");
  });
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",install); else install();
