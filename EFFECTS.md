# YAVN (야븐) Effects

아래 이펙트는 현재 엔진에서 바로 사용 가능합니다.
YAML 액션에서 `- effect: <name>` 형태로 넣으면 됩니다.

## Effect List

1. `shake`
- 용도: 충격, 폭발, 큰 소리 연출
- 예시:
```yaml
- effect: shake
```

2. `flash`
- 용도: 번개, 컷 전환, 강한 강조
- 예시:
```yaml
- effect: flash
```

3. `zoom`
- 용도: 중요한 단서/대사에 시선 집중
- 예시:
```yaml
- effect: zoom
```

4. `blur`
- 용도: 혼란, 어지러움, 공포 컷
- 예시:
```yaml
- effect: blur
```

5. `darken`
- 용도: 암전 느낌, 분위기 급전환
- 예시:
```yaml
- effect: darken
```

6. `pulse`
- 용도: 긴장감 상승, 감정 고조
- 예시:
```yaml
- effect: pulse
```

7. `tilt`
- 용도: 불안정함, 심리 흔들림
- 예시:
```yaml
- effect: tilt
```

추가 프리셋:
- `impact`: 확대 충격 + 중심 버스트 (`460ms`)
- `glitch`: RGB/스캔라인 교란 (`520ms`)
- `speedlines`: 방사형 속도선 (`680ms`)
- `alarm`: 적색 경보 맥동 (`760ms`)
- `focus`: 중심 비네트 (`620ms`)
- `moonveil`: 달빛 비네트 (`900ms`)
- `embers`: 상승 불씨 (`1100ms`)
- `crown`: 금빛 방사광 (`1200ms`)
- `eclipse`: 일식 암전과 태양 코로나 (`1400ms`)
- `starfall`: 대각선 유성광 (`1200ms`)
- `inkstamp`: 붉은 인주 도장 충격 (`720ms`)

연출이 끝난 뒤 다음 action으로 진행해야 하는 장면은 옵션형 문법을 사용합니다.

```yaml
- effect:
    name: impact
    wait: true
- say:
    text: "충격이 가라앉았다."
```

## Notes

- 문자열 이펙트는 짧은 순간 연출용이며 즉시 다음 action으로 진행합니다. `wait: true` 옵션형 이펙트는 프리셋 지속시간 동안 입력과 진행을 잠급니다.
- 미구현 CSS-safe 이름을 넣으면 기본 지속시간(약 350ms)으로 처리되며, 대응하는 게임별 CSS 상태 클래스가 없으면 화면 변화는 없습니다.

## Sticker Enter Effects

`sticker` 액션에서는 `enter` 옵션으로 스티커 등장 이펙트를 지정할 수 있습니다.

```yaml
- sticker:
    id: clue
    image: police_tape
    enter:
      effect: wipeCenterX
      easing: ease-out
      delay: 0
```

지원 이름:
- `none`
- `fadeIn`
- `wipeLeft`
- `scaleIn`
- `popIn`
- `slideUp`
- `slideDown`
- `slideLeft`
- `slideRight`
- `wipeCenterX`
- `wipeCenterY`
- `blurIn`
- `rotateIn`

`clearSticker`에서는 `leave`로 퇴장 이펙트를 줄 수 있습니다.

```yaml
- clearSticker:
    id: clue
    leave:
      effect: wipeRight
```

지원 이름:
- `none`
- `fadeOut`
- `wipeLeft`
- `wipeRight`

참고:
- `sticker.enter.duration`, `clearSticker.leave.duration` 사용자 지정은 지원하지 않습니다.
- 스티커 이펙트 시간은 엔진 기본값(enter `280ms`, leave `220ms`)을 사용합니다.
