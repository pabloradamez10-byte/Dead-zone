import { ITEM_DB, RECIPES, canCraft, craft } from "./items.js";

export class Joystick {
  constructor(zoneEl, bgEl, handleEl) {
    this.zone = zoneEl;
    this.bg = bgEl;
    this.handle = handleEl;
    this.active = false;
    this.vec = { x: 0, y: 0 };
    this.pointerId = null;

    this.zone.addEventListener("pointerdown", (e) => this._start(e));
    window.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", (e) => this._end(e));
    window.addEventListener("pointercancel", (e) => this._end(e));
  }

  _start(e) {
    this.active = true;
    this.pointerId = e.pointerId;
    this._move(e);
  }

  _move(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    const rect = this.bg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const maxR = rect.width / 2;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    this.handle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.vec = { x: dx / maxR, y: dy / maxR };
  }

  _end(e) {
    if (e.pointerId !== this.pointerId && this.pointerId !== null) return;
    this.active = false;
    this.pointerId = null;
    this.vec = { x: 0, y: 0 };
    this.handle.style.transform = `translate(-50%, -50%)`;
  }
}

export class HUD {
  constructor() {
    this.el = document.getElementById("hud");
    this.barHealth = document.getElementById("bar-health");
    this.barStamina = document.getElementById("bar-stamina");
    this.barHunger = document.getElementById("bar-hunger");
    this.barThirst = document.getElementById("bar-thirst");
    this.infectionText = document.getElementById("infection-text");
    this.daynightText = document.getElementById("daynight-text");
    this.killText = document.getElementById("kill-text");
    this.toastEl = document.getElementById("toast");
    this._toastTimer = null;
  }

  show() { this.el.classList.remove("hidden"); }
  hide() { this.el.classList.add("hidden"); }

  update(player, world) {
    this.barHealth.style.width = `${(player.health / player.maxHealth) * 100}%`;
    this.barStamina.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
    this.barHunger.style.width = `${player.hunger}%`;
    this.barThirst.style.width = `${player.thirst}%`;

    if (player.infected) {
      const remaining = Math.max(0, player.timeToTurn - player.infectionTimer);
      this.infectionText.textContent = `INFECTADO: ${Math.ceil(remaining)}s`;
      this.infectionText.classList.add("active");
    } else {
      this.infectionText.classList.remove("active");
    }

    this.daynightText.textContent = world.clockLabel;
    this.killText.textContent = `Abates: ${player.kills}`;
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove("show"), 1600);
  }
}

export class InventoryPanel {
  constructor(onUse) {
    this.el = document.getElementById("inventory-panel");
    this.grid = document.getElementById("inventory-grid");
    this.onUse = onUse;
  }

  render(inventory) {
    this.grid.innerHTML = "";
    const entries = Object.entries(inventory.items);
    if (entries.length === 0) {
      this.grid.innerHTML = `<div style="opacity:0.6; grid-column: 1 / -1;">Mochila vazia.</div>`;
      return;
    }
    entries.forEach(([itemId, qty]) => {
      const def = ITEM_DB[itemId];
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.style.borderColor = def.color;
      slot.innerHTML = `${def.name}<br><span class="qty">x${qty}</span>`;
      slot.addEventListener("click", () => this.onUse(itemId));
      this.grid.appendChild(slot);
    });
  }

  open() { this.el.classList.remove("hidden"); }
  close() { this.el.classList.add("hidden"); }
}

export class CraftPanel {
  constructor(onCraft) {
    this.el = document.getElementById("craft-panel");
    this.list = document.getElementById("craft-list");
    this.onCraft = onCraft;
  }

  render(inventory) {
    this.list.innerHTML = "";
    RECIPES.forEach((recipe) => {
      const ok = canCraft(inventory, recipe);
      const needsStr = Object.entries(recipe.needs)
        .map(([id, qty]) => `${ITEM_DB[id].name} x${qty}`)
        .join(", ");
      const row = document.createElement("div");
      row.className = "recipe-row";
      row.innerHTML = `<span>${recipe.name}<br><small style="opacity:0.6">${needsStr}</small></span>`;
      const btn = document.createElement("button");
      btn.textContent = "Fabricar";
      btn.disabled = !ok;
      btn.addEventListener("click", () => this.onCraft(recipe));
      row.appendChild(btn);
      this.list.appendChild(row);
    });
  }

  open() { this.el.classList.remove("hidden"); }
  close() { this.el.classList.add("hidden"); }
}
