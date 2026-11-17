// Autopilot: plays the game itself. Used by ?demo=1 (live) and by the ?shot=
// screenshot scenes, which run the real rules forward with a fixed seed.
// skill 1 plays to win; skill 0 never fires and only drifts, so it loses.
import { VIEW } from './config.js';
import { angleDelta } from './utils.js';
import { startWave } from './waves.js';

function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return { enemy: best, dist: bestD };
}

function nearestBullet(state) {
  let best = null;
  let bestD = Infinity;
  for (const b of state.bullets) {
    if (b.friendly) continue;
    const d = Math.hypot(b.x - state.player.x, b.y - state.player.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return { bullet: best, dist: bestD };
}

/**
 * An input-like object ({ moveVector, firing, dashHeld, mouseX, mouseY })
 * for this frame. Computed fresh each call so the pilot reacts to the world.
 */
export function autopilotInput(state, skill = 1) {
  const p = state.player;
  const { enemy, dist: eDist } = nearestEnemy(state);
  const { bullet, dist: bDist } = nearestBullet(state);

  let mouseX = p.x;
  let mouseY = p.y - 120;
  if (enemy) { mouseX = enemy.x; mouseY = enemy.y; }

  let mx = 0;
  let my = 0;
  let firing = false;
  let dash = false;

  if (skill < 1) {
    // The losing pilot: drift to the centre and never dash. At skill 0.5 it
    // still shoots, so it scores a few kills before the void takes it.
    mx = (VIEW.width / 2 - p.x) / 400;
    my = (VIEW.height / 2 - p.y) / 400;
    if (skill >= 0.5 && enemy && eDist < 780) {
      const aim = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      firing = Math.abs(angleDelta(p.angle, aim)) < 0.5;
    }
  } else {
    // Kite around the arena centre: the anchor point sits on a ring around
    // the centre, on the far side of the nearest enemy, so the pilot orbits
    // instead of backing into a corner. Bullets add a sidestep.
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    let ax = cx;
    let ay = cy;
    if (enemy) {
      const ex = p.x - enemy.x;
      const ey = p.y - enemy.y;
      const el = Math.hypot(ex, ey) || 1;
      ax = cx + (ex / el) * 230;
      ay = cy + (ey / el) * 230;
      // Close in a little when far, so shots land.
      if (eDist > 420) { ax += ((enemy.x - p.x) / eDist) * 90; ay += ((enemy.y - p.y) / eDist) * 90; }
    }
    mx = (ax - p.x) / 220;
    my = (ay - p.y) / 220;
    if (bullet && bDist < 150) {
      const w = (150 - bDist) / 150;
      mx += ((p.x - bullet.x) / bDist) * w * 1.4;
      my += ((p.y - bullet.y) / bDist) * w * 1.4;
    }
    if (enemy && eDist < 780) {
      const aim = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      firing = Math.abs(angleDelta(p.angle, aim)) < 0.5;
    }
    if ((enemy && eDist < 85) || (bullet && bDist < 60)) dash = true;
  }

  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  return {
    mouseX,
    mouseY,
    moveVector: () => ({ x: mx, y: my }),
    firing: () => firing,
    dashHeld: () => dash,
  };
}

/**
 * Stage a screenshot scene on a fresh state and return the screen to show.
 * The world is stepped forward with the autopilot at a fixed 60 Hz, so the
 * same seed always gives the same frame. `step` is stepWorld from world.js.
 */
export function stageShot(state, name, step) {
  const STEP = 1 / 60;
  if (name === 'boss') {
    // Jump straight to the boss wave and fight it for a few seconds.
    state.screen = 'playing';
    state.enemies = [];
    state.spawnQueue = [];
    state.score = 1250;
    state.kills = 14;
    state.combo = 4;
    state.comboTimer = 2;
    startWave(state, 5);
    for (let i = 0; i < 7 / STEP; i += 1) {
      if (state.screen !== 'playing') break;
      step(state, STEP, autopilotInput(state, 1));
    }
    return state.screen;
  }
  if (name === 'upgrade') {
    for (let i = 0; i < 150 / STEP; i += 1) {
      if (state.screen !== 'playing') break;
      step(state, STEP, autopilotInput(state, 1));
    }
    return state.screen;
  }
  if (name === 'end') {
    for (let i = 0; i < 300 / STEP; i += 1) {
      if (state.screen === 'over') break;
      step(state, STEP, autopilotInput(state, 0.5));
    }
    return state.screen;
  }
  if (name === 'start') {
    return 'title';
  }
  if (name === 'play') {
    // Wave 2: shooters keep their distance, so the fight spreads across the arena.
    startWave(state, 2);
    for (let i = 0; i < 10 / STEP; i += 1) {
      if (state.screen !== 'playing') break;
      step(state, STEP, autopilotInput(state, 1));
    }
    return state.screen;
  }
  // Anything else: a dozen seconds of wave-1 combat.
  for (let i = 0; i < 13 / STEP; i += 1) {
    if (state.screen !== 'playing') break;
    step(state, STEP, autopilotInput(state, 1));
  }
  return state.screen;
}
