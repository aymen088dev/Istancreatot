"""Le montage : d'une partition extraite d'un film, une bande-son.

On parcourt les cues dans l'ordre, on demande sa voix à chaque nom, on mélange
au bon échantillon avec un léger placement stéréo, on donne un peu d'espace,
puis le master ramène la crête à la cible. Chaque cue est en secondes exactes :
la bande est forcément synchrone avec le montage dont elle est issue.
"""
from __future__ import annotations

import numpy as np

from . import synth as S
from . import voices as V


def band(film, sr=S.SR, tail=.8, peak=.9, space=True):
    """Rend la bande du film : (canaux, notes de fabrication)."""
    seconds = film["total"] / 1000.0 + tail
    chans = [np.zeros(int(seconds * sr)), np.zeros(int(seconds * sr))]

    unknown = []
    for i, (ms, name, args) in enumerate(film["cues"]):
        fn = V.RECIPES.get(name)
        if fn is None:
            unknown.append(name)
            continue
        mono = fn(sr, args, film, i)
        if mono is None or len(mono) == 0:
            continue
        S.mix(chans, mono, int(ms / 1000.0 * sr), 1.0, V.PAN.get(name, 0.0), sr)

    if space:
        S.delay(chans, sr, .21, .26, .12)
    trim, raw = S.finish(chans, sr, peak)
    return chans, {
        "trim": round(trim, 4),
        "rawPeak": round(raw, 4),
        "unknownVoices": sorted(set(unknown)),
    }
