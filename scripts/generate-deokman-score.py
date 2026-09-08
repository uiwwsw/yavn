"""Render original, seamless ambient cues using synthesis only (no samples).

Run with Python 3. Output is mono PCM WAV, playable without a codec download.
Sparse pentatonic phrases leave room for dialogue; circular tails avoid loop clicks.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
DEST = Path(__file__).resolve().parents[1] / 'public/game-list/deokman/assets/music'
DEST.mkdir(parents=True, exist_ok=True)

CUES = {
    'sealed-court': ([50, 57, 60, 62, 57, 65, 60, 57], 50, 0.065),
    'night-road': ([50, 53, 57, 60, 57, 53, 62, 57], 38, 0.045),
    'open-sky': ([62, 69, 74, 76, 69, 67, 64, 69], 50, 0.035),
}

for name, (notes, bass, tension) in CUES.items():
    samples = [0.0] * SIZE
    rng = random.Random(830)
    # Frequencies are snapped to full loop periods for continuous low pads.
    root = round(440 * 2 ** ((bass - 69) / 12) * SECONDS) / SECONDS
    fifth = round(root * 1.5 * SECONDS) / SECONDS
    for i in range(SIZE):
        t = i / RATE
        swell = 0.7 + 0.3 * math.cos(2 * math.pi * t / SECONDS)
        samples[i] = swell * (0.027 * math.sin(2 * math.pi * root * t)
                              + 0.014 * math.sin(2 * math.pi * fifth * t))
    for beat, note in enumerate(notes):
        frequency = 440 * 2 ** ((note - 69) / 12)
        onset = round((beat * 3 + rng.uniform(0.08, 0.28)) * RATE)
        amplitude = tension * rng.uniform(0.8, 1.0)
        for i in range(RATE * 5):
            t = i / RATE
            attack = min(1.0, t / 0.018)
            voice = sum(math.sin(2 * math.pi * frequency * harmonic * t)
                        * math.exp(-t * (1.0 + harmonic * 0.34)) / harmonic ** 1.8
                        for harmonic in (1, 2, 3, 5))
            value = amplitude * attack * voice
            for delay, gain in ((0, 1), (0.19, 0.28), (0.43, 0.16), (0.79, 0.09)):
                samples[(onset + i + round(delay * RATE)) % SIZE] += value * gain
    peak = max(abs(value) for value in samples)
    gain = min(1.0, 0.22 / peak)
    pcm = b''.join(struct.pack('<h', round(value * gain * 32767)) for value in samples)
    with wave.open(str(DEST / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
    print(f'{name}: {SECONDS}s, peak={peak * gain:.3f}, {len(pcm):,} bytes')
