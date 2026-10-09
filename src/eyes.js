import * as THREE from 'three';

// Cappy's eyes on the back of the left glove, with expressions.
// Bone space: the face looks out along +Y; "up" on the face is -Z (toward the
// fingertips). Each eye is a white dome with a big pupil and two highlights;
// alternate shapes (^ arcs, > < chevrons) swap in for expressions. All unlit so
// the face reads the same under every role's lighting.
//
//   idle   open, blinking, pupils drifting
//   focus  slightly lowered lids, brows angled in
//   happy  ^ ^ closed arcs and blush
//   squint > < chevrons
//   wow    wide eyes, small pupils, raised brows
//   dizzy  pupils circling (the roulette is spinning)

const INK = 0x1a1030;
const ink = () => new THREE.MeshBasicMaterial({ color: INK });
const EYE_R = 0.0125;
const TOP = EYE_R * 0.52 + 0.0004; // dome top in Y, where pupils sit

function disc(r, color, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  return m;
}

function makeEye(side) {
  const eye = new THREE.Group();
  eye.position.set(side * 0.0138, 0, 0);

  const open = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  white.scale.set(0.82, 0.52, 1.12);
  const hull = new THREE.Mesh(white.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.scale.set(0.82 * 1.16, 0.52 * 1.16, 1.12 * 1.13);
  const pupil = new THREE.Group();
  pupil.position.y = TOP;
  const iris = disc(0.0066, INK, 0.9, 1.2);
  const hi1 = disc(0.0022, 0xffffff);
  hi1.position.set(-0.0022 * side, 0.0002, -0.003);
  const hi2 = disc(0.001, 0xffffff);
  hi2.position.set(0.002 * side, 0.0002, 0.0024);
  pupil.add(iris, hi1, hi2);
  open.add(white, hull, pupil);
  eye.add(open);

  // ^ closed happy arc (convex toward the fingertips)
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.0072, 0.0016, 6, 18, Math.PI), ink());
  arc.rotation.x = -Math.PI / 2;
  arc.position.set(0, 0.002, 0.002);
  arc.visible = false;
  eye.add(arc);

  // > < chevron, tip toward the nose
  const chevron = new THREE.Group();
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.0016, 0.0026), ink());
    bar.position.set(0, 0, s * 0.0022);
    bar.rotation.y = -s * 0.55 * side;
    chevron.add(bar);
  }
  chevron.position.set(-side * 0.0012, 0.003, 0);
  chevron.visible = false;
  eye.add(chevron);

  const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0012, 0.009, 2, 6), ink());
  brow.rotation.z = Math.PI / 2;
  brow.position.set(0, 0.004, -0.0175);
  eye.add(brow);

  const blush = disc(0.0045, 0xff7aa8, 1.4, 0.8);
  blush.material.transparent = true;
  blush.material.opacity = 0.85;
  blush.position.set(side * 0.006, 0.0032, 0.0135);
  blush.visible = false;
  eye.add(blush);

  eye.userData = { side, open, pupil, arc, chevron, brow, blush };
  return eye;
}

export function makeCappyEyes() {
  const g = new THREE.Group();
  const eyes = [makeEye(-1), makeEye(1)];
  g.add(...eyes);
  g.userData = {
    eyes, expr: 'idle', base: 'idle', hold: 0, pop: 0, last: 0, look: new THREE.Vector2(), lookTo: new THREE.Vector2(), lookT: 0,
  };
  return g;
}

// Show `name` for `hold` seconds, then fall back to the base expression.
// hold = Infinity (or setBaseExpression) makes it stick.
export function setExpression(g, name, hold = 0.6) {
  const u = g.userData;
  if (u.expr !== name) u.pop = 1;
  u.expr = name;
  u.hold = hold;
}

export function setBaseExpression(g, name) {
  const u = g.userData;
  u.base = name;
  if (u.hold <= 0) setExpression(g, name, 0);
}

export function updateEyes(g, t) {
  const u = g.userData;
  const dt = Math.min(0.1, Math.max(0, t - u.last));
  u.last = t;
  if (u.hold > 0) {
    u.hold -= dt;
    if (u.hold <= 0 && u.expr !== u.base) {
      u.expr = u.base;
      u.pop = 1;
    }
  }
  u.pop = Math.max(0, u.pop - dt * 6);
  const e = u.expr;

  // pupils: drift around while idle, circle while dizzy, small when surprised
  u.lookT -= dt;
  if (u.lookT <= 0) {
    u.lookT = 0.8 + Math.random() * 1.6;
    u.lookTo.set((Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
  }
  if (e === 'dizzy') u.look.set(Math.cos(t * 14) * 0.0028, Math.sin(t * 14) * 0.0028);
  else u.look.lerp(u.lookTo, Math.min(1, dt * 10));

  // blink every ~3s while the eyes are open
  const phase = (t + 0.7) % 3.1;
  const blink = (e === 'idle' || e === 'focus') && phase < 0.13 ? 0.12 + 0.88 * Math.abs(Math.cos((phase / 0.13) * Math.PI)) : 1;
  const lid = e === 'focus' ? 0.78 : e === 'wow' ? 1.18 : 1;
  const pop = 1 + u.pop * u.pop * 0.35;

  for (const eye of u.eyes) {
    const d = eye.userData;
    const side = d.side;
    const isOpen = e !== 'happy' && e !== 'squint';
    d.open.visible = isOpen;
    d.arc.visible = e === 'happy';
    d.chevron.visible = e === 'squint';
    d.blush.visible = e === 'happy' || e === 'squint';
    d.open.scale.set(e === 'wow' ? 1.12 : 1, 1, lid * blink);
    d.pupil.scale.setScalar(e === 'wow' ? 0.72 : e === 'focus' ? 0.92 : 1);
    d.pupil.position.set(u.look.x, TOP, u.look.y);
    // brows: up when happy or surprised, angled in when focused or squinting
    const browUp = e === 'wow' ? -0.0035 : e === 'happy' ? -0.0015 : 0;
    d.brow.position.z = -0.0175 + browUp;
    d.brow.rotation.y = (e === 'focus' || e === 'squint' ? 0.35 : e === 'wow' ? -0.15 : 0) * side;
    eye.scale.set(pop, 1, pop);
  }
}
