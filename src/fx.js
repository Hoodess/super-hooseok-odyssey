import * as THREE from 'three';
import { glowTexture, makeTextSprite } from './textures.js';

// Short-lived visual effects: particle bursts, shockwave rings, floating text,
// the full-view flash used for transformations.

export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.items = [];

    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false,
    });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), this.flashMat);
    flash.position.z = -0.15;
    flash.renderOrder = 100;
    camera.add(flash);
    this.flashT = 0;
    this.flashDur = 0.6;
  }

  burst(pos, color, { count = 60, speed = 3, size = 0.06, life = 0.9, gravity = -3 } = {}) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      v[i * 3] = d.x; v[i * 3 + 1] = d.y; v[i * 3 + 2] = d.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({
      size, map: glowTexture(), color, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.items.push({ kind: 'burst', obj: pts, v, t: 0, life, gravity });
  }

  ring(pos, color, facing, { radius = 0.6, life = 0.5 } = {}) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), mat);
    m.position.copy(pos);
    if (facing) m.lookAt(facing);
    m.scale.setScalar(0.05);
    this.scene.add(m);
    this.items.push({ kind: 'ring', obj: m, t: 0, life, radius });
  }

  text(str, pos, color = '#ffffff', { height = 0.09, life = 1.1 } = {}) {
    const s = makeTextSprite(str, { color, stroke: '#1a1a1a', height });
    s.position.copy(pos);
    this.scene.add(s);
    this.items.push({ kind: 'text', obj: s, t: 0, life, base: height, start: pos.clone() });
    return s;
  }

  glow(pos, color, size = 0.6, life = 0.4) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    s.position.copy(pos);
    s.scale.setScalar(size);
    this.scene.add(s);
    this.items.push({ kind: 'glow', obj: s, t: 0, life, size });
  }

  flash(color = 0xffffff, dur = 0.6) {
    this.flashMat.color.setHex(color);
    this.flashT = dur;
    this.flashDur = dur;
  }

  update(dt) {
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      const k = this.flashT / this.flashDur;
      this.flashMat.opacity = Math.pow(k, 1.6);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.obj.geometry?.dispose();
        it.obj.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.kind === 'burst') {
        const a = it.obj.geometry.attributes.position;
        for (let j = 0; j < a.count; j++) {
          it.v[j * 3 + 1] += it.gravity * dt;
          a.array[j * 3] += it.v[j * 3] * dt;
          a.array[j * 3 + 1] += it.v[j * 3 + 1] * dt;
          a.array[j * 3 + 2] += it.v[j * 3 + 2] * dt;
        }
        a.needsUpdate = true;
        it.obj.material.opacity = 1 - k * k;
      } else if (it.kind === 'ring') {
        it.obj.scale.setScalar(0.05 + it.radius * (1 - Math.pow(1 - k, 3)));
        it.obj.material.opacity = 1 - k;
      } else if (it.kind === 'text') {
        const pop = k < 0.15 ? k / 0.15 : 1;
        const s = it.base * (0.6 + 0.5 * Math.sin(Math.min(pop, 1) * Math.PI * 0.75));
        it.obj.scale.set((s * it.obj.scale.x) / it.obj.scale.y, s, 1);
        it.obj.position.y = it.start.y + k * 0.25;
        it.obj.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      } else if (it.kind === 'glow') {
        it.obj.scale.setScalar(it.size * (1 + k));
        it.obj.material.opacity = 1 - k;
      }
    }
  }
}
