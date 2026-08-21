# 프롬프트 레이아웃 높이

YAVN의 대화 프롬프트는 화자, 내레이션, 입력창, 선택지 유무에 따라 바깥 박스 크기가 변하지 않습니다. 내용이 지정된 높이를 넘으면 프롬프트 내부만 스크롤됩니다.

## 엔진 기본값

별도 설정이 없으면 프롬프트 높이는 `170px`입니다.

게임 전체에서 다른 높이를 사용하려면 `config.yaml`의 `ui.promptHeight`를 지정합니다.

```yaml
ui:
  template: paper-stage
  promptHeight: 210
```

`promptHeight`는 px 단위의 숫자이며 `120`부터 `600`까지 허용됩니다.

## 콘텐츠별 높이 덮어쓰기

특정 장면만 더 많은 공간이 필요하면 해당 `say`, `choice`, `input` 안에 `promptHeight`를 지정할 수 있습니다. 이 값은 게임 전체의 `ui.promptHeight`보다 우선합니다.

```yaml
- say:
    char: 덕만
    text: "이 장면만 조금 더 높은 프롬프트를 사용합니다."
    promptHeight: 220
```

```yaml
- choice:
    prompt: "어디로 움직일까?"
    promptHeight: 280
    options:
      - text: "북문으로 간다"
        goto: north_gate
      - text: "배수로로 간다"
        goto: waterway
```

```yaml
- input:
    prompt: "암호를 입력하세요."
    promptHeight: 240
    correct: "첨성대"
    errors:
      - "다시 생각해 보세요."
```

액션에 `promptHeight`가 없으면 `ui.promptHeight`를 사용하고, 게임 설정에도 없으면 엔진 기본값 `170px`을 사용합니다.

선택지 수나 화자/채널 라벨의 존재 여부는 프롬프트 바깥 높이에 영향을 주지 않습니다. 긴 내용과 선택지는 프롬프트 내부 스크롤 영역에서 처리됩니다.

프롬프트 하단에는 `다음`·`완료`·`입력 대기`·`선택 대기` 상태 전용 행을 따로 두지 않습니다. 고정 높이 안의 남는 공간은 모두 대사·입력·선택 내용에 사용하며, 진행 방식은 기존 화면 클릭/`Enter`/`Space`와 각 게이트 컨트롤을 유지합니다.
