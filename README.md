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

## 샘플

- `public/game-list/conan/config.yaml`
- `public/game-list/conan/base.yaml`
- `public/game-list/conan/routes/base.yaml`
- `public/game-list/conan/1.yaml`
- `public/game-list/conan/routes/shinichi/1.yaml`
- `public/game-list/conan/routes/reiko/1.yaml`
- `public/game-list/conan/conclusion/1.yaml`

## 개발 메모

- 런처 게임 목록은 `predev`/`prebuild`에서 `scripts/generate-game-list-manifest.mjs`로 생성됩니다.
- 표시명은 `config.yaml.title`을 우선 사용합니다.
