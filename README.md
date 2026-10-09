# Super Hooseok Odyssey

> 손끝마다 다른 나

장갑을 바꿔 끼면 또 다른 내가 된다. 슈퍼마리오 오디세이의 '캡처'를 장갑으로 옮겨, 핸드트래킹 XR 안에서 다섯 가지 '나'를 차례로 입어보는 1분 30초 영상 작품.

- 기획서: https://claude.ai/artifact/CFybV1MCYbB2EjH6h2JSX7
- 마감: 2026-10-12 23:59

## 기술 스택

- WebXR + three.js (Quest 3 브라우저, 핸드트래킹)
- 배포: HTTPS 필요 (GitHub Pages 또는 Netlify)
- 두 모드: **XR 모드**(헤드셋 1인칭 플레이·녹화) / **감독 모드**(PC 키보드, 트레일러 샷)

## 다섯 개의 롤

| # | 롤 | 컬러 | 대상 | 맞혔을 때 |
|---|---|---|---|---|
| 1 | 대학원생 | 빨강 | 논문 더미 | ACCEPTED 도장 + 종이 폭발 |
| 2 | 건축가 | 파랑 | 와이어프레임 블록 | 블록이 채워지고 건물이 솟음 |
| 3 | 테크니컬 아티스트 | 초록 | 회색 구체·토러스 | 툰/크롬/홀로그램 셰이더로 변함 |
| 4 | 포춘텔러 | 보라 | 타로 뒷면 | 카드가 뒤집히며 삶의 장면 공개 |
| 5 | 여행(사진)가 | 노랑 | 빈 폴라로이드 | 셔터 플래시 + 여행 사진, 배경 전환 |

한 롤 사이클(~11초): 룰렛(2s) → 변신(1.5s) → 플레이(6s) → 파워문(1.5s)

## 조작

| 인터랙션 | 핸드트래킹 | 키보드 |
|---|---|---|
| 손등 버튼 (룰렛 시작) | 오른손 검지 끝이 왼손 손등 중심 2.5cm 이내 | Space |
| 치기 | 손 콜라이더(구, r=8cm)와 대상 충돌 | 클릭 / 자동 히트 |
| 롤 점프 (감독 모드) | – | 1 ~ 5 |

## 에셋 폴더

생성물은 기획서의 파일명을 그대로 지켜 넣는다.

```
assets/
  bg/      bg_hub, bg_grad, bg_arch, bg_ta, bg_fortune, bg_travel1~3 (.png, 1536×1024)
  glove/   glove_grad, glove_arch, glove_ta, glove_fortune, glove_travel (.png, 1024²)
  tarot/   tarot_back, tarot_1~5 (.png, 1024×1536)
  images/  paper_cover, stamp_accepted, still_open, still_five (.png)
  sfx/     sfx_roulette, sfx_transform, sfx_moon (.mp3) + CC0 효과음
  photos/  실제 여행 사진 5장
```

오픈소스 에셋의 라이선스와 출처는 `CREDITS.md`에 기록한다.
