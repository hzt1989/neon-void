// The world: state, the fixed-step simulation, collisions, scoring and the
// wave-clear transition. Rendering never touches this; main.js drives it.
import { BEST_KEY, COLORS, COMBO_MAX, COMBO_WINDOW, PLAYER, VIEW } from './config.js';
import { createPlayer, explodeAt, addText, makeEnemy, updateBullets, updateEnemy, updateParticles, updatePlayer } from './entities.js';
import { makeRng } from './utils.js';
import { rollUpgrades } from './upgrades.js';
import { startWave, updateSpawning } from './waves.js';

export function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch { /* best score is a nicety, not a requirement */ }
}

export function createState(seed) {
  const rng = makeRng(seed);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: rng() * VIEW.width,
      y: rng() * VIEW.height,
      size: rng() < 0.85 ? 1 : 2,
      speed: 0.4 + rng() * 1.2,
      phase: rng() * Math.PI * 2,
      color: rng() < 0.8 ? '#cfe6ff' : '#ffd9ec',
    });
  }
  return {
    screen: 'title',
    time: 0,
    rng,
    seed,
    stars,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    particles: [],
    rings: [],
    texts: [],
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    bossSpawned: false,
    score: 0,
    best: loadBest(),
    combo: 0,
    comboTimer: 0,
    kills: 0,
    upgradesTaken: 0,
    upgradeStacks: {},
    upgradeOffer: [],
    upgradeRects: [],
    upgradeTimer: 0,
    shake: 0,
    flash: 0,
    waveBanner: 0,
    waveBannerText: '',
    input: null,
    sound: null,
    demo: false,
    frozen: false,
  };
}

/** Start a fresh run from wave 1. */
export function resetRun(state) {
  state.player = createPlayer();
  state.enemies = [];
  state.bullets = [];
  state.particles = [];
  state.rings = [];
  state.texts = [];
  state.wave = 0;
  state.spawnQueue = [];
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.kills = 0;
  state.upgradesTaken = 0;
  state.upgradeStacks = {};
  state.upgradeOffer = [];
  state.shake = 0;
  state.flash = 0;
  state.screen = 'playing';
  startWave(state, 1);
}

function comboMultiplier(state) {
  return Math.min(COMBO_MAX, 1 + (state.combo - 1) * 0.5);
}

function killEnemy(state, enemy) {
  const idx = state.enemies.indexOf(enemy);
  if (idx !== -1) state.enemies.splice(idx, 1);
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  const gained = Math.round(enemy.score * comboMultiplier(state));
  state.score += gained;
  addText(state, enemy.x, enemy.y - 10, `+${gained}`, COLORS.combo, 16);
  explodeAt(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss');
  state.shake = Math.max(state.shake, enemy.kind === 'boss' ? 20 : 6);
  state.sound.explode(enemy.kind === 'boss' || enemy.kind === 'splitter');
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const mini = makeEnemy('mini', state.wave, state.rng, state.player);
      mini.x = enemy.x + (i === 0 ? -18 : 18);
      mini.y = enemy.y;
      state.enemies.push(mini);
    }
  }
  if (enemy.kind === 'boss') {
    state.boss = null;
    state.score += 500;
    addText(state, enemy.x, enemy.y - 60, 'VOIDLORD DOWN  +500', COLORS.boss, 22);
  }
}

function damagePlayer(state, amount) {
  const p = state.player;
  if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return;
  p.hp -= amount;
  p.invuln = PLAYER.invulnTime;
  state.flash = 0.5;
  state.shake = Math.max(state.shake, 14);
  state.combo = 0;
  state.comboTimer = 0;
  state.sound.playerHit();
  explodeAt(state, p.x, p.y, COLORS.player, false);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    explodeAt(state, p.x, p.y, COLORS.player, true);
    state.shake = 22;
    state.screen = 'over';
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
    state.sound.gameOver();
  }
}

function resolveCollisions(state) {
  const p = state.player;
  // Player bullets against enemies.
  for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
    const b = state.bullets[bi];
    if (!b.friendly) continue;
    let consumed = false;
    for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
      const e = state.enemies[ei];
      if (b.hitSet && b.hitSet.has(e)) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const rr = b.radius + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      e.hp -= b.damage;
      e.flash = 0.12;
      state.sound.enemyHit();
      burstHit(state, b.x, b.y, e.color);
      if (e.hp <= 0) {
        killEnemy(state, e);
      }
      if (b.pierce > 0) {
        b.pierce -= 1;
        if (!b.hitSet) b.hitSet = new Set();
        b.hitSet.add(e);
      } else {
        consumed = true;
      }
      break; // one enemy per bullet per frame
    }
    if (consumed) state.bullets.splice(bi, 1);
  }

  // Enemy bullets and contact against the player.
  if (p.alive) {
    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const b = state.bullets[bi];
      if (b.friendly) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const rr = b.radius + p.radius - 2;
      if (dx * dx + dy * dy <= rr * rr) {
        state.bullets.splice(bi, 1);
        damagePlayer(state, b.damage);
        if (!p.alive) return;
      }
    }
    for (const e of state.enemies) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.radius + p.radius - 2;
      if (dx * dx + dy * dy <= rr * rr) {
        damagePlayer(state, e.damage);
        // Shove the enemy back so one touch is not a chain of hits.
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * 26;
        e.y += (dy / d) * 26;
        if (!p.alive) return;
      }
    }
  }
}

function burstHit(state, x, y, color) {
  for (let i = 0; i < 4; i += 1) {
    const a = state.rng() * Math.PI * 2;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * 160,
      vy: Math.sin(a) * 160,
      life: 0.2,
      maxLife: 0.2,
      size: 2,
      color,
    });
  }
}

/** Advance the simulation one fixed step. `input` looks like the Input class. */
export function stepWorld(state, dt, input) {
  state.time += dt;
  state.waveBanner = Math.max(0, state.waveBanner - dt);
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 1.4);
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  updatePlayer(state, dt, input, state.sound);
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    updateEnemy(state, state.enemies[i], dt, state.sound);
  }
  updateBullets(state, dt);
  updateParticles(state, dt);
  resolveCollisions(state);
  if (state.screen !== 'playing' || !state.player.alive) return;

  if (updateSpawning(state, dt)) {
    // Wave cleared: bonus, then the upgrade draft.
    const bonus = 250 * state.wave;
    state.score += bonus;
    state.texts = [];
    state.upgradeOffer = rollUpgrades(state);
    state.upgradeTimer = 0;
    state.screen = 'upgrade';
    state.sound.upgrade();
  }
}
