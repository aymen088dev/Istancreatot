"""Les drapeaux : les vrais, récupérés au CDN ; celui d'Istan, dessiné ici.

Les drapeaux des sélections étaient dessinés à la main dans chaque film — des
bandes, deux croix, quelques disques. Une vignette ronde de 90 px passe encore
pour la France ou l'Allemagne, mais l'Espagne y perd ses armoiries, l'Angleterre
n'est qu'une croix sans proportions, le Maroc une étoile approximative : ce n'est
plus un drapeau, c'est une évocation. Ils sont maintenant **récupérés au CDN**,
une fois, à la fabrication des assets :

    https://flagcdn.com/w320/<code>.png

Des PNG de domaine public, sans clé ni quota. Ils sont rangés dans
`assets/img/flag-<CODE>.png` — exactement le nom qu'attendent les films et le
panel — donc le film reste autonome : il lit un fichier du dépôt, comme le reste
de son habillage, et vieillit avec lui.

Le drapeau d'**Istan** est fictif : aucun CDN ne peut le servir. Il est donc
dessiné ici, à la même taille que les autres, pour que les films n'aient qu'un
seul chemin de code : `flag-<CODE>.png`. Dessiné **sobre** : un champ bleu
profond, la bande verte d'Istan à la hampe, un croissant et une étoile d'or.

La version précédente empilait trois bandes, un croissant, un aigle bicéphale et
une croix. Sur la planche, ça passait ; dans une pastille de 90 px de diamètre,
c'est-à-dire dans le carré central du drapeau recadré en rond, il ne restait
qu'un pâté : trop de signes, pas de hiérarchie, des couleurs qui se disputent.
Un drapeau se lit à trois mètres et reconnaît de loin — ici, deux couleurs et un
seul emblème, dont la taille est calée sur celle des vrais (le croissant fait
60 % de la hauteur, l'étoile un quart du croissant).

`assets/img/flags.json` garde, pour chaque drapeau, sa provenance : URL exacte,
licence, octets, sha256, dimensions. C'est ce qui permet de recouper l'image sur
le disque avec ce qui a été téléchargé — et de dire d'où vient chaque fichier.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

from .png import Raster

#: La source. Les codes sont ceux du CDN (`gb-eng` pour l'Angleterre, etc.).
CDN = "https://flagcdn.com/w%d/%s.png"
#: La largeur demandée. Les vignettes des films font au plus ~90 px de diamètre
#: dans un cadre de 1080 (le double sur un écran dense) : 320 laisse la marge
#: nécessaire au recadrage rond, pour ~1 ko par drapeau.
WIDTH = 320
#: La licence des drapeaux du CDN, telle qu'elle est annoncée par la source.
LICENCE = "Domaine public — drapeaux nationaux, flagcdn.com (aucune restriction)"

#: code du film → (nom, code CDN). Les codes courts sont ceux des effectifs.
CATALOG = [
    ("JP", "Japon", "jp"),
    ("TN", "Tunisie", "tn"),
    ("NO", "Norvège", "no"),
    ("DK", "Danemark", "dk"),
    ("DZ", "Algérie", "dz"),
    ("EG", "Égypte", "eg"),
    ("AF", "Afghanistan", "af"),
    ("NL", "Pays-Bas", "nl"),
    ("DE", "Allemagne", "de"),
    ("EN", "Angleterre", "gb-eng"),
    ("SC", "Écosse", "gb-sct"),
    ("PT", "Portugal", "pt"),
    ("ES", "Espagne", "es"),
    ("FR", "France", "fr"),
    ("IT", "Italie", "it"),
    ("IE", "Irlande", "ie"),
    ("BE", "Belgique", "be"),
    ("CI", "Côte d'Ivoire", "ci"),
    ("NG", "Nigéria", "ng"),
    ("PL", "Pologne", "pl"),
    ("ID", "Indonésie", "id"),
    ("AT", "Autriche", "at"),
    ("SE", "Suède", "se"),
    ("FI", "Finlande", "fi"),
    ("CH", "Suisse", "ch"),
    ("MA", "Maroc", "ma"),
    ("TR", "Turquie", "tr"),
    ("AR", "Argentine", "ar"),
    ("BR", "Brésil", "br"),
]

#: La nation des films. Fictive : dessinée, jamais téléchargée.
ISTAN = ("IS", "Istan")

#: Les couleurs d'Istan, une fois pour toutes.
ISTAN_COLORS = {
    "field": (16, 56, 107, 255),    # le bleu profond du champ
    "band": (22, 116, 74, 255),     # le vert d'Istan, à la hampe
    "gold": (238, 190, 74, 255),    # croissant et étoile
}

#: Le vert de la hampe est **hors** de la pastille : le recadrage rond des films
#: ne garde que le carré central (les deux tiers du milieu). Un drapeau se juge
#: donc d'abord sur ce carré — c'est là que vivent le croissant et l'étoile.


# ------------------------------------------------------------------ outils PNG
def _png_size(raw):
    """Les dimensions d'un PNG, lues dans son en-tête (IHDR)."""
    if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        return None
    w = int.from_bytes(raw[16:20], "big")
    h = int.from_bytes(raw[20:24], "big")
    return (w, h) if w and h else None


def _sha256(raw):
    return hashlib.sha256(raw).hexdigest()[:16]


def _download(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": "studio-films/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _down(r, factor=4):
    """Réduction par moyenne de blocs : l'anticrénelage des plaques dessinées.

    On dessine grand (1280×852) puis on moyenne par paquets de 4×4 ; les bords du
    croissant et de l'étoile sortent lisses, sans dépendre d'un lisseur — le
    balayage des polygones, lui, n'a pas d'anticrénelage.
    """
    h, w = r.h // factor * factor, r.w // factor * factor
    a = r.img[:h, :w].astype(np.float32)
    a = a.reshape(h // factor, factor, w // factor, factor, 4).mean(axis=(1, 3))
    out = Raster(w // factor, h // factor)
    out.img[:, :] = np.clip(a, 0, 255).astype(np.uint8)
    return out


# ------------------------------------------------------------- drapeau d'Istan
def _crescent(r, cx, cy, rad, color, cut=.38, thick=.92):
    """Un croissant : un disque, moins un disque décalé vers la droite."""
    x0, y0 = int(cx - rad) - 2, int(cy - rad) - 2
    x1, y1 = int(cx + rad) + 2, int(cy + rad) + 2
    xs = np.arange(max(0, x0), min(r.w, x1))[None, :] - cx
    ys = np.arange(max(0, y0), min(r.h, y1))[:, None] - cy
    d = np.hypot(xs, ys)
    off = rad * cut
    inner = np.hypot(xs - off, ys)
    a = (np.clip((rad - d) / 1.6 + .5, 0, 1)
         * np.clip((inner - rad * thick) / 1.6 + .5, 0, 1))
    r._paint(max(0, x0), max(0, y0), min(r.w, x1), min(r.h, y1), color, a)


def _star(r, cx, cy, rad, color, points=5, inner=.42, rot=-np.pi / 2):
    """Une étoile pleine, à `points` branches."""
    pts = []
    for i in range(points * 2):
        a = rot + i * np.pi / points
        rr = rad if i % 2 == 0 else rad * inner
        pts.append((cx + np.cos(a) * rr, cy + np.sin(a) * rr))
    r.poly(pts, color)


#: Le croissant d'Istan : son rayon, en fraction de la hauteur du drapeau.
#: .30 donne un croissant de 60 % de la hauteur — un peu plus grand que celui de
#: la Turquie (.50) ou de l'Azerbaïdjan (.55), parce qu'il doit tenir dans une
#: pastille de 90 px et non sur un mât.
ISTAN_R = .30


def istan(w=WIDTH, h=None):
    """Le drapeau d'Istan : champ bleu, bande verte à la hampe, croissant et étoile d'or."""
    w = int(w)
    h = int(h) if h else max(1, int(round(w * 2 / 3.0)))
    return _down(_istan_big(w * 4, h * 4), 4)


def _istan_big(w, h):
    """Le drapeau d'Istan, dessiné quatre fois grand (on le réduit ensuite).

    Tout est calé sur la hauteur `h`. Le croissant fait 2·R de haut ; son centre et
    celui de l'étoile sont posés pour que l'emblème **entier** soit centré — c'est
    lui que l'œil voit dans la pastille ronde, pas le centre du croissant. La bande
    verte, à la hampe, tombe hors du carré central : la pastille ne montre que le
    champ bleu et l'or.
    """
    col = ISTAN_COLORS
    r = Raster(w, h, col["field"])

    # la bande verte, à la hampe : un sixième de la largeur
    r.rect(0, 0, int(round(w / 6.0)), h, col["band"])

    R = h * ISTAN_R
    # l'emblème va du bord gauche du croissant (cx − R) à la pointe droite de
    # l'étoile (cx + 1,76·R) : son milieu doit tomber sur l'axe du drapeau
    cx, cy = w * .5 - R * .38, h * .5
    _crescent(r, cx, cy, R, col["gold"])
    _star(r, cx + R * 1.30, cy, R * .46, col["gold"], points=8, inner=.44, rot=0.0)
    return r


# ------------------------------------------------------------------ récupération
def fetch(root, force=False, timeout=20, log=print):
    """Récupère les drapeaux au CDN et dessine celui d'Istan.

    Rend `(entrées, problèmes)`. Un drapeau déjà présent n'est pas redemandé —
    `force=True` pour le rafraîchir.
    """
    out = Path(root) / "assets/img"
    out.mkdir(parents=True, exist_ok=True)
    entries, problems = [], []
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")

    for code, name, cdn in CATALOG:
        url = CDN % (WIDTH, cdn)
        path = out / ("flag-%s.png" % code)
        raw, origin = None, "garde"
        if path.exists() and not force and path.stat().st_size > 64:
            raw = path.read_bytes()
        else:
            try:
                raw = _download(url, timeout)
            except (urllib.error.URLError, OSError, ValueError) as e:
                problems.append("%s (%s) : %s" % (code, name, e))
                if path.exists():
                    raw = path.read_bytes()
                    origin = "garde (CDN injoignable)"
                else:
                    log("  ✗ %-3s %-14s CDN injoignable — %s" % (code, name, e))
                    continue
            else:
                if not raw[:8] == b"\x89PNG\r\n\x1a\n":
                    problems.append("%s (%s) : réponse qui n'est pas un PNG" % (code, name))
                    continue
                path.write_bytes(raw)
                origin = "téléchargé"
        size = _png_size(raw) or (0, 0)
        entries.append({
            "code": code, "name": name, "kind": "cdn", "cdn": cdn, "url": url,
            "licence": LICENCE, "bytes": len(raw), "sha256": _sha256(raw),
            "w": size[0], "h": size[1], "file": "assets/img/flag-%s.png" % code,
            "origin": origin,
        })
        log("  %-11s %-3s %-14s %4d×%-4d %6.1f ko" %
            (origin, code, name, size[0], size[1], len(raw) / 1024.0))

    # Istan : dessiné, à la même taille que les autres
    code, name = ISTAN
    path = out / ("flag-%s.png" % code)
    raster = istan(WIDTH, int(WIDTH * 2 / 3))
    raster.save(path)
    raw = path.read_bytes()
    entries.append({
        "code": code, "name": name, "kind": "dessiné", "cdn": None, "url": None,
        "licence": "Dessin original du studio (nation fictive)",
        "bytes": len(raw), "sha256": _sha256(raw),
        "w": raster.w, "h": raster.h, "file": "assets/img/flag-%s.png" % code,
        "origin": "dessiné",
    })
    log("  %-11s %-3s %-14s %4d×%-4d %6.1f ko" %
        ("dessiné", code, name, raster.w, raster.h, len(raw) / 1024.0))

    manifest = {
        "kind": "flags", "source": CDN % (WIDTH, "<code>"), "licence": LICENCE,
        "width": WIDTH, "generated": stamp, "flags": entries,
    }
    (out / "flags.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return entries, problems


# ------------------------------------------------------------------ relecture
def manifest(root):
    """Le manifeste des drapeaux, ou `None` s'il n'a jamais été fabriqué."""
    path = Path(root) / "assets/img/flags.json"
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def entries(root):
    """Les drapeaux du manifeste dont le fichier existe vraiment."""
    man = manifest(root)
    if not man:
        return []
    out = []
    for e in man.get("flags", []):
        path = Path(root) / e["file"]
        if path.exists():
            out.append({**e, "diskBytes": path.stat().st_size})
    return out


def raster(path):
    """Un drapeau relu comme une plaque (pour la planche de contact)."""
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    r = Raster(im.width, im.height)
    r.img[:, :] = np.asarray(im, dtype=np.uint8)
    return r


def codes(root):
    """Les codes disponibles : `{CODE: chemin du fichier}`."""
    return {e["code"]: e["file"] for e in entries(root)}


def describe(root):
    """Une ligne par drapeau, pour `generate.py list`."""
    out = []
    for e in entries(root):
        out.append("%-3s %-14s %-9s %s" % (
            e["code"], e["name"], e["kind"],
            (e["url"] or "dessiné par le studio")))
    return out
