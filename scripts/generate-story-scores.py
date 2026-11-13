"""Render the original loops for ERASE and 8비트 심장 with synthesis only (no samples).

Run with Python 3. Output is 24-second mono PCM WAV loops. Every voice wraps around the loop
boundary and low tones are snapped to whole loop periods, so loops repeat without clicks.
Fixed seeds make the output reproducible.

- ERASE (public/game-list/erase/assets/music): cold ambient pads, filtered noise for static and wind.
- 8비트 심장 (public/game-list/8bit-heart/assets/music): square/triangle chiptune with a noise hat.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
ROOT = Path(__file__).resolve().parents[1] / 'public/game-list'


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def snap(freq):
    return round(freq * SECONDS) / SECONDS


def write(path, samples, level=0.24):
    peak = max(abs(v) for v in samples) or 1
    gain = level / peak
    pcm = b''.join(struct.pack('<h', round(max(-1, min(1, v * gain)) * 32767)) for v in samples)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm)
    print(f'{path.name}: {SECONDS}s, {len(pcm):,} bytes')


def pad(samples, notes, amp):
    for note in notes:
        f = snap(hz(note))
        for i in range(SIZE):
            t = i / RATE
            swell = 0.6 + 0.4 * math.cos(2 * math.pi * t / SECONDS)
            samples[i] += amp * swell * (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * 2 * f * t))


def bell(samples, notes, beat, amp, rng):
    for index, note in enumerate(notes):
        if note is None:
            continue
        f = hz(note)
        onset = round((index * beat + rng.uniform(0, 0.06)) * RATE)
        for i in range(RATE * 4):
            t = i / RATE
            v = amp * math.sin(2 * math.pi * f * t) * math.exp(-t * 1.6) * min(1, t / 0.01)
            for delay, g in ((0, 1), (0.31, 0.3), (0.67, 0.15)):
                samples[(onset + i + round(delay * RATE)) % SIZE] += v * g


def noise(samples, amp, smooth, rng, gust=0.0):
    value = 0.0
    for i in range(SIZE):
        t = i / RATE
        value += (rng.uniform(-1, 1) - value) * smooth
        envelope = 1.0 if not gust else 0.55 + 0.45 * math.sin(2 * math.pi * 3 * t / SECONDS) ** 2
        samples[i] += amp * value * envelope
    # Cross-fade the first and last 0.5 s so the noise bed loops seamlessly.
    fade = RATE // 2
    for i in range(fade):
        w = i / fade
        a, b = samples[i], samples[SIZE - fade + i]
        samples[i] = a * w + b * (1 - w)
        samples[SIZE - fade + i] = b * (1 - w) + a * w


def square(t, f, duty=0.5):
    return 1.0 if (t * f) % 1 < duty else -1.0


def triangle(t, f):
    p = (t * f) % 1
    return 4 * abs(p - 0.5) - 1


def chip(samples, lead, bass, beat, amp, rng, hat=True):
    step = round(beat * RATE)
    for index, note in enumerate(lead):
        if note is None:
            continue
        f = hz(note)
        onset = index * step
        for i in range(step):
            t = i / RATE
            env = min(1, t / 0.005) * math.exp(-t * 3.2)
            samples[(onset + i) % SIZE] += amp * 0.55 * env * square(t, f, 0.25)
    for index, note in enumerate(bass):
        if note is None:
            continue
        f = hz(note)
        onset = index * step * 2
        for i in range(step * 2):
            t = i / RATE
            samples[(onset + i) % SIZE] += amp * 0.6 * triangle(t, f) * min(1, t / 0.004) * (1 - i / (step * 2)) ** 0.3
    if hat:
        for index in range(SIZE // step):
            onset = index * step
            for i in range(round(RATE * 0.03)):
                samples[(onset + i) % SIZE] += amp * 0.18 * rng.uniform(-1, 1) * (1 - i / (RATE * 0.03))


def erase():
    out = ROOT / 'erase/assets/music'
    rng = random.Random(29)
    s = [0.0] * SIZE
    pad(s, [45, 52], 0.05)
    bell(s, [69, None, 72, None, 76, None, 74, None], 3.0, 0.05, rng)
    write(out / 'cold-room.wav', s)
    s = [0.0] * SIZE
    for b in range(48):
        onset = round(b * 0.5 * RATE)
        for i in range(round(RATE * 0.22)):
            t = i / RATE
            s[(onset + i) % SIZE] += 0.5 * math.sin(2 * math.pi * (55 + 90 * math.exp(-t * 30)) * t) * math.exp(-t * 9)
    pad(s, [49, 56], 0.02)
    bell(s, [73, 76, None, 80, 78, None, 76, 73] * 2, 1.5, 0.025, rng)
    write(out / 'neon.wav', s)
    s = [0.0] * SIZE
    noise(s, 0.07, 0.6, rng)
    pad(s, [40, 41], 0.025)
    bell(s, [None, 82, None, None, 81, None, None, None], 3.0, 0.02, rng)
    write(out / 'static.wav', s, 0.2)
    s = [0.0] * SIZE
    noise(s, 0.2, 0.02, rng, gust=1)
    pad(s, [38, 45, 50], 0.02)
    bell(s, [62, None, None, 69, None, None, 67, None], 3.0, 0.03, rng)
    write(out / 'wind.wav', s, 0.22)


def eight_bit():
    out = ROOT / '8bit-heart/assets/music'
    rng = random.Random(8)
    cues = {
        'chip-home': ([72, None, 76, 79, 77, None, 76, 72, 74, None, 77, 81, 79, None, 77, 74] * 2,
                      [48, 55, 53, 55] * 2, 0.375),
        'chip-run': ([76, 76, 79, 76, 81, 79, 76, 74, 76, 76, 79, 83, 81, 79, 76, 79] * 4,
                     [45, 45, 48, 50] * 4, 0.1875),
        'chip-core': ([69, 70, 69, None, 66, None, 69, 70, 72, 70, 69, None, 66, 65, 66, None] * 4,
                      [42, 42, 41, 41] * 4, 0.1875),
        'chip-dawn': ([79, None, 84, None, 83, 81, 79, None, 76, None, 79, None, 81, None, None, None] * 2,
                      [55, 52, 53, 48] * 2, 0.375),
    }
    for name, (lead, bass, beat) in cues.items():
        s = [0.0] * SIZE
        chip(s, lead, bass, beat, 0.5, rng, hat=name != 'chip-dawn')
        write(out / f'{name}.wav', s, 0.2)


erase()
eight_bit()
