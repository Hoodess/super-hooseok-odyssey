import * as THREE from 'three';

// Every image the game uses is loaded from the repo's assets/ folder (served as
// the site root), in the subfolder its filename prefix names. Until the generated
// image exists, a canvas placeholder stands in, so the game always runs.

const loader = new THREE.TextureLoader();
const cache = new Map();

const FOLDERS = [['bg_', 'bg'], ['glove_', 'glove'], ['tarot_', 'tarot'], ['photo_', 'photos']];
export function assetUrl(file) {
  const hit = FOLDERS.find(([prefix]) => file.startsWith(prefix));
  return `${import.meta.env.BASE_URL}${hit ? hit[1] : 'images'}/${file}`;
}

export function assetTexture(file, makePlaceholder) {
  if (cache.has(file)) return cache.get(file);
  const tex = new THREE.CanvasTexture(makePlaceholder());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  loader.load(
    assetUrl(file),
    (loaded) => {
      // If the placeholder was already drawn, WebGL2 holds immutable storage at its
      // size; dispose so the real image (a different size) gets fresh storage.
      tex.dispose();
      tex.image = loaded.image;
      tex.needsUpdate = true;
      tex.userData.loaded = true;
    },
    undefined,
    () => {},
  );
  cache.set(file, tex);
  return tex;
}

export function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------- backgrounds ----------

export function bgPlaceholder(role, variant = 0) {
  return () =>
    canvas(1536, 1024, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, hex(role.skyTop));
      grad.addColorStop(0.55, hex(role.color));
      grad.addColorStop(1, hex(role.skyBottom));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      const r = rand(7 + variant * 31 + role.color % 97);
      g.globalAlpha = 0.9;
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.8})`;
        g.beginPath();
        g.arc(r() * w, r() * h * 0.5, r() * 2.2, 0, Math.PI * 2);
        g.fill();
      }
      // silhouette skyline / hills so the horizon reads
      g.fillStyle = hex(role.skyBottom);
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 24) {
        const y = h * 0.62 - (Math.sin(x * 0.004 + variant) * 0.5 + 0.5) * 120 - r() * 90;
        g.lineTo(x, role.id === 'arch' || role.id === 'grad' ? Math.round(y / 40) * 40 : y);
      }
      g.lineTo(w, h);
      g.fill();
      if (role.id === 'arch' || role.id === 'ta') {
        g.strokeStyle = role.id === 'arch' ? 'rgba(200,225,255,0.35)' : 'rgba(120,255,170,0.3)';
        g.lineWidth = 1;
        for (let x = 0; x < w; x += 48) {
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
        }
        for (let y = 0; y < h; y += 48) {
          g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        }
      }
    });
}

// ---------- gloves ----------

export function glovePlaceholder(role) {
  return () =>
    canvas(512, 512, (g, w, h) => {
      const r = rand(role.color % 1000 + 3);
      g.fillStyle = hex(role.color);
      g.fillRect(0, 0, w, h);
      switch (role.id) {
        case 'grad':
          g.fillStyle = '#b81f1a';
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < 6; i++) {
            g.strokeStyle = 'rgba(90,50,20,0.6)';
            g.lineWidth = 6;
            g.beginPath();
            g.arc(r() * w, r() * h, 20 + r() * 30, 0, Math.PI * 1.7);
            g.stroke();
          }
          for (let i = 0; i < 8; i++) {
            g.fillStyle = ['#ffe45c', '#ff9de0', '#8ef0ff'][i % 3];
            g.save();
            g.translate(r() * w, r() * h);
            g.rotate((r() - 0.5) * 0.6);
            g.fillRect(-22, -22, 44, 44);
            g.restore();
          }
          break;
        case 'arch':
          g.fillStyle = '#f4f8ff';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#2f7dff';
          for (let x = 0; x <= w; x += 32) {
            g.lineWidth = x % 128 === 0 ? 3 : 1;
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
            g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke();
          }
          break;
        case 'ta':
          g.fillStyle = '#071a14';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#2bff8a';
          g.lineWidth = 3;
          for (let i = 0; i < 14; i++) {
            const x = r() * w, y = r() * h;
            g.beginPath();
            g.moveTo(x, y);
            g.bezierCurveTo(x + 80, y, x + 40, y + 120 * (r() - 0.5), x + 160, y + 80 * (r() - 0.5));
            g.stroke();
            g.fillStyle = '#9dffcb';
            g.fillRect(x - 6, y - 6, 12, 12);
          }
          break;
        case 'fortune':
          g.fillStyle = '#4a137e';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffd36b';
          for (let i = 0; i < 24; i++) star(g, r() * w, r() * h, 6 + r() * 10);
          break;
        case 'travel':
          g.fillStyle = '#b07a43';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#ffd23a';
          g.setLineDash([10, 8]);
          g.lineWidth = 4;
          for (let y = 40; y < h; y += 90) {
            g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
          }
          break;
      }
    });
}

function star(g, x, y, s) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? s : s * 0.45;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

// ---------- targets ----------

export function paperPlaceholder() {
  return canvas(512, 680, (g, w, h) => {
    g.fillStyle = '#fbf8ef';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#222';
    g.font = 'bold 34px sans-serif';
    g.fillText('THESIS_final_v27.pdf', 40, 70);
    g.fillStyle = '#9a9a9a';
    for (let y = 120; y < h - 40; y += 26) g.fillRect(40, y, w - 80 - ((y * 7) % 120), 10);
    g.strokeStyle = '#e8302a';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(60, 300); g.lineTo(380, 340); g.stroke();
    g.beginPath(); g.arc(380, 480, 50, 0, Math.PI * 2); g.stroke();
  });
}

export function stampPlaceholder() {
  return canvas(512, 256, (g, w, h) => {
    g.strokeStyle = '#e8302a';
    g.fillStyle = '#e8302a';
    g.lineWidth = 14;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ACCEPTED', w / 2, h / 2 + 4);
  });
}

export function tarotBackPlaceholder() {
  return canvas(512, 768, (g, w, h) => {
    g.fillStyle = '#3a0f6b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 10;
    g.strokeRect(20, 20, w - 40, h - 40);
    g.fillStyle = '#ffd36b';
    star(g, w / 2, h / 2, 110);
    const r = rand(42);
    for (let i = 0; i < 30; i++) star(g, 50 + r() * (w - 100), 50 + r() * (h - 100), 4 + r() * 6);
  });
}

export function tarotFrontPlaceholder(i) {
  const titles = ['THE STUDENT', 'THE BUILDER', 'THE MAGICIAN', 'THE STAR', 'THE WORLD'];
  return () =>
    canvas(512, 768, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#6f2bd6');
      grad.addColorStop(1, '#1a0640');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffd36b';
      g.lineWidth = 10;
      g.strokeRect(20, 20, w - 40, h - 40);
      g.fillStyle = '#ffd36b';
      star(g, w / 2, h * 0.42, 130);
      g.font = 'bold 44px serif';
      g.textAlign = 'center';
      g.fillText(titles[i % titles.length], w / 2, h - 70);
    });
}

export function photoPlaceholder(i) {
  const cols = ['#ffb347', '#4fc3f7', '#81c784', '#f06292', '#ffd54f'];
  return () =>
    canvas(512, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, cols[i % cols.length]);
      grad.addColorStop(1, '#2b1a08');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(w * 0.7, h * 0.3, 50, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1206';
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(w * 0.3, h * 0.55);
      g.lineTo(w * 0.55, h * 0.75);
      g.lineTo(w * 0.8, h * 0.5);
      g.lineTo(w, h * 0.7);
      g.lineTo(w, h);
      g.fill();
    });
}

// ---------- text + glow ----------

// Text is drawn in the bundled Jua font (rounded, chunky, reads like game UI).
// `inner` adds a second, inner outline: dark outer stroke, light inner stroke, fill.
export const FONT = "'Jua', sans-serif";
export function textCanvas(text, { size = 120, color = '#fff', stroke = '#000', inner = null, font = FONT, pad = 30 } = {}) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${size}px ${font}`;
  const tw = Math.ceil(probe.measureText(text).width);
  const outer = inner ? size * 0.34 : size * 0.18;
  pad = Math.max(pad, outer);
  return canvas(tw + pad * 2, size * 1.4 + pad, (g, w, h) => {
    g.font = `${size}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = outer;
    g.strokeStyle = stroke;
    g.strokeText(text, w / 2, h / 2);
    if (inner) {
      g.lineWidth = size * 0.16;
      g.strokeStyle = inner;
      g.strokeText(text, w / 2, h / 2);
    }
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
}

export function makeTextSprite(text, opts = {}) {
  const c = textCanvas(text, opts);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false });
  const s = new THREE.Sprite(mat);
  const height = opts.height ?? 0.12;
  s.scale.set((height * c.width) / c.height, height, 1);
  s.renderOrder = 20;
  return s;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = new THREE.CanvasTexture(
    canvas(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }),
  );
  return glowTex;
}
