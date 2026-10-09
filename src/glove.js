import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildProps, toon, INFLATE } from './gloveProps.js';

// In WebXR joint space (and in the generic hand model's bones), +Y points out
// of the back of the hand and -Z points toward the fingertips.
export const BACK_OF_HAND = new THREE.Vector3(0, 1, 0);

// One toon material shared by both gloves. On top of the shared toon shading
// the glove shader (1) inflates the thin tracked-hand mesh along its normals so
// it reads as a puffy cartoon glove, and (2) paints it two-tone: a light palm
// and the role color on the back, with fingertips a shade darker. The per-vertex
// back/palm and fingertip weights are baked once per mesh in `bakeZones`.
// Each glove also gets an inverted-hull outline, stitch lines, and the role's
// cuff and props.
export class GloveSkin {
  constructor() {
    this.palm = { value: new THREE.Color() };
    this.inflate = { value: INFLATE };
    const m = toon(0xe0201c, { emissive: 0x000000, spec: 0.3 });
    const toonCompile = m.onBeforeCompile;
    m.onBeforeCompile = (shader) => {
      toonCompile(shader);
      shader.uniforms.uInflate = this.inflate;
      shader.uniforms.uPalm = this.palm;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aBack;
attribute float aTip;
varying float vBack;
varying float vTip;
uniform float uInflate;`)
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>
transformed += normalize(objectNormal) * uInflate;
vBack = aBack;
vTip = aTip;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying float vBack;
varying float vTip;
uniform vec3 uPalm;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(uPalm, diffuseColor.rgb, smoothstep(-0.3, 0.2, vBack));
diffuseColor.rgb *= 1.0 - 0.2 * vTip;`);
    };
    m.customProgramCacheKey = () => 'nintendo-toon-glove';
    this.material = m;
    this.stitch = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.outlineWidth = { value: 0.0028 + INFLATE };
    this.outline = new THREE.MeshBasicMaterial({ color: 0x2a0606, side: THREE.BackSide });
    this.outline.onBeforeCompile = (shader) => {
      shader.uniforms.outlineWidth = this.outlineWidth;
      shader.vertexShader = 'uniform float outlineWidth;\n' + shader.vertexShader.replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * outlineWidth;',
      );
    };
    this.baseEmissive = new THREE.Color();
    this.pulseT = 0;
    this.roleId = 'hub';
    this.gloves = []; // { object, side, props: Object3D[] }
  }

  setRole(role) {
    const m = this.material;
    m.map = null;
    m.color.setHex(role.glove ?? role.color);
    // palm: the glove color washed toward cream; stitches: a deep shade of it
    this.palm.value.setHex(role.palm ?? role.glove ?? role.color).lerp(new THREE.Color(0xfff6e8), role.palm ? 0 : 0.55);
    this.stitch.color.setHex(role.glove ?? role.color).multiplyScalar(0.35);
    this.baseEmissive.setHex(role.color).multiplyScalar(0.12);
    m.emissive.copy(this.baseEmissive);
    m.needsUpdate = true;
    this.outline.color.setHex(role.color).multiplyScalar(0.22);
    this.roleId = role.id;
    this.gloves = this.gloves.filter((g) => attached(g.object));
    for (const g of this.gloves) this.dress(g);
    this.pulse();
  }

  dress(glove) {
    for (const p of glove.props) p.removeFromParent();
    glove.props = [];
    for (const { bone, object } of buildProps(this.roleId, glove.side)) {
      const b = glove.object.getObjectByName(bone);
      if (!b) continue;
      b.add(object);
      glove.props.push(object);
    }
  }

  pulse() {
    this.pulseT = 1;
  }

  update(dt) {
    if (this.pulseT > 0) {
      this.pulseT = Math.max(0, this.pulseT - dt * 3);
      this.material.emissive.copy(this.baseEmissive).lerp(new THREE.Color(0xffffff), this.pulseT * 0.35);
    }
  }

  apply(object, side) {
    const skinned = [];
    object.traverse((o) => {
      if (o.isMesh) {
        o.material = this.material;
        o.frustumCulled = false;
        if (o.isSkinnedMesh) skinned.push(o);
      }
    });
    for (const mesh of skinned) {
      bakeZones(mesh);
      const hull = new THREE.SkinnedMesh(mesh.geometry, this.outline);
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.position.copy(mesh.position);
      hull.quaternion.copy(mesh.quaternion);
      hull.scale.copy(mesh.scale);
      hull.frustumCulled = false;
      mesh.parent.add(hull);
    }
    addStitches(object, side, this.stitch);
    const glove = { object, side, props: [] };
    this.gloves.push(glove);
    this.dress(glove);
  }
}

// Per-vertex weights for the glove shader: aBack (-1 palm .. 1 back of hand,
// from the bind-pose normal against the wrist's back axis) and aTip (how much
// the vertex follows the distal and tip bones).
function bakeZones(mesh) {
  const geo = mesh.geometry;
  if (geo.attributes.aBack) return;
  const bones = mesh.skeleton.bones;
  const wi = bones.findIndex((b) => b.name === 'wrist');
  const boneBind = new THREE.Matrix4().copy(mesh.skeleton.boneInverses[Math.max(0, wi)]).invert();
  const axis = new THREE.Vector3(0, 1, 0).transformDirection(boneBind).transformDirection(mesh.bindMatrixInverse);
  const tipBone = bones.map((b) => /distal|tip/.test(b.name));
  const n = geo.attributes.normal;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const back = new Float32Array(n.count);
  const tip = new Float32Array(n.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    back[i] = v.fromBufferAttribute(n, i).normalize().dot(axis);
    let t = 0;
    for (let k = 0; k < 4; k++) if (tipBone[si.getComponent(i, k)]) t += sw.getComponent(i, k);
    tip[i] = t;
  }
  geo.setAttribute('aBack', new THREE.BufferAttribute(back, 1));
  geo.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
}

// Stitching: dashed seams along the back of each finger, and on the right glove
// the three classic seams on the back of the hand (the left one carries Cappy's
// face there). The bones in this model are siblings, so each segment's
// direction is the next joint's position minus this one's, in this bone's frame.
const FINGER_SEAMS = [
  ...['index', 'middle', 'ring', 'pinky'].flatMap((f) => [
    [`${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`, 0.0096],
    [`${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, 0.0086],
  ]),
  ['thumb-phalanx-proximal', 'thumb-phalanx-distal', 0.0104],
];

function segmentDir(root, a, b) {
  const A = root.getObjectByName(a);
  const B = root.getObjectByName(b);
  if (!A || !B) return null;
  const d = B.position.clone().sub(A.position).applyQuaternion(A.quaternion.clone().invert());
  return { bone: A, len: d.length(), dir: d.normalize() };
}

function dashes(dir, len, up, fractions, dashLen, offset = new THREE.Vector3()) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return fractions.map((f) => {
    const g = new THREE.CapsuleGeometry(0.0011, dashLen, 2, 6);
    g.applyQuaternion(q);
    g.translate(dir.x * len * f + offset.x, dir.y * len * f + up + offset.y, dir.z * len * f + offset.z);
    return g;
  });
}

function addStitches(root, side, mat) {
  for (const [a, b, r] of FINGER_SEAMS) {
    const s = segmentDir(root, a, b);
    if (!s) continue;
    const geo = mergeGeometries(dashes(s.dir, s.len, r + INFLATE, [0.22, 0.5, 0.78], 0.0045));
    s.bone.add(new THREE.Mesh(geo, mat));
  }
  if (side !== 'right') return;
  const s = segmentDir(root, 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal');
  if (!s) return;
  const across = new THREE.Vector3(0, 1, 0).cross(s.dir).normalize();
  const parts = [-1, 0, 1].flatMap((k) => dashes(s.dir, s.len, 0.0155 + INFLATE, [0.5], s.len * 0.42, across.clone().multiplyScalar(k * 0.017)));
  s.bone.add(new THREE.Mesh(mergeGeometries(parts), mat));
}

function attached(object) {
  let o = object;
  while (o.parent) o = o.parent;
  return o.isScene;
}

// The glowing button on the back of the left glove that starts the roulette.
export function makeHandButton(color = 0xff3b30) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 24), mat);
  g.add(disc);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.setScalar(0.05);
  g.add(glow);
  g.userData.mat = mat;
  g.userData.glow = glow;
  return g;
}
