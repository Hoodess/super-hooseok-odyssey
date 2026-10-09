import * as THREE from 'three';
import { textCanvas, glowTexture } from './textures.js';
import { toon, halo } from './gloveProps.js';

// A chunky toy roulette: five beveled toon wedges with an icon and name each,
// a gold rim of chasing bulbs, gold pegs between wedges and a red flapper that
// kicks every time a peg passes it. spinTo(i) lands wedge i under the flapper
// with a small overshoot-and-settle; spinFinale lands on the rainbow HOOSEOK hub.

const R = 0.16;
const DEPTH = 0.012;
// wedge labels must fit a 72-degree slice
const SHORT = { ta: 'TA' };
const ICONS = { grad: '📄', arch: '📐', ta: '💻', fortune: '🔮', travel: '📷' };
const OVERSHOOT = 0.14;
const SETTLE = 0.45;

function textPlane(c, height, depthTest = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((height * c.width) / c.height, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest, toneMapped: false }),
  );
  m.renderOrder = 6;
  return m;
}

function wedgeGeometry(a0, a1) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, R, a0, a1, false);
  s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24,
  });
}

function starGeometry(r1, r2, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 });
}

export class Roulette {
  constructor(roles) {
    this.roles = roles;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.wheel = new THREE.Group();
    this.group.add(this.wheel);
    this.step = (Math.PI * 2) / roles.length;
    this.wedgeMats = [];
    this.wedges = [];
    this.labels = null;

    // back plate doubles as a dark outline around the wheel
    const plate = new THREE.Mesh(new THREE.CircleGeometry(R + 0.03, 64), new THREE.MeshBasicMaterial({ color: 0x1a1030 }));
    plate.position.z = -0.006;
    this.group.add(plate);

    roles.forEach((role, i) => {
      const mat = toon(role.color, { emissive: 0x000000 });
      this.wedgeMats.push(mat);
      const w = new THREE.Mesh(wedgeGeometry(i * this.step + 0.012, (i + 1) * this.step - 0.012), mat);
      this.wheel.add(w);
      this.wedges.push(w);
    });

    const gold = toon(0xffc93c, { emissive: 0x4a2a00, spec: 0.9 });
    // pegs sit on the wedge borders and are what the flapper catches on
    this.pegs = roles.map((_, i) => {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 10), gold);
      const a = i * this.step;
      peg.rotation.x = Math.PI / 2;
      peg.position.set(Math.cos(a) * (R - 0.004), Math.sin(a) * (R - 0.004), 0.02);
      this.wheel.add(peg);
      return peg;
    });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.013, 12, 72), gold);
    rim.position.z = 0.008;
    this.group.add(rim);
    this.bulbMats = [];
    this.bulbHalos = [];
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), mat);
      const a = (i / 24) * Math.PI * 2;
      bulb.position.set(Math.cos(a) * (R + 0.012), Math.sin(a) * (R + 0.012), 0.02);
      const h = halo(0xffd96b, 0.05, 0.6);
      bulb.add(h);
      this.group.add(bulb);
      this.bulbMats.push(mat);
      this.bulbHalos.push(h);
    }

    this.hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.24, R * 0.26, 0.02, 32), toon(0xffffff));
    this.hub.rotation.x = Math.PI / 2;
    this.hub.position.z = 0.016;
    this.group.add(this.hub);
    const star = new THREE.Mesh(starGeometry(0.026, 0.011, 0.006), gold);
    star.position.z = 0.026;
    this.group.add(star);
    this.star = star;
    this.hubLabel = null;

    // flapper: hinged at the top, tip pointing down into the wheel
    this.flapper = new THREE.Group();
    this.flapper.position.set(0, R + 0.05, 0.03);
    const red = toon(0xe8302a, { emissive: 0x220000, spec: 0.8 });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 16), red);
    tip.rotation.z = Math.PI;
    tip.position.y = -0.03;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), red);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), gold);
    pin.position.z = 0.012;
    this.flapper.add(tip, knob, pin);
    this.group.add(this.flapper);
    this.flap = 0;
    this.flapV = 0;

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0,
    }));
    this.glow.scale.setScalar(0.7);
    this.glow.position.z = -0.02;
    this.group.add(this.glow);

    this.anim = null;
    this.popT = 0;
    this.winT = 0;
    this.winner = -1;
  }

  // Built on first show so the bundled Jua font has had time to load.
  buildLabels() {
    if (this.labels) return;
    this.labels = this.roles.map((role, i) => {
      const g = new THREE.Group();
      const icon = textPlane(textCanvas(ICONS[role.id] || '★', { size: 110, color: '#fff', stroke: 'rgba(0,0,0,0)', pad: 16 }), 0.056);
      icon.position.y = 0.016;
      const label = SHORT[role.id] || role.name;
      const name = textPlane(textCanvas(label, { size: 80, color: '#ffffff', stroke: '#2a1440' }), label.length > 4 ? 0.022 : 0.027);
      name.position.y = -0.026;
      g.add(icon, name);
      const mid = i * this.step + this.step / 2;
      g.position.set(Math.cos(mid) * R * 0.6, Math.sin(mid) * R * 0.6, DEPTH + 0.006);
      g.rotation.z = mid - Math.PI / 2;
      this.wheel.add(g);
      return g;
    });
  }

  setHubLabel(text, color = '#ffffff') {
    if (this.hubLabel) this.group.remove(this.hubLabel);
    this.hubLabel = null;
    if (!text) return;
    this.hubLabel = textPlane(textCanvas(text, { size: 96, color, stroke: '#1a1030' }), 0.04, false);
    this.hubLabel.position.set(0, -R - 0.06, 0.03);
    this.hubLabel.renderOrder = 30;
    this.hubLabel.userData.pop = 0;
    this.group.add(this.hubLabel);
  }

  show() {
    this.buildLabels();
    this.group.visible = true;
    this.popT = 0;
    this.winT = 0;
    this.winner = -1;
    this.setHubLabel(null);
    this.hub.material.color.setHex(0xffffff);
    this.roles.forEach((r, i) => {
      this.wedgeMats[i].color.setHex(r.color);
      this.wedgeMats[i].emissive.setHex(0);
      this.wedges[i].scale.setScalar(1);
    });
    this.glow.material.opacity = 0;
  }

  hide() {
    this.group.visible = false;
  }

  // onTick fires each time a peg passes the flapper (for the click sound)
  spinTo(index, { duration = 2.2, turns = 4, onTick, onDone, finale = false } = {}) {
    const start = this.wheel.rotation.z;
    const mid = index * this.step + this.step / 2;
    let target = Math.PI / 2 - mid;
    const base = start + turns * Math.PI * 2;
    target += Math.ceil((base - target) / (Math.PI * 2)) * Math.PI * 2;
    this.anim = { t: 0, duration, start, target, onTick, onDone, finale, index, lastTick: Math.floor(start / this.step) };
  }

  update(dt, t) {
    if (!this.group.visible) return;
    if (this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt * 4);
      const k = this.popT - 1;
      this.group.scale.setScalar(1 + 2.7 * k * k * k + 1.7 * k * k); // easeOutBack
    }
    const spinning = !!this.anim;
    this.bulbMats.forEach((m, i) => {
      const on = spinning ? (Math.floor(t * 14) + i) % 3 === 0 : (Math.floor(t * 4) + i) % 2 === 0;
      m.color.setHex(on ? 0xfff3c4 : 0x7a5a20);
      this.bulbHalos[i].visible = on;
    });
    this.star.rotation.z = -this.wheel.rotation.z * 0.5;

    // flapper spring
    this.flapV += (-this.flap * 180 - this.flapV * 14) * dt;
    this.flap += this.flapV * dt;
    this.flapper.rotation.z = this.flap;

    if (this.hubLabel && this.hubLabel.userData.pop < 1) {
      const p = (this.hubLabel.userData.pop = Math.min(1, this.hubLabel.userData.pop + dt * 5));
      const k = p - 1;
      this.hubLabel.scale.setScalar(1 + 2.7 * k * k * k + 1.7 * k * k);
    }

    if (this.winner >= 0 && this.winT < 1) {
      this.winT = Math.min(1, this.winT + dt * 1.6);
      const pulse = Math.sin(this.winT * Math.PI * 3) * (1 - this.winT);
      this.wedges[this.winner].scale.setScalar(1 + Math.abs(pulse) * 0.12);
      this.wedgeMats[this.winner].emissive.setScalar(Math.abs(pulse) * 0.5);
      this.glow.material.opacity = (1 - this.winT) * 0.9;
    }

    const a = this.anim;
    if (!a) return;
    a.t += dt;
    const over = a.target + OVERSHOOT;
    let rot;
    if (a.t < a.duration) {
      const k = a.t / a.duration;
      rot = a.start + (over - a.start) * (1 - Math.pow(1 - k, 4));
    } else {
      const k = Math.min(1, (a.t - a.duration) / SETTLE);
      rot = over - OVERSHOOT * (1 - Math.pow(1 - k, 3)) - Math.sin(k * Math.PI) * 0.02;
    }
    this.wheel.rotation.z = rot;
    const tick = Math.floor(rot / this.step);
    if (tick !== a.lastTick) {
      const dir = Math.sign(tick - a.lastTick);
      a.lastTick = tick;
      this.flapV += 9 * dir;
      a.onTick?.();
    }
    if (a.finale) {
      const hue = (t * 3) % 1;
      this.wedgeMats.forEach((m, i) => m.color.setHSL((hue + i / 5) % 1, 0.9, 0.55));
      this.hub.material.color.setHSL((hue + 0.5) % 1, 0.9, 0.6);
    }
    if (a.t >= a.duration + SETTLE) {
      this.anim = null;
      if (!a.finale) {
        this.winner = a.index;
        this.winT = 0;
        this.glow.material.color.setHex(this.roles[a.index].color);
      }
      a.onDone?.();
    }
  }
}
