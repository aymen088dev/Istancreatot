"""La bande vocale d'un film : les répliques prononcées, mesurées, posées.

Le montage d'un film déclare ses répliques (`const LINES`) : un instant, une
fenêtre, un texte. Ce module les prononce avec `speech.Speaker`, pose chaque
réplique **à son instant** sur une bande muette de la durée du film, et rend le
plan de ce qu'il vient de faire — durée réelle, débit, mot à mot.

Deux règles, et deux seulement :

  • une réplique ne doit pas empiéter sur la suivante : il reste toujours une
    respiration (`GAP`) entre la fin d'une phrase et le début de l'autre. Si la
    phrase est trop longue pour son budget, on resserre **son** débit (jamais
    au-delà de `MIN_SCALE`, un débit encore crédible) et on le dit dans le plan ;
  • si même resserrée elle ne tient pas, la réplique est marquée `overflow` —
    alors c'est le montage qui doit bouger, pas la voix qui doit bâcler. C'est
    `generate.py check` qui refuse une bande dont une réplique déborde.

La bande reste ainsi synchrone avec le film *par construction* : elle est
posée sur la même horloge que l'image, aux instants déclarés par le film.
"""
from __future__ import annotations

import numpy as np

from . import speech as SP

#: Respiration minimale entre deux répliques, en secondes.
GAP = .20
#: Marge de sécurité sous la fenêtre déclarée par le film, en secondes.
PAD = .25
#: Débit le plus resserré qu'on s'autorise pour tenir dans une fenêtre.
MIN_SCALE = .92
#: Queue de bande après le dernier carton, en secondes.
TAIL = .6


def budget_ms(lines, i, total, gap=GAP):
    """Le temps dont dispose la réplique `i` avant d'empiéter sur la suivante."""
    t = lines[i]["t"]
    if i + 1 < len(lines):
        return int(lines[i + 1]["t"] - t - gap * 1000)
    return int(total - t - gap * 1000)


def band(film, speaker, lines=None, gap=GAP, pad=PAD, min_scale=MIN_SCALE, log=print):
    """Rend la bande vocale du film : (échantillons mono, plan détaillé)."""
    lines = lines if lines is not None else film.get("lines", [])
    sr = speaker.sr
    total = film["total"]
    track = np.zeros(int((total / 1000.0 + TAIL) * sr), dtype=np.float32)

    plan = []
    overflow = []
    for i, L in enumerate(lines):
        budget = budget_ms(lines, i, total, gap)
        x, m = speaker.say(L["txt"])
        scale = speaker.scale
        # Le débit naturel ne tient pas : on resserre cette phrase-là, et seulement
        # ce qu'il faut. La relation débit/durée n'est pas exactement linéaire (et
        # la synthèse a sa petite variance), donc on remesure et on redemande —
        # au plus trois fois, puis c'est au montage de bouger, pas à la voix de bâcler.
        for _ in range(3):
            if m["ms"] <= budget:
                break
            want = max(min_scale, scale * budget / float(m["ms"]) * .97)
            if want >= scale - 1e-3:
                break
            tight = SP.Speaker(voice=speaker.voice, sr=sr, scale=want,
                               peak=speaker.peak, volume=speaker.volume, log=log)
            x2, m2 = tight.say(L["txt"])
            if m2["ms"] >= m["ms"]:
                break
            x, m, scale = x2, m2, want
        at = int(L["t"] / 1000.0 * sr)
        end = at + x.size
        if end > track.size:
            track = np.concatenate([track, np.zeros(end - track.size, dtype=np.float32)])
        track[at:end] += x

        words = SP.plan_line(L["txt"], m["ms"], m["words"])
        entry = {
            "i": i,
            "t": L["t"],
            # `d` est la durée à jouer pour cette réplique : c'est le seul champ que
            # le film lit (fenêtre du sous-titre et parole de la bascule Voix).
            "d": m["ms"],
            "window": L.get("d", 0),
            "ms": m["ms"],
            "endsAt": L["t"] + m["ms"],
            "nextAt": lines[i + 1]["t"] if i + 1 < len(lines) else total,
            "budget": budget,
            "slack": budget - m["ms"],
            "txt": L["txt"],
            "rate": m["rate"],
            "words": words,
            "scale": round(scale, 3),
            "retimed": abs(scale - speaker.scale) > 1e-3,
            "overflow": m["ms"] > budget,
        }
        if entry["overflow"]:
            overflow.append(i)
        plan.append(entry)
        log("    %2d  %6.2f s  %5.2f mot/s  marge %+5d ms%s  %s"
            % (i + 1, m["ms"] / 1000.0, m["rate"], entry["slack"],
               "  (débit %.2f)" % scale if entry["retimed"] else "",
               L["txt"][:44]))

    peak = float(np.max(np.abs(track))) if track.size else 0.0
    return track, {
        "lines": plan,
        "seconds": track.size / sr,
        "peak": round(peak, 4),
        "overflow": overflow,
        "gap": gap,
        "pad": pad,
    }


def to_16bit(track):
    """La bande vocale part au format `wav.write` : un seul canal, la voix."""
    return [np.asarray(track, dtype=float)]
