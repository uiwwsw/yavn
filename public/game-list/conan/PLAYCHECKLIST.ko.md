# Conan 4용의자 탐문 플레이 체크리스트

## 1) 분기 점검 요약
- 점검 포인트 A: `0.yaml` 콜드 오픈 후 `1.yaml`로 정상 전이되는지 확인.
- 점검 포인트 B: `2.yaml` 초동 정리 뒤 `routes/hub/1.yaml` 조사 라운지로 이동하는지 확인.
- 점검 포인트 C: 라운지에서 4명 인물(`신이치/레이코/켄지/하루오`)을 자유 선택할 수 있는지 확인.
- 점검 포인트 D: 각 인물 루트가 1챕터로 독립 동작하고, 종료 후 라운지로 복귀하는지 확인.
- 점검 포인트 E: 최종 지목/재지목 선택지에 4명이 모두 노출되는지 확인.

## 2) 권장 플레이 점검 시나리오
1. 4명 전원 대면 완료 루트
- 라운지에서 4명 모두 1회씩 대면 완료.
- 기대: 자동 보너스(`deduction_score +1`, `final_confidence +1`, `trust +1`) 후 결말 이동.

2. 조기 이동 3명 대면 루트
- 3명 대면 후 라운지에서 중간 정리 회의 이동 선택.
- 기대: `final_confidence -1` 패널티 적용.

3. 조기 이동 2명 대면 루트
- 2명 대면 후 중간 정리 회의 이동.
- 기대: `deduction_score -1`, `final_confidence -2` 패널티 적용.

4. 조기 이동 1명 이하 대면 루트
- 0~1명 대면 상태에서 중간 정리 회의 이동.
- 기대: `deduction_score -2`, `final_confidence -3`, `trust -1`, `mistake_count +1` 적용.

5. 루트 재시도 구조 검증
- 각 루트에서 일부러 오답 선택/입력.
- 기대: 1차 시도 후 재시도 scene 1회 제공, 이후 오답은 실패 라인으로 진행.

6. 결말 4지목 검증
- `final_accuse_gate`/`final_comeback`에서 `신이치/레이코/켄지/하루오` 모두 노출 확인.
- 레이코 외 지목 시 오지목 흐름(`wrong_answer_check` 또는 `bad_epilogue`) 유지 확인.

## 3) 상태값 기반 검증 포인트
- `investigation_count`: 누적 대면 횟수.
- `visited_*`: 각 인물 대면 여부.
- `early_exit_taken`: 라운지 조기 이동 여부.
- `deduction_score`, `mistake_count`, `trust`, `final_confidence`: 결말 판정 핵심 수치.
- `clue_rim_reagent`, `clue_order_note`, `clue_double_press_decoy`, `clue_haruo_wipe`, `reiko_motive_open`: 단서 잠금 플래그.

## 4) UX/연출 체크
- 콜드 오픈에서 60~90초 내 사건 갈고리가 제시되는지 확인.
- 라운지 왕복 시 배경/음악 전환이 튀지 않는지 확인.
- 같은 인물을 재선택했을 때 재방문 안내 후 즉시 라운지 복귀되는지 확인.
- 조기 이동 경고 문구와 결말 전 경고 대사가 일관되는지 확인.
- 모바일에서 라운지 선택지 길이가 레이아웃을 깨지 않는지 확인.

## 5) 통과 기준
- TRUE/NORMAL/BAD 각 1회 이상 재현.
- 4명 루트 진입/복귀 모두 확인.
- 조기 이동 패널티 3종(3명/2명/1명 이하) 모두 재현.
- 루트별 재시도 1회 구조 확인.
- YAML 파싱/빌드 에러 없음.
