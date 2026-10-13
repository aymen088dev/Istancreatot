"""Le moteur de son du studio — numpy pour les signaux, scipy pour les filtres.

Les recettes de voix (`voices.py`) ne connaissent que cette interface : des
oscillateurs balayés, des bruits filtrés, de la FM, des cordes pincées, des
nappes, une ligne de retard, un master. Tout est calculé par blocs vectorisés,
donc une bande de 40 s se fabrique en une seconde ou deux au lieu d'une minute.

Le filtre qui balaie (le « whoosh ») est le seul traitement non vectorisable tel
quel : il est appliqué par tranches de 256 échantillons, avec l'état du filtre
reporté d'une tranche à l'autre — c'est exactement ce que fait un filtre
modulé, mais à la vitesse de scipy.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt

TAU = float(np.pi * 2)
SR = 32000                    # fréquence d'échantillonnage par défaut
WAVES = ("sine", "tri", "saw", "square")


# ------------------------------------------------------------------ fabriques
def _wave(kind, ph):
    """Une forme d'onde, à partir d'une phase en tours (0..1)."""
    x = ph - np.floor(ph)
    if kind == "sine":
        return np.sin(TAU * x)
    if kind == "tri":
        return 4.0 * np.abs(x - .5) - 1.0
    if kind == "saw":
        return 2.0 * x - 1.0
    if kind == "square":
        return np.where(x < .5, 1.0, -1.0)
    raise ValueError("forme d'onde inconnue : " + str(kind))


def _wins(dur, sr, attack, hold, release):
    n = max(4, int(dur * sr))
    a = max(1, int(attack * sr))
    hold = n if hold is None else max(a, min(int(hold * sr), n))
    r = max(1, n - hold) if release is None else max(1, int(release * sr))
    return n, a, hold, r


def _env(n, a, hold, r):
    """Attaque / tenue / chute, linéaires, en un seul tableau."""
    e = np.ones(n)
    e[:a] = np.linspace(0.0, 1.0, a)
    tail = n - hold
    if tail > 0:
        e[hold:] = np.linspace(1.0, 0.0, tail)
    return e


def _shape(s, amp):
    """Ramène la voix à l'amplitude demandée (crête exacte)."""
    peak = float(np.max(np.abs(s))) if s.size else 0.0
    return s * (amp / peak) if peak > 0 else s


def _sweep_filter(x, sr, f0, f1, kind="band", q=.9, block=1024):
    """Un bruit filtré dont la coupure balaie de f0 à f1.

    Traité par tranches : on redessine le filtre pour la coupure du moment et on
    reprend l'état là où la tranche précédente l'a laissé.
    """
    n = len(x)
    if n == 0:
        return x
    y = np.empty(n)
    zi = None
    ny = sr * .45
    for i in range(0, n, block):
        j = min(n, i + block)
        f = f0 + (f1 - f0) * ((i + block * .5) / max(1, n - 1))
        f = min(max(f, 25.0), ny)
        if kind == "low":
            sos = butter(2, f / ny, "low", output="sos")
        elif kind == "high":
            sos = butter(2, f / ny, "high", output="sos")
        else:
            lo = min(max(25.0, f / max(q, 1.0)), ny * .9)
            hi = min(max(lo * 1.4, f * max(q, 1.0)), ny)
            sos = butter(2, [lo / ny, hi / ny], "band", output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:j], zi = sosfilt(sos, x[i:j], zi=zi)
    return y


# ----------------------------------------------------------------- oscillations
def osc(sr, dur, f0, f1=None, wave="sine", amp=.1,
        attack=.01, hold=None, release=None, exp=False):
    """Un oscillateur, éventuellement balayé de f0 à f1 (exp=True : glissando)."""
    n, a, hold, r = _wins(dur, sr, attack, hold, release)
    f1 = f0 if f1 is None else f1
    if exp and f0 > 0 and f1 > 0:
        f = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    else:
        f = np.linspace(f0, f1, n)
    ph = np.cumsum(f) / sr
    return _shape(_wave(wave, ph) * _env(n, a, hold, r), amp)


def glide(sr, dur, f0, f1, wave="sine", amp=.1, attack=.01, hold=None,
          release=None, depth=None):
    """Comme osc, mais la fréquence glisse en courbe de puissance : c'est ce qui
    donne aux risers et aux whooshes leur « départ » puis leur chute."""
    n, a, hold, r = _wins(dur, sr, attack, hold, release)
    depth = 1.0 if depth is None else depth
    f = f0 + (f1 - f0) * (np.arange(n) / max(1, n - 1)) ** depth
    ph = np.cumsum(f) / sr
    return _shape(_wave(wave, ph) * _env(n, a, hold, r), amp)


def noise(sr, dur, amp=.1, f0=200.0, f1=200.0, kind="band",
          q=.9, attack=.01, hold=None, release=None, seed=0):
    """Un bruit filtré dont la coupure balaie : souffle, whoosh, foule, impact.

    kind : « low » (feutré), « high » (sifflant), « band » (l'air qui passe).
    """
    n, a, hold, r = _wins(dur, sr, attack, hold, release)
    rng = np.random.default_rng(seed)
    x = _sweep_filter(rng.standard_normal(n), sr, f0, f1, kind, q)
    return _shape(x * _env(n, a, hold, r), amp)


def fm(sr, dur, freq, ratio=2.5, index=700.0, amp=.1, decay=1.0, attack=.004):
    """Une voix de cloche : porteuse modulée, l'indice s'éteint en premier."""
    n = max(4, int(dur * sr))
    t = np.arange(n) / sr
    a = max(1, int(attack * sr))
    idx = index * np.exp(-3.2 * t / max(dur, 1e-6))
    ph = np.cumsum(freq + idx * np.sin(TAU * freq * ratio * t)) / sr
    env = np.empty(n)
    env[:a] = np.linspace(0.0, 1.0, a)
    env[a:] = np.exp(-(t[a:] - attack) / max(1e-4, decay))
    return _shape(np.sin(TAU * (ph - np.floor(ph))) * env, amp)


def pluck(sr, dur, freq, amp=.1, decay=1.6, attack=.003):
    """Une corde : fondamentale + octave, décroissance tenue."""
    n = max(4, int(dur * sr))
    t = np.arange(n) / sr
    a = max(1, int(attack * sr))
    s = _wave("tri", freq * t) + .35 * _wave("sine", freq * 2.01 * t)
    env = np.empty(n)
    env[:a] = np.linspace(0.0, 1.0, a)
    env[a:] = np.exp(-(t[a:] - attack) / max(1e-4, decay))
    return _shape(s * env, amp)


def sub(sr, dur, amp, f0=40.0, f1=28.0, attack=.02):
    """Le tapis grave : une tension qui descend, sans transitoire."""
    return glide(sr, dur, f0, f1, "sine", amp, attack=attack, release=dur * .5)


def pad(sr, dur, amp, root, bright=1.0, seed=0):
    """Une nappe : fondamentale, quinte, octave et dixième, chaque voix
    légèrement désaccordée, avec une respiration lente et un passe-bas."""
    n = max(4, int(dur * sr))
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    for k, (mult, share) in enumerate(((1.0, .5), (1.5, .26), (2.0, .16), (2.5, .08))):
        detune = 1.0 + rng.uniform(-.0035, .0035)
        out += osc(sr, dur, root * mult * detune, wave="tri" if k else "sine",
                   amp=share, attack=dur * .18, hold=dur * .7, release=dur * .3)
    t = np.arange(n) / sr
    out *= .82 + .18 * np.sin(TAU * t / max(1.0, dur * .7))       # respiration
    out = _shape(out, amp)
    ny = sr * .45
    sos = butter(1, min(2400 * bright, ny) / ny, "low", output="sos")
    return sosfilt(sos, out)


def crowd(sr, dur, amp, seed=3, density=.02):
    """Une foule : des milliers de petites impulsions, serrées dans une bande."""
    n, a, hold, r = _wins(dur, sr, 1.2, None, dur * .35)
    rng = np.random.default_rng(seed)
    imp = np.where(rng.random(n) < density, rng.standard_normal(n), 0.0)
    x = _sweep_filter(imp, sr, 900, 900, "band", 1.6)
    return _shape(x * _env(n, a, hold, r), amp)


# ------------------------------------------------------------------ traitements
def lowpass(src, sr, freq, poles=2, mix_amt=1.0):
    """Filtre passe-bas Butterworth, appliqué à une voix."""
    ny = sr * .45
    sos = butter(max(1, poles), min(freq, ny) / ny, "low", output="sos")
    out = sosfilt(sos, src)
    return out if mix_amt >= 1.0 else out * mix_amt + src * (1 - mix_amt)


def _comb(x, d, fb):
    """Écho à rétroaction : y[n] = x[n] + fb·y[n-d].

    Traité par tranches de d : chaque tranche réinjecte la précédente, ce qui
    donne exactement le même résultat qu'une récursion échantillon par
    échantillon, mais en quelques gestes vectorisés (et non en n·d opérations).
    """
    n = len(x)
    y = np.empty(n)
    for i in range(0, n, d):
        j = min(n, i + d)
        seg = x[i:j].astype(float, copy=True)
        if i > 0:
            seg += fb * y[i - d:j - d]
        y[i:j] = seg
    return y


def delay(chans, sr, time, feedback=.35, wet=.25):
    """Un espace simple : une ligne de retard à rétroaction, sur les deux canaux."""
    d = max(1, int(time * sr))
    for ci, ch in enumerate(chans):
        tail = _comb(ch, d, feedback)
        chans[ci] = ch + wet * np.concatenate([np.zeros(d), tail[:-d]])
    return chans


def mix(chans, src, at, gain=1.0, pan=0.0, sr=SR, fade=0.004):
    """Mélange une voix mono dans le stéréo, à l'échantillon `at`, avec un
    léger fondu aux deux extrémités pour éviter tout clic."""
    if src is None or len(src) == 0:
        return
    n = len(chans[0])
    start = int(at)
    i0 = max(0, start)
    i1 = min(n, start + len(src))
    if i1 <= i0:
        return
    seg = np.array(src[i0 - start:i1 - start], dtype=float)
    f = max(1, int(fade * sr))
    if i0 == start and len(seg) > f:
        seg[:f] *= np.linspace(0.0, 1.0, f)
    if i1 == start + len(src) and len(seg) > f:
        seg[-f:] *= np.linspace(1.0, 0.0, f)
    gl = gain * (1.0 - max(0.0, pan))
    gr = gain * (1.0 + min(0.0, pan))
    chans[0][i0:i1] += seg * gl
    chans[1][i0:i1] += seg * gr


def finish(chans, sr, peak=.9, fade=.006):
    """Master : crête ramenée à la cible, garde-fou, fondus aux extrémités."""
    top = float(max(np.max(np.abs(c)) for c in chans))
    k = (peak / top) if top > 0 else 1.0
    f = max(1, int(fade * sr))
    ramp = np.linspace(0.0, 1.0, f)
    for ci, ch in enumerate(chans):
        v = ch * k
        # garde-fou : si la somme dépasse malgré la normalisation, on arrondit
        hot = np.abs(v) > .98
        if hot.any():
            v = np.where(hot, v / (1.0 + np.abs(v) * .12), v)
        v[:f] *= ramp
        v[-f:] *= ramp[::-1]
        chans[ci] = v
    return k, top


def measure(chans, sr):
    """Crête, RMS, écrêtage et secondes creuses : de quoi se relire sans oreille."""
    st = np.stack([np.asarray(c, dtype=float) for c in chans])
    n = st.shape[1]
    a = np.abs(st)
    peak = float(a.max()) if st.size else 0.0
    clipped = int((a >= .999).sum())
    rms = float(np.sqrt(np.mean(st ** 2))) if st.size else 0.0
    whole = (n // sr) * sr
    if whole:
        per = np.sqrt(np.mean(st[:, :whole].reshape(len(chans), -1, sr) ** 2, axis=(0, 1)))
    else:
        per = np.array([rms])
    return {
        "seconds": n / sr,
        "peak": round(peak, 4),
        "rms": round(rms, 4),
        "clipped": clipped,
        "silentSeconds": int((per < .0005).sum()),
        "perSec": [round(float(v), 5) for v in per],
    }
