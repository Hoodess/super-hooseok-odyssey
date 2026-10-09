import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Power Moon: a beveled crescent with a star cut, plus a glow. The HUD row
// above the horizon shows one slot per role and fills as moons are collected.

function moonShape() {
  const s = new THREE.Shape();
  const R = 0.1;
  s.absarc(0, 0, R, Math.PI * 0.42, Math.PI * 1.58 + Math.PI * 2 * 0, false);
  s.absarc(R * 0.45, 0, R * 0.78, Math.PI * 1.32, Math.PI * 0.68, true);
  return s;
}

export function makeMoon(color) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(moonShape(), {
    depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4, curveSegments: 32,
  });
  geo.center();
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.25,
  });
  const m = new THREE.Mesh(geo, mat);
  g.add(m);
  const star = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.03, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.2 }),
  );
  star.position.set(0.035, 0, 0);
  star.scale.set(1, 1, 0.5);
  g.add(star);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.setScalar(0.55);
  g.add(glow);
  g.userData.mat = mat;
  g.userData.glow = glow;
  return g;
}

export class MoonHUD {
  constructor(scene, roles) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.slots = roles.map((r, i) => {
      const m = makeMoon(r.color);
      m.scale.setScalar(0.45);
      m.position.set((i - 2) * 0.13, 0, 0);
      m.userData.mat.color.setHex(0x333344);
      m.userData.mat.emissiveIntensity = 0;
      m.userData.glow.visible = false;
      m.userData.role = r;
      this.group.add(m);
      return m;
    });
  }

  place(headY) {
    this.group.position.set(0, headY + 0.75, -2.2);
  }

  slotWorldPos(i) {
    return this.slots[i].getWorldPosition(new THREE.Vector3());
  }

  fill(i) {
    const m = this.slots[i];
    m.userData.mat.color.setHex(m.userData.role.color);
    m.userData.mat.emissiveIntensity = 0.6;
    m.userData.glow.visible = true;
    m.userData.pop = 1;
  }

  reset() {
    this.slots.forEach((m) => {
      m.userData.mat.color.setHex(0x333344);
      m.userData.mat.emissiveIntensity = 0;
      m.userData.glow.visible = false;
    });
  }

  update(dt, t) {
    this.slots.forEach((m, i) => {
      m.rotation.y = Math.sin(t * 1.5 + i) * 0.4;
      if (m.userData.pop > 0) {
        m.userData.pop = Math.max(0, m.userData.pop - dt * 2);
        m.scale.setScalar(0.45 * (1 + m.userData.pop * 0.6));
      }
    });
  }
}
