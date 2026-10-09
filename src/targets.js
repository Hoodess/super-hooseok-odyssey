import * as THREE from 'three';
import { HITS_PER_ROLE, TARGETS_PER_ROLE } from './roles.js';
import { toon, inkOutline } from './gloveProps.js';
import { BuildingSlots, makeBuilding, makeFoundation } from './buildings.js';
import {
  blobShadow, assetTexture, paperPlaceholder, stampPlaceholder, tarotBackPlaceholder, tarotFrontPlaceholder, photoPlaceholder,
} from './textures.js';

// Spawns the role's targets, flies them at the player, resolves hits and plays
// each role's hit reaction. Cards and polaroids stay hanging in the world.

const SPAWN_Z = -12;
const REACH_Z = -0.4;
const SPEED = 4.2;
const HIT_RADIUS = 0.17;
const SPAWN_INTERVAL = 1.05;

const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k) => { const x = k - 1; return 1 + 2.7 * x * x * x + 1.7 * x * x; };

export class Targets {
  constructor(scene, world, fx, audio) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.audio = audio;
    this.active = [];
    this.hanging = new THREE.Group();
    scene.add(this.hanging);
    this.role = null;
    this.running = false;
    this.onComplete = null;
    this.onHit = null;
    this.tmp = new THREE.Vector3();
    this.slots = new BuildingSlots();
    this.built = 0;
  }

  start(role, headY, onComplete) {
    this.role = role;
    this.headY = headY;
    this.running = true;
    this.spawned = 0;
    this.hits = 0;
    this.spawnT = 0.4;
    this.onComplete = onComplete;
    this.travelVariant = 0;
    this.slots.reset();
  }

  reset() {
    this.running = false;
    for (const t of this.active) {
      this.scene.remove(t.obj);
      this.scene.remove(t.shadow);
    }
    this.active = [];
    for (const h of [...this.hanging.children]) this.hanging.remove(h);
  }

  spawn() {
    const role = this.role;
    const lane = (this.spawned % 3) - 1 + (Math.random() - 0.5) * 0.5;
    const end = new THREE.Vector3(lane * 0.28, this.headY - 0.3 + (Math.random() - 0.3) * 0.3, REACH_Z);
    const start = new THREE.Vector3(end.x * 4, end.y + 1.2, SPAWN_Z);
    const obj = this.build(role.target, this.spawned);
    obj.position.copy(start);
    this.scene.add(obj);
    const vel = end.clone().sub(start).normalize().multiplyScalar(SPEED);
    const shadow = blobShadow(0.36, 0);
    this.scene.add(shadow);
    this.active.push({ obj, vel, shadow, state: 'fly', index: this.spawned, t: 0, spin: (Math.random() - 0.5) * 2 });
    this.spawned++;
  }

  build(type, i) {
    switch (type) {
      case 'paper': {
        const front = toon(0xffffff, { map: assetTexture('paper_cover.png', paperPlaceholder), spec: 0 });
        const side = toon(0xe8e1cf, { spec: 0 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), [side, side, side, side, front, side]);
        return inkOutline(m, 1.04);
      }
      case 'block': {
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const fill = toon(0x1f7bff, { transparent: true, opacity: 0.16, depthWrite: false });
        g.add(new THREE.Mesh(geo, fill));
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9cc8ff, toneMapped: false })));
        g.userData.fill = fill;
        return g;
      }
      case 'mesh': {
        const geos = [
          new THREE.SphereGeometry(0.15, 32, 20),
          new THREE.TorusGeometry(0.12, 0.05, 20, 48),
          new THREE.TorusKnotGeometry(0.1, 0.035, 96, 14),
          new THREE.IcosahedronGeometry(0.15, 0),
        ];
        return new THREE.Mesh(geos[i % geos.length], new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, flatShading: i % 4 === 3 }));
      }
      case 'card': {
        // a thick card with gold edges: back faces the player while flying (+z),
        // the life scene is on -z and shows once it flips
        const g = new THREE.Group();
        const k = (i % 5) + 1;
        const gold = toon(0xf2c14e, { spec: 0.8 });
        const back = toon(0xffffff, { map: assetTexture('tarot_back.png', tarotBackPlaceholder) });
        const front = toon(0xffffff, { map: assetTexture(`tarot_${k}.png`, tarotFrontPlaceholder(i)), emissive: 0x110818 });
        const card = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.008), [gold, gold, gold, gold, back, front]);
        g.add(inkOutline(card, 1.04));
        return g;
      }
      case 'polaroid': {
        const g = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.012), toon(0xece2cc));
        inkOutline(frame, 1.04);
        const photoMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), photoMat);
        photo.position.set(0, 0.025, 0.007);
        g.add(frame, photo);
        g.userData.photoMat = photoMat;
        return g;
      }
    }
    return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial());
  }

  hit(t) {
    const role = this.role;
    t.state = 'hit';
    t.t = 0;
    this.hits++;
    const pos = t.obj.position.clone();
    const color = role.color;
    this.fx.impact(pos, color, this.camPos);
    this.fx.ring(pos, color, this.camPos, { radius: 0.4, life: 0.35 });
    this.fx.burst(pos, color, { count: 24, speed: 2, size: 0.05, life: 0.5 });
    this.fx.glow(pos, color, 0.6, 0.3);
    this.debris(role.target, pos);
    this.fx.text(role.hitTexts[(this.hits - 1) % role.hitTexts.length], pos.clone().add(new THREE.Vector3(0, 0.2, 0)), hexStr(color), { height: 0.1 });
    this.audio.play('hit');
    this.onHit?.(t);

    const slot = this.hanging.children.length;
    const hangPos = new THREE.Vector3(-0.62 + (slot % 5) * 0.31, this.headY + 0.42 + Math.floor(slot / 5) * 0.45, -1.7);

    switch (role.target) {
      case 'paper': {
        const stamp = new THREE.Mesh(
          new THREE.PlaneGeometry(0.26, 0.13),
          new THREE.MeshBasicMaterial({ map: assetTexture('stamp_accepted.png', stampPlaceholder), transparent: true, toneMapped: false }),
        );
        stamp.position.z = 0.012;
        stamp.rotation.z = -0.25;
        t.obj.add(stamp);
        t.stamp = stamp;
        this.fx.burst(pos, 0xfff6e0, { count: 40, speed: 2.4, size: 0.05, gravity: -1.5 });
        t.vel.set((Math.random() - 0.5) * 1.5, 2.2, -1.2);
        t.post = (dt) => {
          const k = t.t / 1.2;
          stamp.scale.setScalar(k < 0.1 ? 2 - k * 10 : 1);
          t.obj.rotation.x += dt * 4;
          t.obj.position.addScaledVector(t.vel, dt);
          return k >= 1;
        };
        break;
      }
      case 'block': {
        const fill = t.obj.userData.fill;
        fill.opacity = 1;
        fill.transparent = false;
        fill.depthWrite = true;
        fill.color.setHex([0x7fb4ff, 0xffd0dc, 0xffe2b8, 0xd8f5e0][this.hits % 4]);
        fill.needsUpdate = true;
        // the block flies off to the spot where its building rises
        const site = this.raiseBuilding();
        const from = t.obj.position.clone();
        const to = site ? site.clone().add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3((Math.random() - 0.5) * 8, this.headY + 2.5, -10);
        t.post = (dt) => {
          const k = Math.min(1, t.t / 0.9);
          t.obj.position.lerpVectors(from, to, easeOut(k));
          t.obj.rotation.y += dt * 6;
          t.obj.scale.setScalar(1 - k * 0.7);
          return k >= 1;
        };
        break;
      }
      case 'mesh': {
        const looks = [
          new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05 }),
          new THREE.MeshToonMaterial({ color: [0xff5fa2, 0x5fd3ff, 0xffd25f, 0x7dff6b][this.hits % 4] }),
          new THREE.MeshStandardMaterial({
            color: 0x22d36b, emissive: 0x22d36b, emissiveIntensity: 1.2, transparent: true, opacity: 0.55, wireframe: true,
          }),
        ];
        t.obj.material = looks[(this.hits - 1) % looks.length];
        const from = t.obj.position.clone();
        const to = new THREE.Vector3(from.x * 2.5, this.headY + 0.6, -2.2);
        t.post = (dt) => {
          const k = Math.min(1, t.t / 1.6);
          t.obj.position.lerpVectors(from, to, easeOut(k));
          t.obj.rotation.y += dt * 2.5;
          t.obj.rotation.x += dt * 1.2;
          if (k > 0.8) t.obj.scale.setScalar(1 - (k - 0.8) * 5);
          return k >= 1;
        };
        break;
      }
      case 'card':
      case 'polaroid': {
        if (role.target === 'polaroid') {
          const k = (t.index % 5) + 1;
          const pm = t.obj.userData.photoMat;
          pm.map = assetTexture(`photo_${k}.jpg`, photoPlaceholder(t.index));
          pm.color.setHex(0xffffff);
          pm.needsUpdate = true;
          this.fx.flash(0xffffff, 0.25);
          this.audio.play('shutter');
          if (this.hits % 2 === 0 && role.bg.length > 1) {
            this.travelVariant++;
            this.world.setRole(role, this.travelVariant);
          }
        } else {
          this.audio.play('card');
        }
        const from = t.obj.position.clone();
        const startRot = t.obj.rotation.y;
        t.post = (dt) => {
          const k = Math.min(1, t.t / 1.0);
          if (role.target === 'card') t.obj.rotation.y = startRot + Math.PI * easeOut(Math.min(1, t.t / 0.35));
          if (t.t > 0.35) {
            const m = easeOut(Math.min(1, (t.t - 0.35) / 0.65));
            t.obj.position.lerpVectors(from, hangPos, m);
          }
          return k >= 1 ? 'hang' : false;
        };
        break;
      }
    }
  }

  // Role-flavored debris thrown out of every hit.
  debris(type, pos) {
    const fx = this.fx;
    const g = DEBRIS();
    switch (type) {
      case 'paper':
        fx.shards(pos, g.paper, [0xfffaf0, 0xf3ead7, 0xffe45c, 0xff9de0], { count: 16, speed: 2.2, gravity: -2.5, life: 1.3 });
        fx.shards(pos, g.dot, [0xe8302a], { count: 10, speed: 3, life: 0.7 });
        break;
      case 'block':
        fx.shards(pos, g.cube, [0x1f7bff, 0xe8f1ff, 0x7fd4ff, 0xffd21a], { count: 16, speed: 2.8, life: 1.0 });
        break;
      case 'mesh':
        fx.shards(pos, g.pixel, [0x3dff8a, 0xff5fa2, 0x5fd3ff, 0xffd25f], { count: 22, speed: 3, life: 0.9, glowing: true, gravity: -2 });
        break;
      case 'card':
        fx.shards(pos, g.star, [0xf2c14e, 0xffffff, 0xc58bff], { count: 16, speed: 2.4, life: 1.2, glowing: true, gravity: -1.2 });
        break;
      case 'polaroid':
        fx.shards(pos, g.confetti, [0xffc21a, 0xff8a3d, 0xffffff, 0x5fd3ff, 0xe8302a], { count: 24, speed: 2.6, gravity: -2, life: 1.4 });
        fx.shards(pos, g.star, [0xfff3b0], { count: 6, speed: 2, life: 0.8, glowing: true });
        break;
    }
  }

  raiseBuilding() {
    const at = this.slots.take();
    if (!at) return null;
    const root = new THREE.Group();
    root.position.set(at.x, -0.4, at.z);
    root.rotation.y = Math.atan2(-at.x, -at.z); // door faces the player
    const base = makeFoundation();
    const b = makeBuilding(this.built++);
    root.add(base, b);
    base.scale.setScalar(0.001);
    b.scale.set(1, 0.001, 1);
    root.userData = { grow: 0, base, b };
    this.world.props.add(root);
    this.fx.shards(root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), DEBRIS().cube, [0x9cc8ff, 0xffffff, 0x1f7bff], {
      count: 24, speed: 4, size: 4, life: 1.2, gravity: -4,
    });
    return root.position;
  }

  update(dt, hitPoints, autoHit, camPos) {
    this.camPos = camPos;
    for (const p of this.world.props.children) {
      const u = p.userData;
      if (u.grow === undefined) continue;
      if (u.grow < 1) {
        u.grow = Math.min(1, u.grow + dt * 0.9);
        u.base.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, u.grow * 2.5))));
        u.b.scale.y = Math.max(0.001, easeOutBack(Math.max(0, Math.min(1, u.grow * 1.4 - 0.35))));
      }
      p.position.y = -0.4 + Math.sin(performance.now() * 0.0012 + p.position.x) * 0.06;
    }
    if (this.running) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.spawned < TARGETS_PER_ROLE && this.hits < HITS_PER_ROLE) {
        this.spawn();
        this.spawnT = SPAWN_INTERVAL;
      }
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.t += dt;
      if (t.state === 'fly') {
        t.obj.position.addScaledVector(t.vel, dt);
        t.obj.rotation.z = Math.sin(t.t * 2) * 0.2 * t.spin;
        if (this.role.target === 'mesh' || this.role.target === 'block') t.obj.rotation.y += dt * t.spin;
        let hit = false;
        for (const p of hitPoints) if (p.distanceTo(t.obj.position) < HIT_RADIUS) hit = true;
        if (autoHit && t.obj.position.z > REACH_Z - 0.08) hit = true;
        if (hit) this.hit(t);
        else if (t.obj.position.z > 0.6) t.state = 'miss';
      } else if (t.state === 'hit') {
        const r = t.post(dt);
        if (r === 'hang') {
          this.scene.remove(t.shadow);
          this.active.splice(i, 1);
          this.hanging.attach(t.obj);
          continue;
        }
        if (r) t.state = 'gone';
      }
      if (t.state === 'miss') {
        t.obj.position.addScaledVector(t.vel, dt);
        t.obj.scale.multiplyScalar(1 - dt * 6);
        if (t.obj.scale.x < 0.05) t.state = 'gone';
      }
      // blob shadow on the island floor while the target is over it
      const p = t.obj.position;
      const over = Math.hypot(p.x, p.z) < 1.3;
      t.shadow.position.set(p.x, 0.006, p.z);
      t.shadow.material.opacity = over && t.state !== 'gone' ? 0.32 * Math.max(0, 1 - p.y / 3) * t.obj.scale.x : 0;
      t.shadow.scale.setScalar(0.18 + p.y * 0.08);
      if (t.state === 'gone') {
        this.scene.remove(t.shadow);
        this.scene.remove(t.obj);
        this.active.splice(i, 1);
      }
    }
    // hanging cards / polaroids sway gently
    this.hanging.children.forEach((h, i) => {
      h.rotation.z = Math.sin(performance.now() * 0.0015 + i) * 0.06;
    });
    if (this.running) {
      const done = this.hits >= HITS_PER_ROLE || (this.spawned >= TARGETS_PER_ROLE && this.active.every((a) => a.state !== 'fly'));
      if (done && !this.active.some((a) => a.state === 'hit')) {
        this.running = false;
        this.onComplete?.();
      }
    }
  }
}

let debrisGeo = null;
function DEBRIS() {
  if (debrisGeo) return debrisGeo;
  const star = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? 0.009 : 0.022;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  debrisGeo = {
    paper: new THREE.BoxGeometry(0.05, 0.002, 0.065),
    dot: new THREE.SphereGeometry(0.01, 8, 6),
    cube: new THREE.BoxGeometry(0.045, 0.045, 0.045),
    pixel: new THREE.BoxGeometry(0.026, 0.026, 0.026),
    star: new THREE.ExtrudeGeometry(star, { depth: 0.006, bevelEnabled: false }),
    confetti: new THREE.BoxGeometry(0.03, 0.002, 0.018),
  };
  return debrisGeo;
}
