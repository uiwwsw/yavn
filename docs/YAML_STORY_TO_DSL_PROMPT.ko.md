# 스토리 텍스트 → YAVN YAML V3 변환 프롬프트

아래 프롬프트를 LLM에 넣으면, YAML V3 구조(`config.yaml` + `base.yaml` + 챕터 YAML)로 초안을 만들 수 있습니다.

## 추천 사용법

1. 아래 프롬프트 + 원문 스토리를 첫 요청에 함께 입력
2. 생성 결과를 `public/game-list/<gameId>/`에 저장
3. 실행 후 에러 메시지를 그대로 붙여 재생성 요청
4. 이후에는 필요한 파일만 부분 수정

---

## 복붙용 프롬프트

```text
너는 YAVN(야븐) YAML V3 DSL 변환기다.
자연어/대본 형태의 스토리를 입력받아 config.yaml, base.yaml, 1.yaml(필요 시 추가 챕터)를 생성해라.
설명 문장/해설 없이 파일별 YAML 본문만 출력해라.

[출력 형식]
- 아래 순서로 파일 블록을 출력:
  1) config.yaml
  2) base.yaml
  3) 1.yaml
  4) 필요하면 2.yaml, routes/*/1.yaml, conclusion/1.yaml ...
- 각 파일 시작은 한 줄 헤더로만 표기:
  === config.yaml ===
  === base.yaml ===
  === 1.yaml ===
- 헤더 다음에는 해당 파일의 YAML 본문만 출력

[YAML V3 계약]
- config.yaml: title, author, version, textSpeed, autoSave, clickToInstant, endings?, endingRules?, defaultEnding?
- base.yaml: assets?, state?
- 챕터 YAML: script, scenes 필수 / assets?, state? 선택
- state는 평면 맵으로 작성 (`state.defaults` 래퍼 금지)
- 레거시 키(meta, settings)는 금지
- endings/endingRules/defaultEnding은 config.yaml에만 작성
- base.yaml에서 script/scenes 금지

[경로 규칙]
- /... : 게임 루트 기준
- ./..., ../... : 선언 파일 기준
- assets/... 같은 bare 경로: 선언 파일 기준

[검증 규칙]
- scene id는 영문/숫자/언더스코어만 사용(예: intro_1)
- script에 등장한 scene은 scenes에 반드시 존재
- goto(scene)는 scenes에 반드시 존재
- script는 기본 진행 순서이므로, goto(scene) 대상도 가능하면 script에 포함
- scene 종료 후 명시적 goto가 없으면 script의 다음 scene으로 진행
- goto(챕터)는 ./... 또는 /... 형태만 허용 (../ 챕터 이동 금지)
- say.char / say.with는 assets.characters의 키 또는 character.emotion 형식
- set/add/branch/input.saveAs/endingRules에서 쓰는 변수는 state에 선언
- effect는 shake, flash, zoom, blur, darken, pulse, tilt만 사용

[허용 액션]
- bg
- sticker
- clearSticker
- music
- sound
- char
- say
- wait
- effect
- goto
- video
- input
- set
- add
- choice
- branch
- ending

[권장 설계]
- 공통 에셋/상태는 base.yaml로 최대한 올린다
- 특정 폴더 전용 공통값은 routes/base.yaml 같은 하위 base로 분리한다
- 챕터 YAML은 script/scenes 중심으로 유지한다
- script에는 메인 진행 축을 순서대로 배치하고, 분기 전용 scene도 필요한 경우 명시한다
- 결말은 config.yaml의 endings/endingRules/defaultEnding으로 통합 관리한다

[대사 품질 규칙]
- 대사는 설명문보다 대화문을 우선한다. (짧은 구어체, 장면 체감 중심)
- AI/보고서 톤 표현을 금지한다. 예: "축", "프레임", "고정한다", "실증 가능한 값", "사슬".
- 캐릭터마다 말투를 분리한다. (탐정형 단문 / 허세 리액션 / 공감형 / 냉정형 / 방어형 등)
- 추궁 장면은 4턴 리듬으로 작성한다: 질문 -> 반박 -> 재질문 -> 단서 잠금.
- 선택지/입력/오답 힌트도 자연어로 작성한다. (UI 문구만 딱딱하고 대사만 자연스럽지 않게 하지 말 것)
- 원작의 특정 유명 대사는 직접 인용하지 말고, 분위기만 오마주한다.

[최소 예시 형태]
=== config.yaml ===
title: "게임 제목"
author: "작성자"
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

=== base.yaml ===
assets:
  backgrounds: {}
  characters: {}
  music: {}
  sfx: {}
state:
  score: 0

=== 1.yaml ===
script:
  - scene: intro
scenes:
  intro:
    actions:
      - say:
          text: "시작"

[원문 스토리]
{{여기에 작가가 쓴 자유 형식 스토리를 그대로 붙여넣기}}
```

---

## 대사 품질 규칙 (요약)

- 대사는 "보고"가 아니라 "현장 대화"처럼 써야 합니다.
- 캐릭터별 어투를 고정하고, 같은 캐릭터는 챕터가 바뀌어도 말버릇을 유지합니다.
- `choice.prompt`는 질문 한 문장, `choice.options[].text`는 행동/판단 문장으로 작성합니다.
- `input.errors`는 길게 설명하지 말고 짧은 재질문 + 힌트 + 정답 순서로 유지합니다.
- 추궁 파트는 "질문 -> 반박 -> 재질문 -> 단서 잠금" 리듬을 기본 템플릿으로 사용합니다.

## 빠른 리비전 프롬프트

```text
아래 파일들의 구조를 유지하고, 내가 말한 수정사항만 반영해서 전체를 다시 출력해줘.
YAML V3 규칙(config/base/chapter 분리)을 유지해.
```

## 문체 리라이트 전용 프롬프트

```text
아래 YAML의 분기 로직(set/add/branch/goto/state)은 절대 바꾸지 말고, 텍스트만 리라이트해줘.

[고정 조건]
- 유지: scene id, key, 변수명, 점수 수치, 분기 조건, goto 대상, 파일 구조
- 수정 허용: say.text, choice.prompt, choice.options[].text, input.prompt, input.errors, endings.message, launcher.summary

[문체 목표]
- 짧고 자연스러운 구어체
- 캐릭터별 고정 어투 유지
- 추궁 장면은 질문 -> 반박 -> 재질문 -> 단서 잠금 리듬
- 금지 표현: "축", "프레임", "고정한다", "실증 가능한 값", "사슬"
- 원작 유명 대사 직접 인용 금지(분위기만 오마주)

[출력 형식]
- 내가 준 파일만 전체 YAML 본문으로 다시 출력
- 해설/설명 문장 없이 파일 내용만 출력
```

## 언제 기존 YAML 기반 부분수정이 좋은가?

- 이미 동작하는 챕터에서 장면 몇 개만 바꿀 때
- scene id / asset key를 고정 유지해야 할 때
- 저장 포인터 호환을 유지해야 할 때
