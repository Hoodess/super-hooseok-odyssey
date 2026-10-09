import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { ROLES, HUB } from './roles.js';
import { World } from './world.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { GloveSkin, makeCappyEyes, updateEyes, makeHandButton, BACK_OF_HAND } from './glove.js';
import { Roulette } from './roulette.js';
import { Targets } from './targets.js';
import { makeMoon, MoonHUD } from './moon.js';
import { assetTexture, canvas } from './textures.js';

const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');
// ?test lets a slow headless browser advance game time in big steps
const DT_MAX = params.has('test') ? 0.4 : 1 / 20;

// ---------- renderer / scene ----------

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(0.5);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 300);
camera.position.set(0, 1.6, 0);
scene.add(camera);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- systems ----------

const world = new World(scene);
const fx = new FX(scene, camera);
const audio = new Audio();
const skin = new GloveSkin();
const roulette = new Roulette(ROLES);
scene.add(roulette.group);
const targets = new Targets(scene, world, fx, audio);
const hud = new MoonHUD(scene, ROLES);

let headY = 1.6;
hud.place(headY);

// ---------- gloves: XR hands ----------

// Tags each loaded hand mesh with its side so a load that finishes after the slot
// switched hands can be thrown away.
const handGltf = new GLTFLoader().setPath(`${BASE}models/hands/`);
const handLoader = {
  load(url, onLoad) {
    handGltf.load(url, (gltf) => {
      gltf.scene.children[0].userData.handedness = url.startsWith('left') ? 'left' : 'right';
      onLoad(gltf);
    });
  },
};
const handFactory = new XRHandModelFactory(handLoader, (object) => {
  const handModel = object.parent;
  if (object.userData.handedness !== handModel.userData.meshHandedness) {
    handModel.remove(object);
    return;
  }
  skin.apply(object, object.userData.handedness);
  if (object.userData.handedness === 'left') xrButton = attachEyes(object);
});
// WebXR puts a reconnecting hand in whichever slot is free, so slot 0 can be the
// left hand now and the right hand after tracking drops. three's factory builds a
// slot's mesh only on its first connect, so rebuild it whenever the side changes.
// This listener is added before the factory's so the slot is cleared first.
const hands = [0, 1].map((i) => {
  const hand = renderer.xr.getHand(i);
  let handModel = null;
  hand.addEventListener('connected', (e) => {
    const side = e.data.handedness;
    hand.userData.handedness = side;
    if (handModel?.motionController && handModel.userData.meshHandedness !== side) {
      detachEyes(handModel);
      handModel.clear();
      handModel.motionController = null;
    }
    if (handModel) handModel.userData.meshHandedness = side;
  });
  hand.addEventListener('disconnected', () => delete hand.userData.handedness);
  handModel = handFactory.createHandModel(hand, 'mesh');
  hand.add(handModel);
  scene.add(hand);
  return hand;
});

const allEyes = [];
const allButtons = [];
let xrButton = null;

// Cappy eyes and the roulette button ride on the left glove's middle metacarpal bone.
function attachEyes(handObject) {
  const bone = handObject.getObjectByName('middle-finger-metacarpal');
  if (!bone) return null;
  const eyes = makeCappyEyes();
  eyes.position.copy(BACK_OF_HAND).multiplyScalar(0.02);
  eyes.position.z -= 0.035; // -Z runs toward the fingers: center of the back of the hand
  bone.add(eyes);
  const button = makeHandButton();
  button.position.copy(BACK_OF_HAND).multiplyScalar(0.018);
  button.position.z += 0.002;
  bone.add(button);
  allEyes.push(eyes);
  allButtons.push(button);
  return button;
}

function detachEyes(handModel) {
  const inside = (o) => { for (let p = o.parent; p; p = p.parent) if (p === handModel) return true; return false; };
  for (const list of [allEyes, allButtons]) {
    for (let i = list.length - 1; i >= 0; i--) if (inside(list[i])) list.splice(i, 1);
  }
  if (xrButton && inside(xrButton)) xrButton = null;
}

function handByName(name) {
  return hands.find((h) => h.userData.handedness === name);
}

function jointPos(hand, name, out) {
  const j = hand?.joints?.[name];
  if (!j || !j.visible) return null;
  return j.getWorldPosition(out);
}

// ---------- gloves: desktop (director mode) ----------

const desk = new THREE.Group();
camera.add(desk);
const deskHands = {};
const gltf = new GLTFLoader();
for (const side of ['left', 'right']) {
  gltf.load(`${BASE}models/hands/${side}.glb`, (g) => {
    const obj = g.scene;
    skin.apply(obj, side);
    orientDeskHand(obj, side);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.set(side === 'left' ? -0.15 : 0.15, -0.2, -0.38);
    holder.userData.home = holder.position.clone();
    desk.add(holder);
    deskHands[side] = holder;
    if (side === 'left') attachEyes(obj);
  });
}

// Rotate the hand model so the back of the hand faces the camera with fingers up and forward.
function orientDeskHand(obj, side) {
  obj.updateMatrixWorld(true);
  const p = (n) => obj.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const mid = p('middle-finger-metacarpal');
  const f = p('middle-finger-phalanx-proximal').sub(mid).normalize();
  const s = p('index-finger-metacarpal').sub(mid).normalize();
  const back = new THREE.Vector3().crossVectors(s, f).normalize();
  if (side === 'right') back.negate();
  const cur = basis(f, back);
  const wantF = new THREE.Vector3(side === 'left' ? 0.25 : -0.25, 0.75, -0.6).normalize();
  const wantBack = new THREE.Vector3(side === 'left' ? 0.3 : -0.3, 0.35, 1).normalize();
  const want = basis(wantF, wantBack);
  const q = new THREE.Quaternion().setFromRotationMatrix(want.multiply(cur.transpose()));
  obj.quaternion.premultiply(q);
  obj.updateMatrixWorld(true);
  const c = p('middle-finger-metacarpal');
  obj.position.sub(c);
}

function basis(f, back) {
  const y = back.clone();
  const z = f.clone().negate();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const y2 = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y2, z);
}

function punch(side) {
  const h = deskHands[side];
  if (h) h.userData.punch = 0.0001;
}

function updateDeskHands(dt, t) {
  for (const [side, h] of Object.entries(deskHands)) {
    const home = h.userData.home;
    h.position.copy(home);
    h.position.y += Math.sin(t * 1.6 + (side === 'left' ? 0 : 1.3)) * 0.008;
    if (h.userData.punch > 0) {
      h.userData.punch += dt;
      const k = h.userData.punch / 0.28;
      const out = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.3) / 0.7);
      h.position.z -= out * 0.22;
      h.position.x += (side === 'left' ? 1 : -1) * out * 0.08;
      if (k >= 1) h.userData.punch = 0;
    }
  }
}

// ---------- title / logo ----------

let titleSprites = [];
function showTitle(role) {
  clearTitle();
  const pos = new THREE.Vector3(0, headY + 0.32, -1.6);
  titleSprites = [
    fx.text(role.name, pos, hexStr(role.color), { height: 0.2, life: 2.2 }),
    fx.text(role.en, pos.clone().add(new THREE.Vector3(0, -0.17, 0)), '#ffffff', { height: 0.07, life: 2.2 }),
  ];
}
function clearTitle() {
  for (const s of titleSprites) s.visible = false;
  titleSprites = [];
}

const logoTex = assetTexture('logo_alpha.png', () => canvas(4, 3, () => {}));
const logo = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 0.9),
  new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false, toneMapped: false }),
);
logo.visible = false;
scene.add(logo);

// ---------- state machine ----------

let state = 'hub';
let next = 0;
let collected = new Set();
const timers = [];
const later = (sec, fn) => timers.push({ t: sec, fn });
const anims = [];

function placeRoulette() {
  const left = handByName('left');
  const p = renderer.xr.isPresenting ? jointPos(left, 'middle-finger-metacarpal', new THREE.Vector3()) : null;
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  if (p) {
    roulette.group.position.copy(p).add(new THREE.Vector3(0, 0.2, 0));
  } else {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    roulette.group.position.copy(camPos).addScaledVector(fwd, 0.62).add(new THREE.Vector3(-0.05, 0.02, 0));
  }
  roulette.group.lookAt(camPos);
}

function pressButton() {
  if (state === 'end') return resetAll();
  if (state !== 'hub' && state !== 'idle') return;
  audio.play('press');
  allButtons.forEach((b) => (b.userData.pressT = 0.3));
  skin.pulse();
  if (next >= ROLES.length) return startFinale();
  state = 'spin';
  const i = next;
  roulette.show();
  placeRoulette();
  audio.play('roulette');
  roulette.spinTo(i, {
    onTick: () => audio.play('tick'),
    onDone: () => {
      audio.play('ding');
      roulette.setHubLabel(ROLES[i].name, hexStr(ROLES[i].color));
      fx.burst(roulette.group.position, ROLES[i].color, { count: 50, speed: 1.2, size: 0.03 });
      later(0.7, () => transformTo(i));
    },
  });
}

function transformTo(i) {
  roulette.hide();
  clearTitle();
  const role = ROLES[i];
  next = i;
  state = 'transform';
  fx.flash(0xffffff, 0.8);
  audio.play('transform');
  const gp = gloveAnchor();
  fx.burst(gp, role.color, { count: 140, speed: 2.2, size: 0.05 });
  fx.ring(gp, role.color, camera.getWorldPosition(new THREE.Vector3()), { radius: 0.5 });
  targets.reset();
  world.clearProps();
  world.setRole(role, 0);
  skin.setRole(role);
  later(0.35, () => showTitle(role));
  later(1.6, () => {
    state = 'play';
    targets.start(role, headY, () => later(0.4, () => moonSequence(i)));
  });
}

function gloveAnchor() {
  const left = handByName('left');
  const p = renderer.xr.isPresenting ? jointPos(left, 'middle-finger-metacarpal', new THREE.Vector3()) : null;
  if (p) return p;
  return deskHands.left ? deskHands.left.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, headY - 0.2, -0.4);
}

function moonSequence(i) {
  state = 'moon';
  const role = ROLES[i];
  const moon = makeMoon(role.color);
  const from = new THREE.Vector3(0, headY - 0.7, -1.0);
  const show = new THREE.Vector3(0, headY - 0.05, -0.85);
  moon.position.copy(from);
  scene.add(moon);
  audio.play('moon');
  fx.text('POWER MOON!', show.clone().add(new THREE.Vector3(0, 0.2, 0)), hexStr(role.color), { height: 0.1, life: 1.8 });
  anims.push({
    t: 0,
    dur: 2.4,
    step(k, t) {
      moon.rotation.y = t * 8;
      if (t < 0.6) moon.position.lerpVectors(from, show, 1 - Math.pow(1 - t / 0.6, 3));
      else if (t < 1.6) moon.position.y = show.y + Math.sin((t - 0.6) * 4) * 0.02;
      else {
        const kk = (t - 1.6) / 0.8;
        moon.position.lerpVectors(show, hud.slotWorldPos(i), kk * kk);
        moon.scale.setScalar(1 - kk * 0.55);
      }
      if (t > 0.6 && !this.burst) {
        this.burst = true;
        fx.burst(show, role.color, { count: 120, speed: 2.5 });
        fx.burst(show, 0xffffff, { count: 40, speed: 1.5, size: 0.04 });
        fx.ring(show, role.color, camera.getWorldPosition(new THREE.Vector3()), { radius: 0.8, life: 0.7 });
      }
    },
    done() {
      scene.remove(moon);
      hud.fill(i);
      collected.add(i);
      fx.glow(hud.slotWorldPos(i), role.color, 0.4, 0.5);
      next = i + 1;
      state = 'idle';
    },
  });
}

function startFinale() {
  state = 'finale';
  roulette.show();
  placeRoulette();
  audio.play('roulette');
  roulette.spinTo(0, {
    turns: 9,
    duration: 3.4,
    finale: true,
    onTick: () => audio.play('tick'),
    onDone: () => {
      audio.play('ding');
      roulette.setHubLabel('HOOSEOK', '#ffffff');
      later(0.7, worldMontage);
    },
  });
}

function worldMontage() {
  roulette.hide();
  targets.reset();
  world.clearProps();
  const seq = [...ROLES, ...ROLES];
  seq.forEach((role, k) => {
    later(k * 0.32, () => {
      world.setRole(role, k);
      skin.setRole(role);
      fx.flash(role.color, 0.25);
      fx.burst(gloveAnchor(), role.color, { count: 60, speed: 2 });
      audio.play('tick');
    });
  });
  later(seq.length * 0.32 + 0.1, finaleEnd);
}

function finaleEnd() {
  world.setRole(HUB, 0);
  skin.setRole(HUB);
  fx.flash(0xffffff, 1.0);
  audio.play('transform');
  const orbit = ROLES.map((r) => {
    const m = makeMoon(r.color);
    scene.add(m);
    return m;
  });
  anims.push({
    t: 0,
    dur: 1e9,
    step(k, t) {
      orbit.forEach((m, i) => {
        const a = t * 0.8 + (i / 5) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.9, headY + 0.15 + Math.sin(t * 2 + i) * 0.05, Math.sin(a) * 0.9 - 0.2);
        m.rotation.y = t * 3;
      });
    },
    done() {},
    orbit,
  });
  logo.position.set(0, headY + 0.25, -1.7);
  logo.scale.setScalar(0.01);
  logo.visible = true;
  later(0.5, () => {
    audio.play('moon');
    fx.burst(logo.position, 0xffd36b, { count: 200, speed: 3, size: 0.06 });
  });
  anims.push({
    t: 0,
    dur: 0.9,
    step(k) {
      const x = k - 1;
      logo.scale.setScalar(Math.max(0.01, 1 + 2.7 * x * x * x + 1.7 * x * x));
    },
    done() {
      state = 'end';
    },
  });
}

function resetAll() {
  anims.forEach((a) => a.orbit?.forEach((m) => scene.remove(m)));
  anims.length = 0;
  timers.length = 0;
  logo.visible = false;
  targets.reset();
  world.clearProps();
  hud.reset();
  collected = new Set();
  next = 0;
  roulette.hide();
  enterHub();
}

function enterHub() {
  state = 'hub';
  world.setRole(HUB, 0);
  skin.setRole(HUB);
}

// ---------- input ----------

const autoHitDefault = !params.has('noauto');
let autoHit = autoHitDefault;
let cinematic = false;
let buttonArmed = true;

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); pressButton(); }
  else if (k >= '1' && k <= '5') { anims.length = 0; timers.length = 0; logo.visible = false; transformTo(+k - 1); }
  else if (k === '0') resetAll();
  else if (k === 'f') { anims.length = 0; timers.length = 0; next = ROLES.length; state = 'idle'; startFinale(); }
  else if (k === 'a') autoHit = !autoHit;
  else if (k === 'c') { cinematic = !cinematic; desk.visible = !cinematic; }
  else if (k === 'h') { hud.group.visible = !hud.group.visible; helpEl.style.display = hud.group.visible ? '' : 'none'; }
  else if (k === 'g') desk.visible = !desk.visible;
});
window.addEventListener('pointerdown', () => audio.unlock());

renderer.xr.addEventListener('sessionstart', () => {
  audio.unlock();
  desk.visible = false;
  later(0.6, () => {
    const p = camera.getWorldPosition(new THREE.Vector3());
    if (p.y > 0.8) headY = p.y;
    hud.place(headY);
  });
});
renderer.xr.addEventListener('sessionend', () => {
  desk.visible = true;
  headY = 1.6;
  hud.place(headY);
});

// ---------- loop ----------

const helpEl = document.getElementById('help');
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking', 'local-floor'] }));

const clock = new THREE.Clock();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
let hitstop = 0;

targets.onHit = (t) => {
  hitstop = 0.06;
  skin.pulse();
  if (!renderer.xr.isPresenting) punch(t.obj.position.x < 0 ? 'left' : 'right');
};

renderer.setAnimationLoop(() => {
  let dt = Math.min(clock.getDelta(), DT_MAX);
  const t = clock.elapsedTime;
  if (hitstop > 0) {
    hitstop -= dt;
    dt *= 0.08;
  }
  const xr = renderer.xr.isPresenting;

  // desktop camera
  if (!xr) {
    if (cinematic) {
      camera.position.set(Math.sin(t * 0.15) * 1.2, 1.5 + Math.sin(t * 0.21) * 0.15, 0.8 + Math.cos(t * 0.15) * 0.3);
      camera.lookAt(0, 1.45, -2.5);
    } else {
      camera.position.set(0, 1.6, 0);
      camera.rotation.set(Math.sin(t * 0.3) * 0.015 - 0.04, Math.sin(t * 0.21) * 0.02, 0);
    }
    updateDeskHands(dt, t);
  }

  // timers + scripted animations
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) {
      const fn = timers[i].fn;
      timers.splice(i, 1);
      fn();
    }
  }
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += dt;
    a.step(Math.min(1, a.t / a.dur), a.t);
    if (a.t >= a.dur) {
      anims.splice(i, 1);
      a.done();
    }
  }

  // XR: hand-back button + hit points
  const hitPoints = [];
  if (xr) {
    const left = handByName('left');
    const right = handByName('right');
    const btn = xrButton ? xrButton.getWorldPosition(tmpA) : null;
    const tip = jointPos(right, 'index-finger-tip', tmpB);
    if (btn && tip) {
      const d = btn.distanceTo(tip);
      if (d < 0.028 && buttonArmed) {
        buttonArmed = false;
        pressButton();
      } else if (d > 0.06) buttonArmed = true;
    }
    for (const h of [left, right]) {
      const p = jointPos(h, 'middle-finger-metacarpal', new THREE.Vector3());
      if (p) hitPoints.push(p);
      const f = jointPos(h, 'middle-finger-tip', new THREE.Vector3());
      if (f) hitPoints.push(f);
    }
    if (state === 'spin' || state === 'finale') placeRoulette();
  }

  // button glow pulse
  const ready = state === 'hub' || state === 'idle' || state === 'end';
  for (const b of allButtons) {
    const bp = b.userData.pressT > 0 ? (b.userData.pressT -= dt) : 0;
    b.userData.glow.material.opacity = ready ? 0.6 + Math.sin(t * 6) * 0.35 : 0.15;
    b.scale.setScalar(1 + Math.max(0, bp) * 1.5);
  }
  for (const e of allEyes) updateEyes(e, t);
  skin.update(dt);
  world.update(t, dt);
  roulette.update(dt, t);
  targets.update(dt, hitPoints, !xr && autoHit, camera.getWorldPosition(tmpA));
  hud.update(dt, t);
  fx.update(dt);

  if (xr) renderer.render(scene, camera);
  else composer.render();
});

enterHub();
