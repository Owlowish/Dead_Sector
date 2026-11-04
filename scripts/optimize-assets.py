#!/usr/bin/env python3
"""
DEAD SECTOR — Optimisation des textures lourdes pour affichage rétro
Redimensionne les textures surdimensionnées (1254², 1024x1536) aux dimensions
cohérentes avec la résolution rétro 427x300, réduisant drastiquement le temps de chargement
et l'occupation mémoire VRAM sans perte perceptible de qualité.
"""

import os
import sys
from PIL import Image

TASKS = [
    # Décor 3D du manoir (12 fichiers)
    ('public/assets/textures/mansion/bookshelf-front-v1.png', (512, 512)),
    ('public/assets/textures/mansion/carpet-damask-v1.png', (512, 512)),
    ('public/assets/textures/mansion/ceiling-coffer-v1.png', (512, 512)),
    ('public/assets/textures/mansion/door-panel-v1.png', (512, 1024)),
    ('public/assets/textures/mansion/hearth-brick-v1.png', (512, 512)),
    ('public/assets/textures/mansion/stone-ashlar-v1.png', (512, 512)),
    ('public/assets/textures/mansion/wood-structure-v1.png', (512, 512)),
    ('public/assets/textures/mansion/workbench-front-v1.png', (682, 512)),
    ('public/assets/textures/mansion/storm-exterior-v1.png', (512, 768)),
    ('public/assets/textures/portrait_v2.png', (384, 512)),
    ('public/assets/textures/mansion_wall_v2.png', (384, 768)),
    ('public/assets/textures/wood_floor_v2.png', (512, 512)),

    # Objets au sol et icônes d'améliorations (7 fichiers)
    ('public/assets/pickups/medkit.png', (256, 256)),
    ('public/assets/pickups/ammo.png', (256, 256)),
    ('public/assets/weapons/shotgun/ammo_pickup.png', (256, 256)),
    ('public/assets/sprites/upgrades/upgrade-ammo-pouch.png', (256, 256)),
    ('public/assets/sprites/upgrades/upgrade-light-boots.png', (256, 256)),
    ('public/assets/sprites/upgrades/upgrade-tight-choke.png', (256, 256)),
    ('public/assets/sprites/upgrades/upgrade-vitality-vial.png', (256, 256)),

    # Ennemi Cracheur / SpitterZombie (9 fichiers)
    ('public/assets/zombies/spitter/idle.png', (512, 768)),
    ('public/assets/zombies/spitter/walk-a.png', (512, 768)),
    ('public/assets/zombies/spitter/walk-b.png', (512, 768)),
    ('public/assets/zombies/spitter/windup.png', (512, 768)),
    ('public/assets/zombies/spitter/release.png', (512, 768)),
    ('public/assets/zombies/spitter/recovery.png', (512, 768)),
    ('public/assets/zombies/spitter/death-a.png', (512, 768)),
    ('public/assets/zombies/spitter/death.png', (512, 768)),
    ('public/assets/zombies/spitter/corpse.png', (512, 768)),
]

def optimize():
    total_orig = 0
    total_new = 0

    print(f"Optimisation de {len(TASKS)} textures...")
    for rel_path, target_size in TASKS:
        full_path = os.path.normpath(rel_path)
        if not os.path.exists(full_path):
            print(f"ATTENTION : fichier absent {full_path}")
            continue

        orig_size = os.path.getsize(full_path)
        total_orig += orig_size

        with Image.open(full_path) as img:
            # Rééchantillonnage de haute qualité Lanczos
            resized = img.resize(target_size, Image.LANCZOS)
            # Sauvegarde optimisée
            resized.save(full_path, format="PNG", optimize=True)

        new_size = os.path.getsize(full_path)
        total_new += new_size
        saving = (1 - (new_size / orig_size)) * 100
        print(f"  [OK] {rel_path} : {orig_size / 1024:.0f} Ko -> {new_size / 1024:.0f} Ko (-{saving:.1f}%)")

    saved_mb = (total_orig - total_new) / (1024 * 1024)
    print("\n--- BILAN D'OPTIMISATION ---")
    print(f"Taille avant : {total_orig / (1024 * 1024):.2f} Mo")
    print(f"Taille après : {total_new / (1024 * 1024):.2f} Mo")
    print(f"Économie disque / réseau : {saved_mb:.2f} Mo (-{(1 - total_new / total_orig) * 100:.1f}%)")

if __name__ == "__main__":
    optimize()
