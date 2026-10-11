import * as THREE from 'three';
import { toon, halo, inkOutline, INFLATE } from './gloveProps.js';
import { canvas } from './textures.js';

// Each role's badge on the back of the right glove, built from primitives:
//   travel   a brass compass whose needle swings to face forward (world -Z)
//   arch     a set square with a pencil laid across it
//   ta       a little monochrome screen cutting between code and wireframes;
//            a hit puts the struck shape up on it
//   fortune  a constellation floating just above the glove
//   grad     a mortarboard whose tassel hangs with gravity
// Bone space as in gloveProps.js: +Y out of the back of the hand, -Z toward the
// fingertips. Anything that moves sets userData.tick(dt, t); GloveSkin calls it.

// on the middle metacarpal: the glove surface, and the middle of the back of the hand
const SURFACE = 0.0185 + INFLATE;
const CENTER_Z = -0.03;
const BADGE_SCALE = 1.2;

export function roleBadge(roleId) {
  const make = { travel: compass, arch: drafting, ta: screen, fortune: constellation, grad: mortarboard }[roleId];
  if (!make) return [];
  const object = make();
  object.scale.setScalar(BADGE_SCALE);
  object.position.y += SURFACE;
  object.position.z += CENTER_Z;
  return [{ bone: 'middle-finger-metacarpal', object }];
}

const basic = (color, extra) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

// ---------- travel: compass ----------

let compassFace = null;
function compassFaceTexture() {
  if (compassFace) return compassFace;
  const c = canvas(256, 256, (g, w) => {
    const r = w / 2;
    g.fillStyle = '#fff6e0';
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b3d1f';
    g.lineCap = 'round';
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const long = i % 8 === 0;
      g.lineWidth = long ? 7 : 3;
      const r0 = r * (long ? 0.72 : 0.8);
      g.beginPath();
      g.moveTo(r + Math.sin(a) * r0, r - Math.cos(a) * r0);
      g.lineTo(r + Math.sin(a) * r * 0.9, r - Math.cos(a) * r * 0.9);
      g.stroke();
    }
    // compass rose
    g.fillStyle = '#e8b04a';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = r * (i % 2 ? 0.32 : 0.5);
      g.beginPath();
      g.moveTo(r + Math.sin(a) * len, r - Math.cos(a) * len);
      g.lineTo(r + Math.sin(a + 0.35) * r * 0.1, r - Math.cos(a + 0.35) * r * 0.1);
      g.lineTo(r + Math.sin(a - 0.35) * r * 0.1, r - Math.cos(a - 0.35) * r * 0.1);
      g.fill();
    }
    g.font = "bold 46px 'Jua', sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    [['N', 0, '#e8302a'], ['E', 1, '#6b3d1f'], ['S', 2, '#6b3d1f'], ['W', 3, '#6b3d1f']].forEach(([l, i, col]) => {
      const a = (i / 4) * Math.PI * 2;
      g.fillStyle = col;
      g.fillText(l, r + Math.sin(a) * r * 0.58, r - Math.cos(a) * r * 0.58 + 2);
    });
  });
  compassFace = new THREE.CanvasTexture(c);
  compassFace.colorSpace = THREE.SRGBColorSpace;
  compassFace.anisotropy = 4;
  return compassFace;
}

function compass() {
  const g = new THREE.Group();
  const brass = toon(0xd9a441, { spec: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.006, 32), brass);
  body.position.y = 0.003;
  inkOutline(body, 1.06);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0192, 0.0016, 8, 40), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0062;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.018, 40), toon(0xd8ccb4, { map: compassFaceTexture() }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0063;
  // hanging loop at the fingertip end, like a pocket compass
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0013, 8, 16), brass);
  loop.position.set(0, 0.003, -0.0245);

  // needle: red half points north, white half south, on a brass pivot
  const needle = new THREE.Group();
  needle.position.y = 0.0074;
  for (const [dir, color] of [[-1, 0xe8302a], [1, 0xffffff]]) {
    const half = new THREE.Mesh(new THREE.ConeGeometry(0.0032, 0.0145, 4), toon(color));
    half.rotation.x = (dir * Math.PI) / 2;
    half.scale.z = 0.35;
    half.position.z = dir * 0.0072;
    needle.add(half);
  }
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 12, 8), brass);
  pivot.position.y = 0.0076;
  g.add(body, rim, face, loop, needle, pivot);

  // a sprung, damped needle that swings round to world -Z (into the scene)
  const s = { a: 0, v: 0 };
  needle.userData.tick = (dt) => {
    needle.parent.getWorldQuaternion(tmpQ).invert();
    tmpV.set(0, 0, -1).applyQuaternion(tmpQ);
    if (Math.hypot(tmpV.x, tmpV.z) < 0.15) return; // face points along north: no reading
    let d = Math.atan2(-tmpV.x, -tmpV.z) - s.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.v += (d * 90 - s.v * 7) * dt;
    s.a += s.v * dt;
    needle.rotation.y = s.a;
  };
  return g;
}

// ---------- arch: set square + pencil ----------

function setSquare() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.05, 0); s.lineTo(0, 0.038); s.lineTo(0, 0);
  const hole = new THREE.Path();
  hole.moveTo(0.009, 0.007); hole.lineTo(0.028, 0.007); hole.lineTo(0.009, 0.021); hole.lineTo(0.009, 0.007);
  s.holes.push(hole);
  const m = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0006, bevelSegments: 1 }),
    toon(0xff8a3d, { transparent: true, opacity: 0.92 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

function pencil() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.052, 6), toon(0xffc21a));
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.01, 6), toon(0xf1d2a0));
  wood.position.y = 0.031;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0012, 0.0035, 6), toon(0x333333));
  lead.position.y = 0.0372;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.004, 12), toon(0xc0c4cc, { spec: 0.8 }));
  band.position.y = -0.028;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.006, 12), toon(0xff8fb0));
  eraser.position.y = -0.033;
  g.add(body, wood, lead, band, eraser);
  inkOutline(g, 1.12);
  return g;
}

function drafting() {
  const g = new THREE.Group();
  const sq = setSquare();
  sq.position.set(-0.022, 0.0006, 0.017);
  const p = pencil();
  p.rotation.z = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(p);
  holder.rotation.y = 0.75;
  holder.position.set(0.002, 0.0062, -0.002);
  g.add(sq, holder);
  return g;
}

// ---------- ta: monochrome screen ----------

const GREEN = '#3dff8a';
const CODE = [
  'uniform float uTime;',
  'varying vec3 vNormal;',
  'void main() {',
  '  vec3 n = normalize(vNormal);',
  '  float rim = 1.0 - n.z;',
  '  rim = pow(rim, 3.0);',
  '  col = mix(base, glow, rim);',
  '  gl_FragColor = vec4(col, 1);',
  '}',
  'mesh.material = toonMat;',
  'uv = fract(uv * 4.0);',
  'float d = length(p) - 0.5;',
  'tris += 1280; // LOD0',
  'bake(normal, ao, curve);',
  'export("hero_v12.glb");',
];
const WIRE_GEOS = {
  SphereGeometry: () => new THREE.SphereGeometry(0.5, 10, 7),
  TorusGeometry: () => new THREE.TorusGeometry(0.4, 0.16, 8, 16),
  TorusKnotGeometry: () => new THREE.TorusKnotGeometry(0.34, 0.11, 64, 4),
  IcosahedronGeometry: () => new THREE.IcosahedronGeometry(0.58, 0),
};
const SHAPES = Object.keys(WIRE_GEOS);
const LABEL = { SphereGeometry: 'sphere', TorusGeometry: 'torus', TorusKnotGeometry: 'torus_knot', IcosahedronGeometry: 'icosa' };

// One canvas shared by every TA screen (desktop and XR gloves), redrawn at
// ~15 fps so the texture upload stays cheap on the headset.
class TAScreen {
  constructor() {
    this.w = 256;
    this.h = 208;
    this.canvas = canvas(this.w, this.h, () => {});
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.t = 0;
    this.acc = 1;
    this.hit = null;
    this.hitT = 0;
    this.wires = {};
    this.m = new THREE.Matrix4();
    this.e = new THREE.Euler();
  }

  wire(type) {
    if (!this.wires[type]) {
      this.wires[type] = new THREE.WireframeGeometry((WIRE_GEOS[type] || WIRE_GEOS.SphereGeometry)()).attributes.position.array;
    }
    return this.wires[type];
  }

  showShape(type) {
    this.hit = WIRE_GEOS[type] ? type : SHAPES[0];
    this.hitT = 1.6;
    this.acc = 1;
  }

  update(dt) {
    this.t += dt;
    this.acc += dt;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.acc < 1 / 15) return;
    this.acc = 0;
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const { ctx, w, h, t } = this;
    const hit = this.hitT > 0;
    // the screen cuts between code and a spinning wireframe; the other one
    // stays faint underneath
    const phase = Math.floor(t / 2.2);
    const shapeUp = hit || phase % 2 === 1;
    ctx.fillStyle = '#03140a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = shapeUp ? 0.22 : 1;
    ctx.fillStyle = GREEN;
    ctx.font = "600 17px ui-monospace, Menlo, monospace";
    ctx.textBaseline = 'top';
    const lh = 22;
    const scroll = t * 20;
    const first = Math.floor(scroll / lh);
    for (let k = 0; k < 11; k++) {
      const line = CODE[(first + k) % CODE.length];
      const y = 10 + k * lh - (scroll % lh);
      ctx.fillText(line, 10, y);
      if (k === 8 && Math.floor(t * 3) % 2) ctx.fillRect(14 + ctx.measureText(line).width, y, 9, 17);
    }
    ctx.restore();

    const type = hit ? this.hit : SHAPES[Math.floor(phase / 2) % SHAPES.length];
    const pulse = hit ? 1 + 0.15 * Math.max(0, this.hitT - 1.3) / 0.3 : 1;
    this.drawWire(type, shapeUp ? 1 : 0.28, (hit ? 1.25 : 1) * pulse, hit ? t * 2.4 : t);

    if (shapeUp) {
      ctx.fillStyle = GREEN;
      ctx.font = "700 18px ui-monospace, Menlo, monospace";
      ctx.textBaseline = 'bottom';
      ctx.fillText(hit ? `HIT > ${LABEL[type]}` : `${LABEL[type]}.mesh`, 12, h - 10);
    }
    // scanlines and a frame that flashes on a hit
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
    ctx.strokeStyle = GREEN;
    ctx.globalAlpha = hit && Math.floor(this.hitT * 8) % 2 ? 1 : 0.45;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.globalAlpha = 1;
  }

  drawWire(type, alpha, scale, t) {
    const { ctx, w, h } = this;
    const a = this.wire(type);
    const me = this.m.makeRotationFromEuler(this.e.set(t * 0.9, t * 1.3, 0)).elements;
    const s = h * 0.62 * scale;
    const cx = w / 2;
    const cy = h / 2 - 6;
    const front = new Path2D();
    const back = new Path2D();
    for (let i = 0; i < a.length; i += 6) {
      const x0 = a[i], y0 = a[i + 1], z0 = a[i + 2];
      const x1 = a[i + 3], y1 = a[i + 4], z1 = a[i + 5];
      const za = me[2] * x0 + me[6] * y0 + me[10] * z0 + me[2] * x1 + me[6] * y1 + me[10] * z1;
      const path = za > 0 ? front : back;
      path.moveTo(cx + (me[0] * x0 + me[4] * y0 + me[8] * z0) * s, cy - (me[1] * x0 + me[5] * y0 + me[9] * z0) * s);
      path.lineTo(cx + (me[0] * x1 + me[4] * y1 + me[8] * z1) * s, cy - (me[1] * x1 + me[5] * y1 + me[9] * z1) * s);
    }
    ctx.strokeStyle = GREEN;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.35;
    ctx.stroke(back);
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;
    ctx.stroke(front);
    ctx.globalAlpha = 1;
  }
}

export const taScreen = new TAScreen();

function screen() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.042), toon(0x173040, { spec: 0.3 }));
  shell.position.y = 0.003;
  inkOutline(shell, 1.05);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.0465, 0.0004, 0.0385), basic(0x3dff8a));
  trim.position.y = 0.0062;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.0357), new THREE.MeshBasicMaterial({ map: taScreen.texture, toneMapped: false }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0069;
  // a status LED at the wrist edge
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 6), basic(0x3dff8a));
  led.position.set(0.019, 0.0062, 0.0195);
  led.add(halo(0x3dff8a, 0.012, 0.8));
  g.add(shell, trim, face, led);
  return g;
}

// ---------- fortune: floating constellation ----------

function starGeo(r1, r2) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function constellation() {
  const g = new THREE.Group();
  // a dipper: three handle stars and a four-star bowl, in bone XZ (-Z = fingertips)
  const pts = [[-0.03, 0.014], [-0.018, 0.006], [-0.006, 0.008], [0.005, 0.001], [0.008, -0.014], [0.026, -0.016], [0.024, 0.0]]
    .map(([x, z]) => new THREE.Vector3(x, 0, z));
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];
  const lineMat = basic(0xd9b8ff, { transparent: true, opacity: 0.85 });
  for (const [a, b] of links) {
    const d = pts[b].clone().sub(pts[a]);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, d.length(), 5), lineMat);
    bar.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    bar.position.copy(pts[a]).addScaledVector(d, 0.5);
    g.add(bar);
  }
  const big = starGeo(0.0058, 0.0025);
  const small = starGeo(0.0042, 0.0018);
  const stars = pts.map((p, i) => {
    const s = new THREE.Mesh(i === 3 || i === 0 ? big : small, basic(0xfff3b0));
    s.position.copy(p);
    const h = halo(i % 2 ? 0xc58bff : 0xf2c14e, 0.03, 0.8);
    s.add(h);
    g.add(s);
    return { s, h, seed: i * 1.7 };
  });
  // a faint gold orbit ring framing it, like a star chart
  const ringMat = basic(0xf2c14e, { transparent: true, opacity: 0.55 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0006, 6, 64), ringMat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  const holder = new THREE.Group();
  holder.add(g);
  holder.position.y = 0.016;
  holder.userData.tick = (dt, t) => {
    g.position.y = Math.sin(t * 1.8) * 0.0025;
    g.rotation.y = Math.sin(t * 0.5) * 0.25;
    for (const st of stars) {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + st.seed);
      st.h.material.opacity = 0.35 + 0.6 * k;
      st.s.scale.setScalar(0.85 + 0.3 * k);
    }
  };
  return holder;
}

// ---------- grad: mortarboard ----------

function mortarboard() {
  const g = new THREE.Group();
  const cloth = toon(0x2b2840, { spec: 0.3 });
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0165, 0.011, 24), cloth);
  skull.position.y = 0.0055;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.003, 0.046), cloth);
  board.position.y = 0.0125;
  board.rotation.y = Math.PI / 4;
  inkOutline(skull, 1.08);
  inkOutline(board, 1.05);
  const gold = toon(0xf2c14e, { spec: 0.8 });
  const top = 0.0141;
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 12, 8), gold);
  button.position.y = top + 0.001;
  // cord across the board to its +X corner, then the tassel hangs from there
  const corner = 0.023 * Math.SQRT2;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, corner, 6), gold);
  cord.rotation.z = Math.PI / 2;
  cord.position.set(corner / 2, top + 0.0007, 0);
  const hang = new THREE.Group();
  hang.position.set(corner, top, 0);
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.012, 6), gold);
  drop.position.y = -0.006;
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0034, 0.011, 10), gold);
  tassel.position.y = -0.0165;
  hang.add(drop, tassel);
  g.add(skull, board, button, cord, hang);

  // the tassel swings toward world down with a little lag; with the back of
  // the hand facing up it drapes off the corner instead of into the glove
  const want = new THREE.Quaternion();
  const down = new THREE.Vector3();
  const rest = new THREE.Vector3(0, -1, 0);
  hang.userData.tick = (dt) => {
    hang.parent.getWorldQuaternion(tmpQ).invert();
    down.set(0, -1, 0).applyQuaternion(tmpQ);
    if (down.y < -0.3) {
      down.y = -0.3;
      down.x += 0.6;
    }
    want.setFromUnitVectors(rest, down.normalize());
    hang.quaternion.slerp(want, Math.min(1, dt * 8));
  };
  return g;
}
