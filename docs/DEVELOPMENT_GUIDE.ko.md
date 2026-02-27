# YAVN (야븐) 개발 가이드

이 문서는 YAML V3 기준의 제작/유지보수 가이드입니다.

## 1) 빠른 시작

```bash
pnpm install
pnpm dev
```

- 권장 런타임: Node.js `22.x` (pnpm `10.x`)
- `/`: Engine Console 런처 (실행 콘솔/워크스페이스/인스펙터)
- `/game-list/:gameId`: `public/game-list/<gameId>/` 실행

## 1-1) 런처 게임 목록 메타 (Manifest V3)

- `predev`/`prebuild`에서 `scripts/generate-game-list-manifest.mjs`를 실행해 `public/game-list/index.json` + `public/sitemap.xml`을 생성하고, 이어서 `scripts/check-public-allowlist.mjs`로 `public` 허용 목록을 검증합니다.
- 최신 스키마는 `schemaVersion: 3`입니다.
- `games[]` 필드:
  - 기본: `id`, `name`, `path`
  - 확장: `author`, `version`, `summary`, `thumbnail`, `tags`, `chapterCount`, `seo`
- `seo` 루트 필드:
  - `title`, `description`, `keywords`, `gameTitles`, `gameCount`
- `chapterCount`는 게임 폴더 하위 전체 YAML 중 `config/base/launcher`를 제외한 챕터 파일 수를 기록합니다.
- 런처는 V1(`id/name/path`) manifest도 파싱하도록 하위 호환을 유지합니다.
- `games[].seo`는 `config.yaml.seo`를 우선 사용하고, 누락 값은 `launcher.yaml.summary/tags` 및 썸네일 fallback으로 보완됩니다.
- sitemap의 `/game-list/<gameId>/` 항목은 manifest `games[].path`를 기준으로 자동 생성됩니다.

선택 메타 파일:
- `public/game-list/<gameId>/launcher.yaml` (선택)
- 허용 키: `summary`, `thumbnail`, `tags`
- 이 파일은 런처 전용이며 엔진 DSL 스키마(`config/base/chapter`)와 분리됩니다.
- `launcher.yaml.thumbnail`이 없고 `config.yaml.startScreen.image`가 있으면 manifest 생성 시 해당 이미지를 기본 썸네일로 사용합니다.

## 1-2) Public 허용 목록 정책

- URL 게임 실행 호환을 위해 `public/game-list/**` 전체는 공개 경로로 유지합니다.
- `public` 루트 허용 파일은 `favicon.svg`, `robots.txt`, `sitemap.xml`입니다.
- 위 경로 외 파일은 `pnpm run check:public`에서 실패 처리됩니다.
- 게임 런타임 비필수 파일(문서/라이선스/아카이브)은 저장소 루트 `assets/`로 이동해 관리합니다.

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
- `seo`
- `textSpeed`
- `autoSave`
- `clickToInstant`
- `ui`
- `startScreen`
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
  startButtonText: 시작하기
  buttonPosition: auto
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
- `startButtonText` 기본값은 `시작하기`, `buttonPosition` 기본값은 `auto`입니다.
- `seo`는 런처 및 `/game-list/:gameId` 페이지의 `description/keywords/og/twitter/json-ld` 생성에 사용됩니다.
- `seo.image`는 상대 경로(`assets/...`)와 절대 URL(`https://...`)을 모두 허용하며, 상대 경로는 게임 루트 기준으로 정규화됩니다.

## 4) `base.yaml`

허용 키:
- `assets`
- `state`

금지:
- `script`, `scenes`
- `title`, `seo`, `textSpeed`, `ui`, `startScreen`, `endings` 계열
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
- `title`, `seo`, `textSpeed`, `ui`, `startScreen`, `endings` 계열
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
- 로딩 오버레이는 첫 화면에서 노출되는 Live2D 캐릭터가 실제 `ready/error`를 보고할 때까지 유지되며, 이후에만 `loaded`로 전환됩니다.
- 챕터 로딩 중(`chapterLoading=true`)과 `setGame` 완료 전 상태에서는 다이얼로그 박스(`.dialog-box`)를 `opacity: 0`으로 숨기고, 해제 시 페이드 인합니다.
- 인게임 다이얼로그 우측 상단(박스 외부 컨트롤 레이어) `숨기기` 버튼으로 수동 숨김을 토글할 수 있으며, 버튼은 본문 텍스트와 겹치지 않습니다. 숨김 상태에서는 우측 하단 `대화창 열기` 버튼만 노출됩니다.
- 수동 숨김 상태에서는 클릭/`Enter`/`Space` 진행 입력을 차단해 의도치 않은 스크립트 진행을 방지합니다.
- 시스템 숨김 상태(챕터 로딩/게임 미로딩/컷신)에서는 캐릭터/스티커 레이어 하단 안전 여백(`stickerSafeInset`) 기준을 유지해, 최초 다이얼로그 표시 시 레이어 높이 점프를 방지합니다.
- 수동 숨김/복원 상태 변화는 캐릭터/스티커 레이어 하단 안전 여백(`stickerSafeInset`) 계산에도 즉시 반영됩니다.

## 8-0) 에피소드형 탐문 라운지 패턴 (Conan 샘플)

- `0.yaml`에서 콜드 오픈으로 사건 갈고리를 먼저 제시하고 `1.yaml`로 연결합니다.
- `1.yaml`은 사건 도입/발생, `2.yaml`은 초동 정리와 재구성으로 역할을 분리합니다.
- `2.yaml` 종료 후 `goto: /routes/hub/1.yaml`로 이동해 자유 탐문 라운드에 진입합니다.
- 라운지 챕터 권장 흐름:
- `all_done_check` -> 방문 완료 여부 분기
- `route_select` -> 인물 루트 선택 또는 조기 정리 회의 선택
- `early_exit_confirm`/`early_exit_penalty_branch` -> 조기 이동 패널티 적용
- 인물 루트는 `routes/<suspect>/1.yaml`로 분리하고, 완료 후 라운지로 복귀합니다.
- 인물 루트 공통 패턴:
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
- 클릭 시 엔진의 `restartFromBeginning()`을 호출해 페이지 새로고침 없이 첫 챕터부터 재시작합니다.
- 재시작 시 `vn-engine-autosave`는 제거됩니다.
- `vn-ending-progress:<gameId>`는 유지되므로 획득한 엔딩 기록은 지워지지 않습니다.

## 8-4) 모바일 확대(Zoom) 방지 동작

- `index.html` viewport는 `maximum-scale=1.0`, `user-scalable=no`를 사용합니다.
- 런타임은 iOS 제스처 이벤트(`gesturestart/change/end`)와 멀티터치 `touchmove`를 차단해 확대를 방지합니다.

## 8-5) 캐릭터 레이어/정렬 동작

- 캐릭터 레이어(`.char-layer`)의 하단 경계는 다이얼로그 박스 상단 위치와 동일하게 맞춥니다.
- 캐릭터는 레이어 하단(`bottom: 0`) 기준으로 배치되어, 대화창 위에 떠 보이지 않도록 고정됩니다.
- 이미지 캐릭터(`.char-image`)는 `object-position: center bottom`으로 하단 정렬됩니다.
- 다이얼로그가 수동 숨김 상태면 레이어 하단 inset을 `0`으로 강제해 캐릭터/스티커가 하단 전체 영역을 사용하고, 복원 시 inset 계산을 즉시 재개합니다.

## 8-6) 선택/입력 게이트 키보드 동작

- `choice` 게이트가 열리면 첫 번째 옵션 버튼에 자동 포커스됩니다.
- 포커스된 옵션은 `Enter`/`Space` 키로 즉시 선택할 수 있습니다.
- `input` 게이트는 입력값이 비어 있을 때 제출 버튼 라벨을 `모르겠다`로 표시하고, 값이 있으면 `확인`으로 표시합니다.
- `input` 게이트는 마지막 오답 단계(`attemptCount >= errors.length`)에 도달하면 입력창에 `correct` 값을 자동으로 채웁니다.

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
- 버튼 기본값:
  - 시작 버튼 텍스트 `startButtonText`: `시작하기`
  - 버튼 위치 `buttonPosition`: `auto`
- URL 게임(`/game-list/:gameId`)의 자동저장 키는 `vn-engine-autosave:game:<gameId>`를 사용합니다.
- 레거시 키(`vn-engine-autosave`)는 URL 로드시 fallback으로 읽고, 실제 resume 성공 시 게임별 키로 마이그레이션합니다.
- 시작 화면의 `이어하기` 버튼은 URL 게임에서만 노출하며, ZIP 실행에서는 노출하지 않습니다.
- 같은 탭 세션에서 시작/이어하기를 한 번 누르면 `sessionStorage` 플래그로 새로고침 시 시작 화면을 건너뜁니다.
- 런처 인스펙터 썸네일 우선순위는 `launcher.yaml.thumbnail` -> `config.yaml.startScreen.image` 순서입니다.
- 시작 화면 타이틀/버튼(`시작하기`, `이어하기`)은 `config.yaml.ui.template` 전역 템플릿(`cinematic-noir` | `neon-grid` | `paper-stage`)을 그대로 적용합니다.
- 시작 화면이 표시되는 동안에도 `config.yaml.seo`를 읽어 `description/keywords/og/twitter/json-ld`를 즉시 갱신합니다.

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
- `ui` 미선언 시 기본값은 `cinematic-noir`입니다.
- 템플릿 값은 활성 챕터 게임 해석 직후 스토어에 반영되어, `setGame` 이전 프리로드 로딩 구간에도 동일한 스타일이 유지됩니다.

## 8-11) 게임 HUD 안내 문구 동작

- 인게임 HUD는 좌측에 현재 게임 제목(`game.meta.title`)을 표시합니다.
- 우측 안내 문구 기본값은 `YAVN ENGINE`입니다.
- ZIP 업로드 로딩 중(`uploading=true`)에는 우측 안내 문구를 `ZIP Loading...`으로 표시합니다.

## 8-12) 다이얼로그 수동 숨김/복원 동작

- 다이얼로그 박스 우측 상단(박스 외부 컨트롤 레이어)에 `숨기기` 버튼을 표시합니다.
- 버튼 클릭 시 `dialogUiHidden=true`로 전환하고 다이얼로그 박스를 페이드 아웃합니다.
- 수동 숨김 상태에서는 우측 하단에 작은 `대화창 열기` 버튼을 표시합니다.
- `대화창 열기` 클릭 전까지는 전역 진행 입력(화면 클릭, `Enter`, `Space`)이 엔진 `handleAdvance()`로 전달되지 않습니다.

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

### 9-1) `choice` 옵션별 1회 유예

`choice` 액션은 잘못 누른 선택지를 "한 번만 봐주기" 동작으로 처리할 수 있습니다.

- `choice.forgiveOnceDefault` (optional): 해당 choice의 옵션 기본 유예값
- `choice.forgiveMessage` (optional): 기본 유예 문구
- `choice.options[].forgiveOnce` (optional): 개별 옵션 유예값(기본값 override)
- `choice.options[].forgiveMessage` (optional): 개별 옵션 유예 문구

실행 규칙:
- 유예가 활성화된 옵션은 첫 클릭에서 `goto/set/add`를 실행하지 않습니다.
- 같은 옵션을 다시 클릭하면 원래 분기가 실행됩니다.
- 유예 문구 우선순위: `options[].forgiveMessage` -> `choice.forgiveMessage` -> 엔진 기본 문구

### 9-2) `choice`/`input`에서 캐릭터 노출

`say` 액션 없이도 `choice`/`input` 단계에서 캐릭터를 직접 노출할 수 있습니다.

- `choice.char` (optional): 주 캐릭터 참조 (`캐릭터ID` 또는 `캐릭터ID.표정`)
- `choice.with` (optional): 함께 노출할 보조 캐릭터 참조 배열
- `input.char` (optional): 주 캐릭터 참조 (`캐릭터ID` 또는 `캐릭터ID.표정`)
- `input.with` (optional): 함께 노출할 보조 캐릭터 참조 배열

실행 규칙:
- `char`가 있으면 해당 단계에서 캐릭터 노출/표정 동기화를 즉시 적용합니다.
- `char`를 생략하면 직전 노출 상태를 유지합니다. (기존 스크립트와 호환)

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
  0.yaml
  1.yaml
  2.yaml
  routes/
    base.yaml
    hub/
      1.yaml
    shinichi/
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
- DSL 축약 샘플: `sample.yaml`

## 14) 문서 변경 로그

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
