"""Render the original loops and two cues for 튜토리얼 with synthesis only (no samples).

Run with Python 3 from anywhere. Output goes to public/game-list/tutorial/assets/music and /sfx.
Loops are 24-second mono PCM WAVs. Every voice wraps around the loop boundary and steady tones
are snapped to whole loop periods, so the loops repeat without clicks. Fixed seeds make the
output reproducible.

- fluoro: reality. A fluorescent mains hum under a store jingle played on a thin triangle,
  bright and a little too cheerful, with one beat in every bar left empty.
- tutorial: the simulation. A perfectly quantised sine arpeggio over a soft metronome click.
- bleed: the same arpeggio slowed and detuned against a low drone and filtered noise.
- server: an empty basement. Fan noise, a low pad and one high ping every six seconds.
- chime (sfx): the two-tone number-ticket call of the service desk.
- snap (sfx): a pencil lead breaking.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 24
SIZE = RATE * SECONDS
ROOT = Path(__file__).resolve().parents[1] / 'public/game-list/tutorial/assets'


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


def hum(samples, amp):
    base = snap(120)
    for i in range(SIZE):
        t = i / RATE
        flutter = 1 + 0.25 * math.sin(2 * math.pi * 0.25 * t)
        samples[i] += amp * flutter * (math.sin(2 * math.pi * base * t) + 0.35 * math.sin(2 * math.pi * 3 * base * t))


def pad(samples, notes, amp, detune=0.0):
    for note in notes:
        for d in (0, detune) if detune else (0,):
            f = snap(hz(note) * (1 + d))
            for i in range(SIZE):
                t = i / RATE
                swell = 0.6 + 0.4 * math.cos(2 * math.pi * t / SECONDS)
                samples[i] += amp * swell * math.sin(2 * math.pi * f * t)


def notes(samples, seq, beat, amp, voice, decay, rng=None, jitter=0.0, length=1.5, detune=0.0):
    step = beat * RATE
    for index, note in enumerate(seq):
        if note is None:
            continue
        f = hz(note) * (1 + detune)
        onset = round(index * step + (rng.uniform(0, jitter) * RATE if rng else 0))
        for i in range(round(RATE * length)):
            t = i / RATE
            env = min(1, t / 0.004) * math.exp(-t * decay)
            phase = f * t
            v = math.sin(2 * math.pi * phase) if voice == 'sine' else triangle(phase)
            samples[(onset + i) % SIZE] += amp * env * v


def clicks(samples, beat, amp, rng):
    step = round(beat * RATE)
    for index in range(SIZE // step):
        onset = index * step
        accent = 1.0 if index % 4 == 0 else 0.55
        for i in range(round(RATE * 0.012)):
            samples[(onset + i) % SIZE] += amp * accent * rng.uniform(-1, 1) * (1 - i / (RATE * 0.012))


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


def fluoro():
    rng = random.Random(411)
    s = [0.0] * SIZE
    hum(s, 0.035)
    # 120 bpm jingle, four bars per phrase, the fourth beat of every bar left empty.
    phrase = [72, 76, 79, None, 77, 76, 74, None, 72, 74, 76, None, 79, 77, 76, None]
    notes(s, phrase * 3, 0.5, 0.11, 'triangle', 5.5, rng, 0.004, 1.0)
    bass = [48, None, None, None, 53, None, None, None, 55, None, None, None, 48, None, None, None]
    notes(s, bass * 3, 0.5, 0.09, 'sine', 2.2, length=2.0)
    write(ROOT / 'music/fluoro.wav', s, 0.22)


def tutorial():
    rng = random.Random(1)
    s = [0.0] * SIZE
    arp = [60, 64, 67, 72, 67, 64] * 2 + [62, 65, 69, 74, 69, 65] * 2
    notes(s, arp * 4, 0.25, 0.1, 'sine', 4.0, length=1.2)
    pad(s, [48, 55], 0.03)
    clicks(s, 0.5, 0.05, rng)
    write(ROOT / 'music/tutorial.wav', s, 0.2)


def bleed():
    rng = random.Random(18)
    s = [0.0] * SIZE
    arp = [60, 64, 67, 72, 67, 64, None, None, 62, 65, 68, 74, 68, 65, None, None]
    notes(s, arp * 3, 0.5, 0.09, 'sine', 2.5, rng, 0.03, 2.0)
    notes(s, arp * 3, 0.5, 0.06, 'sine', 2.5, rng, 0.03, 2.0, detune=0.021)
    pad(s, [36, 43], 0.03, detune=0.006)
    noise(s, 0.05, 0.08, rng)
    write(ROOT / 'music/bleed.wav', s, 0.22)


def server():
    rng = random.Random(2029)
    s = [0.0] * SIZE
    noise(s, 0.12, 0.05, rng)
    pad(s, [33, 40], 0.04)
    notes(s, [91, None, None, None], 6.0, 0.05, 'sine', 1.2, length=3.0)
    write(ROOT / 'music/server.wav', s, 0.2)


def chime():
    length = round(RATE * 1.6)
    s = [0.0] * length
    for start, note in ((0.0, 88), (0.42, 84)):
        f = hz(note)
        onset = round(start * RATE)
        for i in range(length - onset):
            t = i / RATE
            env = min(1, t / 0.003) * math.exp(-t * 3.2)
            s[onset + i] += env * (math.sin(2 * math.pi * f * t) + 0.25 * math.sin(2 * math.pi * 2.76 * f * t) * math.exp(-t * 8))
    write(ROOT / 'sfx/chime.wav', s, 0.5)


def snap_sfx():
    rng = random.Random(7)
    length = round(RATE * 0.3)
    s = [0.0] * length
    value = 0.0
    for i in range(length):
        t = i / RATE
        value += (rng.uniform(-1, 1) - value) * 0.7
        s[i] = value * math.exp(-t * 60) + 0.3 * math.sin(2 * math.pi * 1900 * t) * math.exp(-t * 90)
    write(ROOT / 'sfx/snap.wav', s, 0.55)


fluoro()
tutorial()
bleed()
server()
chime()
snap_sfx()
