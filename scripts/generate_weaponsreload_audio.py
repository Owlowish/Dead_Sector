#!/usr/bin/env python3
"""DEAD SECTOR — sons de rechargement en WAV (fusil à pompe, révolver, cartouche).

Essai de génération avec Fable 5.2

Usage :  python scripts/generate_weaponsreload_audio.py
         (sortie : assets-src/sounds)
Dépendance : numpy uniquement.

Fichiers produits (mono, 16 bits, 44 100 Hz) :
  pump-back.wav      « Chhh-t ! »            glissement puis micro-clic
  pump-forward.wav   « KLANK ! »             bruit grave et sec + note triangle basse
  mag-out.wav        « Tlic... tling-tling » claquement puis 3 bips de douilles
  mag-in.wav         « Fft... tlic-tloc ! »  insertion étouffée puis double clic
  shell-insert.wav   « Fshhh »               glissement de la cartouche
  seat.wav           « -tk ! »               clic du ressort
  apercu_shell-insert_plus_seat.wav          les deux enchaînés (« Fshh-tk ! »), pour l'écoute seulement

RÈGLE : AUCUN SON AIGU. Rien n'est synthétisé au-dessus de F_MAX, et un filtre final coupe tout ce qui
dépasserait. Les « aigus » des descriptions sont donc transposés : « aigu » veut dire ici « le haut de la
bande autorisée ». Pour assombrir ou éclaircir l'ensemble, changer seulement F_MAX.

Chaque son est décrit par quelques constantes en tête de sa fonction (fréquences, durées, niveaux).
"""
import sys
import wave
from pathlib import Path

import numpy as np

DEST = Path(__file__).resolve().parents[1] / 'assets-src' / 'sounds'


SR = 44100          # fréquence d'échantillonnage
F_MAX = 5000.0      # plafond absolu des fréquences (Hz) : baisser pour un rendu encore plus sourd
PEAK_DB = -3.0      # niveau de crête des fichiers
SEED = 1987         # graine du bruit : même graine = mêmes fichiers


# ============================ briques de base =================================
def temps(duree):
    """Axe des temps (secondes) d'un son de la durée donnée."""
    return np.arange(int(round(duree * SR))) / SR


def bruit_bande(rng, n, f_bas, f_haut):
    """Bruit blanc filtré entre f_bas et f_haut (bords adoucis), jamais au-dessus de F_MAX. Écart-type 1."""
    f_haut = min(f_haut, F_MAX)
    spectre = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    l_bas = max(f_bas * 0.3, 20.0)                       # largeur du bord grave
    l_haut = max(f_haut * 0.15, 20.0)                    # largeur du bord aigu
    montee = np.clip((f - (f_bas - l_bas)) / l_bas, 0.0, 1.0)
    descente = np.clip((f_haut - f) / l_haut, 0.0, 1.0)
    masque = (0.5 - 0.5 * np.cos(np.pi * montee)) * (0.5 - 0.5 * np.cos(np.pi * descente))
    x = np.fft.irfft(spectre * masque, n)
    return x / (x.std() + 1e-12)


def carre(t, t0, freq):
    """Onde carrée démarrant à t0, limitée en bande : seuls les harmoniques sous F_MAX sont gardés."""
    x = np.zeros_like(t)
    k = 1
    while k * freq < F_MAX:
        x += np.sin(2 * np.pi * k * freq * (t - t0)) / k
        k += 2                                            # un carré n'a que des harmoniques impairs
    return np.where(t >= t0, x, 0.0)


def triangle(t, t0, freq):
    """Onde triangle démarrant à t0, limitée en bande (harmoniques impairs en 1/k², signes alternés)."""
    x = np.zeros_like(t)
    k, signe = 1, 1.0
    while k * freq < F_MAX:
        x += signe * np.sin(2 * np.pi * k * freq * (t - t0)) / (k * k)
        k += 2
        signe = -signe
    return np.where(t >= t0, x, 0.0)


def percussif(t, t0, tau, attaque=0.0008):
    """Enveloppe percussive : monte en « attaque » secondes à partir de t0, puis décroît (constante tau)."""
    dt = t - t0
    env = np.minimum(1.0, np.maximum(dt, 0.0) / attaque) * np.exp(-np.maximum(dt, 0.0) / tau)
    return np.where(dt >= 0.0, env, 0.0)


def fenetre(t, t0, t1, fondu_entree, fondu_sortie):
    """Enveloppe tenue de t0 à t1, avec une montée et une descente linéaires."""
    return np.clip((t - t0) / fondu_entree, 0.0, 1.0) * np.clip((t1 - t) / fondu_sortie, 0.0, 1.0)


def passe_bas_final(x):
    """Sécurité : supprime tout ce qui dépasserait F_MAX (pente douce jusqu'à 1,4 × F_MAX)."""
    n = len(x)
    spectre = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    pente = np.clip((1.4 * F_MAX - f) / (0.4 * F_MAX), 0.0, 1.0)
    return np.fft.irfft(spectre * (0.5 - 0.5 * np.cos(np.pi * pente)), n)


def finaliser(x):
    """Filtre final, courts fondus aux extrémités, suppression du continu, mise à niveau."""
    x = passe_bas_final(np.asarray(x, dtype=float))
    x = x - x.mean()
    k = int(0.004 * SR)
    x[:k] *= np.linspace(0.0, 1.0, k)
    x[-k:] *= np.linspace(1.0, 0.0, k)
    return x * (10 ** (PEAK_DB / 20.0) / (np.abs(x).max() + 1e-12))


def ecrire_wav(chemin, x):
    pcm = np.round(np.clip(x, -1.0, 1.0) * 32767).astype('<i2')
    with wave.open(str(chemin), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ============================ A — fusil à pompe ===============================
def pump_back(rng):
    """« Chhh-t ! » : rafale de bruit dont la hauteur descend légèrement, puis micro-clic métallique."""
    DUREE = 0.24
    T_GLISSE = 0.13                       # durée du glissement
    BANDE_DEBUT = (900.0, 2000.0)         # bruit au départ (haut de la bande autorisée)
    BANDE_FIN = (450.0, 1300.0)           # bruit à l'arrivée : la hauteur est descendue
    T_CLIC = 0.155                        # instant du clic
    F_CLIC = 1100.0                       # note carrée du clic
    t = temps(DUREE)
    n = len(t)
    # glissement : fondu enchaîné d'un bruit haut vers un bruit plus bas
    u = np.clip(t / T_GLISSE, 0.0, 1.0)
    glisse = bruit_bande(rng, n, *BANDE_DEBUT) * (1.0 - u) + bruit_bande(rng, n, *BANDE_FIN) * u
    glisse *= fenetre(t, 0.0, T_GLISSE, 0.006, 0.02) * (1.0 - 0.35 * u)
    # micro-clic : bruit très bref + carré bref
    clic = (bruit_bande(rng, n, 700.0, 1800.0) * percussif(t, T_CLIC, 0.004) * 1.2
            + carre(t, T_CLIC, F_CLIC) * percussif(t, T_CLIC, 0.008) * 0.6)
    return finaliser(glisse * 0.75 + clic)


def pump_forward(rng):
    """« KLANK ! » : bruit grave et sec, doublé d'une note triangle basse très courte (métal lourd)."""
    DUREE = 0.28
    T0 = 0.008                            # instant du choc
    BANDE_BRUIT = (70.0, 600.0)           # bruit grave
    TAU_BRUIT = 0.03                      # sec
    F_TRIANGLE = 82.0                     # note basse du triangle
    TAU_TRIANGLE = 0.065
    t = temps(DUREE)
    n = len(t)
    bruit = bruit_bande(rng, n, *BANDE_BRUIT) * percussif(t, T0, TAU_BRUIT, 0.001)
    note = triangle(t, T0, F_TRIANGLE) * percussif(t, T0, TAU_TRIANGLE, 0.002)
    return finaliser(bruit * 1.0 + note * 1.6)


# ============================ A — révolver ====================================
def mag_out(rng):
    """« Tlic... tling-tling » : claquement sec, puis trois micro-bips carrés (douilles au sol)."""
    DUREE = 0.32
    T_CLAC = 0.005
    BANDE_CLAC = (900.0, 2000.0)
    # (instant, fréquence du carré, niveau) : hauteurs dans le haut de la bande autorisée
    BIPS = [(0.085, 1500.0, 0.55), (0.135, 1850.0, 0.45), (0.180, 1650.0, 0.33)]
    TAU_BIP = 0.02
    t = temps(DUREE)
    n = len(t)
    x = bruit_bande(rng, n, *BANDE_CLAC) * percussif(t, T_CLAC, 0.005) * 1.1
    for t0, freq, niveau in BIPS:
        x = x + carre(t, t0, freq) * percussif(t, t0, TAU_BIP, 0.001) * niveau
    return finaliser(x)


def mag_in(rng):
    """« Fft... tlic-tloc ! » : insertion étouffée et rapide, puis double clic rapproché du barillet."""
    DUREE = 0.26
    T_INSERTION = 0.08                    # durée du « fff »
    BANDE_INSERTION = (250.0, 1100.0)     # bruit étouffé
    BANDE_CLIC = (500.0, 1600.0)
    # (instant, fréquence du carré « moyen », niveau)
    CLICS = [(0.115, 700.0, 1.0), (0.150, 520.0, 0.9)]      # tlic, puis tloc (plus grave)
    t = temps(DUREE)
    n = len(t)
    x = bruit_bande(rng, n, *BANDE_INSERTION) * fenetre(t, 0.0, T_INSERTION, 0.012, 0.012) * 0.55
    for t0, freq, niveau in CLICS:
        x = x + (bruit_bande(rng, n, *BANDE_CLIC) * percussif(t, t0, 0.005) * 1.0
                 + carre(t, t0, freq) * percussif(t, t0, 0.012) * 0.6) * niveau
    return finaliser(x)


# ============================ B — cartouche ===================================
def shell_insert(rng):
    """« Fshhh » : impulsion de bruit médium/grave avec un mini fondu d'entrée (cartouche poussée de force)."""
    DUREE = 0.15
    T_FIN = 0.11                          # fin du frottement
    BANDE = (200.0, 1200.0)
    FONDU_ENTREE = 0.01                   # le volume monte très vite
    t = temps(DUREE)
    n = len(t)
    u = np.clip(t / T_FIN, 0.0, 1.0)
    x = bruit_bande(rng, n, *BANDE) * fenetre(t, 0.0, T_FIN, FONDU_ENTREE, 0.02) * (0.7 + 0.3 * u)
    return finaliser(x)


def seat(rng):
    """« -tk ! » : pic ultra-court de bruit + note carrée rapide (clic du ressort)."""
    DUREE = 0.08
    T0 = 0.004
    BANDE = (800.0, 2000.0)               # haut de la bande autorisée
    F_CARRE = 1400.0
    t = temps(DUREE)
    n = len(t)
    x = (bruit_bande(rng, n, *BANDE) * percussif(t, T0, 0.0025, 0.0004) * 1.2
         + carre(t, T0, F_CARRE) * percussif(t, T0, 0.005, 0.0004) * 0.7)
    return finaliser(x)


# ============================ programme principal =============================
SONS = [
    ('pump-back', pump_back),
    ('pump-forward', pump_forward),
    ('mag-out', mag_out),
    ('mag-in', mag_in),
    ('shell-insert', shell_insert),
    ('seat', seat),
]


def main():
    sortie = DEST

    sortie.mkdir(parents=True, exist_ok=True)
    rendus = {}
    for i, (nom, fonction) in enumerate(SONS):
        x = fonction(np.random.default_rng(SEED + i))
        rendus[nom] = x
        ecrire_wav(sortie / f'{nom}.wav', x)
        print(f'{nom + ".wav":18s} {len(x) / SR:5.3f} s')
    # aperçu « Fshh-tk ! » : le glissement puis le clic, enchaînés
    #combine = np.concatenate([rendus['shell-insert'], rendus['seat']])
    #ecrire_wav(sortie / 'apercu_shell-insert_plus_seat.wav', combine)
    #print(f'apercu_shell-insert_plus_seat.wav  {len(combine) / SR:5.3f} s')
    print(f'Fichiers écrits dans : {sortie}')


if __name__ == '__main__':
    main()
