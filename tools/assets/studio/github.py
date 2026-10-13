"""Les assets récupérés sur GitHub : un jeu d'icônes de commerce, pour Litel.

Le studio sait tout dessiner — sauf un jeu d'icônes propre. Plutôt que d'inventer
un caddie approximatif, on va chercher des icônes **libres** dans les dépôts qui
les publient, servies par le CDN de jsDelivr au-dessus de leur GitHub :

  • **Lucide** (`lucide-icons/lucide`, licence ISC) — trait régulier, 24×24 ;
  • **Tabler** (`tabler/tabler-icons`, licence MIT) — même famille, formes un peu
    plus pleines ;
  • **OpenMoji** (`hfg-gmuend/openmoji`, CC BY-SA 4.0) — les mêmes objets en
    couleur, pour les cartons de produits.

Chaque fichier est rangé dans `assets/img/` avec sa **provenance** dans
`assets/img/github.json` : dépôt, chemin, URL exacte, licence, octets, sha256 —
comme les drapeaux. Rien n'est demandé au réseau au moment du film : ce sont des
fichiers du dépôt.

Deux retouches, écrites et assumées :

  • `currentColor` (la couleur d'encre du SVG, qui vaut noir hors navigateur)
    devient l'encre du projet ou l'or — sinon les icônes sortent en noir ;
  • le trait est épaissi (2 → 2,4) : à 40 px dans un film, un trait de 2 se perd.

Le manifeste garde les deux empreintes (celle du fichier servi et celle du
fichier rangé) pour qu'on puisse toujours recouper avec la source.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

#: Les dépôts et leur licence, tels qu'ils l'annoncent.
SOURCES = {
    "lucide": {"repo": "lucide-icons/lucide", "licence": "ISC (Lucide)",
               "licenceUrl": "https://cdn.jsdelivr.net/gh/lucide-icons/lucide@main/LICENSE"},
    "tabler": {"repo": "tabler/tabler-icons", "licence": "MIT (Tabler Icons)",
               "licenceUrl": "https://cdn.jsdelivr.net/gh/tabler/tabler-icons@main/LICENSE"},
    "openmoji": {"repo": "hfg-gmuend/openmoji",
                 "licence": "CC BY-SA 4.0 (OpenMoji) — attribution : OpenMoji.org",
                 "licenceUrl": "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/LICENSE.txt"},
}

#: Le CDN qui sert les dépôts GitHub, et la transformation appliquée au SVG.
JSDELIVR = "https://cdn.jsdelivr.net/gh/%s@main/%s"
JSDELIVR_MASTER = "https://cdn.jsdelivr.net/gh/%s@master/%s"
#: L'encre et l'or du projet : les deux couleurs qu'on donne aux `currentColor`.
INK = "#f6f3ea"
GOLD = "#f0b64a"

#: nom du fichier → (source, chemin dans le dépôt, code emoji, couleur, usage)
CATALOG = [
    ("cart", "lucide", "icons/shopping-cart.svg", None, INK, "caddie"),
    ("tag", "lucide", "icons/tag.svg", None, GOLD, "étiquette de prix"),
    ("truck", "lucide", "icons/truck.svg", None, INK, "camion de livraison"),
    ("package", "lucide", "icons/package.svg", None, GOLD, "colis"),
    ("store", "tabler", "icons/outline/building-store.svg", None, INK, "boutique"),
    ("basket", "tabler", "icons/outline/basket.svg", None, GOLD, "panier"),
    ("percent", "lucide", "icons/percent.svg", None, INK, "remise"),
    ("coins", "lucide", "icons/coins.svg", None, GOLD, "pièces"),
    ("emoji-cart", "openmoji", "color/72x72/1F6D2.png", "1F6D2", None, "caddie en couleur"),
    ("emoji-box", "openmoji", "color/72x72/1F4E6.png", "1F4E6", None, "colis en couleur"),
    ("emoji-truck", "openmoji", "color/72x72/1F69A.png", "1F69A", None, "camion en couleur"),
    ("emoji-tag", "openmoji", "color/72x72/1F3F7.png", "1F3F7", None, "étiquette en couleur"),
]


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()[:16]


def _url(source, path):
    repo = SOURCES[source]["repo"]
    return (JSDELIVR_MASTER if source == "openmoji" else JSDELIVR) % (repo, path)


def _download(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": "studio-films/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _size(raw, suffix):
    """Les dimensions du fichier : en-tête PNG, ou attributs du SVG."""
    if suffix == ".png":
        if len(raw) >= 24 and raw[:8] == b"\x89PNG\r\n\x1a\n":
            return int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big")
        return 0, 0
    head = raw[:600].decode("utf-8", "replace")
    import re
    w = re.search(r'width="([\d.]+)', head)
    h = re.search(r'height="([\d.]+)', head)
    if w and h:
        return int(float(w.group(1))), int(float(h.group(1)))
    box = re.search(r'viewBox="[\d.\- ]*?([\d.]+)[ ,]+([\d.]+)"', head)
    return (int(float(box.group(1))), int(float(box.group(2)))) if box else (0, 0)


def _tint(raw, color):
    """Donne une couleur d'encre au SVG et épaissit son trait.

    Un SVG de Lucide est tracé avec `stroke="currentColor"` : chargé comme image
    par un canvas, il sort noir. On remplace donc cette couleur par celle du
    projet, et on épaissit le trait pour qu'il tienne à petite taille.
    """
    text = raw.decode("utf-8")
    text = text.replace("currentColor", color)
    text = text.replace('stroke-width="2"', 'stroke-width="2.4"')
    return text.encode("utf-8")


def fetch(root, force=False, timeout=20, log=print):
    """Récupère les icônes sur GitHub (via jsDelivr). Rend `(entrées, problèmes)`."""
    out = Path(root) / "assets/img"
    out.mkdir(parents=True, exist_ok=True)
    entries, problems = [], []
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")

    for name, source, path, emoji, color, use in CATALOG:
        suffix = ".png" if path.endswith(".png") else ".svg"
        dest = out / ("icon-%s%s" % (name, suffix))
        url = _url(source, path)
        served, kept = None, False
        if dest.exists() and not force:
            kept = True
        else:
            try:
                served = _download(url, timeout)
            except (urllib.error.URLError, OSError, ValueError) as e:
                problems.append("%s (%s) : %s" % (name, source, e))
                log("  ✗ %-12s %-8s GitHub injoignable — %s" % (name, source, e))
                if dest.exists():
                    continue
                problems.append("%s : aucun fichier local" % name)
                continue
            if served[:8] == b"\x89PNG\r\n\x1a\n":
                dest.write_bytes(served)
            elif b"<svg" in served[:900]:          # les SVG de Lucide commencent par un commentaire
                dest.write_bytes(_tint(served, color or INK))
            else:
                problems.append("%s : réponse inattendue (%d octets)" % (name, len(served)))
                continue

        on_disk = dest.read_bytes()
        w, h = _size(on_disk, suffix)
        entries.append({
            "w": w, "h": h,
            "name": name, "kind": "github", "source": source,
            "repo": SOURCES[source]["repo"], "path": path,
            "url": url, "licence": SOURCES[source]["licence"],
            "licenceUrl": SOURCES[source]["licenceUrl"], "emoji": emoji,
            "file": "assets/img/%s" % dest.name, "use": use,
            "bytes": len(on_disk), "sha256": _sha(on_disk),
            "servedBytes": len(served) if served else len(on_disk),
            "servedSha256": _sha(served) if served else _sha(on_disk),
            "tinted": color if (served and suffix == ".svg") else None,
            "vector": suffix == ".svg",
            "origin": "garde" if kept else "téléchargé",
        })
        log("  %-11s %-12s %-32s %6.1f ko%s"
            % ("garde" if kept else "téléchargé", name, path, len(on_disk) / 1024.0,
               " (teinté %s)" % color if (served and suffix == ".svg") else ""))

    manifest = {
        "kind": "github", "source": JSDELIVR % ("<dépôt>@main", "<chemin>"),
        "sources": SOURCES, "generated": stamp, "items": entries,
    }
    (out / "github.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return entries, problems


def manifest(root):
    """Le manifeste des assets GitHub, ou `None` s'il n'a jamais été fabriqué."""
    try:
        with open(Path(root) / "assets/img/github.json", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def entries(root):
    """Les assets GitHub dont le fichier existe vraiment sur le disque."""
    man = manifest(root)
    if not man:
        return []
    out = []
    for it in man.get("items", []):
        path = Path(root) / it["file"]
        if path.exists():
            out.append({**it, "diskBytes": path.stat().st_size})
    return out


def raster(path):
    """Un asset relu comme une plaque (les PNG couleur, pour la planche de contact)."""
    import numpy as np
    from PIL import Image

    from .png import Raster
    im = Image.open(path).convert("RGBA")
    r = Raster(im.width, im.height)
    r.img[:, :] = np.asarray(im, dtype=np.uint8)
    return r


def describe(root):
    """Une ligne par asset, pour `generate.py list`."""
    return ["%-12s %-8s %-9s %s" % (it["name"], it["source"], it["licence"].split(" (")[0],
                                    it["url"].split("gh/")[-1])
            for it in entries(root)]
