"""Les plaques d'images du studio.

Ce que les films dessinent d'ordinaire à la main — dégradés de ciel, vignette,
trame de points, grain, drapeaux — se fabrique ici une fois pour toutes. Les
plaques sont petites (elles se redimensionnent dans le film) et reproductibles :
même graine, même image.

Chaque plaque est relisible en caractères dans le terminal : on juge un cadrage
sans écran.
"""
from __future__ import annotations

import math

import numpy as np

from .png import Raster

INK = (255, 255, 255, 255)


# --------------------------------------------------------------------- grain
def grain_tile(size=192, amount=30, seed=1):
    """Un grain monochrome à poser en recouvrement (mode « overlay »)."""
    r = Raster(size, size, (128, 128, 128, 255))
    r.grain(amount, seed, mono=True)
    return r


def dust_tile(size=256, count=26, seed=4):
    """Poussières et éraflures : de quoi vieillir une image sans la salir."""
    r = Raster(size, size, (0, 0, 0, 0))
    state = seed * 2654435761 & 0xFFFFFFFF

    def rnd():
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 4294967296.0

    for _ in range(count):
        x, y = int(rnd() * size), int(rnd() * size)
        long = rnd() < .3
        w, h = (int(rnd() * 40) + 14, 1) if long else (1, 1)
        r.rect(x, y, w, h, (255, 255, 255, 255), .12 + rnd() * .3)
    return r


# ------------------------------------------------------------------ vignette
def vignette(w, h, inner=.45, edge=210):
    """Un assombrissement radial : transparent au centre, opaque aux bords."""
    r = Raster(w, h, (0, 0, 0, 0))
    xs = np.arange(w)[None, :] - w / 2.0
    ys = np.arange(h)[:, None] - h / 2.0
    d = np.hypot(xs, ys) / math.hypot(w / 2.0, h / 2.0)
    t = np.clip((d - inner) / (1.0 - inner), 0.0, None)
    r.img[..., 3] = np.clip((t ** 1.7) * edge, 0, 255).astype(np.uint8)
    return r


# --------------------------------------------------------------------- ciels
def sky(w, h, top, bottom, sun=None, stars=0, seed=2, horizon=.72):
    """Un ciel : dégradé vertical, soleil bas éventuel, étoiles qui s'effacent."""
    r = Raster(w, h, (0, 0, 0, 255))
    r.gradient(tuple(top) + (255,), tuple(bottom) + (255,))
    rng = np.random.default_rng(seed)
    if stars:
        xs = rng.integers(0, w, stars)
        ys = rng.integers(0, max(1, int(h * horizon)), stars)
        rad = .7 + rng.random(stars) * 1.2
        for x, y, rr in zip(xs, ys, rad):
            r.disc(float(x - x % 2), float(y - y % 2), float(rr), INK, .6)
    if sun:
        sx, sy, rad, col = sun
        # halo : des disques de plus en plus larges et de plus en plus faibles,
        # pour que la lumière s'éteigne au lieu de baigner toute l'image
        for i in range(34, 0, -1):
            rr = rad * (1 + i * .30)
            r.disc(w * sx, h * sy, rr, col, rr * .4, a=.03)
        r.disc(w * sx, h * sy, rad, (col[0], col[1], min(255, col[2] + 40), 255), rad * .3, a=.85)
    return r


# -------------------------------------------------------------------- trames
def dots_tile(step=8, radius=1.35, size=64, color=(255, 255, 255, 255)):
    """La trame de points des cartes : un carreau qui se répète sans couture."""
    r = Raster(size, size, (0, 0, 0, 0))
    n = max(1, size // step)
    for gy in range(n):
        for gx in range(n):
            r.disc(gx * step + step / 2.0, gy * step + step / 2.0, radius, color, .7)
    return r


def scanlines_tile(h=4, dark=.22):
    """Des lignes sombres d'une pixel sur `h` : un soupçon d'écran."""
    r = Raster(4, h, (0, 0, 0, 0))
    r.rect(0, 0, 4, 1, (0, 0, 0, 255), dark)
    return r


# ---------------------------------------------------------------- drapeaux
# Les drapeaux ne sont plus dessinés ici : ceux des vraies nations sont des
# fichiers récupérés au CDN (module `flags`), et celui d'Istan, fictif, est
# dessiné là-bas aussi — à la même taille que les autres, pour que les films
# n'aient qu'un seul chemin de code. Voir `studio/flags.py`.


# ------------------------------------------------------------- matières & club
def turf(w=256, h=256, seed=12, stripes=10):
    """Une pelouse : bandes de tonte et grain, deux tons de vert."""
    r = Raster(w, h, (24, 68, 36, 255))
    for i in range(0, stripes, 2):
        r.rect(int(i * w / stripes), 0, int(w / stripes) + 1, h, (32, 88, 46, 255), .6)
    r.grain(14, seed, mono=False)
    return r


def stand(w=256, h=256, seed=21, dots=1400):
    """Une tribune : la foule réduite à des points colorés, posés d'un bloc numpy."""
    r = Raster(w, h, (10, 14, 22, 255))
    rng = np.random.default_rng(seed)
    xs = rng.integers(0, w, dots)
    ys = rng.integers(0, h, dots)
    cols = np.stack([rng.integers(70, 255, dots), rng.integers(70, 255, dots),
                     rng.integers(70, 255, dots)], -1)
    for dy in (0, 1, 2):
        yy = np.clip(ys + dy, 0, h - 1)
        r.img[yy, xs, :3] = cols
        r.img[yy, xs, 3] = 255
    r.grain(10, seed + 1, mono=False)
    return r


def hatch(w=64, h=64, step=7, a=.16):
    """Un hachurage diagonal : textile, maillage, ombre portée."""
    r = Raster(w, h, (0, 0, 0, 0))
    for x in range(-h, w + 1, step):
        r.line(x, 0, x + h, h, INK, 1.0, a)
    return r


#: Les trois clubs des films : deux couleurs, une forme d'écusson, une rayure.
CLUBS = {
    "astan": {"ink": (18, 38, 74, 255), "alt": (240, 182, 74, 255), "style": "chevron"},
    "axium": {"ink": (58, 32, 116, 255), "alt": (236, 66, 160, 255), "style": "band"},
    "nyxar": {"ink": (12, 30, 34, 255), "alt": (90, 214, 222, 255), "style": "chevron"},
}


def crest(club, w=168, h=186):
    """Un écusson de club : bouclier, chevron (ou bande) et pastille.

    Pas de texte : le studio n'a pas de police sous la main, et un écusson sans
    nom reste utile — c'est une forme d'habillage, pas un logo livré.
    """
    spec = CLUBS[club]
    ink, alt = spec["ink"], spec["alt"]
    r = Raster(w, h, (0, 0, 0, 0))

    def shield(k, col):
        r.poly([(w * (.05 + .02 * k), h * (.04 + .03 * k)),
                (w * (.95 - .02 * k), h * (.04 + .03 * k)),
                (w * (.95 - .02 * k), h * (.50 + .02 * k)),
                (w * .5, h * (.97 - .04 * k)),
                (w * (.05 + .02 * k), h * (.50 + .02 * k))], col)

    shield(0.0, alt)
    shield(1.7, ink)
    if spec["style"] == "chevron":
        r.poly([(w * .13, h * .38), (w * .50, h * .63), (w * .87, h * .38),
                (w * .87, h * .51), (w * .50, h * .76), (w * .13, h * .51)], alt)
    else:
        r.poly([(w * .37, h * .10), (w * .55, h * .10),
                (w * .73, h * .88), (w * .55, h * .88)], alt)
    r.disc(w * .5, h * .29, w * .12, alt, 1.4)
    r.ring(w * .5, h * .29, w * .16, 2.2, (255, 255, 255, 200))
    return r


#: Les couleurs de maillot des trois clubs (et le nombre de rayures).
KITS = {
    "astan": {"body": (22, 46, 92, 255), "trim": (240, 182, 74, 255), "stripe": 3},
    "axium": {"body": (74, 42, 150, 255), "trim": (236, 66, 160, 255), "stripe": 0},
    "nyxar": {"body": (14, 34, 40, 255), "trim": (90, 214, 222, 255), "stripe": 5},
}


def jersey(club, w=176, h=196):
    """Un maillot : torse, manches, col en V et les rayures du club."""
    spec = KITS[club]
    body, trim = spec["body"], spec["trim"]
    r = Raster(w, h, (0, 0, 0, 0))
    shirt = [(w * .34, h * .12), (w * .42, h * .07), (w * .58, h * .07), (w * .66, h * .12),
             (w * .97, h * .30), (w * .84, h * .45), (w * .74, h * .35), (w * .74, h * .95),
             (w * .26, h * .95), (w * .26, h * .35), (w * .16, h * .45), (w * .03, h * .30)]
    r.poly(shirt, body)
    n = spec["stripe"]
    if n:
        step = .48 / n
        for i in range(n):
            r.rect(int(w * (.26 + step * (i + .5))), int(h * .16),
                   max(2, int(w * step * .42)), int(h * .80), trim)
    r.poly([(w * .42, h * .07), (w * .58, h * .07), (w * .50, h * .22)], (250, 250, 245, 255))
    r.poly([(w * .03, h * .30), (w * .16, h * .45), (w * .11, h * .33)], trim)
    r.poly([(w * .97, h * .30), (w * .84, h * .45), (w * .89, h * .33)], trim)
    return r


def scoreboard(w=720, h=210):
    """Un bandeau de score : verre sombre, liseré d'or, deux cases, un filet cyan."""
    r = Raster(w, h, (0, 0, 0, 0))
    r.rect(0, 0, w, h, (9, 15, 24, 235))
    r.rect(0, 0, w, int(h * .12), (240, 182, 74, 255))
    r.rect(int(w * .04), int(h * .24), int(w * .42), int(h * .52), (19, 27, 42, 255))
    r.rect(int(w * .54), int(h * .24), int(w * .42), int(h * .52), (19, 27, 42, 255))
    for cx in (.25, .75):
        r.rect(int(w * cx) - 2, int(h * .30), 4, int(h * .40), (240, 182, 74, 200))
    r.rect(0, int(h * .90), w, int(h * .04), (90, 214, 222, 235))
    return r


#: Le catalogue : nom → fabrique. C'est ce que la ligne de commande parcourt.
PLATES = [
    ("grain-tile", lambda: grain_tile(), "grain monochrome à recouvrir, 192×192"),
    ("dust-tile", lambda: dust_tile(), "poussières et éraflures, 256×256"),
    ("vignette-16x9", lambda: vignette(640, 360), "assombrissement radial 16:9"),
    ("vignette-9x16", lambda: vignette(360, 640), "assombrissement radial 9:16"),
    ("sky-dawn", lambda: sky(640, 360, (14, 22, 52), (232, 154, 74),
                             sun=(.72, .80, 26, (255, 214, 150, 255)), stars=90, seed=2),
     "ciel d'aube horizontal"),
    ("sky-night", lambda: sky(360, 640, (6, 10, 26), (34, 58, 96),
                              sun=(.5, .88, 18, (170, 200, 255, 255)), stars=220, seed=6),
     "ciel de nuit vertical"),
    ("dots-tile", lambda: dots_tile(), "trame de points des cartes, 64×64"),
    ("scanlines-tile", lambda: scanlines_tile(), "lignes d'écran, 4×4"),
    ("hatch-tile", lambda: hatch(), "hachurage diagonal, 64×64"),
    ("turf-tile", lambda: turf(), "pelouse : bandes de tonte et grain, 256×256"),
    ("stand-tile", lambda: stand(), "tribune : la foule en points colorés, 256×256"),
    ("scoreboard", lambda: scoreboard(), "bandeau de score, verre et or, 720×210"),
]  + [("crest-" + c, (lambda cc: (lambda: crest(cc)))(c), "écusson " + c) for c in sorted(CLUBS)] \
  + [("kit-" + c, (lambda cc: (lambda: jersey(cc)))(c), "maillot " + c) for c in sorted(KITS)]


def contact_sheet(plates, cols=6, cell=132, pad=6):
    """Une planche de contrôle : toutes les plaques, à la même taille."""
    rows = (len(plates) + cols - 1) // cols
    sheet = Raster(cols * (cell + pad) + pad, rows * (cell + pad) + pad, (26, 30, 40, 255))
    for i, (_name, r) in enumerate(plates):
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + pad)
        # réduction au plus proche voisin, en un seul geste numpy
        ys = np.clip((np.arange(cell) * r.h / cell).astype(int), 0, r.h - 1)
        xs = np.clip((np.arange(cell) * r.w / cell).astype(int), 0, r.w - 1)
        tile = r.img[ys][:, xs]
        a = (tile[..., 3:4] / 255.0)
        box = sheet.img[cy:cy + cell, cx:cx + cell].astype(np.float32)
        col = tile[..., :3].astype(np.float32)
        out = box * (1 - a) + np.concatenate([col, np.full_like(a, 255.0)], axis=2) * a
        sheet.img[cy:cy + cell, cx:cx + cell] = np.clip(out, 0, 255).astype(np.uint8)
    return sheet
