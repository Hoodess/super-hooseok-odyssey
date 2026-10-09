import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { toon } from './gloveProps.js';

// Power Moon: a beveled crescent with a star cut, plus a glow. The HUD row
// above the horizon shows one slot per role and fills as moons are collected.

function moonShape() {
  const s = new THREE.Shape();
  const R = 0.1;
  s.absarc(0, 0, R, Math.PI * 0.42, Math.PI * 1.58 + Math.PI * 2 * 0, false);
  s.absarc(R * 0.45, 0, R * 0.78, Math.PI * 1.32, Math.PI * 0.68, true);
  return s;
}

// Puffy toon crescent with a gold star stud, a soft glow and a few sparkles
// orbiting it (they spin in updateMoon, which the HUD and main loop call).
export function makeMoon(color) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(moonShape(), {
    depth: 0.02, bevelEnabled: true, bevelThickness: 0.028, bevelSize: 0.018, bevelSegments: 6, curveSegments: 40,
  });
  geo.center();
  const mat = toon(color, { emissive: color, emissiveIntensity: 0.35, spec: 0.8 });
  const m = new THREE.Mesh(geo, mat);
  g.add(m);
  const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide }));
  hull.scale.setScalar(1.06);
  g.add(hull);
  const star = new THREE.Mesh(starGeometry(), toon(0xffe27a, { emissive: 0x6a4a00 }));
  star.position.set(-0.04, 0, 0.04);
  g.add(star);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.setScalar(0.55);
  g.add(glow);
  const sparkles = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    sp.scale.setScalar(0.05);
    sparkles.add(sp);
  }
  g.add(sparkles);
  g.userData = { mat, glow, sparkles, star, hull };
  return g;
}

export function updateMoon(moon, t) {
  const sp = moon.userData.sparkles;
  if (!sp?.visible) return;
  sp.children.forEach((s, i) => {
    const a = t * 2.2 + (i / 4) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.16, Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.16);
    s.scale.setScalar(0.03 + 0.03 * Math.abs(Math.sin(t * 6 + i)));
  });
}

let starGeo = null;
function starGeometry() {
  if (starGeo) return starGeo;
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? 0.014 : 0.032;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2 });
  starGeo.center();
  return starGeo;
}

export class MoonHUD {
  constructor(scene, roles) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.slots = roles.map((r, i) => {
      const m = makeMoon(r.color);
      m.scale.setScalar(0.45);
      m.position.set((i - 2) * 0.13, 0, 0);
      m.userData.role = r;
      m.userData.glow.scale.setScalar(0.32);
      setEmpty(m, true);
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
    setEmpty(m, false);
    m.userData.pop = 1;
  }

  reset() {
    this.slots.forEach((m) => setEmpty(m, true));
  }

  update(dt, t) {
    this.slots.forEach((m, i) => {
      m.rotation.y = Math.sin(t * 1.5 + i) * 0.4;
      updateMoon(m, t + i);
      if (m.userData.pop > 0) {
        m.userData.pop = Math.max(0, m.userData.pop - dt * 2);
        m.scale.setScalar(0.45 * (1 + m.userData.pop * 0.6));
      }
    });
  }
}

function setEmpty(m, empty) {
  const u = m.userData;
  u.mat.color.setHex(empty ? 0x1c1a30 : u.role.color);
  u.mat.emissive.setHex(empty ? 0x000000 : u.role.color);
  u.glow.visible = !empty;
  u.sparkles.visible = !empty;
  u.star.visible = !empty;
}
