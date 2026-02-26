<div align="center">

# YAVN (야븐)

Type your story. Play your novel.

[![Node](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

`YAVN`은 YAML 기반 비주얼노벨 엔진입니다.
현재 DSL은 **YAML V3**이며, 전역/공통/챕터 선언을 분리합니다.

## Quick Start

```bash
pnpm install
pnpm dev
```

- Node: `20.x`
- 기본 주소: [http://localhost:5173](http://localhost:5173)

라우팅:
- `/`: 런처(샘플 ZIP 다운로드, ZIP 업로드 실행, PR 공유)
- `/game-list/:gameId`: `public/game-list/<gameId>/` 게임 즉시 실행

## YAML V3 구조 (필수)

### 1) 루트 `config.yaml` (필수)

```yaml
title: "게임 제목"
author:
  name: "작성자"
  contacts:
    - "Email: writer@example.com"
version: "1.0"
textSpeed: 38
autoSave: true
clickToInstant: true
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
      base: assets/char/conan/base.png
      emotions:
        serious: assets/char/conan/serious.png
  music:
    mystery: assets/music/mystery.wav
  sfx:
    door: assets/sfx/door.wav
state:
  score: 0
  suspect: ""
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
      - say:
          text: "시작"
```

## V3 계약 요약

- `config.yaml`은 게임 루트에 **필수**입니다.
- `config.yaml` 전용 필드:
  - `title`, `author`, `version`
  - `textSpeed`, `autoSave`, `clickToInstant`
  - `endings`, `endingRules`, `defaultEnding`
- `base.yaml` 허용 필드: `assets`, `state`
- 챕터 YAML 허용 필드:
  - 필수: `script`, `scenes`
  - 선택: `assets`, `state`
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
- 작성 DSL은 `state` 평면 맵을 사용하며, 런타임 내부에서는 `state.defaults`로 정규화됩니다.
- `script/scenes`는 챕터 YAML만 사용
- `endings/endingRules/defaultEnding`은 `config.yaml`만 사용

## 경로 규칙

- `/...`: 게임 루트 기준
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
- `choice`
- `branch`
- `ending`

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

## `choice`/`input`에서 캐릭터 노출

`say` 없이도 `choice`/`input` 단계에서 캐릭터를 직접 노출할 수 있습니다.

- `choice.char`, `choice.with`
- `input.char`, `input.with`

```yaml
- choice:
    prompt: "이리저리 클릭 드래그해보며 Live2D 테스트해보세요."
    char: 렌.Idle
    options:
      - text: "테스트 끝"
        goto: ren_live2d_drag_test
```

동작:
- `char`를 지정하면 해당 캐릭터를 기준으로 노출/표정이 동기화됩니다.
- `with`는 함께 노출할 보조 캐릭터 목록입니다.
- `char`를 생략하면 기존처럼 직전 노출 상태를 유지합니다.

## `script` 실행 의미

- `script`는 챕터의 기본 scene 진행 순서입니다.
- 엔진은 `script[0]`에서 시작하고, 현재 scene의 action을 모두 소비하면 `script`의 다음 scene으로 이동합니다.
- `goto: scene_id`는 scene 점프입니다. 점프한 scene이 끝나면 그 scene의 `script` 위치 다음 scene으로 이어집니다.
- `goto: ./...` 또는 `goto: /...`는 챕터 점프입니다.
- 권장: `goto` 대상 scene도 `script`에 포함해 두세요. (`script`에 없는 scene 종료 시 다음 계산 기준이 모호해집니다.)

## 챕터 로딩 규칙

- `0.yaml`이 있으면 `0,1,2...` 순서
- 없고 `1.yaml`이 있으면 `1,2,3...` 순서
- `goto: ./routes/a/1.yaml`처럼 경로 점프 가능
- 경로 점프 후 같은 폴더의 번호 챕터를 순차 진행
- `../`를 포함한 챕터 `goto`는 허용하지 않습니다.
- 챕터 로딩 오버레이는 첫 화면에 노출되는 Live2D 캐릭터가 실제로 `ready/error` 상태를 보고할 때까지 유지됩니다.

## Conan 샘플 분기 구조

- `0.yaml`은 콜드 오픈 챕터로, 사건의 이상 징후를 먼저 보여준 뒤 `1.yaml`로 넘어갑니다.
- `1.yaml`은 도착/관계/사건 발생, `2.yaml`은 초동 정리와 현장 재구성 파트입니다.
- `routes/hub/1.yaml`은 조사 라운지이며, `신이치/레이코/켄지/하루오` 대면 루트를 자유 선택할 수 있습니다.
- 각 인물 루트(`routes/<suspect>/1.yaml`)는 1회 재도전 구조로 핵심 단서를 잠그고 라운지로 복귀합니다.
- 라운지에서 조기 정리 회의로 이동할 수 있고, 방문 수에 따라 `deduction_score`/`final_confidence` 패널티가 적용됩니다.
- 결말은 `conclusion/1.yaml`로 합류하며, 최종 지목과 재지목 1회 흐름을 유지합니다.

## 샘플

- `public/game-list/conan/config.yaml`
- `public/game-list/conan/base.yaml`
- `public/game-list/conan/routes/base.yaml`
- `public/game-list/conan/0.yaml`
- `public/game-list/conan/1.yaml`
- `public/game-list/conan/2.yaml`
- `public/game-list/conan/routes/hub/1.yaml`
- `public/game-list/conan/routes/shinichi/1.yaml`
- `public/game-list/conan/routes/reiko/1.yaml`
- `public/game-list/conan/routes/kenji/1.yaml`
- `public/game-list/conan/routes/haruo/1.yaml`
- `public/game-list/conan/conclusion/1.yaml`
- `public/game-list/live2dtest/config.yaml`
- `public/game-list/live2dtest/base.yaml`
- `public/game-list/live2dtest/1.yaml`
- `sample.yaml`

## 개발 메모

- 런처 게임 목록은 `predev`/`prebuild`에서 `scripts/generate-game-list-manifest.mjs`로 생성됩니다.
- 표시명은 `config.yaml.title`을 우선 사용합니다.
- 엔딩 화면 하단에는 `처음부터 다시하기` 버튼 1개만 표시됩니다.
- `처음부터 다시하기` 클릭 시 저장된 엔딩 수집(`vn-ending-progress:<gameId>`)은 유지하고, 현재 플레이 상태만 첫 챕터 기준으로 재시작합니다.
- 엔딩 크레딧 롤 영역은 초기 자동 스크롤 구간에서 입력을 잠그고(`pointer-events: none`), 자동 스크롤이 멈춘 뒤에만 수동 스크롤을 허용합니다.
- 모바일 브라우저에서는 핀치/제스처 확대를 막도록 viewport와 터치 제스처를 제한합니다.
- 캐릭터 레이어는 다이얼로그 박스 상단 경계까지만 사용하며, 캐릭터 이미지는 레이어 하단 기준으로 정렬됩니다.
- 선택지(`choice`)가 열리면 첫 옵션에 자동 포커스되며, Enter/Space 키로 옵션을 선택할 수 있습니다.
- 입력 게이트(`input`)는 값이 비어 있으면 제출 버튼 라벨을 `모르겠다`로 표시합니다. (입력 후에는 `확인`)
- 입력 게이트(`input`)에서 마지막 오답 메시지(정답 안내 단계)에 도달하면 입력창에 정답 값이 자동으로 채워집니다.
- Live2D 캐릭터 로딩은 `easy-cl2d` + `public/vendor/live2d/live2dcubismcore.min.js`(공식 Cubism Core) 조합으로 동작합니다.
- 현재 Live2D 실행은 Cubism 5 모델(`moc3 v6`, `model3.json`)을 포함해 Cubism Core 호환 범위를 기준으로 렌더링합니다.
- 코어 스크립트는 `live2dcubismcore.min.js?v=5-r.5-beta.3.1`로 로드해 브라우저 캐시로 인한 구버전 코어 잔존을 방지합니다.
- Cubism Core v53에서 `renderOrders` 구조가 달라진 케이스를 위해 런타임 호환 패치를 적용해 `easy-cl2d` 렌더러 크래시(`undefined[0]`)를 방지합니다.
- Live2D 캐릭터의 중앙 배치는 CSS `transform` 기반 오프셋을 제거해 포인터 추적 좌표(클릭/드래그 시 시선 반응) 불일치를 줄였습니다.
- Live2D 포인터 좌표는 캔버스의 `getBoundingClientRect()` 기준 로컬 좌표로 보정하고, 드래그 시작 지점이 캔버스 내부일 때만 추적하도록 조정해 `left/center/right` 위치 간 시선 추적 오차를 줄였습니다.
- Live2D 캔버스 리사이즈는 `devicePixelRatio`를 반영한 실제 드로잉 버퍼 크기를 사용해 고해상도 화면에서 입력 좌표와 렌더 좌표 불일치를 완화합니다.
- Live2D 로더는 URL 게임에서 모델 디렉터리 기준 상대 참조를 우선 사용하고, ZIP(blob) 로딩에서는 blob 참조를 상대 키로 재작성해 텍스처/모션 경로를 안정화합니다.
- 챕터 프리로드는 `model3.json` 내부 참조(`Moc/Physics/Pose/UserData/DisplayInfo/Textures/Expressions/Motions`)까지 확장해 Live2D 본 로딩 지연을 줄입니다.
- Live2D 로딩 전에 `moc3`/첫 텍스처를 선검사하고, 장시간 로딩 정체 시 상태 코드(`state`)와 텍스처 카운트 진단 메시지를 표시합니다.
- `public/vendor/live2d/*` 및 `public/game-list/live2dtest/assets/char/ren_pro_ko/*`는 Live2D 별도 라이선스 적용 자산이며, 배포/상업 이용 전 각 라이선스 조건을 확인해야 합니다.
- 비디오 컷신 재생 중 탭 전환/브라우저 포커스 이탈 후 복귀하면 자동으로 재생 복구를 시도합니다. (`visibilitychange`, `focus`, `pageshow`)
- `HOLD TO SKIP` 게이지는 누름 해제 후 재시작 시 0%부터 즉시 동기화되어 숫자 표시와 동일하게 진행됩니다.
