# visual novel

간단한 웹 비주얼노블 게임 메이커입니다. JSON 파일만 수정해도 새로운 챕터를 손쉽게 만들 수 있습니다.

## 요구 사항
- Node.js 20.11 이상
- 패키지 매니저: pnpm (권장) 혹은 npm

## 설치 및 실행
1. 의존성 설치
   ```bash
   pnpm install
   ```
2. 개발 서버 실행 (기본 포트: `5173`)
   ```bash
   pnpm dev
   ```
   브라우저에서 `http://localhost:5173`으로 접속하면 시작 화면을 확인할 수 있습니다.
3. 프로덕션 번들 생성
   ```bash
   pnpm build
   ```
4. 번들 미리 보기
   ```bash
   pnpm preview
   ```

## 콘텐츠 구조
모든 게임 데이터는 `public/` 디렉터리의 JSON 파일로 관리합니다. 기본적으로 챕터 번호(`level`)에 맞춰 다음 파일 쌍을 준비해야 합니다.

| 파일 | 설명 |
| --- | --- |
| `public/chapter{N}.json` | 챕터 N의 장면과 대사를 정의합니다. |
| `public/assets{N}.json` | 챕터 N에서 사용할 이미지·오디오 자산을 선언합니다. |

### 시작 화면 리소스
- `public/start.json`: 시작 화면에서 사용할 배경 이미지(`image`)와 배경음악(`audio`)을 지정합니다.
- `public/start.png`, `public/start.mp3`: `start.json`이 참조하는 실제 파일입니다.

### 챕터 파일 (`chapter{N}.json`)
각 챕터 파일은 장면(Scene) 객체 배열입니다.

```json
[
  {
    "character": "matthew",
    "place": "matthew-house",
    "changePosition": true,
    "sentences": [
      "안녕하세요.",
      { "message": "천천히...", "duration": 200 },
      [
        { "message": "효과음과 함께", "asset": "exclamation" },
        { "message": "등장합니다." }
      ]
    ]
  }
]
```

- `character`: 등장 캐릭터(이미지) 키. `assets{N}.json`에 정의되어야 합니다.
- `place`: 배경 이미지/배경음 키. `assets{N}.json`에 정의되어야 합니다.
- `changePosition`(선택): `true`일 경우 캐릭터가 좌/우 위치를 바꾸지 않도록 고정합니다.
- `sentences`: 플레이어가 순차적으로 읽는 대사입니다.
  - 문자열: 그대로 출력됩니다.
  - 객체: `{ "message": string, "duration"?: number, "asset"?: string }`
    - `duration`은 글자가 타이핑되는 간격(ms)입니다. 생략 시 100ms.
    - `asset`을 지정하면 문장과 함께 이미지/오디오가 재생됩니다.
  - 배열: 여러 문장을 묶어 한 장면에서 순차적으로 출력할 때 사용합니다.

### 자산 파일 (`assets{N}.json`)
자산 파일은 키-값 형태로 이미지 및 오디오 경로를 선언합니다.

```json
{
  "matthew": { "image": "/assets/matthew.png" },
  "matthew-house": { "image": "/assets/matthew-house.png" },
  "exclamation": { "audio": "/assets/noti.wav" }
}
```

- `image`: 화면에 배치할 캐릭터·배경·이펙트 이미지 경로
- `audio`: 문장과 함께 재생할 음향 효과 경로

장면에서 `character`, `place`, `asset`으로 참조하는 모든 키는 이 파일에 정의되어 있어야 합니다. 추가 리소스는 `public/assets/` 등에 배치하고 경로를 맞춰 주면 됩니다.

### 저장 및 불러오기
- 게임이 챕터의 마지막 장면을 완료하면 저장 화면이 나타납니다. `저장` 버튼을 누르면 다음 챕터 번호가 적힌 JSON 파일이 다운로드되며, 이 파일을 다시 업로드하면 해당 챕터부터 이어서 진행할 수 있습니다.
- `public/sampleSave.json`은 1레벨부터 이어서 시작하는 예시 저장 파일입니다. 시작 화면의 `불러오기` 버튼을 눌러 업로드하면 테스트할 수 있습니다.

### 세션 유지
진행 상황은 `sessionStorage`에 저장되므로 브라우저 새로고침 후에도 동일한 탭에서는 이어서 플레이할 수 있습니다. `StorageContext`와 `useSession` 훅이 이를 관리합니다.

## 추가 커스터마이징
- `public/splash/`의 이미지들을 교체하면 스플래시 화면을 변경할 수 있습니다.
- 컴포넌트 레이아웃 및 애니메이션은 `src/components/`와 `src/pages/` 하위 파일을 수정하여 조정합니다.

## 라이선스
프로젝트 내 리소스의 사용 범위는 각 자산의 라이선스를 따릅니다. 직접 배포하는 경우 외부 리소스의 사용 권한을 반드시 확인하세요.
