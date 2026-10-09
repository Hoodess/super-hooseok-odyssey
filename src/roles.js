import { ROLE_TEXT } from './texts.js';

// Role definitions. Order here is the order the roulette lands on and the
// director-mode keys 1-5. Colors follow the letters of the logo; on-screen
// text lives in texts.js.

const role = (id, rest) => ({
  id,
  name: ROLE_TEXT[id].name,
  en: ROLE_TEXT[id].en,
  wheel: ROLE_TEXT[id].wheel,
  hitTexts: ROLE_TEXT[id].hits,
  ...rest,
});

export const ROLES = [
  role('travel', {
    color: 0xffc21a,
    glove: 0xf2b21a,
    skyTop: 0x5a3a08,
    skyBottom: 0x140a01,
    bg: ['bg_travel2.png'],
    target: 'polaroid',
  }),
  role('arch', {
    color: 0x1f7bff,
    glove: 0x2f86ff,
    skyTop: 0x0b2a6e,
    skyBottom: 0x020a1c,
    bg: ['bg_arch.png'],
    target: 'block',
  }),
  role('fortune', {
    color: 0x9b3cff,
    glove: 0x8a35e8,
    skyTop: 0x2a0b55,
    skyBottom: 0x07021a,
    bg: ['bg_fortune.png'],
    target: 'card',
  }),
  role('ta', {
    color: 0x22d36b,
    glove: 0x1fc463,
    skyTop: 0x06322a,
    skyBottom: 0x010806,
    bg: ['bg_ta.png'],
    target: 'mesh',
  }),
  role('grad', {
    color: 0xe8302a,
    glove: 0xe02a24,
    skyTop: 0x3a0d14,
    skyBottom: 0x0a0204,
    bg: ['bg_grad.png'],
    target: 'paper',
  }),
];

export const HUB = {
  id: 'hub',
  name: '',
  en: '',
  color: 0xe0201c,
  glove: 0xe0201c,
  skyTop: 0x1b2a6b,
  skyBottom: 0x05060f,
  bg: ['bg_hub.png'],
  target: null,
  hitTexts: [],
};

export const HITS_PER_ROLE = 6;
// a few spares so a missed target or two still leaves six to hit
export const TARGETS_PER_ROLE = 9;
