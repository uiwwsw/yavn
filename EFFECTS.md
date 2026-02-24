# Visual Novel Engine Effects

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

## Notes

- 이펙트는 짧은 순간 연출용입니다. 여러 이펙트를 연속으로 배치하면 장면 템포를 쉽게 조절할 수 있습니다.
- 미구현 이름을 넣으면 기본 지속시간(약 350ms)으로만 처리되고, 화면 변화는 없습니다.
