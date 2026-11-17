// Wave control: what spawns, when a wave is over, and the boss every 5 waves.
import { waveEnemyCount, waveKinds } from './config.js';
import { makeBoss, makeEnemy } from './entities.js';

export function startWave(state, wave) {
  state.wave = wave;
  state.spawnQueue = [];
  const kinds = waveKinds(wave);
  const count = waveEnemyCount(wave);
  for (let i = 0; i < count; i += 1) {
    // Early waves are mostly chasers; later waves mix in shooters and splitters.
    let kind = 'chaser';
    const roll = state.rng();
    if (wave >= 3 && roll < 0.2) kind = 'splitter';
    else if (wave >= 2 && roll < 0.45) kind = 'shooter';
    if (!kinds.includes(kind)) kind = 'chaser';
    state.spawnQueue.push(kind);
  }
  state.spawnTimer = 0.4;
  state.bossSpawned = false;
  state.boss = null;
  if (wave % 5 === 0) {
    state.boss = makeBoss(wave, state.rng, state.player);
    state.enemies.push(state.boss);
    state.bossSpawned = true;
  }
  state.waveBanner = 2.2; // seconds the "WAVE N" banner shows
  state.waveBannerText = wave % 5 === 0 ? `WAVE ${wave} — VOIDLORD` : `WAVE ${wave}`;
}

/** Trickle queued enemies into the arena; returns true when the wave is cleared. */
export function updateSpawning(state, dt) {
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 0.55;
      const kind = state.spawnQueue.shift();
      state.enemies.push(makeEnemy(kind, state.wave, state.rng, state.player));
    }
  }
  return state.spawnQueue.length === 0 && state.enemies.length === 0;
}
