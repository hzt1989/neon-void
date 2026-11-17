// NEON VOID entry point: wires input, sound, the world and the renderer,
// owns the screen state machine (title / playing / upgrade / paused / over),
// and stages the deterministic ?shot= scenes for screenshots.
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { render } from './render.js';
import { createState, resetRun, stepWorld } from './world.js';
import { autopilotInput, stageShot } from './autopilot.js';
import { applyUpgrade } from './upgrades.js';
import { startWave } from './waves.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : (Math.random() * 0xffffffff) >>> 0;
const shotName = params.get('shot');
const demoMode = params.get('demo') === '1';

const sound = new SoundBank();
const input = new Input(canvas);
const state = createState(seed);
state.input = input;
state.sound = sound;
state.demo = demoMode;
// Debug handle for playtesting (read-only inspection from the console).
window.NEON_VOID = state;

let lastScreen = '';
function announce() {
  if (!statusEl || state.screen === lastScreen) return;
  lastScreen = state.screen;
  const lines = {
    title: 'NEON VOID. Press Enter or click to start.',
    playing: `Wave ${state.wave}. Score ${state.score}.`,
    upgrade: 'Wave cleared. Choose an upgrade.',
    paused: 'Paused.',
    over: `Game over. Score ${state.score}. Press R to play again.`,
  };
  statusEl.textContent = lines[state.screen] || '';
}

function startRun() {
  sound.ensure();
  resetRun(state);
  sound.horn();
  announce();
}

function chooseUpgrade(index) {
  const up = state.upgradeOffer[index];
  if (!up) return;
  applyUpgrade(state, up);
  sound.upgrade();
  startWave(state, state.wave + 1);
  state.screen = 'playing';
  sound.horn();
  announce();
}

// --- Screenshot staging: run the real rules forward, then freeze the frame.
if (shotName) {
  resetRun(state);
  const staged = stageShot(state, shotName, stepWorld);
  state.screen = staged;
  state.frozen = true;
  // A still frame shows the fight, not the split-second hit flash or shake.
  state.flash = 0;
  state.shake = 0;
  if (shotName === 'start') state.time = 3;
  state.upgradeRects = state.upgradeRects || [];
} else if (demoMode) {
  startRun();
}

let last = performance.now();
let overTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (!state.frozen) {
    // Global keys.
    if (input.wasPressed('m')) sound.setMuted(!sound.muted);
    if (input.wasPressed('Enter') && state.screen === 'title') startRun();

    if (state.screen === 'title') {
      if (input.wasClicked()) startRun();
    } else if (state.screen === 'playing') {
      if (input.wasPressed('p')) {
        state.screen = 'paused';
        announce();
      } else if (input.wasPressed('r')) {
        startRun();
      } else {
        const pilot = state.demo ? autopilotInput(state, 1) : input;
        if (state.demo) {
          // The crosshair follows the pilot's aim, as a player's mouse would.
          input.mouseX = pilot.mouseX;
          input.mouseY = pilot.mouseY;
        }
        stepWorld(state, dt, pilot);
        sound.updateMusic(dt, true);
        if (state.screen === 'over') overTimer = 0;
      }
    } else if (state.screen === 'upgrade') {
      if (input.wasPressed('1')) chooseUpgrade(0);
      else if (input.wasPressed('2')) chooseUpgrade(1);
      else if (input.wasPressed('3')) chooseUpgrade(2);
      else if (input.wasClicked()) {
        for (const r of state.upgradeRects) {
          if (input.mouseX >= r.x && input.mouseX <= r.x + r.w
            && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
            chooseUpgrade(r.index);
            break;
          }
        }
      } else if (state.demo) {
        // In demo mode the pilot picks for itself after a beat, so the run
        // plays end to end with nobody at the keyboard.
        state.upgradeTimer += dt;
        if (state.upgradeTimer > 1.2) {
          chooseUpgrade(Math.floor(state.rng() * state.upgradeOffer.length));
        }
      }
      sound.updateMusic(dt, false);
    } else if (state.screen === 'paused') {
      if (input.wasPressed('p') || input.wasClicked()) {
        state.screen = 'playing';
        announce();
      }
    } else if (state.screen === 'over') {
      overTimer += dt;
      if (input.wasPressed('r') || input.wasPressed('Enter') || input.wasClicked()) {
        startRun();
      } else if (state.demo && overTimer > 2.5) {
        startRun();
      }
    }
    announce();
    input.endFrame();
  }

  render(ctx, state);
  requestAnimationFrame(frame);
}

// Pause when the tab loses focus mid-run, so a hidden tab cannot kill you.
window.addEventListener('blur', () => {
  if (state.screen === 'playing' && !state.frozen) {
    state.screen = 'paused';
    announce();
  }
});

// Unlock audio on the first gesture anywhere.
window.addEventListener('pointerdown', () => sound.ensure(), { once: true });
window.addEventListener('keydown', () => sound.ensure(), { once: true });

announce();
requestAnimationFrame(frame);
