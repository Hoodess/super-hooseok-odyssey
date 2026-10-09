import * as THREE from 'three';
import { assetTexture, canvas, textCanvas } from './textures.js';
import { UI } from './texts.js';

// Retro title screen: the logo floating in black, a blinking GAME START below
// it. Pressing it (finger poke in the headset, Space / Enter / click on the
// desktop, or the button on the glove) plays a chime and makes the label
// flash fast for a moment before `onStart` runs.

const BTN_W = 0.34;
const BTN_H = 0.085;

function plane(c, height) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(
    new THREE.PlaneGeometry((height * c.width) / c.height, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
}

export class TitleScreen {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.logo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.975),
      new THREE.MeshBasicMaterial({
        map: assetTexture('logo_alpha.png', () => canvas(4, 3, () => {})), transparent: true, depthWrite: false, toneMapped: false,
      }),
    );
    this.group.add(this.logo);

    this.button = new THREE.Group();
    const frame = plane(canvas(680, 170, (g, w, h) => {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(8, 8, w - 16, h - 16, 26);
      g.stroke();
    }), BTN_H);
    this.label = null;
    this.button.add(frame);
    this.frame = frame;
    this.group.add(this.button);

    this.cursor = plane(textCanvas('▶', { size: 90, color: '#ffd23f', stroke: '#000' }), 0.045);
    this.button.add(this.cursor);

    this.active = false;
    this.pressed = -1;
    this.onStart = null;
    this.group.visible = false;
  }

  // Built lazily so the bundled font is loaded by the time it is drawn.
  buildLabel() {
    if (this.label) return;
    this.label = plane(textCanvas(UI.start, { size: 96, color: '#ffffff', stroke: '#000000' }), 0.05);
    this.label.position.z = 0.001;
    this.button.add(this.label);
    this.cursor.position.set(-BTN_W / 2 - 0.035, 0, 0.001);
  }

  show(headY) {
    this.buildLabel();
    this.logo.position.set(0, headY + 0.32, -1.7);
    this.button.position.set(0, headY - 0.3, -0.6);
    this.button.rotation.x = -0.35; // tilted up toward the face
    this.group.visible = true;
    this.active = true;
    this.pressed = -1;
  }

  hide() {
    this.group.visible = false;
    this.active = false;
  }

  // Start once; returns true if this press started the game.
  press(audio) {
    if (!this.active || this.pressed >= 0) return false;
    this.pressed = 0;
    audio.play('start');
    return true;
  }

  // Fingertip poke test (world-space points) against the button's box.
  poked(points) {
    if (!this.active || this.pressed >= 0) return false;
    const inv = new THREE.Matrix4().copy(this.button.matrixWorld).invert();
    const p = new THREE.Vector3();
    return points.some((pt) => {
      p.copy(pt).applyMatrix4(inv);
      return Math.abs(p.x) < BTN_W / 2 + 0.02 && Math.abs(p.y) < BTN_H / 2 + 0.02 && Math.abs(p.z) < 0.035;
    });
  }

  update(dt, t) {
    if (!this.group.visible) return;
    this.logo.position.y += Math.sin(t * 1.4) * 0.0004;
    if (this.pressed < 0) {
      const on = Math.floor(t * 1.6) % 2 === 0;
      if (this.label) this.label.visible = on;
      this.cursor.visible = on;
      this.cursor.position.x = -BTN_W / 2 - 0.035 + Math.sin(t * 6) * 0.004;
      return;
    }
    this.pressed += dt;
    const on = Math.floor(this.pressed * 14) % 2 === 0;
    if (this.label) this.label.visible = on;
    this.frame.visible = on;
    this.cursor.visible = false;
    if (this.pressed > 1.1 && this.active) {
      this.active = false;
      this.onStart?.();
    }
  }
}
