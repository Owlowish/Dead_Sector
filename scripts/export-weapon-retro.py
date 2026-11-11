"""Dérivés d'armes pour le rendu CSS, sans changer les sources ou les ancrages.

Python + Pillow, comme les autres exports du dépôt. --pilot exporte seulement
la garde du fusil et son retour de pompe ; sans option, exporte le lot complet.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs/asset-packs/PROVENANCE_ASSETS.json"
# Dimensions du précédent traitement canvas à 1920×1080, grille de trois pixels.
# Canevas complets, sans recadrage ; colonnes et lignes indivisibles conservées.
SPECS = [
    ("pistol_actions_v3.png", 585, 3, 3),
    ("modern_ads.png", 346, 1, 1),
    ("shotgun/hip-rest-v2.png", 288, 1, 1),
    ("shotgun/hip-back-v2.png", 288, 1, 1),
    ("shotgun/hip-kick-v2.png", 288, 1, 1),
    ("shotgun/ads_pump_v2.png", 836, 2, 1),
    ("shotgun/ads-kick-v2.png", 418, 1, 1),
    ("shotgun/reload_draft.png", 260, 1, 1),
    ("shotgun/live_shell.png", 62, 1, 1),
    ("shotgun/flash.png", 218, 2, 1),
]


def export(source_name, width, columns, rows):
    source = ROOT / "public/assets/weapons" / source_name
    destination = ROOT / "public/assets/weapons/retro" / source.name
    with Image.open(source) as raw:
        image = raw.convert("RGBA")
        height = math.floor(width * image.height / image.width + 0.5)
        assert width % columns == 0 and height % rows == 0
        output = image.resize((width, height), Image.Resampling.NEAREST)
        output.putalpha(output.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
        destination.parent.mkdir(parents=True, exist_ok=True)
        output.save(destination, optimize=True)
        return {
            "source": source.relative_to(ROOT).as_posix(),
            "export": destination.relative_to(ROOT).as_posix(),
            "sourceSize": list(image.size), "exportSize": list(output.size),
            "columns": columns, "rows": rows,
            "sourceBytes": source.stat().st_size, "exportBytes": destination.stat().st_size,
            "sourceRgba8Bytes": image.width * image.height * 4,
            "exportRgba8Bytes": width * height * 4,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "exportSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pilot", action="store_true")
    args = parser.parse_args()
    specs = SPECS[2:4] if args.pilot else SPECS
    assets = [export(*spec) for spec in specs]
    totals = {key: sum(a[key] for a in assets) for key in
              ["sourceBytes", "exportBytes", "sourceRgba8Bytes", "exportRgba8Bytes"]}
    if not args.pilot:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest["runtimeWeaponExports"] = {
            "updatedAt": "2026-11-11",
            "purpose": "Dérivés légers pistolet/fusil à la place du traitement canvas au démarrage et au redimensionnement.",
            "recipe": "python scripts/export-weapon-retro.py",
            "referenceViewport": [1920, 1080], "referencePixelSize": 3,
            "displayPolicy": "Résolution fixe : détails plus fins qu'avant à720p, sans rééchantillonnage au redimensionnement. Ancrages CSS inchangés ; conversion Pillow proche du Canvas mais non identique pixel à pixel.",
            "transformations": ["Canevas complet, même rapport d'aspect à l'arrondi du pixel", "Plus proche voisin", "Alpha binaire : alpha source >=128 devient255, sinon0"],
            "invariants": ["Sources intactes", "Aucun recadrage", "Cellules et ancrages CSS en pourcentages conservés", "Mêmes phases et recul de deux secondes", "Aucun nouveau prompt ni génération artistique"],
            "provenance": ["Prompts pistolet dans entries de ce document", "Prompts fusil dans PROMPTS_POMPE_AGILE.json ; source des poses de recul conservée dans IMPACTS_SURFACES.json"],
            "validation": {"files": "pending", "pilot": "pending", "browser": "pending"},
            "totals": totals, "assets": assets,
        }
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pilot": args.pilot, "totals": totals, "assets": assets}, ensure_ascii=False))


if __name__ == "__main__":
    main()
