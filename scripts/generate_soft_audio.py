"""Sons provisoires adoucis ; originaux conservés. Python standard uniquement."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds'
rng = random.Random(73)


def noise(seconds, cutoff):
    alpha = 1 - math.exp(-2 * math.pi * cutoff / RATE)
    value = 0.0
    result = []
    for _ in range(round(seconds * RATE)):
        value += alpha * (rng.uniform(-1, 1) - value)
        result.append(value)
    return result


def write(name, samples, peak):
    # Retirer la composante continue et garder une marge avant saturation.
    mean = sum(samples) / len(samples)
    samples = [s - mean for s in samples]
    maximum = max(abs(s) for s in samples) or 1
    scale = peak / maximum
    with wave.open(str(OUTPUT / (name + '-soft.wav')), 'wb') as output:
        output.setparams((1, 2, RATE, len(samples), 'NONE', 'not compressed'))
        output.writeframes(struct.pack('<%dh' % len(samples),
                                      *(round(s * scale * 32767) for s in samples)))


def transient(name, seconds, cutoff, decay, bass, peak):
    samples = noise(seconds, cutoff)
    for i in range(len(samples)):
        t = i / RATE
        envelope = min(1, t / 0.003) * math.exp(-decay * t)
        body = math.sin(2 * math.pi * (bass * t - bass * t * t * 0.4))
        samples[i] = (samples[i] + 0.18 * body) * envelope
    # Courte queue diffuse, sans tintement métallique aigu.
    dry = samples[:]
    for delay, gain in [(0.027, 0.12), (0.049, 0.07), (0.083, 0.04)]:
        offset = round(delay * RATE)
        for i in range(offset, len(samples)):
            samples[i] += dry[i - offset] * gain
    for i in range(len(samples)):
        samples[i] *= min(1, (len(samples) - 1 - i) / (RATE * 0.02))
    write(name, samples, peak)


transient('shot', 0.55, 2800, 19, 95, 0.68)
transient('impact-metal', 0.22, 1700, 32, 230, 0.40)
transient('impact-zombie', 0.26, 950, 24, 80, 0.44)
transient('empty', 0.10, 2200, 65, 400, 0.30)

# Vent feutré, sans bourdon tonal. Recouvrement pour une boucle continue.
duration, overlap = 12, RATE
wind = noise(duration + 1, 350)
for i in range(len(wind)):
    t = i / RATE
    wind[i] *= 0.7 + 0.18 * math.sin(2 * math.pi * t / 6)
loop = wind[:duration * RATE]
for i in range(overlap):
    blend = i / (overlap - 1)
    loop[i] = wind[duration * RATE + i] * (1 - blend) + wind[i] * blend
write('ambiance', loop, 0.30)

# Souffle rauque stylisé plutôt qu'une voix : pas d'illusion de prise réelle.
breath = noise(1.7, 700)
for i in range(len(breath)):
    t = i / RATE
    envelope = math.sin(math.pi * i / (len(breath) - 1)) ** 2
    roughness = 0.65 + 0.35 * math.sin(2 * math.pi * 58 * t)
    breath[i] *= envelope * roughness
write('zombie-groan', breath, 0.48)
