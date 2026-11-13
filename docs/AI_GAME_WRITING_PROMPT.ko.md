# AI에게 YAVN 게임을 맡기는 프롬프트

시놉시스 한 장으로 다른 AI(Claude, ChatGPT 등)에게 야븐 게임을 만들게 할 때 쓰는 프롬프트입니다. ERASE·8비트 심장·튜토리얼을 만들고 고치면서 실제로 문제가 됐던 것들(해설하는 내레이션, 같은 말투, 앞뒤가 안 맞는 설정, 튀는 장면 전환)을 처음부터 막도록 짰습니다.

한 번에 다 시키지 말고 세 번에 나눠 시키세요. 기획서를 먼저 받아서 읽어 보고, 마음에 들면 파일을 만들게 하고, 마지막에 다듬기를 시킵니다.

| 단계 | 넣을 것 | 받는 것 |
| --- | --- | --- |
| ① 기획 | 프롬프트 ① + 내 시놉시스 | 기획서(인물 설정표, 장 구성, 결말 조건) |
| ② 제작 | 프롬프트 ② + 확정한 기획서 | `config.yaml`, `base.yaml`, `0.yaml`… |
| ③ 다듬기 | 프롬프트 ③ 중 필요한 것 + 만든 파일 | 고친 장 파일 |

만든 파일은 `public/game-list/<게임id>/`에 넣고 `pnpm test`(또는 브라우저에서 열기)로 확인합니다. 오류가 나면 오류 메시지를 그대로 붙여 "이 오류만 고쳐 줘"라고 하면 됩니다. 그림·음악은 이 프롬프트 범위 밖입니다. 에셋 경로는 기획서에 목록으로 받아 두고 따로 준비하세요.

---

## 프롬프트 ① 기획서

```text
너는 비주얼노벨 작가이자 기획자다. 아래 시놉시스로 YAVN(야븐) 엔진용 게임 기획서를 써라. 아직 YAML은 쓰지 마라.

[시놉시스]
(여기에 붙여 넣기)

[기획서에 반드시 들어갈 것]
1. 한 줄 컨셉과 톤. 다른 게임과 구별되는 이 작품만의 형식을 하나 정해라.
   예: "휴대폰 화면으로 흘러가는 심리극", "게임기 설명서로 말을 배운 로봇의 버디물",
   "마트 고객센터 시스템 화면 속 스릴러". 연출(메시지 말풍선, 기록, 광고, 뉴스 속보 등)을 그 형식에 맞춰 고른다.
2. 인물 설정표. 인물마다 표 한 줄:
   이름·나이·직업 / 원하는 것(욕망) / 숨기는 것 / 말버릇과 존댓말·반말, 상대별 호칭 /
   구체적인 습관 하나, 서툰 것 하나, 몰래 하는 친절이나 못된 구석 하나 /
   무엇을 언제 알게 되는지.
   "착하다·밝다" 같은 형용사로 끝내지 말고 행동으로 적는다.
3. 시간표. 날짜·요일·나이·경력 연수를 실제로 계산해서 적는다. 이후 모든 대사는 이 표를 따른다.
4. 장 구성(보통 5장). 장마다: 무엇이 바뀌는가(주인공의 변화 한 단계), 주요 장면, 선택지와 그 대가.
5. 상태 변수와 결말 조건. 결말 3~4개, 각 결말에 도달하는 정확한 규칙(변수와 값).
   되돌릴 수 있는 실패(게임 오버) 1개 이상: 무엇을 고르면 죽고, 어느 선택으로 돌아가는지.
6. 반전이 있다면: 어디에 단서를 심고(장·장면), 어디서 다시 보여 주는지.
   반전은 대사로 설명하지 않고, 앞에서 본 기록·물건을 다시 보여 주는 식으로 드러낸다.
7. 에셋 목록: 배경, 인물(표정 2~4개), 소품, 음악 분위기.
8. 민감한 소재가 있으면 다루는 원칙과 시작 화면 내용 안내 문구.

[원칙]
- 인물은 기능(정보 전달용, 질문 담당)이 아니라 사람이어야 한다. 장면마다 그 인물이 원하는 것 때문에 움직인다.
- 게임마다 컨셉이 달라야 한다. 무난한 중간값을 고르지 마라.
- 기획서도 사람이 쓴 것처럼, 짧고 구체적으로.
```

---

## 프롬프트 ② 제작

```text
너는 YAVN(야븐) 비주얼노벨 엔진의 작가다. 아래 기획서대로 게임 파일을 써라.
출력은 파일마다 "=== 파일명 ===" 한 줄 뒤에 YAML 본문만. 해설은 쓰지 마라.
순서: config.yaml, base.yaml, 0.yaml, 1.yaml, ... (장 하나에 파일 하나)

[기획서]
(확정한 기획서 붙여 넣기)

━━━━━━━━ 글쓰기 규칙 (가장 중요) ━━━━━━━━
내레이션이 AI처럼 읽히는 순간 게임이 죽는다. 아래 문장은 쓰지 마라.
1. 독자에게 말 거는 문장: "이 이야기는 두 사람을 따라간다", "아직 아무도 몰랐다"
2. 백과사전식 설명: "X는 Y다.", "세상의 모든 기계는 ~에 연결돼 있다"
3. 이력서식 인물 소개: "한도윤은 영업2팀 대리다"
4. 배경 그림에 이미 보이는 걸 나열: "자판기, 사물함, 벽걸이 TV"
5. 의미심장하게 끝내는 한 줄: "담배는 없다.", "처음부터.", "식까지는 한 달이 남았다."
6. 뚝뚝 끊는 명사 나열: "새벽. 형광등. 그리고 침묵."
7. 감정·의미 해설, 격언, 말장난 같은 깔끔한 한 줄
8. 속마음(thought)으로 서브텍스트 설명. 속마음은 장 하나에 0~1줄, 그 인물다운 실용적인 생각만
   (할 일 목록, 핑계, 숫자). 자기 감정에 이름 붙이지 않는다.

정보는 세계 안에서 나오게 한다.
- 시간·장소 → place 액션 한 줄 ("토요일 오전 · 도윤과 지수의 집")
- 인물 소개 → 다른 인물이 자연스럽게 부르는 이름·호칭, 말다툼, 놀림
- 세계관 → 광고, 뉴스 속보, 알림 팝업(system), 서류·로그(record), 휴대폰 메시지(message)
- 서로 아는 사실을 서로에게 설명하지 않는다. 모르는 제3자가 묻게 하거나, 갈등이 정보를 끌어내게 한다.
남겨도 되는 내레이션: 그림으로 보여 줄 수 없는, 이야기에 꼭 필요한 짧은 행동 한 문장(평범한 현재형). 장면당 평균 1줄 이하.

대사:
- 실제 한국어 대화처럼. 끼어들기, 딴소리, 말끝 흐림, 일정·돈 같은 생활 이야기, 안 웃긴 농담.
- 존댓말·반말·호칭은 설정표대로 일관되게. 바뀌면 그건 사건이어야 한다.
- 인물마다 말투가 달라야 한다. 이름표를 가려도 누가 말했는지 알 수 있게.
- 선택지 문구는 요약("거절한다")이 아니라 그 인물이 실제로 하는 말이나 행동.

흐름:
- 장면이 바뀌면 처음 몇 줄 안에 언제·어디·누구인지 알 수 있어야 한다(place, 대사, 화면).
- 모든 장면이 같은 틀(카드 → 배경 → 내레이션 → 대사 → 선택 → 암전)로 시작하지 않게 한다.
  대화 한가운데서 시작하기, 메시지만으로 된 장면, 대사 한 줄로 끊기 등을 섞는다.
- 다투거나 다그치거나 놀라는 순간에는 move로 몸이 움직이게 한다(장마다 2~5번, 남발 금지).
- 끄덕임·한숨·떨림처럼 감정이 몸에 드러나는 줄에는 say.motion 또는 emote를 붙인다(대사 서너 줄에 한 번 정도).

━━━━━━━━ 엔진 규칙 (틀리면 안 열린다) ━━━━━━━━
config.yaml
  title, author: { name }, version: "1.0.0", textSpeed(25~40), clickToInstant: true
  ui: { template: cinematic-noir | neon-grid | paper-stage }   # 어두운 영화톤 / 레트로 게임 / 밝은 종이·현실
  legalNotices: [{ id, title, text }]   # 민감한 소재 안내
  startScreen: { enabled: true, image, music, showTitle: true, eyebrow, subtitle }
  endings: { <id>: { title, message, epilogue, background?, music?, tone: hopeful|tragic|mystery } }
  defaultEnding: <id>
base.yaml
  assets.backgrounds: { <id>: assets/bg/x.svg }   # 소품 스티커 이미지도 여기에 등록
  assets.music: { <id>: assets/music/x.wav }
  assets.sfx: { <id>: assets/sfx/x.wav }   # 선택
  assets.characters:
    <이름>: { name: "표시 이름", base: assets/char/x.svg, placement: prompt-top,
             defaultFraming: portrait, framings: { portrait: { scale: 1, cropBottom: 0.3 }, full: { scale: 1 } },
             emotions: { smile: assets/char/x-smile.svg },
             emotionMotions: { smile: nod } }   # 선택: 그 표정으로 바뀔 때 자동 몸짓
  state: { 변수: 기본값 }   # 쓰는 변수는 전부 여기 선언 (평면 맵)
inventory:   # base.yaml 최상위
  <아이템id>: { name, description, image: assets/items/x.svg, category, order }   # 설명에는 {{변수}} 못 씀
장 파일 (0.yaml, 1.yaml ...)
  chapterTitle: "장 제목"
  script: [{ scene: 첫장면id }]
  scenes: { 장면id: { actions: [ ... ] } }   # 장면 id는 영문·숫자·_ 만

액션
  - bg: 배경id   또는   - bg: { id, transition: fade|dissolve|cut, duration }
  - music: 음악id
  - char: { id: 인물, position: left|center|right }
  - say: { char: 인물[.표정], with: [같이 화면에 있을 인물], text: "..." }
      channel: dialogue(기본) | narration | action | thought | record | system | message | card
      message: side: me|them (휴대폰 말풍선, char가 보낸 사람) / erase: true 면 다 나온 뒤 지워짐
      card: 전체 화면 자막(장 제목, 시점 전환에만 아껴 쓰기)
      delivery: calm|nervous|angry|whisper|shout|sad / camera: wide|medium|close
      when: 조건 → 조건이 맞을 때만 나오는 대사
  - place: "언제 · 어디"   # 화면 위 작은 글씨로 떴다 사라짐. 클릭 대기 없음. 60자 이하
  - move: { id: 인물, toward: 다른인물|camera, style: approach|lunge|retreat|flinch|exit|reset, wait: true? }
      approach 다가섬 / lunge 확 덤빔 / retreat 물러섬 / flinch 움찔 / exit 화면 밖으로 퇴장 / reset 제자리
      두 인물 모두 char로 무대에 올라와 있어야 함. 자기 자신을 향할 수 없음
  - emote: { id: 인물, motion: 몸짓, repeat: 1~3?, wait: true? }   # 제자리 몸짓. 대사에는 say: { char, motion: 몸짓, text }
      nod 끄덕 / shake 도리도리 / tremble 떨림 / shiver 오싹 / sigh 한숨 / slump 축 처짐(유지) / perk 번쩍
      hop 폴짝 / bounce 들뜸 / laugh 웃음 / sob 흐느낌 / gasp 헉 / startle 깜짝 / recoil 몸 젖힘
      lean_in 몸 기울임 / bow 꾸벅 / sway 휘청 / stomp 쿵 / puff 씩씩 / freeze 얼어붙음 / headtilt 갸웃 / droop 고개 떨굼(유지)
      인물은 char로 무대에 있어야 함. say/choice/input의 motion은 char(화자)가 있어야 함. 유지 자세는 move reset으로 풂
  - choice:
      key: 고유키   # 결말·복귀가 참조
      prompt: "질문"
      char: 인물
      options:
        - { text: "선택지", goto: 장면id, set: { 변수: 값 }, add: { 변수: 1 }, when: 조건 }
        - { text: "죽는 선택", gameOver: { title, message, recoverToChoice: 고유키 } }
      timeoutMs: 8000, timeoutOptionIndex: 1   # 시간 제한 선택(선택)
      presentation: explore   # 장소 조사형. 각 option에 at: { x: 0~100, y: 0~100 }
  - input: { prompt, saveAs: 변수, defaultValue: "기본", maxLength: 8 }   # 이름 짓기 등
      → 대사·선택지에서 {{변수}}, 조사는 {{변수|은}} {{변수|이}} {{변수|을}} {{변수|와}} 처럼 자동
  - set: { 변수: 값 }  /  add: { 변수: 1 }  /  get: 아이템id
  - branch: { cases: [{ when: 조건, goto: 장면id }], default: 장면id }
  - goto: 장면id  또는  goto: /2.yaml (다음 장)
  - effect: shake|flash|darken|blur|pulse|tilt|zoom|glitch|alarm (또는 { name, wait: true })
  - sticker: { id, image: 배경목록의id, x: 50, y: 30, width: "clamp(140px, 18%, 240px)", enter: fadeIn }
    clearSticker: { id, leave: fadeOut }
  - wait: 밀리초
  - ending: 결말id   /   gameOver: { title, message, recoverToChoice: 고유키 }
  조건: { var: 변수, op: eq|ne|gt|gte|lt|lte, value: 값 } / { all: [...] } / { any: [...] } / { not: ... }

검증
- script·goto의 장면은 모두 존재. 마지막 장면은 ending 또는 다음 장으로 goto.
- 모든 결말에 실제로 도달하는 경로가 있고, 모든 gameOver의 recoverToChoice는 실제 choice key.
- 대사에 쓴 인물·표정·배경·음악 id는 base.yaml에 선언된 것만.
- 시간표·설정표와 어긋나는 대사가 없는지 마지막에 한 번 더 확인.
```

---

## 프롬프트 ③ 다듬기

필요한 것만 골라 쓰세요. 파일과 기획서를 함께 넣습니다.

### 내레이션이 AI 같을 때

```text
아래 장 파일에서 narration·action·card 줄을 전부 다시 봐라.
독자에게 말 거는 문장, 백과사전식 설명, 이력서식 소개, 배경에 보이는 걸 나열하는 문장,
의미심장한 마무리 한 줄, 뚝뚝 끊는 명사 나열, 감정 해설은 지워라.
필요한 정보는 place(시간·장소), 대사, 휴대폰·서류·광고·속보 화면으로 옮겨라.
목표: 내레이션·행동 줄을 70% 이상 줄이기. choice의 key·선택지 text·상태 변수·결말은 바꾸지 마라.
고친 전후 줄 수와 가장 나빴던 문장 5개의 전후를 함께 보여 줘라.
```

### 인물이 밋밋하거나 설정이 앞뒤가 안 맞을 때

```text
모든 장·분기의 대사를 읽고 인물별 사실표(나이, 관계, 호칭과 존댓말, 아는 것과 알게 되는 시점, 습관)를 만들어라.
서로 어긋나는 곳(누가 했다고 했다가 안 했다고 하는 것, 날짜·요일, 알 수 없는 걸 아는 것)을 전부 찾아 고쳐라.
그다음 인물마다 원하는 것과 구체적인 디테일(습관, 서툰 것, 몰래 하는 친절이나 못된 구석)을 더해
정보 전달용으로만 나오는 대사를 그 인물다운 대사로 바꿔라.
선택지 text·key·결말 조건은 바꾸지 마라. 찾은 모순과 고친 방법을 한 줄씩 보고해라.
```

### 이야기가 팍팍 튈 때

```text
처음 하는 사람이 되어 처음부터 끝까지, 모든 분기를 순서대로 읽어라.
"지금 어디? 언제? 이 사람 누구? 방금 무슨 일이 있었지?"가 생기는 곳을 전부 찾고,
가장 가벼운 방법(place 한 줄, 대사 한 줄, 화면 한 장)으로 이어라. 내레이션으로 설명하지 마라.
반전은 미리 밝히지 마라. 선택지 text·key·결말 조건은 바꾸지 마라.
```

### 장면에 몸의 움직임이 없을 때

```text
다투기, 다그치기, 고백, 위협, 놀람, 웃긴 순간을 찾아 move 액션을 넣어라.
다그칠 때 approach, 폭발할 때 lunge, 몰릴 때 retreat, 반전에 flinch, 정면으로 섬뜩할 때 toward: camera,
떠날 때 exit, 긴장이 풀리면 reset. 장마다 2~5번, 두 인물이 모두 char로 무대에 있을 때만.
자리를 옮길 일은 없지만 감정이 몸에 드러나는 줄에는 say에 motion을 붙여라(동의 nod, 거절 shake, 체념 sigh,
기쁨 hop, 놀람 startle·gasp, 두려움 tremble, 슬픔 droop·sob, 화 puff·stomp, 의아 headtilt). 대사 서너 줄에 한 번 정도,
같은 몸짓을 연달아 쓰지 말고, 대사가 이미 말한 감정을 또 강조하는 대신 말과 다른 속마음을 드러낼 때 아껴 써라.
```

---

관련 문서: 엔진 전체 문법은 [`DEVELOPMENT_GUIDE.ko.md`](DEVELOPMENT_GUIDE.ko.md), 이미 쓴 원고를 YAML로 옮기기만 할 때는 [`YAML_STORY_TO_DSL_PROMPT.ko.md`](YAML_STORY_TO_DSL_PROMPT.ko.md).
