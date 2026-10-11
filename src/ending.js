import * as THREE from 'three';
import { makeTextSprite } from './textures.js';
import { CREDITS } from './texts.js';

// After the finale logo has had a moment: the world fades to black (a black
// shell around the player, drawn after the backdrop but before the logo), the
// island sinks away, the logo shrinks up toward the top, and the credits rise
// in underneath it one line at a time. The orbiting moons and gloves stay lit.

const FADE = 1.6;
const LINE_GAP = 0.1;

export class Ending {
  constructor(scene) {
    this.scene = scene;
    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(3, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.shell.renderOrder = -5; // after sky (-10) and panorama (-9), before the logo
    this.shell.visible = false;
    scene.add(this.shell);
    this.lines = [];
    this.t = -1;
  }

  start({ headY, logo, world }) {
    this.reset();
    this.t = 0;
    this.headY = headY;
    this.logo = logo;
    this.world = world;
    this.logoFrom = logo.position.clone();
    this.logoTo = new THREE.Vector3(0, headY + 0.58, -1.9);
    this.shell.visible = true;
    const top = headY + 0.24;
    this.lines = CREDITS.map((text, i) => {
      const s = makeTextSprite(text, { color: '#ffffff', stroke: '#000000', height: 0.06 });
      s.material.opacity = 0;
      s.userData.y = top - i * LINE_GAP;
      s.position.set(0, s.userData.y - 0.12, -1.9);
      this.scene.add(s);
      return s;
    });
  }

  reset() {
    this.t = -1;
    this.shell.visible = false;
    this.shell.material.opacity = 0;
    for (const s of this.lines) this.scene.remove(s);
    this.lines = [];
    if (this.world) this.world.island.group.position.y = 0;
  }

  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    const k = Math.min(1, this.t / FADE);
    const e = k * k * (3 - 2 * k);
    this.shell.material.opacity = e;
    this.world.island.group.position.y = -4 * k * k;
    this.world.dustMat.opacity = 1 - e;
    if (k >= 1 && this.world.dust.visible) this.world.setVoid(true);
    this.logo.position.lerpVectors(this.logoFrom, this.logoTo, e);
    this.logo.scale.setScalar(1 - 0.45 * e);
    this.lines.forEach((s, i) => {
      const kk = Math.max(0, Math.min(1, (this.t - 1.1 - i * 0.35) / 0.7));
      const ee = 1 - Math.pow(1 - kk, 3);
      s.material.opacity = ee;
      s.position.y = s.userData.y - 0.12 * (1 - ee);
    });
  }
}
