import { Inventory } from "./items.js";

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.facing = 1; // 1 = direita, -1 = esquerda

    this.walkSpeed = 130; // px/s
    this.runSpeed = 220;

    this.maxHealth = 100; this.health = 100;
    this.maxStamina = 100; this.stamina = 100;
    this.hunger = 100;
    this.thirst = 100;

    this.infected = false;
    this.infectionTimer = 0;
    this.timeToTurn = 120; // segundos

    this.bleeding = false;
    this.bleedDps = 3;

    this.inventory = new Inventory(20);
    this.inventory.addItem("milho", 2);
    this.inventory.addItem("agua", 2);
    this.inventory.addItem("atadura", 1);

    this.kills = 0;
    this.alive = true;
    this.isRunning = false;

    this._needsTimer = 0;
  }

  update(dt, moveVec) {
    if (!this.alive) return;

    // Movimento
    const speed = this.isRunning && this.stamina > 0 ? this.runSpeed : this.walkSpeed;
    this.x += moveVec.x * speed * dt;
    this.y += moveVec.y * speed * dt;

    if (moveVec.x > 0.1) this.facing = 1;
    else if (moveVec.x < -0.1) this.facing = -1;

    // Stamina
    if (this.isRunning && (moveVec.x !== 0 || moveVec.y !== 0) && this.stamina > 0) {
      this.stamina -= 15 * dt;
    } else {
      this.stamina += 8 * dt;
    }
    this.stamina = clamp(this.stamina, 0, this.maxStamina);

    // Fome / sede a cada 3s (equivalente ao InvokeRepeating)
    this._needsTimer += dt;
    if (this._needsTimer >= 3) {
      this._needsTimer = 0;
      this.hunger = clamp(this.hunger - 3, 0, 100);
      this.thirst = clamp(this.thirst - 4, 0, 100);
      if (this.hunger <= 0) this.takeDamage(3);
      if (this.thirst <= 0) this.takeDamage(5);
    }

    // Infecção
    if (this.infected) {
      this.infectionTimer += dt;
      if (this.infectionTimer >= this.timeToTurn) {
        this.takeDamage(9999);
      }
    }

    // Sangramento
    if (this.bleeding) {
      this.takeDamage(this.bleedDps * dt);
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    if (this.health <= 0) this.die();
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  eat(amount) {
    this.hunger = clamp(this.hunger + amount, 0, 100);
  }

  drink(amount) {
    this.thirst = clamp(this.thirst + amount, 0, 100);
  }

  infect() {
    if (this.infected) return;
    this.infected = true;
    this.infectionTimer = 0;
  }

  cure() {
    this.infected = false;
    this.infectionTimer = 0;
  }

  startBleeding() { this.bleeding = true; }
  stopBleeding() { this.bleeding = false; }

  die() {
    this.alive = false;
    this.health = 0;
  }

  useItem(itemId, itemDef) {
    if (!this.inventory.has(itemId)) return false;

    switch (itemDef.type) {
      case "food": this.eat(itemDef.effect); break;
      case "water": this.drink(itemDef.effect); break;
      case "bandage": this.stopBleeding(); break;
      case "medkit": this.heal(itemDef.effect); break;
      default: return false; // materiais (pano/madeira/sucata) não são "usáveis" direto
    }
    this.inventory.removeItem(itemId, 1);
    return true;
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
