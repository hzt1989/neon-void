// Entities: the player ship, enemy kinds, bullets, particles and floating text.
// This file knows how things move and spawn; main.js decides collisions and score.
import { COLORS, ENEMIES, PLAYER, VIEW, waveScale } from './config.js';
import { angleDelta, clamp } from './utils.js';

export function createPlayer() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    fireTimer: 0,
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    maxSpeed: PLAYER.maxSpeed,
    projectiles: 1,
    pierce: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashCooldownMax: PLAYER.dashCooldown,
    dashDirX: 0,
    dashDirY: -1,
    invuln: 0,
    thrustTimer: 0,
    alive: true,
  };
}

/** Spawn one enemy of `kind` at the arena edge, away from the player. */
export function makeEnemy(kind, wave, rng, player) {
  const def = ENEMIES[kind];
  const scale = waveScale(wave);
  const margin = 60;
  let x = 0;
  let y = 0;
  // Pick an edge point at least 320px from the player so spawns never ambush.
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = Math.floor(rng() * 4);
    if (edge === 0) { x = margin + rng() * (VIEW.width - margin * 2); y = margin; }
    if (edge === 1) { x = margin + rng() * (VIEW.width - margin * 2); y = VIEW.height - margin; }
    if (edge === 2) { x = margin; y = margin + rng() * (VIEW.height - margin * 2); }
    if (edge === 3) { x = VIEW.width - margin; y = margin + rng() * (VIEW.height - margin * 2); }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 320 * 320) break;
  }
  return {
    kind,
    x, y,
    vx: 0,
    vy: 0,
    angle: rng() * Math.PI * 2,
    radius: def.radius,
    hp: Math.round(def.hp * scale.hp),
    maxHp: Math.round(def.hp * scale.hp),
    speed: def.speed * scale.speed * (0.9 + rng() * 0.2),
    score: def.score,
    damage: def.damage,
    color: def.color,
    fireTimer: 1.2 + rng() * 1.2,
    burstTimer: 2.4,
    spawnTimer: 4.5,
    spawnAngle: rng() * Math.PI * 2,
    wobble: rng() * Math.PI * 2,
    flash: 0,
    charging: false,
  };
}

export function makeBoss(wave, rng, player) {
  const boss = makeEnemy('boss', wave, rng, player);
  boss.hp = Math.round(ENEMIES.boss.hp * (1 + (wave - 5) * 0.18));
  boss.maxHp = boss.hp;
  boss.x = VIEW.width / 2;
  boss.y = 90;
  return boss;
}

/** Fire the player's current spread. Returns nothing; appends to state.bullets. */
export function firePlayerBullets(state, sound) {
  const p = state.player;
  const spread = 0.09; // radians between neighbouring projectiles
  const count = p.projectiles;
  const base = Math.atan2(state.input.mouseY - p.y, state.input.mouseX - p.x);
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const a = base + offset;
    state.bullets.push({
      x: p.x + Math.cos(a) * (p.radius + 8),
      y: p.y + Math.sin(a) * (p.radius + 8),
      vx: Math.cos(a) * p.bulletSpeed,
      vy: Math.sin(a) * p.bulletSpeed,
      radius: PLAYER.bulletRadius,
      damage: p.bulletDamage,
      pierce: p.pierce,
      friendly: true,
      life: 1.1,
    });
  }
  // Muzzle flash: a few bright sparks at the nose.
  burst(state, p.x + Math.cos(base) * (p.radius + 10), p.y + Math.sin(base) * (p.radius + 10), COLORS.bullet, 3, 140, 0.12);
  sound.shoot();
}

/** A short-lived spark burst. */
export function burst(state, x, y, color, count, speed, life = 0.5) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + state.rng() * 0.6),
      maxLife: life,
      size: 1.5 + state.rng() * 2.5,
      color,
    });
  }
}

/** An explosion: sparks plus a fading ring handled by the particle list. */
export function explodeAt(state, x, y, color, big) {
  burst(state, x, y, color, big ? 42 : 22, big ? 380 : 300, big ? 0.8 : 0.55);
  burst(state, x, y, '#ffffff', big ? 10 : 5, 200, 0.3);
  state.rings.push({ x, y, radius: 6, maxRadius: big ? 130 : 70, life: 0.45, maxLife: 0.45, color });
}

/** Floating score text that rises and fades. */
export function addText(state, x, y, text, color = COLORS.text, size = 16) {
  state.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

export function updatePlayer(state, dt, input, sound) {
  const p = state.player;
  if (!p.alive) return;
  const move = input.moveVector();

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDirX * PLAYER.dashSpeed;
    p.vy = p.dashDirY * PLAYER.dashSpeed;
    burst(state, p.x, p.y, COLORS.player, 2, 120, 0.25);
  } else {
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const damp = Math.pow(PLAYER.friction, dt * 60);
    p.vx *= damp;
    p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > p.maxSpeed) {
      p.vx = (p.vx / speed) * p.maxSpeed;
      p.vy = (p.vy / speed) * p.maxSpeed;
    }
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, VIEW.width - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, VIEW.height - p.radius);
  if (p.x === p.radius || p.x === VIEW.width - p.radius) p.vx = 0;
  if (p.y === p.radius || p.y === VIEW.height - p.radius) p.vy = 0;

  // Turn toward the mouse, limited so the ship visibly swings.
  const aim = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  p.angle += clamp(angleDelta(p.angle, aim), -PLAYER.turnRate * dt, PLAYER.turnRate * dt);

  // Dash: a burst of speed in the movement (or facing) direction.
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (input.dashHeld() && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    const dx = move.x !== 0 || move.y !== 0 ? move.x : Math.cos(p.angle);
    const dy = move.x !== 0 || move.y !== 0 ? move.y : Math.sin(p.angle);
    const len = Math.hypot(dx, dy) || 1;
    p.dashDirX = dx / len;
    p.dashDirY = dy / len;
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = p.dashCooldownMax;
    p.invuln = Math.max(p.invuln, 0.28);
    sound.dash();
  }

  // Thruster sparks while moving.
  p.thrustTimer -= dt;
  if ((move.x !== 0 || move.y !== 0) && p.thrustTimer <= 0) {
    p.thrustTimer = 0.03;
    const back = p.angle + Math.PI;
    burst(state, p.x + Math.cos(back) * p.radius, p.y + Math.sin(back) * p.radius, COLORS.player, 1, 90, 0.3);
  }

  p.invuln = Math.max(0, p.invuln - dt);

  // Firing.
  p.fireTimer -= dt;
  if (input.firing() && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval;
    firePlayerBullets(state, sound);
  }
}

/** Move one enemy toward its behaviour; shooters and the boss also fire. */
export function updateEnemy(state, e, dt, sound) {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  e.flash = Math.max(0, e.flash - dt);

  if (e.kind === 'chaser' || e.kind === 'mini') {
    const wob = e.kind === 'mini' ? Math.sin(state.time * 6 + e.wobble) * 0.5 : 0;
    const ax = nx + -ny * wob;
    const ay = ny + nx * wob;
    e.vx += ax * 900 * dt;
    e.vy += ay * 900 * dt;
    const sp = Math.hypot(e.vx, e.vy);
    if (sp > e.speed) { e.vx = (e.vx / sp) * e.speed; e.vy = (e.vy / sp) * e.speed; }
    e.angle = Math.atan2(e.vy, e.vx);
  } else if (e.kind === 'shooter') {
    // Keep a firing distance: approach when far, back off when close, strafe.
    const strafe = Math.sin(state.time * 1.4 + e.wobble);
    let mx = 0;
    let my = 0;
    if (dist > 300) { mx = nx; my = ny; }
    else if (dist < 220) { mx = -nx; my = -ny; }
    mx += -ny * strafe * 0.5;
    my += nx * strafe * 0.5;
    e.vx = mx * e.speed;
    e.vy = my * e.speed;
    e.angle = Math.atan2(dy, dx);
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 620 && p.alive) {
      e.fireTimer = 1.6 + state.rng() * 0.7;
      const lead = 0.35;
      const tx = p.x + p.vx * lead;
      const ty = p.y + p.vy * lead;
      const a = Math.atan2(ty - e.y, tx - e.x);
      state.bullets.push({
        x: e.x + Math.cos(a) * (e.radius + 6),
        y: e.y + Math.sin(a) * (e.radius + 6),
        vx: Math.cos(a) * 300,
        vy: Math.sin(a) * 300,
        radius: 6,
        damage: 12,
        pierce: 0,
        friendly: false,
        life: 4,
      });
      sound.blip({ type: 'square', from: 220, to: 140, dur: 0.08, vol: 0.08 });
    }
  } else if (e.kind === 'splitter') {
    e.vx = nx * e.speed;
    e.vy = ny * e.speed;
    e.angle += dt * 0.8;
  } else if (e.kind === 'boss') {
    e.vx = nx * e.speed;
    e.vy = ny * e.speed;
    e.angle += dt * 0.6;
    e.burstTimer -= dt;
    e.charging = e.burstTimer < 0.6;
    if (e.burstTimer <= 0) {
      e.burstTimer = 2.6;
      const n = 14;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + e.angle;
        state.bullets.push({
          x: e.x + Math.cos(a) * (e.radius + 4),
          y: e.y + Math.sin(a) * (e.radius + 4),
          vx: Math.cos(a) * 210,
          vy: Math.sin(a) * 210,
          radius: 6,
          damage: 14,
          pierce: 0,
          friendly: false,
          life: 5,
        });
      }
      sound.bossAlarm();
    }
    e.spawnTimer -= dt;
    if (e.spawnTimer <= 0) {
      e.spawnTimer = 5;
      for (let i = 0; i < 2; i += 1) {
        const m = makeEnemy('mini', state.wave, state.rng, p);
        m.x = e.x + Math.cos(e.spawnAngle + i * 2.1) * (e.radius + 14);
        m.y = e.y + Math.sin(e.spawnAngle + i * 2.1) * (e.radius + 14);
        state.enemies.push(m);
      }
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = clamp(e.x, e.radius, VIEW.width - e.radius);
  e.y = clamp(e.y, e.radius, VIEW.height - e.radius);
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20) {
      state.bullets.splice(i, 1);
    }
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.12, dt);
    pt.vy *= Math.pow(0.12, dt);
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.rings.length - 1; i >= 0; i -= 1) {
    const r = state.rings[i];
    r.life -= dt;
    r.radius = r.maxRadius * (1 - Math.max(0, r.life) / r.maxLife);
    if (r.life <= 0) state.rings.splice(i, 1);
  }
  for (let i = state.texts.length - 1; i >= 0; i -= 1) {
    const t = state.texts[i];
    t.y -= 42 * dt;
    t.life -= dt;
    if (t.life <= 0) state.texts.splice(i, 1);
  }
}
