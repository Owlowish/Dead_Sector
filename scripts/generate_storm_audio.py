"""Génère deux effets d'orage locaux (WAV mono PCM, bibliothèque standard Python)."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUTPUT = Path(__file__).resolve().parents[1] / "public/assets/sounds"
rng = random.Random(1803)


def write(name: str, samples: list[float], peak: float) -> None:
    mean = sum(samples) / len(samples)
    samples = [sample - mean for sample in samples]
    maximum = max(abs(sample) for sample in samples) or 1
    scale = peak / maximum
    path = OUTPUT / f"{name}-soft.wav"
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, RATE, len(samples), "NONE", "not compressed"))
        output.writeframes(struct.pack(f"<{len(samples)}h", *(round(s * scale * 32767) for s in samples)))


# Bruit brun doux avec fondu croisé d'une seconde pour éviter un clic à la boucle.
duration = 9
alpha = 1 - math.exp(-2 * math.pi * 420 / RATE)
state = 0.0
rain = []
for i in range(duration * RATE + RATE):
    state += alpha * (rng.uniform(-1, 1) - state)
    rain.append(state * (0.72 + 0.12 * math.sin(2 * math.pi * i / (RATE * 6))))
loop = rain[:duration * RATE]
for i in range(RATE):
    blend = i / (RATE - 1)
    loop[i] = rain[duration * RATE + i] * (1 - blend) + rain[i] * blend
write("rain", loop, 0.20)

# Roulement grave : bruit filtré et sinus descendants, avec attaque diffuse et longue décroissance.
duration = 3.2
alpha = 1 - math.exp(-2 * math.pi * 105 / RATE)
state = phase = 0.0
thunder = []
for i in range(round(duration * RATE)):
    t = i / RATE
    state += alpha * (rng.uniform(-1, 1) - state)
    phase += 2 * math.pi * (58 - 28 * min(t / duration, 1)) / RATE
    envelope = min(1, t / 0.08) * math.exp(-1.05 * t)
    thunder.append((state * 0.72 + math.sin(phase) * 0.28) * envelope)
write("thunder", thunder, 0.34)
