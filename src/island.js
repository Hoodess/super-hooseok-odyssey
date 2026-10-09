import * as THREE from 'three';
import { toon } from './gloveProps.js';

// The floating island the player stands on: a rounded toon top whose surface
// changes per role (grass, library floor, blueprint tile...), a tapered rocky
// underside, and a ring of small role props around the back and sides so the
// front stays clear for incoming targets.

const TOP_R = 1.35;

const SURFACE = {
  hub: { top: 0x6cc644, lip: 0x4e9a2f, dirt: 0x8a5a3b },
  grad: { top: 0x9a6a45, lip: 0x7a4f30, dirt: 0x5a3a26 },
  arch: { top: 0x3f7fe0, lip: 0xe8f1ff, dirt: 0x24457a },
  ta: { top: 0x1b3a4a, lip: 0x3dff8a, dirt: 0x10222c },
  fortune: { top: 0x6a2fa0, lip: 0xf2c14e, dirt: 0x3a1a5a },
  travel: { top: 0xe9c46a, lip: 0x6cc644, dirt: 0xa0703c },
};

export class Island {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);

    this.topMat = toon(SURFACE.hub.top);
    this.lipMat = toon(SURFACE.hub.lip);
    this.dirtMat = toon(SURFACE.hub.dirt);
    const outline = new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide });

    const top = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, TOP_R, 0.08, 64), this.topMat);
    top.position.y = -0.04;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(TOP_R, 0.06, 12, 64), this.lipMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.03;
    lip.scale.z = 0.8;
    const lipHull = new THREE.Mesh(lip.geometry, outline);
    lipHull.rotation.copy(lip.rotation);
    lipHull.position.copy(lip.position);
    lipHull.scale.set(1.012, 1.012, 0.9);

    // rocky underside: two stacked tapering cones with a little wobble
    const under = new THREE.Group();
    const c1 = new THREE.Mesh(wobblyCone(TOP_R * 0.98, 0.75, 0.5, 1), this.dirtMat);
    c1.position.y = -0.33;
    const c2 = new THREE.Mesh(wobblyCone(0.75, 0.12, 0.7, 2), this.dirtMat);
    c2.position.y = -0.92;
    under.add(c1, c2);

    this.group.add(top, lip, lipHull, under);
    this.props = new THREE.Group();
    this.group.add(this.props);
  }

  setRole(role) {
    const s = SURFACE[role.id] || SURFACE.hub;
    this.topMat.color.setHex(s.top);
    this.lipMat.color.setHex(s.lip);
    this.dirtMat.color.setHex(s.dirt);
    for (const p of [...this.props.children]) this.props.remove(p);
    const items = PROPS[role.id] || PROPS.hub;
    items.forEach(([angleDeg, build], i) => {
      const obj = build(i);
      const a = THREE.MathUtils.degToRad(angleDeg);
      // 0 deg is straight ahead (-Z); props live at 70..290 deg
      obj.position.set(Math.sin(a) * TOP_R * 0.86, 0, -Math.cos(a) * TOP_R * 0.86);
      obj.rotation.y = -a + Math.PI;
      this.props.add(obj);
    });
  }
}

function wobblyCone(r0, r1, h, seed) {
  const g = new THREE.CylinderGeometry(r0, r1, h, 20, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.07 * Math.sin(a * 5 + seed * 2 + y * 6) * (y < h / 2 - 0.01 ? 1 : 0);
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- prop builders (all toon primitives, ~10-40cm) ----------

const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

function flower(i) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), toon(0x3f9a2f));
  stem.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), toon([0xff5f7e, 0xffd23f, 0xffffff][i % 3]));
  head.scale.y = 0.6;
  head.position.y = 0.13;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), toon(0xffc21a));
  eye.position.set(0, 0.135, 0.02);
  g.add(stem, head, eye);
  return g;
}

function mushroom() {
  const g = new THREE.Group();
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 12), toon(0xfff1d6));
  stalk.position.y = 0.06;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe8302a));
  cap.position.y = 0.11;
  g.add(stalk, cap);
  for (let k = 0; k < 4; k++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), toon(0xffffff));
    const a = (k / 4) * Math.PI * 2;
    dot.position.set(Math.cos(a) * 0.065, 0.18, Math.sin(a) * 0.065);
    g.add(dot);
  }
  return g;
}

function bookStack(i) {
  const g = new THREE.Group();
  const colors = [0xe8302a, 0x1f7bff, 0xffc21a, 0x22a35b, 0x9b3cff];
  let y = 0;
  for (let k = 0; k < 3 + (i % 3); k++) {
    const h = 0.04 + (k % 2) * 0.012;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22 - k * 0.012, h, 0.16), toon(colors[(i + k) % colors.length]));
    b.position.y = y + h / 2;
    b.rotation.y = (k % 2 ? 1 : -1) * 0.12;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.2 - k * 0.012, h * 0.7, 0.005), toon(0xfff6e0));
    pages.position.set(0, y + h / 2, 0.08);
    pages.rotation.y = b.rotation.y;
    g.add(b, pages);
    y += h;
  }
  return g;
}

function mug() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16), toon(0xffffff));
  cup.position.y = 0.05;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), toon(0x5a3018));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.095;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 8, 16), toon(0xffffff));
  handle.position.set(0.05, 0.05, 0);
  g.add(cup, coffee, handle);
  return g;
}

function blueprintRoll(i) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12), toon(k % 2 ? 0xe8f1ff : 0x7fb4ff));
    r.rotation.z = Math.PI / 2;
    r.rotation.y = (k - 1) * 0.3 + i * 0.2;
    r.position.y = 0.03 + k * 0.05;
    g.add(r);
  }
  return g;
}

function trafficCone() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), toon(0xff7a1a));
  base.position.y = 0.01;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 16), toon(0xff7a1a));
  cone.position.y = 0.14;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.045, 0.04, 16), toon(0xffffff));
  stripe.position.y = 0.14;
  g.add(base, cone, stripe);
  return g;
}

function miniBuilding(i) {
  const g = new THREE.Group();
  const h = 0.25 + (i % 3) * 0.1;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), toon(0xe8f1ff));
  b.position.y = h / 2;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: 0x1f7bff }));
  edges.position.copy(b.position);
  g.add(b, edges);
  return g;
}

function nodePost(i) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 8), toon(0x2a4a5a));
  post.position.y = 0.175;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), glowMat([0x3dff8a, 0x5fd3ff, 0xff5fa2][i % 3]));
  orb.position.y = 0.38;
  g.add(post, orb);
  return g;
}

function primitive(i) {
  const geos = [new THREE.SphereGeometry(0.08, 20, 14), new THREE.TorusGeometry(0.07, 0.03, 12, 24), new THREE.BoxGeometry(0.13, 0.13, 0.13)];
  const m = new THREE.Mesh(geos[i % 3], toon(0x9aa3ad));
  m.position.y = 0.1;
  return m;
}

function candle(i) {
  const g = new THREE.Group();
  const h = 0.1 + (i % 3) * 0.05;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, h, 12), toon(0xfff1d6));
  wax.position.y = h / 2;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), glowMat(0xffc85a));
  flame.scale.y = 1.8;
  flame.position.y = h + 0.025;
  g.add(wax, flame);
  return g;
}

function crystal(i) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05 + k * 0.012), toon([0xc58bff, 0x8a5cff, 0xe0c8ff][(i + k) % 3], { emissive: 0x2a0a4a }));
    c.scale.y = 2;
    c.position.set((k - 1) * 0.05, 0.09 + k * 0.01, (k % 2) * 0.03);
    c.rotation.z = (k - 1) * 0.3;
    g.add(c);
  }
  return g;
}

function suitcase(i) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.1), toon([0xd9534f, 0x3f7fe0][i % 2]));
  body.position.y = 0.11;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.105), toon(0x5a3018));
  band.position.y = 0.11;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 16, Math.PI), toon(0x5a3018));
  handle.position.y = 0.22;
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), toon(0xffc21a));
  sticker.position.set(0.08, 0.15, 0.051);
  g.add(body, band, handle, sticker);
  return g;
}

function signpost() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), toon(0x8a5a3b));
  post.position.y = 0.25;
  g.add(post);
  [0xffc21a, 0xe8302a, 0x1f7bff].forEach((c, k) => {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.015), toon(c));
    sign.position.set(0.05 * (k % 2 ? -1 : 1), 0.42 - k * 0.08, 0.02);
    sign.rotation.y = (k - 1) * 0.5;
    g.add(sign);
  });
  return g;
}

const PROPS = {
  hub: [[80, flower], [105, mushroom], [140, flower], [215, flower], [250, mushroom], [280, flower]],
  grad: [[80, bookStack], [120, mug], [160, bookStack], [200, bookStack], [240, mug], [280, bookStack]],
  arch: [[80, trafficCone], [115, blueprintRoll], [155, miniBuilding], [205, miniBuilding], [245, blueprintRoll], [280, trafficCone]],
  ta: [[80, nodePost], [115, primitive], [155, nodePost], [205, primitive], [245, nodePost], [280, primitive]],
  fortune: [[80, candle], [110, crystal], [150, candle], [210, candle], [250, crystal], [280, candle]],
  travel: [[80, suitcase], [120, flower], [160, signpost], [210, suitcase], [250, flower], [280, flower]],
};
