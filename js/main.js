import { Player } from "./player.js";
import { Zombie, ZombieSpawner } from "./zombie.js";
import { DayNightCycle } from "./world.js";
import { ITEM_DB, rollLoot, craft } from "./items.js";
import { saveGame, loadGame, applySaveToPlayer, hasSave, clearSave } from "./save.js";
import { Joystick, HUD, InventoryPanel, CraftPanel } from "./ui.js";

// ---------- Canvas setup ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------- Elements ----------
const mainMenu = document.getElementById("main-menu");
const deathScreen = document.getElementById("death-screen");
const deathStats = document.getElementById("death-stats");
const btnNewGame = document.getElementById("btn-new-game");
const btnContinue = document.getElementById("btn-continue");
const btnRestart = document.getElementById("btn-restart");
const btnMenu = document.getElementById("btn-menu");
const btnAttack = document.getElementById("btn-attack");
const btnSave = document.getElementById("btn-save");
const btnOpenInventory = document.getElementById("btn-open-inventory");
const btnOpenCraft = document.getElementById("btn-open-craft");

btnContinue.disabled = !hasSave();
btnContinue.style.opacity = hasSave() ? "1" : "0.4";

const joystick = new Joystick(
  document.getElementById("joystick-zone"),
  document.getElementById("joystick-bg"),
  document.getElementById("joystick-handle")
);
const hud = new HUD();
const inventoryPanel = new InventoryPanel(onUseItem);
const craftPanel = new CraftPanel(onCraft);

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

// ---------- Game state ----------
let player, world, spawner, zombies, groundItems;
let running = false;
let lastTime = 0;
let camera = { x: 0, y: 0 };

function newGame() {
  player = new Player(0, 0);
  world = new DayNightCycle(240);
  zombies = [];
  groundItems = [];
  spawner = new ZombieSpawner(() => ({ x: player.x, y: player.y }), {
    interval: 5,
    maxZombies: 30,
  });
  startPlaying();
}

function continueGame() {
  const data = loadGame();
  if (!data) return newGame();
  player = new Player(data.x, data.y);
  world = new DayNightCycle();
  world.loadFrom(data.world);
  applySaveToPlayer(player, data);
  zombies = [];
  groundItems = [];
  spawner = new ZombieSpawner(() => ({ x: player.x, y: player.y }), {
    interval: 5,
    maxZombies: 30,
  });
  startPlaying();
}

function startPlaying() {
  mainMenu.classList.add("hidden");
  deathScreen.classList.add("hidden");
  hud.show();
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  hud.hide();
  deathStats.textContent = `sobreviveu ${world.day} dia(s) \u00b7 ${player.kills} abates`;
  deathScreen.classList.remove("hidden");
}

// ---------- Input: attack button ----------
let attackHeld = false;
btnAttack.addEventListener("pointerdown", () => {
  attackHeld = true;
  meleeAttack();
});
btnAttack.addEventListener("pointerup", () => (attackHeld = false));

function meleeAttack() {
  if (!player.alive) return;
  const range = 40;
  for (const z of zombies) {
    if (!z.alive) continue;
    const d = Math.hypot(z.x - player.x, z.y - player.y);
    if (d <= range) {
      z.takeDamage(25);
      if (!z.alive) onZombieDeath(z);
    }
  }
}

function onZombieDeath(zombie) {
  player.kills += 1;
  if (Math.random() < 0.35) {
    const itemId = rollLoot();
    groundItems.push({ x: zombie.x, y: zombie.y, itemId, id: Math.random() });
  }
}

// ---------- Inventory / craft callbacks ----------
function onUseItem(itemId) {
  const def = ITEM_DB[itemId];
  if (def.type === "food" || def.type === "water" || def.type === "bandage" || def.type === "medkit") {
    const ok = player.useItem(itemId, def);
    if (ok) hud.toast(`Usou ${def.name}`);
    inventoryPanel.render(player.inventory);
  } else {
    hud.toast(`${def.name} é usado em receitas de fabricação.`);
  }
}

function onCraft(recipe) {
  const ok = craft(player.inventory, recipe);
  if (ok) {
    hud.toast(`Fabricou: ${recipe.name}`);
    craftPanel.render(player.inventory);
    inventoryPanel.render(player.inventory);
  }
}

btnOpenInventory.addEventListener("click", () => {
  inventoryPanel.render(player.inventory);
  inventoryPanel.open();
});
btnOpenCraft.addEventListener("click", () => {
  craftPanel.render(player.inventory);
  craftPanel.open();
});
btnSave.addEventListener("click", () => {
  saveGame(player, world);
  hud.toast("Jogo salvo.");
});

// ---------- Menu buttons ----------
btnNewGame.addEventListener("click", newGame);
btnContinue.addEventListener("click", () => {
  if (hasSave()) continueGame();
});
btnRestart.addEventListener("click", newGame);
btnMenu.addEventListener("click", () => {
  deathScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  btnContinue.disabled = !hasSave();
  btnContinue.style.opacity = hasSave() ? "1" : "0.4";
});

// ---------- Main loop ----------
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function update(dt) {
  if (!player.alive) {
    gameOver();
    return;
  }

  player.isRunning = joystick.active && (Math.abs(joystick.vec.x) > 0.15 || Math.abs(joystick.vec.y) > 0.15);
  player.update(dt, joystick.vec);

  world.update(dt);
  const targetInterval = world.isNight ? 3 : 5.5;
  spawner.setInterval(targetInterval);

  const newZombie = spawner.update(dt, zombies);
  if (newZombie) zombies.push(newZombie);

  for (const z of zombies) {
    z.update(dt, player, (dmg) => {
      // onAttackPlayer dispara uma vez por cooldown de ataque (evento discreto, não por frame)
      player.takeDamage(dmg);
      if (Math.random() < 0.15) player.infect();
      if (Math.random() < 0.08) player.startBleeding();
    });
  }
  zombies = zombies.filter((z) => z.alive);

  // Pickup de itens no chão
  groundItems = groundItems.filter((item) => {
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d <= player.radius + 14) {
      const added = player.inventory.addItem(item.itemId, 1);
      if (added) {
        hud.toast(`+1 ${ITEM_DB[item.itemId].name}`);
        return false;
      }
    }
    return true;
  });

  camera.x = player.x;
  camera.y = player.y;

  hud.update(player, world);
}

// ---------- Rendering ----------
function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const light = world.lightLevel; // 0..1
  const groundShade = Math.round(22 + light * 18);
  ctx.fillStyle = `rgb(${groundShade - 6}, ${groundShade + 10}, ${groundShade - 8})`;
  ctx.fillRect(0, 0, w, h);

  // Grid de "campo" pra dar noção de movimento
  ctx.strokeStyle = `rgba(0,0,0,${0.12 + (1 - light) * 0.05})`;
  ctx.lineWidth = 1;
  const gridSize = 64;
  const offsetX = ((-camera.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((-camera.y % gridSize) + gridSize) % gridSize;
  for (let x = offsetX; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = offsetY; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const toScreen = (wx, wy) => ({ x: wx - camera.x + w / 2, y: wy - camera.y + h / 2 });

  // Itens no chão
  for (const item of groundItems) {
    const p = toScreen(item.x, item.y);
    const def = ITEM_DB[item.itemId];
    ctx.fillStyle = def.color;
    ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
  }

  // Zumbis
  for (const z of zombies) {
    const p = toScreen(z.x, z.y);
    ctx.fillStyle = z.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, z.radius, 0, Math.PI * 2);
    ctx.fill();
    // barra de vida do zumbi
    const pct = z.health / z.maxHealth;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(p.x - 16, p.y - z.radius - 10, 32, 4);
    ctx.fillStyle = "#b5451b";
    ctx.fillRect(p.x - 16, p.y - z.radius - 10, 32 * pct, 4);
  }

  // Player
  const pp = toScreen(player.x, player.y);
  ctx.fillStyle = "#3e6fb0";
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  // indicador de direção
  ctx.fillStyle = "#e8e2d0";
  ctx.fillRect(pp.x + player.facing * player.radius - 3, pp.y - 3, 6, 6);

  if (player.bleeding) {
    ctx.strokeStyle = "#7a1f1f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, player.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Overlay de escuridão (ciclo dia/noite)
  const darkness = 1 - light;
  if (darkness > 0.02) {
    const gradient = ctx.createRadialGradient(pp.x, pp.y, 40, pp.x, pp.y, Math.max(w, h) * 0.65);
    gradient.addColorStop(0, `rgba(5,7,4,0)`);
    gradient.addColorStop(1, `rgba(5,7,4,${Math.min(0.82, darkness * 0.9)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---------- PWA: service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Falha ao registrar service worker:", err);
    });
  });
}
