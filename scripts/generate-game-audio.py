"""Render the authored games' original score and Foley without external recordings."""

from argparse import ArgumentParser
from array import array
from dataclasses import dataclass
from functools import lru_cache
from math import exp, pi, sin, sqrt, tau
from pathlib import Path
from random import Random
from subprocess import run
from tempfile import TemporaryDirectory
import sys
import wave

RATE = 22050
GAME_LIST = Path(__file__).resolve().parents[1] / "public" / "game-list"


@dataclass(frozen=True)
class Voice:
    harmonics: tuple[float, ...]
    attack: float
    falloff: float
    release: float
    vibrato: float = 0


VOICES = {
    "sub": Voice((1, .09), .62, .12, .55),
    "felt": Voice((1, .29, .10, .055), .012, 2.4, .19),
    "glass": Voice((1, .055, .13, .02, .055), .013, 1.9, .28),
    "silk": Voice((1, .44, .21, .13, .075, .04), .014, 3.3, .24, .035),
    "reed": Voice((1, .27, .38, .11, .09), .11, .87, .24, .085),
    "breath": Voice((1, .24, .07, .045), .16, .55, .37, .14),
    "bow": Voice((1, .34, .25, .11, .11, .09), .22, .26, .44, .22),
    "pad": Voice((1, .20, .08), .52, .22, .65, .025),
    "pulse": Voice((1, .46, .21, .03, -.05), .008, 1.4, .045),
    "triangle": Voice((1, 0, -.13, 0, .035), .008, .72, .075),
    "cartridge": Voice((1, .71, .33, 0, -.20, -.24, -.14), .004, 2.1, .028),
    "counter": Voice((1, 0, -.111, 0, .04, 0, -.020), .004, .85, .052),
}


@dataclass(frozen=True)
class Track:
    name: str
    bpm: int
    root: int
    chords: tuple[tuple[int, ...], ...]
    melody: tuple[int | None, ...]
    lead: str
    harmony: str
    beat: str = ""
    ambience: str = ""
    level: float = .066
    phrase: int = 12


# The four chords are spaced two bars apart; the two-bar phrases vary on the second half.
MINOR = ((0, 3, 7), (-4, 0, 3), (-2, 2, 5), (-5, 0, 2))
MAJOR = ((0, 4, 7), (-3, 0, 4), (-5, 0, 2), (-5, -1, 2))
OPEN = ((0, 7), (-2, 5), (-5, 2), (0, 7))
DISTANT = ((0, 7, 14), (-3, 4, 11), (-5, 2, 9), (-2, 5, 12))
TENSE = ((0, 1, 7), (0, 6, 7), (-3, 0, 5), (-5, 0, 6))
NONE = (None,) * 16
CHIP_MOTIF = (0, None, 4, 7, 9, None, 7, 4, 2, None, 5, 9, 7, 5, 4, None)

SCORES = {
    "360": (
        Track("void", 64, 31, ((0, 7),) * 4, NONE, "glass", "pad", ambience="space", level=.039),
        Track("port", 72, 45, OPEN, (0, None, 7, None, 5, None, 2, None, None, 7, None, 9, 7, None, 2, None), "silk", "pad", phrase=0),
        Track("market", 100, 45, MINOR, (0, 3, 5, None, 3, 0, -2, None, 0, None, 3, 5, 7, None, 5, 3), "reed", "triangle", "brush", phrase=12),
        Track("ward", 68, 48, DISTANT, (7, None, 4, None, 0, None, 4, None, 5, None, 2, None, 0, -2, None, None), "glass", "pad", level=.052),
        Track("now", 84, 45, MINOR, (0, None, 7, 3, None, 7, None, 2, 0, None, 7, 5, None, 3, None, 2), "felt", "pad", "brush"),
        Track("birth", 66, 48, MAJOR, (0, None, 7, None, 4, None, None, 9, 7, None, 4, None, 2, None, 0, None), "silk", "breath", level=.058),
    ),
    "8bit-heart": (
        Track("chip-home", 112, 48, MAJOR, CHIP_MOTIF, "pulse", "triangle", "chip", level=.081),
        Track("chip-run", 146, 45, MINOR, (0, 3, 7, 3, 8, 7, 5, 3, 0, 3, 7, 10, 8, 7, 5, 3), "pulse", "triangle", "run", level=.084),
        Track("chip-core", 124, 42, TENSE, (0, 1, 0, None, 6, None, 7, 6, 0, 1, 3, 1, None, -1, 0, None), "pulse", "triangle", "run", level=.081),
        Track("chip-dawn", 86, 48, MAJOR, (0, None, 4, None, 7, None, 9, None, 7, 4, 2, None, 4, None, 0, None), "triangle", "triangle", level=.075),
    ),
    "erase": (
        Track("cold-room", 62, 43, TENSE, (2, None, None, None, 5, None, None, None, None, None, 1, None, 0, None, None, None), "glass", "pad", ambience="sterile", level=.048),
        Track("studio", 74, 50, MAJOR, (4, None, 7, None, 9, 7, 4, None, 2, None, 4, None, 7, 4, 2, None), "felt", "pad", level=.055),
        Track("neon", 118, 45, MINOR, (0, None, 0, 3, None, 7, None, 5, 0, None, 5, 7, None, 8, 7, None), "pulse", "triangle", "club", level=.080),
        Track("static", 76, 40, TENSE, (None, None, 7, None, None, None, 6, None, None, 1, None, None, 0, None, None, None), "glass", "sub", ambience="radio", level=.044),
        Track("wind", 66, 43, OPEN, (7, None, None, None, 5, None, None, 2, None, None, None, 0, None, None, None, None), "felt", "pad", ambience="wind", level=.052),
    ),
    "muwon": (
        Track("night-well", 64, 43, OPEN, (0, None, None, 3, None, 5, None, None, 7, None, None, 5, None, 2, None, None), "breath", "bow", ambience="wind", level=.052),
        Track("inquest", 82, 45, MINOR, (0, None, 3, 5, None, 7, None, 5, 3, None, 0, None, 5, None, 3, None), "silk", "pad", "skin", level=.061),
        Track("pressure", 105, 43, TENSE, (0, None, 2, 0, 7, None, 6, None, 0, 3, 5, None, 2, 0, None, None), "bow", "sub", "skin", level=.067, phrase=0),
        Track("dawn", 66, 48, DISTANT, (0, None, 2, None, 7, None, 9, None, 7, None, 4, None, 2, None, 0, None), "breath", "silk", level=.057),
    ),
}


@lru_cache(maxsize=80)
def pitched(voice, pitch, length):
    instrument = VOICES[voice]
    hz = 440 * 2 ** ((pitch - 69) / 12)
    harmonics = [(tau * hz * index, weight) for index, weight in enumerate(instrument.harmonics, 1)
                 if weight and hz * index < RATE * .46]
    samples = array("f")
    for i in range(length):
        t = i / RATE
        tail = (length - 1 - i) / RATE
        envelope = min(1, t / instrument.attack, tail / instrument.release) * exp(-t * instrument.falloff)
        modulation = instrument.vibrato * sin(tau * 4.5 * t) if instrument.vibrato else 0
        tone = sum(weight * sin(angular * t + modulation * index)
                   for index, (angular, weight) in enumerate(harmonics, 1))
        samples.append(tone * envelope)
    return samples


@dataclass(frozen=True)
class Layer:
    offset: float
    duration: float
    level: float
    start_hz: float = 0
    end_hz: float = 0
    noise: float = 0
    tone: float = .30
    attack: float = .003
    decay: float = 3.8


@lru_cache(maxsize=64)
def render_layer(duration, start_hz, end_hz, noise, tone, attack, decay):
    length = round(duration * RATE)
    rng = Random(913 + round(duration * 1000) + round(start_hz))
    low = 0
    phase = 0
    samples = array("f")
    for i in range(length):
        progress = i / max(length - 1, 1)
        dry = rng.uniform(-1, 1)
        low += tone * (dry - low)
        colored = low * .78 + dry * min(.5, tone)
        phase += tau * (start_hz + (end_hz - start_hz) * progress) / RATE
        envelope = min(1, i / (RATE * attack), (1 - progress) * 12) * exp(-decay * progress)
        oscillator = sin(phase) if start_hz or end_hz else 0
        samples.append(((1 - noise) * oscillator + noise * colored) * envelope)
    return samples


def layer_samples(layer):
    return render_layer(layer.duration, layer.start_hz, layer.end_hz, layer.noise, layer.tone, layer.attack, layer.decay)


def mix(left, right, source, start, gain, pan=0):
    lgain = gain * sqrt((1 - pan) * .5)
    rgain = gain * sqrt((1 + pan) * .5)
    frames = len(left)
    for i, value in enumerate(source):
        index = (start + i) % frames
        left[index] += value * lgain
        right[index] += value * rgain


PERCUSSION = {
    "low": Layer(0, .20, 1, 115, 45, .08, .12, decay=5.7),
    "hat": Layer(0, .075, 1, noise=1, tone=.68, decay=5.5),
    "brush": Layer(0, .12, 1, noise=1, tone=.16, attack=.024, decay=3),
    "skin": Layer(0, .24, 1, 132, 79, .29, .33, decay=5.3),
    "click": Layer(0, .075, 1, 980, 450, .64, .5, decay=7),
}

AMBIENCE = {
    "space": (.05, 1.4, 0),
    "sterile": (.18, .7, 1.5),
    "electrical": (.12, .7, 2.2),
    "radio": (.48, 3.2, .5),
    "wind": (.022, 2.8, .88),
    "fan": (.07, 2.2, 3.0),
    "rain": (.35, 1.85, .64),
}


def add_air(left, right, key, rng):
    smoothing, amount, hum = AMBIENCE[key]
    frames = len(left)
    time = frames / RATE
    hum_frequency = round(59.8 * time) / time
    low = 0
    for i in range(frames):
        t = i / RATE
        low += smoothing * (rng.uniform(-1, 1) - low)
        seam = min(1, t / .20, (frames - 1 - i) / (RATE * .20))
        swell = .64 + .36 * sin(tau * 1.0 * t / time) ** 2
        breeze = .019 * amount * low * seam * swell
        motor = .006 * hum * sin(tau * hum_frequency * t)
        left[i] += breeze + motor
        right[i] += .90 * breeze + motor


def percussion(track, left, right, beat):
    for index in range(32):
        hits = []
        if track.beat in {"chip", "run", "club"}:
            hits.append(("hat", index + .5, .065, .34))
            if index % (1 if track.beat == "club" else 4) == 0:
                hits.append(("low", index, .23, 0))
            if index % 4 == 2:
                hits.append(("brush", index, .19, -.2))
            if track.beat == "run" and index % 2 == 1:
                hits.append(("hat", index + .75, .085, -.28))
        elif track.beat == "skin" and index % 8 in {0, 3, 5}:
            hits.append(("skin", index, .20 if index % 8 == 0 else .10, -.12))
        elif track.beat == "meter" and index % 4 in {0, 2}:
            hits.append(("click", index, .075, -.14))
            if index % 4 == 0:
                hits.append(("low", index, .092, 0))
        elif track.beat == "brush" and index % 4 in {0, 3}:
            hits.append(("brush", index, .11, -.21))
        for key, onset, level, pan in hits:
            mix(left, right, layer_samples(PERCUSSION[key]), round(onset * beat), level, pan)


@dataclass(frozen=True)
class Soundstage:
    chord_length: float
    lead_length: float
    echo: tuple[tuple[float, float, float], ...]
    stereo: float
    body: float
    edge: float
    foley_room: tuple[float, float]


# These settings belong to the world of each game, including its sound effects.
SOUNDSTAGES = {
    "360": Soundstage(8.2, 2.1, ((.29, .13, -.24), (.55, .09, .22)), .65, .90, .32, (.071, .09)),
    "8bit-heart": Soundstage(1.2, .48, (), .42, .91, .92, (0, 0)),
    "erase": Soundstage(11.0, 1.8, ((.72, .21, -.65), (1.1, .10, .60)), .94, .78, .57, (.038, .09)),
    "muwon": Soundstage(7.1, 2.7, ((.31, .16, .27), (.79, .11, -.53)), .78, .85, .58, (.126, .17)),
}


def finish_score(game, left, right):
    stage = SOUNDSTAGES[game]
    for channel in (left, right):
        # Start the filter from the previous lap so this processing stays seamless.
        low = channel[-1]
        for sample in channel[-240:]:
            low += .12 * (sample - low)
        for i, sample in enumerate(channel):
            low += .12 * (sample - low)
            value = low * stage.body + (sample - low) * stage.edge
            channel[i] = round(value * 440) / 440 if game == "8bit-heart" else value
    for i, (a, b) in enumerate(zip(left, right)):
        mid = (a + b) * .5
        left[i] = mid + stage.stereo * (a - mid)
        right[i] = mid + stage.stereo * (b - mid)
    return left, right


def render_score(game, track):
    stage = SOUNDSTAGES[game]
    beat = 60 * RATE / track.bpm
    frames = round(beat * 32)
    left = array("f", [0]) * frames
    right = array("f", [0]) * frames
    rng = Random(track.bpm * 113 + track.root)

    if track.ambience:
        add_air(left, right, track.ambience, rng)
    if track.name == "void":
        root = round((440 * 2 ** ((track.root - 69) / 12)) * frames / RATE)
        for i in range(frames):
            phase = tau * i / frames
            value = .045 * sin(root * phase)
            left[i] += value + .038 * sin((root + 3) * phase)
            right[i] += value + .038 * sin((root + 3) * phase + .34)
        for point, pitch in ((6, 78), (22, 73)):
            mix(left, right, pitched("glass", pitch, round(beat * 5)), round(beat * point), .05, -.12)
        return finish_score(game, left, right)

    lead = {"pulse": "cartridge", "triangle": "counter"}[track.lead] if game == "8bit-heart" else track.lead
    harmony = "counter" if game == "8bit-heart" else track.harmony
    electronic = track.lead in {"pulse", "triangle"} or track.beat == "chip"
    for bar, chord in enumerate(track.chords):
        start = round(bar * 8 * beat)
        for index, offset in enumerate(chord):
            voice_length = (stage.chord_length if game == "8bit-heart" or not electronic else 1.65)
            level = .124 if electronic else .092
            pulses = (0, 2.5, 4, 6.5) if game == "8bit-heart" else (0, 2, 4, 6)
            for repeat in pulses if electronic else (0,):
                pitch = track.root + offset + (0 if index == 0 else 12)
                sample = pitched(harmony, pitch, round(beat * voice_length))
                mix(left, right, sample, start + round(beat * (repeat + index * .075)), level / (1 + index * .11), (index - 1) * .28)
        for repeat in (0, 4):
            bass_voice = "counter" if game == "8bit-heart" else "triangle" if electronic else "sub"
            bass = pitched(bass_voice, track.root + chord[0] - (12 if electronic else 0),
                           round(beat * (2.25 if electronic else 5.1)))
            mix(left, right, bass, start + round(repeat * beat), .17 if electronic else .095)
        for step, offset in enumerate(track.melody):
            if offset is None:
                continue
            steps = (step + (2 if bar == 3 and step < 13 else 0)) % 16
            position = start + round((steps * .5 + (0 if electronic else rng.uniform(0, .06))) * beat)
            pitch = track.root + track.phrase + offset + (chord[0] if bar % 2 else 0)
            if bar == 2 and step in {0, 8} and track.lead in {"pulse", "glass", "felt"}:
                pitch += 12
            duration = (.49 if electronic and game != "8bit-heart" else stage.lead_length) * (1.25 if step in {0, 8} else 1)
            played = pitched(lead, pitch, round(duration * beat))
            gain = (.19 if electronic else .18) * rng.uniform(.78, 1.0)
            balance = rng.uniform(-.18, .18)
            mix(left, right, played, position, gain, balance)
            for delay, amount, pan in stage.echo:
                mix(left, right, played, position + round(delay * beat), gain * amount, pan)
            if game == "muwon" and step in {0, 8}:
                grace = pitched(lead, pitch - 2, round(.46 * beat))
                mix(left, right, grace, position - round(.21 * beat), gain * .29, -.14)
    percussion(track, left, right, beat)
    return finish_score(game, left, right)


FOLEY = {
    "360": {
        "granary_key": [Layer(0, .18, .44, 1880, 1150, .30), Layer(.063, .32, .30, 2690, 2100, .32), Layer(.19, .15, .18, 3220, 2800, .39)],
        "market_fire": [Layer(0, .94, .24, noise=1, tone=.065, attack=.09), Layer(.12, .14, .22, 160, 52, .85, .44), Layer(.39, .22, .34, 126, 86, .81, .38), Layer(.62, .17, .18, 200, 38, .65)],
    },
    "8bit-heart": {
        "repair_switch": [Layer(0, .075, .65, 450, 290, .74, .65), Layer(.015, .08, .21, 155, 95, .30)],
        "repair_battery": [Layer(0, .10, .23, noise=1, tone=.40, attack=.009), Layer(.083, .13, .62, 1620, 560, .61), Layer(.193, .07, .21, 477, 289, .57)],
        "repair_tap": [Layer(0, .11, .69, 177, 119, .36), Layer(.146, .11, .53, 196, 127, .41)],
        "repair_breath": [Layer(0, .36, .61, noise=1, tone=.22, attack=.06), Layer(.19, .17, .17, noise=1, tone=.66, attack=.034)],
        "boot": [Layer(0, .09, .22, 392, 392, .03), Layer(.09, .12, .30, 523, 523, .04), Layer(.18, .18, .38, 659, 659, .03)],
    },
    "erase": {
        "shutter": [Layer(0, .06, .63, 1050, 480, .69, .59), Layer(.058, .088, .73, 1280, 450, .83, .58), Layer(.13, .17, .12, noise=1, tone=.62)],
        "consent_pen": [Layer(0, .17, .37, noise=1, tone=.38, attack=.017), Layer(.11, .12, .22, 710, 310, .70), Layer(.16, .19, .42, noise=1, tone=.20, attack=.045)],
        "monitor": [Layer(0, .14, .63, 840, 840, .08, attack=.014), Layer(.274, .14, .43, 837, 837, .08, attack=.012)],
    },
    "muwon": {
        "well_rope": [Layer(0, .56, .36, 272, 144, .49, .10, .06), Layer(.17, .19, .24, 88, 44, .66, .18), Layer(.38, .55, .25, 164, 36, .82, .42, .024)],
        "paper": [Layer(0, .24, .55, noise=1, tone=.46, attack=.018), Layer(.19, .21, .32, noise=1, tone=.26, attack=.012)],
        "ice_movement": [Layer(0, .77, .52, 293, 105, .81, .34, .048), Layer(.31, .18, .22, 1460, 340, .52, .16), Layer(.53, .25, .37, 406, 123, .72, .45)],
    },
}


def render_foley(game, layers):
    stage = SOUNDSTAGES[game]
    delay, room_gain = stage.foley_room
    echo_offset = round(delay * RATE)
    frames = round((max(layer.offset + layer.duration for layer in layers) + delay + .025) * RATE)
    clip = array("f", [0]) * frames
    for layer in layers:
        onset = round(layer.offset * RATE)
        for i, value in enumerate(layer_samples(layer)):
            clip[onset + i] += value * layer.level
    dry = clip[:]
    room = 0
    low = 0
    for i, value in enumerate(dry):
        low += .22 * (value - low)
        if echo_offset and i >= echo_offset:
            room += .12 * (dry[i - echo_offset] - room)
        made = low * stage.body + (value - low) * stage.edge + room * room_gain
        end = min(1, (frames - i - 1) / (.015 * RATE))
        clip[i] = end * (round(made * 235) / 235 if game == "8bit-heart" else made)
    return (clip,)


def write_wav(path, channels, max_peak, target_rms):
    frames = len(channels[0])
    peak = max(max(abs(x) for x in channel) for channel in channels)
    rms = sqrt(sum(sum(value * value for value in channel) for channel in channels) / (len(channels) * frames))
    gain = min(max_peak / max(peak, 1e-9), target_rms / max(rms, 1e-9))
    pcm = array("h", (round(sample * gain * 32767) for frame in zip(*channels) for sample in frame))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(len(channels))
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())


def main():
    cli = ArgumentParser(description=__doc__)
    cli.add_argument("--game", choices=SCORES, action="append", help="Render only this game. Repeat to select several.")
    args = cli.parse_args()
    for game in args.game or SCORES:
        assets = GAME_LIST / game / "assets"
        print(game, flush=True)
        with TemporaryDirectory(prefix=".game-audio-", dir=GAME_LIST.parent.parent) as work:
            staging = Path(work)
            for track in SCORES[game]:
                source = staging / "score.wav"
                compressed = staging / f"{track.name}.flac"
                write_wav(source, render_score(game, track), .31, track.level)
                run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-compression_level", "8", str(compressed)], check=True)
                compressed.replace(assets / "music" / compressed.name)
                print(f"  {compressed.name}", flush=True)
            sfx_dir = assets / "sfx"
            sfx_dir.mkdir(exist_ok=True)
            for name, layers in FOLEY[game].items():
                wav = staging / f"{name}.wav"
                write_wav(wav, render_foley(game, layers), .36, .105)
                wav.replace(sfx_dir / wav.name)
                print(f"  {wav.name}", flush=True)


if __name__ == "__main__":
    main()
