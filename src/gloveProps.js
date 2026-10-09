import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Cartoon dress-up for the gloves: a puffy Mario-style cuff on every glove plus
// a few small props per role, all built from primitives and hung on hand bones.
// Bone space: +Y out of the back of the hand, -Z toward the fingertips, X across
// the palm (mirrored between hands, so props use `mx` to stay on the same side).

let gradient = null;
export function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

// Shared look for every toon surface; World.setRole retints these per role.
export const LOOK = {
  shadowTint: { value: new THREE.Color(0xa89ad6) }, // multiplies the unlit side
  rimColor: { value: new THREE.Color(0xffe9a8) },
  rimStrength: { value: 0.32 },
};

// Nintendo-style toon on top of MeshToonMaterial: hue-tinted shadows instead of
// plain dark, a fresnel rim in the light color, and a hard toy-plastic highlight.
// `spec` (0..1) turns on the highlight. It is off by default because a flat face
// catches it everywhere at once; use it on rounded things.
function nintendoToon(shader, spec) {
  shader.uniforms.uShadowTint = LOOK.shadowTint;
  shader.uniforms.uRimColor = LOOK.rimColor;
  shader.uniforms.uRimStrength = LOOK.rimStrength;
  shader.uniforms.uSpec = { value: spec };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform vec3 uShadowTint;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uSpec;`)
    .replace('#include <opaque_fragment>', `{
  vec3 N = normalize(normal);
  vec3 V = normalize(vViewPosition);
  #if NUM_DIR_LIGHTS > 0
    vec3 L = directionalLights[0].direction;
  #else
    vec3 L = vec3(0.0, 1.0, 0.0);
  #endif
  float ndl = dot(N, L);
  float lit = smoothstep(-0.08, 0.12, ndl);
  outgoingLight *= mix(uShadowTint, vec3(1.0), lit);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  outgoingLight += uRimColor * smoothstep(0.5, 0.85, fres) * uRimStrength * lit;
  float h = dot(N, normalize(L + V));
  outgoingLight += vec3(smoothstep(0.965, 0.98, h) * uSpec * 0.45);
}
#include <opaque_fragment>`);
}

export const toon = (color, { spec = 0, ...extra } = {}) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
  m.onBeforeCompile = (shader) => nintendoToon(shader, spec);
  m.customProgramCacheKey = () => 'nintendo-toon';
  return m;
};

const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

// A soft additive halo. The headset renders without bloom, so anything meant to
// glow carries one of these to read as lit there too.
export function halo(color, size = 0.05, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  s.scale.setScalar(size);
  return s;
}

// Ink outline for small props: a slightly larger back-face copy of each toon
// mesh whose geometry is centered on its origin (true for the primitives here).
const inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide });
export function inkOutline(root, k = 1.08) {
  const meshes = [];
  root.traverse((o) => {
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (o.isMesh && mat?.isMeshToonMaterial && !o.userData.noOutline) meshes.push(o);
  });
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
    if (c.length() > 0.002) continue;
    const h = new THREE.Mesh(m.geometry, inkMat);
    h.scale.setScalar(k);
    h.userData.noOutline = true;
    m.add(h);
  }
  return root;
}

const CUFF = {
  hub: { color: 0xf1ece4 },
  grad: { color: 0xf1ece4 },
  arch: { color: 0xf1ece4 },
  ta: { color: 0x173040, trim: 0x3dff8a, trimGlow: true },
  fortune: { color: 0x4a1680, trim: 0xf2c14e },
  travel: { color: 0x6b3d1f, trim: 0xe8b04a },
};

function cuff(roleId) {
  const c = CUFF[roleId] || CUFF.hub;
  const g = new THREE.Group();
  const puff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.013, 12, 32), toon(c.color, { spec: 0.25 }));
  puff.scale.set(1.05, 0.72, 1.25);
  g.add(puff);
  if (c.trim) {
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.037, 0.0035, 8, 32),
      c.trimGlow ? glow(c.trim) : toon(c.trim),
    );
    trim.scale.set(1.08, 0.78, 1);
    trim.position.z = -0.012;
    g.add(trim);
  }
  g.position.z = 0.016;
  return g;
}

function ring(color, glowing = false) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0028, 8, 20), glowing ? glow(color) : toon(color, { spec: 0.8 }));
  m.position.z = -0.016;
  if (glowing) m.add(halo(color, 0.045, 0.45));
  return m;
}

function stickyNote(color, x, z, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0012, 0.022), toon(color));
  m.position.set(x, 0.02, z);
  m.rotation.y = rot;
  m.rotation.x = 0.08;
  return m;
}

function pencil() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.07, 6), toon(0xffc21a));
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.012, 6), toon(0xf1d2a0));
  wood.position.y = 0.041;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0013, 0.004, 6), toon(0x333333));
  lead.position.y = 0.0485;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.008, 12), toon(0xff8fb0));
  eraser.position.y = -0.039;
  g.add(body, wood, lead, eraser);
  return g;
}

function setSquare() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.04, 0); s.lineTo(0, 0.03); s.lineTo(0, 0);
  const hole = new THREE.Path();
  hole.moveTo(0.007, 0.006); hole.lineTo(0.022, 0.006); hole.lineTo(0.007, 0.017); hole.lineTo(0.007, 0.006);
  s.holes.push(hole);
  const m = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.0015, bevelEnabled: false }),
    toon(0x7fd4ff, { transparent: true, opacity: 0.85 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

function tapeMeasure() {
  const g = new THREE.Group();
  const caseM = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.009, 20), toon(0xffd21a));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.0095, 12), toon(0x222222));
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0008, 0.03), toon(0xfff3b0));
  tape.position.set(0.012, -0.002, -0.012);
  g.add(caseM, hub, tape);
  return g;
}

function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const fn = i ? 'lineTo' : 'moveTo';
    s[fn](Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

function charm(kind) {
  let shape;
  if (kind === 'star') shape = starShape(0.008, 0.0035);
  else {
    shape = new THREE.Shape();
    shape.absarc(0, 0, 0.008, Math.PI * 0.25, Math.PI * 1.75, false);
    shape.absarc(0.004, 0, 0.0065, Math.PI * 1.6, Math.PI * 0.4, true);
  }
  const m = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 1 }),
    toon(0xf2c14e, { emissive: 0x3a2400 }),
  );
  return m;
}

function compassWatch() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 24), toon(0xc9a14a));
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.0098, 0.0098, 0.0065, 24), toon(0xfff6e0));
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.002, 0.014, 4), toon(0xe8302a));
  needle.rotation.z = Math.PI / 2;
  needle.rotation.y = 0.6;
  needle.position.y = 0.0036;
  g.add(body, face, needle);
  return g;
}

function strap() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.004, 6, 32), toon(0x5a3018));
  band.scale.set(1, 0.48, 1);
  band.rotation.x = 0.15;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.011), toon(0xe8b04a));
  buckle.position.y = 0.021;
  g.add(band, buckle);
  return g;
}

// Returns [{ bone, object }] for one glove. The left glove carries Cappy's eyes
// and the roulette button on the back of the hand, so its props stay off it.
export function buildProps(roleId, side) {
  const mx = side === 'left' ? -1 : 1;
  const out = [{ bone: 'wrist', object: cuff(roleId) }];
  const add = (bone, object) => out.push({ bone, object });

  switch (roleId) {
    case 'grad': {
      if (side === 'right') {
        add('middle-finger-metacarpal', stickyNote(0xffe45c, 0.006 * mx, -0.03, 0.25));
        add('middle-finger-metacarpal', stickyNote(0xff9de0, -0.012 * mx, -0.048, -0.3));
      } else {
        const p = pencil();
        p.rotation.x = -Math.PI / 2;
        p.rotation.z = 0.25 * mx;
        p.position.set(0.024 * mx, 0.03, 0.01);
        add('wrist', p);
      }
      break;
    }
    case 'arch': {
      if (side === 'right') {
        const s = setSquare();
        s.position.set(-0.018 * mx, 0.021, -0.022);
        add('middle-finger-metacarpal', s);
      } else {
        const t = tapeMeasure();
        t.position.set(0, 0.034, 0.016);
        add('wrist', t);
      }
      break;
    }
    case 'ta': {
      add('index-finger-phalanx-proximal', ring(0x3dff8a, true));
      add('middle-finger-phalanx-proximal', ring(0x3dff8a, true));
      if (side === 'right') {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), glow(0x8affc0));
        node.add(halo(0x3dff8a, 0.05, 0.8));
        add('index-finger-tip', node);
      }
      break;
    }
    case 'fortune': {
      add('middle-finger-phalanx-proximal', ring(0xf2c14e));
      add('ring-finger-phalanx-proximal', ring(0xf2c14e));
      if (side === 'left') {
        const star = charm('star');
        star.position.set(0.02 * mx, 0.036, 0.024);
        star.rotation.x = -0.4;
        add('wrist', star);
        const moon = charm('moon');
        moon.position.set(-0.016 * mx, 0.036, 0.026);
        moon.rotation.x = -0.4;
        add('wrist', moon);
      } else {
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.009),
          toon(0xc58bff, { emissive: 0x3a0f6a }),
        );
        gem.scale.y = 1.4;
        gem.position.set(0, 0.024, -0.032);
        add('middle-finger-metacarpal', gem);
      }
      break;
    }
    case 'travel': {
      if (side === 'left') {
        const w = compassWatch();
        w.position.set(0, 0.032, 0.016);
        add('wrist', w);
      } else {
        const s = strap();
        s.position.z = -0.03;
        add('middle-finger-metacarpal', s);
      }
      break;
    }
  }
  return out;
}
