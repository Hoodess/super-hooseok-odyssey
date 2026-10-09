import * as THREE from 'three';
import { glowTexture, makeTextSprite, canvas } from './textures.js';
import { toon } from './gloveProps.js';

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

    // Halftone transition: a head-locked sheet of dots that grow from the center
    // out until they cover the view, then shrink from the center out to reveal.
    this.toneUniforms = {
      uColor: { value: new THREE.Color() },
      uColor2: { value: new THREE.Color() },
      uCover: { value: 0 },
      uReveal: { value: 0 },
    };
    this.tone = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShaderMaterial({
        uniforms: this.toneUniforms,
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform vec3 uColor2; uniform float uCover; uniform float uReveal;
          varying vec2 vUv;
          const float CELLS = 34.0;
          void main() {
            vec2 g = vUv * CELLS;
            g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5; // staggered rows
            vec2 cell = floor(g) / CELLS;
            float d = length(cell - 0.5) * 1.41; // 0 center .. 1 corner
            float grow = clamp(uCover * 2.3 - d * 1.3, 0.0, 1.0);
            float shrink = clamp((1.0 - uReveal) * 2.3 - (1.0 - d) * 1.3, 0.0, 1.0);
            float r = min(grow, shrink) * 0.78;
            float dist = length(fract(g) - 0.5);
            float a = 1.0 - smoothstep(r - 0.03, r, dist);
            if (a <= 0.0) discard;
            vec3 col = mix(uColor2, uColor, smoothstep(0.0, 0.9, d));
            gl_FragColor = vec4(col, a);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.tone.position.z = -1;
    this.tone.renderOrder = 99;
    this.tone.visible = false;
    camera.add(this.tone);
    this.toneAnim = null;
  }

  // Cover the view with dots (onCover fires once fully covered), then open from
  // the center. `fast` is for the finale montage's rapid cuts.
  halftone(color, onCover, { cover = 0.3, hold = 0.06, reveal = 0.5 } = {}) {
    const c = new THREE.Color(color);
    this.toneUniforms.uColor.value.copy(c);
    this.toneUniforms.uColor2.value.copy(c).lerp(new THREE.Color(0xffffff), 0.08);
    this.toneUniforms.uColor.value.multiplyScalar(0.7); // darker toward the edges
    this.toneUniforms.uCover.value = 0;
    this.toneUniforms.uReveal.value = 0;
    this.tone.visible = true;
    this.toneAnim = { t: 0, cover, hold, reveal, onCover, fired: false };
  }

  // Sparkles pulled in from all around into `center` (anticipation before a burst).
  converge(center, color, { count = 40, radius = 0.32, life = 0.28 } = {}) {
    const geo = new THREE.BufferGeometry();
    const from = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.6 + Math.random() * 0.4));
      from[i * 3] = center.x + d.x; from[i * 3 + 1] = center.y + d.y; from[i * 3 + 2] = center.z + d.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(from.slice(), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.035, map: glowTexture(), color, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.items.push({ kind: 'converge', obj: pts, from, center: center.clone(), t: 0, life });
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
    const s = makeTextSprite(str, { color, stroke: '#1a1030', inner: '#ffffff', height });
    s.material.rotation = (Math.random() - 0.5) * 0.25;
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

  // Chunky debris: an instanced burst of small toon (or glowing) pieces that
  // tumble, fall and shrink away. `geo` is any small geometry.
  shards(pos, geo, colors, { count = 18, speed = 2.6, life = 1.0, gravity = -5, size = 1, glowing = false, up = 1.2 } = {}) {
    const mat = glowing
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
      : toon(0xffffff);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const parts = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      v.y += up;
      parts.push({
        p: pos.clone(), v,
        axis: new THREE.Vector3().randomDirection(), spin: (Math.random() - 0.5) * 16,
        s: size * (0.6 + Math.random() * 0.6), q: new THREE.Quaternion().random(),
      });
      mesh.setColorAt(i, c.setHex(colors[i % colors.length]));
    }
    this.scene.add(mesh);
    this.items.push({ kind: 'shards', obj: mesh, parts, t: 0, life, gravity, ownGeo: false });
  }

  // Layered hit spark, all facing the viewer: a white flash core, two
  // shockwave rings (white and fast, colored and slower) that thin as they
  // grow, speed lines shooting outward, and a few spinning four-point twinkles.
  hitSpark(pos, color, camPos, { scale = 1 } = {}) {
    const add = (obj, data) => {
      obj.renderOrder = 15;
      this.scene.add(obj);
      this.items.push({ obj, t: 0, ...data });
    };
    const sprite = (map, c, opacity = 1) => new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: c, transparent: true, opacity, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    const p = pos.clone().lerp(camPos, 0.05);

    add(sprite(glowTexture(), 0xffffff, 0.85), { kind: 'spark', life: 0.14, size: 0.18 * scale, pos: p, peak: 0.85 });
    add(sprite(ringTexture(), 0xffffff), { kind: 'spark', life: 0.22, size: 0.3 * scale, grow: true, pos: p });
    add(sprite(ringTexture(), color), { kind: 'spark', life: 0.38, size: 0.48 * scale, grow: true, pos: p, delay: 0.03 });

    // speed lines: thin quads on a camera-facing disc, flying outward
    const disc = new THREE.Group();
    disc.position.copy(p);
    disc.lookAt(camPos);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    });
    const rays = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.random() * 0.3;
      const ray = new THREE.Mesh(lineGeo(), lineMat);
      ray.rotation.z = a - Math.PI / 2;
      ray.userData = { a, speed: 0.9 + Math.random() * 0.6, len: 0.06 + Math.random() * 0.05 };
      disc.add(ray);
      rays.push(ray);
    }
    add(disc, { kind: 'rays', life: 0.26, rays, scale, mat: lineMat });

    for (let k = 0; k < 5; k++) {
      const tw = sprite(twinkleTexture(), k % 2 ? color : 0xffffff);
      const off = new THREE.Vector3().randomDirection().multiplyScalar(0.08 + Math.random() * 0.1);
      add(tw, {
        kind: 'twinkle', life: 0.45 + Math.random() * 0.2, size: (0.06 + Math.random() * 0.05) * scale,
        pos: p.clone().add(off), vel: off.multiplyScalar(2), spin: (Math.random() - 0.5) * 10, delay: k * 0.02,
      });
    }
  }

  flash(color = 0xffffff, dur = 0.6) {
    this.flashMat.color.setHex(color);
    this.flashT = dur;
    this.flashDur = dur;
  }

  update(dt) {
    const ta = this.toneAnim;
    if (ta) {
      ta.t += dt;
      const u = this.toneUniforms;
      u.uCover.value = Math.min(1, ta.t / ta.cover);
      if (!ta.fired && ta.t >= ta.cover) {
        ta.fired = true;
        ta.onCover?.();
      }
      u.uReveal.value = Math.max(0, Math.min(1, (ta.t - ta.cover - ta.hold) / ta.reveal));
      if (u.uReveal.value >= 1) {
        this.toneAnim = null;
        this.tone.visible = false;
      }
    }
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
        if (it.kind !== 'shards' && it.kind !== 'rays') it.obj.geometry?.dispose();
        (it.kind === 'rays' ? it.mat : it.obj.material).dispose();
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
      } else if (it.kind === 'shards') {
        const m4 = new THREE.Matrix4();
        const dq = new THREE.Quaternion();
        const sc = new THREE.Vector3();
        it.parts.forEach((pt, j) => {
          pt.v.y += it.gravity * dt;
          pt.v.multiplyScalar(1 - dt * 1.2);
          pt.p.addScaledVector(pt.v, dt);
          pt.q.multiply(dq.setFromAxisAngle(pt.axis, pt.spin * dt));
          const s = pt.s * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : Math.min(1, k * 12));
          it.obj.setMatrixAt(j, m4.compose(pt.p, pt.q, sc.setScalar(Math.max(0.001, s))));
        });
        it.obj.instanceMatrix.needsUpdate = true;
      } else if (it.kind === 'spark') {
        const kk = Math.max(0, (it.t - (it.delay || 0)) / (it.life - (it.delay || 0)));
        it.obj.position.copy(it.pos);
        const e = 1 - Math.pow(1 - kk, 3);
        it.obj.scale.setScalar(Math.max(0.001, it.grow ? it.size * (0.15 + 0.85 * e) : it.size * (kk < 0.3 ? kk / 0.3 : 1)));
        it.obj.material.opacity = kk <= 0 ? 0 : (it.grow ? (1 - kk) * (1 - kk) : 1 - kk) * (it.peak ?? 1);
      } else if (it.kind === 'rays') {
        const e = 1 - Math.pow(1 - k, 2);
        for (const r of it.rays) {
          const u = r.userData;
          const d = (0.04 + e * 0.22 * u.speed) * it.scale;
          r.position.set(Math.cos(u.a) * d, Math.sin(u.a) * d, 0);
          r.scale.set(0.006 * it.scale * (1 - k * 0.6), u.len * it.scale * (1 - k), 1);
        }
        it.mat.opacity = 1 - k;
      } else if (it.kind === 'twinkle') {
        const kk = Math.max(0, (it.t - it.delay) / (it.life - it.delay));
        it.pos.addScaledVector(it.vel, dt);
        it.vel.multiplyScalar(1 - dt * 6);
        it.obj.position.copy(it.pos);
        it.obj.material.rotation += it.spin * dt;
        const pop = kk < 0.25 ? kk / 0.25 : 1 - (kk - 0.25) / 0.75;
        it.obj.scale.setScalar(Math.max(0.001, it.size * pop));
        it.obj.material.opacity = kk <= 0 ? 0 : 1;
      } else if (it.kind === 'converge') {
        const a = it.obj.geometry.attributes.position;
        const e = k * k * k;
        for (let j = 0; j < a.count; j++) {
          a.array[j * 3] = it.from[j * 3] + (it.center.x - it.from[j * 3]) * e;
          a.array[j * 3 + 1] = it.from[j * 3 + 1] + (it.center.y - it.from[j * 3 + 1]) * e;
          a.array[j * 3 + 2] = it.from[j * 3 + 2] + (it.center.z - it.from[j * 3 + 2]) * e;
        }
        a.needsUpdate = true;
        it.obj.material.opacity = Math.min(1, k * 4);
      } else if (it.kind === 'glow') {
        it.obj.scale.setScalar(it.size * (1 + k));
        it.obj.material.opacity = 1 - k;
      }
    }
  }
}

let ringTex = null;
function ringTexture() {
  if (ringTex) return ringTex;
  ringTex = new THREE.CanvasTexture(canvas(256, 256, (g, w, h) => {
    const c = w / 2;
    const grad = g.createRadialGradient(c, c, c * 0.62, c, c, c * 0.98);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,1)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }));
  return ringTex;
}

// four-point twinkle with a soft core
let twinkleTex = null;
function twinkleTexture() {
  if (twinkleTex) return twinkleTex;
  twinkleTex = new THREE.CanvasTexture(canvas(128, 128, (g, w, h) => {
    const c = w / 2;
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 9 : 62;
      const a = (i / 8) * Math.PI * 2;
      g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    const glow = g.createRadialGradient(c, c, 0, c, c, 30);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  }));
  return twinkleTex;
}

// a unit speed line, tapered at the inner end
let rayGeo = null;
function lineGeo() {
  if (rayGeo) return rayGeo;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0.5, 0.15);
  sh.lineTo(0, 1);
  sh.lineTo(-0.5, 0.15);
  sh.closePath();
  return (rayGeo = new THREE.ShapeGeometry(sh));
}
