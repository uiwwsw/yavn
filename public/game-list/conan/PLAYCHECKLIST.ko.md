# Conan 4라인 조사 플레이 체크리스트 (v8)

## 1) 분기 점검 요약
- 점검 포인트 A: `0.yaml` 콜드 오픈 후 `1.yaml`로 정상 전이되는지 확인.
- 점검 포인트 B: `1.yaml`에서 **하루오 사망 + 다잉 메시지("2R")**가 사건 고리로 표시되는지 확인.
- 점검 포인트 C: `2.yaml` 초동 정리 뒤 `routes/hub/1.yaml` 조사 라운지로 이동하는지 확인.
- 점검 포인트 D: 라운지에서 4개 라인(`신이치/레이코/켄지/하루오 유품`)을 자유 선택할 수 있는지 확인.
- 점검 포인트 E: 각 라인이 독립 동작하고 종료 후 라운지로 복귀하는지 확인.
- 점검 포인트 F: 최종 지목/재지목 선택지에 4명이 모두 노출되는지 확인.

## 2) 권장 플레이 점검 시나리오
1. 전 라인 완료 루트
- 라운지에서 4개 라인을 모두 1회씩 완료.
- 기대: 자동 보너스(`deduction_score +1`, `final_confidence +1`, `trust +1`) 후 결말 이동.

2. 조기 이동 3라인 루트
- 3개 라인 완료 후 중간 정리 회의 이동.
- 기대: `final_confidence -1` 패널티 적용.

3. 조기 이동 2라인 루트
- 2개 라인 완료 후 중간 정리 회의 이동.
- 기대: `deduction_score -1`, `final_confidence -2` 패널티 적용.

4. 조기 이동 1라인 이하 루트
- 0~1개 라인 상태에서 중간 정리 회의 이동.
- 기대: `deduction_score -2`, `final_confidence -3`, `trust -1`, `mistake_count +1` 적용.

5. 재시도 구조 검증
- 각 라인에서 일부러 오답 선택/입력.
- 기대: 1차 시도 후 재시도 scene 1회 제공, 이후 오답은 실패 라인으로 진행.

6. 결말 지목 검증
- `final_accuse_gate`/`final_comeback`에서 `신이치/레이코/켄지/하루오` 모두 노출 확인.
- 레이코 외 지목 시 오지목 흐름(`wrong_answer_check` 또는 `bad_epilogue`) 유지 확인.

## 3) 상태값 기반 검증 포인트
- `investigation_count`: 라운드 누적 조사 횟수.
- `visited_*`: 각 라인 진입 여부.
- `early_exit_taken`: 라운지 조기 이동 여부.
- `deduction_score`, `mistake_count`, `trust`, `final_confidence`: 결말 판정 핵심 수치.
- `clue_rim_reagent`, `clue_order_note`, `clue_double_press_decoy`, `clue_haruo_wipe`, `reiko_motive_open`: 단서 잠금 플래그.

## 4) UX/연출 체크
- 콜드 오픈에서 60~90초 내 사건 갈고리(폭우/갈등/사망 전조)가 제시되는지 확인.
- 사건 발생 후 `flash/darken/shake`와 `scream/thunder`가 어색하지 않게 연결되는지 확인.
- 라운지 왕복 시 배경/음악 전환이 튀지 않는지 확인.
- `하루오` 라인 재선택 시 "현장 봉인" 안내 후 즉시 라운지 복귀되는지 확인.
- 모바일에서 긴 선택지("하루오 유품/다잉메시지 조사")가 레이아웃을 깨지 않는지 확인.

## 5) 통과 기준
- TRUE/NORMAL/BAD 각 1회 이상 재현.
- 4개 라인 진입/복귀 모두 확인.
- 조기 이동 패널티 3종(3개/2개/1개 이하) 모두 재현.
- 라인별 재시도 1회 구조 확인.
- YAML 파싱/빌드 에러 없음.
