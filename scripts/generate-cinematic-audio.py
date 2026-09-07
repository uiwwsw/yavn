"""Generate original, deterministic engine sound cues (no external samples)."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
DEST = Path(__file__).resolve().parents[1] / 'src/assets/audio'
DEST.mkdir(parents=True, exist_ok=True)

for name, duration in [('approach', .48), ('slash', .32), ('strike', .36), ('shot', .25), ('defeat', .85)]:
    rng = random.Random(71)
    low = 0.0
    samples = []
    for i in range(round(RATE * duration)):
        t = i / RATE
        p = t / duration
        noise = rng.uniform(-1, 1)
        low += .14 * (noise - low)
        attack = min(1, t / .008)
        if name == 'approach':
            value = (noise - low) * math.sin(math.pi * p) ** 2 * .12
        elif name == 'defeat':
            value = math.sin(2 * math.pi * (82 * t - 22 * t * t)) * math.exp(-5 * p) * .22
        else:
            frequency = {'slash': 115, 'strike': 65, 'shot': 150}[name]
            body = math.sin(2 * math.pi * frequency * t) * math.exp(-13 * p)
            edge = (noise - low) if name != 'strike' else low
            value = body * .26 + edge * math.exp(-8 * p) * .24
        samples.append(struct.pack('<h', round(max(-1, min(1, value * attack * (1 - p))) * 32767)))
    with wave.open(str(DEST / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b''.join(samples))
