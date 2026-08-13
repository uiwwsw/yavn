<div align="center">

# YAVN (야븐)

Type your story. Play your novel.

[![Node](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

`YAVN`은 YAML 기반 비주얼노벨 엔진입니다.
현재 DSL은 **YAML V3**이며, 전역/공통/챕터 선언을 분리합니다.

## Quick Start

```bash
pnpm install
pnpm test
pnpm dev
```

- Node: `22.13+` (배포·CI 권장: `22.x`)
- 기본 주소: [http://localhost:5173](http://localhost:5173)

## 품질과 구조

- `src/parser.ts`: YAML V3 파싱, 계층 병합, 상태/에셋/분기 참조 및 scene 종료 안전성 검증
- `src/engine.ts`: 챕터 전환, 저장 슬롯/백업, 새로고침에도 유지되는 선택 복구점, 게임오버·다중 엔딩 재탐색, 장면 단위 무대 카메라, 캐릭터 원본 정렬, 연출 실행, 입력 게이트, 오디오 BGM 크로스페이드
- `src/typing.ts`: 감정별 타이핑 리듬, 문장부호 호흡, 유니코드 글자 분할
- `src/store.ts`: 렌더링 상태와 플레이 기록
- `src/history.ts`: 챕터별 선택 복원과 최대 300개 스토리 로그
- `pnpm test`: 파서 기본값, 저장 호환, 챕터 기록 격리 회귀 테스트
- GitHub Actions: Node 22 + pnpm 11에서 테스트와 프로덕션 빌드 자동 검증
- Vercel: `package.json`의 Node 22.13+·pnpm 11.21 고정을 따르도록 설치와 빌드를 `corepack pnpm`으로 실행
- pnpm 11의 의존성 빌드 허용 목록은 `pnpm-workspace.yaml`의 `allowBuilds`에서 관리하며, 현재 네이티브 설치 스크립트가 필요한 `esbuild`만 허용합니다.
- 보안 하한은 Vite `6.4.3+`, js-yaml `4.3.1+`로 고정하며 잠금 파일 갱신 뒤 `pnpm audit`에서 알려진 취약점이 없어야 합니다.
- Live2D 렌더러는 실제 Live2D 캐릭터가 등장할 때 동적 로딩되어 기본 런처/2D 게임의 초기 번들에서 분리됩니다.
- 런처 캐러셀은 Embla Carousel React 안정판을 사용합니다. 헤더를 제외한 실제 화면 높이에 쇼케이스와 컨트롤을 고정하고, 이동 중에는 게임 선택·SEO·고지 상태를 갱신하지 않으며 이동이 완전히 끝난 뒤 한 번만 반영합니다.
- 게임별 `legalNotices`를 선언하면 작품이나 캐릭터 ID 분기 없이 런처·시작 화면·시스템 설정·엔딩 크레딧에 권리/출처 고지를 공통 노출합니다.
- `JSZip`도 ZIP 프리뷰/실행을 선택할 때만 동적 로딩합니다. 일반 URL 게임과 런처의 메인 번들은 Node 22 프로덕션 기준 `435.04 kB`(`132.18 kB` gzip)이며 ZIP 전용 `97.54 kB` 청크와 분리됩니다.
- 상세 진단과 다음 우선순위: [`docs/IMPROVEMENT_ROADMAP.ko.md`](docs/IMPROVEMENT_ROADMAP.ko.md)

라우팅:
- `/`: YAVN 엔진 소개와 제작 가이드, 대표 게임 쇼케이스, 검색/태그 게임 라이브러리, ZIP 실행
- `/game-list/:gameId`: `public/game-list/<gameId>/` 게임 즉시 실행

## 데이터 처리 구조

게임 실행 코드는 특정 작품이나 캐릭터를 알지 않습니다.

1. URL 게임의 `config.yaml`, `base.yaml`, 챕터 YAML 또는 업로드한 ZIP의 YAML을 `src/parser.ts`가 읽습니다.
2. YAML은 JavaScript 객체로 변환된 뒤 Zod 스키마와 참조 검증을 통과합니다.
3. `src/engine.ts`가 검증된 공통 액션을 실행하고 `src/store.ts` 상태를 갱신합니다.
4. `src/App.tsx`는 게임 ID가 아니라 배경, 캐릭터, 대사, 선택지, 스티커 같은 공통 상태만 렌더링합니다.

루트 게임 목록만 빌드 시 생성된 JSON manifest를 사용합니다. 런타임 소스에 번들 샘플 ID나 샘플 전용 태그 분기가 들어오면 `src/gameIndependence.test.ts`가 실패합니다.

## 런처 메타데이터 (Manifest V5)

런처 게임 목록은 `predev`/`prebuild`에서 `scripts/generate-game-list-manifest.mjs`로 생성되며, 같은 단계에서 `public/sitemap.xml`도 게임 목록 기준으로 자동 재생성됩니다. 이후 `scripts/check-public-allowlist.mjs`로 `public` 허용 목록 검사를 수행합니다.

`public/game-list/index.json` 구조:

```json
{
  "schemaVersion": 5,
  "generatedAt": "2026-02-27T02:15:30.805Z",
  "games": [
    {
      "id": "conan",
      "name": "명탐정 코난 외전: 폭우의 2번 찻잔",
      "path": "/game-list/conan/",
      "author": "uiwwsw",
      "version": "10.7.0",
      "summary": "기념품과 탁구 삼세판을 즐긴 뒤 2번 찻잔과 사라진 1분을 추적하는 캐릭터 중심 추리 에피소드",
      "thumbnail": "/game-list/conan/assets/bg/title_storm-v2.avif",
      "tags": ["detective", "sample"],
      "showcase": {
        "label": "FEATURED DEMO",
        "image": {
          "positionX": 50,
          "positionY": 42,
          "scale": 1.05
        }
      },
      "legalNotices": [
        {
          "id": "detective-conan-noncommercial-fan-demo",
          "title": "비공식·비상업적 팬 데모",
          "text": "이 작품은 엔진 기능 검증용 비공식·비상업적 팬 데모이며 공식 작품이 아닙니다.",
          "copyright": "관련 명칭·캐릭터와 원작 요소의 권리는 각 권리자에게 있습니다."
        }
      ],
      "chapterCount": 10,
      "seo": {
        "title": "명탐정 코난 외전: 폭우의 2번 찻잔",
        "description": "폭우에 고립된 료칸에서 벌어지는 분기형 추리 비주얼노벨",
        "keywords": ["명탐정 코난", "추리 게임", "비주얼노벨"],
        "image": "/game-list/conan/assets/bg/case_board.avif",
        "imageAlt": "다실 사건 단서 보드"
      }
    }
  ],
  "seo": {
    "title": "야븐엔진 (YAVN) 게임 목록",
    "description": "야븐엔진(YAVN)에서 플레이 가능한 게임 목록",
    "keywords": ["명탐정 코난 외전: 폭우의 2번 찻잔", "detective", "sample"],
    "gameTitles": ["명탐정 코난 외전: 폭우의 2번 찻잔"],
    "gameCount": 1
  }
}
```

- 하위 호환: 런처는 V1(`id/name/path`) manifest도 읽을 수 있습니다.
- `name`은 `config.yaml.title` 우선, 없으면 레거시 챕터 `meta.title`, 그다음 폴더명 기반 titleize를 사용합니다.
- `chapterCount`는 하위 폴더를 포함한 챕터 YAML 수(`config/base/launcher 제외`)를 기록합니다.
- `games[].seo`는 `config.yaml.seo`(+ `launcher.yaml.summary/tags` fallback)에서 생성되며, 런처/게임 페이지 메타 태그와 JSON-LD에 사용됩니다.
- `games[].legalNotices`는 `config.yaml.legalNotices`에서 생성되며, 런처가 게임별 권리 고지를 선택한 작품에만 데이터 기반으로 표시합니다.
- `pnpm build`는 manifest의 모든 게임에 대해 `dist/game-list/<gameId>/index.html`을 생성합니다. 따라서 `/game-list/<gameId>/`를 직접 연 검색 봇·공유 봇도 JavaScript 실행 전부터 게임 제목, 설명, canonical, Open Graph, Twitter Card, `VideoGame` JSON-LD를 받습니다.
- 공유 대표 이미지는 크롤러 호환성을 위해 16:9 JPEG 또는 PNG를 권장합니다. 게임 화면용 AVIF/WebP와 `seo.image`를 분리해도 됩니다.
- 루트 `seo`는 게임 제목 목록을 집계해 런처(루트 `/`) SEO 설명/키워드에 반영됩니다.
- `sitemap.xml`의 `/game-list/<gameId>/` URL 목록도 같은 prebuild 단계에서 `games[].path` 기반으로 자동 생성됩니다.

게임별 선택 메타(`public/game-list/<gameId>/launcher.yaml`, 선택):

```yaml
summary: "게임 카드와 대표 쇼케이스에 표시할 설명"
thumbnail: "assets/bg/cover.png"
tags:
  - detective
  - live2d
showcase:
  label: "FEATURED DEMO"
  backgroundColor: "#171b24"
  image:
    positionX: 50
    positionY: 42
    scale: 1.05
    offsetX: 0
    offsetY: 0
```

- 이 파일은 런처 전용이며 엔진 DSL(`config/base/chapter`) 파서와 분리됩니다.
- `thumbnail`은 상대 경로일 때 `/game-list/<gameId>/...`로 정규화됩니다.
- `launcher.yaml.thumbnail`이 없고 `config.yaml.startScreen.image`가 있으면, manifest 생성 시 해당 이미지를 쇼케이스/게임 카드 기본 썸네일로 사용합니다.
- `showcase`는 게임 ID나 태그에 의존하지 않고 캐러셀 문구와 썸네일 구도를 선언합니다. 위치는 `0..100`, 배율은 `0.5..2`, 오프셋은 `-50..50` 범위로 정규화됩니다.

## 게임별 법적 고지

`config.yaml`의 선택 필드 `legalNotices`는 제3자 소프트웨어, 캐릭터, 샘플 모델, 글꼴 등 게임별 출처와 이용 조건을 플레이어에게 공개합니다. 엔진은 게임 ID나 태그를 검사하지 않고 같은 렌더러를 사용하므로 URL 게임과 ZIP 게임 모두 동일하게 동작합니다.

```yaml
legalNotices:
  - id: third-party-character
    title: "제3자 캐릭터 고지"
    copyright: "© Example Rights Holder"
    text: "이 게임에서 사용하는 제3자 캐릭터의 출처와 이용 조건을 설명합니다."
    links:
      - label: "공식 이용 조건"
        href: "https://example.com/license"
```

- `id`, `title`, `text`는 필수이고 `copyright`, `links`는 선택입니다. `id`는 게임 안에서 고유해야 합니다.
- 링크는 안전한 `http` 또는 `https` URL만 허용합니다. 게임당 고지는 최대 12개, 고지당 링크는 최대 8개입니다.
- 고지는 런처 대표 슬라이드와 카드 배지, 시작 게이트, 게임 시스템 탭, 엔딩 크레딧에 표시됩니다.
- 고지 문구는 이용 허락을 새로 만들지 않습니다. 실제 라이선스/권리 조건을 확인하고 필요한 계약·허락을 별도로 받아야 합니다.
- 저장소 전체 고지는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), Live2D 관련 원문 사본은 `assets/licenses/live2d/`, SUITE OFL 전문은 `assets/licenses/fonts/LICENSE`에 있습니다.

## Public 최소화 정책

- URL 실행 호환을 위해 `public/game-list/**`는 배포 공개 경로로 유지합니다.
- `public` 루트 허용 파일은 `favicon.svg`, `robots.txt`, `sitemap.xml`입니다.
- 위 경로를 제외한 파일이 `public`에 추가되면 `pnpm run check:public`에서 빌드를 실패시킵니다.
- 게임 외 원본/문서/라이선스/아카이브 파일은 저장소 루트 `assets/`로 관리합니다.

## YAML V3 구조 (필수)

### 1) 루트 `config.yaml` (필수)

```yaml
title: "게임 제목"
author:
  name: "작성자"
  contacts:
    - "Email: writer@example.com"
version: "1.0"
seo:
  description: "검색/공유용 게임 설명"
  keywords:
    - 추리
    - 비주얼노벨
  image: assets/bg/cover.png
  imageAlt: "대표 이미지 설명"
textSpeed: 38 # 초당 글자 수(CPS), 숫자가 클수록 빠름
autoSave: true
clickToInstant: true
ui:
  template: cinematic-noir # cinematic-noir | neon-grid | paper-stage
startScreen:
  enabled: true
  image: assets/bg/title.png
  music: assets/music/intro.mp3
  showTitle: true
  titleColor: "#ffe0a3"
  startButtonText: 시작하기
  buttonPosition: auto
endingScreen:
  image: assets/bg/ending.png
endings:
  true_end:
    title: "TRUE END"
  bad_end:
    title: "BAD END"
endingRules:
  - when:
      var: score
      op: gte
      value: 3
    ending: true_end
defaultEnding: bad_end
```

### 2) 폴더 `base.yaml` (선택, 계층 병합)

```yaml
assets:
  backgrounds:
    hall: assets/bg/hall.png
  characters:
    conan:
      base: assets/char/conan/base.webp
      calibration: { scale: 1.04, y: -1 }
      emotions:
        serious: assets/char/conan/serious.webp
  music:
    mystery: assets/music/mystery.wav
  sfx:
    door: assets/sfx/door.wav
state:
  score: 0
  suspect: ""
inventory:
  clue_note:
    name: "현장 메모"
    description: "탐문 중 확인한 단서를 정리한 메모다."
    image: assets/bg/case_board.avif
    category: "수사자료"
    order: 10
```

### 3) 챕터 YAML (`1.yaml`, `routes/a/1.yaml` 등)

```yaml
assets: # 선택
  characters:
    guest:
      base: assets/char/guest/base.png

script:
  - scene: intro

scenes:
  intro:
    actions:
      - bg: hall
      - camera: wide
      - char:
          id: conan
          position: center
      - say:
          char: conan
          camera: medium
          text: "시작"
```

## V3 계약 요약

- `config.yaml`은 게임 루트에 **필수**입니다.
- `config.yaml` 전용 필드:
  - `title`, `author`, `version`, `seo`
  - `textSpeed`, `autoSave`, `clickToInstant`
  - `ui` (`template`: `cinematic-noir` | `neon-grid` | `paper-stage`)
  - `startScreen` (`enabled`, `image`, `music`, `showTitle`, `titleColor`, `startButtonText`, `buttonPosition`)
  - `endingScreen` (`image`)
  - `endings`, `endingRules`, `defaultEnding`
- `seo` 하위 필드:
  - `description` (string)
  - `keywords` (string[])
  - `image` (string, 상대 경로/절대 URL)
  - `imageAlt` (string)
- `base.yaml` 허용 필드: `assets`, `state`, `inventory`
- 챕터 YAML 허용 필드:
  - 필수: `script`, `scenes`
  - 선택: `assets`, `state`, `inventory`
- `meta/settings` 레거시 포맷은 지원하지 않습니다.

## 병합 규칙

레이어 순서:
- `config.yaml`
- 루트 `base.yaml`
- 하위 폴더 `base.yaml` (상위 -> 하위)
- 챕터 YAML

우선순위:
- 자식 우선
- `assets`는 카테고리 키 단위 병합
- `state`는 키 단위 병합, 동일 키 타입 충돌 시 에러
- `inventory`는 아이템 키 단위 병합(자식 레이어가 같은 키를 덮어씀)
- 작성 DSL은 `state` 평면 맵을 사용하며, 런타임 내부에서는 `state.defaults`로 정규화됩니다.
- 작성 DSL은 `inventory` 평면 맵을 사용하며, 런타임 내부에서는 `inventory.defaults`로 정규화됩니다.
- `script/scenes`는 챕터 YAML만 사용
- `endings/endingRules/defaultEnding`은 `config.yaml`만 사용
- `ui.template`은 `config.yaml`만 사용하며, 미지정 시 `cinematic-noir`가 기본값으로 적용됩니다.
- `startScreen`은 객체를 선언하면 기본적으로 활성화되며(`enabled` 기본 `true`), 필드를 생략하면 `showTitle=true`, `startButtonText=시작하기`, `buttonPosition=auto`가 적용됩니다.
- 타이틀 이미지 자체에 게임명이 포함되어 있으면 `showTitle: false`로 엔진 제목 오버레이를 숨길 수 있습니다. SEO 제목과 접근 가능한 문서 제목은 그대로 유지됩니다.
- `startScreen.titleColor`에는 `#ffe0a3`, `rgb(...)`, `oklch(...)` 같은 CSS 색상을 지정할 수 있습니다. 미지정 시 선택한 `ui.template`의 기본 제목색을 사용합니다.
- `startScreen.music`은 시작 게이트에서만 반복 재생되며, 게임 시작/이어하기 버튼을 누르면 정지됩니다.
- 서로 다른 로컬 오디오 `music` 액션은 약 420ms 동안 크로스페이드됩니다. 같은 곡을 다시 지정하면 재시작하지 않으며, BGM 끄기와 초기화면 이동은 즉시 정지합니다.
- `endingScreen.image`를 지정하면 엔딩 크레딧 오버레이의 배경 이미지를 교체합니다.

## UI 템플릿 (`config.yaml.ui.template`)

- 게임 플레이 UI(챕터 로딩, 다이얼로그, HOLD TO SKIP, `choice/input`, 엔딩 크레딧)와 시작 게이트 타이틀/버튼은 전역 템플릿 1개로 스타일링됩니다.
- 허용 값:
  - `cinematic-noir`: 저채도 다크 + 골드 포인트
  - `neon-grid`: 네온 HUD 톤 + 고대비 포커스
  - `paper-stage`: 따뜻한 페이퍼/잉크 톤
- `ui`를 생략하면 기본 템플릿 `cinematic-noir`를 사용합니다.
- 시작 게이트에서는 `시작하기` 버튼과 URL 게임의 `이어하기` 버튼이 동일 템플릿 토큰으로 함께 스타일링됩니다.

## 경로 규칙

- `/...`: 게임 루트 기준
- `root:/...`: 같은 배포의 `public` 루트 기준. 여러 게임이 공유하는 에셋에 사용
- `./...`, `../...`: 선언 YAML 파일 위치 기준
- `assets/...` 같은 bare 경로: 선언 YAML 파일 위치 기준
- 내부적으로 asset/video 경로는 게임 루트 기준 canonical key로 정규화됩니다.

## 지원 액션

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
- `set`
- `add`
- `get`
- `use`
- `choice`
- `branch`
- `ending`
- `gameOver`

## 저장과 불러오기

- 진행 데이터는 URL 게임 ID 또는 ZIP 파일명/크기로 분리한 `localStorage`에 저장합니다. `autoSave`는 첫 실행 기본값이며 플레이어가 시스템 탭에서 언제든 켜고 끌 수 있습니다.
- 자동 저장은 선택 직전 위치를 계속 덮어쓰는 내부 복구점입니다. 일반 저장 화면에서는 상태와 시각만 표시하고 별도 불러오기 슬롯으로 노출하지 않습니다.
- 선택을 확정할 때는 일반 자동저장과 별도로 `:choice-recovery` 복구점을 먼저 기록합니다. 자동저장이 켜져 있으면 실패 후일담 도중 새로고침해도 원래 선택으로 돌아갈 수 있고, 꺼져 있어도 현재 실행 세션에서는 직전 선택 복구가 유지됩니다.
- 사용자가 직접 관리하는 작업은 수동 저장/불러오기, 챕터 처음으로 돌아가기, JSON 백업 내보내기/불러오기로 분리합니다. 챕터 시작점은 자동 저장을 꺼도 항상 갱신됩니다.
- 백업 파일에는 진행 상태만 포함되며 게임 YAML과 에셋은 포함되지 않습니다. 브라우저 다운로드 위치는 브라우저/운영체제 설정을 따릅니다.
- 기존 `vn-engine-autosave` 및 게임별 autosave 데이터는 그대로 읽습니다. 새 메타가 없는 저장도 하위 호환으로 복원하되, 현재 챕터에 선언된 상태의 타입이 달라진 값은 최신 기본값으로 안전하게 정규화합니다. 다른 챕터에서 다시 쓸 상태/아이템은 현재 챕터에 잠시 선언되지 않아도 보존합니다.

## `gameOver` 액션

`gameOver`는 엔딩 수집과 별개의 실패 상태입니다. 액션으로 직접 실행하거나 선택지 옵션에 선언할 수 있습니다.

```yaml
- choice:
    prompt: "어느 전선을 자를까?"
    options:
      - text: "파란 전선"
        goto: escaped
      - text: "붉은 전선"
        gameOver:
          title: "GAME OVER"
          message: "경보가 울렸다. 저장한 시점에서 다시 시도하자."
```

게임오버 화면은 별도 선택 복구점을 우선 쓰는 `직전 선택으로`, `수동 저장으로`, `챕터 처음으로`, 백업 파일 불러오기를 제공합니다. 같은 옵션에 `goto`와 `gameOver`를 동시에 선언할 수 없습니다.

선택지가 `goto`로 별도 후일담 scene에 들어간 뒤 독립 `gameOver` 액션에 도달해도, 선택 복구점은 실패 scene이 아니라 그 분기를 시작한 선택지를 유지합니다. 이 복구점은 일반 자동저장과 분리되어 긴 실패 장면 중 페이지를 새로고침해도 덮어쓰이지 않습니다.

## 화면 이펙트

문자열 `effect` 액션은 기존과 같이 이름에 대응하는 짧은 전체 화면 연출을 실행하고 바로 다음 액션으로 진행합니다.

```yaml
- effect: impact
```

| 이름 | 지속시간 | 화면 반응 | 권장 용도 |
| --- | ---: | --- | --- |
| `shake` | 280ms | 화면 흔들림 | 충돌, 비명, 강한 반박 |
| `flash` | 350ms | 흰색 섬광 | 번개, 컷 전환, 순간 충격 |
| `zoom` | 420ms | 짧은 확대 | 단서 발견, 시선 집중 |
| `blur` | 420ms | 배경·인물·대사 흐림 | 혼란, 기억 전환 |
| `darken` | 500ms | 검은 오버레이 | 불안, 장면의 온도 전환 |
| `pulse` | 500ms | 밝기 맥동 | 결심, 장면 마침표 |
| `tilt` | 320ms | 화면 기울기 | 오답, 불안정한 판단 |
| `impact` | 460ms | 확대 충격 + 중심 버스트 | 트레일러 타격점 |
| `glitch` | 520ms | RGB/스캔라인 흔들림 | 신호 오류, 디지털 교란 |
| `speedlines` | 680ms | 중심 방사형 속도선 | 추격, 급가속 |
| `alarm` | 760ms | 적색 경보 맥동 | 제한시간, 위험 경고 |
| `focus` | 620ms | 중심을 남기는 비네트 | 추리 대상, 단서 조준 |
| `moonveil` | 900ms | 차가운 달빛 비네트 | 야간 궁중, 고요한 결단 |
| `embers` | 1100ms | 위로 흩어지는 불씨 | 화재, 연회 등불, 무너지는 기록 |
| `crown` | 1200ms | 금빛 방사광과 비네트 | 즉위, 맹세, 최종 결단 |

- 알 수 없는 CSS-safe 이름(`영문자로 시작, 영문/숫자/_/-`)은 상태 클래스만 약 `350ms` 적용되므로 게임별 CSS 확장도 가능합니다.
- `effect`는 대기 액션이 아니며 연속 선언하면 뒤 이펙트가 앞 이펙트를 교체합니다. 순서대로 보여 주려면 사이에 짧은 `wait`를 둡니다.
- 연출 자체가 끝나기 전에 다음 대사나 선택을 열고 싶지 않다면 옵션형 `effect`의 `wait: true`를 사용합니다. 이때 해당 프리셋의 실제 지속시간 동안 진행 입력을 잠그고, 같은 효과를 연속 선언해도 각 재생 사이에 한 렌더 프레임을 보장합니다.
- 전체 화면 변형은 문서 루트가 아니라 `.app` 내부의 클리핑된 `.effect-viewport`에만 적용됩니다. `shake/zoom/tilt/impact`가 뷰포트 밖의 스크롤 영역을 만들지 않으며, CASE FILE·긴 선택지·대사창의 내부 스크롤은 영향을 받지 않습니다.
- `prefers-reduced-motion` 환경에서는 비필수 움직임을 제거합니다.

```yaml
- effect: flash
- wait: 140
- effect: darken
- wait: 180
- effect: shake
```

```yaml
- effect:
    name: impact
    wait: true
- say:
    text: "충격이 가라앉은 뒤에만 이 대사가 열린다."
```

## `sticker.inputLockMs` (입력 잠금)

`sticker` 액션에 `inputLockMs`를 주면, 스티커를 띄운 뒤 지정한 시간(ms) 동안 입력/선택 제출이 잠깁니다.

```yaml
- sticker:
    id: item_popup
    image: item_tea_residue_report
    width: 22
    y: 30
    inputLockMs: 500
```

동작:
- `inputLockMs` 동안 `input` 제출과 `choice` 선택이 비활성화됩니다.
- 잠금 시간이 끝나면 다음 액션으로 자동 진행됩니다.

참고:
- `sticker.enter.duration`, `clearSticker.leave.duration` 사용자 지정은 제거되었습니다.
- 스티커 이펙트 시간은 엔진 기본값(enter `280ms`, leave `220ms`)을 사용하며, `effect/easing/delay`만 지정할 수 있습니다.

## `inventory` + `get/use` 아이템 흐름

`state`와 분리된 아이템 가방 상태를 `inventory`로 선언하고, 액션으로 획득/사용할 수 있습니다.

```yaml
inventory:
  clue_note:
    name: "현장 메모"
    description: "탐문 중 확인한 단서를 정리한 메모다."
    image: assets/bg/case_board.avif

scenes:
  intro:
    actions:
      - branch:
          cases:
            - when:
                var: clue_note
                op: eq
                value: true
              goto: already_has_note
          default: get_note
  get_note:
    actions:
      - get: clue_note
      - say:
          text: "현장 메모를 챙겼다."
      - goto: next_scene
  already_has_note:
    actions:
      - say:
          text: "현장 메모는 이미 확보했다."
      - goto: next_scene
  next_scene:
    actions:
      - use: clue_note
```

동작:
- `get: <itemId>`: 해당 아이템을 가방에 추가(`true`)
- `use: <itemId>`: 해당 아이템을 사용 처리(`false`)
- `when.var`는 `state` 변수뿐 아니라 `inventory` 아이템 키도 직접 참조할 수 있습니다.
- 인벤토리 기본 소지값은 항상 `false`(미획득)이며, `get/use`로만 변경됩니다.
- `inventory.<item>.category`(선택): 인벤토리 카테고리 필터 기준값입니다. 미지정 시 UI에서 `기타`로 처리합니다.
- `inventory.<item>.order`(선택): 정렬 기준 우선순위(낮을수록 먼저)입니다. 미지정 시 `9999`로 처리합니다.

## 장면 카메라와 캐릭터 원본 정렬

`calibration`은 원본 에셋의 크기와 여백 차이만 정리합니다. 전신·상반신·클로즈업은 캐릭터마다 확대하지 않고, 현재 보이는 인물이 들어 있는 하나의 무대 카메라로 연출합니다.

```yaml
assets:
  characters:
    deokman:
      base: assets/char/deokman.webp
      facing: left # 원본이 바라보는 방향: left | right | front
      calibration: { scale: 1.06, x: 0, y: -2, spacing: 0.98 }
    king:
      base: assets/char/king.webp
      facing: right
      calibration: { scale: 1 }

scenes:
  audience:
    actions:
      - camera: wide
      - char: { id: deokman, position: left }
      - char: { id: king, position: right }
      - say:
          char: deokman
          camera: medium
          text: "전하께 드릴 말씀이 있습니다."
      - camera:
          shot: reaction
          target: king
          transition: pan
          duration: 460
      - choice:
          char: deokman
          camera: close
          prompt: "왕이 잔을 든다. 지금 막을까?"
          options:
            - { text: "대신 마신다", goto: drink }
            - { text: "상을 엎는다", goto: stop }
```

- `camera`는 독립 액션과 `say/choice/input.camera`에서 모두 사용할 수 있습니다. `wide | medium | close | reaction` 문자열 축약과 객체형을 지원합니다.
- `wide`는 전신 그룹 숏, `medium`은 보이는 인물을 함께 확대하는 상반신 그룹 숏, `close`는 화자를 중심으로 이동하는 단독 클로즈업, `reaction`은 지정한 듣는 인물의 반응 숏입니다.
- 객체형 `target`은 `group | speaker | 캐릭터ID`, `transition`은 `cut | push | pan`, `duration`은 `0..3000ms`입니다. 생략 시 숏에 맞는 대상과 `0/520/380ms` 기본 전환을 사용합니다.
- 여러 인물이 보이는 `close`의 비즉시 전환은 전체 `duration` 안에서 비대상 인물을 먼저 최대 160ms 동안 페이드한 뒤 숨기고, 남은 시간에 카메라 확대를 실행합니다. 따라서 퇴장 중인 인물이 확대와 함께 화면 가장자리에서 반만 남는 현상을 막으며, 1인 `close`와 `cut`은 지연하지 않습니다.
- 직전 `close/reaction` 뒤에 화자와 명시 대상이 없는 내레이션이 이어지면, 엔진은 직전 인물로 다시 당기지 않고 현재 보이는 인물을 실제 `medium` 그룹 구도로 보여 줍니다. 이때 확대값뿐 아니라 포커스·주변 인물 노출 규칙도 `medium`으로 함께 전환됩니다. 내레이션에서도 특정 인물을 계속 잡아야 한다면 같은 `say.camera.target`에 캐릭터 ID를 명시합니다.
- 배경이 바뀌는 지점에는 `camera: wide`, 본론 대화에는 `camera: medium`, 감정의 결정적 순간에만 `camera: close`를 권장합니다. 같은 카메라를 반복 선언해도 화면이 다시 마운트되지 않습니다.
- 같은 캐릭터 슬롯·화자 순서·`with` 노출 집합·카메라 상태를 연속 대사가 다시 선언하면 스토어는 동일 상태를 그대로 재사용합니다. 표정·구도·대상이 실제로 바뀌지 않은 대사 때문에 캐릭터 진입이나 카메라 전환이 재시작되지 않습니다.
- 대사 글자가 타이핑되거나 대화창 높이가 달라져도 캐릭터 무대는 움직이지 않습니다. 인물 이동은 명시적인 `char.position` 또는 실제로 쇼트가 달라지는 `camera` 지시가 있을 때만 일어납니다.
- `calibration.scale`은 `0.5..2`, `x/y`는 `-30..30`이며, 쇼트 확대와 별도로 원본의 발·눈높이 차이만 보정합니다. 보정 확대는 원본 캔버스의 위가 아니라 무대 바닥을 원점으로 삼으므로 체형과 캔버스 비율이 달라도 발이 뜨거나 아래로 밀리지 않습니다. `spacing`(`0.75..1.25`)은 PC 앙상블에서 해당 에셋의 실루엣 폭에 맞춰 중앙으로부터의 최대 간격을 조절합니다. 기본값은 모두 `1`입니다.
- `facing`은 원본 이미지가 바라보는 방향(`left`, `right`, `front`)입니다. 좌우 대화 구도에서는 화면 안쪽을 보도록 자동 반전하고, 혼자 중앙에 나온 컷은 원본 시선을 유지합니다. 생략하거나 `front`이면 반전하지 않습니다.
- 기존 `defaultFraming/framings`와 `char/say/choice/input.framing`은 하위 호환용으로 계속 지원하지만, 새 작품은 장면 카메라를 권장합니다.

## 대사 속도 체계

- `config.yaml.textSpeed`와 `<speed=...>` 값의 단위는 초당 출력 글자 수(CPS)입니다. `32`는 감정·문장부호 보정 전 기준으로 한글 음절 약 32개를 1초에 출력한다는 뜻입니다.
- 숫자가 클수록 빠르고 작을수록 느립니다. 일반 대사는 `22~38`, 짧은 외침은 `40~60`, 망설임은 `16~22` 정도를 출발점으로 권장합니다.
- 엔진은 UTF-16 코드 단위가 아니라 grapheme 단위로 출력하므로 한글 음절, 결합 문자, 이모지가 중간에서 쪼개지지 않습니다.
- 실제 글자 지연은 대략 `1000 / (CPS × delivery 배율 × 감정 흔들림)`이며 16~900ms로 제한됩니다. 공백은 일반 글자의 62% 시간만 사용합니다.
- 쉼표·마침표·말줄임표·줄바꿈 뒤에는 `delivery`별 추가 호흡이 붙습니다. 따라서 같은 CPS라도 감정 프로필과 문장부호에 따라 실제 완성 시간은 달라집니다.
- `<speed>` 구간은 전역 `textSpeed`를 덮어쓰지만 `delivery` 배율·호흡은 그대로 적용됩니다.

## `say.delivery` 감정형 타이핑

`say.delivery`는 대사의 타이핑 리듬과 마지막 입력 글자의 시각 반응을 지정합니다.

```yaml
- say:
    char: 레이코.nervous
    delivery: whisper
    text: "그걸... 어디서 확인했죠?"
```

| 값 | 속도 배율 | 쉼표 | 문장 끝 | 말줄임표 | 성격 |
| --- | ---: | ---: | ---: | ---: | --- |
| `neutral` | 1.00× | 80ms | 150ms | 280ms | 기본 호흡 |
| `calm` | 0.90× | 110ms | 190ms | 330ms | 여유 있고 정돈됨 |
| `nervous` | 1.02× | 115ms | 210ms | 480ms | 글자 간격이 크게 흔들림 |
| `angry` | 1.20× | 55ms | 105ms | 210ms | 빠르고 강함 |
| `whisper` | 0.76× | 125ms | 220ms | 420ms | 낮고 조심스러움 |
| `shout` | 1.34× | 40ms | 80ms | 170ms | 가장 빠르고 강한 반응 |
| `sad` | 0.70× | 145ms | 260ms | 560ms | 가장 느리고 긴 여운 |
| `deduction` | 0.94× | 105ms | 205ms | 360ms | 흔들림 없는 추리 호흡 |

동작:
- `assets.characters.<id>.defaultDelivery`로 인물의 평상시 말하기 리듬을 선언할 수 있습니다.
- `delivery`를 생략하면 `say.char`의 표정 또는 현재 화면에 표시된 화자의 표정에서 먼저 자동 추론하고, 표정 연결이 없으면 화자의 `defaultDelivery`를 사용합니다.
- 자동 연결 예: `serious/think -> deduction`, `angry -> angry`, `nervous/worried/scared -> nervous`, `surprised -> shout`.
- 우선순위는 `say.delivery` -> 표정 자동 추론 -> 캐릭터 `defaultDelivery` -> `neutral`입니다. 명시한 `delivery`는 인물 없는 내레이션에도 사용할 수 있습니다.
- 감정별 기본 속도, 속도 흔들림, 쉼표·마침표·말줄임표 뒤의 정지가 함께 적용됩니다.
- 마지막 입력 글자의 색·잔광은 UI 템플릿을 따릅니다. `paper-stage`의 `angry/shout/sad/deduction`은 붉은 인주·먹 번짐·금갈색 잉크를 사용하고, 기본 시네마틱은 호박색·불꽃색, `neon-grid`는 청록·자홍 계열 발광을 사용합니다.
- `<speed=...>`와 함께 사용하면 인라인 속도를 기준으로 감정 프로필을 추가 적용합니다.
- `prefers-reduced-motion` 환경에서는 글자 애니메이션을 제거하되 타이핑 호흡은 유지합니다.

## `say` 인라인 속도 태그 (`<speed=...>`)

`say.text` 안에서 여러 속도 구간을 섞어 한 문장 내부 템포를 조절할 수 있습니다.

```yaml
- say:
    char: 코난.serious
    text: "<speed=26>어이...</speed> <speed=54>그건 함정이야.</speed> <speed=90>지금 당장 멈춰!</speed>"
```

동작:
- `<speed=숫자>...</speed>` 구간만 해당 속도로 타이핑됩니다.
- 같은 `say`에 여러 구간이 있으면 순서대로 각기 다른 속도가 적용됩니다.
- 태그 밖 텍스트는 `config.yaml.textSpeed` 기본값을 사용합니다.

## `say.wait` (대사 스킵 잠금)

`say` 액션에 `wait`(ms)를 지정하면, 해당 대사가 시작된 시점부터 지정 시간 동안 진행/스킵 입력이 잠깁니다.

```yaml
- say:
    char: 코난.serious
    text: "멈춰. 지금은 섣불리 움직이면 안 돼."
    wait: 900
```

동작:
- `wait` 시간 동안 클릭/`Enter`/`Space` 진행 입력이 무시됩니다.
- 잠금이 끝나면 기존 `say` 동작처럼 다음 입력을 받을 수 있습니다.

## `say.unskippable` (타이핑 완료 전 진행 금지)

끝까지 읽혀야 하는 문장은 `unskippable: true`로 선언할 수 있습니다.

```yaml
- say:
    char: 코난.serious
    text: "이 말만은 끝까지 들어 줘."
    unskippable: true
```

동작:
- 글자가 타이핑되는 동안 클릭/`Enter`/`Space` 입력으로 즉시 완성하거나 다음 액션으로 진행할 수 없습니다.
- 타이핑이 끝나면 잠금이 자동 해제되고, 평소처럼 다음 입력으로 진행할 수 있습니다.
- `wait`를 함께 쓰면 타이핑 완료와 지정 시간 경과 조건을 모두 만족해야 합니다.
- `autoAdvance` 시간이 먼저 끝나도 문장을 자르지 않고, 타이핑 완료 직후 자동 진행합니다.

## `say.autoAdvance` (대사 자동 진행)

`say` 액션에 `autoAdvance`(ms)를 지정하면 입력이 없어도 해당 시간이 지난 뒤 다음 액션으로 진행합니다.

```yaml
- say:
    char: 코난.serious
    text: "남은 시간 7초."
    autoAdvance: 2000
```

동작:
- 타이핑 중이어도 설정 시간이 끝나면 문장을 완료하고 다음 액션을 실행합니다.
- `wait`와 함께 쓰면 둘 중 더 긴 시간이 지난 뒤 진행합니다.
- 플레이어가 먼저 수동 진행하면 예약된 자동 진행은 취소됩니다.

## `choice` 1회 유예(옵션별 지정)

`choice`에서 잘못 누른 선택지를 1회 유예하는 동작을 옵션별로 지정할 수 있습니다.

- `choice.forgiveOnceDefault`: 해당 choice의 옵션 기본값
- `choice.forgiveMessage`: 기본 유예 안내 문구
- `choice.options[].forgiveOnce`: 개별 옵션 override
- `choice.options[].forgiveMessage`: 개별 옵션 유예 안내 문구

```yaml
- choice:
    key: suspect_pick
    prompt: "용의자를 고르자."
    forgiveOnceDefault: true
    forgiveMessage: "이번 한 번은 넘어갈게. 다시 골라."
    options:
      - text: "아직 더 조사한다"
        forgiveOnce: false
        goto: route_select
      - text: "지금 결론으로 간다"
        goto: bad_branch
```

동작:
- 유예가 활성화된 옵션은 첫 클릭에서 `goto/set/add`를 실행하지 않고 문구만 표시합니다.
- 같은 옵션을 다시 선택하면 원래 분기(`goto/set/add`)가 실행됩니다.

## `choice` 제한시간

`choice.timeoutMs`로 선택 가능 시간을 지정하고, 만료 시 실행할 옵션을 `timeoutOptionIndex`로 고를 수 있습니다.

```yaml
- choice:
    prompt: "어느 신호를 끊을까?"
    timeoutMs: 7000
    timeoutOptionIndex: 0
    options:
      - text: "가짜 정지 신호"
        goto: control_room
      - text: "기관실 주 전원"
        goto: wrong_turn
```

동작:
- 제한시간 UI는 초 단위 값과 남은 시간을 나타내는 진행 바로 표시됩니다.
- `timeoutOptionIndex` 기본값은 첫 옵션(`0`)이며, 선언한 옵션 범위를 벗어나면 파싱 단계에서 오류로 중단합니다.
- 시간 만료 선택은 흐름 정지를 피하기 위해 `forgiveOnce` 유예를 건너뛰고 즉시 실행합니다.

## `choice`/`input`에서 캐릭터 노출

`say` 없이도 `choice`/`input` 단계에서 캐릭터를 직접 노출할 수 있습니다.

- `choice.char`, `choice.with`
- `choice.camera`
- `choice.framing`
- `input.char`, `input.with`
- `input.camera`
- `input.framing`

```yaml
- choice:
    prompt: "이리저리 클릭 드래그해보며 Live2D 테스트해보세요."
    char: 렌.Idle
    camera: medium
    options:
      - text: "테스트 끝"
        goto: ren_live2d_drag_test
```

동작:
- `char`를 지정하면 해당 캐릭터를 기준으로 노출/표정이 동기화됩니다.
- `with`를 생략하면 현재 `char` 액션으로 무대에 배치된 인물을 모두 유지합니다. 대화 상대가 화자마다 사라지지 않으며, 화자가 없는 내레이션도 먼저 세운 인물들을 함께 보여 줍니다.
- `with`를 명시하면 화자와 목록에 적은 보조 캐릭터만 노출합니다. `with: []`는 화자 단독 컷이며, 화자 없는 내레이션의 `with: []`는 빈 무대를 뜻합니다.
- `char`로 배치됐다는 사실은 같은 카메라에 보여도 된다는 뜻이 아닙니다. 숨은 인물, 문 반대편 인물, 멀리 떨어진 인물이 있는 장면은 대사마다 `with`를 명시해 시점별 화면을 분리하고, 실제로 마주친 뒤에만 앙상블로 합칩니다.
- `camera`는 해당 단계에서 무대 전체 쇼트와 대상을 함께 바꿉니다.
- `framing`은 `char`로 지정한 주 캐릭터의 등록된 구도 프리셋을 적용합니다.
- `char`를 생략하면 대사 화자는 없지만 현재 무대의 앙상블은 유지합니다.

## `script` 실행 의미

- `script`는 챕터의 기본 scene 진행 순서입니다.
- 같은 scene을 `script`에 두 번 선언할 수 없습니다. 런타임이 `indexOf` 기반 다음 순서를 잘못 계산하는 구성을 파서가 차단합니다.
- 엔진은 `script[0]`에서 시작하고, 현재 scene의 action을 모두 소비하면 `script`의 다음 scene으로 이동합니다.
- `goto: scene_id`는 scene 점프입니다. 점프한 scene이 끝나면 그 scene의 `script` 위치 다음 scene으로 이어집니다.
- `goto: ./...` 또는 `goto: /...`는 챕터 점프입니다.
- `script` 밖의 분기 전용 scene은 마지막 action이 모든 경로에서 `goto`, `ending`, `gameOver` 중 하나로 끝나야 합니다. 그렇지 않으면 첫 scene으로 되감길 수 있으므로 파서가 실행 전에 거부합니다.

## 챕터 로딩 규칙

- `0.yaml`이 있으면 `0,1,2...` 순서
- 없고 `1.yaml`이 있으면 `1,2,3...` 순서
- `goto: ./routes/a/1.yaml`처럼 경로 점프 가능
- 경로 점프 후 같은 폴더의 번호 챕터를 순차 진행
- `../`를 포함한 챕터 `goto`는 허용하지 않습니다.
- 챕터 로딩 오버레이는 첫 화면에 노출되는 Live2D 캐릭터가 실제로 `ready/error` 상태를 보고할 때까지 유지됩니다. Live2D 챕터에서는 모델 의존성과 함께 렌더러·Cubism Core를 선제적으로 준비하고, 시작 전환 화면이 실제 캐릭터 마운트를 막지 않도록 해 첫 실행 경합을 줄입니다.
- 챕터 로딩 중(`chapterLoading=true`)과 게임 데이터 미로딩 상태에서는 다이얼로그 박스를 `opacity: 0`으로 숨기고, 해제 시 페이드 인으로 표시합니다.
- 인게임 다이얼로그 박스 우측 상단(박스 외부 컨트롤 레이어) `숨기기` 버튼을 누르면 다이얼로그를 수동으로 접을 수 있습니다. 버튼은 본문 텍스트 영역과 겹치지 않도록 고정됩니다.
- 수동 숨김 상태에서는 화면 클릭/`Enter`/`Space`로 스크립트를 진행하지 않으며, 우측 하단 `대화창 열기` 버튼으로 복원해야 진행이 재개됩니다.
- 시스템 숨김 상태(챕터 로딩/게임 미로딩/컷신)에서도 캐릭터 무대는 플레이 프레임 전체에 고정됩니다. 스티커만 하단 안전 여백(`stickerSafeInset`)을 사용해 대화창을 피합니다.
- 다이얼로그 수동 숨김/복원이나 높이 변화가 생기면 스티커 안전 여백만 갱신됩니다. 타이핑 글자마다 캐릭터 위치를 다시 계산하지 않습니다.
- 배경과 전체 화면 시스템 오버레이는 항상 뷰포트를 채웁니다. 캐릭터·스티커·HUD·대사창·선택/입력·컷신·CASE FILE은 중앙의 `stage-content-frame`을 공유합니다. PC 프레임은 화면 안에서 최대한 크게 확장하되 가로세로 비율을 `4:3 ~ 16:9` 사이로 제한하므로, 세로 모니터에서는 4:3 중앙 무대가 되고 울트라와이드에서는 16:9를 넘지 않습니다. 프레임 밖은 검은 띠 대신 같은 풀블리드 배경이 이어집니다. 768px 이하 세로 화면은 입력 장치 종류와 무관하게 최대 `9:16` 모바일 구도를 사용합니다.
- 스티커·증거물은 HUD·대사창·기기 safe-area를 제외한 공통 안전 프레임을 좌표 기준으로 사용합니다. 런타임이 실제 렌더 경계를 측정해 큰 원본·고정 크기·짧은 가로 화면에서도 종횡비를 유지한 채 균일 축소하고, 잘리지 않는 최소 거리만큼 안쪽으로 이동합니다.
- 모바일 다이얼로그는 중앙 플레이 프레임 좌우·하단에 최소 10px 외곽 여백을 두고, 노치·홈 인디케이터 safe-area 값이 더 크면 이를 우선합니다.
- 화자 강조는 데스크톱/모바일 공통 규칙으로 동작합니다. 현재 화자는 가장 앞의 z축과 원래 불투명도를 유지하고 비화자는 합성 가능한 불투명도로 낮추되, 개별 캐릭터 크기는 바꾸지 않습니다. 다인 `close`에서는 주변 인물의 페이드와 `visibility` 숨김을 먼저 끝낸 뒤 확대해 퇴장 실루엣이 화면 가장자리에서 잘리지 않게 하며, `reaction`에서는 카메라 대상인 듣는 인물을 전면에 둡니다.
- `with`를 생략한 대사·선택·입력·내레이션은 현재 무대에 배치된 인물을 기본 앙상블로 유지합니다. 1인은 원래 `position`과 무관하게 50% 중앙, 2인은 25%/75%, 3인은 25%/50%/75%의 고정 구성 앵커를 사용합니다. PC도 같은 비율을 출발점으로 삼되 중앙 간격을 `260px × 현재 앙상블의 평균 calibration.spacing`에서 제한합니다. 좌우 배우가 서로 다른 보정값을 가져도 한쪽만 더 멀어지지 않고 넓은 화면에서도 같은 대화권을 유지합니다.
- `medium`은 모바일·PC의 기본 드라마 구도입니다. 정적 이미지는 인원수와 관계없이 원본 높이 `58cqh`, 구성 배율 `1.58`, 세로 원점 `80%`를 사용해 같은 머리 위치·하체 크롭·발 기준선을 유지합니다. PC의 `wide/close/reaction` 최종 배율은 `1.00/2.02/1.83`이고, 모바일은 반복되는 근접 컷이 과하게 펌핑되지 않도록 `1.00/1.84/1.72`를 사용합니다. 1·2·3인 변화는 가로 앵커만 바꾸며 등록된 `framing.scale`도 인원수에 따라 약화하지 않습니다.
- 카메라는 이제 인물을 화면 중앙으로 끌어오는 수평 팬을 하지 않습니다. `close/reaction`은 1·2·3인 고정 구성에서 대상이 서 있던 앵커를 확대 원점으로 사용하므로, `medium → close → medium` 전환에도 얼굴의 좌우 위치가 그대로 유지됩니다. 단독 배우는 모든 쇼트에서 중앙 앵커를 사용하고, 얼굴 확대와 전신 컷은 같은 위치에서 배율만 달라집니다.
- 같은 캐릭터 ID를 다른 `position`에 다시 배치하면 이전 슬롯을 자동으로 비우고 DOM/Live2D 인스턴스를 유지한 채 새 위치로 부드럽게 이동합니다. 장면 사이에 남은 슬롯 때문에 한 인물이 두 번 렌더링되지 않습니다.
- 같은 위치의 같은 이미지 캐릭터가 감정만 바꾸면 DOM을 다시 만들지 않습니다. 새 표정은 현재 자리에서 교체되며 최초 등장 애니메이션을 반복하지 않고, 감정 이미지 원본 비율이 달라도 고정 무대 폭을 유지합니다.
- `with`는 같은 무대에 배치된 배우를 퇴장시키지 않고 현재 카메라에서만 `opacity: 0`과 `visibility: hidden`으로 즉시 숨깁니다. 잠시 화면 밖에 있던 인물이 다음 대사에서 다시 잡혀도 DOM/Live2D 인스턴스와 물리적 슬롯을 유지하므로 `characterEnter`나 위치 이동을 반복하지 않습니다. 실제 `char` 배치로 새 배우가 무대에 들어올 때만 등장 모션을 실행합니다.
- 앙상블 구도는 DOM에 남아 있는 전체 배우가 아니라 현재 `with`로 보이는 인원만 계산합니다. 따라서 숨겨 둔 세 번째 배우 때문에 모바일의 보이는 두 사람이 3인용 15%/85% 슬롯으로 밀려 잘리지 않으며, 2인 컷은 25%/75% 구도를 유지합니다.
- 카메라 상태는 저장 복원 때 현재 커서까지 다시 재생되어 동일 쇼트와 대상을 복원합니다. 기존 `framing`을 사용하는 게임도 원본 이미지와 DOM을 그대로 재사용합니다.
- 정말 새로 등장한 인물만 최종 위치에서 짧은 상승·페이드로 나타납니다. 이미 보이던 동일 인물의 위치는 합성 전용 `translate`로 이동하고, 좌우 반전은 중간에 납작해지는 모양을 막기 위해 즉시 바뀝니다. 고정 구성 확대와 쇼트 확대는 중첩된 합성 레이어로 분리되어 `left/width/filter/transform-origin` 재계산이나 수평 팬을 동반하지 않습니다. 캐릭터 표정은 사전 디코딩 후 비동기 표시하며, 모든 모션은 `prefers-reduced-motion`에서 비활성화됩니다.

## 시작 화면 (Start Gate)

- `config.yaml`에 `startScreen`이 없으면 기존처럼 즉시 실행합니다. (기본 OFF)
- `startScreen`이 있고 `enabled: true`면 시작 화면을 표시합니다.
- `startScreen.showTitle`은 기본 `true`이며, `false`이면 이미지 위 게임명 오버레이만 숨깁니다.
- `startScreen.titleColor`를 지정하면 시작 화면 게임 제목에 테마 기본색보다 우선 적용합니다.
- `showTitle: false`인 타이틀 아트는 모바일 세로 화면에서 어두운 `cover` 배경과 별도의 전경 이미지로 렌더링해, 이미지 안에 포함된 제목이 좌우로 잘리지 않게 합니다. 데스크톱과 모바일 가로 화면은 기존 `cover` 구성을 유지합니다.
- 시작 버튼은 항상 표시되며, 텍스트 기본값은 `시작하기`입니다.
- `startScreen.music`을 지정하면 시작 화면에서만 BGM을 반복 재생합니다.
- URL 게임(`/game-list/:gameId`)은 게임별 자동/수동/챕터 저장 중 하나가 있을 때 `이어하기` 버튼을 표시합니다. 자동·수동 저장 중 더 최근 데이터를 열고, 둘 다 없으면 챕터 시작점을 엽니다.
- 레거시 저장 키(`vn-engine-autosave`)가 남아 있으면 URL 게임 로드시 fallback으로 읽고, 실제 resume 성공 시 게임별 키로 마이그레이션합니다.
- 같은 탭 세션에서 시작/로드를 한 번 누르면(`sessionStorage` 플래그) 새로고침 시 시작 화면을 다시 띄우지 않습니다.
- 시스템 탭의 `초기화면 가기` 버튼은 해당 `sessionStorage` 플래그를 초기화하고, 현재 인게임 BGM을 즉시 정지한 뒤 Start Gate(시작 화면)를 같은 탭에서 다시 엽니다.
- ZIP 실행은 시작 화면을 지원하지만 `이어하기` 버튼은 노출하지 않습니다.
- 시작 화면 타이틀/버튼(`시작하기`, `이어하기`)의 시각 스타일은 `config.yaml.ui.template` 전역 설정을 그대로 따릅니다.
- 시작 화면은 배경의 느린 카메라 인, 비네트·테마 프레임, 타이틀/CTA 순차 등장으로 게임 진입의 첫인상을 강화합니다. 시작 버튼을 누르면 중복 입력을 막고 진행 중 상태를 즉시 표시하며, `prefers-reduced-motion` 환경에서는 장식 애니메이션을 비활성화합니다.
- `/game-list/:gameId` 직접 진입 시 설정 프리뷰와 본편을 준비하는 동안에는 비대화형 부트 화면을 유지합니다. 런처나 빈 게임 HUD가 먼저 노출되지 않습니다. 시작·이어하기 버튼은 실제 최종 위치를 측정해 화면 아래 바깥에서 Y축으로 미끄러져 올라오며 opacity가 차오릅니다. CSS 기본값은 항상 보이는 상태이고 애니메이션 미지원·오류·정지 시 강제 취소되어 버튼 가시성을 복구합니다.

## 덕만 장편 정치 생존 샘플

- `/game-list/deokman/`은 프롤로그부터 최종장까지 8개 챕터로 완결되는 역사 기반 픽션 비주얼노벨입니다.
- v6.1.0은 가족의 늦은 저녁, 덕만·천명의 혼인 끈, 유신·비담의 별채 신경전, 이름을 되찾은 기록관 무진, 덕만·진운의 식은 저녁상, 왕의 죽음 뒤 자매 애도를 추가해 사건 사이의 관계와 상실을 장면으로 보여 줍니다. 즉위 뒤 첫 공개 재판에서는 칠숙과 아진의 죄를 나누어 판결하고, 마지막 네 선택은 법 문서·성벽 연설·항복 규칙·비담의 편지가 실제로 실행된 뒤 결말 판정으로 이동합니다. 엔진은 같은 인물·노출 집합·카메라 지시의 연속 재적용을 생략해 모바일 대화 전환의 불필요한 재연산을 줄였으며 DSL 문법은 변경하지 않았습니다.
- v5.7.0은 전 8장의 장면을 원인과 반응이 먼저 보이는 기승전결로 다시 잇고, 화자 없는 내레이션·24개 선택 프롬프트·35개 실패 결과·10개 엔딩 결과·3개 증거 설명을 `-습니다/-습니까`의 시스템 존댓말로 통일했습니다. 진평왕의 병색과 정치적 무력함, 천명의 공포, 관리의 죽음, 아진과 진운의 인질, 비담의 16년 균열은 모두 결과보다 앞선 행동 장면에서 원인을 보여 줍니다. 최종장은 646년 다음 왕 조건 협상과 비담의 의식적인 거짓 구호, 덕만의 책임 인정과 죄의 판단까지 추가했으며 DSL 문법은 변경하지 않았습니다.
- v5.4.2는 1·2·3인마다 달랐던 원본 높이·구성 배율·세로 원점을 하나의 2인 표준 구도로 통합했습니다. 단독 중앙 인물부터 3인 앙상블까지 같은 `58cqh × 1.58`, 원점 80%를 사용하므로 인원수가 바뀌어도 머리 위치와 하체가 잘리는 비율이 달라지지 않습니다. `wide/close/reaction`과 레거시 `framing.scale`도 인원수 독립 배율로 통일했으며 390×844와 1440×900에서 1·2·3인을 실측했습니다.
- v5.4.1은 높이 기준 정규화 이전에 남아 있던 유신·소원·비담·아진의 `1.07~1.09` 재확대와 `y: -2` 이동을 제거하고, 10명 모두 `scale: 1`, `y: 0`에서 원화 자체의 체격과 자세를 보존합니다. PC 다인 구도는 보이는 배우들의 `spacing` 평균을 좌우에 대칭 적용하고 최대 간격을 260px로 줄여 한쪽 배우만 높거나 멀어지는 구도를 막았습니다. 기본·표정 원화 30종과 모바일·PC의 1·2·3인 장면을 다시 검수했습니다.
- v5.4.0은 두 번째 레퍼런스의 화면을 표준 구도로 삼아 전 8장의 일반 인물 컷을 작은 `wide` 나열에서 화면을 채우는 `medium`으로 마이그레이션했습니다. 엔진은 1·2·3인 고정 구성과 쇼트 확대를 분리하고, 정적 인물 높이를 플레이 프레임에 정규화합니다. `close/reaction`도 대상을 중앙으로 옮기지 않고 그 자리를 확대하므로 390×844 모바일과 1440×900 PC에서 인물의 얼굴 위치가 쇼트 전환마다 치우치거나 흔들리지 않습니다. 빈 무대와 공간 관계를 보여 주는 의도적인 전신 컷만 `wide`로 남겼습니다.
- v5.3.1은 원본 보정의 확대 원점을 발밑으로 고정하고 정적 캐릭터 크기를 플레이 프레임의 가로·세로에 함께 반응하도록 바꿨습니다. 좌우 슬롯과 카메라 이동이 같은 25%/75% 중심을 사용하며, 단독 배우의 `medium/close/reaction`은 원래 슬롯과 무관하게 중앙을 잡습니다. 표적 없는 `close/reaction` 완화는 배율만이 아니라 실제 포커스·주변 인물 노출까지 `medium`으로 통일했습니다. 30개 표정 원본과 375×667·390×844·768×1024·900×1600·1440×900 구도를 검증했습니다.
- v5.2.4는 모바일 카메라 배율을 쇼트·인원별로 분리하고, 직전 인물의 `close/reaction` 표적이 화자 없는 다음 나레이션에 남아 배우 전원이 과도하게 커지던 문제를 수정했습니다. 기둥 뒤로 숨는 컷은 빈 `wide`, 숨죽이는 컷은 덕만 지정 `reaction`, 발각 뒤 3인 나레이션은 안전한 그룹 `medium`으로 렌더링하며 375×667·390×844·1440×900에서 검증했습니다.
- v5.2.1은 프롤로그의 2인 컷 사이에서 진평왕이 `with` 목록에서 빠질 때 DOM까지 제거되어 다음 컷마다 등장 모션을 반복하던 문제를 수정했습니다. 젖은 관리의 도착도 `문이 열림 → 왕의 질문 → 젖은 청원서`의 짧은 사건으로 다시 연출했습니다.
- v5.2.2는 화면 밖 인물을 DOM에 보존하는 과정에서 숨은 칠숙까지 3인 레이아웃 수에 포함해, 모바일 2인 컷의 덕만과 진평왕이 화면 양끝에서 잘리던 회귀를 수정했습니다. 인스턴스 보존과 화면 구도 계산을 분리해 현재 보이는 두 사람만 안전한 2인 슬롯을 사용합니다.
- v5.2.3은 모바일 `medium/close/reaction`이 상단에 가까운 원점에서 전신 원화를 확대해 얼굴이 오히려 대사창 쪽으로 내려가던 문제를 수정했습니다. 390×844의 실제 `9:16` 무대에서 칠숙·진평왕 2인 대화와 이어지는 덕만 클로즈업을 기준으로, 인물 수별 하단 카메라 원점을 적용했습니다.
- v5.2.0은 첫 등장 역할 카드와 게임 방법을 설명하던 메타 내레이션을 제거했습니다. 진평왕의 부성, 천명과 덕만의 자매 관계, 유신의 역할, 칠숙의 적대는 소개문 대신 실제 대화와 행동에서 드러나며 `화백`·`상대등`처럼 사건 이해에 필요한 낯선 직함만 그 순간 짧게 풉니다.
- v5.2.0은 추상적인 결론과 경구를 구체적인 행동·결과로 다시 다듬고, 대관식에서 덕만이 이유 없이 `left → center`로 미끄러지던 배치를 제거했습니다. 첫 선언은 인물 위치를 옮기지 않는 `close + cut` 카메라로 잡습니다.
- v5.0.0은 전 8장의 이야기와 대사를 처음부터 다시 썼습니다. 631년 왕위 위기와 왕 암살 시도에서 시작해 누명·혼인 압박·밀실 살인·국경 통치·경쟁 왕족·진평왕의 죽음과 632년 왕위 등극을 거쳐, 642년 대야성 함락·645년 황룡사 구층탑·647년 비담의 반란과 선덕왕의 마지막 아침까지 이어지는 16년 대하만화극입니다. 장별 구조와 역사/창작 경계는 [`docs/DEOKMAN_EPIC_REWRITE_PLAN.ko.md`](docs/DEOKMAN_EPIC_REWRITE_PLAN.ko.md)에 정리했습니다.
- v5.0.0의 화자 말풍선 821개는 속도 태그를 뺀 뒤 모두 32자 이하입니다. 한 말풍선에는 질문·대답·감정·결정 중 하나만 두고, 설명은 상대의 반응과 침묵 사이로 나눕니다. 진평왕은 늦은 애정, 천명은 솔직한 보호, 유신은 수와 책임, 소원은 생활 감각, 비담은 농담 뒤의 선택받고 싶은 마음, 칠숙은 공손한 위협, 아진은 거리와 생존, 진운은 빌린 말에서 자기 말로 나아가는 흐름으로 구별합니다.
- 최종장은 왕위에 오르는 순간에서 끝나지 않습니다. 첫 구휼과 세금 감면, 10년 뒤 전쟁, 탑을 둘러싼 덕만·비담의 균열, 반란과 다음 왕 결정까지 실제 장면으로 이어집니다. 천명의 생존 여부도 마지막 밤의 대화와 진엔딩에 반영합니다.
- v4.1.0은 695개 화자 대사를 15세 한국인이 바로 읽을 수 있는 궁중 만화의 호흡으로 전부 재감수했습니다. 속도 태그를 뺀 말풍선을 69자 이하로 고정하고, `공모/보폭/비축/전례/계승` 같은 말은 장면이 바로 그려지는 쉬운 한국어로 바꿨습니다. 칠숙의 긴 논설은 감춘 두려움으로, 진평왕의 경구는 딸에게 늦게 건네는 솔직한 말로, 비담의 설명은 짧은 질문과 농담으로 나눴습니다. 쉬운 말투가 현대 유행어나 유아어가 되지 않도록 신라 궁중의 긴장과 인물별 말버릇은 유지합니다.
- v4.0.0은 작품의 첫인상과 대본의 우선순위를 선택지에서 인물 드라마로 되돌렸습니다. 런처 소개는 생활 소품이나 분기 개수를 앞세우지 않고 `아버지를 살린 밤 암살범으로 몰린 공주`라는 중심 사건을 제시합니다. 칠숙은 목적을 자백하는 악역이 아니라 전례와 질서를 무기로 상대의 자리를 빼앗고, 선택 직전의 손익 목록은 소원·천명·유신·비담·진운과의 충돌·농담·상처로 교체했습니다. 선택지는 그대로 유지되지만 장면의 결론으로만 등장합니다.
- 분기 구조는 각 장의 막을 닫는 4지선다 3개, 전체 24개 선택·35개 고유 `gameOver` 후일담·10개 수집형 엔딩으로 구성됩니다.
- v3.2.2는 모바일 1인 `medium/close/reaction`의 세로 카메라를 상단 원점과 `4cqh` 안전 헤드룸으로 분리해, 세로를 가득 채우는 전신 에셋의 머리·장신구가 화면 밖으로 잘리던 문제를 수정했습니다.
- v3.2.1은 카메라 확대와 대상 이동을 두 합성 레이어로 분리하고, 캐릭터 이동에서 레이아웃·필터·동기 디코딩 병목을 제거했습니다. PC 2·3인 구도는 최대 간격과 에셋별 `calibration.spacing`을 사용하는 압축 앙상블로 바꾸고 모바일 분할은 유지합니다.
- v3.2.0은 인물 10명의 원본을 `calibration`으로 정렬하고, 679개 화자 대사·24개 선택·66개 배경 전환을 장면 카메라로 다시 지시했습니다. 배경 전환은 전신 `wide`, 정보 교환은 등장인물 전체가 함께 확대되는 `medium`, 위기·감정·결단은 화자 중심 `close`로 전환합니다. 221개의 명시적 등장 지시와 분기별 화면 배치 검증은 그대로 유지합니다.
- v3.1.0은 전 8장 679개 화자 대사를 쉬운 한국어와 투명한 감정 연기로 다시 감수했습니다. `왕경/인영/시진/지아비/정사`처럼 흐름을 막던 말을 `수도/도장 자국/두 시간/남편/나라일`로 풀고, 말보다 시선·손·소품이 먼저 속마음을 들키게 했습니다. 동시에 긴 소매, 말 이름, 먹물 묻은 코, 흙먼지 끼니, 신발 끈, 계피와 생강 같은 비사건 생활 대사를 더해 정치 설명 사이에 인물이 숨 쉴 자리를 만들었습니다. 평상시는 27 CPS, 고백·협박·상실·결단은 17~22 CPS로 대비합니다.
- v3.0.0은 인물 10명의 기본·감정 원화 30종을 전면 재설계했습니다. 덕만은 더 선명하고 아름다운 주인공 인상과 청원·곡옥의 비대칭 자세를 갖고, 나머지 인물도 얼굴형·연령·체형·시선·손 소품으로 구분합니다. 표정은 눈썹만 바꾸지 않고 시선·턱·어깨·손까지 연기하며, 원화의 `facing`을 기준으로 좌우 인물이 서로를 바라보게 자동 반전합니다. 장 끝의 추상 요약은 물건이 변하는 화면 행동으로 교체하고, 한 문장뿐이던 9개 비정규 엔딩은 관계 인물과 반복 소품이 돌아오는 대화형 코다로 확장했습니다. 세부 아트 기준은 [`docs/DEOKMAN_CHARACTER_ART_DIRECTION.ko.md`](docs/DEOKMAN_CHARACTER_ART_DIRECTION.ko.md)에 고정했습니다.
- v2.6.0은 8개 장의 시간축을 나레이션과 화면 단서로 연결했습니다. 연회 전날 밤부터 진시의 독살 시도, 사흘간의 누명 수사, 이튿날 혼담과 같은 밤의 밀실 살인, 열이틀의 국경 이동, 왕경 귀환 사흘째의 후계 대결, 같은 밤 이경부터 새벽까지의 궁 잠입, 왕의 죽음 이튿날 화백회의가 인과에 맞게 이어집니다. 날짜·장거리 이동은 짧은 무화자 나레이션으로 알리고, 연속 위기는 식어 가는 피·줄어드는 횃불·종·인주처럼 화면 안 변화로 시간을 보여 줍니다.
- v2.5.0은 관계와 동기를 설명하던 도입부를 실제 에피소드로 재구성했습니다. 천명이 혼례 비녀를 직접 빼 주는 장면, 유신이 도주용 말을 준비하는 선택, 진운에게 인질의 비녀가 도착하는 순간, 국경의 빈 그릇처럼 반복 소품과 행동으로 감정·관계·정치적 대가를 보여 줍니다. 이 초기 계획은 v5.0.0의 대하 서사 계획으로 대체되었습니다.
- v2.4.0은 24개 선택 전부에 관계와 원인의 도입부를 보강했습니다. 첫 선택 전에 덕만이 아들 없는 진평왕의 딸이라 표적이 된 이유를 밝히고, 두 번째 선택 전에 천명·유신·칠숙을 믿거나 경계해야 하는 이유를 대화로 설명합니다. 이후에도 소원·비담·아진·월명·진운의 지위, 덕만과의 관계, 도움을 청하는 이유, 각 선택으로 위험해지는 사람을 먼저 보여 준 뒤 보기로 넘어갑니다. 화자 대사는 522개에서 565개, 명시적 등장 지시는 170개에서 173개로 늘었습니다.
- v2.3.0은 논리적 등장인물과 실제 화면에 보이는 인물을 분리했습니다. 기둥 뒤 엿듣기, 잠긴 문 안팎, 가마 밑 잠입, 강·비탈·궁문을 사이에 둔 장면은 단독 시점과 상대편 컷으로 번갈아 보여 주고, 발각·접근·대치가 실제로 일어난 뒤에만 같은 화면으로 합칩니다. 소리·시야·거리·가려진 물건을 먼저 묘사하도록 주요 공간 장면도 다시 썼습니다.
- v2.2.0은 35개 실패 선택을 즉시 결과창으로 끝내지 않고, 선택이 가능해 보인 이유·경고·상황 반전·마지막 반응을 5개 이상의 대사와 이펙트로 직접 재생한 뒤 `gameOver`가 나오도록 확장했습니다. 공간을 실제로 공유하는 인물은 전신으로 관계를 보여 주고, 정보 교환은 상반신, 발각·배신·마지막 말은 단독 또는 대치 클로즈업으로 좁힙니다.
- v2.1.0은 전 8장을 `암살 생존 → 누명 해소 → 혼인 압박 → 살인 수사 → 국경 통치 → 후계 경쟁 → 가족 구출과 왕의 죽음 → 화백회의`의 인과로 다시 연결했습니다. 인물 대사는 147줄에서 371줄로 확장하고, 각 장에 최소 8개의 3턴 이상 상호 대화 장면을 두어 한 사람씩 경구를 말하던 독백 구조를 질문·오해·반응·수정이 이어지는 드라마로 바꿨습니다.
- v2.0.0은 타이틀을 포함한 배경 10종과 인물 10명의 기본·표정 20종, 총 30개의 투명 인물 이미지를 새 WebP로 교체했습니다. 631년은 신라가 당식 복제를 본격화하기 전이라는 기준 아래 한국인 인상, 좁은 소매 교임, 금동·곡옥 장신구, 낮은 목조 전각과 흙바닥·토기 중심으로 통일하고 중국 황실의 용·봉황 원형 문양, 복두, 거대한 소매, 붉은 궁문과 등롱은 배제했습니다.
- v2.0.0 대본은 8개 챕터 전체를 캐릭터별 욕망과 언어 습관으로 다시 감수했습니다. 덕만은 상대의 전제를 뒤집고, 유신은 수와 책임, 소원은 생활 물건, 비담은 웃음 뒤의 결핍, 칠숙은 존칭형 협박, 아진은 거리·호흡·시간으로 말합니다. 24개 선택지는 위기를 먼저 제시하고 즉시 행동만 고르도록 정리했으며, 보기 문구는 최대 16자, 프롬프트는 최대 30자로 고정합니다.
- 선택 게이트는 짧은 4개 보기가 720px 데스크톱과 일반 세로 모바일에서도 하단 상태줄과 겹치지 않도록 데스크톱 `46cqh`·모바일 `48cqh`까지 확장하고, 더 긴 콘텐츠만 내부 스크롤로 처리합니다.
- v1.2.1은 AVIF 픽셀을 표시하지 못하는 일부 브라우저 엔진에서도 시작 타이틀, 런처 썸네일, 본편 배경과 엔딩 아트를 정상 렌더링합니다.
- v1.2 대본은 8개 챕터의 대사와 내레이션을 전수 재작성했습니다. 인물별 어휘·문장 길이·서브텍스트를 분리하고, 전역 27 CPS에 `defaultDelivery`·감정 표정·`say.wait`·구간 속도를 조합해 질문, 망설임, 반응 뒤의 침묵이 실제 읽기 리듬으로 남습니다.
- `moonveil/embers/crown` 이펙트는 야간 암투·불타는 기록·즉위 장면에 각각 사용하며 모션 감소 설정에서는 정지 오버레이도 남기지 않습니다.
- `legitimacy/power/insight/suspicion`과 백성·군사·인물별 신뢰가 마지막 화백회의에서 다시 사용됩니다. 진엔딩은 한 수치 최대화가 아니라 세 증거와 서로 다른 집단의 지지를 함께 요구합니다.
- 최종 선택 직전에는 누적 상태를 균형·군사력·민심·불안정 서술로 되돌려 줘, 플레이어가 지금까지 만든 왕권의 형태를 이해할 수 있습니다.
- `gameOver`의 `직전 선택으로` 복구를 이야기 장치로 사용해, 실패 결말의 단서를 읽고 선택을 다시 고르는 흐름을 보여 줍니다.
- 캐릭터·챕터·역사/창작 경계는 [`docs/DEOKMAN_GAME_BIBLE.ko.md`](docs/DEOKMAN_GAME_BIBLE.ko.md), 장면별 드라마 개편은 [`docs/DEOKMAN_DRAMATURGY_PLAN.ko.md`](docs/DEOKMAN_DRAMATURGY_PLAN.ko.md), 주요 경로 검수는 [`docs/DEOKMAN_PLAYCHECKLIST.ko.md`](docs/DEOKMAN_PLAYCHECKLIST.ko.md)에 고정했습니다.

## Conan 샘플 분기 구조

- `0.yaml`은 가족 여행과 탁구 선택, `1.yaml`은 88도 시음 순서와 차 이름 선택, `2.yaml`은 4인 갈등과 사건 발생, `3.yaml`은 초동 정리/재구성 파트입니다.
- 가장 짧은 선택 경로도 사건 전 약 7분을 유지하며, 시음 순서와 차 이름을 기억한 선택은 사건 직전 관찰·추리 수치로 회수됩니다.
- `routes/hub/1.yaml`은 조사 라운지이며, `세이지/레이코/켄지/하루오 유품` 4개 라인을 자유 선택할 수 있습니다.
- 각 라인(`routes/<line>/1.yaml`)은 1회 재도전 구조로 핵심 단서를 잠그고 라운지로 복귀합니다.
- 라운지에서 조기 정리 회의로 이동할 수 있고, 방문 수에 따라 `deduction_score`/`final_confidence` 패널티가 적용됩니다.
- 결말은 `conclusion/1.yaml`로 합류하며, 잠자는 코고로 추리 쇼 + 최종 지목/재지목 1회 흐름을 유지합니다.

## Conan 60초 엔진 쇼케이스

- `/game-list/conan-demo/`는 입력 없이 완주 가능한 약 `60.15초` 트레일러형 독립 게임입니다.
- 자동 대사, 7초 제한 선택, 공유 에셋, 스티커 HUD와 신규 전체 화면 이펙트를 한 챕터에 압축했습니다.
- 모바일 세로 화면에서 타이틀, 선택 게이트, 엔딩까지 넘침 없이 재생되도록 구성했습니다.

## 샘플

- `public/game-list/deokman/config.yaml`
- `public/game-list/deokman/base.yaml`
- `public/game-list/deokman/launcher.yaml`
- `public/game-list/deokman/0.yaml` ~ `7.yaml`
- `public/game-list/conan-demo/config.yaml`
- `public/game-list/conan-demo/base.yaml`
- `public/game-list/conan-demo/0.yaml`
- `public/game-list/conan/config.yaml`
- `public/game-list/conan/base.yaml`
- `public/game-list/conan/launcher.yaml`
- `public/game-list/conan/routes/base.yaml`
- `public/game-list/conan/0.yaml`
- `public/game-list/conan/1.yaml`
- `public/game-list/conan/2.yaml`
- `public/game-list/conan/routes/hub/1.yaml`
- `public/game-list/conan/routes/seiji/1.yaml`
- `public/game-list/conan/routes/reiko/1.yaml`
- `public/game-list/conan/routes/kenji/1.yaml`
- `public/game-list/conan/routes/haruo/1.yaml`
- `public/game-list/conan/conclusion/1.yaml`
- `public/game-list/live2dtest/config.yaml`
- `public/game-list/live2dtest/base.yaml`
- `public/game-list/live2dtest/launcher.yaml`
- `public/game-list/live2dtest/1.yaml`
- `sample.yaml`

## 개발 메모

- 런처 첫 화면은 모든 플레이 가능한 데모를 실제 썸네일과 함께 보여주는 전체 폭 캐러셀입니다. 새 방문은 매니페스트 첫 게임에서 시작하고, 스와이프·마우스 드래그·좌우 화살표·키보드 `←`/`→`/`Home`/`End`·페이지 인디케이터로 순환합니다.
- 평상시 캐러셀 탐색은 주소나 탭 저장소에 마지막 선택을 남기지 않습니다. 루트로 새로 들어오면 첫 게임을 움직임 없이 표시하고, `선택 링크 복사`를 눌렀을 때만 `?demo=<gameId>` 공유 URL을 만듭니다. 공유 링크는 초기 스크롤 애니메이션 없이 해당 게임을 즉시 표시하며, 예전 `#demo=<gameId>` 링크는 같은 쿼리 형식으로 자동 이전합니다. 사용자가 공유 링크에서 다른 데모를 탐색하면 선택 쿼리를 제거해 주소와 화면이 어긋나지 않게 합니다.
- 캐러셀은 Embla의 transform 기반 스냅 이동을 사용합니다. 이동 중 `scroll`/`select` 이벤트로 React 상태를 바꾸지 않으며, `settle` 이벤트에서 최종 선택 스냅을 한 번만 확정합니다. 대표 이미지는 캐러셀 진입 전에 eager 로딩하고 슬라이드별 권리 고지·공유 상태 DOM을 유지해 이동 도중 데이터가 교체되거나 높이가 흔들리지 않습니다.
- manifest 로딩 화면과 런처 컨테이너에는 진입·시머 애니메이션을 사용하지 않습니다. 데이터 준비 전부터 헤더를 제외한 `100svh` 높이를 예약하고, 완성된 쇼케이스도 같은 높이를 유지합니다. 슬라이드 내용이 작은 화면보다 길면 외곽 높이를 밀지 않고 해당 슬라이드 내부에서만 스크롤합니다.
- 캐러셀 페이지 점은 활성 상태에서도 고정 폭을 유지하고 색상·세로 배율만 바꿉니다. 현재 게임명/번호 영역도 고정 2열에 배치해 클릭 전후 컨트롤 위치가 변하지 않습니다.
- 게임의 시스템 탭에서 `게임 시작 화면으로 가기`를 사용할 수 있습니다. URL 게임뿐 아니라 시작 화면이 포함된 ZIP 게임도 업로드 파일에서 프리뷰를 다시 구성해 돌아가며, 시작 버튼을 누른 뒤 전환 중에는 버튼 문구를 바꾸거나 `이어하기` 보조 버튼을 노출하지 않습니다.
- 선택한 데모의 `GitHub 폴더`는 저장소 루트가 아니라 `public/game-list/<gameId>` 소스 디렉터리로 바로 연결됩니다. 아래 검색·태그 게임 목록은 상단 선택을 바꾸지 않으며 카드 전체를 누르면 해당 게임으로 바로 이동합니다.
- 쇼케이스 아래 엔진 소개에서 YAML DSL, 게임 흐름, 웹 런타임의 역할과 제작 가이드·샘플 YAML 진입점을 제공합니다. 모바일에서도 제작 가이드와 ZIP 실행을 유지하고, ZIP 입력은 키보드와 스크린 리더로 사용할 수 있습니다.
- 검색어는 `Escape` 또는 지우기 버튼으로 제거하고, 결과가 없으면 한 번에 검색·태그 조건을 초기화할 수 있습니다. 태그는 사용 빈도순 상위 8개를 먼저 보여주며 필요할 때 전체 목록을 펼칩니다.
- 각 캐러셀 슬라이드는 독립된 페인트 경계 안에서 이미지와 콘텐츠를 자르며, 긴 제목·설명·태그는 화면 폭을 밀어내지 않습니다. 좁은 화면의 태그는 슬라이드 안에서만 가로 스크롤됩니다.
- 이전/다음·도트·현재 번호는 슬라이드와 분리된 탐색 레일에 배치되어 긴 제목이나 모바일 본문을 가리지 않습니다.
- 게임 목록 manifest는 `schemaVersion: 5`를 사용하며 `author/version/summary/thumbnail/tags/showcase/legalNotices/chapterCount` + `seo` 메타를 포함합니다.
- 런처 썸네일은 `launcher.yaml.thumbnail` 우선이며, 누락 시 `config.yaml.startScreen.image`를 기본값으로 사용합니다.
- 캐러셀 라벨·배경색·썸네일 초점/배율/오프셋은 `launcher.yaml.showcase` 데이터만 사용하며 게임 ID나 `tags`를 조건으로 특별 처리하지 않습니다.
- 런처는 V1(`id/name/path`) manifest도 fallback으로 지원합니다.
- 게임별 `launcher.yaml`은 선택사항이며, 없으면 런처가 기본 요약/메타로 안전하게 렌더링합니다.
- 런처/게임 페이지 SEO는 `config.yaml.seo`와 manifest 집계 `seo.gameTitles`를 사용해 `description/keywords/og/twitter/json-ld`를 동적으로 갱신합니다.
- Start Gate(시작 화면) 상태에서도 `config.yaml.seo`를 즉시 반영해, 게임 본 로딩 전에도 `/game-list/<gameId>/` SEO 메타가 적용됩니다.
- `startScreen`이 설정된 게임은 시작 게이트를 표시하며, URL 게임은 게임별 자동/수동/챕터 슬롯 중 하나라도 있으면 `이어하기` 버튼을 노출합니다.
- 레거시 autosave 키(`vn-engine-autosave`)는 URL 게임 로드시 fallback으로 읽고, 실제 이어하기 성공 시 게임별 키로 마이그레이션합니다.
- 인게임 HUD 우측은 로그, 가방, 저장 버튼을 제공하며 가방 버튼에는 인벤토리 진행 배지(`획득수/전체수`)를 표시합니다.
- 인벤토리 모달은 `가방(획득)`/`도감(전체)` 2탭과 수집 진행 막대를 제공합니다. 현재 탭에 탐색할 단서가 있을 때만 검색·카테고리·정렬을 표시합니다.
- 케이스 파일은 현재 `ui.template` 색상 토큰을 사용하는 기록 보관소 형태로 렌더링합니다. 인벤토리는 수집 현황 헤더와 번호가 붙은 전시형 단서 카드, 저장 화면은 자동 보호 상태와 수동 저장·챕터 체크포인트·백업의 3개 역할 카드로 구분합니다.
- 빈 가방에서는 단서 보관 방식을 설명하고 `도감 살펴보기`를 제공하며, 검색 결과가 비면 `검색 조건 초기화`로 즉시 복구할 수 있습니다.
- `도감` 탭의 미획득 아이템은 비활성 잠금 카드(`미발견 단서`)로 표시해 스포일러와 의미 없는 상세창 진입을 막습니다.
- 인벤토리 그리드는 반응형 고정 열 수를 사용합니다: 데스크톱 5열, 태블릿 4열, 모바일 3열(340px 이하 2열).
- 인벤토리 스크롤은 슬롯 그리드 영역에만 적용합니다. 획득한 슬롯을 누르면 별도 중간 선택 단계 없이 이미지·카테고리·설명을 정리한 상세 팝업이 열립니다.
- `획득` 배지는 소지 여부 비교가 필요한 도감의 획득 카드에만 표시합니다.
- 배경음악과 초기화면 이동은 인벤토리에서 분리해 시스템 탭에 배치합니다. 배경음악 토글은 게임별 키(`vn-engine-settings:<autosave-key>`)로 저장됩니다.
- 인벤토리의 `보기 탭/정렬/카테고리` 마지막 선택도 같은 게임별 설정 키에 저장되어 다음 실행 시 복원됩니다.
- 시스템 탭의 자동저장 토글도 같은 게임별 설정 키에 저장됩니다. 자동저장은 게임오버의 직전 선택 복구와 시작 화면 이어하기에 사용하고, 일반 화면에서는 직접 불러오기 버튼을 표시하지 않습니다.
- 저장·설정 화면은 데스크톱에서 역할 카드 3열, 모바일에서 1열로 전환하며, 주요 `현재 진행 저장` 작업만 테마 강조색을 사용해 불러오기·복귀·기기 이동 작업과 시각적으로 구분합니다.
- 모바일 세로 화면에서 케이스 파일을 열면 `9:16` 플레이 프레임 제한을 일시 해제해 안전영역 안의 전체 뷰포트 높이를 사용하고 헤더와 탭을 고정합니다. 시스템 탭은 각 저장 카드가 버튼까지 온전히 보이는 내용 높이를 유지한 채 카드 목록만 스크롤하며, 배경음악·초기화면 설정과 상태 문구를 하단에 항상 표시합니다. 인벤토리 목록은 상단 수집/필터 영역을 제외한 남은 높이를 채웁니다.
- `gameOver`는 엔딩/크레딧/엔딩 수집률을 발생시키지 않으며 별도 선택 복구점, 수동·챕터 저장 또는 가져온 백업에서 복구합니다.
- HUD의 `CASE LOG`는 대사, 확정한 선택, 정답 입력을 최대 300개까지 자동저장합니다. 선택 복원 키에 챕터 경로를 함께 기록해 서로 다른 챕터의 동일한 scene/action 좌표가 충돌하지 않습니다.
- URL 게임에서는 시스템 탭의 `초기화면 가기` 버튼으로 Start Gate를 다시 열 수 있으며, ZIP 실행 게임에서는 버튼이 비활성화됩니다.
- `config.yaml.ui.template`으로 시작 게이트(타이틀/버튼) + 챕터 로딩/다이얼로그/스킵 UI/입력·선택 게이트/엔딩 크레딧의 전역 템플릿(`cinematic-noir`, `neon-grid`, `paper-stage`)을 선택할 수 있습니다.
- 엔딩 배경 이미지는 `config.yaml.endingScreen.image`로 지정할 수 있으며, 템플릿 색상/디코레이션 레이어 위에 적용됩니다.
- 게임 플레이 HUD는 좌측 게임 제목 + 우측 로그/가방/저장 버튼만 표시합니다. 기능 없는 상시 엔진 문구는 제거하고, ZIP 처리 중에만 `ZIP 불러오는 중` 상태를 표시합니다. 긴 대사·기록·인벤토리·시스템·엔딩과 런처 태그 목록의 스크롤 영역에는 테마에 맞는 스크롤 표시를 제공합니다.
- 수집형 엔딩이 2개 이상이고 선택 복구점이 있으면 엔딩 화면 하단에 `마지막 선택으로`를 함께 표시해 크레딧 뒤 곧바로 다른 결말을 탐색할 수 있습니다. 엔딩을 선언하지 않은 레거시 게임은 의미 없는 `0/0` 수집 카드를 숨깁니다.
- `처음부터 다시하기`는 모든 엔딩 화면에 계속 표시됩니다.
- URL 게임에서 `처음부터 다시하기`를 누르면 인벤토리 모달의 `초기화면 가기`와 동일하게 Start Gate 세션 플래그를 초기화하고 Start Gate(시작 화면)로 복귀합니다.
- ZIP 실행 게임에서는 Start Gate 재진입을 지원하지 않으므로 `처음부터 다시하기`가 기존처럼 첫 챕터 재시작(`restartFromBeginning`)으로 동작합니다.
- 위 재시작 흐름에서도 저장된 엔딩 수집(`vn-ending-progress:<gameId>`)은 유지됩니다.
- 엔딩 크레딧 롤 영역은 초기 자동 스크롤 구간에서 입력을 잠그고(`pointer-events: none`), 자동 스크롤이 멈춘 뒤에만 수동 스크롤을 허용합니다.
- 모바일 브라우저에서는 핀치/제스처 확대를 막도록 viewport와 터치 제스처를 제한합니다.
- 배경은 기기 화면 전체를 `cover`로 유지하고, 실제 게임 UI는 최대 `9:16` 중앙 프레임을 사용합니다. 따라서 긴 세로 창에서도 HUD·캐릭터·대사창이 화면 끝으로 벌어지지 않고 하나의 구도를 유지합니다.
- 캐릭터 레이어는 중앙 플레이 프레임 전체를 사용하고 캐릭터 이미지는 프레임 바닥에 정렬됩니다. 대화창은 그 위에 겹치므로 대사의 높이가 바뀌어도 배우의 기준선은 움직이지 않습니다.
- 노출 캐릭터는 이미지와 Live2D 모두 1인 중앙, 2인 25%/75%, 3인 25%/50%/75%의 고정 구성 역할을 받습니다. PC에서는 간격을 최대 260px로 제한하고 현재 보이는 에셋들의 `calibration.spacing` 평균을 좌우에 동일하게 적용합니다. 한 명만 남으면 이전 옆자리를 상속하지 않고 중앙으로 돌아옵니다.
- 화자 시각 강조는 플랫폼별 분기 없이 동일하게 적용되며, `speakerOrder` 기준으로 비화자 depth(opacity)가 점진적으로 낮아집니다. 이는 대형 투명 이미지의 brightness 필터 재도색을 피하기 위한 합성 경로입니다.
- 챕터 로딩은 현재 챕터가 실제로 참조하는 시각 에셋만 첫 장면 순서대로 제한 병렬 프리로드하고, 전송뿐 아니라 이미지 디코딩 완료까지 확인합니다. 첫 장면을 DOM에 반영한 뒤에도 실제 배경·정적 캐릭터와 Live2D가 준비됐는지 다시 확인한 다음 로딩을 닫으므로, 로딩 직후 캐릭터가 뒤늦게 나타나지 않습니다. 이미 준비한 URL은 세션 캐시에서 재사용하며 오디오/비디오는 브라우저 스트리밍을 유지하고, 데이터 절약/2G에서는 동시성을 낮추고 다음 챕터 백그라운드 예열을 생략합니다.
- 챕터 로딩 중에는 다이얼로그 박스를 `opacity: 0`으로 숨기고, 실제 단계/진행률을 표시한 뒤 로딩 해제 시 페이드 인으로 전환합니다.
- 다이얼로그 박스 최대 높이는 게임 화면 가림을 줄이기 위해 중앙 플레이 프레임 높이의 `데스크톱 38%`(38cqh), `모바일 48%`(48cqh)로 제한하고, 초과 내용(긴 대사/입력/선택지)은 내부 스크롤로 처리합니다. 선택지가 열리면 일반 대사용 최소 높이를 해제해 짧은 프롬프트가 빈 공간을 차지하지 않으며 마지막 옵션까지 먼저 노출합니다.
- Conan 샘플의 배경은 AVIF, 투명 캐릭터는 WebP를 사용해 대표 이미지 묶음을 31.98MiB에서 2.14MiB로 축소했습니다.
- 다이얼로그 박스 우측 상단(박스 외부 컨트롤 레이어)에는 `숨기기` 버튼이 표시되며, 수동으로 접으면 우측 하단에 작은 `대화창 열기` 버튼이 표시됩니다.
- 다이얼로그를 수동으로 숨긴 상태에서는 클릭/`Enter`/`Space` 진행 입력을 잠가 실수로 대사가 넘어가지 않게 합니다.
- 시스템 숨김(챕터 로딩/게임 미로딩/컷신) 중에는 캐릭터/스티커 레이어 하단 inset 기준을 유지해, 첫 다이얼로그 표시 때 레이어 높이 점프를 방지합니다.
- 다이얼로그를 수동으로 숨기거나 다시 열 때는 캐릭터/스티커 레이어 하단 inset 계산을 함께 재계산해 화면 배치를 즉시 맞춥니다.
- 선택지(`choice`)가 열리면 첫 옵션에 자동 포커스되며, Enter/Space 키로 옵션을 선택할 수 있습니다.
- 입력 게이트(`input`)는 값이 비어 있으면 제출 버튼 라벨을 `모르겠다`로 표시합니다. (입력 후에는 `확인`)
- 입력 게이트(`input`)에서 마지막 오답 메시지(정답 안내 단계)에 도달하면 입력창에 정답 값이 자동으로 채워집니다.
- 모바일 환경(터치/coarse pointer)에서는 `input` 게이트 진입 시 입력창 자동 포커스를 건너뛰어 가상 키보드가 즉시 열리지 않도록 합니다.
- `sticker.inputLockMs`를 설정하면 스티커 표시 직후 지정 시간(ms) 동안 `input/choice` 제출을 잠그고, 잠금 종료 후 다음 액션으로 진행합니다.
- 스티커 `enter/leave` 이펙트의 `duration` 사용자 지정은 제거되어, 엔진 기본 시간(enter `280ms`, leave `220ms`)으로 고정됩니다.
- `say.text`의 다중 `<speed=...>...</speed>` 구간을 순차 해석해, 한 문장 안에서도 구간별 타이핑 속도를 다르게 적용합니다.
- `say.delivery`는 8종 감정 프로필과 표정/캐릭터 `defaultDelivery` 기반 자동 추론으로 대사 속도·문장부호 호흡·입력 글자 반응을 조절합니다.
- `say.wait`(ms)를 지정하면 해당 대사 시작 시점부터 지정 시간 동안 진행/스킵 입력을 잠급니다.
- `say.unskippable: true`를 지정하면 해당 문장의 타이핑이 끝날 때까지 즉시 완성/진행 입력을 잠급니다.
- `say.autoAdvance`(ms)를 지정하면 트레일러/키오스크형 대사를 입력 없이 자동 진행합니다.
- `choice.timeoutMs`와 `timeoutOptionIndex`로 제한시간 선택 및 만료 분기를 구성할 수 있습니다.
- Live2D 캐릭터 로딩은 `easy-cl2d` + 번들 자산(`src/assets/third-party/live2d/live2dcubismcore.min.js`) 조합으로 동작합니다.
- 현재 Live2D 실행은 Cubism 5 모델(`moc3 v6`, `model3.json`)을 포함해 Cubism Core 호환 범위를 기준으로 렌더링합니다.
- 코어 스크립트는 Vite 번들 URL(`?url`)로 로드해 정적 공개 경로 의존 없이 캐시 버스팅을 적용합니다.
- Cubism Core v53에서 `renderOrders` 구조가 달라진 케이스를 위해 런타임 호환 패치를 적용해 `easy-cl2d` 렌더러 크래시(`undefined[0]`)를 방지합니다.
- Live2D 캐릭터의 중앙 배치는 CSS `transform` 기반 오프셋을 제거해 포인터 추적 좌표(클릭/드래그 시 시선 반응) 불일치를 줄였습니다.
- Live2D 포인터 좌표는 캔버스의 `getBoundingClientRect()` 기준 로컬 좌표로 보정하고, 드래그 시작 지점이 캔버스 내부일 때만 추적하도록 조정해 `left/center/right` 위치 간 시선 추적 오차를 줄였습니다.
- Live2D 캔버스 리사이즈는 `devicePixelRatio`를 반영한 실제 드로잉 버퍼 크기를 사용해 고해상도 화면에서 입력 좌표와 렌더 좌표 불일치를 완화합니다.
- Live2D 로더는 URL 게임에서 모델 디렉터리 기준 상대 참조를 우선 사용하고, ZIP(blob) 로딩에서는 blob 참조를 상대 키로 재작성해 텍스처/모션 경로를 안정화합니다.
- 챕터 프리로드는 `model3.json` 내부 참조(`Moc/Physics/Pose/UserData/DisplayInfo/Textures/Expressions/Motions`)까지 확장해 Live2D 본 로딩 지연을 줄입니다.
- Live2D 로딩 전에 `moc3`/첫 텍스처를 선검사하고, 장시간 로딩 정체 시 상태 코드(`state`)와 텍스처 카운트 진단 메시지를 표시합니다.
- `src/assets/third-party/live2d/*` 및 `public/game-list/live2dtest/assets/char/ren_pro_ko/*`는 Live2D 별도 라이선스 적용 자산입니다. 렌 포스터 샘플의 공식 필수 고지를 `config.yaml.legalNotices`에 넣어 런처·시작·설정·엔딩에 노출합니다.
- YAVN은 ZIP으로 임의 Live2D 모델을 받을 수 있으므로 배포 형태에 따라 Live2D의 “확장 가능한 애플리케이션” 심사·계약 대상일 수 있습니다. 공개 전에 공식 SDK 라이선스 조건을 확인해야 합니다.
- `public/game-list/conan`과 `conan-demo`는 비공식·비상업적 팬 데모임을 같은 공통 고지 설정으로 표시합니다. 다만 비상업 표시는 권리자 허락을 대신하지 않으므로, 공개 배포를 계속하려면 권리를 확인하고 허락을 받거나 오리지널 자산으로 교체해야 합니다.
- 전체 라이선스/배포 고지는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), Live2D 원문/재배포 참고 파일은 `assets/licenses/live2d/`, SUITE OFL 전문은 `assets/licenses/fonts/LICENSE`에 보관합니다.
- 비디오 컷신 재생 중 탭 전환/브라우저 포커스 이탈 후 복귀하면 자동으로 재생 복구를 시도합니다. (`visibilitychange`, `focus`, `pageshow`)
- `HOLD TO SKIP` 게이지는 누름 해제 후 재시작 시 0%부터 즉시 동기화되어 숫자 표시와 동일하게 진행됩니다.
