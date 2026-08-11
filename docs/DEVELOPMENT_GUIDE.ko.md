# YAVN (야븐) 개발 가이드

이 문서는 YAML V3 기준의 제작/유지보수 가이드입니다.

## 1) 빠른 시작

```bash
pnpm install
pnpm dev
```

- 권장 런타임: Node.js `22.x` (pnpm `10.x`)
- `/`: YAVN 플레이그라운드 (대표 게임 쇼케이스/게임 라이브러리/ZIP 실행)
- `/game-list/:gameId`: `public/game-list/<gameId>/` 실행

## 1-1) 런처 게임 목록 메타 (Manifest V4)

- `predev`/`prebuild`에서 `scripts/generate-game-list-manifest.mjs`를 실행해 `public/game-list/index.json` + `public/sitemap.xml`을 생성하고, 이어서 `scripts/check-public-allowlist.mjs`로 `public` 허용 목록을 검증합니다.
- 최신 스키마는 `schemaVersion: 4`입니다.
- `games[]` 필드:
  - 기본: `id`, `name`, `path`
  - 확장: `author`, `version`, `summary`, `thumbnail`, `tags`, `showcase`, `chapterCount`, `seo`
- `seo` 루트 필드:
  - `title`, `description`, `keywords`, `gameTitles`, `gameCount`
- `chapterCount`는 게임 폴더 하위 전체 YAML 중 `config/base/launcher`를 제외한 챕터 파일 수를 기록합니다.
- 런처는 V1(`id/name/path`) manifest도 파싱하도록 하위 호환을 유지합니다.
- `games[].seo`는 `config.yaml.seo`를 우선 사용하고, 누락 값은 `launcher.yaml.summary/tags` 및 썸네일 fallback으로 보완됩니다.
- sitemap의 `/game-list/<gameId>/` 항목은 manifest `games[].path`를 기준으로 자동 생성됩니다.
- `pnpm build`의 마지막 단계는 `scripts/generate-game-seo-pages.mjs`를 실행해 각 manifest 게임의 `dist/game-list/<gameId>/index.html`을 생성합니다.
- Vercel은 `/game-list/:gameId/` 요청을 해당 정적 HTML로 연결합니다. 검색/공유 크롤러는 클라이언트 JavaScript를 실행하지 않아도 게임별 `title`, `description`, canonical, Open Graph, Twitter Card, `VideoGame` JSON-LD를 받습니다.
- `seo.image`는 화면 에셋과 분리할 수 있으며, 소셜 미리보기 호환성을 위해 16:9 JPEG 또는 PNG를 권장합니다.

선택 메타 파일:
- `public/game-list/<gameId>/launcher.yaml` (선택)
- 허용 키: `summary`, `thumbnail`, `tags`, `showcase`
- 이 파일은 런처 전용이며 엔진 DSL 스키마(`config/base/chapter`)와 분리됩니다.
- `launcher.yaml.thumbnail`이 없고 `config.yaml.startScreen.image`가 있으면 manifest 생성 시 해당 이미지를 기본 썸네일로 사용합니다.
- `showcase.label`은 캐러셀 상단 라벨, `backgroundColor`는 3/4/6/8자리 hex 배경색입니다.
- `showcase.image`는 `positionX/positionY(0..100)`, `scale(0.5..2)`, `offsetX/offsetY(-50..50)`를 지원하며 범위를 벗어난 숫자는 manifest 생성과 런타임 파싱에서 안전하게 보정됩니다.

예시:

```yaml
summary: "런처에 표시할 게임 설명"
thumbnail: "assets/ui/launcher-preview.jpg"
tags:
  - interaction
showcase:
  label: "INTERACTION DEMO"
  backgroundColor: "#171b24"
  image:
    positionX: 38
    positionY: 35
    scale: 1.08
    offsetX: 18
```

## 1-2) 게임 독립성 원칙

- URL 실행은 YAML을 `js-yaml`로 객체화한 뒤 `src/parser.ts`의 Zod 스키마/참조 검증, `src/engine.ts`의 공통 액션 실행, `src/store.ts`의 상태 갱신 순서로 처리합니다.
- ZIP 실행도 파일 공급 방식만 다르고 같은 파서와 엔진을 사용합니다.
- `src/App.tsx`는 게임 ID, 제목, 캐릭터명을 조건으로 렌더링하지 않습니다. 런처 구도도 `launcher.yaml -> index.json`의 `showcase` 데이터만 읽습니다.
- `src/gameIndependence.test.ts`는 번들 샘플 ID와 과거 샘플 전용 태그/CSS 분기가 런타임에 다시 들어오는 것을 차단합니다.

## 1-3) Public 허용 목록 정책

- URL 게임 실행 호환을 위해 `public/game-list/**` 전체는 공개 경로로 유지합니다.
- `public` 루트 허용 파일은 `favicon.svg`, `robots.txt`, `sitemap.xml`입니다.
- 위 경로 외 파일은 `pnpm run check:public`에서 실패 처리됩니다.
- 게임 런타임 비필수 파일(문서/라이선스/아카이브)은 저장소 루트 `assets/`로 이동해 관리합니다.

## 2) YAML V3 핵심 구조

YAML V3는 파일 역할을 분리합니다.

1. `config.yaml` (루트, 필수): 전역 유니크 값
2. `base.yaml` (폴더별, 선택): 공통 `assets`, `state`, `inventory`
3. 챕터 YAML (`0.yaml`, `1.yaml`, `routes/*/1.yaml` 등): `script`, `scenes`

레거시 `meta/settings` 포맷은 지원하지 않습니다.

## 3) `config.yaml`

허용 키:
- `title`
- `author` (`string` 또는 `{ name?, contacts? }`)
- `version`
- `seo`
- `textSpeed`
- `autoSave`
- `clickToInstant`
- `ui`
- `startScreen`
- `endingScreen`
- `endings`
- `endingRules`
- `defaultEnding`

예시:

```yaml
title: "명탐정 코난 외전: 다실의 비밀"
author:
  name: "uiwwsw"
version: "4.1"
seo:
  description: "검색/공유용 게임 설명"
  keywords:
    - 추리
    - 비주얼노벨
  image: assets/bg/title.png
  imageAlt: "대표 이미지 설명"
textSpeed: 38
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
      var: truth_point
      op: gte
      value: 4
    ending: true_end
defaultEnding: bad_end
```

노트:
- `endings/endingRules/defaultEnding`은 `config.yaml`에만 선언합니다.
- `ui.template` 허용값은 `cinematic-noir`, `neon-grid`, `paper-stage`입니다.
- `ui`를 생략하면 기본 템플릿 `cinematic-noir`가 적용됩니다.
- `startScreen` 객체를 선언하면 기본 활성화(`enabled: true`)됩니다.
- `startScreen.showTitle`은 기본 `true`입니다. 타이틀 이미지에 게임명이 이미 포함된 경우 `false`로 설정하면 시각적 제목 오버레이만 숨기며 SEO 메타 제목은 유지합니다.
- `startScreen.titleColor`는 시작 화면 게임 제목의 CSS 색상입니다. `#ffe0a3`, `rgb(...)`, `oklch(...)` 등을 사용할 수 있고, 생략하면 `ui.template`의 제목색을 유지합니다.
- `startButtonText` 기본값은 `시작하기`, `buttonPosition` 기본값은 `auto`입니다.
- `startScreen.music`을 지정하면 시작 화면에서만 BGM을 반복 재생하고, 시작/이어하기 시점에 정지합니다.
- `endingScreen.image`를 지정하면 엔딩 크레딧 오버레이 배경을 교체합니다.
- `seo`는 런처 및 `/game-list/:gameId` 페이지의 `description/keywords/og/twitter/json-ld` 생성에 사용됩니다.
- `seo.image`는 상대 경로(`assets/...`)와 절대 URL(`https://...`)을 모두 허용하며, 상대 경로는 게임 루트 기준으로 정규화됩니다.

## 4) `base.yaml`

허용 키:
- `assets`
- `state`
- `inventory`

금지:
- `script`, `scenes`
- `title`, `seo`, `textSpeed`, `ui`, `startScreen`, `endingScreen`, `endings` 계열
- `meta`, `settings`

예시:

```yaml
assets:
  backgrounds:
    tea_room: assets/bg/tea_room.avif
  characters:
    conan:
      base: assets/char/conan/base.webp
      facing: left
      defaultFraming: full
      framings:
        full: { scale: 1 }
        bust: { scale: 1.5, y: -2 }
        closeup: { scale: 1.9, y: -4 }
      emotions:
        serious: assets/char/conan/serious.webp
  music:
    mystery: assets/music/mystery.wav
  sfx:
    thunder: assets/sfx/thunder.wav
state:
  trust: 0
  suspect: ""
inventory:
  clue_note:
    name: "현장 메모"
    description: "탐문 중 확인한 단서를 정리한 메모다."
    image: assets/bg/case_board.avif
```

## 5) 챕터 YAML

필수 키:
- `script`
- `scenes`

선택 키:
- `assets`
- `state`
- `inventory`

금지:
- `title`, `seo`, `textSpeed`, `ui`, `startScreen`, `endingScreen`, `endings` 계열
- `meta`, `settings`

예시:

```yaml
script:
  - scene: intro

scenes:
  intro:
    actions:
      - bg: tea_room
      - say:
          text: "시작"
```

## 6) 병합 규칙

레이어 순서:
1. `config.yaml`
2. 루트 `base.yaml`
3. 하위 폴더 `base.yaml` (상위 -> 하위)
4. 챕터 YAML

우선순위:
- 자식 우선
- `assets`는 `backgrounds/characters/music/sfx` 키 단위 병합
- `state`는 키 단위 병합
- `inventory`는 아이템 키 단위 병합(자식 레이어가 같은 키를 덮어씀)
- 동일 state 키 타입 충돌 시 에러
- 작성 DSL은 `state` 평면 맵을 사용하고, 런타임 내부 표현은 `state.defaults`로 정규화됩니다.
- 작성 DSL은 `inventory` 평면 맵을 사용하고, 런타임 내부 표현은 `inventory.defaults`로 정규화됩니다.
- `script/scenes`는 챕터 YAML만 사용

## 7) 경로 규칙

- `/...`: 게임 루트 기준
- `root:/...`: 같은 배포의 `public` 루트 기준. 게임 간 공유 에셋에 사용
- `./...`, `../...`: 선언한 YAML 파일 위치 기준
- `assets/...` 같은 bare 경로: 선언한 YAML 파일 위치 기준

내부에서는 asset/video 경로를 루트 기준 canonical key로 정규화해 병합/캐시/프리로드에 사용합니다.

## 8) 챕터 로딩 규칙

- `0.yaml` 존재 시 `0,1,2...`
- 아니면 `1.yaml`부터 `1,2,3...`
- `goto: ./routes/seiji/1.yaml` 형태의 챕터 점프 지원
- 점프 대상부터 같은 폴더의 번호 파일을 순차 진행
- `../`를 포함한 챕터 `goto`는 지원하지 않음
- 번호가 연속된 직선 챕터는 마지막에 `goto`를 다시 선언하지 않아도 엔진이 다음 번호로 자동 진행합니다. Conan의 `0 -> 1 -> 2` 구간은 이 규칙을 사용해 진행도와 프리로드 시퀀스를 유지합니다.
- 챕터 프리로드는 전체 `assets` 선언이 아니라 현재 챕터 action에서 참조하는 배경, 캐릭터/표정, 스티커, 획득 아이템 이미지와 Live2D 의존성만 수집합니다. 오디오/비디오는 재생 시점의 브라우저 스트리밍 정책을 유지합니다.
- 프리로드 순서는 `script`의 첫 scene부터 유지하며 일반 네트워크는 최대 4개, 데이터 절약/2G는 최대 2개까지 병렬 처리합니다.
- 프리로드 이미지의 `load` 이벤트와 실제 `decode()` 완료를 구분해 기다립니다. 첫 장면을 DOM에 반영한 뒤에도 현재 배경·정적 캐릭터 이미지와 Live2D의 준비 상태를 확인한 후 로딩 오버레이를 닫습니다. 이미 준비한 에셋 URL은 같은 실행 세션에서 다시 처리하지 않으며, 선형 다음 챕터는 300ms 뒤 백그라운드 예열하되 데이터 절약/2G에서는 생략합니다.
- 로딩 연출의 최소 노출 시간은 첫 챕터 240ms, 이후 챕터 100ms이며 완료 hold는 80ms입니다.
- 로딩 오버레이는 첫 화면의 배경·이미지 캐릭터가 전송과 디코딩을 끝내고, 노출 Live2D 캐릭터가 실제 `ready/error`를 보고할 때까지 유지되며 이후에만 `loaded`로 전환됩니다. 정적 이미지 준비 대기는 실패나 12초 timeout을 로깅한 뒤 진행해 영구 정지를 막습니다.
- 챕터 로딩 중(`chapterLoading=true`)과 `setGame` 완료 전 상태에서는 다이얼로그 박스(`.dialog-box`)를 `opacity: 0`으로 숨기고, 해제 시 페이드 인합니다.
- 인게임 다이얼로그 우측 상단(박스 외부 컨트롤 레이어) `숨기기` 버튼으로 수동 숨김을 토글할 수 있으며, 버튼은 본문 텍스트와 겹치지 않습니다. 숨김 상태에서는 우측 하단 `대화창 열기` 버튼만 노출됩니다.
- 수동 숨김 상태에서는 클릭/`Enter`/`Space` 진행 입력을 차단해 의도치 않은 스크립트 진행을 방지합니다.
- 시스템 숨김 상태(챕터 로딩/게임 미로딩/컷신)에서는 캐릭터/스티커 레이어 하단 안전 여백(`stickerSafeInset`) 기준을 유지해, 최초 다이얼로그 표시 시 레이어 높이 점프를 방지합니다.
- 수동 숨김/복원 상태 변화는 캐릭터/스티커 레이어 하단 안전 여백(`stickerSafeInset`) 계산에도 즉시 반영됩니다.
- 스티커·증거물은 화면 전체가 아니라 HUD·다이얼로그·기기 safe-area를 제외한 `.sticker-safe-frame`을 좌표 기준으로 사용합니다. 이미지 로드와 프레임 리사이즈마다 실제 렌더 경계를 측정해 균일 축소율과 최소 이동 거리를 계산하므로 큰 원본·고정 px·회전 에셋도 종횡비를 유지하며 프레임 안으로 들어옵니다.

## 8-0) 에피소드형 탐문 라운지 패턴 (Conan 샘플)

- `0.yaml`에서 평온한 콜드 오픈을 제시하고 `1.yaml`로 연결합니다.
- `1.yaml`은 4인 갈등 -> 사건 발생(하루오 사망 + 다잉 메시지)까지 담당하고, `2.yaml`은 초동 정리와 재구성으로 역할을 분리합니다.
- 루트 `0.yaml`, `1.yaml`, `2.yaml`은 연속 번호 자동 진행을 사용하며 각 파일 끝에 중복 챕터 `goto`를 두지 않습니다.
- `2.yaml` 종료 후 `goto: /routes/hub/1.yaml`로 이동해 자유 조사 라운드에 진입합니다.
- 라운지 챕터 권장 흐름:
- `all_done_check` -> 방문 완료 여부 분기
- `route_select` -> 인물 루트 선택 또는 조기 정리 회의 선택
- `early_exit_confirm`/`early_exit_penalty_branch` -> 조기 이동 패널티 적용
- 조사 라인은 `routes/<line>/1.yaml`로 분리하고, 완료 후 라운지로 복귀합니다.
- 라인 공통 패턴:
- `entry_guard -> intro -> first_probe -> retry_notice -> second_probe -> outro`
- 재도전은 상태 bool 없이 scene 분리(1차 시도/재시도)로 1회 제한 UX를 구성할 수 있습니다.
- 플레이어 노출 문구는 `탐문`, `대면`, `단서 정리실/조사 라운지` 톤을 유지합니다.

## 8-1) `script`/`goto` 실행 모델

- `script`는 챕터의 기본 scene 진행 순서입니다.
- 실행 시작 scene은 항상 `script`의 첫 항목입니다.
- 현재 scene의 action이 끝나고 명시적 `goto`가 없으면, `script`의 다음 scene으로 자동 진행합니다.
- `goto: <sceneId>`는 scene 점프입니다. 점프 대상 scene 종료 후에는 그 scene의 `script` 다음 scene으로 진행합니다.
- `goto: ./...` 또는 `goto: /...`는 챕터 점프입니다. 대상 파일부터 같은 폴더의 번호 챕터를 순차 로드합니다.
- 권장: `goto`로 이동 가능한 scene은 모두 `script`에도 포함해 흐름을 명시적으로 유지합니다.

## 8-2) Resolver/캐시 동작

- URL 로딩과 ZIP 로딩은 동일한 resolver 흐름(`config -> base layers -> chapter merge`)을 사용합니다.
- 캐시는 다음 단위로 분리됩니다.
- 원문 YAML 텍스트 캐시
- YAML 존재 여부 캐시
- 파싱 결과 캐시(`config/base/chapter`)
- 최종 챕터 병합 결과 캐시
- 동일 챕터 재진입 시 재fetch/재parse 대신 캐시를 재사용합니다.

## 8-3) 엔딩 `처음부터 다시하기` 버튼 동작

- 엔딩 화면 하단 버튼은 `처음부터 다시하기` 1개만 노출합니다.
- 엔딩 크레딧 롤 영역은 초기 자동 스크롤 구간에서 입력을 잠그며(`pointer-events: none`), 자동 스크롤이 멈춘 뒤에만 수동 스크롤을 허용합니다.
- URL 게임에서는 인벤토리 모달의 `초기화면 가기`와 동일한 흐름으로 Start Gate 세션 플래그를 초기화하고, 인게임 BGM 정지 후 Start Gate(시작 화면)로 복귀합니다.
- ZIP 실행 게임(또는 게임 ID를 판별할 수 없는 경로)에서는 `restartFromBeginning()`으로 첫 챕터 재시작을 수행합니다.
- `restartFromBeginning()` 경로에서는 현재 게임의 자동저장을 지우고 첫 챕터 시작점을 새로 기록합니다. 사용자가 직접 만든 수동 저장은 유지합니다.
- `vn-ending-progress:<gameId>`는 유지되므로 획득한 엔딩 기록은 지워지지 않습니다.

## 8-4) 모바일 확대(Zoom) 방지 동작

- `index.html` viewport는 `maximum-scale=1.0`, `user-scalable=no`를 사용합니다.
- 런타임은 iOS 제스처 이벤트(`gesturestart/change/end`)와 멀티터치 `touchmove`를 차단해 확대를 방지합니다.

## 8-5) 캐릭터 레이어/정렬 동작

- 배경(`.bg`)과 시스템 로딩/엔딩 오버레이는 전체 뷰포트를 유지합니다.
- 실제 플레이 UI는 `.stage-content-frame` 안에서 렌더링합니다. 프레임 높이는 `min(100%, 100vw × 16 / 9)`이고 세로 중앙 정렬되므로, `9:16`보다 긴 화면에서만 위아래 여백이 생기며 일반 모바일·가로 화면의 기존 구도는 바뀌지 않습니다.
- 프레임에는 캐릭터·스티커·HUD·다이얼로그·선택/입력·컷신·CASE FILE이 함께 들어가므로 서로 다른 좌표계를 사용해 벌어지지 않습니다.
- 캐릭터 레이어(`.char-layer`)의 하단 경계는 중앙 프레임 안의 다이얼로그 박스 상단 위치와 동일하게 맞춥니다.
- 캐릭터는 레이어 하단(`bottom: 0`) 기준으로 배치되어, 대화창 위에 떠 보이지 않도록 고정됩니다.
- 이미지 캐릭터(`.char-image`)는 `object-position: center bottom`으로 하단 정렬됩니다.
- 화자 강조는 데스크톱/모바일 공통 규칙으로 동작합니다. 현재 화자는 소폭 전면(scale)으로 표시하고, 비화자는 `speakerOrder` 순위에 따라 이미지 밝기(`brightness`)를 단계적으로 낮춰 depth를 표현합니다. 캐릭터 레이어 `opacity`는 고정(1)으로 유지됩니다.
- 실제 노출 캐릭터가 정확히 두 명이면 `.char-layout-duo`가 자동 적용되어 두 인물을 화면 25%/75% 지점에 배치합니다. 좌우는 `left -> center -> right` 슬롯 순서를 따르며 화자 변경으로 뒤집히지 않습니다.
- 2인 중 한 명이 퇴장하면 같은 ID와 슬롯에 남은 인물은 이전 25%/75% 위치와 2인용 너비를 유지합니다. 새 인물로 교체되거나 동일 인물이 다른 슬롯으로 이동하면 이 기억을 상속하지 않습니다.
- 2인 자동 분할은 이미지와 Live2D 모두 지원합니다. 처음부터 1인이거나 새 인물로 교체된 장면 및 3인 장면은 작성자가 지정한 기존 슬롯 배치를 유지하며 별도 DSL 필드는 없습니다.
- 같은 캐릭터 ID를 새 `position`에 배치하면 엔진은 해당 ID가 있던 이전 슬롯을 먼저 제거합니다. 장면 전환에서 `center -> left`처럼 위치를 바꿔도 동일 인물이 두 슬롯에 남지 않습니다.
- 같은 `position`의 이미지 캐릭터가 감정 소스만 바꾸면 렌더 키를 유지합니다. 따라서 표정 교체 때 최초 등장 애니메이션이 재실행되지 않으며, 이미지 박스는 고정 반응형 폭을 사용해 원본 종횡비 차이로 좌우 기준점이 흔들리지 않습니다.
- 같은 캐릭터의 `framing`만 바꾸면 이미지/Live2D 슬롯과 원본 소스를 재사용한 채 등록된 `scale/x/y`를 적용합니다. 감정 이미지 교체와 저장 복원에서도 현재 구도 이름을 유지합니다.
- 캐릭터 원본에 `facing: left|right|front`를 선언하면 좌우 슬롯과 2인 자동 분할의 실제 화면 절반을 기준으로 서로를 바라보게 수평 반전합니다. 단독 중앙 컷은 원본 시선을 유지하고, `front` 또는 미지정 원본은 반전하지 않습니다.
- 구도 배율은 화자 depth 배율과 곱해지며, 구도 `x/y`는 슬롯 오프셋과 합성됩니다. 수평 슬롯은 전환하지 않고 구도 배율만 260ms 시네마틱 이징으로 전환합니다.
- 캐릭터가 처음 노출될 때의 기본 `riseInSide`/`riseInCenter`는 현재 배치 위치에서 `10px` 위로 올라오는 페이드입니다. 화면 밖 왼쪽에서 진입하는 동작은 기본 규칙이 아닙니다.
- 새 인물 노출이나 1인/2인 구도 전환으로 수평 슬롯 오프셋이 바뀌어도 `transform` 전환은 적용하지 않습니다. 수평 좌표는 최종 위치로 즉시 확정하고, 화자 depth 확대만 독립 `scale` 속성으로 전환해 옆에서 밀려오는 것처럼 보이지 않게 합니다. 단, 2인에서 한 명만 퇴장한 경우 남은 동일 인물은 이전 2인 좌표와 너비를 그대로 유지해 재배치 점프를 만들지 않습니다.
- 모바일 전용 화자 확대(`order===1`일 때만 scale 1, 나머지 0.7) 규칙은 제거되었습니다.
- 다이얼로그가 수동 숨김 상태면 레이어 하단 inset을 `0`으로 강제해 캐릭터/스티커가 중앙 플레이 프레임 전체를 사용하고, 복원 시 프레임 기준 inset 계산을 즉시 재개합니다.

## 8-6) 선택/입력 게이트 키보드 동작

- `choice` 게이트가 열리면 첫 번째 옵션 버튼에 자동 포커스됩니다.
- `choice` 게이트는 일반 대사의 높이 예약을 해제하고 최대 높이를 플레이 프레임의 데스크톱 `46cqh`, 모바일 `48cqh`까지 확장합니다. 720px 데스크톱과 일반 세로 모바일에서도 짧은 4개 보기를 상태줄에 가리지 않고 한 화면에 표시하며, 그보다 긴 선택 묶음은 본문 영역에서 스크롤합니다.
- 포커스된 옵션은 `Enter`/`Space` 키로 즉시 선택할 수 있습니다.
- `input` 게이트는 입력값이 비어 있을 때 제출 버튼 라벨을 `모르겠다`로 표시하고, 값이 있으면 `확인`으로 표시합니다.
- `input` 게이트는 마지막 오답 단계(`attemptCount >= errors.length`)에 도달하면 입력창에 `correct` 값을 자동으로 채웁니다.
- 모바일 환경(터치/coarse pointer)에서는 `input` 게이트 진입 시 입력창 자동 포커스를 생략해 가상 키보드가 즉시 열리지 않도록 합니다.
- `sticker.inputLockMs`가 설정된 스티커 액션이 실행되는 동안에는 `input` 제출/`choice` 선택이 잠기며, 지정 시간이 끝난 뒤 다음 액션으로 자동 진행됩니다.
- `say.wait`가 설정된 대사는 시작 시점부터 지정 시간 동안 진행/스킵 입력(클릭/`Enter`/`Space`)이 잠깁니다.

## 8-7) Live2D 런타임 로딩 동작

- 캐릭터 자산 경로가 `*.json`(`model3.json` 포함)이면 Live2D 렌더러를 사용합니다.
- 런타임은 `easy-cl2d`와 공식 `live2dcubismcore.min.js`를 사용합니다.
- Cubism Core는 번들 자산 경로 `src/assets/third-party/live2d/live2dcubismcore.min.js`에서 로드합니다.
- 코어 스크립트는 Vite `?url` 번들 URL을 사용해 정적 공개 경로 의존을 제거하고 캐시 버스팅을 적용합니다.
- Cubism Core v53에서 `drawables.renderOrders`가 비어 있고 `model.getRenderOrders()`만 존재하는 경우를 런타임 호환 패치로 보정합니다.
- Live2D 중앙 배치에서 CSS `transform` 기반 오프셋을 제거해 포인터 좌표(클릭/드래그 시 시선 반응) 불일치를 완화합니다.
- `easy-cl2d` 입력 좌표는 캔버스 `offsetLeft/offsetTop` 대신 `getBoundingClientRect()` 기준 로컬 좌표로 보정하고, 캔버스 내부에서 시작한 포인터만 드래그 추적해 슬롯 위치(`left/center/right`)별 시선 반응 편차를 줄입니다.
- 캔버스 리사이즈는 `devicePixelRatio`를 반영한 드로잉 버퍼 크기(`clientWidth/Height * DPR`)를 사용해 고해상도 화면에서 입력 좌표와 렌더 좌표 불일치를 완화합니다.
- URL 기반 게임은 `model directory + relative file references` 방식으로 로드해 텍스처/모션 경로를 안정적으로 해석합니다.
- ZIP(blob URL) 로딩은 `model3.json`의 blob 절대 참조를 모델 디렉터리 기준 상대 키로 재작성해 동일 런타임 경로 규칙을 유지합니다.
- 챕터 프리로드 단계에서 `model3.json`을 파싱해 `Moc/Physics/Pose/UserData/DisplayInfo/Textures/Expressions/Motions` 참조 자산을 재귀 큐로 선로딩합니다.
- 첫 scene pause 시점에 노출된 Live2D 슬롯(`left/center/right`)의 ready/error 신호를 수집해 로딩 오버레이 해제 시점을 동기화합니다.
- 로딩 전에 `Moc`와 첫 `Textures[]` 항목을 선검사하고, 실패 시 즉시 오류 문구를 표시합니다.
- 로딩이 장시간 완료되지 않으면 내부 `state`/텍스처 카운트를 기반으로 정체(stalled) 진단 메시지를 표시합니다.
- Cubism Core 또는 모델 리소스 로드 실패 시 캐릭터 레이어에 오류 문구를 표시합니다.
- Live2D 코어/샘플 모델 자산은 별도 라이선스가 적용되므로, 재배포/상업 이용 시 원본 라이선스 문구와 조건을 반드시 확인합니다.
- 관련 라이선스 참고 문구는 `assets/licenses/live2d/RedistributableFiles.txt`, `assets/licenses/fonts/LICENSE`에 보관합니다.

## 8-8) 비디오 컷신 재생 복구/스킵 게이지 동작

- 컷신(`video`) 재생 중 브라우저 포커스 이탈 또는 탭 비가시 상태가 발생해도, 복귀 시 자동 재생 복구를 시도합니다.
- 복구 트리거는 `visibilitychange(visible)`, `focus`, `pageshow` 이벤트입니다.
- 네이티브 `<video>`가 가시 상태에서 일시정지되면 즉시 `play()`를 재시도합니다.
- YouTube 컷신은 Player API 명령(`playVideo`)으로 복귀 재생을 재요청합니다.
- `HOLD TO SKIP` 진행바는 포인터 해제 후 재누름 시 0%부터 즉시 갱신되어 퍼센트 텍스트와 시각 상태가 어긋나지 않습니다.

## 8-9) 시작 화면(Start Gate) + 저장 키 동작

- `config.yaml.startScreen`이 없으면 시작 화면은 비활성화됩니다. (기존 즉시 실행과 동일)
- `startScreen` 객체를 선언하고 `enabled: true`면 시작 화면을 노출합니다.
- `startScreen.titleColor`가 있으면 Start Gate 제목의 `--start-gate-title-color` 토큰을 게임별 값으로 덮어씁니다. URL·ZIP 프리뷰와 초기화면 복귀에 동일하게 적용됩니다.
- `showTitle: false`인 내장 타이틀 이미지는 모바일 세로 화면에서 어두운 `cover` 배경 위에 별도 전경 이미지로 표시합니다. 이때 원본 비율을 유지해 이미지 안의 제목이 좌우로 잘리지 않으며, 데스크톱과 모바일 가로 화면은 기존 `cover` 구성을 유지합니다.
- 버튼 기본값:
  - 시작 버튼 텍스트 `startButtonText`: `시작하기`
  - 버튼 위치 `buttonPosition`: `auto`
- `startScreen.music`을 지정하면 시작 화면에서만 루프 재생됩니다.
- 챕터의 `music` 액션으로 로컬 오디오 트랙이 바뀌면 이전 곡과 새 곡이 약 420ms 동안 크로스페이드됩니다. 같은 에셋 키를 연속 지정하면 재생 위치를 유지합니다.
- 배경음악 끄기, 초기화면 이동, 명시적 BGM 정지는 크로스페이드 대기 없이 즉시 반영됩니다. YouTube BGM 전환은 기존 Player API 동작을 유지합니다.
- URL 게임(`/game-list/:gameId`)의 자동저장 키는 `vn-engine-autosave:game:<gameId>`를 사용합니다. 수동 저장과 챕터 시작점은 같은 키에 각각 `:manual`, `:chapter` 접미사를 붙입니다.
- ZIP 게임은 파일명과 크기를 조합한 `vn-engine-autosave:zip:<fingerprint>` 키를 사용해 서로 다른 ZIP의 저장 충돌을 막습니다. 같은 ZIP을 다시 올리면 해당 저장을 복원할 수 있습니다.
- `config.yaml.autoSave`는 첫 실행 기본값입니다. 플레이어가 시스템 탭에서 변경한 값은 게임별 설정에 보관되며 이후에는 플레이어 값이 우선합니다.
- 자동저장은 진행 커서가 바뀔 때 갱신합니다. 수동 저장은 HUD 저장 버튼에서 실행하며, 챕터 시작점은 자동저장 설정과 관계없이 챕터 진입 시 항상 기록합니다.
- 시스템 탭에서 자동 저장은 최신 시각과 작동 상태만 표시합니다. 일반 플레이 중 자동 저장 직접 불러오기는 숨기고, 수동 저장/불러오기·챕터 복귀·JSON 백업만 명시적 작업으로 제공합니다.
- 자동 저장은 시작 화면 `이어하기`와 게임오버의 `직전 선택으로`에서 내부 복구점으로 사용합니다. 백업은 진행 상태만 포함하며 현재 게임 제목이 다른 파일은 거부합니다.
- 브라우저 보안상 엔진이 임의의 특정 폴더에 자동 기록하지 않습니다. 기본 저장은 `localStorage`, 장치 이동은 사용자가 다운로드 위치를 선택하는 백업 파일을 사용합니다.
- 레거시 키(`vn-engine-autosave`)는 URL 로드시 fallback으로 읽고, 실제 resume 성공 시 게임별 키로 마이그레이션합니다.
- 시작 화면의 `이어하기` 버튼은 URL 게임에서만 노출하며, ZIP 실행에서는 노출하지 않습니다.
- 같은 탭 세션에서 시작/이어하기를 한 번 누르면 `sessionStorage` 플래그로 새로고침 시 시작 화면을 건너뜁니다.
- 인벤토리 모달의 `초기화면 가기` 버튼은 URL 게임에서만 활성화되며, 해당 `sessionStorage` 플래그를 지우고 현재 인게임 BGM을 즉시 정지한 뒤 Start Gate를 다시 표시합니다.
- 런처 쇼케이스/게임 카드 썸네일 우선순위는 `launcher.yaml.thumbnail` -> `config.yaml.startScreen.image` 순서입니다.
- 루트 런처는 manifest의 모든 게임을 전체 폭 데모 캐러셀로 렌더링합니다. 유효한 `#demo=<gameId>` 해시가 있으면 해당 게임을 열고, 해시가 없으면 manifest 첫 게임을 일관되게 선택합니다.
- 캐러셀의 라벨, 배경색, 썸네일 위치/배율/오프셋은 `launcher.yaml.showcase`에서 생성된 manifest 데이터로만 결정되며 게임 ID와 태그는 표현 분기에 사용하지 않습니다.
- 스와이프·마우스 드래그·좌우 화살표·키보드 `←`/`→`/`Home`/`End`·인디케이터 선택은 같은 캐러셀 상태와 URL 해시를 갱신합니다. 검색·태그 필터는 아래 직접 실행 목록에만 적용되며 상단 캐러셀 선택에는 영향을 주지 않습니다.
- 이전/다음 버튼, 선택 도트, 현재 게임명/번호는 슬라이드 바깥의 전용 탐색 레일에 배치해 긴 제목·요약·실행 버튼과 겹치지 않도록 합니다.
- 각 캐러셀 슬라이드는 `layout/paint` 경계를 별도로 갖고 이미지·텍스트를 슬라이드 내부에서 클리핑합니다. 제목·요약·태그·게임 카드의 긴 문자열은 컨테이너 폭 안에서 줄바꿈되며, 좁은 화면의 태그 행만 내부 가로 스크롤을 허용합니다.
- 시작 화면 타이틀/버튼(`시작하기`, `이어하기`)은 `config.yaml.ui.template` 전역 템플릿(`cinematic-noir` | `neon-grid` | `paper-stage`)을 그대로 적용합니다.
- 시작 화면은 배경 카메라 인, 비네트·테마 프레임, 타이틀/액션 순차 등장 연출을 기본 적용합니다. 실행 버튼을 누르면 `aria-busy`와 진행 중 라벨을 함께 노출해 중복 입력을 막고, `prefers-reduced-motion`에서는 모든 장식 모션을 정지합니다.
- 시작 화면이 표시되는 동안에도 `config.yaml.seo`를 읽어 `description/keywords/og/twitter/json-ld`를 즉시 갱신합니다.
- 배포 빌드에서는 같은 `config.yaml.seo`가 게임별 정적 HTML에도 반영됩니다. 런타임 갱신은 SPA 내부 상태 전환을 담당하고, 최초 HTTP 응답의 메타는 빌드 산출물이 담당합니다.
- `config.yaml.endingScreen.image`를 지정하면 엔딩 크레딧 오버레이의 배경 이미지를 커스텀할 수 있습니다.

## 8-10) UI 템플릿 동작

- `config.yaml.ui.template`으로 시작 화면(Start Gate) + 게임 플레이 화면의 전역 UI 템플릿을 선택합니다.
- 허용값: `cinematic-noir`, `neon-grid`, `paper-stage`
- 적용 범위:
  - 시작 화면 타이틀/버튼(`start-gate`)
  - 챕터 로딩 오버레이(`chapter-loading`)
  - 다이얼로그 박스(`dialog-box`)
  - 비디오 `HOLD TO SKIP` 가이드
  - 선택/입력 게이트(`choice`/`input`)
  - 엔딩 크레딧/진행 카드/재시작 버튼
  - 게임오버 복구 화면
- `ui` 미선언 시 기본값은 `cinematic-noir`입니다.
- 템플릿 값은 활성 챕터 게임 해석 직후 스토어에 반영되어, `setGame` 이전 프리로드 로딩 구간에도 동일한 스타일이 유지됩니다.

## 8-11) 게임 HUD 상태 표시

- 인게임 HUD는 좌측에 현재 게임 제목(`game.meta.title`)을 표시합니다.
- 기능 없는 우측 상시 안내 문구는 표시하지 않습니다.
- ZIP 업로드 로딩 중(`uploading=true`)에만 우측에 `ZIP 불러오는 중`을 표시합니다.
- 긴 대사·기록·인벤토리·시스템·오류·게임오버·엔딩의 내부 스크롤과 런처 태그 가로 스크롤에는 현재 UI 테마와 구분되는 트랙/손잡이를 표시합니다.

## 8-12) 다이얼로그 수동 숨김/복원 동작

- 다이얼로그 박스 우측 상단(박스 외부 컨트롤 레이어)에 `숨기기` 버튼을 표시합니다.
- 버튼 클릭 시 `dialogUiHidden=true`로 전환하고 다이얼로그 박스를 페이드 아웃합니다.
- 수동 숨김 상태에서는 우측 하단에 작은 `대화창 열기` 버튼을 표시합니다.
- `대화창 열기` 클릭 전까지는 전역 진행 입력(화면 클릭, `Enter`, `Space`)이 엔진 `handleAdvance()`로 전달되지 않습니다.
- 다이얼로그 박스 최대 높이는 게임 화면 가림을 줄이기 위해 `데스크톱 38%`(38cqh), `모바일 48%`(48cqh)로 제한하며, 초과 콘텐츠(긴 대사/입력/선택지)는 내부 스크롤로 처리합니다.
- `choice`가 열리면 일반 대사의 최소 높이 예약을 해제합니다. 한 줄 프롬프트와 3개 옵션은 720px 높이에서도 하단 상태줄과 겹치지 않고 먼저 노출되며, 더 긴 옵션 묶음만 내부 스크롤을 사용합니다.
- 모바일 다이얼로그는 화면 좌우·하단에 최소 10px 외곽 여백을 두며, 노치·홈 인디케이터의 safe-area inset이 더 크면 해당 값을 우선합니다. 선택/입력 컨트롤은 최소 48px 높이를 사용합니다.

## 8-13) 인벤토리 모달 동작

- 인게임 HUD 우측에는 `설정` 텍스트 버튼 대신 가방 기호(원형 아이콘) 버튼을 표시하고, 버튼 하단에 진행 배지(`획득수/전체수`)를 표시합니다.
- 버튼 클릭 시 `가방(획득)`/`도감(전체)` 2탭 인벤토리 모달이 열립니다.
- 모달 상단은 수집 진행 막대를 항상 표시하고, 현재 탭에 탐색할 단서가 있을 때만 검색(이름), 카테고리, 정렬(`order` 우선/이름순)을 제공합니다.
- 빈 가방은 단서 보관 방식을 설명하고 `도감 살펴보기` 버튼을 제공합니다. 검색/카테고리 결과가 비면 `검색 조건 초기화` 버튼으로 두 조건을 함께 해제합니다.
- `도감` 탭의 미획득 아이템은 비활성 잠금 카드(`미발견 단서`)로 표시하며 상세 팝업을 열지 않습니다.
- 모달 본문 그리드는 반응형 고정 열 수를 사용합니다(데스크톱 5열, 태블릿 4열, 모바일 3열, 340px 이하 2열).
- 슬롯 그리드 영역만 스크롤하며, 획득한 슬롯을 누르면 즉시 상세 팝업에 이미지, 카테고리, 설명(`description`)을 표시합니다.
- `획득` 배지는 도감 탭의 획득 카드에만 표시하고, 가방과 미획득 카드에서는 중복 상태 문구를 숨깁니다.
- `Esc` 키로 인벤토리 모달을 닫을 수 있고, 닫힌 뒤 포커스는 HUD 가방 버튼으로 복귀합니다.
- 배경음악 토글과 `초기화면 가기`는 인벤토리 탐색에서 분리해 시스템 탭에 배치합니다. ZIP 실행 게임에서는 초기화면 버튼을 비활성화합니다.
- 케이스 파일 셸은 `ui.template`의 대사/선택/강조 색상 토큰을 재사용하는 기록 보관소 스타일입니다. 인벤토리는 수집 현황과 보기 전환을 하나의 헤더로 묶고, 단서 슬롯에 순번·획득 상태·2줄 이름을 표시하는 전시 카드 형태로 렌더링합니다.
- 시스템 탭은 자동 저장의 작동 상태와 최근 복구 시각을 상단 보호 카드에 표시하고, 수동 저장·챕터 시작점·JSON 백업을 독립 역할 카드로 분리합니다. 데스크톱은 3열, 모바일은 1열이며 현재 진행 저장만 주요 작업 색상을 사용합니다.
- 토글 값은 게임별 키(`vn-engine-settings:<autosave-key>`)로 localStorage에 저장됩니다.
- 인벤토리 `보기 탭/정렬/카테고리` 마지막 선택도 같은 게임별 키로 저장되어 다음 실행 시 복원됩니다.
- 끄기 상태에서는 현재 BGM을 즉시 정지하고, 켜면 현재 트랙 재생을 재시도합니다.
- 모바일에서는 상세 팝업을 하단 시트로 표시하고, 3열을 유지해 한눈에 비교할 수 있게 하되 340px 이하에서만 2열로 줄입니다.

## 9) 액션 목록

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

전체 화면 `effect` 프리셋:
- 기본: `shake(280ms)`, `flash(350ms)`, `zoom(420ms)`, `blur(420ms)`, `darken(500ms)`, `pulse(500ms)`, `tilt(320ms)`
- 트레일러: `impact(460ms)`, `glitch(520ms)`, `speedlines(680ms)`, `alarm(760ms)`, `focus(620ms)`
- 역사/서사: `moonveil(900ms)`, `embers(1100ms)`, `crown(1200ms)`
- 미등록 이름은 약 `350ms` 동안 CSS 상태 클래스로 적용되어 게임별 스타일 확장이 가능합니다.
- `effect`는 즉시 다음 액션으로 진행합니다. 연속 선언은 뒤 이펙트가 앞 이펙트를 교체하므로 순차 재생은 사이에 `wait`를 둡니다.
- 화면 변형 클래스는 문서 크기를 가진 `.app`이 아니라 그 안의 절대 배치 `.effect-viewport`에 적용됩니다. 바깥 `.app`은 paint/overflow 경계로 동작하므로 `shake/zoom/tilt/impact` 중에도 문서 스크롤 영역이 늘어나지 않습니다. 모달, 선택지, 대사 로그처럼 명시적으로 `overflow: auto`인 내부 영역은 계속 스크롤할 수 있습니다.
- `prefers-reduced-motion` 환경에서는 비필수 모션을 비활성화합니다.

### 9-1) `sticker.inputLockMs` 입력 잠금

`sticker` 액션에 `inputLockMs`(ms)를 지정하면, 해당 스티커를 표시한 직후 지정 시간 동안 입력 제출을 잠글 수 있습니다.

```yaml
- sticker:
    id: item_popup
    image: item_tea_residue_report
    width: 22
    y: 30
    inputLockMs: 500
```

실행 규칙:
- 잠금 시간 동안 `input` 제출과 `choice` 선택 버튼이 비활성화됩니다.
- 잠금 시간이 끝나면 현재 액션이 완료되고 다음 액션으로 자동 진행됩니다.

추가 규칙:
- `sticker.enter.duration`, `clearSticker.leave.duration` 사용자 지정은 제거되었습니다.
- 스티커 이펙트 시간은 엔진 기본값(enter `280ms`, leave `220ms`) 고정이며 `effect/easing/delay`만 지정합니다.

### 9-2) `choice` 옵션별 1회 유예

`choice` 액션은 잘못 누른 선택지를 "한 번만 봐주기" 동작으로 처리할 수 있습니다.

- `choice.forgiveOnceDefault` (optional): 해당 choice의 옵션 기본 유예값
- `choice.forgiveMessage` (optional): 기본 유예 문구
- `choice.options[].forgiveOnce` (optional): 개별 옵션 유예값(기본값 override)
- `choice.options[].forgiveMessage` (optional): 개별 옵션 유예 문구

실행 규칙:
- 유예가 활성화된 옵션은 첫 클릭에서 `goto/set/add`를 실행하지 않습니다.
- 같은 옵션을 다시 클릭하면 원래 분기가 실행됩니다.
- 유예 문구 우선순위: `options[].forgiveMessage` -> `choice.forgiveMessage` -> 엔진 기본 문구

### 9-3) `choice`/`input`에서 캐릭터 노출

`say` 액션 없이도 `choice`/`input` 단계에서 캐릭터를 직접 노출할 수 있습니다.

- `choice.char` (optional): 주 캐릭터 참조 (`캐릭터ID` 또는 `캐릭터ID.표정`)
- `choice.with` (optional): 함께 노출할 보조 캐릭터 참조 배열
- `choice.framing` (optional): 주 캐릭터의 등록된 구도 프리셋 이름
- `input.char` (optional): 주 캐릭터 참조 (`캐릭터ID` 또는 `캐릭터ID.표정`)
- `input.with` (optional): 함께 노출할 보조 캐릭터 참조 배열
- `input.framing` (optional): 주 캐릭터의 등록된 구도 프리셋 이름

실행 규칙:
- `char`가 있으면 해당 단계에서 캐릭터 노출/표정 동기화를 즉시 적용합니다.
- `with`를 생략하면 현재 `char` 액션으로 무대에 배치된 인물을 모두 노출합니다. 이 기본 앙상블은 `say` 화자가 바뀌거나 화자 없는 내레이션이 나와도 유지됩니다.
- `with`를 명시하면 화자와 목록에 적은 인물로 화면을 좁힙니다. `with: []`는 화자 단독 컷이고, 화자가 없으면 빈 무대입니다.
- `char` 배치는 해당 scene에서 사용할 수 있는 배우를 올리는 동작이지, 모든 대사에서 물리적으로 같은 장소에 있다는 선언이 아닙니다. 숨기·엿듣기·문 안팎·원거리 장면은 `with`를 생략하지 말고 각 숏에 실제로 보이는 인물만 명시합니다.
- 권장 공간 연출은 `숨은 인물 단독 → 대화 상대 2인 → 숨은 인물 반응 → 발각 뒤 전원`, `문밖 인물 단독 ↔ 문 안 인물 단독`, `원거리 양쪽 단독 → 접근 뒤 2인` 순서입니다. 내레이션도 `with`를 사용할 수 있으므로 보이지 않는 목소리와 빈 환경 컷을 분리할 수 있습니다.
- `framing`이 있으면 `char`의 현재 구도도 함께 변경합니다. `framing`만 단독 선언할 수는 없습니다.
- `char`를 생략하면 대사 화자만 없고 현재 무대 앙상블은 유지합니다.

### 9-3-1) 한 원본 이미지의 캐릭터 구도 프리셋

캐릭터마다 원본의 여백과 인물 비율이 다르므로, `assets.characters.<id>.framings`에 전신·상체·클로즈업 보정값을 따로 저장합니다.

```yaml
assets:
  characters:
    deokman:
      base: assets/char/deokman.webp
      facing: left
      defaultFraming: full
      framings:
        full: { scale: 1 }
        bust: { scale: 2 }
        closeup: { scale: 2.5, x: 1, y: 1 }

scenes:
  audience:
    actions:
      - char: { id: deokman, position: center, framing: full }
      - say:
          char: deokman
          framing: bust
          text: "전하께 드릴 말씀이 있습니다."
      - choice:
          char: deokman
          framing: closeup
          prompt: "왕이 잔을 든다. 지금 막을까?"
          options:
            - { text: "대신 마신다", goto: drink }
            - { text: "상을 엎는다", goto: stop }
```

필드와 범위:
- `defaultFraming` (optional): `char.framing` 생략 시 사용할 프리셋 이름
- `facing` (optional): 원본의 고유 시선 `left | right | front`. 좌우 대화 구도에서 화면 안쪽을 보도록 자동 반전하며, 미지정이면 기존 방향을 유지
- `framings.<name>.scale` (required): `0.5..3` 배율
- `framings.<name>.x/y` (optional): `-100..100` 범위의 이미지 기준 퍼센트 이동값, 기본 `0`
- `char.framing`: 무대 배치 시 적용하는 지속 구도
- `say.framing`, `choice.framing`, `input.framing`: 해당 액션의 주 캐릭터 구도

실행 규칙:
- 구도 이름은 해당 캐릭터의 `framings`에 존재해야 합니다. `defaultFraming`도 같은 검증을 받습니다.
- `say/choice/input.framing`은 반드시 같은 액션의 `char`와 함께 선언합니다. `캐릭터ID.표정` 참조도 기본 캐릭터 ID로 검증합니다.
- 액션에서 `framing`을 생략하면 화면의 직전 구도를 유지합니다. 새 `char` 배치에서 생략하면 `defaultFraming`, 그것도 없으면 하위 호환 기본값 `full`/`scale: 1`을 사용합니다.
- 감정 표정으로 소스가 교체되어도 같은 구도 프리셋 이름을 보존합니다.
- 기본·감정 원화는 같은 고유 시선을 사용해야 합니다. `left/right`는 좌우 슬롯에서는 상대를 향하고, 단독 `center`에서는 원화 방향을 유지합니다.

### 9-4) `say.delivery` 감정형 타이핑

`say.delivery`는 대사의 전달 감정을 타이핑 리듬과 입력 글자 반응에 연결합니다.

```yaml
- say:
    char: 레이코.nervous
    delivery: whisper
    text: "그걸... 어디서 확인했죠?"
```

허용값:
- `neutral`: 기본 리듬
- `calm`: 안정적이고 여유 있는 리듬
- `nervous`: 불규칙한 속도와 긴 말줄임표 호흡
- `angry`: 빠르고 짧은 호흡과 강한 입력 반응
- `whisper`: 느리고 옅은 입력 반응
- `shout`: 가장 빠른 리듬과 강한 잔광
- `sad`: 느린 속도와 긴 문장 여운
- `deduction`: 흔들림 없이 단호한 추리 리듬

실행 규칙:
- `config.yaml.textSpeed`와 `<speed=...>`는 초당 grapheme 수(CPS)이며 숫자가 클수록 빠릅니다.
- 실제 지연은 대략 `1000 / (CPS × delivery 배율 × 감정 흔들림)`이고 글자당 16~900ms로 제한되며, 공백은 일반 글자의 62% 시간을 사용합니다.
- 속도 배율은 `neutral 1.00`, `calm 0.90`, `nervous 1.02`, `angry 1.20`, `whisper 0.76`, `shout 1.34`, `sad 0.70`, `deduction 0.94`입니다.
- 말줄임표 추가 호흡은 같은 순서로 `280/330/480/210/420/170/560/360ms`이며 쉼표와 문장 끝에도 프로필별 호흡이 붙습니다.
- 캐릭터 선언의 `defaultDelivery`는 해당 인물의 평상시 리듬입니다. 예: `assets.characters.덕만.defaultDelivery: deduction`.
- 우선순위는 `say.delivery` 명시값 -> `say.char`의 표정 -> 현재 표시 중인 화자의 표정 -> 캐릭터 `defaultDelivery` -> `neutral`입니다.
- 기본 자동 연결은 `serious/think -> deduction`, `angry -> angry`, `nervous/worried/scared -> nervous`, `surprised -> shout`, `proud/calm -> calm`입니다.
- 쉼표, 마침표, 물음표, 느낌표, 말줄임표, 줄바꿈 뒤에 감정별 정지가 자동 추가됩니다.
- `<speed=...>` 구간과 함께 사용하면 해당 CPS에 감정별 속도 배율과 호흡을 추가 적용합니다.
- 타이핑은 `Intl.Segmenter` 기반 grapheme 단위로 진행해 이모지와 결합 문자를 중간에서 자르지 않습니다.
- 클릭 즉시 완성(`clickToInstant`)과 `say.autoAdvance` 동작은 기존과 동일합니다.
- `prefers-reduced-motion`에서는 마지막 입력 글자 애니메이션을 제거하고 타이핑 시간 규칙만 유지합니다.

### 9-5) `say` 다중 인라인 속도 태그

`say.text`에서 `<speed=숫자>...</speed>`를 여러 번 사용하면, 한 문장 내 구간별 타이핑 속도를 다르게 줄 수 있습니다.

```yaml
- say:
    char: 코난.serious
    text: "<speed=26>어이...</speed> <speed=54>그건 함정이야.</speed> <speed=90>지금 당장 멈춰!</speed>"
```

실행 규칙:
- 태그 구간은 지정 속도로 타이핑됩니다.
- 같은 문장에 여러 태그가 있으면 앞에서부터 순서대로 적용됩니다.
- 태그 밖 텍스트는 `config.yaml.textSpeed` 기본 속도를 사용합니다.
- 태그는 렌더 텍스트에서 제거되고 내용만 출력됩니다.

### 9-6) `say.wait` 대사 진행 잠금

`say` 액션에 `wait`(ms)를 지정하면, 해당 대사가 시작된 시점부터 지정 시간 동안 진행/스킵 입력을 잠글 수 있습니다.

```yaml
- say:
    char: 코난.serious
    text: "멈춰. 지금은 섣불리 움직이면 안 돼."
    wait: 900
```

실행 규칙:
- 잠금 시간 동안 클릭/`Enter`/`Space` 진행 입력이 무시됩니다.
- 잠금이 끝나면 기존 `say`와 동일하게 다음 입력을 받을 수 있습니다.

### 9-7) `say.autoAdvance` 대사 자동 진행

`say` 액션에 `autoAdvance`(ms)를 지정하면 입력이 없어도 시간이 지난 뒤 다음 액션으로 진행합니다.

```yaml
- say:
    char: 코난.serious
    text: "남은 시간 7초."
    autoAdvance: 2000
```

실행 규칙:
- 자동 진행 시 타이핑/입력 대기 상태를 정리하고 다음 액션을 실행합니다.
- `wait`와 함께 선언하면 둘 중 더 긴 시간을 사용합니다.
- 수동 진행이 먼저 발생하면 예약 타이머를 취소합니다.

### 9-8) `choice` 제한시간

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

실행 규칙:
- `timeoutMs`는 `1000..60000` 범위이며, UI에 초 값과 진행 바로 표시합니다.
- 시간이 끝나면 `timeoutOptionIndex`의 옵션을 선택합니다. 생략 시 첫 옵션, 초과 시 마지막 옵션으로 보정합니다.
- 만료 선택은 자동 흐름이 멈추지 않도록 `forgiveOnce`를 건너뜁니다.
- 플레이어가 먼저 선택하면 예약 타이머를 취소합니다.

### 9-9) `gameOver` 실패 상태와 복구

`gameOver`는 `ending`과 별도 상태이며 엔딩 수집률과 크레딧을 발생시키지 않습니다. 독립 액션과 `choice.options[]`에서 사용할 수 있습니다.

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

- `gameOver.title`, `gameOver.message`는 선택이며 생략하면 엔진 기본 문구를 사용합니다.
- 한 선택지에 `goto`와 `gameOver`를 동시에 선언할 수 없습니다.
- 선택지의 `set/add`는 게임오버 전에 반영되지만 게임오버 시점에는 자동저장을 덮어쓰지 않습니다.
- 선택지에서 `goto`로 실패 후일담 scene을 재생한 뒤 독립 `gameOver` 액션에 도달하는 구성도, 자동 복구점은 실패 scene이 아니라 해당 선택 직전 상태를 유지합니다.
- 복구 화면은 자동 저장을 쓰는 `직전 선택으로`, `수동 저장으로`, 자동으로 남긴 `챕터 처음으로`, 백업 파일 불러오기를 제공합니다. 자동 저장 직접 불러오기는 게임오버에서만 사용자 작업으로 노출합니다.

### 9-10) `inventory` + `get/use` 아이템 상태

아이템 상태는 `state`와 분리된 `inventory`로 선언합니다.

```yaml
inventory:
  clue_note:
    name: "현장 메모"
    description: "탐문 중 확인한 단서를 정리한 메모다."
    image: assets/bg/case_board.avif
    category: "수사자료"
    order: 10

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

실행 규칙:
- `get: <itemId>`는 해당 아이템을 가방에 추가(`true`)합니다.
- `use: <itemId>`는 해당 아이템을 사용 처리(`false`)합니다.
- `when.var`는 `state` 변수뿐 아니라 `inventory` 아이템 키도 직접 참조할 수 있습니다.
- 인벤토리 기본 소지값은 항상 `false`(미획득)이며 `get/use`로만 변경됩니다.
- `inventory.<item>.category`(선택)는 인벤토리 카테고리 필터 기준값입니다. 미지정 시 UI에서 `기타`로 처리됩니다.
- `inventory.<item>.order`(선택)는 정렬 우선순위입니다. 값이 낮을수록 먼저 보이며, 미지정 시 `9999`로 처리됩니다.

## 10) 검증 규칙

런타임 파서가 아래를 검증합니다.

- `script`에 등장한 scene이 `scenes`에 존재하는지
- `goto` 대상(scene)이 존재하는지
- `bg/sticker/music/sound/char`가 `assets`에 선언되어 있는지
- `defaultFraming`과 `char/say/choice/input.framing`이 해당 캐릭터의 `framings`에 선언되어 있는지, 화자 없이 구도만 선언하지 않았는지
- `set/add/input.saveAs` 변수가 `state`에 선언되어 있는지
- `branch/endingRules`의 `when.var`가 `state` 변수 또는 `inventory` 아이템 키인지
- `get/use` 아이템이 `inventory`에 선언되어 있는지
- `defaultEnding`, `ending`, `endingRules[].ending`의 참조 정합성
- 권장 검증: `goto` 대상(scene)을 `script`에도 포함했는지

YAML 파싱 에러는 line/column 정보와 함께 표시됩니다.

## 11) 샘플 구조

```text
public/game-list/conan/
  config.yaml
  base.yaml
  0.yaml
  1.yaml
  2.yaml
  3.yaml
  routes/
    base.yaml
    hub/
      1.yaml
    seiji/
      1.yaml
    reiko/
      1.yaml
    kenji/
      1.yaml
    haruo/
      1.yaml
  conclusion/
    1.yaml
  assets/
    bg/
    char/
    music/
    sfx/
```

완결형 다중 엔딩 샘플은 `public/game-list/deokman/`을 참고합니다. 루트 `base.yaml`의 누적 상태를 8개 연속 챕터가 공유하고, 마지막 장의 `branch`가 이전 선택을 10개 엔딩으로 회수합니다. 24개 선택의 실패 옵션은 35개 고유 `gameOver` 후일담으로 연결되어 엔딩 수집과 직전 선택 복구의 역할을 분리합니다.

## 12) 제작 흐름 권장

1. `config.yaml` 먼저 작성 (전역 설정/엔딩)
2. 루트 `base.yaml`에 공통 `assets`, `state` 선언
3. 하위 폴더의 추가 공통값은 `routes/base.yaml`처럼 분리
4. 챕터 YAML은 `script/scenes` 중심으로 작성
5. `goto` 경로와 분기 상태(`set/add/branch`)를 검증
6. 실제 플레이로 템포/연출 점검

## 13) 관련 문서

- `README.md`
- `docs/YAML_STORY_TO_DSL_PROMPT.ko.md`
- `docs/DEOKMAN_GAME_BIBLE.ko.md`
- `docs/DEOKMAN_PLAYCHECKLIST.ko.md`
- 샘플 YAML: `public/game-list/conan/*.yaml`
- 완결형 분기 샘플: `public/game-list/deokman/*.yaml`
- DSL 축약 샘플: `sample.yaml`

## 14) 문서 변경 로그

- 2026-08-11: 인벤토리와 저장·설정 화면을 현재 `ui.template`에 맞는 기록 보관소 UI로 전면 개편했습니다. 수집 진행 헤더·번호형 단서 카드·확장 상세 시트와 자동 보호 상태·3종 저장 역할 카드를 도입하고, 데스크톱 3열/모바일 1열 저장 레이아웃 및 주요 저장 작업의 시각 위계를 보강했습니다. 저장/인벤토리 동작과 DSL 문법은 변경하지 않았습니다.
- 2026-08-11: `config.yaml.startScreen.titleColor`를 추가해 게임별 시작 화면 제목색이 전역 `ui.template` 기본색보다 우선하도록 확장했습니다. 덕만 야간 타이틀에는 밝은 금색을 적용하고 `paper-stage` 제목 그림자를 보강했으며 URL·ZIP 프리뷰와 초기화면 복귀 경로를 모두 지원합니다.
- 2026-08-11: Start Gate에 느린 배경 카메라 인, 비네트·테마 프레임·미세 질감, 타이틀/CTA 순차 등장과 실행 전환 상태를 추가했습니다. 3종 `ui.template` 색상 토큰을 유지하고 모바일 safe-area 및 `prefers-reduced-motion` 접근성 처리를 함께 보강했으며 DSL 문법 변경은 없습니다.
- 2026-08-11: 캐릭터 원본의 고유 시선을 `assets.characters.<id>.facing(left|right|front)`으로 선언하고, 좌우 슬롯과 2인 자동 분할의 실제 화면 절반을 기준으로 대화 상대를 향하게 자동 반전하는 기능을 추가했습니다. 단독 중앙 컷과 `front`/미지정 원화는 기존 방향을 유지합니다. 덕만 v3.0.0은 인물 10명의 기본·감정 30종을 서로 다른 얼굴형·체형·자세·소품과 풍부한 표정 연기로 교체하고, 추상적인 장 끝 요약과 한 문장짜리 비정규 엔딩을 행동·상호 대화 중심으로 개편했습니다.
- 2026-08-11: 덕만 v2.6.0에서 날짜 변경·장거리 이동·수사 생략을 무화자 `say` 나레이션으로 잇고, 같은 공간의 연속 위기는 비·종·피·횃불·인주 변화로 시간 경과를 보여 주도록 8개 장의 시간축을 재구성했습니다. 2장의 별점 준비 기한과 당일 혼담 답변, 4장의 밤샘 전투와 적장 회담 사이 모순도 바로잡았습니다. 32개 시간 앵커와 금지된 시간 모순 회귀 검증을 추가했으며 DSL 문법 변경은 없습니다.
- 2026-08-11: 덕만 v2.5.0에서 설정 요약으로 관계를 소개하던 8개 장 시작과 주요 선택 전 장면을 행동형 에피소드로 재구성했습니다. 밤 수라의 누룽지·혼서·비녀·말 두 필·짚신·빈 그릇·체포령·인장·이름천·칼을 반복 소품으로 사용해 부녀·자매·동료·경쟁자·적대자의 관계와 선택 대가를 화면에서 먼저 보여 줍니다. 8개 장별 드라마투르기 계획과 금지 요약문 회귀 검증을 추가했으며 DSL 문법 변경은 없습니다.
- 2026-08-11: 인게임 HUD의 기능 없는 `YAVN ENGINE` 상시 문구를 제거하고 ZIP 처리 상태만 한국어로 표시하도록 정리했습니다. 케이스 파일·선택 제한·진행 상태 문구도 한국어로 통일했으며, 긴 대사·기록·인벤토리·시스템·오류·게임오버·엔딩과 런처 태그 목록에 테마형 스크롤 트랙/손잡이를 추가했습니다. 인벤토리는 밝은 테마 검색 대비, 빈 가방/검색 결과 복구 행동, 모바일 3열 밀도, 미발견 카드의 불필요한 상세 진입, 획득 상세 정보 위계를 함께 개선했습니다. DSL 문법 변경은 없습니다.
- 2026-08-11: 덕만 v2.4.0에서 24개 선택의 도입부를 전수 보강했습니다. 프롤로그에서 진평왕·덕만·천명과 계승 위기의 관계를 먼저 밝히고, 선택지에 이름이 나오기 전에 칠숙·아진·유신·소원·비담·진운·월명의 지위와 덕만을 돕거나 적대하는 이유를 소개합니다. 각 장의 첫 장면에는 이전 장 결과가 현재 위기가 된 원인을, 중간·마지막 선택에는 도움을 청하는 이유와 선택으로 위험해질 사람·가치를 대화로 추가했습니다. DSL 문법 변경은 없습니다.
- 2026-08-11: 이미지 프리로드가 `load` 이벤트만으로 디코딩 완료를 앞질러 판정하던 경합을 수정했습니다. 프리로드와 실제 첫 장면 DOM의 배경·정적 캐릭터 `decode()`를 확인하고, 화면 에셋에 eager/high 우선순위를 적용해 챕터 로딩 직후 캐릭터가 늦게 나타나는 현상을 방지합니다. DSL 문법 변경은 없습니다.
- 2026-08-11: 덕만 v2.3.0에서 `char`로 배치된 모든 인물을 무조건 같은 화면에 묶지 않고 실제 공간 관계에 따라 `with`로 숏을 분리했습니다. 프롤로그의 기둥 뒤 엿듣기, 잠긴 방 안팎, 천명의 가마 밑 잠입, 강·비탈·궁문을 사이에 둔 대치와 매복 장면을 소리·시야·거리 중심으로 다시 쓰고, 발각이나 접근 전에는 상대 인물이 같은 화면에 나타나지 않도록 회귀 검증을 추가했습니다. 천명의 가마 선택이 잘못된 `sowon_trust` 대신 `cheonmyeong_trust`를 올리도록 바로잡았습니다. DSL 필드 문법은 바뀌지 않았습니다.
- 2026-08-11: 대사·선택·입력·내레이션에서 `with`를 생략하면 현재 무대의 인물을 기본 앙상블로 유지하도록 노출 동작을 개선했습니다. `with`를 명시하면 기존처럼 노출 대상을 좁히고, `with: []`는 화자 단독 또는 빈 무대를 만드는 의도적 컷으로 사용합니다. 덕만 v2.2.0은 35개 실패를 즉시 `gameOver`로 끝내지 않고 전신 상황 제시, 상반신 대화, 단독 클로즈업의 발각·죽음까지 재생하는 미니 장면으로 확장했습니다. DSL 필드 문법은 바뀌지 않았습니다.
- 2026-08-11: 덕만 v2.1.0의 전 8장을 암살 생존부터 화백회의까지 앞 장의 결과가 다음 장의 위기가 되는 기승전결로 재구성했습니다. 인물 대사를 147줄에서 371줄로 확장하고 각 장마다 최소 8개의 3턴 이상 상호 대화 장면을 배치해 설명형 독백과 경구 교환을 질문·반응·오해·수정이 있는 대화로 교체했습니다. 88개 인물 등장 지시와 모든 도달 가능 분기의 화자 배치 회귀 검증도 추가했습니다. DSL 문법 변경은 없습니다.
- 2026-08-10: 덕만 v2.0.0의 타이틀·배경 10종과 인물 10명의 기본·표정 20종, 총 30개 투명 WebP를 631년 신라 시각 기준으로 전면 교체했습니다. 중국 황실·조선 후기 도상을 배제하고 인물의 얼굴·복식·광원·자세가 표정 간 유지되도록 했으며, 20개 감정 표정을 모두 실제 대사에 연결했습니다. 8개 챕터 대사도 인물별 욕망·어휘·행동·서브텍스트 기준으로 다시 감수했습니다. DSL 문법 변경은 없습니다.
- 2026-08-10: 캐릭터별 `defaultFraming`과 재사용 가능한 `framings.<name>.scale/x/y`, 액션별 `char/say/choice/input.framing`을 추가했습니다. 한 장의 원본 이미지로 전신·상체·클로즈업을 전환하며 감정 교체·저장 복원에서도 구도를 유지합니다. 덕만 v1.3.0은 10명 전원과 147개 화자 대사·24개 선택 장면에 구도를 지정하고, 24개 선택지를 30자 이하 위기 프롬프트와 16자 이하 즉시 행동으로 압축했으며 8개 챕터 대사를 인물별 연기 호흡에 맞게 다시 다듬었습니다. 선택 게이트 최대 높이도 데스크톱 `46cqh`·모바일 `48cqh`로 조정해 짧은 4개 보기가 상태줄에 가리지 않게 했습니다.
- 2026-08-10: 덕만 v1.2.1의 시작 타이틀·런처 썸네일·본편 배경·엔딩 아트를 AVIF에서 WebP로 교체했습니다. AVIF 파일의 크기는 읽지만 픽셀을 표시하지 못하는 일부 브라우저 엔진에서도 모든 장면 이미지를 정상 렌더링하며, DSL 문법 변경은 없습니다.
- 2026-08-10: 캐릭터 자산에 `defaultDelivery`를 추가해 평상시 말하기 리듬을 선언할 수 있게 했습니다. 명시 `say.delivery`와 표정 추론이 우선하며 캐릭터 기본값은 그 다음 fallback으로 동작합니다. 역사 서사용 `moonveil/embers/crown` 화면 이펙트와 모션 감소 처리를 추가하고, 덕만 v1.1에 배경 7종·투명 WebP 인물 10종·인물별 대사 템포를 적용했습니다.
- 2026-08-10: 덕만 v1.2의 8개 챕터 대사를 인물별 욕망·어휘·문장 리듬 기준으로 전수 재작성했습니다. 전역 속도를 27 CPS로 조정하고 왕의 임종·자매의 위기·즉위 장면에 감정 스프라이트 5종, `say.delivery`, `<speed>`, `say.wait`를 함께 사용해 반응과 침묵이 남는 드라마 호흡을 적용했습니다. DSL 문법 변경은 없습니다.
- 2026-08-10: 메인 런처 캐러셀의 임의 첫 선택을 제거하고 직접 링크/첫 게임 우선 규칙으로 일관화했습니다. 탐색 버튼·도트·현재 번호를 독립 레일로 분리해 데스크톱과 모바일에서 긴 콘텐츠와 겹치지 않게 하고 `Home`/`End` 키 탐색 및 선택 슬라이드 접근성 상태를 추가했습니다.
- 2026-08-10: 덕만 샘플의 역사 혼동을 줄이기 위해 후계자 이름을 역사상 실존했던 `사륜`에서 명시적 창작 인물 `진운`으로 변경하고 첫 장면에 역사 픽션 안내를 추가했습니다. 천명 선택이 소원 신뢰를 올리던 상태 연결을 바로잡았으며, 최종 선택 전에 누적 기반을 네 가지 서술로 피드백합니다. 배경 3종은 AVIF, 공유 이미지는 JPEG로 분리해 원본 PNG 대비 전송 크기를 크게 줄였습니다.
- 2026-08-10: 선택지가 `goto`로 별도 실패 후일담 scene에 진입한 뒤 독립 `gameOver`에 도달하면 자동 저장이 실패 scene으로 덮이던 문제를 수정했습니다. 이제 분기 시작 시점의 상태를 별도 복구점으로 보존해 `직전 선택으로`가 실제 선택 게이트로 돌아갑니다.
- 2026-08-10: 완결형 역사 정치 생존 샘플 `public/game-list/deokman`을 추가했습니다. 프롤로그+7개 장, 24개 4지선다, 35개 고유 `gameOver`, 10개 수집형 엔딩, 누적 정통성·세력·통찰·관계 분기와 전용 게임 바이블/플레이 검수표를 포함합니다.
- 2026-08-10: 저장 UX를 역할 중심으로 재구성했습니다. 자동 저장은 일반 시스템 화면에서 직접 불러오기를 제거하고 선택 직전 내부 복구점으로 표시하며, 게임오버에서만 `직전 선택으로` 동작에 연결합니다. 수동 저장·챕터 복귀·백업을 별도 작업으로 분리하고 배경음악/초기화면 설정을 인벤토리에서 시스템 탭으로 이동했습니다. 인벤토리는 수집 진행도, 공통 검색/카테고리/정렬, 슬롯 1회 클릭 상세, 모바일 하단 시트를 적용했습니다.
- 2026-08-10: Conan v10.7에서 도달 불가능한 재지목 장면을 제거하고 최종 오답 3개를 즉시 게임오버로 연결했습니다. 4개 인물 조사와 초동 감식·현장 재구성에서는 첫 오답과 안전한 후퇴를 유지하되, 반증을 무시한 반복 오판 6개를 추가 실패 상태로 전환했습니다.
- 2026-08-10: 게임별 저장을 자동/수동/챕터 시작점의 3개 슬롯으로 확장하고 플레이어 자동저장 토글, 저장 백업 JSON 내보내기/가져오기를 추가했습니다. URL뿐 아니라 ZIP 실행도 파일별 저장 키로 분리했습니다. `gameOver` 액션과 선택지 옵션을 DSL에 추가했으며, 엔딩과 분리된 복구 화면에서 전체 불러오기·최근 저장·챕터 시작 복귀를 지원합니다. Conan v10.6의 최종 오답 확정 구간에 이 흐름을 적용했습니다.
- 2026-08-08: Conan v10.5.1의 관계별 말투를 바로잡았습니다. 코난과 란은 서로 반말하고, 란은 아빠에게 해요체 존댓말을 쓰며, 코난은 코고로를 `아저씨`라고 부르면서 사건 관계자와 동일하게 또렷한 존댓말을 사용합니다. 이 세 관계를 콘텐츠 회귀 검사로 고정했습니다.
- 2026-08-07: 전체 화면 이펙트의 transform 대상을 `.app`에서 내부 `.effect-viewport`로 분리하고 paint/overflow containment를 적용했습니다. 화면 흔들림·확대·기울기·충격 연출이 문서 스크롤 크기를 키우지 않으며 CASE FILE·선택지·대사창 내부 스크롤은 유지됩니다.
- 2026-07-31: `/game-list/:gameId/` 직접 요청이 공통 YAVN HTML을 반환하던 문제를 수정했습니다. Manifest 기반으로 게임별 정적 HTML을 빌드해 게임 제목·설명·canonical·Open Graph·Twitter Card·`VideoGame` JSON-LD를 최초 응답에 포함하며, Vercel 라우팅과 Twitter 이미지 대체 텍스트도 함께 보강했습니다.
- 2026-07-31: 선택지가 열린 뒤에도 일반 대사용 최소 높이 84px가 남아 720px 화면에서 마지막 옵션이 하단 상태줄 아래로 가려지던 문제를 수정했습니다. `has-choice-gate` 상태에서는 대사 높이 예약을 해제하고 긴 선택지 묶음만 기존 내부 스크롤로 처리하며 정적 회귀 테스트를 추가했습니다.
- 2026-07-31: Conan v10.4의 가족 여행을 객실·기념품·탁구 삼세판·저녁·취침 장면으로 확장하고 사건 전 최단 경로 8분 이상을 81개 선택 조합으로 검사합니다. 기념품 선택은 취침 전과 TRUE END에서 회수되며, 객실/기념품 코너/탁구 휴게실/식사실 전용 AVIF 4종과 장면별 `intro`/`rain` 음악 큐를 추가했습니다. `열한 점 단판` 같은 규칙 설명투와 긴 코난 독백은 캐릭터 농담과 48자 이하 관찰로 교체했습니다.
- 2026-07-31: `9:16`보다 긴 뷰포트에서 캐릭터와 다이얼로그가 화면 맨 아래로 처지던 문제를 수정했습니다. 배경은 전체 화면 `cover`를 유지하고 캐릭터·스티커·HUD·대사·컷신·CASE FILE을 최대 `9:16` 중앙 플레이 프레임에 배치하며, 다이얼로그 높이와 안전 inset도 프레임 기준으로 계산합니다.
- 2026-07-31: README와 개발 가이드에 `textSpeed`/`<speed>`의 CPS 단위, 8종 `say.delivery` 속도 배율·문장부호 호흡, 12개 화면 이펙트의 지속시간·용도·연속 실행 규칙을 실제 런타임 수치 기준으로 보강했습니다. Conan v10.3은 사건 전 최단 경로를 7분 이상으로 늘리고 탁구/시음 순서/차 이름 선택과 사건 내 회수 분기를 추가했으며, 설명조 독백과 부자연스러운 문구를 회귀 검사합니다.
- 2026-07-30: 런처가 `live2d`/`engine-showcase` 태그를 보고 이미지 구도와 라벨을 특별 처리하던 분기를 제거했습니다. Manifest V4의 범용 `showcase` 메타로 라벨·배경색·이미지 초점/배율/오프셋을 선언하며, 번들 샘플 ID와 전용 태그가 런타임에 다시 들어오면 독립성 테스트가 실패합니다.
- 2026-07-30: 스티커·증거물의 좌표계를 HUD·다이얼로그·기기 safe-area를 제외한 공통 안전 프레임으로 변경했습니다. 실제 렌더 경계 기반의 균일 축소·최소 이동 보정을 추가해 짧은 가로 화면과 과대 에셋도 자르지 않으며, 모바일 다이얼로그에는 좌우·하단 최소 10px 외곽 여백을 추가했습니다.
- 2026-07-30: 엔진 홈 캐러셀에서 320px 폭의 긴 태그 행이 슬라이드 너비를 밀어내고 음수 배경 레이어가 스와이프 중 이웃 에셋을 노출할 수 있던 문제를 수정했습니다. 슬라이드별 레이아웃·페인트 격리, 미디어 클리핑, 텍스트·카드 최대 폭 보호를 추가했습니다.
- 2026-07-30: 새 이미지 캐릭터가 노출되거나 2인 구도로 전환될 때 수평 오프셋과 화자 확대가 하나의 `transform` 전환에 묶여 옆으로 슬라이드하던 문제를 수정했습니다. 수평 슬롯은 즉시 확정하고, 제자리 상승·페이드와 화자 `scale`만 독립적으로 애니메이션합니다.
- 2026-07-30: 2인 자동 분할에서 한 명이 퇴장할 때 남은 인물의 위치와 너비가 1인 규칙으로 즉시 재계산되어 순간이동하던 문제를 수정했습니다. 같은 ID와 슬롯의 생존 인물만 기존 절반 배치를 유지하며, 교체·직접 이동·무대 비움에서는 기억을 해제합니다.
- 2026-07-30: 엔진 홈을 데모 우선 전체 폭 캐러셀로 개편했습니다. 최초 무작위 선택과 `#demo=<gameId>` 딥링크, 터치 스와이프·마우스 드래그·화살표·키보드·인디케이터 순환을 지원하고, 아래 게임 목록 카드는 상단 선택 대신 게임으로 바로 이동합니다. Live2D 데모 썸네일도 모델 텍스처 원본에서 실제 실행 화면으로 교체했습니다.
- 2026-07-30: 이미지 캐릭터의 감정 소스가 바뀔 때 DOM을 다시 생성해 최초 등장 모션이 반복되고, 서로 다른 원본 종횡비 때문에 좌우 기준점이 흔들리던 문제를 수정했습니다. 동일 인물/위치의 렌더 키와 고정 반응형 폭을 유지하며, Conan 샘플은 단서 카드와 폴리스 라인이 겹치지 않도록 장면 순서를 조정하고 인물 7명의 감정 자산을 보강했습니다.
- 2026-07-30: 동일 캐릭터 ID를 다른 `position`에 재배치할 때 이전 슬롯이 남아 `say.with` 노출 시 한 인물이 두 번 렌더링되던 문제를 수정했습니다. 캐릭터 슬롯은 ID당 하나만 유지되며 이미지/Live2D와 저장 복원 흐름에 동일하게 적용됩니다.
- 2026-07-30: 로컬 오디오 `music` 액션의 트랙 변경에 420ms 크로스페이드를 추가했습니다. 같은 곡은 재시작하지 않고, 음소거·초기화면 이동·명시적 정지는 즉시 반영되는 동작을 문서화했습니다. Conan 샘플은 v10 `폭우의 2번 찻잔`로 개편해 보유 BGM 7종을 도입/폭우/전조/사건/추리/압박/자백 큐로 분리했습니다.
- 2026-07-30: 실제 노출 캐릭터가 정확히 두 명일 때 화면을 좌우 1/2 구도로 자동 전환하도록 캐릭터 레이아웃을 개선했습니다. 원래 슬롯 순서로 좌우를 고정해 화자 변경 시 자리 교환을 막고, 이미지/Live2D 및 모바일 폭을 각각 보정했으며 Conan 도입 대화에 적용했습니다.
- 2026-07-29: `say.delivery` 감정형 타이핑 DSL을 추가했습니다. 8종 전달 톤, 캐릭터 표정 기반 자동 추론, 문장부호별 호흡, grapheme 단위 출력, 마지막 입력 글자 반응과 모션 감소 대응을 엔진에 연결하고 Conan 대사와 `sample.yaml` 예시를 갱신했습니다.
- 2026-07-29: 메인 런처를 과밀한 3패널 Engine Console에서 실제 게임 이미지 중심의 YAVN 플레이그라운드로 재설계했습니다. 대표 게임 쇼케이스, 썸네일 라이브러리, 검색/태그, 카드별 바로 실행, ZIP 실행 툴바를 데스크톱·모바일 공통 흐름으로 구성했습니다.
- 2026-07-29: 자동 진행형 쇼케이스를 위해 `say.autoAdvance`, `choice.timeoutMs`/`timeoutOptionIndex`, `root:/` 공유 에셋 경로와 `impact/glitch/speedlines/alarm/focus` 화면 이펙트를 추가했습니다. 이를 사용하는 독립 게임 `public/game-list/conan-demo`를 약 60초 분량의 모바일 대응 트레일러로 추가했습니다.
- 2026-07-29: Conan 샘플의 설명조·판정조 대사를 전면 재작성했습니다. 용의자별 말투를 분리하고, `2번 잔 -> 21:29의 빈 시간 -> 손수건 섬유 -> 2R -> 연구 노트`가 잠자는 코고로의 폭로로 이어지도록 사건 인과를 보강했습니다. 코난과 혼동되던 용의자 `신이치`는 `세이지`로 변경했습니다.
- 2026-07-29: `showTitle: false`인 Start Gate 이미지를 모바일 세로 화면에서 배경과 전경으로 분리해, `cover` 크롭으로 이미지 안의 게임 제목이 잘리던 문제를 수정했습니다. 소형 세로 화면과 모바일 가로 화면에서 제목/버튼 배치 및 페이지 오버플로를 검증했습니다.
- 2026-07-28: 챕터 프리로드를 전체 선언 직렬 처리에서 현재 챕터 참조 에셋의 제한 병렬 처리로 전환하고 세션 디코드 캐시, 저속 네트워크 동시성 축소, 선형 다음 챕터 백그라운드 예열을 추가했습니다. 로딩 최소 지연도 첫 챕터 240ms/이후 100ms/완료 80ms로 단축했습니다.
- 2026-07-28: 모바일 HUD 44px 터치 영역, 캐릭터 확대, safe-area 하단 대화 시트, 48px 선택/입력 컨트롤, CASE FILE 바텀시트, 3열 단서 도감을 적용했습니다. 로딩 오버레이는 전체 화면 하단 진행 UI로 재구성했습니다.
- 2026-07-28: Conan 배경 PNG를 AVIF, 투명 캐릭터 PNG를 WebP로 교체해 대표 이미지 24개의 합계를 31.98MiB에서 2.14MiB로 축소했습니다. 투명 AVIF의 Chromium 호환 문제를 실브라우저 검증에서 발견해 캐릭터는 WebP로 분리했습니다.
- 2026-07-28: Conan의 연속 번호 챕터 `0 -> 1 -> 2`에서 중복 `goto`를 제거해 엔진 자동 진행, 챕터 진행도, 다음 챕터 예열이 동일 시퀀스를 유지하도록 정리했습니다.
- 2026-07-28: 자동저장 선택 기록에 `chapterPath`를 추가해 서로 다른 챕터에서 동일한 `sceneId/actionIndex`를 사용할 때 복원 결과가 충돌하던 문제를 수정했습니다. 레거시 저장 데이터는 챕터 경로가 없는 항목을 호환 항목으로 읽습니다.
- 2026-07-28: HUD `CASE LOG`를 추가해 대사/선택/입력을 최대 300개까지 자동저장하고, 케이스 파일 안에서 기록과 인벤토리를 전환할 수 있도록 플레이 UX를 확장했습니다.
- 2026-07-28: `config.yaml.startScreen.showTitle`을 추가했습니다. 기본값은 `true`이며, 타이틀 아트에 제목이 포함된 게임은 `false`로 중복 오버레이를 숨길 수 있습니다.
- 2026-07-28: Live2D 렌더러를 동적 import로 분리하고, Vitest 회귀 테스트와 GitHub Actions 테스트/빌드 검증을 추가했습니다.
- 2026-02-28: 다이얼로그 박스 최대 높이를 게임 화면 노출 관점에서 제한했습니다(데스크톱 `38dvh`, 모바일 `46dvh`). 긴 대사/입력/선택지로 높이가 과도하게 커지던 동작을 내부 스크롤 영역으로 전환해, 하단 상태줄은 고정 유지하면서도 연출 영역 가림을 줄이도록 UI를 조정했습니다.
- 2026-02-28: 인벤토리 UI 동작을 조정해 검색/카테고리 필터를 `도감` 탭 전용으로 제한하고, 기존 하단 고정 상세 패널을 `상세보기` 버튼 기반 팝업으로 변경했습니다. 팝업에서도 미획득 아이템의 설명/이미지는 계속 숨김 처리해 스포일러 최소화 규칙을 유지합니다.
- 2026-02-28: 화자 강조 depth 표현을 `opacity` 기반에서 `brightness` 기반으로 조정했습니다. 비화자 캐릭터는 `speakerOrder` 순위에 따라 이미지 밝기만 점진적으로 낮추고, 캐릭터 레이어 자체 `opacity`는 1로 유지해 그림 영역만 어둡게 보이도록 UI 동작을 갱신했습니다.
- 2026-02-28: 엔딩 화면 `처음부터 다시하기` 버튼을 URL 게임 기준으로 인벤토리 모달 `초기화면 가기`와 동일한 Start Gate 재진입 흐름으로 통일했습니다. 버튼 실행 시 Start Gate 세션 플래그를 초기화하고 인게임 BGM을 정지한 뒤 시작 화면으로 복귀하며, ZIP 실행 게임은 기존처럼 `restartFromBeginning()`으로 첫 챕터 재시작하도록 폴백 동작을 유지했습니다.
- 2026-02-27: 인벤토리 UX/UI V2를 적용했습니다. 모달을 `가방(획득)`/`도감(전체)` 2탭 구조로 확장하고 검색/카테고리/정렬(`order` 우선)을 추가했으며, HUD 가방 버튼 진행 배지(`획득수/전체수`)와 `Esc` 닫기 + 포커스 복귀 접근성을 반영했습니다. 동시에 `inventory` 아이템 메타에 선택 필드 `category`/`order`를 도입하고, 게임별 설정 저장(`vn-engine-settings:<autosave-key>`)에 `inventoryView`/`inventorySort`/`inventoryCategory`를 확장해 구버전(`bgmEnabled`만 저장) 데이터도 자동 정규화되도록 마이그레이션했습니다.
- 2026-02-27: 스티커 연출 옵션에서 `enter.duration`/`leave.duration` 사용자 지정을 제거하고, 이펙트 시간은 엔진 기본값(enter `280ms`, leave `220ms`)으로 고정했습니다. 동시에 `say.wait`(ms)를 추가해 대사 시작 시점부터 지정 시간 동안 진행/스킵 입력을 잠글 수 있도록 런타임·스키마·문서를 갱신했습니다.
- 2026-02-27: `inventory` 아이템 정의에서 `owned` 필드를 제거하고, 인벤토리 기본 소지값을 `false`(미획득)로 단순화했습니다. `when.var`에서 `state` 변수와 함께 아이템 키를 직접 참조할 수 있도록 조건 검증/실행 로직을 확장했으며, Conan 샘플의 아이템 분기 우회 상태(`item_*_owned`)를 아이템 키 분기로 마이그레이션했습니다.
- 2026-02-27: 캐릭터 화자 강조를 데스크톱/모바일 공통 규칙으로 통일했습니다. 모바일 전용 화자 확대를 제거하고, 현재 화자는 소폭 전면(scale) + 비화자는 `speakerOrder` 기반 단계적 depth 강조를 적용하도록 UI 동작을 갱신했습니다.
- 2026-02-27: `sticker.inputLockMs`(ms)를 추가해 스티커 표시 직후 지정 시간 동안 `input` 제출/`choice` 선택을 잠그고, 잠금 종료 후 다음 액션으로 자동 진행하도록 런타임·문서를 확장했습니다. Conan 샘플 아이템 획득 연출에도 적용했습니다.
- 2026-02-27: 인벤토리 그리드의 고정 최소 슬롯(빈 칸 채움) 동작을 제거하고, 4열 고정 상태에서 획득 아이템 개수에 맞춰 row가 자동으로 늘어나는 동적 레이아웃으로 변경했습니다.
- 2026-02-27: 인벤토리 목록 노출 기준을 조정해 `true`(획득 상태) 아이템만 슬롯에 표시하도록 변경했습니다. 미획득/사용 완료(`false`) 아이템 카드는 숨김 처리됩니다.
- 2026-02-27: 인벤토리 모달 `초기화면 가기` 실행 시 Start Gate만 띄우던 동작을 보완해, 기존 인게임 BGM을 먼저 정지한 뒤 시작 화면 BGM으로 전환되도록 수정했습니다.
- 2026-02-27: 인벤토리 모달 레이아웃을 조정해 스크롤을 슬롯 그리드에만 적용하고, 하단 상세 패널/설정 영역을 고정 표시하도록 개선했습니다. 슬롯 우측 상단 표시는 `획득` 배지(소지 중일 때만)로 단순화하고 미획득/사용 완료 상태의 X 표시를 제거했습니다.
- 2026-02-27: 인벤토리 모달 하단에 `초기화면 가기` 버튼을 추가했습니다. URL 게임에서 버튼 클릭 시 Start Gate 세션 플래그(`vn-start-gate-session:<gameId>`)를 초기화하고, 같은 탭에서 시작 화면을 다시 띄우도록 동작을 확장했습니다. ZIP 실행 게임에서는 버튼을 비활성화합니다.
- 2026-02-27: `inventory` 레이어(`base/chapter`)와 액션 `get/use`를 추가해 아이템 소지 상태를 `state`와 분리했습니다. 인게임 HUD의 가방 기호 버튼으로 여는 단일 인벤토리 모달(4x4 슬롯 그리드 + 하단 체크 설정)에서 아이템 소지 여부/상세(설명·이미지)를 조회할 수 있고, `배경음악 끄기` 토글을 게임별 설정(`vn-engine-settings:<autosave-key>`)으로 저장하도록 동작을 확장했습니다.
- 2026-02-27: `say.text`에서 다중 `<speed=...>...</speed>` 구간을 순차 해석해 문장 내부 구간별 타이핑 속도를 다르게 적용하도록 런타임/문서를 갱신했습니다.
- 2026-02-27: 모바일 환경(터치/coarse pointer)에서는 `input` 게이트 진입 시 입력창 자동 포커스를 생략해 가상 키보드가 즉시 열리지 않도록 동작을 조정했습니다.
- 2026-02-27: `config.yaml.startScreen.music`(시작 화면 전용 BGM)과 `config.yaml.endingScreen.image`(엔딩 오버레이 배경)를 추가했습니다. ZIP 시작 화면 프리뷰에서도 로컬 음악 경로를 blob으로 변환해 재생하도록 동작을 확장했습니다.
- 2026-02-27: `prebuild`에서 `public/sitemap.xml`을 manifest(`games[].path`) 기준으로 자동 생성하도록 확장했습니다. 동시에 Start Gate(게임 본 로딩 전) 단계에서도 `config.yaml.seo`를 즉시 적용해 `/game-list/:gameId` 진입 직후 메타가 반영되도록 동작을 갱신했습니다.
- 2026-02-27: 다이얼로그 `숨기기` 버튼을 본문 내부에서 박스 외부 우측 상단 컨트롤 레이어로 이동해, 일반 대사 텍스트와 버튼이 겹치지 않도록 UI 레이아웃을 조정했습니다.
- 2026-02-27: `config.yaml.seo`(`description/keywords/image/imageAlt`)를 추가하고, manifest를 `schemaVersion: 3`으로 확장해 `games[].seo` + 루트 `seo(gameTitles/gameCount/keywords/description)`를 생성하도록 `prebuild`를 갱신했습니다. 런처 및 `/game-list/:gameId` 페이지에서 이 메타를 읽어 `description/keywords/og/twitter/json-ld`를 동적으로 반영하도록 동작을 문서화했습니다.
- 2026-02-27: 다이얼로그 박스 숨김/복귀 전환을 하단 슬라이드(`transform`)에서 페이드(`opacity`)로 조정하고, 시스템 숨김 구간(챕터 로딩/게임 미로딩/컷신)에도 `stickerSafeInset` 기준을 유지해 최초 표시 시 캐릭터 레이어 높이 점프를 방지했습니다.
- 2026-02-27: `public` 최소화 정책을 도입해 허용 경로를 `favicon.svg/robots.txt/sitemap.xml/game-list/**`로 제한하고, `scripts/check-public-allowlist.mjs` 검증을 `predev`/`prebuild`에 연결했습니다.
- 2026-02-27: 폰트(`SUITE-Variable.woff2`)와 Live2D Core(`live2dcubismcore.min.js`)를 `public`에서 `src/assets` 번들 자산으로 이동해 정적 공개 경로 의존을 제거했습니다.
- 2026-02-27: 외부 런타임 자산 경로를 명확히 하기 위해 Live2D 코어 디렉터리를 `public/vendor/live2d`에서 `public/third-party/live2d`로 이동하고, 로더/문서 참조 경로를 함께 정리.
- 2026-02-27: 다이얼로그 수동 숨김/복원 시 캐릭터·스티커 레이어 하단 안전 여백(`stickerSafeInset`) 계산을 즉시 동기화하도록 보정하고, 레이어 `bottom` 전환 애니메이션을 추가.
- 2026-02-27: 인게임 다이얼로그에 수동 `숨기기/대화창 열기` 버튼을 추가하고, 수동 숨김 상태에서는 클릭/`Enter`/`Space` 진행 입력을 차단하도록 동작을 갱신.
- 2026-02-27: `config.yaml.ui.template`(`cinematic-noir` | `neon-grid` | `paper-stage`) 전역 템플릿 옵션을 추가하고, 챕터 로딩/다이얼로그/HOLD TO SKIP/선택·입력 게이트/엔딩 크레딧을 CSS 토큰 기반 3종 테마로 재구성했습니다. 템플릿 미지정 시 기본값 `cinematic-noir`를 사용하도록 동작을 문서화했습니다.
- 2026-02-27: 시작 화면(Start Gate)의 타이틀/시작·이어하기 버튼에도 `ui.template`를 적용해 `cinematic-noir`/`neon-grid`/`paper-stage` 3종 템플릿으로 동일하게 전환되도록 확장했습니다.
- 2026-02-27: 시작 화면 섹션(8-9)과 UI 템플릿 섹션(8-10)의 책임 범위를 정리해, 시작/이어하기 버튼이 전역 템플릿에 포함되는 점을 명시했습니다.
- 2026-02-27: 인게임 HUD 우측 안내 문구를 `Click / Enter / Space`에서 `YAVN ENGINE`으로 변경하고, ZIP 업로드 로딩 중에는 `ZIP Loading...`을 유지하도록 동작을 조정했습니다.
- 2026-02-27: `config.yaml.startScreen`(enabled/image/startButtonText/buttonPosition) 기반 시작 게이트를 추가하고, URL 게임 autosave 키를 `vn-engine-autosave:game:<gameId>`로 스코프화했습니다. 레거시 키 fallback + resume 성공 시 마이그레이션, ZIP 시작 화면(로드 버튼 비노출), 인스펙터 썸네일 fallback(`launcher.thumbnail` -> `startScreen.image`) 규칙을 문서화했습니다.
- 2026-02-27: 메인 런처를 Engine Console 3패널(실행 콘솔/워크스페이스/인스펙터) 구조로 재설계하고, 게임 목록 manifest를 `schemaVersion: 2`(`author/version/summary/thumbnail/tags/chapterCount`)로 확장. `launcher.yaml`(선택) 기반 런처 메타 병합 규칙과 V1 manifest fallback 동작을 문서화.
- 2026-02-26: 다이얼로그 박스 숨김/복귀 연출을 `opacity` 토글에서 하단 슬라이드 아웃/슬라이드 인(`transform`) 방식으로 변경.
- 2026-02-26: 챕터 로딩(`chapterLoading`) 또는 게임 데이터 미로딩 상태에서 다이얼로그 박스를 숨기도록 UI 동작을 조정.
- 2026-02-26: Live2D 포인터 입력을 캔버스 실좌표(`getBoundingClientRect`) 기준으로 보정하고, 캔버스 내부 시작 드래그만 추적하도록 조정해 `center` 슬롯에서 크게 나타나던 시선 오프셋 문제를 수정. 동시에 캔버스 리사이즈에 `devicePixelRatio`를 반영해 고해상도 좌표 불일치를 완화.
- 2026-02-26: 챕터 로딩 오버레이 해제 시점을 첫 scene의 Live2D ready/error 신호와 동기화하고, `model3.json` 내부 의존성(`Moc/Textures/Motions/Expressions` 등)까지 프리로드 큐에 포함하도록 동작을 확장.
- 2026-02-26: Live2D 캐릭터 중앙 배치에서 `transform` 오프셋을 제거해 클릭/드래그 시 시선 추적 좌표 어긋남을 수정.
- 2026-02-26: `choice`/`input` 액션에 `char`/`with` 필드를 추가해 `say` 없이도 캐릭터 노출과 표정 동기화를 지정할 수 있도록 확장.
- 2026-02-26: 엔딩 크레딧 롤은 초기 자동 스크롤 구간에서 입력을 잠그고(`pointer-events: none`), 자동 스크롤 종료 후에만 수동 스크롤을 허용하도록 동작을 조정.
- 2026-02-26: Cubism Core v53 + `easy-cl2d` 조합에서 `drawables.renderOrders` 부재로 발생하던 WebGL 렌더러 크래시(`Cannot read properties of undefined (reading '0')`)를 `getRenderOrders()` 호환 보정으로 수정.
- 2026-02-26: Live2D 코어 로드 URL에 버전 쿼리(`?v=5-r.5-beta.3.1`)를 추가해 구버전 Cubism Core 캐시로 인한 로딩 정체(`state=15`) 재발을 방지.
- 2026-02-26: Live2D 로딩 전 `moc3`/텍스처 선검사와 로딩 정체(`state`, 텍스처 카운트) 진단 메시지를 추가해 무반응(blank canvas) 상황의 원인 확인성을 개선.
- 2026-02-26: Live2D 로더를 디렉터리 기준 상대 참조 해석 방식으로 조정해 텍스처가 비어 보이는(blank canvas) 문제를 수정하고, ZIP(blob) 경로는 상대 키 재작성 방식으로 보완.
- 2026-02-26: Live2D 렌더러를 `easy-cl2d + live2dcubismcore` 기반으로 마이그레이션해 Cubism 5 모델(`moc3 v6`)을 직접 재생하도록 변경.
- 2026-02-26: `video` 컷신에 포커스/가시성 복귀 시 자동 재생 복구(`visibilitychange`, `focus`, `pageshow`)를 추가하고, `HOLD TO SKIP` 게이지 재시작 시 즉시 동기화 동작을 반영.
- 2026-02-26: Live2D 로더를 외부 PIXI 플러그인 기반에서 Core 직접 로더 기반으로 재구성하고, 모델 참조 URL 정규화를 추가.
- 2026-02-26: `input` 게이트 마지막 오답 단계에서 입력창에 정답(`correct`)을 자동 주입하도록 동작을 추가.
- 2026-02-26: `choice` 게이트 첫 옵션 자동 포커스 및 Enter/Space 선택을 추가하고, `input` 게이트 빈 입력 상태 버튼 라벨을 `모르겠다`로 변경.
- 2026-02-26: 캐릭터 레이어 하단 경계를 다이얼로그 박스 상단에 맞추고, 이미지 캐릭터를 하단 정렬(`object-position: center bottom`)로 조정.
- 2026-02-26: 엔딩 버튼을 `처음부터 다시하기`로 변경하고, 엔딩 수집 키(`vn-ending-progress`)는 유지한 채 첫 챕터 재시작하도록 동작을 갱신.
- 2026-02-26: 모바일 확대 방지를 위해 viewport 확대 제한과 멀티터치/제스처 차단 동작을 문서화.
- 2026-02-26: `choice`에 `forgiveOnceDefault`/`forgiveMessage` 및 `options[].forgiveOnce`/`options[].forgiveMessage`를 추가해 옵션별 1회 유예를 지원.
- 2026-02-26: YAML V3 도입. `config.yaml` + 계층 `base.yaml` + 챕터 병합 구조로 전면 개편.
- 2026-02-26: 레거시 `meta/settings` 챕터 포맷 제거, `config.yaml` 필수화.
- 2026-02-26: 경로 canonicalization(`/`, `./`, `../`, bare) 규칙과 자식 우선 병합 규칙 문서화.
- 2026-02-26: Conan 샘플을 V3 구조(`config/base/routes-base/chapter`)로 마이그레이션.
- 2026-02-26: `script` 기본 진행/scene·chapter `goto` 전이 규칙과 resolver 캐시 동작을 명시.
- 2026-02-26: Conan 샘플을 `0 -> 1 -> 2 -> routes/hub -> conclusion` 4막 에피소드형 구조로 재편.
- 2026-02-26: 상태 모델을 `investigation_count`/`visited_*`/`deduction_score` 중심으로 교체하고 엔딩 판정식을 갱신.
- 2026-02-26: 라운지 조기 이동 패널티를 `deduction_score`/`final_confidence` 기반으로 조정하고, 인물 루트를 1회 재시도 scene 패턴으로 통일.
