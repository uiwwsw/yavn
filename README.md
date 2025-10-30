# Visual Novel ✨

<div align="right">

[🇰🇷 한국어](#readme-ko) | [🇺🇸 English](#readme-en)

</div>

<a id="readme-ko"></a>

**Visual Novel**은 JSON만으로 감각적인 웹 비주얼 노블을 제작할 수 있는 React 기반 툴킷입니다.
플레이어(엔진)와 제너레이터가 한데 묶여 있어, 데이터를 정의하면 즉시 웹에서 재생 가능한 작품이 완성됩니다.
직관적인 데이터 구조와 반응형 UI 컴포넌트를 통해, 시나리오에 몰입하는 데만 집중하세요.

## 왜 Visual Novel인가?
- **JSON 기반 저작**: Git으로 버전 관리가 쉬운 구조. 시나리오, 자산, 저장 파일까지 모두 텍스트로 관리합니다.
- **스타일 선행**: 기본 제공되는 UI와 애니메이션이 이미 완성형입니다. 색상, 폰트, 인터랙션만 살짝 조정하면 브랜드를 입힐 수 있어요.
- **웹 배포 최적화**: Vite + React 스택으로 구성되어 즉시 개발, 즉시 배포가 가능합니다.

## Matthew's Adventure — 매튜의 모험
> "코드와 감성이 만나는 순간"

라이브러리의 모든 기능은 시연작 **매튜의 모험**에서 확인할 수 있습니다.
영웅 매튜와 동료들의 여정을 한 편의 대서사시로 풀어낸 이 예제는 다음과 같은 특징을 보여줍니다.

- 챕터별 복합 장면 연출 (`public/chapter0.json` ~ `public/chapter5.json`)
- 다채로운 캐릭터/배경 아트 (`public/assets/*.png`, `public/assets0.json`)
- 저장/불러오기 시스템 (`public/sampleSave.json`)
- 커스텀 스플래시 및 스타트 화면 (`public/start.png`, `public/start.json`)

이 저장소를 클론한 뒤 개발 서버를 띄우면, 매튜의 모험이 즉시 실행되는 모습을 확인할 수 있습니다.

## 빠른 시작
1. **의존성 설치**
   ```bash
   pnpm install
   ```
2. **개발 서버 실행** (기본 포트 `5173`)
   ```bash
   pnpm dev
   ```
   브라우저에서 `http://localhost:5173`으로 접속하면 스타트 화면과 매튜의 모험을 플레이할 수 있습니다.
3. **프로덕션 번들 생성**
   ```bash
   pnpm build
   ```
4. **번들 미리보기**
   ```bash
   pnpm preview
   ```

## 프로젝트 구조 한눈에 보기
```
public/
├── assets/              # 캐릭터, 배경, 이펙트 등 정적 자산
├── assets{N}.json       # 챕터별 자산 정의 (이미지/오디오 키-값)
├── chapter{N}.json      # 장면과 대사를 묶은 시나리오 파일
├── start.json           # 시작 화면 배경/음악 설정
├── sampleSave.json      # 저장 데이터 예시
└── splash/              # 로딩/스플래시 이미지
src/
├── components/          # UI 컴포넌트 (대사창, 선택지 등)
├── pages/               # 라우팅 및 주요 화면 구성
└── contexts/            # 세션 및 상태 관리
```

## 시나리오 작성 가이드
모든 장면은 `chapter{N}.json`에 JSON 배열 형태로 작성합니다.

```json
[
  {
    "character": "매튜",
    "place": "아메바 왕국",
    "changePosition": true,
    "sentences": [
      "새로운 모험이 기다리고 있어!",
      { "message": "빛을 좇아!", "duration": 60 },
      [
        { "message": "동료들을 모아", "asset": "emoji-rocket" },
        { "message": "왕국을 지키자!" }
      ]
    ]
  }
]
```

- **`character` / `place` / `asset`**: `assets{N}.json`에 정의된 키를 참조합니다.
- **`sentences`**: 순차적으로 재생되는 대사 목록입니다.
  - 문자열은 그대로 출력됩니다.
  - 객체는 `{ "message": string, "duration"?: number, "asset"?: string }` 형태로 타이핑 속도와 연출 자산을 지정합니다.
  - 배열은 하나의 장면에서 여러 문장을 연속으로 보여줄 때 사용합니다.

### 자산 선언 (`assets{N}.json`)
```json
{
  "매튜": { "image": "/assets/character-matthew.png" },
  "아메바 왕국": { "image": "/assets/bg-1.png" },
  "emoji-rocket": { "image": "/assets/emoji-rocket.svg" }
}
```
- `image`: 화면에 배치할 PNG/SVG 등 정적 이미지 경로
- `audio`: 문장과 함께 재생할 효과음/배경음 경로

필요한 자산을 `public/assets/` 등에 추가한 후 경로만 맞춰주면 됩니다.

### 저장과 이어하기
- 챕터를 마치면 저장 화면이 나타나고, 다음 챕터 정보를 담은 JSON 파일이 자동으로 다운로드됩니다.
- 이 파일을 다시 업로드하면 해당 지점부터 이어서 플레이할 수 있습니다.
- `sessionStorage`를 활용하여 브라우저를 새로고침해도 같은 탭에서는 진행 상황이 유지됩니다.

## 커스터마이징 아이디어
- **스타트/스플래시 화면 교체**: `public/start.*`, `public/splash/`의 이미지와 음악을 교체하세요.
- **UI 조정**: `src/components/`와 `src/pages/`의 React 컴포넌트를 수정하면 애니메이션, 인터랙션, 레이아웃을 자유롭게 바꿀 수 있습니다.
- **테마 확장**: Tailwind CSS가 이미 설정되어 있으니 `tailwind.config.js`와 전역 스타일에서 색상/폰트 테마를 확장하세요.

## 라이선스 & 크레딧
이 프로젝트에 포함된 모든 아트/오디오 리소스는 각 제작자의 라이선스를 따릅니다. 배포 시 반드시 사용 권한을 확인하고, 크레딧 표기를 잊지 마세요.

이제 당신만의 매튜를 만들어 보세요. 🚀

---

<a id="readme-en"></a>

**Visual Novel** is a React-powered toolkit that lets you craft immersive web visual novels using nothing but JSON.
Because the player (engine) and generator ship together, defining your data instantly produces a playable experience in the browser.
With intuitive data structures and responsive UI components, you can focus solely on storytelling.

## Why Visual Novel?
- **JSON-first authoring**: A Git-friendly structure where scenarios, assets, and saves are all maintained as plain text.
- **Style-forward defaults**: Polished UI and animations out of the box—lightly adjust colors, fonts, and interactions to match your brand.
- **Built for the web**: Powered by the Vite + React stack for instant development and deployment.

## Matthew's Adventure
> "Where code meets emotion."

Experience every feature through the showcase story **Matthew's Adventure**.
Follow Matthew and his companions on an epic journey that highlights the toolkit's capabilities:

- Chapter-driven set pieces (`public/chapter0.json` ~ `public/chapter5.json`)
- Rich character and background art (`public/assets/*.png`, `public/assets0.json`)
- Save/load system (`public/sampleSave.json`)
- Custom splash and start screens (`public/start.png`, `public/start.json`)

Clone the repository, launch the dev server, and Matthew's Adventure will be ready to play immediately.

## Quick Start
1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Run the dev server** (default port `5173`)
   ```bash
   pnpm dev
   ```
   Visit `http://localhost:5173` in your browser to play through the start screen and demo story.
3. **Create a production build**
   ```bash
   pnpm build
   ```
4. **Preview the bundle**
   ```bash
   pnpm preview
   ```

## Project Structure at a Glance
```
public/
├── assets/              # Static assets for characters, backgrounds, effects
├── assets{N}.json       # Chapter-specific asset definitions (image/audio key-value pairs)
├── chapter{N}.json      # Scenario files tying together scenes and dialogue
├── start.json           # Start screen background and music configuration
├── sampleSave.json      # Example save data
└── splash/              # Loading and splash imagery
src/
├── components/          # UI components (dialogue box, choices, etc.)
├── pages/               # Routing and top-level screens
└── contexts/            # Session and state management
```

## Writing Scenarios
Author each scene as an array in `chapter{N}.json`.

```json
[
  {
    "character": "Matthew",
    "place": "Amoeba Kingdom",
    "changePosition": true,
    "sentences": [
      "A new adventure awaits!",
      { "message": "Chase the light!", "duration": 60 },
      [
        { "message": "Gather the crew", "asset": "emoji-rocket" },
        { "message": "Protect the kingdom!" }
      ]
    ]
  }
]
```

- **`character` / `place` / `asset`**: Reference keys defined in `assets{N}.json`.
- **`sentences`**: Dialogue entries played sequentially.
  - Strings render as-is.
  - Objects follow `{ "message": string, "duration"?: number, "asset"?: string }` to control typing speed and visual flair.
  - Nested arrays let you present several lines consecutively within a single scene.

### Declaring Assets (`assets{N}.json`)
```json
{
  "Matthew": { "image": "/assets/character-matthew.png" },
  "Amoeba Kingdom": { "image": "/assets/bg-1.png" },
  "emoji-rocket": { "image": "/assets/emoji-rocket.svg" }
}
```
- `image`: Path to static imagery such as PNG or SVG files placed on screen.
- `audio`: Path to sound effects or background tracks that accompany the line.

Add the required assets to `public/assets/` (or similar) and make sure the paths match.

### Saving & Resuming
- Finishing a chapter triggers a save screen that downloads a JSON file with the next chapter's state.
- Upload that file to resume play exactly where you left off.
- The toolkit also leverages `sessionStorage`, so progress persists within the same tab after refresh.

## Customization Ideas
- **Swap the start/splash screens**: Replace the imagery and music in `public/start.*` and `public/splash/`.
- **Tweak the UI**: Modify React components under `src/components/` and `src/pages/` to tailor animations, interactions, and layouts.
- **Extend the theme**: Tailwind CSS is ready to go—enhance colors and typography via `tailwind.config.js` and global styles.

## License & Credits
All art and audio assets bundled with this project follow their creators' licenses. Confirm usage rights before distribution and credit the original authors.

Bring your own Matthew to life. 🚀
