import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Cartoon dress-up for the gloves: a puffy Mario-style cuff on every glove plus
// a few small props per role, all built from primitives and hung on hand bones.
// Bone space: +Y out of the back of the hand, -Z toward the fingertips, X across
// the palm (mirrored between hands, so props use `mx` to stay on the same side).

// How far the glove shader pushes the hand surface out (meters); props that
// sit on the glove move out by the same amount.
export const INFLATE = 0.0035;

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
  const puff = new THREE.Mesh(new THREE.TorusGeometry(0.036 + INFLATE, 0.014, 12, 32), toon(c.color, { spec: 0.25 }));
  puff.scale.set(1.05, 0.72, 1.25);
  g.add(puff);
  if (c.trim) {
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.037 + INFLATE, 0.0035, 8, 32),
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
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.0105 + INFLATE, 0.0028, 8, 20), glowing ? glow(color) : toon(color, { spec: 0.8 }));
  m.position.z = -0.016;
  if (glowing) m.add(halo(color, 0.045, 0.45));
  return m;
}

// Returns [{ bone, object }] for one glove: the cuff, plus finger rings on the
// right glove. The left glove carries Cappy's eyes and the roulette button on
// the back of the hand; the role's badge sits on the back of the right one
// (handBadges.js).
export function buildProps(roleId, side) {
  const out = [{ bone: 'wrist', object: cuff(roleId) }];
  if (side !== 'right') return out;
  const add = (bone, object) => out.push({ bone, object });

  switch (roleId) {
    case 'ta': {
      add('index-finger-phalanx-proximal', ring(0x3dff8a, true));
      add('middle-finger-phalanx-proximal', ring(0x3dff8a, true));
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), glow(0x8affc0));
      node.add(halo(0x3dff8a, 0.05, 0.8));
      add('index-finger-tip', node);
      break;
    }
    case 'fortune': {
      add('middle-finger-phalanx-proximal', ring(0xf2c14e));
      add('ring-finger-phalanx-proximal', ring(0xf2c14e));
      break;
    }
  }
  return out;
}
