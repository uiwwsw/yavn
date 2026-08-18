# 덕만 완결판 자산 제작 기록

이 문서는 정식 패키지 `public/game-list/deokman/`에서 사용하는 시각 자산의 제작·재사용 근거를 기록합니다.

## 시작 화면

- 파일: `assets/bg/title-deokman-v8-fire-v1.webp`
- 제작일: 2026-08-18
- 제작 방식: OpenAI 이미지 생성 도구로 신규 제작 후 WebP로 최적화
- 용도: 시작 화면, 런처 썸네일, SEO 대표 이미지
- 최종 프롬프트 요약: 금지된 사망 기록과 청동 모란패를 든 어린 덕만, 불타기 시작한 7세기 신라 별궁, 검은 별과 떨어지는 별빛, 제목과 시작 버튼을 위한 여백을 둔 16:9 시대극 스릴러 키아트
- 제외 조건: 이미지 내부 문구·로고·워터마크, 현대 물품, 중국 황실 용·봉황 문양, 판타지 갑옷

## 어린 덕만 스프라이트

- 파일: `assets/char/deokman-child-silla-v7.webp`
- 파일: `assets/char/deokman-child-scared-silla-v7.webp`
- 파일: `assets/char/deokman-child-resolve-silla-v7.webp`
- 제작일: 2026-08-18
- 제작 방식: 기존 V6 원화의 인물·표정·복식·구도를 유지하고, 이진 알파 외곽을 안쪽으로 정리한 뒤 부드러운 알파 경계를 다시 적용해 흰색 매트 테두리만 제거한 투명 WebP로 재인코딩
- 검수: 세 파일 모두 `888×1771`, 알파 채널 보유, 실제 게임 배경 합성에서 흰 외곽선과 가로 띠가 보이지 않음을 확인

## 아이템

- 파일: `assets/items/peony-painting.svg`
- 파일: `assets/items/death-register.svg`
- 파일: `assets/items/peony-token.svg`
- 파일: `assets/items/market-seal.svg`
- 파일: `assets/items/grain-ledger.svg`
- 파일: `assets/items/eclipse-table.svg`
- 파일: `assets/items/empty-seal-box.svg`
- 파일: `assets/items/star-chart.svg`
- 파일: `assets/items/burnt-kite.svg`
- 파일: `assets/items/bidam-letter.svg`
- 제작일: 2026-08-18
- 제작 방식: 저장소 내부 SVG로 신규 설계
- 공통 기준: 전체 캔버스를 덮는 배경 도형 없이 독립 오브젝트만 렌더링하고, 비단·먹·젖은 인주·청동 녹청의 재질을 각 아이템의 서사 단서로 사용

## 검증된 기존 자산 재사용

- 배경: `moon-court`, `shadow-corridor`, `village`, `council-hall`, `banquet-hall`, `frontier`, `locked-room`, `princess-chamber`, `throne-hall`, `title-palace`의 V3 실사풍 신라 배경을 재사용했습니다.
- 인물: 성인 덕만·천명·유신·비담·진평왕·칠숙의 V5 기본/감정 시트를 재사용했습니다.
- 역할 매핑: 기존 소원 시트는 `소화`, 진운 시트는 `춘추`, 아진 시트는 `당 사신`으로 극중 역할을 새로 부여했습니다.
- 재사용 범위는 시각 자산에 한정합니다. 삭제된 구버전 덕만 YAML과 스토리 분기는 완결판에 복원하지 않았습니다.

## 패키지 경로

- 시작 화면·SEO·런처·본편의 모든 자산 참조는 `root:/game-list/deokman/assets/...` 또는 런처 기준 상대 경로를 사용합니다.
- 이전 프리뷰 경로는 완결판에서 사용하지 않습니다.
