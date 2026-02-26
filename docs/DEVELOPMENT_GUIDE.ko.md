# YAVN (야븐) 개발 가이드

이 문서는 YAML V3 기준의 제작/유지보수 가이드입니다.

## 1) 빠른 시작

```bash
pnpm install
pnpm dev
```

- `/`: 런처
- `/game-list/:gameId`: `public/game-list/<gameId>/` 실행

## 2) YAML V3 핵심 구조

YAML V3는 파일 역할을 분리합니다.

1. `config.yaml` (루트, 필수): 전역 유니크 값
2. `base.yaml` (폴더별, 선택): 공통 `assets`, `state`
3. 챕터 YAML (`0.yaml`, `1.yaml`, `routes/*/1.yaml` 등): `script`, `scenes`

레거시 `meta/settings` 포맷은 지원하지 않습니다.

## 3) `config.yaml`

허용 키:
- `title`
- `author` (`string` 또는 `{ name?, contacts? }`)
- `version`
- `textSpeed`
- `autoSave`
- `clickToInstant`
- `endings`
- `endingRules`
- `defaultEnding`

예시:

```yaml
title: "명탐정 코난 외전: 다실의 비밀"
author:
  name: "uiwwsw"
version: "4.1"
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
      var: truth_point
      op: gte
      value: 4
    ending: true_end
defaultEnding: bad_end
```

노트:
- `endings/endingRules/defaultEnding`은 `config.yaml`에만 선언합니다.

## 4) `base.yaml`

허용 키:
- `assets`
- `state`

금지:
- `script`, `scenes`
- `title`, `textSpeed`, `endings` 계열
- `meta`, `settings`

예시:

```yaml
assets:
  backgrounds:
    tea_room: assets/bg/tea_room.png
  characters:
    conan:
      base: assets/char/conan/base.png
      emotions:
        serious: assets/char/conan/serious.png
  music:
    mystery: assets/music/mystery.wav
  sfx:
    thunder: assets/sfx/thunder.wav
state:
  trust: 0
  suspect: ""
```

## 5) 챕터 YAML

필수 키:
- `script`
- `scenes`

선택 키:
- `assets`
- `state`

금지:
- `title`, `textSpeed`, `endings` 계열
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
- 동일 state 키 타입 충돌 시 에러
- 작성 DSL은 `state` 평면 맵을 사용하고, 런타임 내부 표현은 `state.defaults`로 정규화됩니다.
- `script/scenes`는 챕터 YAML만 사용

## 7) 경로 규칙

- `/...`: 게임 루트 기준
- `./...`, `../...`: 선언한 YAML 파일 위치 기준
- `assets/...` 같은 bare 경로: 선언한 YAML 파일 위치 기준

내부에서는 asset/video 경로를 루트 기준 canonical key로 정규화해 병합/캐시/프리로드에 사용합니다.

## 8) 챕터 로딩 규칙

- `0.yaml` 존재 시 `0,1,2...`
- 아니면 `1.yaml`부터 `1,2,3...`
- `goto: ./routes/shinichi/1.yaml` 형태의 챕터 점프 지원
- 점프 대상부터 같은 폴더의 번호 파일을 순차 진행
- `../`를 포함한 챕터 `goto`는 지원하지 않음

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
- `choice`
- `branch`
- `ending`

## 10) 검증 규칙

런타임 파서가 아래를 검증합니다.

- `script`에 등장한 scene이 `scenes`에 존재하는지
- `goto` 대상(scene)이 존재하는지
- `bg/sticker/music/sound/char`가 `assets`에 선언되어 있는지
- `set/add/branch/input.saveAs/endingRules` 변수들이 `state`에 선언되어 있는지
- `defaultEnding`, `ending`, `endingRules[].ending`의 참조 정합성
- 권장 검증: `goto` 대상(scene)을 `script`에도 포함했는지

YAML 파싱 에러는 line/column 정보와 함께 표시됩니다.

## 11) 샘플 구조

```text
public/game-list/conan/
  config.yaml
  base.yaml
  1.yaml
  routes/
    base.yaml
    shinichi/
      1.yaml
      2.yaml
    reiko/
      1.yaml
      2.yaml
  conclusion/
    1.yaml
  assets/
    bg/
    char/
    music/
    sfx/
```

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
- 샘플 YAML: `public/game-list/conan/*.yaml`

## 14) 문서 변경 로그

- 2026-02-26: YAML V3 도입. `config.yaml` + 계층 `base.yaml` + 챕터 병합 구조로 전면 개편.
- 2026-02-26: 레거시 `meta/settings` 챕터 포맷 제거, `config.yaml` 필수화.
- 2026-02-26: 경로 canonicalization(`/`, `./`, `../`, bare) 규칙과 자식 우선 병합 규칙 문서화.
- 2026-02-26: Conan 샘플을 V3 구조(`config/base/routes-base/chapter`)로 마이그레이션.
- 2026-02-26: `script` 기본 진행/scene·chapter `goto` 전이 규칙과 resolver 캐시 동작을 명시.
