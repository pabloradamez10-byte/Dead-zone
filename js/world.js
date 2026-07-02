export class DayNightCycle {
  constructor(dayDurationSeconds = 240) {
    this.dayDuration = dayDurationSeconds; // duração de um ciclo completo dia+noite
    this.elapsed = 0;
    this.day = 1;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.dayDuration) {
      this.elapsed -= this.dayDuration;
      this.day += 1;
    }
  }

  // 0 = meia-noite (mais escuro), 1 = meio-dia (mais claro)
  get lightLevel() {
    const t = this.elapsed / this.dayDuration; // 0..1
    // curva suave: começa às 06:00 claro, escurece às 18:00
    return 0.5 - 0.5 * Math.cos(t * Math.PI * 2 - Math.PI / 2) > 0
      ? Math.max(0.15, Math.sin(t * Math.PI))
      : 0.15;
  }

  get isNight() {
    return this.lightLevel < 0.35;
  }

  get clockLabel() {
    const t = this.elapsed / this.dayDuration; // 0..1 do ciclo
    const totalMinutes = Math.floor(t * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `DIA ${this.day} \u00b7 ${hh}:${mm}`;
  }

  toJSON() {
    return { elapsed: this.elapsed, day: this.day, dayDuration: this.dayDuration };
  }

  loadFrom(data) {
    if (!data) return;
    this.elapsed = data.elapsed ?? 0;
    this.day = data.day ?? 1;
    this.dayDuration = data.dayDuration ?? this.dayDuration;
  }
}
