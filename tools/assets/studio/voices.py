"""Les voix du studio : à chaque nom de la partition, une recette.

Une recette reçoit la fréquence d'échantillonnage, les arguments du cue, la
durée du film et le rang du cue (pour que les notes successives montent au lieu
de se répéter), et rend un canal mono. Le mélange et le master s'occupent du
reste.

Ajouter un son à un futur film, c'est ajouter une recette ici et un cue dans
le film : `generate.py` signale tout nom qu'il ne connaît pas.
"""
from __future__ import annotations

import math

import numpy as np

from . import synth as S

#: Fondamentale de chaque nappe (le film passe l'indice : 0, 1, 2, 3…).
CHORDS = [82.41, 87.31, 110.00, 98.00, 130.81]
#: Pentatonique des cordes pincées.
NOTES = [523.25, 587.33, 698.46, 783.99, 880.00, 1046.50]


def _pad(sr, a, film, i):
    idx = int(a[0]) if a else 0
    dur = (int(a[1]) if len(a) > 1 else 6000) / 1000.0
    return S.pad(sr, dur, .55, CHORDS[idx % len(CHORDS)], 1.0, seed=idx + 1)


def _air(sr, a, film, i):
    # plus de plafond à 40 s : le souffle tient la durée du film, quel qu'il soit
    dur = film["total"] / 1000.0 + 1.0
    return S.noise(sr, dur, .09, 420, 560, "band", .7,
                   attack=dur * .12, hold=dur * .72, release=dur * .16, seed=7)


def _sub(sr, a, film, i):
    return S.sub(sr, 3.4, .4, 44, 30)


def _kick(sr, a, film, i):
    body = S.glide(sr, .5, 68, 34, "sine", .5, attack=.002, depth=.35)
    click = S.noise(sr, .12, .16, 900, 200, "low", 1.0, attack=.001, release=.1, seed=11)
    for k, v in enumerate(click):
        body[k] += v
    return body


def _riser(sr, a, film, i):
    n = S.noise(sr, 1.5, .3, 320, 3200, "band", 1.1, attack=.05, release=1.0, seed=13)
    t = S.glide(sr, 1.5, 180, 460, "tri", .16, attack=.05, release=1.0, depth=2.0)
    for k, v in enumerate(t):
        n[k] += v
    return n


def _whoosh(sr, a, film, i):
    return S.noise(sr, 1.15, .34, 200, 2400, "band", 1.6, attack=.02, release=.9, seed=17)


def _whooshDeep(sr, a, film, i):
    n = S.noise(sr, 1.6, .3, 120, 1400, "band", 1.2, attack=.03, release=1.2, seed=19)
    b = S.glide(sr, 1.6, 90, 40, "sine", .34, attack=.03, release=1.2, depth=.7)
    for k, v in enumerate(b):
        n[k] += v
    return n


def _whooshSoft(sr, a, film, i):
    return S.noise(sr, 1.4, .2, 260, 1600, "band", 1.3, attack=.08, release=1.0, seed=23)


def _impact(sr, a, film, i):
    out = S.glide(sr, .9, 74, 32, "sine", .55, attack=.002, release=.8, depth=.5)
    n = S.noise(sr, .7, .2, 500, 120, "low", 1.0, attack=.002, release=.6, seed=29)
    for k, v in enumerate(n):
        out[k] += v
    for mult in (1.0, 1.5, 2.0):
        for k, v in enumerate(S.osc(sr, .55, 174.61 * mult, wave="tri", amp=.1, attack=.01, release=.4)):
            if k < len(out):
                out[k] += v
    return S.lowpass(out, sr, 2600, 1)


def _impactSoft(sr, a, film, i):
    out = S.glide(sr, .5, 92, 46, "sine", .3, attack=.002, release=.4)
    n = S.noise(sr, .4, .14, 700, 200, "low", 1.0, attack=.002, release=.34, seed=31)
    for k, v in enumerate(n):
        out[k] += v
    return out


def _trace(sr, a, film, i):
    f = 1180 + (i % 4) * 90
    return S.osc(sr, .18, f, f * 1.7, "tri", .14, attack=.002, release=.16)


def _chordUp(sr, a, film, i):
    # quatre notes qui montent en arpège : la dernière donne la longueur totale
    span = int(2.6 * sr) + int(3 * .06 * sr)
    out = [0.0] * span
    for j, mult in enumerate((1.0, 1.5, 2.0, 3.0)):
        v = S.osc(sr, 2.6, 174.61 * mult, wave="tri", amp=.12, attack=.25, hold=1.6, release=1.0)
        off = int(j * .06 * sr)
        for k, s in enumerate(v):
            out[k + off] += s
    return out


def _sweep(sr, a, film, i):
    return S.noise(sr, 1.8, .2, 600, 4200, "band", 1.6, attack=.1, release=1.2, seed=37)


def _engine(sr, a, film, i):
    out = None
    for j, (f, w, share) in enumerate(((58, "sine", .5), (87, "saw", .2), (116.5, "saw", .18))):
        v = S.osc(sr, 10.4, f, wave=w, amp=share, attack=1.2, hold=8.0, release=2.4)
        if out is None:
            out = [0.0] * len(v)
        for k, s in enumerate(v):
            out[k] += s
    return S.lowpass(out, sr, 220, 2)


def _ignite(sr, a, film, i):
    n = S.noise(sr, .5, .22, 2600, 900, "high", 1.2, attack=.01, release=.4, seed=41)
    t = S.glide(sr, .5, 840, 1560, "sine", .24, attack=.01, release=.4, depth=.8)
    for k, v in enumerate(t):
        n[k] += v
    return n


def _chip(sr, a, film, i):
    n = S.noise(sr, .07, .12, 3200, 1800, "high", 1.0, attack=.001, release=.06, seed=43)
    t = S.glide(sr, .16, 1560, 2080, "sine", .2, attack=.002, release=.14)
    out = [0.0] * len(t)
    for k, v in enumerate(t):
        out[k] = v + (n[k] if k < len(n) else 0.0)
    return out


def _door(sr, a, film, i):
    out = S.glide(sr, .34, 118, 62, "sine", .32, attack=.002, release=.3)
    n = S.noise(sr, .2, .16, 420, 140, "low", .9, attack=.002, release=.18, seed=47)
    for k, v in enumerate(n):
        out[k] += v
    return out


def _coinTick(sr, a, film, i):
    f = 1960 + (i % 5) * 130
    return S.osc(sr, .1, f, f * 1.2, "tri", .16, attack=.001, release=.08)


def _coinLand(sr, a, film, i):
    out = S.osc(sr, .5, 1320, wave="sine", amp=.26, attack=.002, release=.46)
    n = S.noise(sr, .3, .18, 4200, 1200, "high", 1.4, attack=.002, release=.26, seed=53)
    for k, v in enumerate(n):
        out[k] += v
    return out


def _chime(sr, a, film, i):
    return S.fm(sr, 1.5, 1046.5, 2.5, 700, .34, decay=.42)


def _pluck(sr, a, film, i):
    f = NOTES[i % len(NOTES)]
    return S.pluck(sr, .9, f, .3, decay=.28)


def _blip(sr, a, film, i):
    return S.glide(sr, .12, 1240, 1560, "sine", .24, attack=.002, release=.1)


def _sparkle(sr, a, film, i):
    out = [0.0] * int(1.1 * sr)
    for j, f in enumerate((1568.0, 2093.0, 2637.0)):
        off = int(j * .07 * sr)
        v = S.osc(sr, .8, f, wave="sine", amp=.12, attack=.005, release=.7)
        for k, s in enumerate(v):
            if k + off < len(out):
                out[k + off] += s
    return out


def _shimmer(sr, a, film, i):
    out = [0.0] * int(2.2 * sr)
    for j, f in enumerate((1046.0, 1318.0, 1568.0, 2093.0)):
        off = int(j * .1 * sr)
        v = S.osc(sr, 1.5, f, wave="sine", amp=.1, attack=.2, hold=.9, release=.5)
        for k, s in enumerate(v):
            if k + off < len(out):
                out[k + off] += s
    return out


def _resolve(sr, a, film, i):
    out = S.osc(sr, 4.4, 87.31, wave="sine", amp=.34, attack=.35, hold=2.6, release=1.6)
    t = S.osc(sr, 4.4, 349.23, wave="tri", amp=.12, attack=.5, hold=2.4, release=1.8)
    for k, v in enumerate(t):
        out[k] += v
    return out


# ------------------------------------------------------- voix de l'autre film
def _crowd(sr, a, film, i):
    """Le lit de foule : il tient toute la durée du film.

    Il n'est plus coupé au bout de six secondes — un lit qui s'arrête au milieu
    du montage s'entend comme un trou, même sous les nappes. Il respire par
    vagues, avec une montée à chaque temps fort (le onze, le banc, le carton
    final), exprimée en fractions du film pour valoir pour tous les films.
    """
    total = film["total"] / 1000.0 + 1.0
    bed = S.crowd(sr, total, .16, seed=5, density=.014)
    n = len(bed)
    t = np.arange(n) / float(sr)
    swell = .62 + .38 * np.sin(2.0 * np.pi * t / max(5.0, total * .34)) ** 2
    for lo, hi, amp in ((.0, .07, .78), (.07, .70, .95), (.70, .90, 1.12), (.90, 1.0, .84)):
        bed[int(lo * n):int(hi * n)] *= amp
    return S.lowpass(bed * swell, sr, 2600, 1)


def _whistle(sr, a, film, i):
    a1 = S.osc(sr, .55, 1800, wave="sine", amp=.16, attack=.01, hold=.3, release=.2)
    a2 = S.osc(sr, .55, 1812, wave="sine", amp=.14, attack=.01, hold=.3, release=.2)
    for k, v in enumerate(a2):
        a1[k] += v
    return a1


def _tom(sr, a, film, i):
    return S.glide(sr, .35, 220, 110, "sine", .4, attack=.003, release=.3, depth=.6)


def _hush(sr, a, film, i):
    return S.noise(sr, 1.2, .22, 1800, 400, "band", 1.4, attack=.3, release=.8, seed=59)


def _stamp(sr, a, film, i):
    out = S.glide(sr, .45, 62, 30, "sine", .55, attack=.002, release=.4, depth=.5)
    n = S.noise(sr, .25, .22, 800, 200, "low", 1.0, attack=.002, release=.2, seed=61)
    for k, v in enumerate(n):
        out[k] += v
    for mult in (1.0, 1.5):
        for k, v in enumerate(S.osc(sr, .3, 293.66 * mult, wave="tri", amp=.12, attack=.005, release=.25)):
            if k < len(out):
                out[k] += v
    return out


def _rateTick(sr, a, film, i):
    return S.osc(sr, .08, 1400 + (i % 3) * 60, wave="tri", amp=.16, attack=.001, release=.06)


def _rateDing(sr, a, film, i):
    return S.fm(sr, 1.3, 1320, 3.0, 500, .3, decay=.35)


def _choir(sr, a, film, i):
    idx = int(a[0]) if a else 0
    dur = (int(a[1]) if len(a) > 1 else 5000) / 1000.0
    return S.pad(sr, dur, .5, CHORDS[idx % len(CHORDS)] * .5, 1.7, seed=idx + 9)


def _swell(sr, a, film, i):
    out = None
    for mult in (1.0, 1.5, 2.0, 2.5):
        v = S.osc(sr, 2.5, 130.81 * mult, wave="tri", amp=.14, attack=1.6, hold=1.4, release=1.0)
        if out is None:
            out = [0.0] * len(v)
        for k, s in enumerate(v):
            out[k] += s
    return out


def _jerseyDrop(sr, a, film, i):
    return S.noise(sr, .18, .24, 3000, 1200, "high", 1.1, attack=.002, release=.15, seed=67)


def _jerseyLand(sr, a, film, i):
    out = S.glide(sr, .28, 150, 80, "sine", .26, attack=.002, release=.24)
    n = S.noise(sr, .22, .2, 900, 300, "low", 1.0, attack=.002, release=.18, seed=71)
    for k, v in enumerate(n):
        out[k] += v
    return out


def _plateWipe(sr, a, film, i):
    return S.noise(sr, .45, .22, 300, 2500, "band", 1.5, attack=.02, release=.4, seed=73)


def _flagPop(sr, a, film, i):
    out = S.noise(sr, .12, .2, 2500, 900, "high", 1.0, attack=.001, release=.1, seed=79)
    t = S.glide(sr, .12, 900, 1400, "sine", .14, attack=.001, release=.1)
    for k, v in enumerate(t):
        out[k] += v
    return out


def _benchPop(sr, a, film, i):
    return S.pluck(sr, .4, 392.0 * (1 + (i % 5) * .0595), .26, decay=.12)


def _benchTick(sr, a, film, i):
    return S.osc(sr, .07, 2200, wave="sine", amp=.14, attack=.001, release=.06)


# ----------------------------------------------- voix d'habillage et de studio
def _crowdOhh(sr, a, film, i):
    """Une clameur de foule qui monte puis retombe (le « ohh » du stade)."""
    x = S.noise(sr, 1.9, .36, 260, 950, "band", 1.0, attack=.30, hold=.9, release=.75, seed=83)
    return S.lowpass(x, sr, 2300, 1)


def _squeak(sr, a, film, i):
    """Larsen du micro : deux sinus qui battent, plus un souffle aigu."""
    x = S.osc(sr, .55, 2200, 3400, wave="sine", amp=.2, attack=.01, release=.5)
    y = S.osc(sr, .55, 2240, 3450, wave="sine", amp=.16, attack=.01, release=.5)
    n = S.noise(sr, .5, .12, 3000, 4200, "high", 1.4, attack=.01, release=.45, seed=89)
    out = x + y
    out[:len(n)] += n
    return out


def _tada(sr, a, film, i):
    """Petite fanfare : trois notes qui montent, la dernière tenue."""
    out = None
    for j, (f, dur) in enumerate(((523.25, .5), (659.25, .5), (783.99, 1.4))):
        v = S.osc(sr, dur, f, wave="tri", amp=.22, attack=.01, hold=dur * .55, release=dur * .45)
        off = int(j * .18 * sr)
        if out is None:
            out = np.zeros(len(v) + off)
        else:
            out = np.pad(out, (0, max(0, off + len(v) - len(out))))
        out[off:off + len(v)] += v
    return out


def _micThud(sr, a, film, i):
    """Le micro qu'on lâche : un choc grave, sec, avec un rebond."""
    out = S.glide(sr, .32, 130, 48, "sine", .5, attack=.001, release=.28, depth=.5)
    n = S.noise(sr, .22, .3, 1400, 300, "low", .9, attack=.001, release=.18, seed=97)
    for k, v in enumerate(n):
        out[k] += v
    for k, v in enumerate(S.glide(sr, .18, 90, 44, "sine", .22, attack=.002, release=.16)):
        if k + int(.16 * sr) < len(out):
            out[k + int(.16 * sr)] += v
    return out


def _crowdGasp(sr, a, film, i):
    """Le « ahh » de stupeur du stade, plus bref et plus haut que la clameur."""
    return S.noise(sr, 1.1, .3, 520, 1300, "band", 1.2, attack=.12, hold=.45, release=.5, seed=101)


def _phoneBuzz(sr, a, film, i):
    """Le téléphone qui vibre sur la table du commentateur."""
    out = None
    for k in range(4):
        v = S.osc(sr, .07, 118, wave="square", amp=.22, attack=.004, release=.05)
        off = int(k * .12 * sr)
        if out is None:
            out = np.zeros(off + len(v))
        else:
            out = np.pad(out, (0, max(0, off + len(v) - len(out))))
        out[off:off + len(v)] += v
    return out


RECIPES = {
    "pad": _pad, "air": _air, "sub": _sub, "kick": _kick, "riser": _riser,
    "whoosh": _whoosh, "whooshDeep": _whooshDeep, "whooshSoft": _whooshSoft,
    "impact": _impact, "impactSoft": _impactSoft, "trace": _trace,
    "chordUp": _chordUp, "sweep": _sweep, "engine": _engine, "ignite": _ignite,
    "chip": _chip, "door": _door, "coinTick": _coinTick, "coinLand": _coinLand,
    "chime": _chime, "pluck": _pluck, "blip": _blip, "sparkle": _sparkle,
    "shimmer": _shimmer, "resolve": _resolve,
    "crowd": _crowd, "whistle": _whistle, "tom": _tom, "hush": _hush,
    "stamp": _stamp, "rateTick": _rateTick, "rateDing": _rateDing,
    "crowdOhh": _crowdOhh, "squeak": _squeak, "tada": _tada,
    "micThud": _micThud, "crowdGasp": _crowdGasp, "phoneBuzz": _phoneBuzz,
    "choir": _choir, "swell": _swell, "jerseyDrop": _jerseyDrop,
    "jerseyLand": _jerseyLand, "plateWipe": _plateWipe, "flagPop": _flagPop,
    "benchPop": _benchPop, "benchTick": _benchTick,
}

#: Où chaque famille se place dans l'image sonore (gauche…droite, -1..1).
PAN = {
    "pad": 0.0, "air": 0.0, "sub": 0.0, "crowd": 0.0, "engine": 0.0, "choir": 0.0,
    "pluck": -.45, "blip": .5, "shimmer": .35, "sparkle": .25, "trace": -.2,
    "chip": .3, "benchPop": .45, "benchTick": -.5, "coinTick": -.35, "rateTick": .4,
}

#: À quelle famille appartient chaque son : c'est ainsi que la banque d'assets
#: se range dans le grand panel (`assets/sfx/`), et c'est ce qui permet de
#: trouver « le whoosh un peu long » sans parcourir 46 noms au hasard.
FAMILIES = {
    "nappes & graves": ["pad", "air", "sub", "choir", "swell", "resolve"],
    "percussions & impacts": ["kick", "impact", "impactSoft", "tom", "stamp", "micThud"],
    "transitions & mouvements": ["riser", "whoosh", "whooshDeep", "whooshSoft",
                                 "sweep", "plateWipe", "jerseyDrop"],
    "cordes & cloches": ["pluck", "chime", "shimmer", "sparkle", "chordUp",
                         "coinLand", "rateDing", "door"],
    "interface": ["blip", "chip", "trace", "coinTick", "rateTick", "flagPop",
                  "benchTick", "benchPop", "jerseyLand"],
    "mécanique": ["engine", "ignite"],
    "stade & foule": ["crowd", "crowdOhh", "crowdGasp", "hush", "whistle"],
    "studio & micro": ["squeak", "tada", "phoneBuzz"],
}


#: Combien de variantes par son : les recettes qui lisent le rang du cue (`i`)
#: montent d'un cran à chaque fois. C'est ce qui donne à la banque 76 sons au
#: lieu de 46 — et au montage de quoi ne pas répéter le même « tick ».
VARIATIONS = {
    "pad": 5, "choir": 5, "pluck": 6, "blip": 3, "trace": 4,
    "coinTick": 5, "rateTick": 3, "benchPop": 5, "benchTick": 3,
}


def family_of(name):
    """La famille d'un son (et « divers » pour un nom qui n'est rangé nulle part)."""
    for fam, names in FAMILIES.items():
        if name in names:
            return fam
    return "divers"
