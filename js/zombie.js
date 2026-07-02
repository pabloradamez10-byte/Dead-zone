export const ZOMBIE_TYPES = {
  normal: { speed: 70, health: 100, damage: 10, color: "#4a5a3a", radius: 13 },
  runner: { speed: 150, health: 60, damage: 8, color: "#8a2e2e", radius: 11 },
  tank:   { speed: 35, health: 250, damage: 20, color: "#555555", radius: 18 },
};

let idCounter = 0;

export class Zombie {
  constructor(x, y, type = "normal") {
    this.id = ++idCounter;
    this.x = x;
    this.y = y;
    this.type = type;
    const stats = ZOMBIE_TYPES[type];
    this.speed = stats.speed;
    this.maxHealth = stats.health;
    this.health = stats.health;
    this.damage = stats.damage;
    this.color = stats.color;
    this.radius = stats.radius;

    this.detectionRange = 260;
    this.attackRange = 22;
    this.alive = true;
    this.facing = 1;
    this._attackCooldown = 0;
  }

  update(dt, player, onAttackPlayer) {
    if (!this.alive || !player.alive) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    this._attackCooldown = Math.max(0, this._attackCooldown - dt);

    if (dist <= this.detectionRange) {
      if (dist > this.attackRange) {
        const nx = dx / dist, ny = dy / dist;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        this.facing = nx >= 0 ? 1 : -1;
      } else if (this._attackCooldown === 0) {
        onAttackPlayer(this.damage);
        this._attackCooldown = 0.9;
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  // Grito: aumenta a percepção de zumbis próximos (equivalente a Scream() na Unity)
  static scream(source, allZombies, radius = 220) {
    for (const z of allZombies) {
      if (z === source || !z.alive) continue;
      const d = Math.hypot(z.x - source.x, z.y - source.y);
      if (d <= radius) z.detectionRange = Math.max(z.detectionRange, 420);
    }
  }
}

// Spawner: escolhe tipo aleatório, respeita raio/limite e intervalo controlado pelo ciclo dia/noite
export class ZombieSpawner {
  constructor(centerGetter, opts = {}) {
    this.centerGetter = centerGetter; // função que retorna {x,y} do player, spawn ao redor dele fora da tela
    this.interval = opts.interval ?? 5;
    this.spawnRadius = opts.spawnRadius ?? 420;
    this.minRadius = opts.minRadius ?? 320;
    this.maxZombies = opts.maxZombies ?? 30;
    this._timer = 0;
  }

  update(dt, zombies) {
    this._timer += dt;
    if (this._timer < this.interval) return null;
    this._timer = 0;

    const alive = zombies.filter((z) => z.alive).length;
    if (alive >= this.maxZombies) return null;

    const center = this.centerGetter();
    const angle = Math.random() * Math.PI * 2;
    const r = this.minRadius + Math.random() * (this.spawnRadius - this.minRadius);
    const x = center.x + Math.cos(angle) * r;
    const y = center.y + Math.sin(angle) * r;

    const roll = Math.random();
    const type = roll < 0.6 ? "normal" : roll < 0.85 ? "runner" : "tank";

    return new Zombie(x, y, type);
  }

  setInterval(seconds) {
    this.interval = seconds;
  }
}
