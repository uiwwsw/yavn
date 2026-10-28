# 게임 목록에 작품 추가하기

[기여 절차](../CONTRIBUTING.md) · [English](ADDING_A_GAME.en.md) · [상세 DSL](DEVELOPMENT_GUIDE.ko.md)

게임 목록은 `public/game-list/`의 하위 폴더를 읽어 생성됩니다. 웹사이트의 ZIP 업로드는 로컬 실행이며 저장소 제출이나 공개 목록 등록을 하지 않습니다. 목록 공개에는 작품 패키지를 포함한 PR과 유지관리자의 병합·배포가 필요합니다.

## 1. 최소 패키지로 시작하기

[개발 환경](../CONTRIBUTING.md#개발-환경)을 준비하고 저장소 루트에서 실행합니다. `my-story`는 다른 작품과 겹치지 않는 영문 소문자·숫자·하이픈 ID로 바꿉니다. 기존 디렉터리에 복사하지 마세요.

```bash
cp -R examples/game-template public/game-list/my-story
pnpm dev
```

Vite가 출력한 주소의 `/game-list/my-story/`를 열고 두 선택에서 모두 엔딩까지 진행합니다. 루트 `/`에서도 작품명으로 검색합니다. 템플릿은 원본 한국어 이야기, 선택 2개와 엔딩 1개가 있는 에셋 없는 완전한 패키지입니다. 예제 자체는 `examples/`에 있으므로 복사하기 전에는 공개 목록에 나타나지 않습니다.

```text
public/game-list/my-story/
  config.yaml       # 제목·제작자·버전·시작 화면·엔딩
  base.yaml         # 공통 assets/state/inventory
  launcher.yaml     # 목록 소개·태그·실제 지원 언어
  0.yaml            # 첫 챕터의 script/scenes
  assets/           # 필요한 경우 이미지·음악 등 추가
```

- `config.yaml.title`, `author.name`, `version`을 작품 정보로 바꾸고 각 YAML의 대사와 선택·엔딩을 작성합니다.
- 새 패키지는 `0.yaml`부터 시작하는 숫자 챕터를 권장합니다. 다음 장은 `1.yaml`, `2.yaml`로 확장하고 장면 이동과 챕터 이동을 구분합니다. URL 실행의 순차 챕터 탐색은 첫 누락 번호에서 멈추므로 번호를 건너뛰지 않습니다. 하위 경로 분기와 `base.yaml` 계층 병합은 상세 DSL 가이드를 따릅니다.
- `sample.yaml`은 큰 작품에서 가져온 기능 예시라 다른 상태·에셋·챕터 참조를 포함합니다. 독립 실행용 시작점은 위 템플릿을 사용합니다.
- 작품을 다른 폴더에 의존시키지 말고 에셋도 작품 안에 둡니다. 상대 에셋 경로와 파일명의 대소문자를 실제 파일에 맞춥니다. `root:/`는 명시적인 공용 리소스에만 사용하며 다른 작품 경로를 무심코 복사하지 않습니다.

## 2. 목록 카드와 언어·공유 정보 작성하기

`launcher.yaml`은 엔진 DSL과 분리된 목록 메타데이터입니다.

```yaml
languages: [ko]
summary: "편지 한 장에서 시작하는 짧은 선택형 이야기."
thumbnail: "assets/cover.jpg" # 파일을 추가한 경우에만 지정
# 위 thumbnail 줄은 이미지가 없으면 생략합니다.
tags: [short-story, mystery]
translations:
  en:
    summary: "A Korean-language mystery that begins with a letter."
```

`languages`에는 실제로 플레이할 수 있는 이야기 언어만 적습니다. 영어 소개나 영어 엔진 UI만으로 `[ko, en]`을 선언하지 않습니다. `translations.en.summary`는 영어 목록 소개만 바꿉니다. `thumbnail`이 없으면 `config.yaml.startScreen.image`로 대체되며 둘 다 없으면 런처 기본 표현을 사용합니다. 선택 필드 `showcase`는 쇼케이스 라벨·배경색·이미지 구도를 조절합니다.

검색·공유용 `seo.description`, `seo.keywords`, `seo.image`, `seo.imageAlt`는 `config.yaml`에서 지정합니다. 대표 공유 이미지는 JPEG/PNG를 권장하며 화면 에셋과 분리할 수 있습니다. 파일이 실제로 존재하고 공개해도 되는지 확인합니다. 자세한 필드와 범위는 [런처 메타데이터](DEVELOPMENT_GUIDE.ko.md#1-1-런처-게임-목록-메타-manifest-v5)를 참고하세요.

## 3. 목록 생성과 자동 검증

```bash
node scripts/generate-game-list-manifest.mjs
pnpm check:public
pnpm test
pnpm build
```

`pnpm dev`와 `pnpm build`도 시작 전에 목록 생성기를 실행합니다. 개발 서버를 켠 뒤 폴더를 새로 추가했다면 생성기를 다시 실행하고 목록을 새로고침합니다.

- `public/game-list/index.json`과 `public/sitemap.xml`은 생성물입니다. 직접 편집하지 말고 이번 작품에서 발생한 생성물 diff를 PR에 포함합니다. `generatedAt`은 실행할 때 갱신됩니다.
- 챕터 YAML이 없는 폴더는 목록에서 빠집니다. 챕터 수는 하위 폴더를 포함하고 파일명이 `config/base/launcher`인 YAML을 제외합니다. 작품명은 `config.yaml.title`을 우선하며 목록은 작품명 순으로 정렬됩니다.
- 목록 생성 성공은 전체 게임 DSL·모든 참조·모든 경로의 검증 성공을 의미하지 않습니다. 잘못된 메타 YAML은 경고 후 일부 기본값으로 대체될 수 있으므로 콘솔 경고와 실제 목록을 함께 확인합니다.
- 빌드는 각 `/game-list/<id>/`의 검색·공유 HTML을 생성합니다. 생성된 `dist/`와 의존성·캐시는 커밋하지 않습니다.

## 4. 플레이 검수

PR에 실제 결과와 미확인 항목을 남깁니다. 기존 자동 테스트가 새 게임의 모든 분기를 자동으로 플레이하지는 않습니다. 조건부 분기·새 기능에는 별도의 게임 테스트를 추가하세요.

- 루트 목록에서 제목·제작자·요약·태그·지원 언어·썸네일을 확인하고 한국어/영어 목록 및 검색·필터를 확인합니다.
- `/game-list/<id>/` 직접 진입과 새로고침, 시작 화면과 첫 챕터 로딩을 확인합니다.
- 모든 선택, 조건 분기, 챕터 이동, 엔딩·게임오버와 복구를 확인합니다. 이미지·오디오·Live2D를 사용하면 누락과 로딩 오류도 확인합니다.
- 자동/수동 저장과 이어하기, 새 게임을 확인합니다. 기존 작품 갱신이면 이전 버전 저장과 다른 작품 저장의 격리를 확인합니다.
- PC·휴대폰 폭에서 제목·대사·선택·메뉴가 잘리지 않는지, 키보드 조작과 소리·모션 설정을 확인합니다.
- ZIP도 배포한다면 `config.yaml`, `base.yaml`, `launcher.yaml`, 챕터·에셋이 ZIP 루트에 오도록 압축하고 웹사이트 ZIP 실행으로 별도 확인합니다. 상위 `my-story/` 폴더째 감싸지 않습니다. ZIP 실행은 공개 목록을 바꾸지 않습니다.

## 5. 출처와 PR 제출

자체 제작물도 저작자와 적용할 이용 조건을 명시합니다. 이미지·음악·글꼴·모델 등 제3자 자료는 원출처 URL, 저작자, 라이선스/허락 근거와 재배포 조건을 `docs/games/<id>/ASSET_PROVENANCE.md` 등에 기록합니다. 편집 원본·아카이브·불필요한 대형 파일은 `public`에 두지 않습니다. `public/game-list/**`는 그대로 공개되므로 내부 작업 노트나 개인정보를 포함하지 않습니다.

게임 안에서 보여야 하는 출처·권리 문구는 `config.yaml.legalNotices`로 선언합니다. `id`, `title`, `text`는 필수이고 `copyright`, HTTP(S) `links`는 선택입니다. 고지 문구만으로 이용 허락이 생기지는 않습니다. 다른 샘플 작품의 캐릭터·음악·법적 고지를 자신의 허락 근거로 복사하지 마세요.

```bash
git add public/game-list/my-story public/game-list/index.json public/sitemap.xml
# 출처 문서와 추가한 테스트도 해당 경로를 지정해 stage합니다.
python3 .github/scripts/check-public-docs.py --staged
git diff --staged
```

[기여 가이드](../CONTRIBUTING.md)의 나머지 검사 후 작업 브랜치를 자신의 fork 또는 권한 있는 원격에 푸시하고 `uiwwsw/yavn:main` 대상 PR을 엽니다. 자동으로 표시되는 PR 템플릿에 game ID·플레이 경로·지원 언어·검증 결과·권리 근거·PC/모바일 캡처와 알려진 문제를 적습니다. 유지관리자가 검토·병합하고 배포해야 공개 사이트에 나타납니다.

## 목록에 보이지 않거나 실행되지 않을 때

| 증상 | 확인할 곳 |
| --- | --- |
| 목록에 없음 | `public/game-list/<id>/` 위치, 챕터 YAML 존재, 생성기 재실행과 브라우저 새로고침 |
| 제목·요약·언어가 다름 | `config.yaml.title`, `launcher.yaml.summary/languages`, YAML 들여쓰기와 생성기 경고 |
| 카드만 보이고 실행 오류 | 첫 숫자 챕터, `config.yaml`, DSL 파서 오류와 상태/에셋/장면 참조 |
| 개발에서는 보이나 배포에서 이미지 오류 | Git에 포함된 파일과 대소문자, 상대 경로, 다른 게임에 대한 의존 여부 |
| JSON/XML 충돌 | 원본 YAML을 먼저 병합한 뒤 목록 생성기를 다시 실행 |
| 로컬에는 있지만 공개 사이트에는 없음 | PR 병합과 유지관리자의 배포 완료 여부 |
