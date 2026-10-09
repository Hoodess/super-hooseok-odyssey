import * as THREE from 'three';
import { toon, halo } from './gloveProps.js';
import { canvas } from './textures.js';

// Toy buildings the architect raises with each hit. Each one stands on its own
// little floating blueprint island at a fixed slot, so no two ever overlap and
// none blocks the lane the targets fly down. Built from stacked tiers with
// window rows, a door, blueprint-blue edge lines and one of a few roof styles.

// [x, z] — spaced at least ~3m apart, clear of the center lane (|x| < 2 near z > -13)
const SLOTS = [
  [-3.4, -9], [3.6, -9.5], [-6.2, -12.5], [6.4, -13], [-2.6, -16],
  [2.8, -16.5], [-9.2, -16], [9.4, -16.5], [-5.6, -20], [5.8, -20.5], [0, -22],
];

const BODY = [0xf4f8ff, 0xffe2b8, 0xcfe6ff, 0xffd0dc, 0xd8f5e0, 0xfff3b0];
const TRIM = [0x2f6fd6, 0xe8302a, 0x22a35b, 0x9b3cff, 0xff8a3d];
const LINE = 0x1f4fae;

export class BuildingSlots {
  constructor() {
    this.reset();
  }

  reset() {
    this.order = SLOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    this.next = 0;
  }

  take() {
    if (this.next >= this.order.length) return null;
    const [x, z] = SLOTS[this.order[this.next++]];
    return new THREE.Vector3(x, 0, z);
  }
}

let winTex = null;
function windowTexture() {
  if (winTex) return winTex;
  winTex = new THREE.CanvasTexture(canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4f8a';
    g.fillRect(16, 12, 32, 38);
    g.fillStyle = '#9fd4ff';
    g.fillRect(19, 15, 26, 32);
    g.fillStyle = '#e8f6ff';
    g.fillRect(21, 17, 8, 12);
    g.fillStyle = '#2f4f8a';
    g.fillRect(31, 15, 2, 32);
    g.fillRect(19, 30, 26, 2);
  }));
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  return winTex;
}

function edges(mesh) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color: LINE }));
  l.position.copy(mesh.position);
  l.rotation.copy(mesh.rotation);
  return l;
}

function tier(w, h, d, color) {
  const map = windowTexture().clone();
  map.needsUpdate = true;
  map.repeat.set(Math.max(1, Math.round(w / 0.55)), Math.max(1, Math.round(h / 0.7)));
  const side = toon(color, { map });
  const cap = toon(color);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, cap, cap, side, side]);
  return m;
}

function roof(kind, w, d, trim) {
  const g = new THREE.Group();
  if (kind === 'pyramid') {
    const p = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.74, w * 0.8, 4), toon(trim));
    p.rotation.y = Math.PI / 4;
    p.position.y = w * 0.4;
    g.add(p, edges(p));
  } else if (kind === 'dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(trim, { spec: 0.8 }));
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.48, Math.min(w, d) * 0.48, 0.08, 20), toon(0xffffff));
    ring.position.y = 0.04;
    dome.position.y = 0.08;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(0xffd21a, { spec: 0.8 }));
    tip.position.y = Math.min(w, d) * 0.45 + 0.12;
    g.add(ring, dome, tip);
  } else if (kind === 'antenna') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 14), toon(trim));
    tank.position.set(-w * 0.2, 0.15, d * 0.15);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 6), toon(0xdddddd));
    mast.position.set(w * 0.22, 0.45, -d * 0.1);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040, toneMapped: false }));
    light.position.set(w * 0.22, 0.92, -d * 0.1);
    light.add(halo(0xff4040, 0.5, 0.6));
    g.add(tank, edges(tank), mast, light);
  } else {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.12, d * 1.04), toon(trim));
    parapet.position.y = 0.06;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), toon(0xdddddd));
    pole.position.set(0, 0.42, 0);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.01), toon(0xe8302a));
    flag.position.set(0.15, 0.62, 0);
    g.add(parapet, edges(parapet), pole, flag);
  }
  return g;
}

// A finished building, base at y=0. Returns the group; its height is in userData.
export function makeBuilding(n) {
  const r = (a, b) => a + Math.random() * (b - a);
  const g = new THREE.Group();
  const body = BODY[n % BODY.length];
  const trim = TRIM[(n * 3 + 1) % TRIM.length];
  let w = r(1.1, 1.6);
  let d = r(1.0, 1.4);
  let y = 0;
  const tiers = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < tiers; i++) {
    const h = r(1.2, 2.4) * (i ? 0.75 : 1);
    const t = tier(w, h, d, body);
    t.position.y = y + h / 2;
    g.add(t, edges(t));
    y += h;
    if (i < tiers - 1) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, d + 0.1), toon(trim));
      ledge.position.y = y + 0.05;
      g.add(ledge);
      y += 0.1;
      w *= 0.74;
      d *= 0.74;
    }
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.04), toon(trim));
  door.position.set(0, 0.275, g.children[0].geometry.parameters.depth / 2 + 0.02);
  g.add(door);
  const top = roof(['pyramid', 'dome', 'antenna', 'flat'][n % 4], w, d, trim);
  top.position.y = y;
  g.add(top);
  g.userData.height = y;
  return g;
}

// The little floating island a building stands on.
export function makeFoundation() {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.15, 0.25, 24), toon(0x3f7fe0));
  slab.position.y = -0.125;
  const grid = new THREE.Mesh(new THREE.CircleGeometry(1.28, 24), new THREE.MeshBasicMaterial({ color: 0x9cc8ff, wireframe: true, transparent: true, opacity: 0.5 }));
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.005;
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 16), toon(0x24457a));
  under.rotation.x = Math.PI;
  under.position.y = -0.8;
  g.add(slab, grid, under, edges(slab));
  return g;
}
