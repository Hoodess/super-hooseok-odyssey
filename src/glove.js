import * as THREE from 'three';
import { assetTexture, glovePlaceholder, glowTexture } from './textures.js';
import { buildProps, toon } from './gloveProps.js';

// In WebXR joint space (and in the generic hand model's bones), +Y points out
// of the back of the hand and -Z points toward the fingertips.
export const BACK_OF_HAND = new THREE.Vector3(0, 1, 0);

// One toon material shared by both gloves; swapping its map re-skins both at once.
// Each glove also gets an inverted-hull outline and the role's cuff and props.
export class GloveSkin {
  constructor() {
    this.material = toon(0xe0201c, { emissive: 0x000000, spec: 0.3 });
    this.outlineWidth = { value: 0.003 };
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
    if (role.glove) {
      m.map = assetTexture(role.glove, glovePlaceholder(role));
      m.color.setHex(0xe4e4e4); // a touch under white so pale textures keep detail
    } else {
      m.map = null;
      m.color.setHex(role.color);
    }
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
      const hull = new THREE.SkinnedMesh(mesh.geometry, this.outline);
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.position.copy(mesh.position);
      hull.quaternion.copy(mesh.quaternion);
      hull.scale.copy(mesh.scale);
      hull.frustumCulled = false;
      mesh.parent.add(hull);
    }
    const glove = { object, side, props: [] };
    this.gloves.push(glove);
    this.dress(glove);
  }
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
