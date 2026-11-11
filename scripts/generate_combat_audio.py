"""Crée deux sons originaux et reproductibles, sans dépendance externe."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
DEST = Path(__file__).resolve().parents[1] / 'assets-src' / 'sounds'
DEST.mkdir(parents=True, exist_ok=True)


def save(name, samples):
    with wave.open(str(DEST / name), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, value)) * 32767)) for value in samples))


def music():
    # Huit mesures lentes : la mélodie revient exactement au début du cycle.
    melody = [146.83, 174.61, 220.00, 196.00, 174.61, 164.81, 130.81, 110.00]
    bass = [73.42, 73.42, 55.00, 55.00, 65.41, 65.41, 55.00, 55.00]
    seconds = 24
    samples = []
    for i in range(seconds * RATE):
        t = i / RATE
        phrase = min(7, int(t / 3))
        local = t % 3
        fade = min(1, local / 0.22, (3 - local) / 0.5)
        drone = math.sin(2 * math.pi * bass[phrase] * t) * 0.065
        drone += math.sin(2 * math.pi * bass[phrase] * 2 * t) * 0.018
        tone = math.sin(2 * math.pi * melody[phrase] * t) * 0.045 * fade
        tone += math.sin(2 * math.pi * melody[phrase] * 2.01 * t) * 0.012 * fade
        # Son de cloche court en début de mesure ; le signal d'attaque reste devant.
        bell = math.sin(2 * math.pi * melody[phrase] * 4 * t) * 0.022 * math.exp(-local * 5)
        pulse = 0.012 * math.sin(2 * math.pi * 1.0 * t) * math.sin(2 * math.pi * 55 * t)
        edge = min(1, t / 0.2, (seconds - t) / 0.2)
        samples.append((drone + tone + bell + pulse) * max(0, edge))
    save('combat-music.wav', samples)


def shotgun():
    random.seed(4616)
    samples = []
    smooth = 0.0
    for i in range(round(0.62 * RATE)):
        t = i / RATE
        noise = random.uniform(-1, 1)
        smooth += (noise - smooth) * 0.19
        crack = noise * 0.50 * math.exp(-t * 33)
        body = smooth * 0.50 * math.exp(-t * 8)
        bass = math.sin(2 * math.pi * (95 * t - 40 * t * t)) * 0.23 * math.exp(-t * 9)
        samples.append((crack + body + bass) * min(1, t / 0.003))
    save('shotgun-shot.wav', samples)


music()
shotgun()
print('Sons créés dans assets-src/sounds (lancer scripts/encode-sounds-ogg.mjs)')
