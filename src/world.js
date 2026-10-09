import * as THREE from 'three';
import { assetTexture, bgPlaceholder, glowTexture } from './textures.js';
import { Island } from './island.js';

// The world around the player: gradient sky dome, a 200-degree panorama band
// in front (GPT images are not seamless 360s, so the edges fade into the sky),
// a floating platform under the player, drifting dust and role-tinted lights.

// A narrower arc packs more of the 1536px image into each degree, so the
// panorama reads sharper and farther away. ?arc=<deg>&r=<m> override for testing.
const query = new URLSearchParams(location.search);
const PANO_RADIUS = Number(query.get('r')) || 40;
const PANO_ARC = THREE.MathUtils.degToRad(Number(query.get('arc')) || 160);

export class World {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.skyUniforms = {
      top: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      accent: { value: new THREE.Color() },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(60, PANO_RADIUS * 1.5), 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.skyUniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; uniform vec3 accent;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = mix(bottom, top, smoothstep(-0.35, 0.6, h));
            c += accent * 0.35 * exp(-abs(h) * 6.0);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.renderOrder = -10;
    this.group.add(sky);

    const panoGeo = new THREE.CylinderGeometry(
      PANO_RADIUS, PANO_RADIUS, (PANO_RADIUS * PANO_ARC) / 1.5, 96, 1, true,
      Math.PI - PANO_ARC / 2, PANO_ARC,
    );
    this.panoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: null }, opacity: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float opacity;
        varying vec2 vUv;
        void main() {
          vec2 uv = vec2(1.0 - vUv.x, vUv.y);
          vec4 t = texture2D(map, uv);
          float a = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x)
                  * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(t.rgb, a * opacity);
          #include <colorspace_fragment>
        }`,
    });
    this.pano = new THREE.Mesh(panoGeo, this.panoMat);
    this.pano.position.y = 2;
    this.pano.renderOrder = -9;
    this.group.add(this.pano);

    // platform: a floating toon island whose surface and props follow the role
    this.island = new Island(this.group);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.012, 8, 96), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.02;
    this.group.add(ring);
    this.ring = ring;

    // drifting dust
    const N = 600;
    const pos = new Float32Array(N * 3);
    this.dustSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 2 + Math.random() * 18;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 8 - 1;
      pos[i * 3 + 2] = Math.sin(a) * r;
      this.dustSeed[i] = Math.random() * 10;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustMat = new THREE.PointsMaterial({
      size: 0.08, map: glowTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffffff, toneMapped: false,
    });
    this.dust = new THREE.Points(dustGeo, this.dustMat);
    this.group.add(this.dust);

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 1.4);
    this.group.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(2, 5, 3);
    this.group.add(this.key);
    this.rim = new THREE.PointLight(0xffffff, 6, 8);
    this.rim.position.set(0, 2.5, -2);
    this.group.add(this.rim);

    // background props (e.g. buildings the architect raises)
    this.props = new THREE.Group();
    this.group.add(this.props);
  }

  setRole(role, variant = 0) {
    const files = role.bg;
    const file = files[variant % files.length];
    this.panoMat.uniforms.map.value = assetTexture(file, bgPlaceholder(role, variant));
    const c = new THREE.Color(role.color);
    this.skyUniforms.top.value.setHex(role.skyTop);
    this.skyUniforms.bottom.value.setHex(role.skyBottom);
    this.skyUniforms.accent.value.copy(c);
    this.ringMat.color.copy(c).multiplyScalar(2.0);
    this.dustMat.color.copy(c).lerp(new THREE.Color(0xffffff), 0.5);
    this.hemi.color.copy(c).lerp(new THREE.Color(0xffffff), 0.6);
    this.rim.color.copy(c);
    this.island.setRole(role);
  }

  clearProps() {
    for (const p of [...this.props.children]) this.props.remove(p);
  }

  update(t, dt) {
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.15;
      if (y > 7) y = -1;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.5 + this.dustSeed[i]) * dt * 0.05);
    }
    p.needsUpdate = true;
    this.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.01);
  }
}
