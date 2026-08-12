# YAVN 제3자 소프트웨어·자산 고지

마지막 검토일: 2026-08-12

이 문서는 YAVN 저장소와 배포본에 포함되거나 샘플 게임에서 사용되는 주요 제3자 소프트웨어·자산의 출처와 이용 조건을 안내합니다. 아래 고지는 이용 허락을 새로 부여하거나 기존 라이선스 의무를 대체하지 않습니다. 각 권리자가 게시한 최신 원문이 우선합니다.

## 1. Live2D Cubism Core

- 대상: `src/assets/third-party/live2d/live2dcubismcore.min.js`
- 권리자: © Live2D Inc.
- 적용 조건: [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)
- 재배포 파일 목록: `assets/licenses/live2d/RedistributableFiles.txt`
- 공식 SDK 라이선스 안내: [Cubism SDK 라이선스](https://www.live2d.com/ko/sdk/license/)

Cubism Core는 YAVN 자체 라이선스의 적용 대상이 아닙니다. 사업자 규모, 배포 형태와 수익화 여부에 따라 별도 공개·출판 라이선스 또는 계약이 필요할 수 있으므로 배포 주체가 공식 조건을 확인해야 합니다.

## 2. easy-cl2d 및 Live2D Cubism Web Framework 파생 코드

- 패키지: `easy-cl2d@0.3.1`
- 패키지 작성자가 추가한 코드: MIT License
- 원본/수정된 Live2D Cubism Components 부분: [Live2D Open Software License Agreement](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html)
- 보존한 패키지 고지: `assets/licenses/live2d/easy-cl2d-NOTICE.md`
- 보존한 패키지 라이선스 안내: `assets/licenses/live2d/easy-cl2d-LICENSE.live2d.md`

## 3. Live2D 샘플 모델 — 렌 포스터

- 대상: `public/game-list/live2dtest/assets/char/ren_pro_ko/`
- 저작물: Live2D 공식 샘플 데이터 `렌 포스터`
- 권리자: © Live2D Inc.
- 적용 조건: [Live2D 샘플 데이터 이용 조건](https://www.live2d.com/eula/live2d-sample-model-terms_ko.html)
- 공식 배포 페이지: [Live2D 샘플 데이터](https://www.live2d.com/ko/learn/sample/)
- 동봉 원문: `public/game-list/live2dtest/assets/char/ren_pro_ko/ReadMe.txt`

샘플 데이터 이용 조건에 따라 다음 문구를 게임의 런처, 시작 화면, 설정과 엔딩 크레딧에 표시합니다.

> 본 작품의 캐릭터에는 주식회사 Live2D가 정하는 약관에 따라 주식회사 Live2D의 저작물인 샘플 데이터가 이용되었습니다. 본 작품은 제작자의 완전한 자기 재량으로 제작되었습니다.

일반 사용자 및 소규모 사업자의 이용 범위와 중·대규모 사업자의 제한은 공식 이용 조건을 따릅니다. 이 저장소의 고지만으로 상업 이용이나 재배포가 허가되는 것은 아닙니다.

### 확장 가능한 애플리케이션 주의

YAVN은 ZIP이나 외부 데이터로 임의의 Live2D 모델을 불러올 수 있으므로, 배포 방식에 따라 Live2D가 정의하는 “확장 가능한 애플리케이션”에 해당할 가능성이 있습니다. 해당 유형은 사업자 규모와 무관하게 사전 심사·계약이 필요할 수 있습니다.

- [확장 가능한 애플리케이션 라이선스 안내](https://www.live2d.com/ko/sdk/license/expandable/)
- [Cubism SDK 라이선스 FAQ](https://help.live2d.com/ko/sdk/sdk_001/)

공개 서비스에서 사용자 제공 모델 로딩을 활성화하기 전에는 Live2D에 배포 형태를 설명하고 필요한 계약 여부를 확인해야 합니다.

## 4. 명탐정 코난 비공식 팬 데모

- 대상: `public/game-list/conan/`, `public/game-list/conan-demo/`
- 성격: YAVN 엔진 기능 검증용 비공식·비상업적 팬 데모

명탐정 코난 관련 명칭·캐릭터와 원작 요소의 권리는 각 권리자에게 있습니다. 두 데모는 원작자, 출판사, 제작사, 배급사 또는 그 밖의 권리자와 제휴하거나 승인받은 공식 작품이 아닙니다. 데모 자체에는 판매, 유료 기능, 광고 또는 후원 유도 등 수익화 기능을 두지 않습니다.

현재 저장소에는 코난 관련 명칭·캐릭터·이미지·음원에 대한 권리자의 이용허락 증빙이 포함되어 있지 않습니다. “비상업적” 또는 “팬 데모”라는 표시는 이용 허락을 대신하지 않으며 침해 가능성을 제거하지 않습니다. 공개 배포를 계속하려면 권리 확인 및 필요한 허락을 받고, 확인할 수 없다면 오리지널 명칭·캐릭터·이미지·음원으로 교체하거나 해당 데모를 배포 대상에서 제외해야 합니다. 권리자의 요청이 있으면 공개를 중단하고 관련 자산을 제거합니다.

## 5. SUITE 글꼴

- 대상: YAVN UI에서 사용하는 SUITE 글꼴 파일
- 저작권: Copyright (c) 2023, SUNN (http://sun.fo/suite)
- 라이선스: SIL Open Font License 1.1
- 전문: `assets/licenses/fonts/LICENSE`

## 문의 및 배포 전 점검

라이선스 문의는 각 권리자의 공식 창구로 해야 합니다. YAVN 배포자는 최소한 다음을 확인해야 합니다.

1. Live2D Core/Framework 공개 조건과 필요한 SDK 라이선스
2. 사용자 제공 Live2D 모델을 받는 경우 확장 가능한 애플리케이션 계약 필요 여부
3. 샘플 모델의 사업자 규모별 이용 범위와 필수 저작권 표시
4. 코난 데모의 권리자 이용허락 또는 공개 배포 제외
5. 이 파일과 각 원문 라이선스 파일이 배포 산출물에서 접근 가능한지 여부
