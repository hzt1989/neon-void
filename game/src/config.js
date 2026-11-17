// NEON VOID tuning: every number that shapes how the game feels lives here.
export const VIEW = { width: 1280, height: 800 };

export const COLORS = {
  bg: '#05060f',
  grid: 'rgba(56, 120, 255, 0.07)',
  player: '#2ee6ff',
  playerCore: '#eafcff',
  bullet: '#ffe45e',
  chaser: '#ff2e88',
  shooter: '#ff9f1c',
  splitter: '#3dff7a',
  mini: '#ff5d5d',
  boss: '#c44dff',
  enemyBullet: '#ff3b30',
  particle: '#ffffff',
  text: '#dfe9ff',
  dim: '#8a97b8',
  hp: '#2ee6ff',
  hpLow: '#ff3b30',
  combo: '#ffe45e',
  card: 'rgba(12, 18, 44, 0.92)',
  cardEdge: '#2ee6ff',
};

export const PLAYER = {
  radius: 16,
  accel: 2400,
  maxSpeed: 340,
  friction: 0.86, // per-frame velocity retention at 60fps, applied as pow
  hp: 100,
  fireInterval: 0.16,
  bulletSpeed: 780,
  bulletDamage: 10,
  bulletRadius: 5,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.5,
  invulnTime: 0.9,
  turnRate: 22, // radians per second toward the mouse
};

export const ENEMIES = {
  chaser:   { radius: 17, hp: 30,  speed: 165, score: 100, damage: 15, color: COLORS.chaser },
  shooter:  { radius: 18, hp: 40,  speed: 120, score: 150, damage: 10, color: COLORS.shooter },
  splitter: { radius: 26, hp: 60,  speed: 85,  score: 200, damage: 18, color: COLORS.splitter },
  mini:     { radius: 10, hp: 10,  speed: 235, score: 50,  damage: 10, color: COLORS.mini },
  boss:     { radius: 62, hp: 900, speed: 62,  score: 1000, damage: 25, color: COLORS.boss },
};

// Wave N (1-based) spawns this many non-boss enemies, trickled in over the wave.
export function waveEnemyCount(wave) {
  return 6 + wave * 3;
}

// Enemy speed and hp scale gently with the wave so late waves stay fair.
export function waveScale(wave) {
  return {
    speed: 1 + Math.min(0.6, (wave - 1) * 0.045),
    hp: 1 + Math.min(1.2, (wave - 1) * 0.09),
  };
}

// Which enemy kinds a wave may spawn. Shooters join at wave 2, splitters at wave 3.
export function waveKinds(wave) {
  const kinds = ['chaser'];
  if (wave >= 2) kinds.push('shooter');
  if (wave >= 3) kinds.push('splitter');
  return kinds;
}

export const COMBO_WINDOW = 3.0; // seconds between kills to keep the chain alive
export const COMBO_MAX = 8; // multiplier caps at x8

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    desc: 'Fire rate +15%',
    apply: (p) => { p.fireInterval *= 0.85; },
  },
  {
    id: 'heavy',
    name: 'HEAVY ROUNDS',
    desc: 'Bullet damage +25%',
    apply: (p) => { p.bulletDamage *= 1.25; },
  },
  {
    id: 'thrusters',
    name: 'ION THRUSTERS',
    desc: 'Move speed +12%',
    apply: (p) => { p.maxSpeed *= 1.12; },
  },
  {
    id: 'hull',
    name: 'REINFORCED HULL',
    desc: 'Max HP +25 and heal 25',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'dash',
    name: 'DASH RECHARGE',
    desc: 'Dash cooldown -30%',
    apply: (p) => { p.dashCooldownMax *= 0.7; },
  },
  {
    id: 'multishot',
    name: 'MULTISHOT',
    desc: '+1 projectile per shot',
    apply: (p) => { p.projectiles += 1; },
    maxStacks: 3,
  },
  {
    id: 'pierce',
    name: 'PIERCING ROUNDS',
    desc: 'Bullets pierce +1 enemy',
    apply: (p) => { p.pierce += 1; },
    maxStacks: 3,
  },
];

export const BEST_KEY = 'neon-void-best';
