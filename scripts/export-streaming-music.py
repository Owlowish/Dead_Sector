"""Export des raccords du Portrait : Python + NumPy + soundfile + imageio-ffmpeg (outils hors jeu).

Reproduit le fondu cosinus de 5 ms autrefois appliqué après decodeAudioData.
Sources V2 intactes ; durée, fréquence et canaux conservés.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import imageio_ffmpeg
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1]
exports = []
for stem in ('04_boss_phase1', '06_boss_phase2'):
    source = root / f'public/assets/music/{stem}_v2.ogg'
    target = root / f'public/assets/music/{stem}_stream.ogg'
    samples, rate = sf.read(source, dtype='float32', always_2d=True)
    frames = min(round(rate * .005), len(samples) // 2)
    gains = (1 - np.cos(np.pi * np.arange(frames) / frames)) / 2
    samples[:frames] *= gains[:, None]
    samples[-frames:] *= gains[::-1, None]
    encoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', str(samples.shape[1]), '-i', 'pipe:0', '-c:a', 'libvorbis', '-q:a', '5', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', '-f', 'ogg', 'pipe:1'], input=samples.astype('<f4').tobytes(), capture_output=True, check=True)
    target.write_bytes(encoded.stdout)
    actual, actual_rate = sf.read(target, dtype='float32', always_2d=True)
    assert actual_rate == rate and actual.shape == samples.shape
    seam = float(np.max(np.abs(actual[0] - actual[-1])))
    assert seam < 0.005, f'Raccord trop élevé : {seam}'
    exports.append({
        'sourceFile': source.relative_to(root).as_posix(),
        'exportFile': target.relative_to(root).as_posix(),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'sampleRate': rate, 'channels': actual.shape[1],
        'durationSeconds': len(actual) / rate, 'bytes': target.stat().st_size,
        'decodedSeamAmplitude': seam,
    })
manifest_path = root / 'docs/asset-packs/AUDIO_V2_2026-11-08.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['updatedAt'] = '2026-11-11'
manifest['technicalContract']['music'] = 'Ogg Vorbis mono 44,1 kHz. Sources V2 conservées ; dérivés streaming avec fondus cosinus de 5 ms exportés hors jeu, durée conservée. Aucun AudioBuffer musical long en mémoire JavaScript.'
manifest['validation']['loops'] = 'Ancien contrôle V2 en AudioBuffer : raccord nul après fondu. Le jeu utilise désormais les dérivés streaming décrits ci-dessous ; leurs raccords décodés sont mesurés séparément.'
manifest['streamingExports'] = {
    'date': '2026-11-11', 'script': 'scripts/export-streaming-music.py',
    'transform': 'Fondu cosinus de 5 ms aux deux bords, durée/canaux inchangés ; Vorbis qualité 5, flags bitexact et métadonnées retirées.',
    'tool': f'Python, NumPy {np.__version__}, soundfile {sf.__version__}, libsndfile {sf.__libsndfile_version__}, FFmpeg {imageio_ffmpeg.get_ffmpeg_version()}',
    'assets': exports,
    'validation': 'Durées et canaux identiques ; raccords décodés mesurés. Écoute non validée par cet export.',
}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(exports, ensure_ascii=False, indent=2))
