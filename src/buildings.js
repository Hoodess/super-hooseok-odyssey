import * as THREE from 'three';
import { toon, halo, inkOutline } from './gloveProps.js';

// Toy buildings the architect raises with each hit, styled after the white and
// blue domed city in the architect background. Each stands on its own little
// floating island at a fixed slot, so no two overlap and none blocks the lane
// the targets fly down. A building is a list of parts (plinth, floors, cornice,
// roof) that pop in from the bottom up; see `parts` on the returned group.

// [x, z], spaced 3m+ apart and clear of the center lane near the player
const SLOTS = [
  [-3.4, -9], [3.6, -9.5], [-6.2, -12.5], [6.4, -13], [-2.6, -16],
  [2.8, -16.5], [-9.2, -16], [9.4, -16.5], [-5.6, -20], [5.8, -20.5], [0, -22],
];

const WALLS = [0xf7f4ec, 0xeaf3ff, 0xfff1dc, 0xe9f6ee, 0xf6ecf6];
const ROOFS = [0x2f6fd6, 0x1f9fb0, 0xe0603a, 0x3a4fc8, 0x6a4fd6];
const TRIM = 0xffffff;
const GOLD = 0xf2c14e;
const GLASS = 0x2a4f8a;
const FLOOR_H = 0.6;

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

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (r0, r1, h, seg, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

// Windows on the front (+z) and both sides of one floor, as instanced glass,
// frames and sills so a whole building costs a handful of draw calls.
function windowRow(w, d, y, skipFrontCenter, mats) {
  const spots = [];
  const cols = (len) => Math.max(1, Math.floor(len / 0.42));
  const nf = cols(w);
  for (let i = 0; i < nf; i++) {
    const x = -w / 2 + (w / nf) * (i + 0.5);
    if (skipFrontCenter && Math.abs(x) < 0.25) continue;
    spots.push([x, y, d / 2, 0]);
  }
  const ns = cols(d);
  for (let i = 0; i < ns; i++) {
    const z = -d / 2 + (d / ns) * (i + 0.5);
    spots.push([w / 2, y, z, Math.PI / 2], [-w / 2, y, z, -Math.PI / 2]);
  }
  const g = new THREE.Group();
  const layers = [
    [new THREE.BoxGeometry(0.24, 0.34, 0.04), mats.trim, 0.012],
    [new THREE.BoxGeometry(0.18, 0.28, 0.04), mats.glass, 0.02],
    [new THREE.BoxGeometry(0.28, 0.035, 0.07), mats.trim, 0.025, -0.17],
  ];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  for (const [geo, mat, out, dy = 0] of layers) {
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, yy, z, ry], k) => {
      const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      const p = new THREE.Vector3(x, yy + dy, z).addScaledVector(n, out);
      inst.setMatrixAt(k, m4.compose(p, q.setFromEuler(e.set(0, ry, 0)), one));
    });
    g.add(inst);
  }
  return g;
}

function floorBlock(w, d, i, mats, ground) {
  const g = new THREE.Group();
  const body = box(w, FLOOR_H, d, mats.wall);
  body.position.y = FLOOR_H / 2;
  g.add(inkOutline(body, 1.02));
  g.add(windowRow(w, d, FLOOR_H / 2 + 0.02, ground, mats));
  // corner pilasters
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = box(0.08, FLOOR_H, 0.08, mats.trim);
    p.position.set(sx * (w / 2), FLOOR_H / 2, sz * (d / 2));
    g.add(p);
  }
  // string course above every floor
  const band = box(w + 0.08, 0.05, d + 0.08, i % 2 ? mats.roof : mats.trim);
  band.position.y = FLOOR_H - 0.025;
  g.add(band);
  return g;
}

function plinth(w, d, mats) {
  const g = new THREE.Group();
  const base = box(w + 0.16, 0.22, d + 0.16, mats.stone);
  base.position.y = 0.11;
  g.add(inkOutline(base, 1.02));
  // arched door on the front
  const door = box(0.32, 0.42, 0.05, mats.roof);
  door.position.set(0, 0.43, d / 2 + 0.02);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), mats.roof);
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, 0.64, d / 2 + 0.02);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16, Math.PI), mats.trim);
  frame.position.set(0, 0.64, d / 2 + 0.035);
  const step = box(0.5, 0.06, 0.16, mats.stone);
  step.position.set(0, 0.25, d / 2 + 0.08);
  g.add(door, arch, frame, step);
  return g;
}

function balcony(w, d, y, mats) {
  const g = new THREE.Group();
  const slab = box(w * 0.5, 0.05, 0.22, mats.trim);
  slab.position.set(0, y, d / 2 + 0.11);
  const rail = box(w * 0.5, 0.16, 0.025, mats.roof);
  rail.position.set(0, y + 0.1, d / 2 + 0.21);
  g.add(slab, rail);
  return g;
}

function cornice(w, d, mats) {
  const g = new THREE.Group();
  const a = box(w + 0.18, 0.1, d + 0.18, mats.trim);
  a.position.y = 0.05;
  const b = box(w + 0.08, 0.08, d + 0.08, mats.roof);
  b.position.y = 0.14;
  g.add(inkOutline(a, 1.02), b);
  return g;
}

function roof(kind, w, d, mats) {
  const g = new THREE.Group();
  const s = Math.min(w, d);
  if (kind === 'dome') {
    const drum = cyl(s * 0.36, s * 0.38, 0.32, 24, mats.wall);
    drum.position.y = 0.16;
    const ring = cyl(s * 0.4, s * 0.4, 0.05, 24, mats.trim);
    ring.position.y = 0.33;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(s * 0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.roofShiny);
    dome.position.y = 0.35;
    const lantern = cyl(0.06, 0.07, 0.16, 10, mats.trim);
    lantern.position.y = 0.35 + s * 0.38 + 0.06;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.gold);
    finial.position.y = lantern.position.y + 0.12;
    g.add(inkOutline(drum, 1.03), ring, dome, lantern, finial);
  } else if (kind === 'spire') {
    const base = cyl(s * 0.32, s * 0.34, 0.4, 8, mats.wall);
    base.position.y = 0.2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.36, s * 1.3, 8), mats.roofShiny);
    cone.position.y = 0.4 + s * 0.65;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mats.gold);
    tip.position.y = 0.4 + s * 1.3 + 0.03;
    g.add(inkOutline(base, 1.03), cone, tip);
  } else if (kind === 'hip') {
    // a 4-sided cone turned 45 degrees has a square footprint of half-side r/sqrt2
    const p = new THREE.Mesh(new THREE.ConeGeometry((s / 2 + 0.08) * Math.SQRT2, s * 0.7, 4), mats.roofShiny);
    p.rotation.y = Math.PI / 4;
    p.scale.set(w / s, 1, d / s);
    p.position.y = s * 0.35;
    const chimney = box(0.14, 0.32, 0.14, mats.stone);
    chimney.position.set(w * 0.22, s * 0.35, -d * 0.15);
    g.add(p, chimney);
  } else if (kind === 'garden') {
    for (let k = 0; k < 4; k++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (k % 2) * 0.05, 12, 8), mats.green);
      bush.position.set((k % 2 ? 1 : -1) * w * 0.25, 0.12, (k < 2 ? 1 : -1) * d * 0.2);
      bush.scale.y = 0.8;
      g.add(bush);
    }
    const tank = cyl(0.17, 0.17, 0.32, 14, mats.roofShiny);
    tank.position.set(0, 0.42, -d * 0.1);
    const legs = cyl(0.12, 0.14, 0.26, 4, mats.stone);
    legs.position.set(0, 0.13, -d * 0.1);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.14, 14), mats.roof);
    cap.position.set(0, 0.65, -d * 0.1);
    g.add(legs, tank, cap);
  } else {
    // clock tower
    const tw = s * 0.5;
    const tower = box(tw, 0.7, tw, mats.wall);
    tower.position.y = 0.35;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(tw * 0.32, tw * 0.32, 0.03, 24), mats.trim);
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 0.42, tw / 2 + 0.016);
    const hand1 = box(0.015, tw * 0.24, 0.01, mats.ink);
    hand1.position.set(0, 0.42 + tw * 0.1, tw / 2 + 0.035);
    const hand2 = box(tw * 0.18, 0.015, 0.01, mats.ink);
    hand2.position.set(tw * 0.08, 0.42, tw / 2 + 0.035);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.78, tw * 1.1, 4), mats.roofShiny);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 0.7 + tw * 0.55;
    const flagPole = cyl(0.012, 0.012, 0.4, 6, mats.trim);
    flagPole.position.y = 0.7 + tw * 1.1 + 0.2;
    const flag = box(0.22, 0.13, 0.01, mats.flag);
    flag.position.set(0.11, flagPole.position.y + 0.12, 0);
    g.add(inkOutline(tower, 1.03), face, hand1, hand2, cap, flagPole, flag);
  }
  return g;
}

// A finished building, base at y=0. `group.userData.parts` lists its pieces in
// build order, each placed at its final height (userData.y).
export function makeBuilding(n) {
  const r = (a, b) => a + Math.random() * (b - a);
  const roofColor = ROOFS[n % ROOFS.length];
  const mats = {
    wall: toon(WALLS[n % WALLS.length]),
    trim: toon(TRIM),
    stone: toon(0xb9c4d6),
    roof: toon(roofColor),
    roofShiny: toon(roofColor, { spec: 0.7 }),
    glass: toon(GLASS, { spec: 0.9 }),
    gold: toon(GOLD, { spec: 0.9 }),
    green: toon(0x5cbf4a),
    flag: toon(0xe8302a),
    ink: new THREE.MeshBasicMaterial({ color: 0x1a1030 }),
  };
  const g = new THREE.Group();
  const parts = [];
  const add = (obj, y) => {
    obj.position.y = y;
    obj.userData.y = y;
    g.add(obj);
    parts.push(obj);
  };

  const w = r(1.1, 1.5);
  const d = r(1.0, 1.3);
  add(plinth(w, d, mats), 0);
  const floors = 3 + Math.floor(Math.random() * 4);
  let y = 0.22;
  for (let i = 0; i < floors; i++) {
    const f = floorBlock(w, d, i, mats, i === 0);
    if (i > 0 && i % 2 === 0 && Math.random() < 0.7) f.add(balcony(w, d, 0.02, mats));
    add(f, y);
    y += FLOOR_H;
  }
  add(cornice(w, d, mats), y);
  y += 0.18;
  add(roof(['dome', 'spire', 'hip', 'garden', 'clock'][n % 5], w, d, mats), y);
  g.userData.parts = parts;
  return g;
}

// The little floating island a building stands on.
export function makeFoundation() {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.15, 0.25, 28), toon(0xeaf3ff));
  slab.position.y = -0.125;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 8, 40), toon(0x2f6fd6));
  lip.rotation.x = Math.PI / 2;
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 18), toon(0x5a7fb8));
  under.rotation.x = Math.PI;
  under.position.y = -0.8;
  const glow = halo(0x9cc8ff, 2.4, 0.35);
  glow.position.y = -0.6;
  g.add(inkOutline(slab, 1.02), lip, under, glow);
  return g;
}
