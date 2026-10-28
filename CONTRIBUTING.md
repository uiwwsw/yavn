# YAVN 기여 가이드

[English](CONTRIBUTING.en.md) · [게임 목록 등록 절차](docs/ADDING_A_GAME.ko.md) · [YAML 개발 가이드](docs/DEVELOPMENT_GUIDE.ko.md)

게임 제작, 기존 작품 수정, 엔진 기능·버그 수정, 번역과 문서 개선을 환영합니다. 게임만 추가할 때는 React나 엔진 코드를 수정할 필요가 없습니다.

## 먼저 작업 범위를 나누기

- **게임 추가**: [등록 가이드](docs/ADDING_A_GAME.ko.md)의 독립 패키지를 만들고 작품 단위 PR을 엽니다.
- **기존 게임 수정**: 해당 작품 폴더와 필요한 검증만 수정합니다. 공개된 폴더명, 선택 키, 장면·액션 순서는 저장 호환성에 영향을 주므로 변경 이유와 기존 저장 검증 결과를 적습니다.
- **엔진 변경**: 버그 재현이나 제안 이슈에서 동작·호환성을 설명합니다. 특정 게임 ID·캐릭터·태그를 하드코딩하지 않고 공통 DSL/메타데이터로 구현합니다.
- **큰 기능·대규모 에셋**: 구현 전에 이슈나 초안 PR에서 범위와 용량을 논의하면 중복 작업을 줄일 수 있습니다. 작은 오타 수정에는 선행 이슈가 필요하지 않습니다.

## 개발 환경

Node.js 22.13+와 `package.json`에 고정된 pnpm 11.21.0을 사용합니다.

```bash
git clone https://github.com/<your-account>/yavn.git
cd yavn
git remote add upstream https://github.com/uiwwsw/yavn.git
git fetch upstream
git switch -c feat/my-contribution upstream/main
corepack enable
corepack prepare pnpm@11.21.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

외부 기여자는 GitHub에서 먼저 저장소를 fork합니다. 저장소 쓰기 권한이 있는 협업자는 저장소를 직접 clone하고 `origin/main`에서 작업 브랜치를 만들어도 됩니다. 기본 개발 주소는 `http://localhost:5173`이며 포트가 사용 중이면 Vite가 출력한 주소를 따릅니다. 일반 게임 제작·테스트에는 운영 비밀값이나 배포 계정이 필요하지 않습니다.

관리형 Developer 작업공간에서는 해당 작업공간의 실행 래퍼·SSD 규칙을 따릅니다. 일반 clone에서는 위의 pnpm 명령을 직접 실행할 수 있습니다.

## 함께 작업하는 방법

1. 이슈나 초안 PR에 담당 작품/기능과 변경할 영역을 적습니다. 공용 파서·스키마·런처·의존성 변경은 다른 작업과 먼저 조율합니다.
2. 한 브랜치와 PR에는 하나의 목적을 담습니다. 게임 콘텐츠와 무관한 엔진 리팩터링은 나눕니다. 다른 기여자의 변경을 덮어쓰거나 함께 커밋하지 않습니다.
3. 작업 전 최신 main을 가져오고, PR 제출 전 최신 변경과 충돌을 해결합니다. 공유 브랜치의 이력을 강제로 덮어쓰지 않습니다.
4. 생성 파일 충돌은 수동으로 JSON/XML을 합치기보다 원본 YAML을 병합한 뒤 생성기를 다시 실행합니다. `public/game-list/index.json`과 `public/sitemap.xml`은 공유 생성물입니다.
5. PR 본문에 변경 이유, 검증 명령·결과, 화면 변경의 PC/모바일 캡처, 저장 호환성과 알려진 한계를 씁니다. 실행하지 않은 검증은 미실행으로 표시합니다.

## 검증과 리뷰

```bash
pnpm test
pnpm build
python3 .github/scripts/check-public-docs.py --staged
python3 .github/scripts/check-ai-notice.py
python3 .github/scripts/check-ai-notice.py --built
```

마지막 문서 검사는 `git add` 후 정확한 staged diff를 대상으로 실행합니다. 테스트·빌드 실패를 고치고 새 기능이나 버그에는 의미 있는 회귀 테스트를 추가합니다. 엔진 동작이나 DSL을 변경하면 한국어 개발 가이드와 관련 README·영어 안내를 함께 갱신하고, DSL 사용법이 바뀌면 실행 가능한 YAML 예시도 갱신합니다. 게임 검수는 자동 테스트와 별도로 [플레이 체크리스트](docs/ADDING_A_GAME.ko.md#4-플레이-검수)를 따릅니다.

PR 대상은 `uiwwsw/yavn`의 `main`입니다. PR 템플릿의 해당 항목을 작성하고 리뷰 요청에 같은 브랜치에서 후속 커밋으로 답합니다. 병합은 저장소의 필수 검사·리뷰·관리자 판단을 따르며, PR 제출만으로 게임 공개가 보장되지는 않습니다. 배포는 유지관리자가 기존 배포 절차로 처리합니다.

## 콘텐츠와 공개 범위

배포되는 게임 YAML과 에셋은 공개됩니다. 업로드할 권리가 있는 자료만 포함하고 [등록 가이드의 출처 기록](docs/ADDING_A_GAME.ko.md#5-출처와-pr-제출)을 작성합니다. 비밀값, 개인 기록, 개발용 원본·아카이브와 캐시는 커밋하지 않습니다. 보안 문제에 실제 자격증명이나 개인정보가 포함되면 공개 이슈/PR에 원문을 붙이지 마세요. 저장소의 기존 라이선스와 제3자 권리는 그대로 유지됩니다.
