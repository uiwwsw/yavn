# Visual Novel Engine (Web)

YAML DSL(`public/sample/1.yaml`, `public/sample/2.yaml`...)을 숫자 순서로 읽어 웹에서 실행하는 비주얼노벨 엔진입니다.

개발 가이드:
- [DEVELOPMENT_GUIDE.ko.md](<home>/visual-novel/docs/DEVELOPMENT_GUIDE.ko.md)

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
- 각 챕터 시작 전에 해당 YAML의 에셋을 전부 프리로드하고 로딩 UI를 표시합니다.

## 음악 URL 사용

- `assets.music` 값에 로컬 파일 경로 대신 `https://...` URL을 그대로 넣을 수 있습니다.
- YouTube 링크(`youtu.be`, `youtube.com/watch`, `youtube.com/shorts`, `youtube.com/embed`)도 BGM으로 재생됩니다.
- 브라우저 정책상 첫 클릭/키 입력 전에는 자동 재생이 제한될 수 있습니다.

## 구현 범위

1. YAML 로드 + Zod 스키마 검증
2. 액션 인터프리터(`bg`, `music`, `sound`, `char`, `say`, `wait`, `effect`, `goto`, `video`, `input`)
3. 타이핑 효과 + `<speed=...>` 인라인 속도 태그
4. `goto` 점프, `wait` 타이머, `shake/flash` 이펙트
5. `localStorage` 오토세이브(씬/액션 포인터)
6. 에러 오버레이(YAML parse 에러 line/column, 스키마/참조 에러)
7. 샘플 게임 + 초기 에셋(`public/sample/`)

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
- `public/sample/sample.zip`
- `public/sample/assets/bg/*.svg`
- `public/sample/assets/char/**.svg`
- `public/sample/assets/music/*.wav`
- `public/sample/assets/sfx/*.wav`
