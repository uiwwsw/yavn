"""Render the loops and two cues for Overflow with synthesis only (no samples).

Run with Python 3 from anywhere. Output goes to public/game-list/overflow/assets/music and /sfx.
Loops are 24-second mono PCM WAVs. Every voice wraps around the loop boundary and steady tones
are snapped to whole loop periods, so the loops repeat without clicks. Fixed seeds make the
output reproducible. Convert with `node scripts/compress-music.mjs` afterwards — the engine
loops these with audio.loop, so they have to stay gapless, which means FLAC and not a lossy codec.

- quant: the office. A dry quantised pulse on a square under a mains hum, every reading on time.
- lowscore: 배동식's house. A slow low pad with one note that arrives late and is never resolved.
- standard: 한신뉴로. A clean sine arpeggio in a major key, too even, with a soft room tone.
- overflow: the same arpeggio climbing past the top of its register and wrapping to the bottom.
- street: the last morning. Almost nothing — filtered traffic noise and two far-off notes.
- read (sfx): the two-tone EMOS readout alert.
- click (sfx): a ballpoint pen.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
ROOT = Path(__file__).resolve().parents[1] / 'public/game-list/overflow/assets'


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
    print(f'{path.relative_to(ROOT)}: {len(samples) / RATE:.1f}s, {len(pcm):,} bytes')


def triangle(phase):
    p = phase % 1
    return 4 * abs(p - 0.5) - 1


def square(phase):
    return 1.0 if phase % 1 < 0.5 else -1.0


def hum(samples, amp, base=100):
    f = snap(base)
    for i in range(SIZE):
        t = i / RATE
        samples[i] += amp * (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * 2 * f * t))


def pad(samples, notes, amp, detune=0.0):
    for note in notes:
        for d in (0, detune) if detune else (0,):
            f = snap(hz(note) * (1 + d))
            for i in range(SIZE):
                t = i / RATE
                swell = 0.6 + 0.4 * math.cos(2 * math.pi * t / SECONDS)
                samples[i] += amp * swell * math.sin(2 * math.pi * f * t)


def notes(samples, seq, beat, amp, voice, decay, rng=None, jitter=0.0, length=1.5, detune=0.0, offset=0.0):
    step = beat * RATE
    for index, note in enumerate(seq):
        if note is None:
            continue
        f = hz(note) * (1 + detune)
        onset = round(index * step + offset * RATE + (rng.uniform(0, jitter) * RATE if rng else 0))
        for i in range(round(RATE * length)):
            t = i / RATE
            env = min(1, t / 0.004) * math.exp(-t * decay)
            phase = f * t
            v = {'sine': math.sin(2 * math.pi * phase), 'triangle': triangle(phase)}.get(voice, square(phase))
            samples[(onset + i) % SIZE] += amp * env * v


def noise(samples, amp, smooth, rng):
    value = 0.0
    for i in range(SIZE):
        value += (rng.uniform(-1, 1) - value) * smooth
        samples[i] += amp * value
    fade = RATE // 2
    for i in range(fade):
        w = i / fade
        a, b = samples[i], samples[SIZE - fade + i]
        samples[i] = a * w + b * (1 - w)
        samples[SIZE - fade + i] = b * (1 - w) + a * w


def quant():
    rng = random.Random(1)
    s = [0.0] * SIZE
    hum(s, 0.03)
    pulse = [45, None, 45, None, 52, None, 45, None] * 6
    notes(s, pulse, 0.25, 0.07, 'square', 14.0, length=0.4)
    top = [69, None, None, 71, None, None, 69, None, None, 64, None, None]
    notes(s, top * 4, 0.5, 0.05, 'triangle', 5.0, rng, 0.002, 0.9)
    pad(s, [33, 40], 0.022)
    write(ROOT / 'music/quant.wav', s, 0.21)


def lowscore():
    s = [0.0] * SIZE
    pad(s, [36, 43, 48], 0.04, detune=0.004)
    phrase = [60, None, None, None, 58, None, None, None, 55, None, None, None, None, None, None, None]
    notes(s, phrase * 2, 0.75, 0.085, 'sine', 1.1, length=3.2)
    # the late note: a fourth voice that lands half a beat behind and never resolves upward
    notes(s, [63, None, None, None] * 2, 3.0, 0.05, 'sine', 0.9, length=4.0, offset=0.34)
    write(ROOT / 'music/lowscore.wav', s, 0.2)


def standard():
    rng = random.Random(96)
    s = [0.0] * SIZE
    arp = [67, 71, 74, 79, 74, 71] * 2 + [69, 72, 76, 81, 76, 72] * 2
    notes(s, arp * 4, 0.25, 0.09, 'sine', 4.2, length=1.1)
    pad(s, [43, 50], 0.028)
    noise(s, 0.025, 0.04, rng)
    write(ROOT / 'music/standard.wav', s, 0.2)


def overflow():
    rng = random.Random(10001)
    s = [0.0] * SIZE
    # The same figure as `standard`, but each pass is transposed up until it passes the top of
    # the register and wraps back to the bottom — the register overflows the way the index does.
    figure = [67, 71, 74, 79, 74, 71]
    seq = []
    step = 0
    for _ in range(16):
        shift = step * 5
        seq.extend((n + shift - 36 if n + shift > 96 else n + shift) for n in figure)
        step += 1
    notes(s, seq, 0.25, 0.08, 'sine', 3.6, rng, 0.004, 1.2)
    pad(s, [31, 38], 0.038, detune=0.007)
    notes(s, [43, None, None, None] * 6, 1.0, 0.05, 'square', 6.0, length=0.8)
    noise(s, 0.04, 0.06, rng)
    write(ROOT / 'music/overflow.wav', s, 0.22)


def street():
    rng = random.Random(402)
    s = [0.0] * SIZE
    noise(s, 0.1, 0.02, rng)
    pad(s, [45], 0.02)
    notes(s, [76, None, None, None, None, None, 72, None], 3.0, 0.045, 'sine', 1.0, length=3.4)
    write(ROOT / 'music/street.wav', s, 0.18)


def read_sfx():
    length = round(RATE * 1.2)
    s = [0.0] * length
    for start, note in ((0.0, 86), (0.3, 91)):
        f = hz(note)
        onset = round(start * RATE)
        for i in range(length - onset):
            t = i / RATE
            env = min(1, t / 0.003) * math.exp(-t * 4.0)
            s[onset + i] += env * (math.sin(2 * math.pi * f * t) + 0.2 * math.sin(2 * math.pi * 3 * f * t) * math.exp(-t * 9))
    write(ROOT / 'sfx/read.wav', s, 0.45)


def click_sfx():
    rng = random.Random(68)
    length = round(RATE * 0.16)
    s = [0.0] * length
    value = 0.0
    for i in range(length):
        t = i / RATE
        value += (rng.uniform(-1, 1) - value) * 0.85
        s[i] = value * math.exp(-t * 120) + 0.25 * math.sin(2 * math.pi * 2600 * t) * math.exp(-t * 150)
    write(ROOT / 'sfx/click.wav', s, 0.5)


quant()
lowscore()
standard()
overflow()
street()
read_sfx()
click_sfx()
