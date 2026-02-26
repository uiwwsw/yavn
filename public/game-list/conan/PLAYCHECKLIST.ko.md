# Conan 분기 강화 플레이 체크리스트

## 1) 분기 강화 점검 요약
- 강화 포인트 A: `2.yaml`에서 초기 수사가 `precision_probe` / `shaky_probe`로 갈라짐.
- 강화 포인트 B: `2.yaml`에서 `켄지` 지목 시 전용 우회(`kenji_detour`) 추가.
- 강화 포인트 C: 각 루트에서 중간 `branch`(신뢰/실수/확신도 기반) 추가.
- 강화 포인트 D: 결론 챕터에서 추리 톤 분기(`kogoro_voice_sharp` / `kogoro_voice_shaky`) 추가.
- 강화 포인트 E: 기존 3엔딩 체계(TRUE/NORMAL/BAD)는 유지하면서 도달 경로 수를 확대.

## 2) 권장 플레이 점검 시나리오
1. 정답 고정 루트(TRUE 목표)
- 초기: 신이치 추적
- 시간 입력: `21:30`
- 향 입력: `금속` 또는 `금속 냄새`
- 재지목 없이 `신이치`로 마무리
- 기대: `true_end`

2. 복구형 루트(NORMAL 목표)
- 초기: 레이코 또는 켄지 선택
- 중간 오답 1~3회 허용
- 결론에서 최종 범인 `신이치`
- 기대: `normal_end`

3. 누적 오판 루트(BAD 목표)
- 중간 선택에서 감정 추궁 위주 선택
- 입력 오답 누적 + 오답 최종 지목
- 기대: `bad_end`

4. 재지목 기회 검증
- `final_accuse_gate`에서 일부러 오답 선택
- `wrong_answer_check` -> `comeback_gate` 진입 여부 확인
- 재지목 1회만 허용되는지 확인

5. 켄지 전용 우회 분기 검증
- 1막에서 켄지 선택
- `2.yaml`의 `kenji_detour` 진입 확인
- 전환 선택에 따라 `shinichi` 또는 `reiko` 라우트 이동 확인

## 3) 상태값 기반 검증 포인트
- `truth_point`: 추리 정밀도 누적
- `mistake_count`: 오판 누적
- `trust`: 대화/선택 신뢰도
- `final_confidence`: 결론 설득력
- `clue_word`: 핵심 향 단어 저장
- `comeback_chance`: 재지목 1회 제한

## 4) UX/연출 체크
- 오프닝 `video` 길게 누르기 스킵 동작
- `input` 오답 문구 단계 출력
- `sticker` 등장/퇴장(`clearSticker`) 자연스러움
- 같은 이펙트 연속 남용 여부
- 모바일에서 대사창/선택지/입력창 겹침 여부

## 5) 통과 기준
- TRUE/NORMAL/BAD 각 1회 이상 재현
- 주요 분기 노드(초기 지목/켄지 우회/재지목/결론 분기) 모두 도달
- YAML 파싱/빌드 에러 없음
