const SAVE_KEY = "deadzone_save_v1";

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(player, world) {
  const data = {
    x: player.x,
    y: player.y,
    health: player.health,
    stamina: player.stamina,
    hunger: player.hunger,
    thirst: player.thirst,
    infected: player.infected,
    infectionTimer: player.infectionTimer,
    bleeding: player.bleeding,
    kills: player.kills,
    inventory: player.inventory.toJSON(),
    world: world.toJSON(),
    savedAt: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Save corrompido, ignorando.", e);
    return null;
  }
}

export function applySaveToPlayer(player, data) {
  player.x = data.x;
  player.y = data.y;
  player.health = data.health;
  player.stamina = data.stamina;
  player.hunger = data.hunger;
  player.thirst = data.thirst;
  player.infected = data.infected;
  player.infectionTimer = data.infectionTimer;
  player.bleeding = data.bleeding;
  player.kills = data.kills ?? 0;
  player.inventory.loadFrom(data.inventory);
  player.alive = true;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
