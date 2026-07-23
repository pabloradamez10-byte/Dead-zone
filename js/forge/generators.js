import * as UTILS from "./utils.js";

let THREE;

export function initGenerators(THREEref){
  THREE = THREEref;
  UTILS.setThree(THREE);
}

function mat(color, extra={}){
  return UTILS.createMaterial(color, extra);
}
function box(w,h,d,color,opts={}){
  const geom = new THREE.BoxGeometry(w,h,d);
  const m = mat(color,opts);
  return new THREE.Mesh(geom,m);
}
function cyl(rt,rb,h,rad,color,opts={}){
  const geom = new THREE.CylinderGeometry(rt,rb,h,rad||8);
  const m = mat(color,opts);
  return new THREE.Mesh(geom,m);
}
function sphere(r,seg,color,opts={}){
  const geom = new THREE.SphereGeometry(r,seg||8,seg||8);
  const m = mat(color,opts);
  return new THREE.Mesh(geom,m);
}
function ico(r,detail,color,opts={}){
  const geom = new THREE.IcosahedronGeometry(r,detail||0);
  const m = mat(color,opts);
  return new THREE.Mesh(geom,m);
}
function cone(r,h,seg,color,opts={}){
  const geom = new THREE.ConeGeometry(r,h,seg||8);
  const m = mat(color,opts);
  return new THREE.Mesh(geom,m);
}

// -------- WEAPONS ----------
export function createSword(rng, opts){
  const G = new THREE.Group();
  const colors = opts.colors;
  const bladeColor = colors?.[0] || (opts.hints.metal? "#b0b8c0":"#d0d6de");
  const handleColor = rng.pick(opts.palette||["#8c6239","#5a2e1a","#2b1a0e"]);
  const guardColor = rng.pick(["#4a4a4a","#8a7a4a","#b5451b"]);

  const complexity = opts.complexity; // 1-10
  const flat = opts.style!=='smooth';

  // Blade: use Box but taper by scaling vertices
  let bladeH = 1.2 + rng.range(0,0.5);
  let bladeW = 0.18 + complexity*0.015;
  let blade = box(bladeW, bladeH, 0.04, bladeColor, {flat, roughness:0.3, metalness:0.6, style:opts.style});
  blade.geometry.translate(0, bladeH/2, 0);
  // taper tip
  const pos = blade.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y = pos.getY(i);
    if(y > bladeH*0.7){
      const factor = 1 - (y - bladeH*0.7)/(bladeH*0.3) * 0.9;
      pos.setX(i, pos.getX(i)*factor);
      pos.setZ(i, pos.getZ(i)*factor);
    }
  }
  pos.needsUpdate=true;
  blade.position.y=0.2;

  if(opts.hints.glowing){
    blade.material.emissive = new THREE.Color(bladeColor);
    blade.material.emissiveIntensity = 0.3;
  }
  if(opts.style==='voxel'){
    // pixelate blade
    blade.scale.set(1,1,1);
  }

  let guard = box(bladeW*2.2, 0.08, 0.12, guardColor, {flat});
  guard.position.y=0.2;

  let handle = cyl(0.06,0.07,0.4,8, handleColor, {flat});
  handle.position.y=-0.05;
  let pommel = sphere(0.09,8, guardColor, {flat});
  pommel.position.y=-0.28;

  if(rng.chance(0.5)){
    // add rune box
    const rune = box(0.05,0.2,0.06, "#aaff00", {flat});
    rune.position.set(0,0.6,0.03);
    G.add(rune);
  }

  G.add(blade,guard,handle,pommel);
  return G;
}

export function createAxe(rng, opts){
  const G = new THREE.Group();
  const wood = rng.pick(["#8c6239","#6b4a2b","#5a3a2a"]);
  const metal = opts.hints.rusty ? "#8a3a1a" : "#9aa0a6";
  const flat = opts.style!=='smooth';

  let handle = cyl(0.05,0.06,1.1,8, wood, {flat});
  handle.position.y=0;

  let headGroup = new THREE.Group();
  let headBase = box(0.5,0.35,0.12, metal, {flat, roughness:0.7, metalness:0.4});
  headBase.position.set(0.15,0.45,0);
  // blade edge extruded? we taper X
  let edge = box(0.05,0.4,0.14, "#c0c6cc", {flat});
  edge.position.set(0.42,0.45,0);
  // distort
  if(opts.complexity>5) UTILS.distortGeometry(headBase.geometry,rng,0.03);

  headGroup.add(headBase,edge);
  if(rng.chance(0.4)){
    headGroup.add(box(0.2,0.15,0.13, metal,{flat}).translateX(0.0).translateY(0.45).translateZ(0));
  }

  G.add(handle,headGroup);
  return G;
}

export function createHammer(rng, opts){
  const G = new THREE.Group();
  const wood="#6b4a2b";
  const metal="#7a807a";
  const flat = opts.style!=='smooth';
  let handle = cyl(0.06,0.06,1.0,8, wood,{flat}); handle.position.y=0;
  let head = box(0.45,0.2,0.2, metal,{flat}); head.position.set(0,0.5,0);
  let top = box(0.5,0.12,0.22, metal,{flat}); top.position.set(0,0.6,0);
  G.add(handle,head,top);
  return G;
}

export function createGun(rng, opts){
  const G = new THREE.Group();
  const bodyCol = rng.pick(opts.palette||["#2b2f33","#4a4a4a","#1e2a1e"]);
  const accent = opts.hints.glowing? "#00fff0":"#ff6b00";
  const flat = opts.style!=='smooth';

  let body = box(0.22,0.18,0.6, bodyCol,{flat, roughness:0.6, metalness:0.5}); body.position.set(0,0.15,0);
  let barrel = cyl(0.05,0.05,0.6,8, "#3a3a3a",{flat}); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.18,0.5);
  let grip = box(0.1,0.32,0.16, bodyCol,{flat}); grip.rotation.x=0.2; grip.position.set(0,-0.05,-0.1);
  let mag = box(0.08,0.18,0.12, "#1a1a1a",{flat}); mag.position.set(0,-0.08,0.08);
  let sight = box(0.04,0.08,0.04, accent,{flat}); sight.position.set(0,0.29, -0.2);
  if(opts.hints.glowing){
    sight.material.emissive=new THREE.Color(accent); sight.material.emissiveIntensity=0.8;
  }

  // add random blocks for sci-fi
  if(opts.complexity>4){
    let side = box(0.02,0.1,0.25, accent,{flat}); side.position.set(0.12,0.18,0.0);
    G.add(side);
  }

  G.add(body,barrel,grip,mag,sight);
  return G;
}

export function createShield(rng, opts){
  const G=new THREE.Group();
  const col = rng.pick(opts.palette||["#8a7a4a","#b5451b","#4a6a8a"]);
  const flat = opts.style!=='smooth';
  let board = cyl(0.45,0.45,0.06, opts.complexity>5? 12:6, col,{flat});
  board.rotation.x=Math.PI/2;
  let boss = sphere(0.12,8, "#c0b090",{flat}); boss.position.z=0.08;
  let back = cyl(0.04,0.04,0.5,6, "#6b4a2b",{flat}); back.rotation.z=Math.PI/2; back.position.set(0,0,-0.06);
  G.add(board,boss,back);
  return G;
}

// -------- PROPS ----------
export function createCrate(rng, opts){
  const G=new THREE.Group();
  const wood = rng.pick(["#8c6239","#a67c52","#6b4a2b"]);
  const dark = "#3a2a1a";
  const flat = opts.style!=='smooth';
  let size = 0.6 + rng.range(0,0.3);
  let base = box(size,size,size, wood,{flat});
  G.add(base);
  // planks lines
  let planks = Math.max(2, Math.floor(opts.complexity/2));
  for(let i=0;i<planks;i++){
    let y = -size/2 + (size/(planks))*(i+0.5);
    let line = box(size+0.02,0.02,size+0.02, dark,{flat});
    line.position.y=y;
    G.add(line);
  }
  // nails
  if(opts.complexity>3){
    for(let j=0;j<4;j++){
      let nail = sphere(0.02,6, "#4a4a4a",{flat});
      nail.position.set(rng.range(-size/2,size/2),rng.range(-size/2,size/2),size/2+0.01);
      G.add(nail);
    }
  }
  return G;
}

export function createBarrel(rng, opts){
  const G=new THREE.Group();
  const wood="#8c6239";
  const metal="#4a4a4a";
  const flat=opts.style!=='smooth';
  let body=cyl(0.35,0.35,0.7,12, wood,{flat});
  G.add(body);
  for(let i=0;i<3;i++){
    let ring=cyl(0.37,0.37,0.04,12, metal,{flat});
    ring.position.y=(i-1)*0.25;
    G.add(ring);
  }
  let top=cyl(0.35,0.35,0.02,12, wood,{flat}); top.position.y=0.36;
  G.add(top);
  return G;
}

export function createChest(rng, opts){
  const G=new THREE.Group();
  const wood = rng.pick(["#6b4a2b","#8c6239"]);
  const metal="#b8952a";
  const flat=opts.style!=='smooth';
  let base=box(0.8,0.5,0.5, wood,{flat}); base.position.y=-0.1;
  let lidGroup=new THREE.Group();
  let lid=box(0.82,0.12,0.52, wood,{flat}); lid.position.y=0.25;
  let lidTop=cyl(0.26,0.26,0.82,12, wood,{flat}); lidTop.rotation.z=Math.PI/2; lidTop.position.y=0.32;
  let lock=box(0.12,0.16,0.06, metal,{flat}); lock.position.set(0,0.1,0.28);
  let hinge1=box(0.04,0.2,0.04, "#3a3a3a",{flat}); hinge1.position.set(-0.3,0.15, -0.26);
  let hinge2=hinge1.clone(); hinge2.position.x=0.3;
  lidGroup.add(lid,lidTop,lock,hinge1,hinge2);
  if(rng.chance(0.3)){
    lidGroup.rotation.x=-0.8; // open
  }
  G.add(base,lidGroup);
  return G;
}

export function createPotion(rng, opts){
  const G=new THREE.Group();
  const liquidColor = rng.pick(opts.colors||opts.palette||["#aaff00","#ff3366","#7fd8ff","#ffaa00"]);
  const flat=opts.style!=='smooth';
  let bottle=cyl(0.16,0.18,0.4,10, "#cde9f0",{flat, roughness:0.2, metalness:0.1});
  bottle.position.y=0;
  let liquid=cyl(0.13,0.15,0.28,10, liquidColor,{flat}); liquid.position.y=-0.02;
  if(opts.hints.glowing){
    liquid.material.emissive=new THREE.Color(liquidColor); liquid.material.emissiveIntensity=0.6;
  }
  let neck=cyl(0.06,0.07,0.14,8, "#cde9f0",{flat}); neck.position.y=0.27;
  let cork=cyl(0.07,0.07,0.08,8, "#8c6239",{flat}); cork.position.y=0.35;

  G.add(bottle,liquid,neck,cork);
  return G;
}

export function createCoin(rng, opts){
  const G=new THREE.Group();
  const col = rng.pick(["#ffcc33","#ffaa00","#c0c0c0","#b87333"]);
  let coin=cyl(0.25,0.25,0.06,16, col,{flat:false, roughness:0.3, metalness:0.8});
  coin.rotation.x=Math.PI/2;
  // emboss box
  let emb = box(0.12,0.12,0.02, "#fff3", {flat:true});
  emb.position.z=0.04; G.add(emb);
  G.add(coin);
  return G;
}

export function createGem(rng, opts){
  const G=new THREE.Group();
  const col = rng.pick(opts.colors||["#00fff0","#ff00aa","#aaff00","#ffaa00"]);
  let geom = new THREE.OctahedronGeometry(0.3,0);
  UTILS.distortGeometry(geom,rng,0.02);
  let mesh=new THREE.Mesh(geom, mat(col,{flat:true, roughness:0.1, metalness:0.1, style:opts.style}));
  mesh.material.emissive=new THREE.Color(col); mesh.material.emissiveIntensity=0.2;
  G.add(mesh);
  return G;
}

export function createLantern(rng, opts){
  const G=new THREE.Group();
  const metal="#4a4a4a";
  const glass="#ffe8a0";
  const flat=opts.style!=='smooth';
  let top=cyl(0.18,0.22,0.08,8, metal,{flat}); top.position.y=0.28;
  let bottom=cyl(0.22,0.18,0.06,8, metal,{flat}); bottom.position.y=-0.28;
  let body=cyl(0.18,0.18,0.5,8, glass,{flat, roughness:0.2}); body.material.transparent=true; body.material.opacity=0.7;
  body.material.emissive=new THREE.Color(glass); body.material.emissiveIntensity=0.5;
  let handle=cyl(0.02,0.02,0.4,6, metal,{flat}); handle.position.y=0.45; handle.rotation.z=Math.PI/2;
  // torus approximations using box loop? use torus geometry if exists
  G.add(top,bottom,body,handle);
  return G;
}

// ---------- NATURE ----------
export function createTreeOak(rng, opts){
  const G=new THREE.Group();
  const trunkCol="#6b4a2b";
  const leafCol = rng.pick(opts.colors||["#4a7c3f","#5a8a4a","#3d5a2b","#8a9a3c"]);
  const flat=opts.style!=='smooth';
  let trunkH = 0.6 + rng.range(0,0.6);
  let trunk=cyl(0.06,0.12,trunkH,6, trunkCol,{flat});
  trunk.position.y=trunkH/2;
  G.add(trunk);

  // foliage: cluster of icos
  let clusters = 2 + Math.floor(opts.complexity/2);
  for(let i=0;i<clusters;i++){
    let s = 0.3 + rng.range(0,0.25);
    let mesh=ico(s, rng.int(0,1), leafCol,{flat});
    mesh.position.set(rng.range(-0.25,0.25), trunkH + rng.range(-0.05,0.35), rng.range(-0.25,0.25));
    UTILS.distortGeometry(mesh.geometry,rng,0.07);
    G.add(mesh);
  }
  return G;
}

export function createTreePine(rng, opts){
  const G=new THREE.Group();
  const trunkCol="#6b4a2b";
  const leafCol=rng.pick(opts.colors||["#2b5a2b","#3a6b3a","#1e4a2a"]);
  const flat=opts.style!=='smooth';
  let trunkH=0.7;
  let trunk=cyl(0.05,0.09,trunkH,6,trunkCol,{flat}); trunk.position.y=trunkH/2; G.add(trunk);
  let layers=3+Math.floor(opts.complexity/2);
  for(let i=0;i<layers;i++){
    let r=0.5 - i*0.12; let h=0.45;
    let y=trunkH + i*0.28;
    let cone= new THREE.Mesh(new THREE.ConeGeometry(r,h,6), mat(leafCol,{flat}));
    cone.position.y=y;
    if(opts.style==='voxel'){
      // replace with box stack
    }
    G.add(cone);
  }
  return G;
}

export function createRock(rng, opts){
  const G=new THREE.Group();
  const col = rng.pick(opts.colors||opts.palette||["#6a6a6a","#8a8a7a","#5a5a4a","#8c8a6a"]);
  const flat=true;
  let detail = opts.complexity>6?2: opts.complexity>3?1:0;
  let geom=new THREE.IcosahedronGeometry(0.4 + rng.range(0,0.2), detail);
  UTILS.distortGeometry(geom,rng,0.25 + opts.complexity*0.02);
  // flatten bottom
  const pos=geom.attributes.position;
  for(let i=0;i<pos.count;i++){
    if(pos.getY(i)< -0.15) pos.setY(i, -0.15 + rng.range(-0.05,0.05));
  }
  pos.needsUpdate=true;
  geom.computeVertexNormals();
  let mesh=new THREE.Mesh(geom, mat(col,{flat, roughness:0.9, style:opts.style}));
  mesh.position.y=0.2;
  G.add(mesh);
  if(opts.hints.icy){
    mesh.material.color.set("#d0f0ff");
  }
  if(rng.chance(0.4) && opts.complexity>4){
    let moss=ico(0.12,0,"#4a7c3f",{flat}); moss.position.set(rng.range(-0.2,0.2),0.35,rng.range(-0.2,0.2));
    G.add(moss);
  }
  return G;
}

export function createBush(rng, opts){
  const G=new THREE.Group();
  const col=rng.pick(["#4a7c3f","#6a9a3a","#5a8a4a"]);
  let clusters=3+rng.int(0,3);
  for(let i=0;i<clusters;i++){
    let m=sphere(0.2+rng.range(0,0.15),6,col,{flat:true});
    m.position.set(rng.range(-0.2,0.2),rng.range(0.1,0.35),rng.range(-0.2,0.2));
    UTILS.distortGeometry(m.geometry,rng,0.08);
    G.add(m);
  }
  return G;
}

export function createCactus(rng, opts){
  const G=new THREE.Group();
  const col="#4a7c3f";
  let main=cyl(0.12,0.14,0.8,8,col,{flat:true}); main.position.y=0.4; G.add(main);
  if(rng.chance(0.7)){
    let arm=cyl(0.06,0.07,0.4,6,col,{flat:true}); arm.position.set(0.18,0.5,0); arm.rotation.z=-0.6; G.add(arm);
    let top=sphere(0.07,6,col,{flat:true}); top.position.set(0.28,0.68,0); G.add(top);
  }
  return G;
}

export function createMushroom(rng, opts){
  const G=new THREE.Group();
  const stemCol="#e8e2d0";
  const capCol=rng.pick(["#d9381e","#ff6b2d","#c9a86a","#8a9a3c"]);
  let stem=cyl(0.06,0.09,0.3,8,stemCol,{flat:true}); stem.position.y=0.15; G.add(stem);
  let cap=sphere(0.28,8,capCol,{flat:true}); cap.scale.set(1,0.55,1); cap.position.y=0.4; G.add(cap);
  // dots
  if(rng.chance(0.6)){
    for(let i=0;i<3;i++){
      let dot=sphere(0.04,5,"#ffffff",{flat:true});
      dot.position.set(rng.range(-0.15,0.15),0.48+rng.range(0,0.08),rng.range(-0.15,0.15));
      G.add(dot);
    }
  }
  return G;
}

// ---------- STRUCTURE ----------
export function createHouse(rng, opts){
  const G=new THREE.Group();
  const wallCol = rng.pick(opts.palette||["#8c6239","#6b4a2b","#a67c52","#7a6a5a"]);
  const roofCol = rng.pick(["#b5451b","#3a3a3a","#2b3a4a","#5a3a1a"]);
  const flat=true;
  let baseW=1.0+rng.range(0,0.5); let baseH=0.7; let baseD=0.9;
  let base=box(baseW,baseH,baseD, wallCol,{flat}); base.position.y=baseH/2; G.add(base);
  // roof prism
  let roofGeom=new THREE.BufferGeometry();
  // triangular prism manually
  let hw=baseW/2+0.1; let hd=baseD/2+0.1; let rh=0.55;
  const vertices=new Float32Array([
    -hw,baseH,-hd,  hw,baseH,-hd,  0,baseH+rh,-hd,
    -hw,baseH,hd,   0,baseH+rh,hd,  hw,baseH,hd,
    -hw,baseH,-hd, -hw,baseH,hd,  0,baseH+rh,hd, 0,baseH+rh,-hd,
    hw,baseH,-hd, 0,baseH+rh,-hd, 0,baseH+rh,hd, hw,baseH,hd,
    -hw,baseH,-hd, hw,baseH,-hd, hw,baseH,hd, -hw,baseH,hd
  ]);
  const indices=[
    0,1,2, 3,4,5, 6,7,8,6,8,9, 10,11,12,10,12,13, 14,15,16,14,16,17
  ];
  roofGeom.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  roofGeom.setIndex(indices);
  roofGeom.computeVertexNormals();
  let roofMesh=new THREE.Mesh(roofGeom, mat(roofCol,{flat}));
  G.add(roofMesh);

  // door
  let door=box(0.2,0.35,0.02, "#2b1a0e",{flat}); door.position.set(0,0.175, baseD/2+0.01); G.add(door);
  // window
  if(opts.complexity>3){
    let win=box(0.18,0.18,0.02, "#7fd8ff",{flat}); win.position.set(rng.pick([-0.3,0.3]),0.4, baseD/2+0.01); win.material.emissive=new THREE.Color("#7fd8ff"); win.material.emissiveIntensity=0.15; G.add(win);
  }
  if(opts.style==='voxel'){
    G.scale.set(1,1,1); // keep
  }
  if(opts.hints.icy){ roofMesh.material.color.set("#e6f7ff"); }
  return G;
}

export function createTower(rng, opts){
  const G=new THREE.Group();
  const stone="#7a7a7a";
  let h=1.4+rng.range(0,0.6);
  let base=cyl(0.35,0.4,h,8,stone,{flat:true}); base.position.y=h/2; G.add(base);
  let top=cyl(0.4,0.35,0.15,8,"#5a5a5a",{flat:true}); top.position.y=h; G.add(top);
  let roof=cone(0.45,h*0.4,8,"#b5451b",{flat:true}); roof.position.y=h+0.3; G.add(roof);
  return G;
}

export function createPillar(rng, opts){
  const G=new THREE.Group();
  let h=1.2;
  let base=box(0.4,0.1,0.4,"#8a8a8a",{flat:true}); base.position.y=0.05; G.add(base);
  let col=cyl(0.12,0.12,h,8,"#d0d0d0",{flat:true}); col.position.y=h/2; G.add(col);
  let cap=box(0.4,0.1,0.4,"#8a8a8a",{flat:true}); cap.position.y=h; G.add(cap);
  return G;
}

export function createWall(rng, opts){
  const G=new THREE.Group();
  let len=1.2; let wall=box(len,0.6,0.18,"#7a7a7a",{flat:true}); wall.position.y=0.3; G.add(wall);
  // bricks pattern via boxes
  if(opts.complexity>4){
    for(let i=0;i<3;i++){
      let brick=box(0.25,0.12,0.19,"#6a6a6a",{flat:true}); brick.position.set((i-1)*0.35,0.4,0); G.add(brick);
    }
  }
  return G;
}

// ---------- CHARACTER ----------
export function createHuman(rng, opts){
  const G=new THREE.Group();
  const skin=rng.pick(["#e8c4a0","#d9a77a","#8a6a4a","#e8e2d0"]);
  const shirt=rng.pick(opts.palette||["#4a7c3f","#3a5a8a","#b5451b","#2b2b2b"]);
  const pants="#2b332a";
  const flat=true;
  // torso
  let torso=box(0.3,0.4,0.18,shirt,{flat}); torso.position.y=0.7; G.add(torso);
  let head=sphere(0.18,8,skin,{flat}); head.position.y=1.05; G.add(head);
  let armL=box(0.08,0.35,0.08,skin,{flat}); armL.position.set(-0.22,0.68,0); G.add(armL);
  let armR=armL.clone(); armR.position.x=0.22; G.add(armR);
  let legL=box(0.1,0.4,0.1,pants,{flat}); legL.position.set(-0.08,0.25,0); G.add(legL);
  let legR=legL.clone(); legR.position.x=0.08; G.add(legR);
  // eyes
  let eyeL=box(0.03,0.03,0.02,"#111",{flat}); eyeL.position.set(-0.06,1.08,0.15); G.add(eyeL);
  let eyeR=eyeL.clone(); eyeR.position.x=0.06; G.add(eyeR);
  if(opts.hints.glowing){
    eyeL.material.emissive=new THREE.Color("#aaff00"); eyeL.material.emissiveIntensity=1;
    eyeR.material.emissive=new THREE.Color("#aaff00"); eyeR.material.emissiveIntensity=1;
  }
  return G;
}

export function createRobot(rng,opts){
  const G=new THREE.Group();
  const metal="#9aa0a6";
  const accent=rng.pick(["#00fff0","#ff6b00","#aaff00"]);
  const flat=true;
  let torso=box(0.35,0.45,0.22,metal,{flat, metalness:0.7}); torso.position.y=0.7; G.add(torso);
  let head=box(0.28,0.26,0.24,metal,{flat}); head.position.y=1.1; G.add(head);
  let eye=box(0.18,0.06,0.02,accent,{flat}); eye.position.set(0,1.1,0.13); eye.material.emissive=new THREE.Color(accent); eye.material.emissiveIntensity=0.9; G.add(eye);
  let antenna=cyl(0.02,0.02,0.18,6,metal,{flat}); antenna.position.set(0,1.3,0); G.add(antenna);
  let bulb=sphere(0.04,6,accent,{flat}); bulb.position.y=1.4; bulb.material.emissive=new THREE.Color(accent); bulb.material.emissiveIntensity=1; G.add(bulb);
  let armL=box(0.08,0.38,0.08,metal,{flat}); armL.position.set(-0.24,0.7,0); G.add(armL);
  let armR=armL.clone(); armR.position.x=0.24; G.add(armR);
  let legL=box(0.12,0.4,0.12,metal,{flat}); legL.position.set(-0.1,0.25,0); G.add(legL);
  let legR=legL.clone(); legR.position.x=0.1; G.add(legR);
  return G;
}

export function createZombie(rng,opts){
  const G=createHuman(rng,{...opts, palette:["#5a7a3a","#6b4a2b","#3a4a3a"]});
  // add mutations
  G.traverse(m=>{
    if(m.isMesh){
      m.material.color.multiplyScalar(0.6);
      m.material.color.offsetHSL(0.18,0.1, -0.05);
      if(rng.chance(0.3)) UTILS.distortGeometry(m.geometry,rng,0.05);
    }
  });
  // extra arm bulge for tank
  if(opts.type==='zombie' && rng.chance(0.5)){
    let tumor=sphere(0.15,5,"#8a9a3c",{flat:true}); tumor.position.set(rng.range(-0.2,0.2),0.8,rng.range(-0.1,0.1)); tumor.scale.set(1,rng.range(1,1.6),1); G.add(tumor);
  }
  // blood?
  let blood=box(0.05,0.15,0.05,"#7a1f1f",{flat:true}); blood.position.set(rng.range(-0.1,0.1),0.6,0.12); G.add(blood);
  return G;
}

export function createMonster(rng,opts){
  const G=new THREE.Group();
  const col=rng.pick(["#4a2a6a","#2a5a4a","#6a1f1f"]);
  let body=ico(0.4,0,col,{flat:true}); body.position.y=0.6; UTILS.distortGeometry(body.geometry,rng,0.2); G.add(body);
  let eye1=sphere(0.07,6,"#ffcc00",{flat:true}); eye1.position.set(-0.15,0.75,0.28); eye1.material.emissive=new THREE.Color("#ffcc00"); eye1.material.emissiveIntensity=0.8; G.add(eye1);
  let eye2=eye1.clone(); eye2.position.x=0.15; G.add(eye2);
  let legCount=3+rng.int(0,2);
  for(let i=0;i<legCount;i++){
    let leg=cyl(0.05,0.07,0.5,5,col,{flat:true}); let angle=(i/legCount)*Math.PI*2; leg.position.set(Math.cos(angle)*0.15,0.2,Math.sin(angle)*0.15); leg.rotation.z=angle*0.2; G.add(leg);
  }
  return G;
}

// ---------- VEHICLE ----------
export function createCar(rng,opts){
  const G=new THREE.Group();
  const bodyCol=rng.pick(opts.palette||["#b5451b","#2b5a2b","#2b3a8a","#e8e2d0"]);
  let chassis=box(0.6,0.25,1.1,bodyCol,{flat:true}); chassis.position.y=0.35; G.add(chassis);
  let cabin=box(0.55,0.3,0.55,"#2a2a2a",{flat:true}); cabin.position.set(0,0.62, -0.15); G.add(cabin);
  let wheelGeom=new THREE.CylinderGeometry(0.12,0.12,0.08,12); wheelGeom.rotateZ(Math.PI/2);
  let wheelMat=mat("#1a1a1a",{flat:true});
  let positions=[[ -0.32,0.12,0.35],[0.32,0.12,0.35],[-0.32,0.12,-0.35],[0.32,0.12,-0.35]];
  for(const p of positions){
    let w=new THREE.Mesh(wheelGeom,wheelMat); w.position.set(...p); G.add(w);
  }
  let win=box(0.5,0.02,0.4,"#7fd8ff",{flat:true}); win.position.set(0,0.78,-0.15); win.material.transparent=true; win.material.opacity=0.7; G.add(win);
  return G;
}

export function createSpaceship(rng,opts){
  const G=new THREE.Group();
  let bodyCol=rng.pick(["#c0c6ce","#4a4a4a","#b0f0ff"]);
  let accent=rng.pick(["#00fff0","#ff6b00","#aaff00"]);
  let body=cone(0.25,1.0,8,bodyCol,{flat:true}); body.rotation.x=Math.PI/2; body.position.z=0.1; G.add(body);
  let wingL=box(0.5,0.04,0.3,bodyCol,{flat:true}); wingL.position.set(-0.4,0, -0.2); G.add(wingL);
  let wingR=wingL.clone(); wingR.position.x=0.4; G.add(wingR);
  let engine=cyl(0.08,0.12,0.2,8,"#2a2a2a",{flat:true}); engine.rotation.x=Math.PI/2; engine.position.set(0,0,-0.6); G.add(engine);
  let flame=cone(0.12,0.25,8,accent,{flat:true}); flame.rotation.x=-Math.PI/2; flame.position.set(0,0,-0.8); flame.material.emissive=new THREE.Color(accent); flame.material.emissiveIntensity=0.9; G.add(flame);
  // cockpit
  let cock=sphere(0.12,8,"#7fd8ff",{flat:true}); cock.position.set(0,0.08,0.25); cock.material.transparent=true; cock.material.opacity=0.8; G.add(cock);
  return G;
}

// map id to function
export const GENERATOR_MAP = {
  sword: createSword,
  axe: createAxe,
  hammer: createHammer,
  gun: createGun,
  shield: createShield,
  crate: createCrate,
  barrel: createBarrel,
  chest: createChest,
  potion: createPotion,
  coin: createCoin,
  gem: createGem,
  lantern: createLantern,
  tree_oak: createTreeOak,
  tree_pine: createTreePine,
  rock: createRock,
  bush: createBush,
  cactus: createCactus,
  mushroom: createMushroom,
  house: createHouse,
  tower: createTower,
  pillar: createPillar,
  wall: createWall,
  human: createHuman,
  robot: createRobot,
  zombie: createZombie,
  monster: createMonster,
  car: createCar,
  spaceship: createSpaceship
};

export function getGenerator(type){
  return GENERATOR_MAP[type] || GENERATOR_MAP["crate"];
}

export function preprocessVoxel(group,rng){
  // for voxel style: convert each mesh to boxes snapped to grid
  // Idea: take bounding box, voxelize not physically, but make geometry boxify
  // For simplicity: replace each mesh geometry with box geometry approximating bounds if flagged as voxel
  // We'll just keep original but ensure materials flat and geometry box
  // This stub ensures visual voxel feel by merging to cubes later (lightweight)
  group.traverse(o=>{
    if(o.isMesh){
      o.material.flatShading = true;
      // Snap scale a bit
      o.position.x = Math.round(o.position.x*4)/4;
      o.position.y = Math.round(o.position.y*4)/4;
      o.position.z = Math.round(o.position.z*4)/4;
    }
  });
  return group;
}
