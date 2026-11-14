"""Render the original score for 360 using synthesis only (no samples).

Run with Python 3, then `node scripts/compress-music.mjs` to turn the WAV loops into FLAC.
Six 24-second mono loops. The dark between lives has no melody at all: two low tones a
fraction of a hertz apart, beating slowly, and one high note that arrives twice a loop.
Each life gets one plucked voice in its own register and tempo. Drone frequencies are
snapped to whole loop periods and note tails wrap around the loop boundary, so the loops
repeat without clicks. A fixed seed makes the output reproducible.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
DEST = Path(__file__).resolve().parents[1] / 'public/game-list/360/assets/music'
DEST.mkdir(parents=True, exist_ok=True)

# Voices: (harmonics, decay per second, attack seconds)
STRING = ((1, 2, 3, 5), 1.0, 0.018)      # plucked silk string
REED = ((1, 2, 3, 4, 6), 0.55, 0.09)     # a market accordion, held a little longer
BOX = ((1, 4, 9), 2.6, 0.004)            # hospital-ward music box
KEYS = ((1, 2, 4), 1.5, 0.01)            # electric piano in an editing room

# name: (notes as MIDI numbers, seconds per note, drone MIDI note, note level, pulse level, voice)
CUES = {
    'void': ([88, None, None, None, None, 83, None, None], 3.0, 26, 0.02, 0.0, BOX),
    'port': ([50, 57, 55, 52, 57, 62, 60, 57], 3.0, 38, 0.05, 0.0, STRING),
    'market': ([62, 65, 67, 65, 62, 60, 62, 67, 69, 67, 65, 62, 60, 57, 60, 62], 1.5, 38, 0.034, 0.014, REED),
    'ward': ([76, 72, 79, 76, 74, 72, 67, 72, 76, 74, 71, 67, 72, None, 67, None], 1.5, 48, 0.04, 0.0, BOX),
    'now': ([57, 64, 63, 64, 57, 60, 59, 60, 57, 64, 63, 64, 55, 60, 59, 55], 1.5, 33, 0.036, 0.016, KEYS),
    'birth': ([60, 67, 72, 74, 79, 76, 72, 79], 3.0, 48, 0.042, 0.0, STRING),
}


def strike(samples, frequency, onset, amplitude, voice):
    harmonics, decay, attack_time = voice
    for i in range(RATE * 6):
        t = i / RATE
        attack = min(1.0, t / attack_time)
        tone = sum(math.sin(2 * math.pi * frequency * harmonic * t)
                   * math.exp(-t * (decay + harmonic * 0.3)) / harmonic ** 1.7
                   for harmonic in harmonics)
        value = amplitude * attack * tone
        for delay, gain in ((0, 1), (0.21, 0.26), (0.47, 0.15), (0.83, 0.08)):
            samples[(onset + i + round(delay * RATE)) % SIZE] += value * gain


for name, (notes, beat, drone, level, pulse, voice) in CUES.items():
    samples = [0.0] * SIZE
    rng = random.Random(360)
    root = round(440 * 2 ** ((drone - 69) / 12) * SECONDS) / SECONDS
    # In the dark the second tone sits three loop-cycles above the first: it beats once every eight seconds.
    second = root + 3 / SECONDS if name == 'void' else round(root * 1.5 * SECONDS) / SECONDS
    for i in range(SIZE):
        t = i / RATE
        swell = 0.7 + 0.3 * math.cos(2 * math.pi * t / SECONDS)
        samples[i] = swell * (0.03 * math.sin(2 * math.pi * root * t) + 0.02 * math.sin(2 * math.pi * second * t))
    for index, note in enumerate(notes):
        if note is None:
            continue
        frequency = 440 * 2 ** ((note - 69) / 12)
        onset = round((index * beat + rng.uniform(0.04, 0.16)) * RATE)
        strike(samples, frequency, onset, level * rng.uniform(0.8, 1.0), voice)
    if pulse:
        knock = round(root * 2 * SECONDS) / SECONDS
        for index in range(round(SECONDS / beat)):
            onset = round(index * beat * RATE)
            for i in range(round(RATE * 0.3)):
                t = i / RATE
                samples[(onset + i) % SIZE] += pulse * math.sin(2 * math.pi * knock * t) * math.exp(-t * 16)
    peak = max(abs(value) for value in samples)
    gain = min(1.0, 0.22 / peak)
    pcm = b''.join(struct.pack('<h', round(value * gain * 32767)) for value in samples)
    with wave.open(str(DEST / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
    print(f'{name}: {SECONDS}s, peak={peak * gain:.3f}, {len(pcm):,} bytes')
