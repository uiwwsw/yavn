# Visual Novel Engine 개발 가이드

이 문서는 이 프로젝트에서 YAML DSL로 게임을 제작할 때 필요한 기능을 한 번에 정리한 실무 가이드입니다.

## 0) 읽는 법 / 주석 규칙

- 코드블록 안 `# ...` 는 YAML 주석입니다. 그대로 두어도 실행에는 영향이 없습니다.
- 문서 안 `노트:`는 실무에서 자주 놓치는 포인트입니다.
- "최소 예시"를 먼저 복사해서 동작 확인 후, 액션을 하나씩 추가하는 방식이 가장 안전합니다.

## 1) 빠른 시작

```bash
pnpm install
pnpm dev
```

- `/sample`: `public/sample/`의 샘플 게임 실행
- `/`: ZIP 업로드 런처

## 2) 최소 YAML 골격

```yaml
meta:
  title: "게임 제목" # 게임에 표시될 타이틀
  author: "작성자" # 선택
  version: "1.0" # 선택

settings:
  textSpeed: 38 # 기본 타이핑 속도
  autoSave: true # 진행 자동 저장
  clickToInstant: true # 타이핑 중 클릭 시 즉시 전체 표시

assets:
  backgrounds: {}
  characters: {}
  music: {}
  sfx: {}

script:
  - scene: intro # 시작 씬

scenes:
  intro:
    actions:
      - say:
          text: "시작"
```

## 3) 상단 필드 설명

### `meta`
- `title`: 게임 제목
- `author`: 작성자(선택)
- `version`: 버전(선택)

### `settings`
- `textSpeed`: 기본 타이핑 속도(cps)
- `autoSave`: 액션 진행 포인터 자동 저장 여부
- `clickToInstant`: 대사 타이핑 중 클릭/Enter/Space 시 즉시 전체 표시

### `assets`
- `backgrounds`: 배경 ID → 파일 경로/URL
- `characters`: 캐릭터 ID → 기본 이미지 + 감정별 이미지
- `music`: BGM ID → 파일 경로/URL
- `sfx`: 효과음 ID → 파일 경로/URL

## 4) 에셋 선언 방법

### 배경
```yaml
assets:
  backgrounds:
    hall: assets/bg/hall.png
```

### 캐릭터
```yaml
assets:
  characters:
    conan:
      base: assets/char/conan/base.png
      emotions:
        think: assets/char/conan/think.png
        serious: assets/char/conan/serious.png
```

### 음악/효과음
```yaml
assets:
  music:
    mystery: assets/music/mystery.wav
  sfx:
    door: assets/sfx/door.wav
```

## 5) 액션 전체 목록

엔진이 지원하는 액션:
- `bg`
- `bgFront`
- `clearBgFront`
- `music`
- `sound`
- `char`
- `say`
- `wait`
- `effect`
- `goto`
- `video`
- `input`

아래는 각각의 사용법입니다.

### `bg`
배경 교체. 전면 배경(`bgFront`)은 자동으로 제거됩니다.

```yaml
- bg: hall
```

### `bgFront`
전면 배경(오버레이) 표시.

```yaml
- bgFront: police_tape
```

### `clearBgFront`
전면 배경 제거.

```yaml
- clearBgFront: true
```

### `music`
BGM 재생(루프).

```yaml
- music: mystery
```

노트:
- `assets.music`에 일반 파일 경로뿐 아니라 `https://...`도 사용 가능
- YouTube URL(`youtu.be`, `watch`, `shorts`, `embed`, `live`)도 BGM으로 재생 가능

### `sound`
효과음 1회 재생.

```yaml
- sound: door
```

### `char`
캐릭터 슬롯(`left`/`center`/`right`)에 표시.

```yaml
- char:
    id: conan
    position: center
    emotion: think
```

노트:
- `emotion`이 없으면 `base` 사용
- `emotion` 키가 없으면 자동으로 `base`로 fallback

### `say`
대사 출력.

```yaml
- say:
    char: conan.serious
    text: "범인은 이 안에 있어."
```

노트:
- `char` 생략 시 내레이션 처리
- `say.char`는 반드시 캐릭터 에셋 키를 사용해야 함: `캐릭터ID` 또는 `캐릭터ID.emotion`
- `say.char: conan.serious`처럼 감정을 붙이면 발화자 표시는 `conan`(점 `.` 앞부분)으로 처리
- 한국어 이름을 표시하고 싶으면 캐릭터 에셋 키 자체를 한국어로 선언하면 됨(예: `코난`, `코난.진지`)
- `<speed=숫자>...</speed>`로 해당 대사만 속도 오버라이드 가능
- 모바일에서는 발화자(`say.char`)와 동일한 ID 캐릭터를 최상단으로 노출하고, 발화자가 아닌 캐릭터는 30% 축소(scale 0.7)해 겹침을 줄입니다.
- 발화자 전환으로 크기가 바뀔 때는 transform 트랜지션(180ms ease-out)으로 부드럽게 전환됩니다.
- 발화자 ID가 없는 내레이션(`char` 생략)일 때는 축소를 적용하지 않습니다.

```yaml
- say:
    text: "<speed=20>천천히 보여줄 문장</speed>"
```

### `wait`
밀리초 단위 대기.

```yaml
- wait: 800
```

### `effect`
짧은 화면 효과.

```yaml
- effect: shake
```

지원 이름:
- `shake`
- `flash`
- `zoom`
- `blur`
- `darken`
- `pulse`
- `tilt`

### `goto`
특정 씬으로 점프.

```yaml
- goto: reveal
```

### `video`
인트로/컷신 영상 재생.

```yaml
- video:
    src: assets/cutscene/intro.mp4
    holdToSkipMs: 900
```

노트:
- `src`는 파일 경로 또는 YouTube URL 가능
- 로컬 영상 재생 중 클릭하면 "길게 눌러 건너뛰기" 가이드 노출
- YouTube 컷신도 탭 시 "길게 눌러 건너뛰기" 가이드 노출
- 모바일 브라우저 정책상 YouTube 컷신은 기본 음소거 자동재생
- YouTube 컷신은 모바일 세로 화면에서도 16:9 비율을 유지해 좌우 크롭 없이 전체 프레임 표시(레터박스)
- 스킵 가이드는 하단 중앙에 표시
- 길게 누르면 스킵
- `holdToSkipMs` 기본값 `800`, 허용 범위 `300~5000`

### `input`
정답 입력 게이트. 정답을 입력해야 다음 액션으로 진행.

```yaml
- input:
    correct: "예" # 정답
    errors:
      - "잘 생각해봐." # 1회 오답
      - "아니, 반댓말은?" # 2회 오답
      - "정답: 예" # 3회 이상 오답(마지막 메시지 고정)
```

축약형:

```yaml
- input: "예"
```

동작:
- 입력값과 `correct`를 앞뒤 공백 `trim` 후 비교
- 오답 시 시도 횟수 +1
- `errors[n-1]` 출력
- 오답 횟수가 `errors` 길이를 넘으면 마지막 메시지 고정 출력
- `errors`를 생략하면 기본 메시지 `정답이 아닙니다.` 사용
- `errors`는 문자열 1개 또는 문자열 배열 모두 허용

## 6) 씬 구성 규칙

### `script`
- 게임 실행 순서 목록
- 반드시 존재하는 씬 ID만 참조해야 함

```yaml
script:
  - scene: incident
  - scene: discovery
```

### `scenes`
- 씬 ID별 `actions` 배열 정의

```yaml
scenes:
  incident:
    actions:
      - bg: hall
      - say:
          text: "사건 시작"
```

## 7) 챕터 로딩 규칙

### URL 로딩(`/sample` 등)
- `0.yaml`이 있으면 `0,1,2...` 순으로 로딩
- `0.yaml`이 없고 `1.yaml`이 있으면 `1,2,3...` 순으로 로딩
- 초기 진입 시에는 시작 챕터 YAML만 파싱하고, 다음 챕터 YAML은 백그라운드에서 프리로드(파싱 캐시)합니다.
- 번호 파일이 없으면 단일 YAML URL fallback 시도

### ZIP 로딩(`/`)
- ZIP 내부 YAML 중 `0.yaml`, `1.yaml`...이 있으면 번호순 실행
- 번호 YAML이 없으면 `sample.yaml` 우선, 없으면 파일명 사전순 첫 YAML 실행
- 초기 진입 시에는 시작 챕터 YAML만 파싱하고, 다음 챕터 YAML은 백그라운드에서 프리로드(파싱 캐시)합니다.
- 챕터 시작 전 에셋 프리로드 진행
- 로딩 UI 문구는 챕터 분수(`1/2`)를 노출하지 않습니다.
- 로딩 UI는 최소 600ms 유지하고, 100% 도달 후 200ms를 더 보여준 뒤 닫힙니다.
- 좌측 상단 HUD는 챕터 분수(`N/M`)를 노출하지 않고 게임 제목만 표시합니다.

## 8) 파일/포맷 가이드

권장 구조:

```text
my-game.zip
  1.yaml
  2.yaml
  assets/
    bg/
    char/
    music/
    sfx/
    cutscene/
```

지원 확장자(주요):
- 이미지: `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`
- 오디오: `wav`, `mp3`, `ogg`
- 비디오: `mp4`, `webm`, `mov`
- Live2D: `json`

## 9) Live2D 사용법

캐릭터 에셋 경로가 `.json`이면 Live2D 모델로 자동 처리됩니다.

```yaml
assets:
  characters:
    hero:
      base: assets/live2d/hero.model3.json
      emotions:
        happy: assets/live2d/hero.model3.json
```

노트:
- ZIP 로딩 시 모델 JSON 내부 상대 경로를 엔진이 자동 보정
- `emotion` 값은 모델의 expression/motion 그룹 이름과 맞춰야 적용됨

## 10) 저장/재시작/입력 제약

- `autoSave: true`면 현재 챕터/씬/액션 포인터가 `localStorage`에 저장
- 새로고침 시 저장 지점부터 이어서 실행
- 엔딩 후 "처음부터 다시 시작"은 저장을 지우고 1챕터부터 시작
- `input` 액션 활성 중에는 클릭/Enter/Space로 강제 진행 불가

## 11) 검증/오류 처리

파서에서 검증하는 핵심:
- `script`가 없는 씬 참조하면 에러
- `goto` 대상 씬 누락 시 에러
- `bg`, `bgFront`, `music`, `sound`, `char.id`가 `assets`에 없으면 에러

YAML 파싱 에러는 line/column을 포함해 오버레이에 노출됩니다.

## 12) 제작 권장 패턴

- 감정 변경은 `char` 액션을 다시 호출해 명시적으로 전환
- 긴 대사는 `<speed=...>`로 속도 변주
- 긴장감은 `wait + effect + sound` 조합으로 구성
- 챕터 끝에 `video`나 강한 `effect`를 배치해 다음 챕터 연결점 생성
- 추리/퀴즈 구간은 `input`을 사용하고 마지막 오류 메시지를 힌트로 설계

## 13) 기능 변경 시 문서 업데이트 규칙

새 기능을 개발하거나 기존 동작을 바꿀 때 아래를 반드시 같이 수정합니다.

1. 이 문서의 해당 섹션
2. [README.md](<home>/visual-novel/README.md) 구현 범위/예시
3. 샘플 YAML(`public/sample/*.yaml` 또는 `sample.yaml`)의 실제 사용 예시

권장: 아래 변경 로그를 같이 갱신하세요.

## 14) 문서 변경 로그

- 2026-02-25: 좌측 상단 HUD 메타에서 챕터 분수(`N/M`) 표기를 제거해 제목만 표시하도록 수정.
- 2026-02-25: 챕터 로딩 UI에 최소 표시 시간(600ms)과 완료 상태 유지 시간(100% 후 200ms)을 추가해 너무 빠르게 닫히는 체감을 완화.
- 2026-02-25: 챕터 로딩 UI 문구에서 `N/M` 표기를 제거하고, 로딩 오버레이가 닫히기 전 100% 상태를 한 프레임 표시하도록 조정.
- 2026-02-25: 챕터 로딩을 지연 방식으로 변경. 시작 시 전체 YAML 파싱 대신 현재 챕터만 파싱하고, 다음 챕터 YAML은 백그라운드 프리로드(파싱 캐시)하도록 수정.
- 2026-02-25: 모바일 발화자 강조(원본/30% 축소) 전환 시 캐릭터 크기 변화에 transform 트랜지션(180ms ease-out)을 추가.
- 2026-02-25: `say.char` 규칙을 `캐릭터ID`/`캐릭터ID.emotion`으로 명확화하고, 파서가 캐릭터/감정 키를 검증하도록 강화. 발화자 표시는 점(`.`) 앞 ID를 사용하도록 정리.
- 2026-02-25: 모바일 캐릭터 강조 동작 추가. `say.char`의 발화자 캐릭터를 최상단(z-index 우선)으로 표시하고, 비발화 캐릭터는 30% 축소해 겹침을 줄이도록 수정.
- 2026-02-25: YouTube 컷신 모바일 동작 정리(기본 음소거 자동재생, 플레이어 컨트롤 직접 터치 가능), 스킵 가이드 동작 문구를 로컬 영상 기준으로 명확화.
- 2026-02-25: YouTube 컷신 렌더링을 16:9 고정 레터박스로 조정해 모바일 세로 화면에서 좌우 크롭이 발생하지 않도록 수정.
- 2026-02-25: YouTube 컷신 스킵 가이드를 상단 우측으로 이동하고, 홀드 스킵 시작 조건을 보정해 모바일에서 즉시 길게 눌러 건너뛰기가 동작하도록 수정.
- 2026-02-25: 컷신 인터랙션을 기존 방식으로 복원(YouTube 위 인터랙션 레이어, 탭 시 가이드 표시, 하단 중앙 길게 눌러 스킵).
- 2026-02-25: `input` 스키마를 확장해 `input: "정답"` 축약형과 `errors` 생략/단일 문자열 입력을 허용하도록 수정.
- 2026-02-25: `input` 정답 입력 게이트 문법/동작 추가, 전체 기능 가이드 최초 정리.
