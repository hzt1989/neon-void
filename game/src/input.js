// Keyboard and mouse state, translated into the game's logical canvas space.
// The canvas is drawn at a fixed logical size and scaled by CSS, so mouse
// coordinates are mapped back through the canvas bounding box.
import { VIEW } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = VIEW.width / 2;
    this.mouseY = VIEW.height / 2 - 120;
    this.mouseDown = false;
    this.rightDown = false;
    this.pressed = new Set(); // keys pressed since the last consume
    this.clicked = false; // a mouse click since the last consume
    this.rightClicked = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
      if (e.button === 2) { this.rightDown = true; this.rightClicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW.width,
      y: ((clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  /** True while a movement key is held, as a normalized {x, y} vector. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  firing() {
    return this.mouseDown || this.keys.has(' ');
  }

  dashHeld() {
    return this.keys.has('Shift') || this.rightDown;
  }

  /** True once per physical key press; callers consume it each frame. */
  wasPressed(key) {
    return this.pressed.has(key);
  }

  /** True once per click; callers consume it each frame. */
  wasClicked() {
    return this.clicked;
  }

  wasRightClicked() {
    return this.rightClicked;
  }

  /** Clear the one-shot flags at the end of each frame. */
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.rightClicked = false;
  }
}
