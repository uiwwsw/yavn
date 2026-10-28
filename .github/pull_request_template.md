## 변경 목적 / Purpose

<!-- 관련 이슈, 해결하는 문제, 변경 후 동작 / Issue, problem and resulting behavior -->

## 변경 범위 / Scope

- [ ] 게임 추가·수정 / Game content
- [ ] 엔진·런처 / Engine or launcher
- [ ] 문서·번역 / Documentation or translation

<!-- 게임이면 game ID, 플레이 경로, 실제 지원 언어와 분량 / For games: ID, play URL, actual story languages and duration -->

## 검증 / Validation

<!-- 실제 실행 명령과 결과를 적고, 미실행·실패·해당 없음은 이유를 씁니다. / Record commands/results; explain skipped, failed or inapplicable checks. -->

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Staged public-content and AI notice checks in CONTRIBUTING
- [ ] 게임이면 목록 카드와 직접 URL, 모든 선택·엔딩·챕터 이동, 저장/불러오기 확인 / Games: catalog and direct URL, branches/endings/chapter transitions, save/load
- [ ] 화면 변경이면 PC·모바일·키보드 확인 및 캡처 첨부 / Visual changes: desktop/mobile/keyboard checks and screenshots

## 호환성·권리·남은 문제 / Compatibility, rights and limitations

<!-- 기존 저장·선택 키·경로 영향과 알려진 문제 / Existing save, choice-key and path impact; known issues -->

- [ ] 새 에셋의 출처·저작자·라이선스·재배포 조건을 기록했습니다. / New asset sources, creators, licenses and redistribution terms are documented.
- [ ] 게임 전용 런타임 분기 없이 패키지/메타데이터로 구현했습니다. / Games use package data and metadata without game-specific runtime branches.
- [ ] 비밀값·개인정보·불필요한 원본/캐시를 포함하지 않고 생성물 diff를 검토했습니다. / No secrets, private data or unnecessary sources/caches; generated diff reviewed.
