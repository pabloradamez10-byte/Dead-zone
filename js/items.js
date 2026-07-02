// Catálogo de itens do jogo (equivalente ao ItemData.cs / ScriptableObject na Unity)
export const ITEM_TYPES = {
  FOOD: "food",
  WATER: "water",
  BANDAGE: "bandage",
  MEDKIT: "medkit",
  CLOTH: "cloth",
  WOOD: "wood",
  SCRAP: "scrap",
};

export const ITEM_DB = {
  milho:    { id: "milho",    name: "Milho Assado",   type: ITEM_TYPES.FOOD,    effect: 30, color: "#c99a3e" },
  agua:     { id: "agua",     name: "Cantil d'Água",  type: ITEM_TYPES.WATER,   effect: 35, color: "#3e7fc9" },
  atadura:  { id: "atadura",  name: "Atadura",        type: ITEM_TYPES.BANDAGE, effect: 0,  color: "#e8e2d0" },
  medkit:   { id: "medkit",   name: "Kit Médico",     type: ITEM_TYPES.MEDKIT,  effect: 50, color: "#7a1f1f" },
  pano:     { id: "pano",     name: "Pano Velho",     type: ITEM_TYPES.CLOTH,   effect: 0,  color: "#8a9a3c" },
  madeira:  { id: "madeira",  name: "Madeira",        type: ITEM_TYPES.WOOD,    effect: 0,  color: "#6b4a2b" },
  sucata:   { id: "sucata",   name: "Sucata",         type: ITEM_TYPES.SCRAP,   effect: 0,  color: "#888" },
};

export const LOOT_TABLE = ["milho", "agua", "atadura", "pano", "madeira", "sucata", "medkit"];
export const LOOT_WEIGHTS = [22, 22, 18, 16, 12, 8, 2]; // medkit é raro

export function rollLoot() {
  const total = LOOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < LOOT_TABLE.length; i++) {
    r -= LOOT_WEIGHTS[i];
    if (r <= 0) return LOOT_TABLE[i];
  }
  return LOOT_TABLE[0];
}

export const RECIPES = [
  { id: "craft_atadura", name: "Atadura", result: "atadura", resultQty: 1, needs: { pano: 2 } },
  { id: "craft_medkit", name: "Kit Médico", result: "medkit", resultQty: 1, needs: { atadura: 2, pano: 1 } },
  { id: "craft_reforco", name: "Reforço de Base (sucata)", result: "sucata", resultQty: 2, needs: { madeira: 3 } },
];

// Inventário: mapa itemId -> quantidade (equivalente ao Inventory.cs)
export class Inventory {
  constructor(maxSlots = 20) {
    this.maxSlots = maxSlots;
    this.items = {}; // { itemId: qty }
  }

  get slotCount() {
    return Object.keys(this.items).length;
  }

  addItem(itemId, qty = 1) {
    if (!this.items[itemId] && this.slotCount >= this.maxSlots) return false;
    this.items[itemId] = (this.items[itemId] || 0) + qty;
    return true;
  }

  removeItem(itemId, qty = 1) {
    if (!this.items[itemId] || this.items[itemId] < qty) return false;
    this.items[itemId] -= qty;
    if (this.items[itemId] <= 0) delete this.items[itemId];
    return true;
  }

  has(itemId, qty = 1) {
    return (this.items[itemId] || 0) >= qty;
  }

  toJSON() {
    return { ...this.items };
  }

  loadFrom(data) {
    this.items = { ...(data || {}) };
  }
}

export function canCraft(inventory, recipe) {
  return Object.entries(recipe.needs).every(([id, qty]) => inventory.has(id, qty));
}

export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return false;
  Object.entries(recipe.needs).forEach(([id, qty]) => inventory.removeItem(id, qty));
  inventory.addItem(recipe.result, recipe.resultQty);
  return true;
}
