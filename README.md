# Visual Novel Engine (Web)

YAML DSL(`public/game-list/conan/1.yaml`, `public/game-list/conan/2.yaml`...)을 숫자 순서로 감지하고, 현재 챕터만 지연 로드해 웹에서 실행하는 비주얼노벨 엔진입니다.

개발 가이드:

- [DEVELOPMENT_GUIDE.ko.md](<home>/visual-novel/docs/DEVELOPMENT_GUIDE.ko.md)
- [SAMPLE_EXPANSION_PLAN.ko.md](<home>/visual-novel/docs/SAMPLE_EXPANSION_PLAN.ko.md)

## 실행

```bash
npm install
npm run dev
```

라우팅:

- `/game-list/:gameId`: 게임 리스트 폴더 기반 게임 즉시 실행
- `/`: 런처(샘플 ZIP 다운로드 + 게임 실행해보기 ZIP 업로드 + 게임 공유하기 PR 이동)

## 챕터 로딩 규칙

- ZIP 또는 폴더에 `0.yaml`, `1.yaml`, `2.yaml`... 형태가 있으면 숫자 순서대로 자동 실행됩니다.
- `0.yaml`이 없으면 `1.yaml`부터 시작합니다.
- 최초 시작 시에는 현재 챕터 YAML만 파싱하고, 다음 챕터 YAML은 백그라운드에서 프리로드(파싱 캐시)합니다.
- 각 챕터 시작 전에 해당 YAML의 에셋을 전부 프리로드하고 로딩 UI를 표시합니다.
- 로딩 UI는 챕터 분수(`1/2`) 대신 일반 문구를 사용합니다.
- 로딩 UI는 최소 600ms 유지되며, 100% 도달 후 200ms 유지한 뒤 닫힙니다.
- 좌측 상단 HUD도 챕터 분수(`N/M`)를 표시하지 않고 제목만 표시합니다.

## 홈 런처 버튼

- `샘플 파일 다운받기 (ZIP)`: 샘플 예시 ZIP(`public/sample.zip`)을 다운로드합니다.
- `게임 실행해보기 (ZIP 올려서)`: ZIP 파일을 업로드해 즉시 실행합니다.
- `게임 공유하기 (PR)`: GitHub PR 생성 화면(`https://github.com/uiwwsw/visual-novel/compare`)으로 이동합니다.

## 음악 URL 사용

- `assets.music` 값에 로컬 파일 경로 대신 `https://...` URL을 그대로 넣을 수 있습니다.
- YouTube 링크(`youtu.be`, `youtube.com/watch`, `youtube.com/shorts`, `youtube.com/embed`)도 BGM으로 재생됩니다.
- 브라우저 정책상 첫 클릭/키 입력 전에는 자동 재생이 제한될 수 있습니다.

## `say.char` 규칙

- `say.char`는 `assets.characters`의 키와 동일해야 합니다.
- 형식: `캐릭터ID` 또는 `캐릭터ID.emotion` (예: `conan`, `conan.serious`)
- 발화자 라벨은 `.` 앞부분(ID) 기준으로 표시됩니다.
- `say.char`를 생략하면 발화자 라벨을 표시하지 않습니다(이전 `Narration` 기본 라벨 제거).
- 한글 이름을 표시하려면 캐릭터 키 자체를 한글로 선언하면 됩니다(예: `코난`, `코난.진지`).

## 구현 범위

1. 챕터 단위 지연 YAML 로드 + Zod 스키마 검증
2. 액션 인터프리터(`bg`, `sticker`, `clearSticker`, `music`, `sound`, `char`, `say`, `wait`, `effect`, `goto`, `video`, `input`)
3. 타이핑 효과 + `<speed=...>` 인라인 속도 태그
4. `goto` 점프, `wait` 타이머, 전역 화면 이펙트(`shake/flash/...`)
5. 스티커 등장 이펙트(`sticker.enter`: fade/scale/slide/wipe/blur/rotate)
6. `localStorage` 오토세이브(씬/액션 포인터)
7. 에러 오버레이(YAML parse 에러 line/column, 스키마/참조 에러)
8. 게임 리스트 폴더 기반 샘플 게임 + 초기 에셋(`public/game-list/conan/`)
9. 발화자 우선순위 연출(최신 발화자 1순위, 직전 발화자 2순위... 순으로 z-index 정렬, 모바일에서 1순위 외 30% 축소)

## Video 컷신 액션

```yaml
- video:
    src: assets/cutscene/intro.mp4
    holdToSkipMs: 900
```

- `src`: 파일 경로 또는 YouTube URL
- 로컬 영상 재생 중 클릭하면 "길게 눌러 건너뛰기" 가이드가 노출됩니다.
- YouTube 컷신도 동일하게 탭 시 "길게 눌러 건너뛰기" 가이드가 노출됩니다.
- 모바일 브라우저 정책상 YouTube 컷신은 기본 음소거 상태로 자동재생됩니다.
- YouTube 컷신은 모바일 세로 화면에서도 16:9 비율을 유지해 좌우 크롭 없이 전체 프레임을 보여줍니다(레터박스).
- "길게 눌러 건너뛰기" 가이드는 하단 중앙에 표시됩니다.
- 가이드 노출 후 길게 누르면 즉시 컷신을 종료하고 다음 게임 액션으로 복귀합니다.

## Sticker 액션

```yaml
- sticker:
    id: tape
    image: police_tape # assets.backgrounds 키
    x: 50
    y: 0
    width: 120
    anchorX: center
    anchorY: top
    zIndex: 1
    enter:
      effect: wipeCenterX
      duration: 420
      easing: ease-out
      delay: 0
```

```yaml
- clearSticker: tape
# 또는 전체 제거
- clearSticker: all
```

```yaml
- clearSticker:
    id: tape
    leave:
      effect: fadeOut
      duration: 240
```

- `sticker.image`는 `assets.backgrounds`에 선언된 키를 사용합니다.
- `x`, `y`, `width`, `height`는 숫자면 `%`, 문자열이면 CSS 길이값(예: `320px`, `24vw`)으로 처리됩니다.
- 앵커(`anchorX`, `anchorY`)로 기준점을 정해 위치를 직관적으로 맞출 수 있습니다.
- 스티커는 다이얼로그 박스 영역과 겹치지 않도록 다이얼로그 상단까지만 렌더링됩니다.
- `enter`로 스티커 등장 이펙트를 지정할 수 있습니다.
  - 축약형: `enter: fadeIn`
  - 상세형: `enter.effect`, `enter.duration(ms)`, `enter.easing`, `enter.delay(ms)`
- `clearSticker`는 문자열(`tape`, `all`) 또는 객체(`id`, `leave`) 형식을 지원합니다.
  - `leave` 축약형: `leave: fadeOut`
  - `leave` 상세형: `leave.effect`, `leave.duration(ms)`, `leave.easing`, `leave.delay(ms)`
  - 지원 효과:
    - 등장(`enter`): `none`, `fadeIn`, `wipeLeft`, `scaleIn`, `popIn`, `slideUp`, `slideDown`, `slideLeft`, `slideRight`, `wipeCenterX`, `wipeCenterY`, `blurIn`, `rotateIn`
    - 퇴장(`leave`): `none`, `fadeOut`, `wipeLeft`, `wipeRight`

## 정답 입력 액션

```yaml
- input:
    correct: "예"
    errors:
      - "잘 생각해봐."
      - "아니, 반댓말은?"
      - "정답: 예"
```

```yaml
- input: "예"
```

- `correct`: 유저가 입력해야 하는 정답 문자열
- `errors`: 오답 메시지(문자열 1개 또는 문자열 배열). 생략 시 기본 메시지(`정답이 아닙니다.`) 사용
- 오답 횟수가 `errors` 길이를 넘으면 마지막 메시지를 계속 보여줍니다.
- 축약형 `input: "정답"` 문법도 지원합니다.

## 게임 리스트 구조

- `public/game-list/index.json` (`predev`/`prebuild`에서 자동 생성)
- `index.json`의 게임 표시명(`games[].name`)은 각 게임의 대표 YAML(`0.yaml` 우선, 없으면 `1.yaml`/`sample.yaml`/사전순 첫 YAML)의 `meta.title`을 우선 사용합니다.
- `public/game-list/conan/1.yaml`
- `public/game-list/conan/2.yaml`
- `public/game-list/conan/3.yaml`
- `public/game-list/conan/4.yaml`
- `public/game-list/conan/assets/bg/*.(png|svg)`
- `public/game-list/conan/assets/char/**.(png|svg)`
- `public/game-list/conan/assets/music/*.wav`
- `public/game-list/conan/assets/sfx/*.wav`
