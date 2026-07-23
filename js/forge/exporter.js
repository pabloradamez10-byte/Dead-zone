import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { ensureProceduralRig } from "./rigging.js";
import { buildAnimationClips } from "./animationSystem.js";

function restoreBaseTransform(group){
  const base = group?.userData?.forgeBaseTransform;
  if(!base) return;
  group.position.fromArray(base.position);
  group.rotation.set(base.rotation[0],base.rotation[1],base.rotation[2],base.rotation[3]);
  group.scale.fromArray(base.scale);
  group.updateMatrixWorld(true);
}

export async function exportGLB(group, fileName="asset"){
  return new Promise((resolve, reject)=>{
    const exporter = new GLTFExporter();
    const previous = {
      position: group.position.clone(),
      rotation: group.rotation.clone(),
      scale: group.scale.clone()
    };

    try{
      restoreBaseTransform(group);
      const hint = group.userData.forgeHint || fileName;
      const animated = window.FORGE_EXPORT_ANIMATED !== false;

      if(animated){
        ensureProceduralRig(group, hint);
      }

      const animations = animated ? buildAnimationClips(group, hint) : [];
      group.userData.forgeAnimationClips = animations.map(clip=>clip.name);
      group.userData.forgeAnimatedExport = animated;

      exporter.parse(group, (result)=>{
        let blob;
        if(result instanceof ArrayBuffer){
          blob = new Blob([result], {type: "model/gltf-binary"});
        } else {
          const str = JSON.stringify(result);
          blob = new Blob([str], {type: "model/gltf+json"});
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${fileName}${animated ? "_animated" : ""}.glb`);
        const sizeKB = Math.round(blob.size/1024);

        group.position.copy(previous.position);
        group.rotation.copy(previous.rotation);
        group.scale.copy(previous.scale);
        group.updateMatrixWorld(true);

        resolve({blob, url, sizeKB, animations: animations.map(clip=>clip.name)});
      }, (err)=>{
        group.position.copy(previous.position);
        group.rotation.copy(previous.rotation);
        group.scale.copy(previous.scale);
        group.updateMatrixWorld(true);
        console.error(err);
        reject(err);
      }, {
        binary:true,
        maxTextureSize:1024,
        animations,
        onlyVisible:true,
        trs:true
      });
    }catch(err){
      group.position.copy(previous.position);
      group.rotation.copy(previous.rotation);
      group.scale.copy(previous.scale);
      group.updateMatrixWorld(true);
      reject(err);
    }
  });
}

export function exportOBJ(group, fileName="asset"){
  const exporter = new OBJExporter();
  const data = exporter.parse(group);
  const blob = new Blob([data], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${fileName}.obj`);
  return {blob, url};
}

export function exportSTL(group, fileName="asset"){
  const exporter = new STLExporter();
  const data = exporter.parse(group, {binary:false});
  const blob = new Blob([data], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${fileName}.stl`);
  return {blob, url};
}

export function screenshot(renderer, fileName="asset"){
  const url = renderer.domElement.toDataURL("image/png");
  const a=document.createElement("a");
  a.href=url; a.download=`${fileName}.png`; a.click();
  return url;
}

function triggerDownload(url, filename){
  const a=document.createElement("a");
  a.href=url; a.download=filename; a.style.display="none";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}
