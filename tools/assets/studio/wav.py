"""Lecture et écriture de WAV PCM 16 bits, via numpy.

Le studio n'écrit qu'un seul format — stéréo 16 bits entrelacé — parce que
c'est celui que décodent sans réfléchir tous les navigateurs, et parce qu'un
WAV bien formé est plus sûr qu'un MP3 selon l'humeur de `decodeAudioData`.
"""
from __future__ import annotations

import wave

import numpy as np


def write(path, chans, sr):
    """Écrit les canaux (tableaux de flottants en [-1,1]) dans un WAV 16 bits."""
    data = np.stack([np.asarray(c, dtype=float) for c in chans], axis=1)
    ints = np.clip(np.rint(data * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(ints.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(ints.tobytes())
    return path


def frames_of(path):
    """Relit un WAV : (fréquence, canaux, nombre d'échantillons par canal)."""
    with wave.open(str(path), "rb") as w:
        return w.getframerate(), w.getnchannels(), w.getnframes()


def read_int16(path):
    """Relit un WAV 16 bits : (fréquence, canaux, tableau numpy des trames)."""
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        assert w.getsampwidth() == 2, "seul le 16 bits est relu ici"
        raw = w.readframes(w.getnframes())
    data = np.frombuffer(raw, dtype="<i2").reshape(-1, ch)
    return sr, ch, data
