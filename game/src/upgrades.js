// The upgrade draft shown between waves: pick 3 distinct upgrades the player
// has not maxed out, apply the chosen one to the player.
import { UPGRADES } from './config.js';
import { pickDistinct } from './utils.js';

/** Offer three upgrades, skipping ones already at their stack cap. */
export function rollUpgrades(state) {
  const available = UPGRADES.filter((u) => {
    const stacks = state.upgradeStacks[u.id] || 0;
    return !u.maxStacks || stacks < u.maxStacks;
  });
  const pool = available.length >= 3 ? available : UPGRADES;
  return pickDistinct(pool, 3, state.rng);
}

export function applyUpgrade(state, upgrade) {
  upgrade.apply(state.player);
  state.upgradeStacks[upgrade.id] = (state.upgradeStacks[upgrade.id] || 0) + 1;
  state.upgradesTaken += 1;
}
