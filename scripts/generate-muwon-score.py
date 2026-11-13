"""Render the original ambient score for 무원 (Muwon) using synthesis only (no samples).

Run with Python 3. Output is 24-second mono PCM WAV loops, playable without a codec download.
Pentatonic phrases leave room for dialogue. Low pads use frequencies snapped to whole loop
periods and every note tail wraps around the loop boundary, so the loops repeat without clicks.
A fixed random seed makes the output reproducible.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
DEST = Path(__file__).resolve().parents[1] / 'public/game-list/muwon/assets/music'
DEST.mkdir(parents=True, exist_ok=True)

# name: (notes as MIDI numbers, beat length in seconds, bass MIDI note, note amplitude, pulse amplitude)
CUES = {
    # 1장 밤 우물과 골목: sparse, low, long silences.
    'night-well': ([45, 52, 57, 55, 52, 48, 50, 45], 3.0, 33, 0.055, 0.0),
    # 검안과 실험: steady soft pulse, mid register.
    'inquest': ([57, 60, 62, 64, 62, 60, 57, 55, 57, 62, 64, 67, 64, 62, 60, 57], 1.5, 45, 0.038, 0.012),
    # 대면과 습격: short repeating cell with a tense minor second against the bass.
    'pressure': ([52, 53, 52, 57, 52, 53, 52, 59, 52, 53, 52, 57, 55, 53, 52, 50], 1.5, 40, 0.05, 0.018),
    # 결말: open fifths and a slow rising line.
    'dawn': ([62, 69, 67, 74, 72, 76, 74, 79], 3.0, 50, 0.04, 0.0),
}


def pluck(samples, frequency, onset, amplitude):
    for i in range(RATE * 5):
        t = i / RATE
        attack = min(1.0, t / 0.018)
        voice = sum(math.sin(2 * math.pi * frequency * harmonic * t)
                    * math.exp(-t * (1.0 + harmonic * 0.34)) / harmonic ** 1.8
                    for harmonic in (1, 2, 3, 5))
        value = amplitude * attack * voice
        for delay, gain in ((0, 1), (0.19, 0.28), (0.43, 0.16), (0.79, 0.09)):
            samples[(onset + i + round(delay * RATE)) % SIZE] += value * gain


for name, (notes, beat, bass, tension, pulse) in CUES.items():
    samples = [0.0] * SIZE
    rng = random.Random(1792)
    root = round(440 * 2 ** ((bass - 69) / 12) * SECONDS) / SECONDS
    fifth = round(root * 1.5 * SECONDS) / SECONDS
    for i in range(SIZE):
        t = i / RATE
        swell = 0.7 + 0.3 * math.cos(2 * math.pi * t / SECONDS)
        samples[i] = swell * (0.026 * math.sin(2 * math.pi * root * t)
                              + 0.013 * math.sin(2 * math.pi * fifth * t))
    for index, note in enumerate(notes):
        frequency = 440 * 2 ** ((note - 69) / 12)
        onset = round((index * beat + rng.uniform(0.05, 0.2)) * RATE)
        pluck(samples, frequency, onset, tension * rng.uniform(0.8, 1.0))
    if pulse:
        # A muted low knock on every beat, like a distant wooden clapper.
        knock = round(root * 2 * SECONDS) / SECONDS
        beats = round(SECONDS / beat)
        for index in range(beats):
            onset = round(index * beat * RATE)
            for i in range(round(RATE * 0.35)):
                t = i / RATE
                value = pulse * math.sin(2 * math.pi * knock * t) * math.exp(-t * 14)
                samples[(onset + i) % SIZE] += value
    peak = max(abs(value) for value in samples)
    gain = min(1.0, 0.22 / peak)
    pcm = b''.join(struct.pack('<h', round(value * gain * 32767)) for value in samples)
    with wave.open(str(DEST / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
    print(f'{name}: {SECONDS}s, peak={peak * gain:.3f}, {len(pcm):,} bytes')
