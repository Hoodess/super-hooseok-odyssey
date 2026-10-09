// Every piece of text the game shows, in one place so it can be edited freely.
// Hit texts cycle in order, one per hit (6 hits per role).

export const ROLE_TEXT = {
  travel: {
    name: '여행가',
    en: 'TRAVELER',
    wheel: '여행가', // short label on the roulette wedge
    hits: ['찰칵!', '+1 추억', 'NICE SHOT', '여기 어디?', '찰칵찰칵!', '인생샷!'],
  },
  arch: {
    name: '건축가',
    en: 'ARCHITECT',
    wheel: '건축가',
    hits: ['+1 층!', '착공!', '준공!', 'BUILD!', '스카이라인!', '완공!'],
  },
  fortune: {
    name: '포춘텔러',
    en: 'FORTUNE TELLER',
    wheel: '포춘텔러',
    hits: ['운명 공개!', 'THE STAR', '대길!', '+1 예언', 'FATE!', '보인다…!'],
  },
  ta: {
    name: '테크니컬 아티스트',
    en: 'TECHNICAL ARTIST',
    wheel: 'TA',
    hits: ['SHADED!', '+1 셰이더', 'RENDER!', '컴파일 완료', 'TOON!', '60FPS!'],
  },
  grad: {
    name: '대학원생',
    en: 'GRAD STUDENT',
    wheel: '대학원생',
    hits: ['+1 논문!', 'ACCEPTED', '리비전 끝!', 'D-1 클리어', '졸업각!', '디펜스 통과!'],
  },
};

export const UI = {
  start: 'GAME START',
  powerMoon: 'POWER MOON!',
  finaleHub: 'HOOSEOK', // label under the roulette in the finale
};

// every string above, for preloading the font's glyphs
export const ALL_TEXT = [
  ...Object.values(ROLE_TEXT).flatMap((r) => [r.name, r.en, r.wheel, ...r.hits]),
  ...Object.values(UI),
].join('') + '0123456789+!?…';
