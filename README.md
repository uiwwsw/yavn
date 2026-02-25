# Visual Novel Engine (Web)

YAML DSL(`public/sample/1.yaml`, `public/sample/2.yaml`...)을 숫자 순서로 감지하고, 현재 챕터만 지연 로드해 웹에서 실행하는 비주얼노벨 엔진입니다.

개발 가이드:
- [DEVELOPMENT_GUIDE.ko.md](<home>/visual-novel/docs/DEVELOPMENT_GUIDE.ko.md)
- [SAMPLE_EXPANSION_PLAN.ko.md](<home>/visual-novel/docs/SAMPLE_EXPANSION_PLAN.ko.md)

## 실행

```bash
npm install
npm run dev
```

라우팅:
- `/sample`: 샘플 게임 즉시 실행
- `/`: ZIP 업로드 가이드 + ZIP 업로드 후 즉시 실행

## 챕터 로딩 규칙

- ZIP 또는 폴더에 `0.yaml`, `1.yaml`, `2.yaml`... 형태가 있으면 숫자 순서대로 자동 실행됩니다.
- `0.yaml`이 없으면 `1.yaml`부터 시작합니다.
- 최초 시작 시에는 현재 챕터 YAML만 파싱하고, 다음 챕터 YAML은 백그라운드에서 프리로드(파싱 캐시)합니다.
- 각 챕터 시작 전에 해당 YAML의 에셋을 전부 프리로드하고 로딩 UI를 표시합니다.
- 로딩 UI는 챕터 분수(`1/2`) 대신 일반 문구를 사용합니다.
- 로딩 UI는 최소 600ms 유지되며, 100% 도달 후 200ms 유지한 뒤 닫힙니다.
- 좌측 상단 HUD도 챕터 분수(`N/M`)를 표시하지 않고 제목만 표시합니다.

## 음악 URL 사용

- `assets.music` 값에 로컬 파일 경로 대신 `https://...` URL을 그대로 넣을 수 있습니다.
- YouTube 링크(`youtu.be`, `youtube.com/watch`, `youtube.com/shorts`, `youtube.com/embed`)도 BGM으로 재생됩니다.
- 브라우저 정책상 첫 클릭/키 입력 전에는 자동 재생이 제한될 수 있습니다.

## `say.char` 규칙

- `say.char`는 `assets.characters`의 키와 동일해야 합니다.
- 형식: `캐릭터ID` 또는 `캐릭터ID.emotion` (예: `conan`, `conan.serious`)
- 발화자 라벨은 `.` 앞부분(ID) 기준으로 표시됩니다.
- 한글 이름을 표시하려면 캐릭터 키 자체를 한글로 선언하면 됩니다(예: `코난`, `코난.진지`).

## 구현 범위

1. 챕터 단위 지연 YAML 로드 + Zod 스키마 검증
2. 액션 인터프리터(`bg`, `sticker`, `clearSticker`, `music`, `sound`, `char`, `say`, `wait`, `effect`, `goto`, `video`, `input`)
3. 타이핑 효과 + `<speed=...>` 인라인 속도 태그
4. `goto` 점프, `wait` 타이머, `shake/flash` 이펙트
5. `localStorage` 오토세이브(씬/액션 포인터)
6. 에러 오버레이(YAML parse 에러 line/column, 스키마/참조 에러)
7. 샘플 게임 + 초기 에셋(`public/sample/`)
8. 모바일 발화자 강조 연출(발화자 최상단 노출, 비발화자 30% 축소, 전환 시 부드러운 크기 트랜지션)

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
```

```yaml
- clearSticker: tape
# 또는 전체 제거
- clearSticker: all
```

- `sticker.image`는 `assets.backgrounds`에 선언된 키를 사용합니다.
- `x`, `y`, `width`, `height`는 숫자면 `%`, 문자열이면 CSS 길이값(예: `320px`, `24vw`)으로 처리됩니다.
- 앵커(`anchorX`, `anchorY`)로 기준점을 정해 위치를 직관적으로 맞출 수 있습니다.

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

## 샘플 구조

- `public/sample/1.yaml`
- `public/sample/2.yaml`
- `public/sample/3.yaml`
- `public/sample/4.yaml`
- `public/sample/sample.zip`
- `public/sample/assets/bg/*.(png|svg)`
- `public/sample/assets/char/**.(png|svg)`
- `public/sample/assets/music/*.wav`
- `public/sample/assets/sfx/*.wav`
