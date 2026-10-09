// Role definitions. Order here is the order the roulette lands on in director mode.
// Colors follow the letters of the logo.

export const ROLES = [
  {
    id: 'grad',
    name: '대학원생',
    en: 'GRAD STUDENT',
    color: 0xe8302a,
    skyTop: 0x3a0d14,
    skyBottom: 0x0a0204,
    bg: ['bg_grad.png'],
    glove: 'glove_grad.png',
    target: 'paper',
    hitTexts: ['+1 논문!', 'ACCEPTED', '리비전 끝!', 'D-1 클리어', '졸업각!'],
  },
  {
    id: 'arch',
    name: '건축가',
    en: 'ARCHITECT',
    color: 0x1f7bff,
    skyTop: 0x0b2a6e,
    skyBottom: 0x020a1c,
    bg: ['bg_arch.png'],
    glove: 'glove_arch.png',
    target: 'block',
    hitTexts: ['+1 층!', '착공!', '준공!', 'BUILD!', '스카이라인!'],
  },
  {
    id: 'ta',
    name: '테크니컬 아티스트',
    en: 'TECHNICAL ARTIST',
    color: 0x22d36b,
    skyTop: 0x06322a,
    skyBottom: 0x010806,
    bg: ['bg_ta.png'],
    glove: 'glove_ta.png',
    target: 'mesh',
    hitTexts: ['SHADED!', '+1 셰이더', 'RENDER!', '컴파일 완료', 'TOON!'],
  },
  {
    id: 'fortune',
    name: '포춘텔러',
    en: 'FORTUNE TELLER',
    color: 0x9b3cff,
    skyTop: 0x2a0b55,
    skyBottom: 0x07021a,
    bg: ['bg_fortune.png'],
    glove: 'glove_fortune.png',
    target: 'card',
    hitTexts: ['운명 공개!', 'THE STAR', '대길!', '+1 예언', 'FATE!'],
  },
  {
    id: 'travel',
    name: '여행가',
    en: 'TRAVELER',
    color: 0xffc21a,
    skyTop: 0x5a3a08,
    skyBottom: 0x140a01,
    bg: ['bg_travel1.png', 'bg_travel2.png', 'bg_travel3.png'],
    glove: 'glove_travel.png',
    target: 'polaroid',
    hitTexts: ['찰칵!', '+1 추억', 'NICE SHOT', '여기 어디?', '찰칵찰칵!'],
  },
];

export const HUB = {
  id: 'hub',
  name: '',
  en: '',
  color: 0xe0201c,
  skyTop: 0x1b2a6b,
  skyBottom: 0x05060f,
  bg: ['bg_hub.png'],
  glove: null,
  target: null,
  hitTexts: [],
};

export const HITS_PER_ROLE = 5;
export const TARGETS_PER_ROLE = 6;
