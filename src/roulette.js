import * as THREE from 'three';
import { textCanvas } from './textures.js';

// Five colored wedges + a fixed pointer. spinTo(i) lands wedge i under the
// pointer; spinFinale() spins wildly and lands on the rainbow HOOSEOK hub.

const R = 0.16;

function labelMesh(text, height) {
  const c = textCanvas(text, { size: 90, color: '#ffffff', stroke: '#111111' });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((height * c.width) / c.height, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.renderOrder = 6;
  return m;
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

    roles.forEach((role, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: role.color, side: THREE.DoubleSide });
      this.wedgeMats.push(mat);
      const w = new THREE.Mesh(new THREE.CircleGeometry(R, 32, i * this.step + 0.01, this.step - 0.02), mat);
      this.wheel.add(w);
      const mid = i * this.step + this.step / 2;
      const lbl = labelMesh(role.name, 0.022);
      lbl.position.set(Math.cos(mid) * R * 0.62, Math.sin(mid) * R * 0.62, 0.002);
      lbl.rotation.z = mid - Math.PI / 2;
      this.wheel.add(lbl);
    });

    const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.9, roughness: 0.25, emissive: 0x553300 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.01, 12, 64), gold);
    this.group.add(rim);
    for (let i = 0; i < 20; i++) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.0055, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false }),
      );
      const a = (i / 20) * Math.PI * 2;
      bulb.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.008);
      this.group.add(bulb);
    }
    this.bulbs = this.group.children.slice(-20);

    this.hub = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.28, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    this.hub.position.z = 0.004;
    this.group.add(this.hub);
    this.hubLabel = null;

    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.04, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }),
    );
    pointer.rotation.z = Math.PI;
    pointer.position.set(0, R + 0.022, 0.01);
    this.group.add(pointer);

    this.anim = null;
    this.popT = 0;
  }

  setHubLabel(text, color = '#ffffff') {
    if (this.hubLabel) this.group.remove(this.hubLabel);
    if (!text) return;
    const c = textCanvas(text, { size: 90, color, stroke: '#111' });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const h = 0.03;
    this.hubLabel = new THREE.Mesh(
      new THREE.PlaneGeometry((h * c.width) / c.height, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }),
    );
    this.hubLabel.position.set(0, -R - 0.04, 0.01);
    this.hubLabel.renderOrder = 30;
    this.group.add(this.hubLabel);
  }

  show() {
    this.group.visible = true;
    this.popT = 0;
    this.setHubLabel(null);
    this.hub.material.color.setHex(0xffffff);
    this.roles.forEach((r, i) => this.wedgeMats[i].color.setHex(r.color));
  }

  hide() {
    this.group.visible = false;
  }

  // onTick fires each time a wedge edge passes the pointer (for the click sound)
  spinTo(index, { duration = 2.2, turns = 4, onTick, onDone, finale = false } = {}) {
    const start = this.wheel.rotation.z;
    const mid = index * this.step + this.step / 2;
    let target = Math.PI / 2 - mid;
    const base = start + turns * Math.PI * 2;
    target += Math.ceil((base - target) / (Math.PI * 2)) * Math.PI * 2;
    this.anim = { t: 0, duration, start, target, onTick, onDone, finale, lastTick: Math.floor(start / this.step) };
  }

  update(dt, t) {
    if (this.group.visible && this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt * 4);
      const k = this.popT - 1;
      this.group.scale.setScalar(1 + 2.7 * k * k * k + 1.7 * k * k); // easeOutBack
    }
    this.bulbs.forEach((b, i) => {
      const on = (Math.floor(t * 8) + i) % 2 === 0;
      b.material.color.setHex(on ? 0xfff3c4 : 0x806a30);
    });
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.duration);
    const e = 1 - Math.pow(1 - k, 4);
    this.wheel.rotation.z = a.start + (a.target - a.start) * e;
    const tick = Math.floor(this.wheel.rotation.z / this.step);
    if (tick !== a.lastTick) {
      a.lastTick = tick;
      a.onTick?.();
    }
    if (a.finale) {
      const hue = (t * 3) % 1;
      this.wedgeMats.forEach((m, i) => m.color.setHSL((hue + i / 5) % 1, 0.9, 0.55));
      this.hub.material.color.setHSL((hue + 0.5) % 1, 0.9, 0.6);
    }
    if (k >= 1) {
      this.anim = null;
      a.onDone?.();
    }
  }
}
