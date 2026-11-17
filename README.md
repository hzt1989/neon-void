# NEON VOID

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/hzt1989/neon-void/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/hzt1989/neon-void/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena survival shooter that runs entirely offline in a desktop browser.
Pilot the last ship in the void: dodge and destroy waves of hunters, shooters
and splitters, pick an upgrade after every wave, and face the Voidlord every
fifth wave. How long can you last?

## How to play

- **WASD / arrows** — move
- **Mouse** — aim, **hold click / Space** — fire
- **Shift / right-click** — dash (brief invulnerability, cooldown)
- **P** — pause, **R** — restart, **M** — mute

Kills chained within 3 seconds build a combo multiplier (up to x8). Clearing a
wave pays a bonus and offers a choice of 3 upgrades: rapid fire, heavy rounds,
ion thrusters, reinforced hull, dash recharge, multishot, piercing rounds.
Your best score is kept in localStorage.

`?demo=1` plays itself — the autopilot fights, picks upgrades and restarts.
`?shot=start|play|boss|upgrade|end` stages a deterministic scene (with
`?seed=N`) for screenshots.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no libraries, no network: `game/` is plain static files
(Canvas 2D, vanilla JavaScript, WebAudio-synthesized sound), so any static
file server works.

## Layout

- `game/` — the playable game (`index.html`, `style.css`, `src/*.js`)
- `game/src/` — one job per file: `config` (tuning), `audio` (synth),
  `input`, `entities`, `waves`, `upgrades`, `render`, `world` (simulation),
  `autopilot` (demo + screenshot staging), `main` (loop + screens)
- `screenshots/` — title, boss fight, upgrade draft, game over
- `main.ts` — hands the entry in (copies `game/` + `screenshots/`, writes
  `dossier.json` with `vendor/makefun-game.ts`)
- `serve.ts` — local static server for playtesting

<sub>Entered on [make.fun](https://make.fun/?ref=z2bnx8gk&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · best-game-01</sub>
