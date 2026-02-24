# Visual Novel Engine (Web)

YAML DSL(`sample/sample.yaml`)을 읽어 웹에서 실행하는 비주얼노벨 엔진입니다.

## 실행

```bash
npm install
npm run dev
```

기본 로딩 파일: `/sample.yaml` (Vite `publicDir: sample` 설정)

## 구현 범위

1. YAML 로드 + Zod 스키마 검증
2. 액션 인터프리터(`bg`, `music`, `sound`, `char`, `say`, `wait`, `effect`, `goto`)
3. 타이핑 효과 + `<speed=...>` 인라인 속도 태그
4. `goto` 점프, `wait` 타이머, `shake/flash` 이펙트
5. `localStorage` 오토세이브(씬/액션 포인터)
6. 에러 오버레이(YAML parse 에러 line/column, 스키마/참조 에러)
7. 샘플 게임 + 초기 에셋(`sample/`)

## 샘플 구조

- `sample/sample.yaml`
- `sample/assets/bg/*.svg`
- `sample/assets/char/**.svg`
- `sample/assets/music/*.wav`
- `sample/assets/sfx/*.wav`
