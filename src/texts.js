// Every piece of text the game shows, in one place so it can be edited freely.
// Hit texts cycle in order, one per hit (6 hits per role).

export const ROLE_TEXT = {
  travel: {
    name: '여행가',
    en: 'TRAVELER',
    wheel: '여행가', // short label on the roulette wedge
    hits: ['찰칵!', '+1 추억', '+1 경험', '여기 어디?', '여행 최고~', '문화기행!'],
  },
  arch: {
    name: '건축가',
    en: 'ARCHITECT',
    wheel: '건축가',
    hits: ['디자인!', '설계!', '프리츠커!', '건축사!', '+1층', '완공!'],
  },
  fortune: {
    name: '포춘텔러',
    en: 'FORTUNE TELLER',
    wheel: '포춘텔러',
    hits: ['카드 오픈!', '재물운!', '직업운!', '+1 예언', '+1 행운', 'THE WORLD'],
  },
  ta: {
    name: '테크니컬 아티스트',
    en: 'TECHNICAL ARTIST',
    wheel: 'TA',
    hits: ['XR!', '+1 셰이더', 'RENDER!', '+1 배포', '최적화!', '컴파일 완료!'],
  },
  grad: {
    name: '대학원생',
    en: 'GRAD STUDENT',
    wheel: '대학원생',
    hits: ['KAIST', '+1 과제', '다빈치랩!', '+1 논문', 'ACCEPTED', '디펜스 통과!'],
  },
};

export const UI = {
  start: 'GAME START',
  powerMoon: 'POWER MOON!',
  finaleHub: 'HOOSEOK', // label under the roulette in the finale
};

// Ending credits, one line each, rising in under the logo in this order.
export const CREDITS = [
  'Concept · Direction · Cast   Hooseok Lee',
  'Code   Claude (Anthropic)',
  'Images   ChatGPT Images',
  'Sound Effects   Gemini Lyria 3',
  'Motif   Super Mario Odyssey (2017, Nintendo)',
  'Music   Jump Up, Super Star! — Super Mario Odyssey OST',
  '2026 Introduction to Culture Technology',
];

// every string above, for preloading the font's glyphs
export const ALL_TEXT = [
  ...Object.values(ROLE_TEXT).flatMap((r) => [r.name, r.en, r.wheel, ...r.hits]),
  ...Object.values(UI),
  ...CREDITS,
].join('') + '0123456789+!?…';
