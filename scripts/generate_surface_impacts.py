"""Impacts courts bois/pierre, synthese originale reproductible sans dependance."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUTPUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds'


def impact(name, duration, cutoff, decay, bass, seed):
    rng = random.Random(seed)
    alpha = 1 - math.exp(-2 * math.pi * cutoff / RATE)
    samples = []
    filtered = 0.0
    for i in range(round(duration * RATE)):
        t = i / RATE
        filtered += alpha * (rng.uniform(-1, 1) - filtered)
        envelope = min(1, t / 0.0015) * math.exp(-decay * t)
        body = 0.32 * math.sin(2 * math.pi * bass * t) * math.exp(-24 * t)
        # Le bois garde un corps grave ; la pierre ajoute une breve friction granuleuse.
        grain = 0.0 if name == 'wood' else rng.uniform(-1, 1) * 0.12 * math.exp(-45 * t)
        end = min(1, (duration - t) / 0.018)
        samples.append((filtered * envelope + body + grain * envelope) * end)
    peak = max(abs(sample) for sample in samples) or 1
    samples = [round(sample / peak * 0.42 * 32767) for sample in samples]
    samples[0] = samples[-1] = 0
    target = OUTPUT / ('impact-' + name + '-soft.wav')
    with wave.open(str(target), 'wb') as output:
        output.setparams((1, 2, RATE, len(samples), 'NONE', 'not compressed'))
        output.writeframes(struct.pack('<%dh' % len(samples), *samples))
    print('%s: mono PCM16, %d Hz, %.3f s, %d octets' %
          (target.name, RATE, len(samples) / RATE, target.stat().st_size))


if __name__ == '__main__':
    impact('wood', 0.20, 1000, 34, 125, 1077)
    impact('stone', 0.18, 3100, 42, 245, 1078)
