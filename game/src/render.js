// Everything drawn on the canvas: the neon arena, the ships, the HUD and the
// menu overlays. Nothing here changes game state; it only reads it.
import { COLORS, COMBO_MAX, VIEW } from './config.js';
import { clamp } from './utils.js';

const FONT_TITLE = '700 84px "Segoe UI", system-ui, sans-serif';
const FONT_BIG = '700 44px "Segoe UI", system-ui, sans-serif';
const FONT_MED = '600 22px "Segoe UI", system-ui, sans-serif';
const FONT_SMALL = '500 16px "Segoe UI", system-ui, sans-serif';
const FONT_NUM = '700 26px ui-monospace, "SF Mono", Consolas, monospace';
const FONT_NUM_BIG = '700 34px ui-monospace, "SF Mono", Consolas, monospace';

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowText(ctx, text, x, y, font, color, glowColor, glow = 18) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

export function drawBackground(ctx, state) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Grid, faint and steady.
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= VIEW.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.height); }
  for (let y = 0; y <= VIEW.height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(VIEW.width, y); }
  ctx.stroke();

  // Stars, twinkling slowly.
  for (const s of state.stars) {
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(state.time * s.speed + s.phase));
    ctx.globalAlpha = tw * 0.9;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;

  // A soft violet nebula glow in the corners, drawn with radial gradients.
  const neb = ctx.createRadialGradient(150, 120, 0, 150, 120, 420);
  neb.addColorStop(0, 'rgba(120, 60, 255, 0.10)');
  neb.addColorStop(1, 'rgba(120, 60, 255, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, 560, 520);
  const neb2 = ctx.createRadialGradient(1150, 700, 0, 1150, 700, 420);
  neb2.addColorStop(0, 'rgba(46, 230, 255, 0.08)');
  neb2.addColorStop(1, 'rgba(46, 230, 255, 0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(720, 280, 560, 520);
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  // Blink while invulnerable after a hit.
  if (p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-13, -12);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-13, 12);
  ctx.closePath();
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fillStyle = COLORS.playerCore;
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e, state) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = flash ? 26 : 14;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.lineWidth = 2;
  if (e.kind === 'chaser' || e.kind === 'mini') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(e.radius, 0);
    ctx.lineTo(-e.radius * 0.8, -e.radius * 0.75);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius * 0.8, e.radius * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'shooter') {
    ctx.rotate(e.angle * 0.25);
    ctx.strokeRect(-e.radius * 0.7, -e.radius * 0.7, e.radius * 1.4, e.radius * 1.4);
    ctx.fillRect(-e.radius * 0.35, -e.radius * 0.35, e.radius * 0.7, e.radius * 0.7);
  } else if (e.kind === 'splitter') {
    ctx.rotate(e.angle);
    polygon(ctx, 0, 0, e.radius, 6, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bg;
    ctx.fill();
  } else if (e.kind === 'boss') {
    ctx.rotate(e.angle);
    polygon(ctx, 0, 0, e.radius, 8, 0);
    ctx.fill();
    polygon(ctx, 0, 0, e.radius * 0.62, 8, Math.PI / 8);
    ctx.fillStyle = COLORS.bg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = e.charging ? '#ffffff' : COLORS.enemyBullet;
    ctx.fill();
  }
  ctx.restore();
  // A thin hp arc over damaged enemies.
  if (e.hp < e.maxHp && e.kind !== 'boss') {
    const w = e.radius * 2;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 3);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * ratio, 3);
  }
}

function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.save();
    ctx.shadowColor = b.friendly ? COLORS.bullet : COLORS.enemyBullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.friendly ? COLORS.bullet : COLORS.enemyBullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const r of state.rings) {
    ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(1, r.radius), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const t of state.texts) {
    ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.font = `700 ${t.size}px ui-monospace, "SF Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawCrosshair(ctx, state) {
  if (state.screen !== 'playing') return;
  const { mouseX, mouseY } = state.input;
  ctx.strokeStyle = 'rgba(223, 233, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouseX - 15, mouseY);
  ctx.lineTo(mouseX - 6, mouseY);
  ctx.moveTo(mouseX + 6, mouseY);
  ctx.lineTo(mouseX + 15, mouseY);
  ctx.moveTo(mouseX, mouseY - 15);
  ctx.lineTo(mouseX, mouseY - 6);
  ctx.moveTo(mouseX, mouseY + 6);
  ctx.lineTo(mouseX, mouseY + 15);
  ctx.stroke();
}

function drawBossBar(ctx, state) {
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  const w = 420;
  const x = (VIEW.width - w) / 2;
  const y = 88;
  ctx.textAlign = 'center';
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.boss;
  ctx.fillText('VOIDLORD', VIEW.width / 2, y - 10);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = COLORS.boss;
  ctx.fillRect(x, y, w * clamp(boss.hp / boss.maxHp, 0, 1), 10);
}

export function drawHud(ctx, state) {
  const p = state.player;
  ctx.textBaseline = 'middle';

  // HP bar, top left.
  ctx.textAlign = 'left';
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('HULL', 24, 26);
  const hpW = 220;
  const hpRatio = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(24, 38, hpW, 14);
  ctx.fillStyle = hpRatio < 0.3 ? COLORS.hpLow : COLORS.hp;
  ctx.fillRect(24, 38, hpW * hpRatio, 14);
  ctx.font = FONT_NUM;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 252, 46);

  // Wave and enemies left, top centre.
  ctx.textAlign = 'center';
  ctx.font = FONT_MED;
  ctx.fillStyle = COLORS.text;
  const remaining = state.enemies.length + state.spawnQueue.length;
  ctx.fillText(`WAVE ${state.wave}`, VIEW.width / 2, 26);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(state.screen === 'upgrade' ? 'WAVE CLEARED' : `${remaining} HOSTILE${remaining === 1 ? '' : 'S'}`, VIEW.width / 2, 50);
  drawBossBar(ctx, state);

  // Score and best, top right.
  ctx.textAlign = 'right';
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('SCORE', VIEW.width - 24, 26);
  ctx.font = FONT_NUM_BIG;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(String(state.score), VIEW.width - 24, 50);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`BEST ${state.best}`, VIEW.width - 24, 88);

  // Combo meter under the score.
  if (state.combo > 1) {
    const mult = Math.min(COMBO_MAX, 1 + (state.combo - 1) * 0.5);
    ctx.font = FONT_MED;
    ctx.fillStyle = COLORS.combo;
    ctx.fillText(`COMBO x${mult.toFixed(1)}  (${state.combo})`, VIEW.width - 24, 116);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(VIEW.width - 144, 130, 120, 5);
    ctx.fillStyle = COLORS.combo;
    ctx.fillRect(VIEW.width - 144, 130, 120 * clamp(state.comboTimer / 3, 0, 1), 5);
  }

  // Dash cooldown, bottom centre.
  const dashRatio = 1 - clamp(p.dashCooldown / p.dashCooldownMax, 0, 1);
  ctx.textAlign = 'center';
  ctx.font = FONT_SMALL;
  ctx.fillStyle = dashRatio >= 1 ? COLORS.player : COLORS.dim;
  ctx.fillText(dashRatio >= 1 ? 'DASH READY  [SHIFT]' : 'DASH RECHARGING', VIEW.width / 2, VIEW.height - 34);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(VIEW.width / 2 - 90, VIEW.height - 24, 180, 6);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(VIEW.width / 2 - 90, VIEW.height - 24, 180 * dashRatio, 6);
}

function drawWaveBanner(ctx, state) {
  if (state.waveBanner <= 0) return;
  ctx.globalAlpha = clamp(state.waveBanner / 2.2, 0, 1);
  glowText(ctx, state.waveBannerText, VIEW.width / 2, 170, FONT_BIG, COLORS.text, COLORS.boss, 24);
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  glowText(ctx, 'NEON VOID', VIEW.width / 2, 210, FONT_TITLE, '#eafcff', COLORS.player, 30);
  glowText(ctx, 'ARENA SURVIVAL', VIEW.width / 2, 282, FONT_MED, COLORS.player, COLORS.player, 12);
  ctx.font = FONT_SMALL;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  const lines = [
    'WASD / ARROWS — move      MOUSE — aim      HOLD CLICK / SPACE — fire',
    'SHIFT / RIGHT-CLICK — dash      P — pause      M — mute      R — restart',
    'Survive the waves. Clear a wave, pick an upgrade, face the Voidlord every 5th wave.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 350 + i * 30));
  if (state.best > 0) {
    ctx.font = FONT_MED;
    ctx.fillStyle = COLORS.combo;
    ctx.fillText(`BEST SCORE  ${state.best}`, VIEW.width / 2, 470);
  }
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  glowText(ctx, 'CLICK OR PRESS ENTER TO START', VIEW.width / 2, 560, FONT_MED, COLORS.text, COLORS.player, 14);
  ctx.globalAlpha = 1;
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('?demo=1 plays itself  ·  a game by one agent, built for make.fun best-game-01', VIEW.width / 2, 640);
}

function drawUpgradeOverlay(ctx, state) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  glowText(ctx, `WAVE ${state.wave} CLEARED`, VIEW.width / 2, 150, FONT_BIG, COLORS.text, COLORS.player, 20);
  ctx.font = FONT_MED;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.combo;
  ctx.fillText(`BONUS  +${250 * state.wave}`, VIEW.width / 2, 205);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('CHOOSE ONE UPGRADE  —  click a card or press 1 / 2 / 3', VIEW.width / 2, 245);

  const cardW = 300;
  const cardH = 210;
  const gap = 30;
  const totalW = cardW * 3 + gap * 2;
  const startX = (VIEW.width - totalW) / 2;
  const y = 300;
  state.upgradeRects = [];
  state.upgradeOffer.forEach((up, i) => {
    const x = startX + i * (cardW + gap);
    const hover = state.input.mouseX >= x && state.input.mouseX <= x + cardW
      && state.input.mouseY >= y && state.input.mouseY <= y + cardH;
    state.upgradeRects.push({ x, y, w: cardW, h: cardH, index: i });
    ctx.fillStyle = hover ? 'rgba(46, 230, 255, 0.10)' : COLORS.card;
    ctx.strokeStyle = hover ? '#ffffff' : COLORS.cardEdge;
    ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.player;
    ctx.fillText(`[${i + 1}]`, x + cardW / 2, y + 36);
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(up.name, x + cardW / 2, y + 78);
    ctx.font = FONT_SMALL;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(up.desc, x + cardW / 2, y + 116);
    const stacks = state.upgradeStacks[up.id] || 0;
    ctx.fillStyle = COLORS.combo;
    ctx.fillText(stacks > 0 ? `OWNED x${stacks}` : 'NEW', x + cardW / 2, y + 158);
  });
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.7)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  glowText(ctx, 'PAUSED', VIEW.width / 2, 360, FONT_BIG, COLORS.text, COLORS.player, 20);
  ctx.font = FONT_MED;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('Press P or click to resume', VIEW.width / 2, 430);
}

function drawGameOver(ctx, state) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  glowText(ctx, 'SIGNAL LOST', VIEW.width / 2, 220, FONT_TITLE, '#ff5d7a', COLORS.mini, 26);
  ctx.font = FONT_MED;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`The void took you on wave ${state.wave}.`, VIEW.width / 2, 320);
  ctx.font = FONT_NUM_BIG;
  ctx.fillText(`SCORE  ${state.score}`, VIEW.width / 2, 390);
  ctx.font = FONT_MED;
  ctx.fillStyle = state.score >= state.best && state.score > 0 ? COLORS.combo : COLORS.dim;
  ctx.fillText(state.score >= state.best && state.score > 0 ? 'NEW BEST!' : `BEST  ${state.best}`, VIEW.width / 2, 440);
  ctx.font = FONT_SMALL;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`${state.kills} kills  ·  ${state.upgradesTaken} upgrades taken`, VIEW.width / 2, 485);
  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  glowText(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', VIEW.width / 2, 560, FONT_MED, COLORS.text, COLORS.player, 14);
  ctx.globalAlpha = 1;
}

/** Draw one frame of the game. */
export function render(ctx, state) {
  ctx.save();
  if (state.shake > 0.2) {
    const s = state.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, state);
  for (const e of state.enemies) drawEnemy(ctx, e, state);
  drawBullets(ctx, state);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);
  drawCrosshair(ctx, state);
  ctx.restore();

  // Red flash on player hit.
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 60, ${clamp(state.flash, 0, 0.22)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (state.screen === 'playing' || state.screen === 'paused' || state.screen === 'upgrade') {
    drawHud(ctx, state);
    drawWaveBanner(ctx, state);
  }
  if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'upgrade') drawUpgradeOverlay(ctx, state);
  else if (state.screen === 'paused') drawPaused(ctx);
  else if (state.screen === 'over') drawGameOver(ctx, state);
}
