import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";

export async function exportGLB(group, fileName="asset"){
  return new Promise((resolve, reject)=>{
    const exporter = new GLTFExporter();
    exporter.parse(group, (result)=>{
      let blob;
      if(result instanceof ArrayBuffer){
        blob = new Blob([result], {type: "model/gltf-binary"});
      } else {
        const str = JSON.stringify(result);
        blob = new Blob([str], {type: "model/gltf+json"});
      }
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${fileName}.glb`);
      // estimate size kb
      const sizeKB = Math.round(blob.size/1024);
      resolve({blob, url, sizeKB});
    }, (err)=>{
      console.error(err);
      reject(err);
    }, {binary:true, maxTextureSize:1024});
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
  setTimeout(()=>{ document.body.removeChild(a); }, 1000);
}
