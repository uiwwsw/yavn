# YAVN (야븐) 개발 가이드

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

- `/game-list/:gameId`: `public/game-list/<gameId>/`의 게임 실행
- `/`: 런처(`게임 실행해보기 (ZIP 올려서)` + `게임 공유하기 (PR)`)

## 1-1) 무엇부터 읽고 만들까? (추천 순서)

처음 제작할 때는 아래 순서가 가장 빠릅니다.

1. [README.md](<home>/visual-novel/README.md)의 `YAML DSL Example`로 최소 골격 확인
2. 실제 샘플 YAML 확인:
   - [public/game-list/conan/1.yaml](<home>/visual-novel/public/game-list/conan/1.yaml)
   - [public/game-list/conan/2.yaml](<home>/visual-novel/public/game-list/conan/2.yaml)
   - [public/game-list/conan/3.yaml](<home>/visual-novel/public/game-list/conan/3.yaml)
   - [public/game-list/conan/4.yaml](<home>/visual-novel/public/game-list/conan/4.yaml)
3. 자연어 스토리 초안을 YAML로 바꾸고 싶으면 프롬프트 사용:
   - [YAML_STORY_TO_DSL_PROMPT.ko.md](<home>/visual-novel/docs/YAML_STORY_TO_DSL_PROMPT.ko.md)
4. 생성된 YAML을 실행해 에러/템포를 확인하고, 필요한 연출을 추가

## 2) 최소 YAML 골격

```yaml
meta:
  title: "게임 제목" # 게임에 표시될 타이틀
  author: # 선택 (문자열 또는 객체)
    name: "작성자"
    contacts:
      - "Email: writer@example.com"
      - label: "LinkedIn"
        value: "linkedin.com/in/writer"
        href: "https://linkedin.com/in/writer"
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
- `author`: 작성자 정보(선택)
  - 문자열: `"작성자명"`
  - 객체: `name` + `contacts[]`
  - `contacts[]` 원소는 문자열 또는 `{ label?, value, href? }`
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
- `sticker`
- `clearSticker`
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
배경 교체.

```yaml
- bg: hall
```

### `sticker`
특정 위치에 이미지를 붙이는 오버레이 스티커 표시/갱신.

```yaml
- sticker:
    id: tape
    image: police_tape
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

노트:
- `image`는 `assets.backgrounds` 키를 사용
- `id`가 같으면 기존 스티커를 갱신(위치/크기/이미지 변경)
- `x`, `y`, `width`, `height`:
  - 숫자 입력 시 `%`로 처리
  - 문자열 입력 시 CSS 길이값으로 처리(예: `320px`, `24vw`, `40%`)
- `anchorX`: `left | center | right` (기본 `center`)
- `anchorY`: `top | center | bottom` (기본 `center`)
- `rotate`: 회전 각도(deg), 기본 `0`
- `opacity`: `0~1`, 기본 `1`
- `zIndex`: 스티커 간 앞뒤 순서, 기본 `0`
- `enter`: 등장 이펙트 옵션
  - 축약형: `enter: fadeIn`
  - 상세형: `enter.effect`, `enter.duration(ms)`, `enter.easing`, `enter.delay(ms)`
  - 지원 효과:
    - `none`
    - `fadeIn`
    - `wipeLeft`
    - `scaleIn`
    - `popIn`
    - `slideUp`
    - `slideDown`
    - `slideLeft`
    - `slideRight`
    - `wipeCenterX`
    - `wipeCenterY`
    - `blurIn`
    - `rotateIn`
- 스티커 레이어는 다이얼로그 박스와 겹치지 않도록 다이얼로그 상단까지만 렌더링됩니다(다이얼로그 높이 변화 시 자동 반영).

### `clearSticker`
스티커 제거.

```yaml
- clearSticker: tape
# 전체 제거
- clearSticker: all
```

```yaml
- clearSticker:
    id: tape
    leave:
      effect: fadeOut
      duration: 240
```

노트:
- 객체형에서는 `id`와 `leave`를 함께 사용 가능
- `leave` 축약형: `leave: fadeOut`
- `leave` 상세형: `leave.effect`, `leave.duration(ms)`, `leave.easing`, `leave.delay(ms)`
- `leave` 지원 효과: `none`, `fadeOut`, `wipeLeft`, `wipeRight`

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
캐릭터 슬롯(`left`/`center`/`right`) 배치/갱신.

```yaml
- char:
    id: conan
    position: center
    emotion: think
```

노트:
- `emotion`이 없으면 `base` 사용
- `emotion` 키가 없으면 자동으로 `base`로 fallback
- 실제 노출 인원은 `say` 시점에 결정됨(`say.char` 1인 기본, `say.with` 추가 노출)

### `say`
대사 출력.

```yaml
- say:
    char: conan.serious
    text: "범인은 이 안에 있어."
```

노트:
- `char` 생략 시 발화자 라벨을 표시하지 않으며, 화면 캐릭터도 모두 숨김
- `say.char`는 반드시 캐릭터 에셋 키를 사용해야 함: `캐릭터ID` 또는 `캐릭터ID.emotion`
- `say.char: conan.serious`처럼 감정을 붙이면 발화자 표시는 `conan`(점 `.` 앞부분)으로 처리
- `chat.with` 키는 지원하지 않음. 캐릭터 동시 노출은 반드시 `say.with`를 사용
- `say.with`를 쓰면 화자 외 캐릭터를 추가 노출할 수 있음
- `say.with` 각 항목도 `캐릭터ID` 또는 `캐릭터ID.emotion` 형식을 사용해야 함
- 기본 노출은 화자 1명이며, `say.with`는 추가 노출만 담당(배치는 기존 `char` 슬롯 재사용)
- 한국어 이름을 표시하고 싶으면 캐릭터 에셋 키 자체를 한국어로 선언하면 됨(예: `코난`, `코난.진지`)
- `<speed=숫자>...</speed>`로 해당 대사만 속도 오버라이드 가능
- 발화자 우선순위는 `say.char` 발생 순서로 관리합니다. 최신 발화자=1순위, 그 이전 발화자=2순위, 3순위...로 누적됩니다(삭제 없음).
- 화면의 캐릭터 z-index는 이 우선순위를 그대로 사용합니다. 즉, 1순위가 항상 최상단이며 직전 발화자는 자동으로 2순위가 됩니다.
- 실제 렌더링 순위는 매 프레임 화면에 존재하는 캐릭터(left/center/right)만 대상으로 재계산하며, 동률일 때는 위치 우선순위(center > left > right)로 고정 정렬합니다.
- 모바일에서는 1순위 캐릭터를 원본 크기로 유지하고, 2순위 이하 캐릭터는 30% 축소(scale 0.7)해 겹침을 줄입니다.
- 우선순위 전환으로 크기가 바뀔 때는 transform 트랜지션(180ms ease-out)으로 부드럽게 전환됩니다.

```yaml
- say:
    char: 코난.serious
    with:
      - 코고로.angry
      - 란
    text: "둘 다 잠깐만, 핵심만 정리할게."
```

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
- 모바일 브라우저 정책상 로컬 영상 컷신은 기본 음소거 자동재생
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
- 입력 게이트가 화면에 나타나면 입력창이 자동 포커스됨
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

### URL 로딩(`/game-list/:gameId` 등)
- 런처(`/`)는 `public/game-list/index.json`을 읽어 게임 목록을 동적으로 노출합니다.
- `index.json`은 `predev`, `prebuild`에서 `public/game-list/` 하위 폴더를 스캔해 자동 생성됩니다.
- `index.json.games[].name`은 대표 YAML(`0.yaml` 우선, 없으면 `1.yaml`/`sample.yaml`/사전순 첫 YAML)의 `meta.title`을 우선 사용하고, 없으면 폴더명을 제목화해 사용합니다.
- `0.yaml`이 있으면 `0,1,2...` 순으로 로딩
- `0.yaml`이 없고 `1.yaml`이 있으면 `1,2,3...` 순으로 로딩
- 초기 진입 시에는 시작 챕터 YAML만 파싱하고, 다음 챕터 YAML은 백그라운드에서 프리로드(파싱 캐시)합니다.
- 번호 파일이 없으면 단일 YAML URL fallback 시도

### ZIP 로딩(`/`)
- 런처의 `샘플 파일 다운받기 (ZIP)` 버튼으로 예시 파일(`public/sample.zip`)을 내려받아 구조를 먼저 확인할 수 있습니다.
- 런처의 `게임 실행해보기 (ZIP 올려서)` 버튼으로 ZIP을 선택하면 즉시 실행됩니다.
- 런처의 `게임 공유하기 (PR)` 버튼은 GitHub PR 생성 페이지로 이동합니다.
- ZIP 내부 YAML 중 `0.yaml`, `1.yaml`...이 있으면 번호순 실행
- 번호 YAML이 없으면 `sample.yaml` 우선, 없으면 파일명 사전순 첫 YAML 실행
- ZIP 모드에서는 `video.src`의 로컬 경로(mp4/webm/mov)도 blob URL로 치환해 컷신 재생 경로를 보정합니다.
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
- 엔딩 후 영화식 롤링 크레딧이 노출되며, 하단 고정 `게임 다시 시작하기` 버튼으로 저장을 지우고 1챕터부터 다시 시작
- `input` 액션 활성 중에는 클릭/Enter/Space로 강제 진행 불가

## 11) 검증/오류 처리

파서에서 검증하는 핵심:
- `script`가 없는 씬 참조하면 에러
- `goto` 대상 씬 누락 시 에러
- `bg`, `sticker.image`, `music`, `sound`, `char.id`가 `assets`에 없으면 에러

YAML 파싱 에러는 line/column을 포함해 오버레이에 노출됩니다.

## 12) 제작 권장 패턴

- 감정 변경은 `char` 액션을 다시 호출해 명시적으로 전환
- 긴 대사는 `<speed=...>`로 속도 변주
- 긴장감은 `wait + effect + sound` 조합으로 구성
- 챕터 끝에 `video`나 강한 `effect`를 배치해 다음 챕터 연결점 생성
- 추리/퀴즈 구간은 `input`을 사용하고 마지막 오류 메시지를 힌트로 설계

## 12-1) AI 초안 → 플레이 가능한 빌드 워크플로

1. 작가가 자유 형식으로 스토리 작성(캐릭터/장소/사건/결말 포함)
2. [YAML_STORY_TO_DSL_PROMPT.ko.md](<home>/visual-novel/docs/YAML_STORY_TO_DSL_PROMPT.ko.md) 프롬프트에 스토리를 붙여 YAML 초안 생성
3. 초안 실행 후, 장면 목적이 약한 구간부터 정리:
   - 장면 분할(`scene`) 재조정
   - 대사 템포(`<speed=...>`) 보정
   - `goto` 흐름 단순화
4. 연출/인터랙션 고도화:
   - 인트로/컷신: `video`
   - 긴장 연출: `effect + sound + wait`
   - 화면 오브젝트 연출: `sticker`, `clearSticker`
   - 유저 참여 게이트: `input`
5. 마지막으로 챕터(`1.yaml`, `2.yaml`...) 분리 후 로딩/템포 점검

노트:
- AI 초안은 "구조 생성"에 강하고, 완성도는 수동 편집에서 올라갑니다.
- 기존 프로젝트를 수정할 때는 "기존 YAML 유지 + 부분 수정" 방식이 안전합니다.

## 12-2) 장편 샘플 제작 순서(권장)

- 1단계: 사건을 `기(도입) / 승(충돌) / 전(재현) / 결(해결)` 4축으로 먼저 고정
- 2단계: 축별 목표를 씬으로 쪼개고, 씬당 목적을 하나로 제한
- 3단계: 플레이어 개입 지점에 `input` 게이트를 배치해 핵심 단서를 기억 고정
- 4단계: 챕터 파일(`1.yaml`, `2.yaml`...)로 분리해 템포를 관리
- 5단계: 챕터 전환부에 `effect`, `wait`, `music` 전환을 집중 배치

참고:
- 장편 샘플 설계 문서: [SAMPLE_EXPANSION_PLAN.ko.md](<home>/visual-novel/docs/SAMPLE_EXPANSION_PLAN.ko.md)

## 12-3) 자주 놓치는 추가 기능 체크리스트

- `sticker.enter`, `clearSticker.leave`로 등장/퇴장 이펙트까지 제어
- `music`에 YouTube URL 사용 가능(배경음 운영 간편)
- `video`는 로컬 파일/YouTube 모두 사용 가능, 길게 눌러 스킵 지원
- `input`은 축약형(`input: "정답"`)과 상세형(`correct/errors`) 모두 지원
- 캐릭터 감정은 `say.char`와 `char.emotion`을 함께 써야 화면/이름 일관성이 좋아짐
- 모바일 겹침 완화를 위해 주요 발화 캐릭터 중심으로 장면을 구성
- `0.yaml/1.yaml...` 챕터 분리 시 초기 로딩 체감이 좋아짐(지연 로드 + 프리로드)

## 13) 기능 변경 시 문서 업데이트 규칙

새 기능을 개발하거나 기존 동작을 바꿀 때 아래를 반드시 같이 수정합니다.

1. 이 문서의 해당 섹션
2. [README.md](<home>/visual-novel/README.md) 구현 범위/예시
3. 게임 예시 YAML(`public/game-list/<gameId>/*.yaml` 또는 `sample.yaml`)의 실제 사용 예시

권장: 아래 변경 로그를 같이 갱신하세요.

## 14) 문서 변경 로그

- 2026-02-25: 엔딩 UI를 팝업 카드에서 영화식 롤링 크레딧으로 변경하고, 하단 고정 `게임 다시 시작하기` 버튼으로 재시작 흐름을 유지.
- 2026-02-25: `meta.author`를 확장해 문자열과 객체(`name`, `contacts[]`)를 모두 지원하도록 스키마/가이드를 갱신.
- 2026-02-25: `input` 게이트가 활성화되면 입력창이 자동으로 포커스되도록 동작을 추가.
- 2026-02-25: `say.with`를 추가하고 캐릭터 노출 정책을 화자 중심으로 변경. 기본은 `say.char` 1인 노출, `say.with` 지정 캐릭터만 추가 노출, `say.char` 없는 내레이션은 캐릭터를 모두 숨기도록 정리.
- 2026-02-25: 개발 가이드에 AI 기반 제작 동선 추가(읽기 순서, 스토리→YAML 프롬프트 사용법, 초안 후 연출 고도화 절차, 추가 기능 체크리스트).
- 2026-02-25: `say.char`를 생략한 대사에서 기본 `Narration` 라벨을 제거하고, 화자 이름 영역을 비워 표시하도록 동작을 변경.
- 2026-02-25: 홈 런처에 `샘플 파일 다운받기 (ZIP)` 버튼을 추가해 `public/sample.zip`을 바로 내려받아 개발 전 파일 구조를 확인할 수 있도록 수정.
- 2026-02-25: `clearSticker` 객체형(`id`, `leave`)을 추가해 스티커 퇴장 이펙트(`fadeOut`, `wipeLeft`, `wipeRight`)와 지속시간/이징/지연 제어를 지원.
- 2026-02-25: 스티커 등장 이펙트에 `wipeLeft`를 추가.
- 2026-02-25: `sticker.enter` 옵션을 추가해 스티커 등장 이펙트(`fadeIn/scaleIn/popIn/slide/wipe/blur/rotate`)와 지속시간/이징/지연 제어를 지원.
- 2026-02-25: `sticker-layer` 렌더 영역을 다이얼로그 박스 상단까지로 제한해 스티커가 다이얼로그 UI와 겹치지 않도록 조정.
- 2026-02-25: 홈 런처 CTA를 목적별로 분리. `게임 실행해보기 (ZIP 올려서)` 버튼은 ZIP 즉시 실행, `게임 공유하기 (PR)` 버튼은 GitHub PR 생성 페이지 이동으로 정리.
- 2026-02-25: `bgFront`/`clearBgFront`를 제거하고 `sticker`/`clearSticker` 액션으로 대체. 스티커 위치/크기/앵커/회전/투명도/z-index 지정 규칙을 추가.
- 2026-02-25: 런처의 샘플 고정 링크를 제거하고 `public/game-list/` 폴더 기반 동적 게임 리스트 영역을 추가. `/game-list/:gameId` URL 부트 로딩과 `index.json` 매니페스트 생성(`predev`/`prebuild`) 흐름을 문서화.
- 2026-02-25: 게임 리스트 매니페스트 생성 시 대표 YAML의 `meta.title`을 파싱해 런처 표시명으로 사용하도록 수정(미지정 시 폴더명 fallback).
- 2026-02-25: 샘플 장편화 워크플로(스토리 축 설정 → 씬 분해 → input 게이트 배치 → 챕터 분리) 가이드를 추가.
- 2026-02-25: 좌측 상단 HUD 메타에서 챕터 분수(`N/M`) 표기를 제거해 제목만 표시하도록 수정.
- 2026-02-25: 챕터 로딩 UI에 최소 표시 시간(600ms)과 완료 상태 유지 시간(100% 후 200ms)을 추가해 너무 빠르게 닫히는 체감을 완화.
- 2026-02-25: 챕터 로딩 UI 문구에서 `N/M` 표기를 제거하고, 로딩 오버레이가 닫히기 전 100% 상태를 한 프레임 표시하도록 조정.
- 2026-02-25: 챕터 로딩을 지연 방식으로 변경. 시작 시 전체 YAML 파싱 대신 현재 챕터만 파싱하고, 다음 챕터 YAML은 백그라운드 프리로드(파싱 캐시)하도록 수정.
- 2026-02-25: 모바일 발화자 강조(원본/30% 축소) 전환 시 캐릭터 크기 변화에 transform 트랜지션(180ms ease-out)을 추가.
- 2026-02-25: `say.char` 규칙을 `캐릭터ID`/`캐릭터ID.emotion`으로 명확화하고, 파서가 캐릭터/감정 키를 검증하도록 강화. 발화자 표시는 점(`.`) 앞 ID를 사용하도록 정리.
- 2026-02-25: 모바일 캐릭터 강조 동작 추가. `say.char`의 발화자 캐릭터를 최상단(z-index 우선)으로 표시하고, 비발화 캐릭터는 30% 축소해 겹침을 줄이도록 수정.
- 2026-02-25: 캐릭터 강조 로직을 active/inactive 2상태에서 발화자 우선순위(1,2,3...) 기반으로 변경. `say.char`가 발생할 때마다 해당 캐릭터를 1순위로 이동시키고, 화면 z-index도 동일 순서로 정렬하도록 수정.
- 2026-02-25: 화면 캐릭터 정렬 시 동률 처리 보강. 화면에 있는 캐릭터 집합만 대상으로 순위를 재계산하고, 위치 tie-breaker(center > left > right)를 적용해 order 중복을 방지.
- 2026-02-25: YouTube 컷신 모바일 동작 정리(기본 음소거 자동재생, 플레이어 컨트롤 직접 터치 가능), 스킵 가이드 동작 문구를 로컬 영상 기준으로 명확화.
- 2026-02-25: YouTube 컷신 렌더링을 16:9 고정 레터박스로 조정해 모바일 세로 화면에서 좌우 크롭이 발생하지 않도록 수정.
- 2026-02-25: YouTube 컷신 스킵 가이드를 상단 우측으로 이동하고, 홀드 스킵 시작 조건을 보정해 모바일에서 즉시 길게 눌러 건너뛰기가 동작하도록 수정.
- 2026-02-25: 컷신 인터랙션을 기존 방식으로 복원(YouTube 위 인터랙션 레이어, 탭 시 가이드 표시, 하단 중앙 길게 눌러 스킵).
- 2026-02-25: 로컬(mp4) 컷신도 브라우저 자동재생 정책에 맞춰 기본 음소거 자동재생으로 동작하도록 정리.
- 2026-02-25: ZIP 로딩 시 `video.src` 로컬 경로의 blob 치환 누락을 수정해 인트로 컷신(mp4)이 정상 재생되도록 보완.
- 2026-02-25: `input` 스키마를 확장해 `input: "정답"` 축약형과 `errors` 생략/단일 문자열 입력을 허용하도록 수정.
- 2026-02-25: `input` 정답 입력 게이트 문법/동작 추가, 전체 기능 가이드 최초 정리.
- 2026-02-25: 명칭 혼동 방지를 위해 `chat.with`는 미지원이고 `say.with`만 유효하다는 규칙을 `say` 섹션에 명시.
