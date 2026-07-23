import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { exportGLB } from "./exporter.js";

const state={scene:null,group:null,image:null,file:null,fileName:"image_asset"};
const previousAdd=THREE.Scene.prototype.add;
THREE.Scene.prototype.add=function(...objects){ state.scene=this; return previousAdd.apply(this,objects); };

function removeCurrent(){ if(state.group?.parent) state.group.parent.remove(state.group); state.group=null; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function loadImage(file){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); }); }
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }

function imageData(img,resolution){
  const canvas=document.createElement("canvas"); const aspect=img.width/img.height;
  canvas.width=aspect>=1?resolution:Math.max(12,Math.round(resolution*aspect));
  canvas.height=aspect>=1?Math.max(12,Math.round(resolution/aspect)):resolution;
  const ctx=canvas.getContext("2d",{willReadFrequently:true}); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return {canvas,data:ctx.getImageData(0,0,canvas.width,canvas.height)};
}

function buildRelief(img,{resolution=52,depth=0.18,threshold=20}={}){
  const {canvas,data}=imageData(img,resolution); const cols=canvas.width,rows=canvas.height,cell=1/Math.max(cols,rows);
  const geometry=new THREE.BoxGeometry(cell*.98,cell*.98,1); const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.05});
  let count=0; for(let i=0;i<data.data.length;i+=4) if(data.data[i+3]>=threshold) count++;
  const mesh=new THREE.InstancedMesh(geometry,material,count); const dummy=new THREE.Object3D(); const color=new THREE.Color(); let n=0;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const i=(y*cols+x)*4,r=data.data[i]/255,g=data.data[i+1]/255,b=data.data[i+2]/255,a=data.data[i+3]; if(a<threshold) continue;
    const lum=(r+g+b)/3,d=Math.max(.035,depth*(.35+lum*.9));
    dummy.position.set((x-(cols-1)/2)*cell,((rows-1)/2-y)*cell,d/2); dummy.scale.set(1,1,d); dummy.updateMatrix(); mesh.setMatrixAt(n,dummy.matrix);
    color.setRGB(r,g,b,THREE.SRGBColorSpace); mesh.setColorAt(n,color); n++;
  }
  mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true; mesh.castShadow=true; mesh.receiveShadow=true;
  const group=new THREE.Group(); group.name="FORGE_IMAGE_3D"; group.userData.forgeHint="image to 3d relief"; group.userData.source="image-to-3d-local"; group.add(mesh);
  group.scale.setScalar(1.35/Math.max(cols*cell,rows*cell)); group.rotation.x=-.12; return group;
}

function loadExternalModel(url){ const loader=new GLTFLoader(); return new Promise((resolve,reject)=>loader.load(url,gltf=>resolve(gltf.scene),undefined,reject)); }
function showGroup(group){ removeCurrent(); state.group=group; if(!state.scene) throw new Error("Cena 3D ainda não foi inicializada."); state.scene.add(group); }
function setStatus(text,kind=""){ const el=document.getElementById("img3d-status"); if(el){el.textContent=text;el.dataset.kind=kind;} }
function setProgress(value){ const bar=document.getElementById("img3d-progress-bar"); const wrap=document.getElementById("img3d-progress"); if(!bar||!wrap)return; wrap.classList.toggle("hidden",value==null); if(value!=null) bar.style.width=`${Math.max(3,Math.min(100,value))}%`; }

async function generateLocal(){
  if(!state.image) throw new Error("Escolha uma imagem primeiro.");
  const resolution=Number(document.getElementById("img3d-resolution").value||52),depth=Number(document.getElementById("img3d-depth").value||18)/100;
  setProgress(25); setStatus("Gerando relevo 3D no navegador…","loading"); await sleep(60); showGroup(buildRelief(state.image,{resolution,depth})); setProgress(100);
  setStatus("Modelo local gerado. Você já pode girar e exportar.","ok"); setTimeout(()=>setProgress(null),900);
}

async function pollJob(jobId){
  for(let attempt=0;attempt<90;attempt++){
    await sleep(attempt<10?2500:5000);
    const response=await fetch(`/api/image-to-3d-status?jobId=${encodeURIComponent(jobId)}`,{cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.message||`Falha ao consultar o job (${response.status}).`);
    const progress=Number.isFinite(Number(result.progress))?Number(result.progress):Math.min(92,12+attempt*2);
    setProgress(progress); setStatus(`Processando modelo 3D… ${Math.round(progress)}%`,`loading`);
    if(result.modelUrl||["completed","succeeded","success","done"].includes(String(result.status).toLowerCase())) return result;
    if(["failed","error","cancelled"].includes(String(result.status).toLowerCase())) throw new Error(result.provider?.message||"O processamento 3D falhou.");
  }
  throw new Error("O processamento demorou mais que o esperado.");
}

async function generateExternal(){
  if(!state.file) throw new Error("Escolha uma imagem primeiro.");
  setProgress(5); setStatus("Enviando imagem para o motor 3D…","loading");
  const imageBase64=await fileToDataUrl(state.file);
  const prompt=document.getElementById("img3d-prompt").value.trim();
  const response=await fetch("/api/image-to-3d",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64,fileName:state.file.name,prompt,options:{quality:document.getElementById("img3d-quality").value,removeBackground:document.getElementById("img3d-remove-bg").checked}})});
  let result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message||`Backend respondeu ${response.status}.`);
  if(!result.modelUrl&&result.jobId) result=await pollJob(result.jobId);
  if(!result.modelUrl) throw new Error("O motor 3D não retornou uma URL de GLB.");
  setProgress(96); setStatus("Baixando e abrindo o GLB gerado…","loading");
  const group=await loadExternalModel(result.modelUrl); group.name="FORGE_EXTERNAL_IMAGE_3D"; group.userData.forgeHint="external image to 3d"; group.userData.sourceModelUrl=result.modelUrl;
  showGroup(group); setProgress(100); setStatus("Modelo 3D completo carregado com sucesso.","ok"); setTimeout(()=>setProgress(null),1000);
}

function install(){
  const host=document.getElementById("left-panel"); if(!host||document.getElementById("image-to-3d-panel")) return;
  const panel=document.createElement("section"); panel.id="image-to-3d-panel"; panel.className="panel-section image3d-panel";
  panel.innerHTML=`
    <label class="section-label">📷 IMAGEM → 3D <span class="beta">FASE 2</span></label>
    <div class="img3d-drop" id="img3d-drop"><input id="img3d-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><img id="img3d-preview" alt="Prévia"><span>Toque para escolher PNG, JPG ou WEBP</span></div>
    <div class="panel-grid"><div class="field"><label>MODO</label><select id="img3d-mode"><option value="external">3D completo — servidor</option><option value="local">Relevo 3D local</option></select></div><div class="field"><label>QUALIDADE</label><select id="img3d-quality"><option value="draft">Rápida</option><option value="standard" selected>Padrão</option><option value="high">Alta</option></select></div></div>
    <div id="img3d-external-options"><div class="field"><label>INSTRUÇÃO OPCIONAL</label><input id="img3d-prompt" placeholder="ex: personagem low poly, vista completa"></div><label class="img3d-check"><input id="img3d-remove-bg" type="checkbox" checked> Remover fundo antes de gerar</label></div>
    <div id="img3d-local-options" class="hidden"><div class="panel-grid"><div class="field"><label>DETALHE LOCAL</label><select id="img3d-resolution"><option value="36">Rápido</option><option value="52" selected>Equilibrado</option><option value="72">Detalhado</option></select></div><div class="field"><label>PROFUNDIDADE <span id="img3d-depth-value">18</span>%</label><input id="img3d-depth" type="range" min="4" max="45" value="18"></div></div></div>
    <div id="img3d-progress" class="img3d-progress hidden"><div id="img3d-progress-bar"></div></div>
    <button id="img3d-generate" class="secondary-btn">✨ GERAR 3D DA IMAGEM</button>
    <button id="img3d-export" class="export-btn primary" disabled>⬇️ EXPORTAR GLB DA IMAGEM</button>
    <p id="img3d-status" class="hint">Modo servidor gera um modelo 3D completo quando o motor estiver conectado.</p>`;
  host.insertBefore(panel,host.querySelector(".panel-section.small"));
  const style=document.createElement("style"); style.textContent=`.image3d-panel{border:1px solid rgba(170,255,0,.25);background:linear-gradient(180deg,rgba(170,255,0,.04),transparent)}.image3d-panel .beta{font-size:9px;color:#aaff00;border:1px solid rgba(170,255,0,.35);padding:2px 5px;border-radius:10px}.img3d-drop{min-height:112px;border:1px dashed #405044;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;background:#0d120e;margin:8px 0 10px}.img3d-drop img{display:none;width:100%;height:150px;object-fit:contain;background:repeating-conic-gradient(#101510 0 25%,#151b15 0 50%) 50%/18px 18px}.img3d-drop.has-image img{display:block}.img3d-drop.has-image span{display:none}.img3d-drop span{font-size:11px;color:#8d9b90;text-align:center;padding:18px}.image3d-panel .hidden{display:none!important}.image3d-panel button{width:100%;margin-top:7px}.img3d-check{font-size:11px;color:#a8b2aa;display:flex;gap:7px;align-items:center;margin:6px 0}.img3d-progress{height:7px;background:#172018;border-radius:8px;overflow:hidden;margin:10px 0}.img3d-progress div{height:100%;width:3%;background:#aaff00;transition:width .35s ease}#img3d-status[data-kind="ok"]{color:#aaff00}#img3d-status[data-kind="loading"]{color:#ffd166}#img3d-status[data-kind="error"]{color:#ff7b7b}`; document.head.appendChild(style);

  const fileInput=document.getElementById("img3d-file"),drop=document.getElementById("img3d-drop"),preview=document.getElementById("img3d-preview"),generate=document.getElementById("img3d-generate"),exportBtn=document.getElementById("img3d-export"),mode=document.getElementById("img3d-mode");
  drop.addEventListener("click",()=>fileInput.click());
  fileInput.addEventListener("change",async()=>{ const file=fileInput.files?.[0]; if(!file)return; if(file.size>8*1024*1024){setStatus("Imagem acima de 8 MB.","error");return;} state.file=file; state.image=await loadImage(file); state.fileName=file.name.replace(/\.[^.]+$/,"_").replace(/[^a-z0-9_-]+/gi,"_")||"image_asset"; preview.src=state.image.src; drop.classList.add("has-image"); exportBtn.disabled=true; setStatus(`Imagem pronta: ${file.name}`); });
  mode.addEventListener("change",()=>{ const local=mode.value==="local"; document.getElementById("img3d-local-options").classList.toggle("hidden",!local); document.getElementById("img3d-external-options").classList.toggle("hidden",local); });
  document.getElementById("img3d-depth").addEventListener("input",e=>document.getElementById("img3d-depth-value").textContent=e.target.value);
  generate.addEventListener("click",async()=>{ generate.disabled=true; exportBtn.disabled=true; try{ if(mode.value==="external") await generateExternal(); else await generateLocal(); exportBtn.disabled=!state.group; }catch(error){console.error(error);setProgress(null);setStatus(error.message||"Falha ao gerar o modelo.","error");}finally{generate.disabled=false;} });
  exportBtn.addEventListener("click",async()=>{ if(!state.group)return; setStatus("Preparando GLB…","loading"); const result=await exportGLB(state.group,`${state.fileName}_image3d`); setStatus(`GLB exportado (${result.sizeKB} kb).`,"ok"); });
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",install); else install();
