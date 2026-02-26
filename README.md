<div align="center">

# YAVN (야븐)

Type your story. Play your novel.

[![Node](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/uiwwsw/visual-novel?style=flat)](https://github.com/uiwwsw/visual-novel/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/uiwwsw/visual-novel?style=flat)](https://github.com/uiwwsw/visual-novel/network/members)

</div>

`YAVN (야븐)`은 숫자 챕터 YAML(`0.yaml`, `1.yaml`, `2.yaml`...)을 자동 감지하고, **현재 챕터만 지연 로드**해서 빠르게 실행하는 비주얼노벨 엔진입니다.
런처/ZIP 실행/PR 공유 흐름까지 포함되어 있어, 게임 제작과 배포 실험을 바로 시작할 수 있습니다.

## Why this project

- 챕터 단위 Lazy Load + 다음 챕터 백그라운드 프리로드
- YAML 스키마 검증(Zod) + 라인/컬럼 기반 에러 오버레이
- 대사 타이핑 효과 + `<speed=...>` 인라인 속도 제어
- `say.with` 기반 화자 중심 캐릭터 노출(기본 1인 + 추가 동시 노출)
- `video`, `input`, `choice`, `branch`, `ending` 등 연출/분기 액션 내장
- `set/add` 기반 분기 상태(`bool/number/string`) 누적 + 자동저장 복원
- `endingRules` + `defaultEnding` 기반 자동 엔딩 판정(명시 `ending` 우선)
- 로컬/YouTube 컷신 기본 음소거 자동재생 + 길게 눌러 스킵 UX
- ZIP 업로드 시 로컬 컷신 경로(`video.src`)도 blob URL로 자동 치환
- `input` 게이트 노출 시 입력창 자동 포커스
- `choice` 게이트 노출 시 클릭 강제 진행 차단
- 엔딩 시 영화식 롤링 크레딧 + 하단 고정 `게임 다시 시작하기` 버튼
- `게임 다시 시작하기` 클릭 시 엔딩 오버레이 즉시 종료 후 1챕터 재로딩
- ZIP 업로드 즉시 실행 + 샘플 ZIP 다운로드 + GitHub PR 공유 버튼
- 모바일까지 고려한 연출(캐릭터 우선순위/컷신 스킵 UX)

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

## YAML DSL Example

```yaml
meta:
  title: "명탐정 코난 외전: 다실의 비밀"
  author:
    name: "uiwwsw"
    contacts:
      - "Email: creator@yavn.dev"
      - label: "LinkedIn"
        value: "linkedin.com/in/uiwwsw"
        href: "https://linkedin.com/in/uiwwsw"

settings:
  textSpeed: 38
  autoSave: true
  clickToInstant: true

assets:
  backgrounds:
    tea_room: assets/bg/tea_room.png
  characters:
    코난:
      base: assets/char/conan/base.png
      emotions:
        serious: assets/char/conan/serious.png
    코고로:
      base: assets/char/kogoro/base.png
      emotions:
        angry: assets/char/kogoro/angry.png
  music: {}
  sfx: {}

state:
  defaults:
    trust: 0
    suspect: ""
    culprit_answer: ""

endings:
  true_end:
    title: "TRUE END"
    message: "진실에 도달했다."
  bad_end:
    title: "BAD END"
    message: "결정적 단서를 놓쳤다."

endingRules:
  - when:
      var: trust
      op: gte
      value: 2
    ending: true_end
defaultEnding: bad_end

script:
  - scene: intro

scenes:
  intro:
    actions:
      - bg: tea_room
      - char:
          id: 코고로
          position: left
          emotion: angry
      - char:
          id: 코난
          position: center
          emotion: serious
      - choice:
          key: first_probe
          prompt: "누구를 먼저 추궁할까?"
          options:
            - text: "신이치"
              set:
                suspect: "신이치"
              add:
                trust: 1
              goto: accuse_shinichi
            - text: "레이코"
              set:
                suspect: "레이코"
              goto: accuse_reiko

  accuse_shinichi:
    actions:
      - input:
          prompt: "범인의 이름을 입력해봐."
          correct: "신이치"
          errors:
            - "다시 생각해봐."
          saveAs: culprit_answer
          routes:
            - equals: "신이치"
              add:
                trust: 1
      - ending: true_end

  accuse_reiko:
    actions:
      - ending: bad_end
```

노트:
- `say.char`가 있으면 해당 화자 1명이 기본 노출되고, `say.with`로 지정한 캐릭터만 추가 노출됩니다.
- `say.char`가 없는 내레이션은 캐릭터를 숨기고 텍스트에 집중합니다.
- `chat.with`는 지원하지 않으며, 같은 목적은 `say.with`를 사용합니다.
- `input.routes`/`branch.cases`는 첫 매칭 우선으로 분기됩니다.
- 자동 저장에는 `chapter/scene/action`뿐 아니라 `routeVars/routeHistory/resolvedEndingId`도 포함됩니다.
- `goto`는 씬 ID뿐 아니라 챕터 파일 경로도 받을 수 있습니다(`./a/5.yaml`, `./31`).
- 챕터 경로 `goto`는 항상 게임 루트 기준이며, 대상 챕터부터 같은 폴더 번호 순서로 이어서 진행됩니다.
- `../b/3.yaml` 같은 상대 상위 경로는 지원하지 않습니다. 루트 절대경로(`./b/3.yaml` 또는 `/b/3.yaml`)만 사용합니다.

실제 예시는 [public/game-list/conan/1.yaml](<home>/visual-novel/public/game-list/conan/1.yaml)에서 확인할 수 있습니다.

## Supported Actions

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

상세 사용법은 [docs/DEVELOPMENT_GUIDE.ko.md](<home>/visual-novel/docs/DEVELOPMENT_GUIDE.ko.md)에 정리되어 있습니다.

## Chapter Loading Rules

- `0.yaml`이 있으면 `0`부터, 없으면 `1.yaml`부터 시작
- 시작 시 현재 챕터만 파싱, 다음 챕터는 백그라운드 프리로드
- 챕터 진입 전 해당 YAML 에셋 프리로드 + 로딩 UI 노출
- 로딩 UI는 최소 600ms 유지, 100% 이후 200ms 뒤 종료
- HUD/로딩에서 챕터 분수(`N/M`) 대신 일반 문구/제목 중심 표시

## Launcher UX

`/` 페이지 버튼:
- `샘플 파일 다운받기 (ZIP)`
- `게임 실행해보기 (ZIP 올려서)`
- `게임 공유하기 (PR)` → GitHub compare 화면으로 이동

## Project Structure

```text
public/
  game-list/
    index.json
    conan/
      1.yaml
      2.yaml
      3.yaml
      4.yaml
      assets/
src/
  engine.ts
  parser.ts
  schema.ts
```

## Docs

- 개발 가이드: [docs/DEVELOPMENT_GUIDE.ko.md](<home>/visual-novel/docs/DEVELOPMENT_GUIDE.ko.md)
- 스토리→YAML 변환 프롬프트: [docs/YAML_STORY_TO_DSL_PROMPT.ko.md](<home>/visual-novel/docs/YAML_STORY_TO_DSL_PROMPT.ko.md)
- 샘플 확장 계획: [docs/SAMPLE_EXPANSION_PLAN.ko.md](<home>/visual-novel/docs/SAMPLE_EXPANSION_PLAN.ko.md)

## Development

```bash
pnpm dev      # 로컬 개발 서버
pnpm build    # 프로덕션 빌드
pnpm preview  # 빌드 결과 미리보기
```

## Contributing

1. `public/game-list/<your-game>/`에 YAML과 에셋 추가
2. 루트(`/`)에서 ZIP으로 실행 확인
3. PR 생성 (`게임 공유하기 (PR)` 버튼 활용 가능)

---

프로젝트 목표는 간단합니다: **작가/기획자가 YAML만으로 연출 가능한 VN을 빠르게 웹에서 실행**할 수 있게 만드는 것.
