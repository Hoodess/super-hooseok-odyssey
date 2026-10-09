import * as THREE from 'three';
import { assetTexture, glovePlaceholder, glowTexture } from './textures.js';

// In WebXR joint space (and in the generic hand model's bones), +Y points out
// of the back of the hand and -Z points toward the fingertips.
export const BACK_OF_HAND = new THREE.Vector3(0, 1, 0);

// One material shared by both gloves; swapping its map re-skins both at once.
export class GloveSkin {
  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      color: 0xe0201c,
      roughness: 0.55,
      metalness: 0.05,
      emissive: 0x000000,
    });
    this.baseEmissive = new THREE.Color();
    this.pulseT = 0;
  }

  setRole(role) {
    const m = this.material;
    if (role.glove) {
      m.map = assetTexture(role.glove, glovePlaceholder(role));
      m.color.setHex(0xffffff);
    } else {
      m.map = null;
      m.color.setHex(role.color);
    }
    this.baseEmissive.setHex(role.color).multiplyScalar(0.18);
    m.emissive.copy(this.baseEmissive);
    m.needsUpdate = true;
    this.pulse();
  }

  pulse() {
    this.pulseT = 1;
  }

  update(dt) {
    if (this.pulseT > 0) {
      this.pulseT = Math.max(0, this.pulseT - dt * 3);
      this.material.emissive.copy(this.baseEmissive).lerp(new THREE.Color(0xffffff), this.pulseT * 0.35);
    }
  }

  apply(object) {
    object.traverse((o) => {
      if (o.isMesh) {
        o.material = this.material;
        o.frustumCulled = false;
      }
    });
  }
}

// Cappy-style eyes plus the glowing button that starts the roulette.
export function makeCappyEyes() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const iris = new THREE.MeshBasicMaterial({ color: 0xc81414 });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const lids = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), white);
    ball.scale.set(0.8, 0.5, 1.15);
    eye.add(ball);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 20), iris);
    ir.position.set(0, 0.0056, -0.002);
    ir.rotation.x = -Math.PI / 2;
    eye.add(ir);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.003, 16), pupil);
    pu.position.set(0, 0.0058, -0.0022);
    pu.rotation.x = -Math.PI / 2;
    eye.add(pu);
    eye.position.set(side * 0.0115, 0, 0.006);
    eye.rotation.z = side * 0.25;
    lids.push(eye);
    g.add(eye);
  }
  g.userData.blink = 0;
  g.userData.lids = lids;
  return g;
}

export function updateEyes(eyes, t) {
  // blink every ~3.5s
  const phase = t % 3.5;
  const s = phase < 0.12 ? Math.abs(Math.cos((phase / 0.12) * Math.PI)) * 0.9 + 0.1 : 1;
  for (const e of eyes.userData.lids) e.scale.z = s;
}

export function makeHandButton(color = 0xff3b30) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 24), mat);
  g.add(disc);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.setScalar(0.05);
  g.add(glow);
  g.userData.mat = mat;
  g.userData.glow = glow;
  return g;
}
