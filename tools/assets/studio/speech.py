"""La voix du studio : un moteur vocal hors ligne, et sa mesure.

Jusqu'ici les films confiaient leurs répliques au moteur vocal du **navigateur**
(`speechSynthesis`). Ça a deux défauts de fond : la voix n'existe que si la
machine en a une (un serveur d'images, un navigateur sans pack de langue, un
téléphone en anglais n'en ont pas), et elle **change d'une machine à l'autre** —
la même phrase dure 2,8 s ici et 3,4 s ailleurs. Le débit d'un commentateur ne
peut donc pas être vérifié, et le montage se cale sur une voix qu'on n'entend
jamais au moment où on le fabrique.

Ici les répliques sont prononcées **une fois**, par piper — un moteur neuronal
qui tourne sur le processeur, sans réseau une fois le modèle téléchargé — et le
studio garde la voix sous forme de bande (`assets/voice/<film>.wav`), exactement
comme il garde la musique. Le montage et la bande vocale sortent alors de la
même mesure :

  • la **durée réelle** de chaque phrase (celle qu'on vient de prononcer, pas
    une estimation en mots par seconde) ;
  • le **débit** obtenu, en mots par seconde ;
  • le **poids de chaque mot**, donc l'instant où le sous-titre doit allumer le
    mot suivant.

Le film lit ce plan (`assets/voice/<film>.json`) et n'a plus rien à deviner.

Le modèle n'est pas dans le dépôt (63 Mo) : il se télécharge au premier usage
dans `tools/assets/models/`. `piper` s'installe avec
`python3 -m pip install -r tools/assets/requirements.txt`.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MODELS = HERE.parent / "models"          # là où tombent les modèles (hors dépôt)

#: La voix par défaut : un français masculin, « medium » — le timbre d'un
#: commentateur d'antenne. Le dépôt de voix est public et versionné.
VOICES = {
    "fr_FR-tom-medium": {
        "base": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/tom/medium/fr_FR-tom-medium",
        "size": 63_511_038,
        "label": "français · Tom (medium)",
    },
    "fr_FR-siwis-medium": {
        "base": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium",
        "size": 63_492_363,
        "label": "français · Siwis (medium)",
    },
}

#: Débit visé, en mots par seconde. Au-delà de 2,25 la vérification refuse une
#: réplique : c'est le plafond d'un commentaire lisible sur une musique.
MAX_RATE = 2.25

#: Silence conservé avant et après la phrase découpée, en secondes.
LEAD = .035
TAIL = .07

_VOWELS = "aàâäeéèêëiîïoôöuùûüyÿœæ"
_CACHE = {}


# ------------------------------------------------------------------ le modèle
def _fetch(url, path):
    """Télécharge `url` vers `path` (fichier temporaire puis renommage : un
    téléchargement interrompu ne laisse pas un modèle tronqué derrière lui)."""
    tmp = path.with_suffix(path.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "studio-assets/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
        while True:
            block = r.read(1 << 20)
            if not block:
                break
            f.write(block)
    tmp.replace(path)
    return path


def ensure(voice="fr_FR-tom-medium", log=print):
    """Le modèle est-il là ? Sinon on le télécharge, une fois pour toutes."""
    if voice not in VOICES:
        raise SystemExit("voix inconnue : %s (connues : %s)"
                         % (voice, ", ".join(sorted(VOICES))))
    spec = VOICES[voice]
    MODELS.mkdir(parents=True, exist_ok=True)
    onnx = MODELS / (voice + ".onnx")
    conf = MODELS / (voice + ".onnx.json")
    for path, suffix in ((onnx, ".onnx"), (conf, ".onnx.json")):
        if path.exists() and path.stat().st_size > 1024:
            continue
        log("  modèle : téléchargement de %s%s (une seule fois)…" % (voice, suffix))
        t0 = time.time()
        try:
            _fetch(spec["base"] + suffix, path)
        except Exception as e:                                  # réseau, 404, proxy…
            raise SystemExit(
                "impossible de récupérer la voix %s (%s)\n"
                "  - vérifier l'accès à huggingface.co, ou poser le modèle à la main dans %s\n"
                "  - le studio n'a pas besoin de réseau pour le reste : seul le modèle manque"
                % (voice, e, MODELS))
        log("    %s  %.1f Mo en %.0f s" % (path.name, path.stat().st_size / 1e6, time.time() - t0))
    return onnx


def loaded(voice="fr_FR-tom-medium", log=print):
    """Le modèle chargé en mémoire, une fois par processus (0,7 s au premier appel)."""
    if voice in _CACHE:
        return _CACHE[voice]
    onnx = ensure(voice, log)
    try:
        from piper import PiperVoice
    except ImportError:
        raise SystemExit(
            "piper n'est pas installé (c'est le moteur vocal du studio) :\n"
            "    python3 -m pip install -r tools/assets/requirements.txt")
    t0 = time.time()
    _CACHE[voice] = (PiperVoice.load(str(onnx)), time.time() - t0)
    return _CACHE[voice]


def available(voice="fr_FR-tom-medium"):
    """Le moteur est-il utilisable (installé, modèle présent) ? Sans réseau ni bruit."""
    try:
        import piper  # noqa: F401
    except ImportError:
        return False
    return (MODELS / (voice + ".onnx")).exists()


# --------------------------------------------------------------------- les mots
def syllables(word):
    """Le nombre de noyaux vocaliques d'un mot — son poids dans la phrase.

    C'est ce qui fait qu'« Istanoix » prend plus de temps que « et », et qu'un
    sous-titre ne s'allume pas sur le mauvais mot. Les groupes de voyelles
    comptent pour un ; un mot sans voyelle (une onomatopée, une initiale) en
    compte un quand même : tout mot prononcé dure quelque chose.
    """
    w = word.lower()
    n = 0
    prev = False
    for ch in w:
        v = ch in _VOWELS
        if v and not prev:
            n += 1
        prev = v
    return max(1, n)


def words_of(text):
    """Les mots d'une réplique, avec leur poids et leur part de la durée totale."""
    parts = [w for w in re.split(r"\s+", text.strip()) if w]
    weights = []
    for w in parts:
        weight = float(syllables(w))
        if w.endswith(("!", "?", "…")):      # une fin de phrase traîne un peu
            weight += .6
        if w.endswith((",", ";", ":")):      # une virgule, c'est une respiration
            weight += .35
        weights.append(weight)
    total = float(sum(weights)) or 1.0
    #: part de la durée de la phrase attribuée à chaque mot (cumulée à la fin)
    share = [w / total for w in weights]
    return [{"w": w, "weight": round(sh, 6)} for w, sh in zip(parts, share)]


# -------------------------------------------------------------------- le moteur
def _trim(x, sr, floor=.006):
    """Enlève le silence de tête et de queue : l'attaque de la phrase est un instant.

    Sans ça, la voix « commence » jusqu'à 150 ms avant qu'on entende quelque
    chose, et le sous-titre s'allume sur un silence.
    """
    if x.size == 0:
        return x, 0.0, 0.0
    a = np.abs(x)
    idx = np.flatnonzero(a > floor)
    if idx.size == 0:
        return x, 0.0, 0.0
    i0, i1 = int(idx[0]), int(idx[-1]) + 1
    head, tail = i0 / sr, (x.size - i1) / sr
    x = x[i0:i1]
    pad = int(LEAD * sr)
    end = int(TAIL * sr)
    return np.concatenate([np.zeros(pad, dtype=np.float32), x,
                           np.zeros(end, dtype=np.float32)]), head, tail


def _resample(x, src, dst):
    if src == dst:
        return x
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(int(src), int(dst))
    return resample_poly(x, dst // g, src // g).astype(np.float32)


class Speaker:
    """Une voix, un débit, une fréquence de sortie. `say()` rend la mesure."""

    def __init__(self, voice="fr_FR-tom-medium", sr=32000, scale=1.08, peak=.9,
                 volume=1.0, log=print):
        self.voice = voice
        self.sr = int(sr)
        self.scale = float(scale)
        self.peak = float(peak)
        self.volume = float(volume)
        self._log = log
        self._piper = None
        self.loaded = 0.0

    def _engine(self):
        if self._piper is None:
            self._piper, self.loaded = loaded(self.voice, self._log)
        return self._piper

    def say(self, text):
        """Prononce une réplique : (échantillons mono, plan).

        Le plan porte tout ce que le montage a besoin de savoir : la durée
        réelle, le débit obtenu, et le poids de chaque mot.
        """
        from piper import SynthesisConfig
        eng = self._engine()
        cfg = SynthesisConfig(length_scale=self.scale, volume=self.volume,
                              normalize_audio=True)
        blocks = [c.audio_float_array for c in eng.synthesize(text, syn_config=cfg)]
        if not blocks:
            raise SystemExit("la voix n'a rien produit pour : %r" % text)
        raw = np.concatenate([np.asarray(b, dtype=np.float32) for b in blocks])
        src_sr = eng.config.sample_rate
        x, head, tail = _trim(raw, src_sr)
        x = _resample(x, src_sr, self.sr)
        top = float(np.max(np.abs(x))) if x.size else 0.0
        if top > 0:
            x = x * (self.peak / top)
        seconds = x.size / self.sr
        words = words_of(text)
        return x, {
            "txt": text,
            "seconds": round(seconds, 4),
            "ms": int(round(seconds * 1000)),
            "words": words,
            "rate": round(len(words) / seconds, 3) if seconds else 0.0,
            "trimmedMs": [int(round(head * 1000)), int(round(tail * 1000))],
            "engineSr": src_sr,
        }


def plan_line(line, ms, words):
    """Le plan de sous-titres d'une réplique : où commence chaque mot.

    On répartit la durée mesurée selon le poids des mots — c'est ce qui fait
    qu'un sous-titre s'allume sur « Istanois » au moment où la voix le dit, et
    pas 200 ms avant ou après.
    """
    out = []
    at = 0.0
    for i, w in enumerate(words):
        span = ms * w["weight"]
        start = int(round(at))
        end = int(round(at + span)) if i < len(words) - 1 else ms
        out.append({"w": w["w"], "t0": start, "t1": max(end, start + 1)})
        at += span
    return out
