export function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function makeRNG(seed){
  // seed as number
  const s = (seed>>>0) || 1;
  const rand = mulberry32(s);
  return {
    float: () => rand(),
    range: (min,max) => min + rand()*(max-min),
    int: (min,max) => Math.floor(min + rand()*(max-min+1)),
    pick: (arr) => arr[Math.floor(rand()*arr.length)],
    chance: (p) => rand() < p
  };
}

export function hexToRgb(hex){
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return {r,g,b};
}

export const PALETTES = {
  auto: null, // derived from prompt
  deadzone: ["#b5451b","#8a9a3c","#e8e2d0","#2b332a","#5a2e1a"],
  forest: ["#2b5a2b","#4a7c3f","#8a9a3c","#6b4a2b","#d9c49c"],
  ice: ["#7fd8ff","#c6eeff","#e6f7ff","#4aa8d8","#2b3a4a"],
  lava: ["#ff2a00","#ff6b00","#ffae00","#3a1a0a","#1a1a1a"],
  toxic: ["#aaff00","#5ac800","#1a2b00","#e8ff9e","#5a3a00"],
  gold: ["#ffcc33","#ff9f1a","#8c6239","#3a2a10","#fff0b3"],
  cyber: ["#00fff0","#ff00aa","#7000ff","#0a0a12","#aaff00"]
};

export function distortGeometry(geom, rng, amount=0.15){
  const pos = geom.attributes.position;
  for(let i=0;i<pos.count;i++){
    const dx = (rng.float()-0.5)*amount;
    const dy = (rng.float()-0.5)*amount;
    const dz = (rng.float()-0.5)*amount;
    pos.setXYZ(i, pos.getX(i)+dx, pos.getY(i)+dy, pos.getZ(i)+dz);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function centeredGroup(group){
  const THREE = _THREE;
  group.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z);
  const scale = maxDim>0 ? 1.6 / maxDim : 1;
  group.position.set(-center.x, -box.min.y, -center.z);
  group.scale.setScalar(scale);
  return {size:size.multiplyScalar(scale), box};
}

let _THREE = null;
export function setThree(THREE){ _THREE = THREE; }
export function getThree(){ return _THREE; }

export function createMaterial(colorHex, opts={}){
  const THREE = _THREE;
  const {flat=true, roughness=0.8, metalness=0.05, style='lowpoly'} = opts;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    flatShading: style==='smooth' ? false : flat,
    roughness,
    metalness,
    transparent: false
  });
}

export function mergeMeshesIfPossible(group){
  // keep as group, we don't merge to preserve colors; optional
  return group;
}

export function countStats(group){
  let verts=0, tris=0, meshes=0;
  group.traverse(o=>{
    if(o.isMesh){
      meshes++;
      const g=o.geometry;
      if(g.attributes.position) verts+=g.attributes.position.count;
      if(g.index) tris+=g.index.count/3;
      else tris+=g.attributes.position.count/3;
    }
  });
  return {verts,tris,meshes};
}
