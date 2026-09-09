# 덕만 완결판 자산 제작 기록

이 문서는 정식 패키지 `public/game-list/deokman/`에서 사용하는 시각 자산의 제작·재사용 근거를 기록합니다.

## 2026-09-09 조사용 물건

- `forged-token.svg`, `medicine-cup.svg`: 코드로 직접 그린 신규 벡터 오브젝트입니다. 외부 이미지나 글꼴을 사용하지 않습니다.
- `grain-ledger.svg`: 출발 여섯 자루와 도착 세 자루를 눈으로 셀 수 있도록 새로 그렸습니다.
- 사망 기록·시장 인장은 같은 깨진 모서리, 연·편지는 같은 두 고리 매듭을 표시합니다. 원본 모란패의 녹/열린 고리와 복제품의 도금/막힌 고리를 비교합니다.
- 12종의 viewBox에 여백을 추가하고 그림자 농도를 낮춰 외곽이 캔버스에서 잘리지 않게 했습니다. 12종의 설명은 실제 조사·선택·후일담에 맞춰 갱신했습니다. 배경과 인물은 검증된 기존 원화를 사용합니다.

## 2026-09-08 배경음

- `assets/music/sealed-court.wav`, `night-road.wav`, `open-sky.wav`: 각각 궁 안의 긴장·이동·결말에 쓰는 24초 모노 PCM 루프입니다.
- 외부 음악·연주·샘플 없이 사인파, 배음, 감쇠, 원형 잔향을 합성했습니다. 전통 악기의 실제 녹음은 아닙니다. 난수 시드를 고정해 결과를 재생성할 수 있습니다.
- 제작 코드: `scripts/generate-deokman-score.py`. 최대 진폭을 제한하고 루프 경계에서 저음 위상과 잔향이 이어지도록 처리했습니다. 기존 엔진의 음량·크로스페이드·음소거를 사용합니다.

## V10.4 칠숙 공격 장면 컷

- 파일: `assets/bg/chilsuk-sword-cutin-v1.png`, `assets/bg/chilsuk-bow-cutin-v1.png`
- 제작일: 2026-09-07
- 제작 방식: OpenAI 내장 ImageGen 도구. 기존 `chilsuk-angry-silla-v5.webp`의 얼굴·나이·상투·보라색 신라 복식으로 검/활 자세를 만든 뒤 같은 인물을 밤 궁문 앞의 와이드 공격 컷으로 구성했습니다. CLI/API 대체 경로는 사용하지 않았습니다.
- 용도: `attack.image`에서 접근·타격·반응 시점에 노출하는 불투명 장면 컷. 모바일 세로 화면에서는 contain으로 얼굴과 무기를 함께 보존합니다.
- 검수: 두 결과 모두 1672×941 PNG. 투명 스프라이트 후보는 알파 대신 격자가 포함되어 채택하지 않았으며, 실제 게임에는 격자가 없는 배경 포함 장면 컷만 사용합니다. 기존 인물 스프라이트는 보존했습니다.

### 검 공격 컷 최종 프롬프트

```text
Use case: historical-scene, identity-preserve. Asset type: 16:9 fullscreen attack cut-in for an existing visual novel. Use the attached character as an identity and costume reference. Create one cinematic medium-close shot of this same fictional Korean man Chilsuk, same face age topknot goatee deep purple 7th-century Silla robe with bronze belt and geometric trim. He holds an iron sword drawn in his right hand, ready to strike from right to left; show the clearly visible blade and threatening poised arm; no arrow or bow. Place Chilsuk in the right 60 percent of the landscape frame, face and weapon entirely within the central safe 60 percent for portrait crops. The left side is dark out-of-focus early Silla palace gate at night, subtle torchlight, moonlit rain and drifting smoke. Semi-realistic painted premium historical game artwork matching the reference. Dramatic perspective, focused cold threat, visible knuckles and fabric tension. Actual fully painted atmospheric opaque background, NOT transparent, NO checkerboard, NO white space, NO letters, NO UI, NO text, NO logos, NO gore, NO extra people. This is the single instant just before the attack; the game will animate the camera and impact. Dark quiet top/bottom margins for short subtitle. Widescreen 1536x864 composition.
```

### 활 공격 컷 최종 프롬프트

```text
Use case: historical-scene, identity-preserve. Asset type: 16:9 fullscreen attack cut-in for an existing visual novel. Use the attached character as an identity and costume reference. Create one cinematic medium-close shot of this same fictional Korean man Chilsuk, same face age topknot goatee deep purple 7th-century Silla robe with bronze belt and geometric trim. He holds a compact Korean recurve bow held at full draw, a single nocked arrow aimed leftward towards the unseen target; correct bowstring and arrow mechanics; no sword. Place Chilsuk in the right 60 percent of the landscape frame, face and weapon entirely within the central safe 60 percent for portrait crops. The left side is dark out-of-focus early Silla palace gate at night, subtle torchlight, moonlit rain and drifting smoke. Semi-realistic painted premium historical game artwork matching the reference. Dramatic perspective, focused cold threat, visible knuckles and fabric tension. Actual fully painted atmospheric opaque background, NOT transparent, NO checkerboard, NO white space, NO letters, NO UI, NO text, NO logos, NO gore, NO extra people. This is the single instant just before the attack; the game will animate the camera and impact. Dark quiet top/bottom margins for short subtitle. Widescreen 1536x864 composition.
```


## 시작 화면

- 파일: `assets/bg/title-deokman-v8-fire-v1.webp`
- 제작일: 2026-08-18
- 제작 방식: OpenAI 이미지 생성 도구로 신규 제작 후 WebP로 최적화
- 용도: 시작 화면, 런처 썸네일, SEO 대표 이미지
- 최종 프롬프트 요약: 금지된 사망 기록과 청동 모란패를 든 어린 덕만, 불타기 시작한 7세기 신라 별궁, 검은 별과 떨어지는 별빛, 제목과 시작 버튼을 위한 여백을 둔 16:9 시대극 스릴러 키아트
- 제외 조건: 이미지 내부 문구·로고·워터마크, 현대 물품, 중국 황실 용·봉황 문양, 판타지 갑옷

## 어린 덕만 스프라이트

- 파일: `assets/char/deokman-child-silla-v8.png`
- 파일: `assets/char/deokman-child-scared-silla-v8.png`
- 파일: `assets/char/deokman-child-resolve-silla-v8.png`
- 제작일: 2026-08-18
- 제작 방식: OpenAI 내장 이미지 생성 도구의 이미지 편집 모드로 기존 어린 덕만의 얼굴·연령·신라 복식·모란 장식·주머니·전신 구도를 참조해 기본/공포/결의 표정을 고해상도로 다시 제작했습니다. 단색 녹색 배경에서 생성한 뒤 자동 경계색 추정, 소프트 매트, 1px 경계 수축, 디스필을 적용하고 손실 압축을 피한 RGBA PNG로 저장했습니다.
- 최종 프롬프트 요약: 동일한 어린 덕만의 얼굴·나이·상투·보랏빛/남색 여행복·청동 모란 장식·주머니·전신 구도를 유지하고, 자연스러운 피부와 직물 세부를 선명하게 복원하며 압축 블록·가로 띠·사각 잔상·누끼 헤일로·흐림을 제거합니다. 공포 표정은 절제된 긴장, 결의 표정은 조용하고 지적인 집중으로 구분합니다.
- 검수: 세 파일 모두 `886×1775`, 8-bit RGBA, 투명 픽셀 약 106만 개와 부분 투명 경계 약 5.8~6.8천 개를 보유합니다. 검정 배경 합성에서 흰 외곽선·가로 띠·사각 잔상이 보이지 않음을 확인했습니다.

## 성장 단계별 덕만 스프라이트

- 국경 유랑자: `assets/char/deokman-wanderer-silla-v9.png`, `deokman-wanderer-sad-silla-v9.png`, `deokman-wanderer-angry-silla-v9.png`
- 신분을 되찾은 공주: `assets/char/deokman-princess-silla-v9.png`, `deokman-princess-sad-silla-v9.png`, `deokman-princess-angry-silla-v9.png`
- 시녀 잠입: `assets/char/deokman-attendant-silla-v9.png`
- 선덕왕: `assets/char/deokman-queen-silla-v9.png`, `deokman-queen-sad-silla-v9.png`, `deokman-queen-angry-silla-v9.png`
- 제작일: 2026-08-19
- 제작 방식: OpenAI 내장 이미지 생성 도구에서 어린 덕만 V8과 기존 성인 덕만을 얼굴 계보·화풍 참조로 사용해 유랑자·공주·선덕왕 기본 원화를 각각 제작했습니다. 각 기본 원화를 다시 참조해 복식·자세·손·소품·캔버스를 고정하고 표정만 슬픔과 절제된 분노로 바꿨습니다. 시녀 잠입 원화는 유랑자와 공주 원화를 함께 참조해 장신구와 신분 소품만 제거했습니다.
- 최종 프롬프트 요약: 유랑자는 10년간 국경을 떠돈 18세 덕만의 해진 자주·남색 여행복, 거친 신발, 천 주머니와 청동 모란패를 사용합니다. 공주는 신분을 되찾은 19세 덕만의 절제된 신라 궁중복, 작은 금제 머리 장식과 사건 문서를 사용하되 왕관은 쓰지 않습니다. 선덕왕은 수년 뒤의 성숙한 얼굴, 신라 금제 관식, 짙은 자주·남색 왕복과 옥새함으로 통치의 무게를 드러냅니다. 중국 황실 관식·용봉 문양·판타지 갑옷·현대 화장·잘린 발을 공통으로 제외했습니다.
- 누끼 처리: 균일한 녹색 배경에서 생성한 뒤 테두리 자동 샘플링, 소프트 매트, 1px 경계 수축과 디스필을 적용했습니다. 최종 파일은 8-bit RGBA PNG이며 너비 `881~887px`, 높이 `1774~1785px` 범위입니다.
- 적용: 2장 국경 장터는 유랑자, 3장 비밀 재회는 유랑자에서 공주 또는 시녀로 분기, 4~8장은 공주, 9장 즉위 장면부터 12장 마지막 재판은 선덕왕 원화를 사용합니다.
- 검수: 열 파일 모두 투명 모서리와 부분 투명 머리카락·옷자락 경계를 보유하며 검정 배경 합성에서 녹색 누끼 헤일로, 사각 배경 잔상, 발 잘림이 없는지 확인했습니다.

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
- 인물: 천명·유신·비담·진평왕·칠숙의 V5 기본/감정 시트를 재사용했습니다. 기존 성인 덕만 V5는 V9.1 본편에서 더 이상 참조하지 않습니다.
- 역할 매핑: 기존 소원 시트는 `소화`, 진운 시트는 `춘추`, 아진 시트는 `당 사신`으로 극중 역할을 새로 부여했습니다.
- 재사용 범위는 시각 자산에 한정합니다. 삭제된 구버전 덕만 YAML과 스토리 분기는 완결판에 복원하지 않았습니다.

## 패키지 경로

- 시작 화면·SEO·런처·본편의 모든 자산 참조는 `root:/game-list/deokman/assets/...` 또는 런처 기준 상대 경로를 사용합니다.
- 이전 프리뷰 경로는 완결판에서 사용하지 않습니다.
