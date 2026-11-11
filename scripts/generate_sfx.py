#!/usr/bin/env python3
"""DEAD SECTOR — effets sonores v2 : remplacements des WAV existants (mêmes noms) et sons manquants.

Synthèse numpy/scipy, déterministe (graines fixes), sans échantillon externe.
Usage : python scripts/generate_sfx_v2.py [dossier_sortie]      (défaut : public/assets/sounds)

Contraintes du dépôt respectées :
  - impact-wood-soft.wav et impact-stone-soft.wav : mono PCM 16 bits, 22 050 Hz, < 10 ko
    (vérifié par scripts/check-impact-surfaces.mjs) ;
  - les autres fichiers sont en 44 100 Hz mono 16 bits ;
  - ambiance-soft.wav et rain-soft.wav bouclent sans coupure (synthèse circulaire) ;
  - les noms existants sont conservés : remplacement direct, sans changer le code.
Les variantes « -2 » et « -3 » (tirs, impacts) sont facultatives : voir docs/CONSIGNES_AUDIO.md.
Les anciens générateurs (generate_soft_audio.py, generate_storm_audio.py, generate_surface_impacts.py,
generate_combat_audio.py) écrivent sous les mêmes noms : ne pas les relancer après cette version.
"""
import sys
import wave
import zlib
from math import gcd
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'assets-src' / 'sounds'

LOG = []


# ============================ outils ==========================================
def rng_for(name):
    return np.random.default_rng(zlib.crc32(name.encode()))


def tt(n):
    return np.arange(n) / SR


def white(r, n):
    return r.standard_normal(n)


def _sos(kind, f, order):
    return signal.butter(order, f, btype=kind, fs=SR, output='sos')


def lp(x, f, o=2):
    return signal.sosfilt(_sos('low', f, o), x)


def hp(x, f, o=2):
    return signal.sosfilt(_sos('high', f, o), x)


def bp(x, lo, hi, o=2):
    return signal.sosfilt(_sos('band', [lo, hi], o), x)


def env(n, tau, attack=0.0005):
    t = tt(n)
    e = np.exp(-t / tau)
    return e * np.minimum(1.0, t / attack) if attack else e


def modal(freqs, decays, amps, n, r=None):
    t = tt(n)
    y = np.zeros(n)
    for f, d, a in zip(freqs, decays, amps):
        ph = 0.0 if r is None else r.uniform(0, 2 * np.pi)
        y += a * np.sin(2 * np.pi * f * t + ph) * np.exp(-t / d)
    return y


def thump(n, f0, f1, tau_pitch, tau_env, amp=1.0, attack=0.0008):
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau_pitch)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return amp * np.sin(ph) * np.exp(-t / tau_env) * np.minimum(1.0, t / attack)


def at(buf, x, t0, gain=1.0):
    i = int(round(t0 * SR))
    j = min(i + len(x), len(buf))
    if i < len(buf) and j > i:
        buf[i:j] += gain * x[:j - i]
    return buf


def sat(x, drive):
    return np.tanh(x * drive) / np.tanh(drive)


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


def reverb(x, rt60, wet, r, dark=3500, pre=0.004):
    """Queue de salle : bruit à décroissance exponentielle, assombri, plus premières réflexions."""
    n_ir = int(rt60 * SR)
    t = tt(n_ir)
    ir = white(r, n_ir) * np.exp(-6.9 * t / rt60)
    ir = lp(ir, dark)
    for d, g in ((0.011, 0.5), (0.019, 0.35), (0.031, 0.25)):
        ir[int(d * SR)] += g * 3
    ir = np.concatenate([np.zeros(int(pre * SR)), ir])
    y = signal.fftconvolve(x, ir)[:len(x)]
    return wet * y * (np.abs(x).max() / (np.abs(y).max() + 1e-12))


def save(name, x, peak_db=-3.0, sr=SR, fade_out=0.008, fade_in=0.00015, loop=False):
    x = np.asarray(x, dtype=float)
    x = x - x.mean()
    if sr != SR:
        g = gcd(sr, SR)
        x = signal.resample_poly(x, sr // g, SR // g)
    if not loop:
        k = max(1, int(fade_out * sr))
        x[-k:] *= np.linspace(1, 0, k)
        k = max(1, int(fade_in * sr))
        x[:k] *= np.linspace(0, 1, k)
        x[0] = 0.0
        x[-1] = 0.0
    x *= 10 ** (peak_db / 20) / (np.abs(x).max() + 1e-12)
    pcm = np.round(x * 32767).astype('<i2')
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    LOG.append((name, len(pcm) / sr, sr, 44 + 2 * len(pcm)))


# ============================ voix (formants) =================================
def formant_bank(x, specs):
    y = np.zeros_like(x)
    for f, bw, g in specs:
        b, a = signal.iirpeak(f / (SR / 2), f / bw)
        y += g * signal.lfilter(b, a, x)
    return y


def vocal(r, dur, f0c, spec_a, spec_b, breath=0.25, growl=0.0, growl_hz=30.0, jitter=0.015,
          shape=None, drive=1.5, rasp=0.0, bright=5000):
    n = int(dur * SR)
    t = tt(n)
    jit = lp(white(r, n), 25)
    jit /= jit.std() + 1e-12
    f0 = f0c(t) * (1 + jitter * jit)
    src = lp(2 * ((np.cumsum(f0) / SR) % 1.0) - 1, bright)
    noise = white(r, n)
    w = np.linspace(0, 1, n)
    voiced = (1 - w) * formant_bank(src, spec_a) + w * formant_bank(src, spec_b)
    air = (1 - w) * formant_bank(noise, spec_a) + w * formant_bank(noise, spec_b)
    x = voiced / (voiced.std() + 1e-12) + breath * air / (air.std() + 1e-12)
    if growl:
        x *= 1 - growl * (0.5 + 0.5 * np.sin(2 * np.pi * growl_hz * t + r.uniform(0, 6.28)))
    if rasp:
        m = lp(white(r, n), 300)
        x *= 1 + rasp * m / (m.std() + 1e-12)
    if shape is not None:
        x *= shape(t, dur)
    return sat(norm(x), drive)


def vowel(f1, f2, f3, bw=(90, 110, 200), g=(1.0, 0.55, 0.2)):
    return [(f1, bw[0], g[0]), (f2, bw[1], g[1]), (f3, bw[2], g[2])]


def swell(att, rel, power=1.0):
    return lambda t, dur: np.minimum(1.0, t / att) * np.clip((dur - t) / rel, 0, 1) ** power


# ============================ armes ===========================================
def firearm(name, variant, dur, p):
    r = rng_for(f'{name}{variant}')
    n = int(dur * SR)
    click = hp(white(r, n), 3500) * env(n, 0.0008, 0.00005)
    crack = hp(white(r, n), p['crack_hp']) * env(n, p['crack_tau'], 0.00005)
    body = bp(white(r, n), *p['body']) * env(n, p['body_tau'], 0.0002)
    th = thump(n, p['f0'], 70, 0.035, p['th_tau'], 1.0)
    boom = thump(n, 75, 42, 0.1, p['boom_tau'], p['boom_amp'])
    dry = norm(click * 1.1 + crack * 1.9 + body * 1.3 + th * 0.55 + boom * 0.45)
    dry = sat(dry, p['drive'])
    x = dry + hp(reverb(dry, p['tail'], p['wet'], r), 250)
    return x


def gen_firearms():
    pistol = [
        dict(crack_hp=1200, crack_tau=0.006, body=(250, 2600), body_tau=0.045, f0=230, th_tau=0.07, boom_tau=0.12, boom_amp=0.35, drive=1.8, tail=0.45, wet=0.30),
        dict(crack_hp=1400, crack_tau=0.005, body=(300, 3000), body_tau=0.040, f0=250, th_tau=0.065, boom_tau=0.11, boom_amp=0.30, drive=1.9, tail=0.50, wet=0.28),
        dict(crack_hp=1000, crack_tau=0.007, body=(220, 2400), body_tau=0.050, f0=210, th_tau=0.075, boom_tau=0.13, boom_amp=0.40, drive=1.7, tail=0.42, wet=0.32),
    ]
    for i, p in enumerate(pistol):
        save('shot-soft.wav' if i == 0 else f'shot-soft-{i + 1}.wav', firearm('pistol', i, 0.65, p), -2.0)
    shotgun = [
        dict(crack_hp=900, crack_tau=0.010, body=(140, 3200), body_tau=0.090, f0=150, th_tau=0.16, boom_tau=0.25, boom_amp=0.7, drive=2.2, tail=0.75, wet=0.38),
        dict(crack_hp=800, crack_tau=0.012, body=(120, 3000), body_tau=0.100, f0=140, th_tau=0.17, boom_tau=0.28, boom_amp=0.75, drive=2.3, tail=0.80, wet=0.40),
    ]
    for i, p in enumerate(shotgun):
        save('shotgun-shot.wav' if i == 0 else 'shotgun-shot-2.wav', firearm('shotgun', i, 1.0, p), -2.0)
    # clic à vide : chute de percuteur, deux temps
    r = rng_for('empty')
    n = int(0.14 * SR)
    x = np.zeros(n)
    tick = bp(white(r, n), 2000, 7000) * env(n, 0.003, 0.00005)
    ring = modal([1900, 3400, 5200], [0.02, 0.03, 0.015], [0.6, 0.5, 0.4], n, r)
    clack = modal([620], [0.01], [0.9], n, r)
    x += norm(tick + ring + clack)
    at(x, norm(bp(white(r, n), 2500, 8000) * env(n, 0.0025, 0.00005) + modal([2300], [0.012], [0.5], n, r)), 0.035, 0.45)
    save('empty-soft.wav', x, -6.0)


# ============================ impacts =========================================
def gen_impacts():
    # métal : ricochet, résonances inharmoniques
    for i, (fs, ds) in enumerate([
        ([1250, 2900, 4400, 6900], [0.12, 0.09, 0.07, 0.05]),
        ([1100, 2500, 4100, 6200], [0.15, 0.10, 0.08, 0.05]),
        ([1450, 3200, 4900, 7300], [0.10, 0.08, 0.06, 0.04])]):
        r = rng_for(f'metal{i}')
        n = int(0.45 * SR)
        ping = modal(fs, ds, [0.7, 0.6, 0.45, 0.3], n, r)
        slap = hp(white(r, n), 2000) * env(n, 0.003, 0.00005)
        zing = lp(thump(n, 5200, 2800, 0.05, 0.09, 0.4), 9000)
        low = thump(n, 420, 200, 0.02, 0.03, 0.5)
        x = norm(ping * 0.8 + slap * 0.9 + zing + low)
        save('impact-metal-soft.wav' if i == 0 else f'impact-metal-soft-{i + 1}.wav', x, -3.0)
    # bois : 22 050 Hz, < 10 ko (0,21 s)
    for i, (f0, kn) in enumerate([(190, [260, 410, 690]), (170, [240, 380, 640]), (210, [290, 450, 760])]):
        r = rng_for(f'wood{i}')
        n = int(0.21 * SR)
        th = thump(n, f0, 105, 0.025, 0.04, 1.0)
        knock = modal(kn, [0.07, 0.05, 0.035], [0.7, 0.5, 0.3], n, r)
        crack = bp(white(r, n), 900, 5500) * env(n, 0.008, 0.00005)
        spl = np.zeros(n)
        for _ in range(4):
            at(spl, modal([r.uniform(1800, 4200)], [0.004], [1.0], int(0.02 * SR), r), r.uniform(0.012, 0.07), r.uniform(0.2, 0.5))
        x = norm(th * 0.9 + knock * 0.8 + crack * 0.9 + spl)
        save('impact-wood-soft.wav' if i == 0 else f'impact-wood-soft-{i + 1}.wav', x, -4.0, sr=22050, fade_out=0.015)
    # pierre : claquement sec et poussière granuleuse
    for i, (tickf, f0) in enumerate([(2400, 140), (2100, 125), (2700, 155)]):
        r = rng_for(f'stone{i}')
        n = int(0.21 * SR)
        crack = hp(white(r, n), 1500) * env(n, 0.004, 0.00005)
        chip = modal([tickf, tickf * 1.55], [0.015, 0.012], [0.7, 0.5], n, r)
        th = thump(n, f0 * 1.6, f0, 0.02, 0.025, 0.9)
        dust = np.zeros(n)
        for _ in range(26):
            at(dust, bp(white(r, int(0.004 * SR)), 2500, 8000), r.uniform(0.01, 0.13), r.uniform(0.05, 0.3))
        x = norm(crack * 0.9 + chip * 0.7 + th + dust)
        save('impact-stone-soft.wav' if i == 0 else f'impact-stone-soft-{i + 1}.wav', x, -4.0, sr=22050, fade_out=0.015)
    # chair : choc mouillé
    for i, f0 in enumerate([125, 110, 140]):
        r = rng_for(f'flesh{i}')
        n = int(0.45 * SR)
        t = tt(n)
        th = thump(n, f0, 55, 0.03, 0.06, 1.0)
        body = lp(white(r, n), 700) * env(n, 0.05, 0.0005)
        squelch = bp(white(r, n), 400, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * r.uniform(60, 90) * t)) * env(n, 0.07, 0.002)
        skin = hp(white(r, n), 1500) * env(n, 0.005, 0.00005)
        bone = modal([900, 1500], [0.012, 0.008], [0.4, 0.25], n, r)
        x = norm(th * 0.6 + body * 0.8 + squelch * 0.9 + skin * 1.0 + bone * 1.5)
        save('impact-zombie-soft.wav' if i == 0 else f'impact-zombie-soft-{i + 1}.wav', x, -3.0)
    # hache sur chair : plus lourd
    r = rng_for('axeflesh')
    n = int(0.45 * SR)
    t = tt(n)
    x = norm(thump(n, 110, 42, 0.04, 0.12, 1.0) * 1.0
             + lp(white(r, n), 600) * env(n, 0.09, 0.0005) * 0.9
             + bp(white(r, n), 300, 1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 70 * t)) * env(n, 0.1, 0.002) * 0.6
             + hp(white(r, n), 1200) * env(n, 0.006, 0.00005) * 0.7
             + modal([700, 1100], [0.015, 0.01], [0.5, 0.4], n, r))
    save('axe-flesh.wav', sat(x, 1.4), -2.0)


# ============================ ennemis =========================================
def gen_enemies():
    # râle standard : voyelle « o » vers « a », pitch qui descend, grondement
    r = rng_for('groan')
    x = vocal(r, 1.9, lambda t: 96 * (1 - 0.22 * t / 1.9) + 3 * np.sin(2 * np.pi * 4.5 * t),
              vowel(500, 850, 2400), vowel(700, 1150, 2600), breath=0.3, growl=0.45, growl_hz=27,
              shape=swell(0.20, 0.7, 1.2), drive=1.8)
    save('zombie-groan-soft.wav', x, -4.0)
    # coureur : plus aigu, rauque, bref
    r = rng_for('runner')
    x = vocal(r, 1.0, lambda t: 128 + 55 * np.minimum(1, t / 0.35) - 25 * np.clip((t - 0.6) / 0.4, 0, 1),
              vowel(700, 1300, 2700), vowel(620, 1050, 2500), breath=0.45, growl=0.55, growl_hz=68, rasp=0.5,
              shape=swell(0.06, 0.35, 1.0), drive=2.4)
    save('zombie-runner.wav', x, -4.0)
    # cracheur : gargouillis liquide
    r = rng_for('spitter')
    n = int(1.5 * SR)
    t = tt(n)
    bubble = lp(white(r, n), 18)
    bubble = np.clip(bubble / (bubble.std() + 1e-12), 0, 2)
    x = vocal(r, 1.5, lambda tt_: 72 + 10 * np.sin(2 * np.pi * 6 * tt_), vowel(420, 800, 2200), vowel(380, 700, 2000),
              breath=0.5, growl=0.6, growl_hz=11, shape=swell(0.12, 0.5, 1.0), drive=2.0)
    wet = bp(white(r, n), 300, 1800) * bubble * env(n, 0.8, 0.01)
    save('spitter-gurgle.wav', norm(x * 0.8 + norm(wet) * 0.5), -4.0)
    # rampeuse : sifflement sibilant (le signal d'attaque doit traverser la musique)
    r = rng_for('hiss')
    n = int(0.75 * SR)
    t = tt(n)
    w = t / 0.75
    nz = white(r, n)
    body = bp(nz, 2500, 5500) * (1 - w) + bp(nz, 5000, 9500) * w * 0.8
    am = 1 - 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * 55 * t))
    whistle = np.sin(2 * np.pi * np.cumsum(1800 + 900 * w + 25 * np.sin(2 * np.pi * 6 * t)) / SR) * 0.12
    shape = np.minimum(1.0, t / 0.03) * np.clip((0.75 - t) / 0.25, 0, 1)
    save('crawler-hiss.wav', norm((norm(body) * am + whistle) * shape), -3.0)
    # blessure : grognement bref
    r = rng_for('hurtz')
    x = vocal(r, 0.4, lambda t: 112 - 25 * t / 0.4, vowel(700, 1100, 2500), vowel(600, 950, 2400),
              breath=0.4, growl=0.3, growl_hz=45, shape=swell(0.02, 0.18, 1.0), drive=2.0)
    save('zombie-hurt.wav', x, -4.0)
    # mort : râle qui retombe, puis chute
    r = rng_for('death')
    n = int(1.3 * SR)
    x = np.zeros(n)
    g = vocal(r, 0.75, lambda t: 105 - 45 * (t / 0.75) ** 1.3, vowel(650, 1050, 2500), vowel(420, 780, 2200),
              breath=0.5, growl=0.4, growl_hz=24, shape=swell(0.04, 0.4, 1.2), drive=1.8)
    at(x, g, 0.0, 0.8)
    at(x, thump(int(0.5 * SR), 100, 40, 0.05, 0.14, 1.0), 0.55, 0.9)
    at(x, bp(white(r, int(0.4 * SR)), 300, 2500) * env(int(0.4 * SR), 0.12, 0.003), 0.55, 0.35)
    save('zombie-death.wav', norm(x), -3.0)
    # relève : frottement, inspiration, râle montant
    r = rng_for('rise')
    n = int(1.1 * SR)
    t = tt(n)
    scrape = bp(white(r, n), 300, 2200) * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * t)) * np.clip(1 - t / 0.7, 0, 1)
    breath = bp(white(r, n), 400, 3000) * np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 1.5 * (t < 0.5)
    g = vocal(r, 0.6, lambda tq: 70 + 40 * tq / 0.6, vowel(450, 800, 2300), vowel(680, 1100, 2600),
              breath=0.3, growl=0.5, growl_hz=22, shape=swell(0.2, 0.2, 1.0), drive=1.9)
    x = np.zeros(n)
    x += norm(scrape) * 0.5 + norm(breath) * 0.45
    at(x, g, 0.5, 0.9)
    save('zombie-rise.wav', norm(x), -5.0)
    # crachat : départ et éclaboussure
    r = rng_for('spit')
    n = int(0.35 * SR)
    t = tt(n)
    x = bp(white(r, n), 500, 3200) * env(n, 0.05, 0.002) + 0.5 * lp(white(r, n), 1200) * env(n, 0.09, 0.005)
    x += 0.25 * np.sin(2 * np.pi * np.cumsum(900 + 1400 * t / 0.35) / SR) * env(n, 0.12, 0.01)
    save('spit-launch.wav', norm(x), -4.0)
    n = int(0.3 * SR)
    t = tt(n)
    x = bp(white(r, n), 300, 2500) * env(n, 0.06, 0.001) + thump(n, 130, 60, 0.03, 0.06, 0.8)
    x += 0.2 * hp(white(r, n), 4000) * (0.5 + 0.5 * np.sin(2 * np.pi * 200 * t)) * env(n, 0.15, 0.005)
    save('spit-impact.wav', norm(x), -4.0)


# ============================ Maître du Portrait ==============================
def gen_boss():
    r = rng_for('blade')
    n = int(0.45 * SR)
    t = tt(n)
    w = np.clip(t / 0.3, 0, 1)
    nz = white(r, n)
    x = (bp(nz, 1500, 3500) * (1 - w) + bp(nz, 4000, 9000) * w) * np.sin(np.pi * np.clip(t / 0.45, 0, 1)) ** 0.8
    x = norm(x) * 0.8 + modal([3200, 4900, 7100], [0.18, 0.13, 0.09], [0.3, 0.25, 0.2], n, r) * env(n, 0.2, 0.01)
    save('portrait-blade-launch.wav', norm(x), -4.0)
    n = int(0.25 * SR)
    x = hp(white(r, n), 3000) * env(n, 0.006, 0.00005) + thump(n, 190, 90, 0.02, 0.04, 0.9) + modal([2200, 3300], [0.04, 0.025], [0.4, 0.3], n, r)
    save('portrait-blade-impact.wav', norm(x), -4.0)


# ============================ joueur, objets, portes ==========================
def gen_player_and_world():
    # dégâts reçus : choc + grognement + souffle (3 variantes de timbre via la graine)
    for i, f in enumerate([115, 100]):
        r = rng_for(f'playerhurt{i}')
        n = int(0.55 * SR)
        x = np.zeros(n)
        at(x, thump(int(0.2 * SR), 95, 45, 0.03, 0.06, 1.0) + bp(white(r, int(0.2 * SR)), 300, 2500) * env(int(0.2 * SR), 0.03, 0.0005), 0.0, 0.9)
        v = vocal(r, 0.28, lambda t, f=f: f - 20 * t / 0.28, vowel(600, 1000, 2400), vowel(520, 900, 2300),
                  breath=0.35, growl=0.2, growl_hz=40, shape=swell(0.015, 0.14, 1.0), drive=1.8)
        at(x, v, 0.03, 0.8)
        at(x, bp(white(r, int(0.25 * SR)), 500, 3500) * np.sin(np.pi * np.linspace(0, 1, int(0.25 * SR))) ** 2, 0.25, 0.18)
        save('player-hurt.wav' if i == 0 else 'player-hurt-2.wav', norm(x), -4.0)
    # battement de cœur (faible vie)
    n = int(0.8 * SR)
    x = np.zeros(n)
    at(x, lp(thump(int(0.3 * SR), 70, 40, 0.05, 0.07, 1.0), 220), 0.0, 1.0)
    at(x, lp(thump(int(0.3 * SR), 62, 38, 0.05, 0.06, 1.0), 200), 0.29, 0.65)
    save('heartbeat.wav', x, -3.0)
    # ramassage : trousse de soins (froissement + carillon doux)
    r = rng_for('medkit')
    n = int(0.75 * SR)
    t = tt(n)
    rustle = bp(white(r, n), 1000, 5000) * (r.random(n) < 0.12) * env(n, 0.09, 0.002)
    rustle = lp(rustle, 6000)
    x = norm(rustle) * 0.6
    at(x, modal([784, 1568], [0.28, 0.14], [0.5, 0.15], int(0.5 * SR), r), 0.18, 0.55)
    at(x, modal([1046, 2092], [0.32, 0.16], [0.5, 0.15], int(0.5 * SR), r), 0.30, 0.55)
    save('pickup-medkit.wav', norm(x), -5.0)
    # ramassage : munitions (cliquetis de douilles)
    r = rng_for('ammo')
    n = int(0.5 * SR)
    x = np.zeros(n)
    for k in range(7):
        f = r.uniform(3000, 6200)
        at(x, modal([f, f * 1.7], [0.022, 0.015], [0.6, 0.3], int(0.08 * SR), r), r.uniform(0.0, 0.26), r.uniform(0.3, 0.8))
    at(x, thump(int(0.1 * SR), 150, 80, 0.015, 0.03, 0.7) + bp(white(r, int(0.1 * SR)), 200, 1800) * env(int(0.1 * SR), 0.02, 0.0005), 0.0, 0.8)
    save('pickup-ammo.wav', norm(x), -5.0)
    # ramassage : arme (culasse + cloche brève)
    r = rng_for('weapon')
    n = int(0.9 * SR)
    x = np.zeros(n)
    at(x, modal([700, 1400, 2800], [0.06, 0.05, 0.04], [0.8, 0.5, 0.3], int(0.25 * SR), r) + thump(int(0.25 * SR), 130, 70, 0.02, 0.05, 0.8), 0.0, 0.9)
    at(x, bp(white(r, int(0.05 * SR)), 2000, 7000) * env(int(0.05 * SR), 0.01, 0.00005), 0.0, 0.5)
    at(x, modal([660, 1320, 1990], [0.55, 0.3, 0.2], [0.5, 0.3, 0.15], int(0.7 * SR), r), 0.16, 0.45)
    save('pickup-weapon.wav', norm(x), -4.0)
    # porte : ouverture (gond) et fermeture (claquement)
    r = rng_for('door')
    n = int(1.1 * SR)
    t = tt(n)
    rate = 26 + 22 * (t / 1.1) + 6 * lp(white(r, n), 6) / 1.0
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0) * r.uniform(0.4, 1.0, n)
    creak = formant_bank(imp, [(300, 60, 1.0), (620, 90, 0.8), (1250, 150, 0.5), (2400, 300, 0.2)])
    creak = norm(creak) * np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 0.7
    x = creak * 0.9
    m = int(0.06 * SR)
    at(x, bp(white(r, m), 1500, 6000) * env(m, 0.006, 0.00005) + modal([1100], [0.02], [0.5], m, r), 0.0, 0.5)
    save('door-open.wav', norm(x), -5.0)
    n = int(0.7 * SR)
    x = np.zeros(n)
    at(x, thump(int(0.3 * SR), 95, 45, 0.04, 0.09, 1.0) + bp(white(r, int(0.3 * SR)), 150, 1500) * env(int(0.3 * SR), 0.07, 0.001) * 0.8, 0.0, 0.9)
    m = int(0.1 * SR)
    at(x, bp(white(r, m), 1500, 6500) * env(m, 0.006, 0.00005) + modal([1300, 2600], [0.03, 0.02], [0.5, 0.3], m, r), 0.11, 0.5)
    x += reverb(x, 0.4, 0.25, r)
    save('door-close.wav', norm(x), -3.0)
    # lampe : interrupteur
    r = rng_for('flash')
    n = int(0.12 * SR)
    x = np.zeros(n)
    for t0, g in ((0.0, 1.0), (0.034, 0.6)):
        at(x, modal([1200, 2500, 4100], [0.008, 0.006, 0.004], [0.7, 0.5, 0.3], int(0.05 * SR), r)
           + bp(white(r, int(0.05 * SR)), 1500, 7000) * env(int(0.05 * SR), 0.003, 0.00005), t0, g)
    save('flashlight-click.wav', norm(x), -8.0)
    # déverrouillage : tic discret
    n = int(0.1 * SR)
    x = modal([1800, 3600], [0.008, 0.005], [0.7, 0.3], n, r) + bp(white(r, n), 1500, 6000) * env(n, 0.004, 0.00005) * 0.5
    save('unlock-click.wav', norm(x), -10.0)


# ============================ ambiances ======================================
def periodic_noise(r, n, lo, hi, tilt=0.0):
    """Bruit exactement périodique sur n échantillons (filtrage circulaire dans le domaine fréquentiel)."""
    spec = np.fft.rfft(white(r, n))
    f = np.fft.rfftfreq(n, 1 / SR)
    mask = np.zeros_like(f)
    inside = (f >= lo) & (f <= hi)
    mask[inside] = (np.maximum(f[inside], 1.0) / lo) ** tilt
    edge = np.clip((f - lo * 0.7) / (lo * 0.3), 0, 1) * np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(spec * np.where(inside, mask, 0) * np.maximum(edge, inside), n)


def gen_ambience():
    # vent de nuit : 12 s, rafales et souffle grave, boucle exacte
    r = rng_for('wind')
    dur = 12.0
    n = int(dur * SR)
    t = tt(n)
    lo = periodic_noise(r, n, 25, 160, -0.3)
    mid = periodic_noise(r, n, 160, 900, -1.0)
    hi = periodic_noise(r, n, 900, 3500, -1.5)
    g1 = 0.55 + 0.45 * np.sin(2 * np.pi * 2 * t / dur) ** 2
    g2 = 0.35 + 0.65 * np.sin(2 * np.pi * 3 * t / dur + 1.0) ** 2
    g3 = 0.2 + 0.8 * np.sin(2 * np.pi * 5 * t / dur + 2.0) ** 4
    x = norm(lo) * g1 * 0.9 + norm(mid) * g2 * 0.6 + norm(hi) * g3 * 0.25
    howl = np.sin(2 * np.pi * np.cumsum(300 + 18 * np.sin(2 * np.pi * 3 * t / dur)) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 2 * t / dur + 0.5)) ** 6
    x += 0.04 * howl
    save('ambiance-soft.wav', x, -10.5, loop=True)
    # pluie : 9 s, bruit dense et gouttes, boucle exacte
    r = rng_for('rain')
    dur = 9.0
    n = int(dur * SR)
    base = norm(periodic_noise(r, n, 350, 9000, -0.5)) * 0.8
    rumble = norm(periodic_noise(r, n, 40, 300, -0.5)) * 0.25
    drops = np.zeros(n)
    templates = [bp(white(r, int(0.004 * SR)), r.uniform(2500, 5000), r.uniform(6000, 10000)) for _ in range(10)]
    for _ in range(int(dur * 420)):
        tpl = templates[r.integers(len(templates))] * r.uniform(0.1, 0.6) ** 1.5
        i = r.integers(n)
        idx = (i + np.arange(len(tpl))) % n
        drops[idx] += tpl
    x = base + rumble + norm(drops) * 0.45
    save('rain-soft.wav', x, -14.0, loop=True)
    # tonnerre : craquement puis roulement irrégulier (4,5 s)
    r = rng_for('thunder')
    n = int(4.5 * SR)
    x = np.zeros(n)
    crack = bp(white(r, int(0.5 * SR)), 800, 6000) * env(int(0.5 * SR), 0.05, 0.002)
    for _ in range(8):
        at(crack, hp(white(r, int(0.02 * SR)), 1500) * r.uniform(0.3, 1.0), r.uniform(0.0, 0.3))
    at(x, norm(crack), 0.0, 0.7)
    rumble = np.zeros(n)
    for k in range(7):
        t0 = 0.12 + k * r.uniform(0.25, 0.5)
        m = int(r.uniform(0.8, 1.6) * SR)
        rumble_seg = lp(white(r, m), r.uniform(80, 220)) * env(m, r.uniform(0.25, 0.6), 0.05)
        at(rumble, norm(rumble_seg), t0, r.uniform(0.3, 0.9) * (0.85 ** k))
    sub = thump(n, 55, 36, 1.5, 1.4, 0.5, attack=0.15)
    save('thunder-soft.wav', norm(x + norm(rumble) * 0.9 + sub * 0.5), -8.0, fade_out=0.3)
    # craquement du manoir : bois qui travaille (pulsations de glissement)
    r = rng_for('creak')
    dur = 1.3
    n = int(dur * SR)
    t = tt(n)
    rate = 22 + 16 * np.sin(np.pi * t / dur) + 5 * lp(white(r, n), 8) / 1.0
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0) * r.uniform(0.3, 1.0, n)
    y = formant_bank(imp, [(240, 50, 1.0), (520, 80, 0.8), (900, 120, 0.5), (1700, 250, 0.25)])
    y = norm(y) * np.sin(np.pi * t / dur) ** 1.4
    for _ in range(3):
        at(y, modal([r.uniform(600, 1400)], [0.01], [0.8], int(0.03 * SR), r), r.uniform(0.1, 1.1), r.uniform(0.15, 0.4))
    save('creak-soft.wav', norm(y), -9.0, fade_out=0.04)

"""
def gen_ammo():
    # ramassage de munitions : bruit blanc filtré grave/médium, « clac » sourd et légèrement métallique.
    # Aucun tintement aigu ni arpège (pas de son de bonus) ; deux claquements de chargeur et un cliquetis mat.
    r = rng_for('ammo4')
    n = int(0.5 * SR)
    x = np.zeros(n)

    def clac(f_body, bw, gain, ring):
        m = int(0.16 * SR)
        noise = bp(white(r, m), *bw, o=2) * env(m, 0.022, 0.0003)             # bruit médium : le corps du clac
        knock = thump(m, f_body * 1.7, f_body, 0.012, 0.03, 0.9)              # choc sourd
        metal = modal([ring, ring * 1.47, ring * 2.13], [0.018, 0.012, 0.008], [0.35, 0.22, 0.12], m, r)  # métal mat, court
        edge = hp(white(r, m), 2500) * env(m, 0.003, 0.00005) * 0.9         # attaque
        return lp(noise * 1.2 + knock * 0.7 + metal + edge, 8000) * gain

    at(x, clac(130, (300, 2600), 1.0, 780), 0.0)
    at(x, clac(160, (400, 3200), 0.75, 940), 0.085)
    for t0, gn in [(0.19, 0.42), (0.235, 0.32), (0.29, 0.22)]:                # cliquetis mats des douilles
        at(x, clac(r.uniform(170, 230), (400, 2400), gn, r.uniform(1100, 1500)), t0)
    x = sat(norm(x), 1.8)
    save('pickup-ammo.wav', x, -1.5, fade_out=0.06)
"""

def gen_ammo():
    """Ramassage de munitions : bruit blanc filtré grave/médium, « clac » sourd et légèrement métallique.
    Aucun tintement aigu ni arpège (pas de son de bonus) ; deux claquements de chargeur et un cliquetis mat."""
    r = rng_for('ammo4')
    n = int(0.5 * SR)
    x = np.zeros(n)

    def clac(f_body, bw, gain, ring):
        m = int(0.16 * SR)
        noise = bp(white(r, m), *bw, o=2) * env(m, 0.022, 0.0003)             # bruit médium : le corps du clac
        knock = thump(m, f_body * 1.7, f_body, 0.012, 0.03, 0.9)              # choc sourd
        metal = modal([ring, ring * 1.47, ring * 2.13], [0.018, 0.012, 0.008], [0.35, 0.22, 0.12], m, r)  # métal mat, court
        edge = hp(white(r, m), 2500) * env(m, 0.003, 0.00005) * 0.9         # attaque
        return lp(noise * 1.2 + knock * 0.7 + metal + edge, 8000) * gain

    at(x, clac(130, (300, 2600), 1.0, 780), 0.0)
    at(x, clac(160, (400, 3200), 0.75, 940), 0.085)
    for t0, gn in [(0.19, 0.42), (0.235, 0.32), (0.29, 0.22)]:                # cliquetis mats des douilles
        at(x, clac(r.uniform(170, 230), (400, 2400), gn, r.uniform(1100, 1500)), t0)
    x = sat(norm(x), 1.8)
    save('pickup-ammo.wav', x, -1.5, fade_out=0.06)

def gen_medkit():
    """Soupir de soulagement, caricatural comme les râles : inspiration, puis « haaah » soufflé qui retombe. Discret."""
    r = rng_for('sigh3')
    n = int(1.9 * SR)
    t = tt(n)
    x = np.zeros(n)
    # inspiration par le nez, courte et bruitée (voyelle « a » fermée)
    m = int(0.32 * SR)
    ins = bp(white(r, m), 500, 3500) * np.sin(np.pi * np.linspace(0, 1, m) ** 0.8) ** 1.6
    at(x, norm(ins), 0.0, 0.35)
    # expiration voisée : hauteur qui tombe, très soufflée, légère tremblote
    d = 1.45
    sig = vocal(r, d, lambda tq: 175 - 70 * (tq / d) ** 0.8 + 4 * np.sin(2 * np.pi * 5.5 * tq),
                vowel(780, 1250, 2600, bw=(120, 140, 220)), vowel(520, 900, 2400, bw=(110, 130, 220)),
                breath=1.6, growl=0.10, growl_hz=6.5, jitter=0.02, shape=swell(0.16, 0.85, 1.3), drive=1.2, bright=3500)
    at(x, sig, 0.34, 1.0)
    # souffle final qui s'éteint
    m2 = int(0.5 * SR)
    at(x, lp(white(r, m2), 3500) * np.exp(-np.linspace(0, 6, m2)) * 0.12, 1.55, 1.0)
    x = lp(x, 6000)
    save('pickup-medkit.wav', x, -7.5, fade_out=0.15)

if __name__ == '__main__':
    gen_firearms()
    gen_impacts()
    gen_enemies()
    gen_boss()
    gen_player_and_world()
    gen_ambience()
    gen_ammo()
    gen_medkit()
    print(f'{"fichier":28s} {"durée":>6s} {"Hz":>6s} {"octets":>8s}')
    for name, dur, sr, size in LOG:
        print(f'{name:28s} {dur:5.2f}s {sr:6d} {size:8d}')
