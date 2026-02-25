# Visual Novel Engine (Web)

YAML DSL(`public/sample/1.yaml`, `public/sample/2.yaml`...)을 숫자 순서로 읽어 웹에서 실행하는 비주얼노벨 엔진입니다.

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
2. 액션 인터프리터(`bg`, `music`, `sound`, `char`, `say`, `wait`, `effect`, `goto`)
3. 타이핑 효과 + `<speed=...>` 인라인 속도 태그
4. `goto` 점프, `wait` 타이머, `shake/flash` 이펙트
5. `localStorage` 오토세이브(씬/액션 포인터)
6. 에러 오버레이(YAML parse 에러 line/column, 스키마/참조 에러)
7. 샘플 게임 + 초기 에셋(`public/sample/`)

## 샘플 구조

- `public/sample/1.yaml`
- `public/sample/2.yaml`
- `public/sample/sample.zip`
- `public/sample/assets/bg/*.svg`
- `public/sample/assets/char/**.svg`
- `public/sample/assets/music/*.wav`
- `public/sample/assets/sfx/*.wav`
