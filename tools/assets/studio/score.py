"""Le lien entre un film et le studio.

Le studio ne tient pas sa propre copie des partitions : il lit celle du film.
Ainsi une bande-son ne peut pas être en retard sur le montage — elle est
fabriquée à partir de lui, et l'outil enregistre dans le manifeste la partition
qu'il a réellement jouée, pour qu'on puisse vérifier plus tard que le fichier
posé à côté du film correspond toujours.

Le film déclare lui-même la bande qu'il attend :

    const ASSET = "assets/audio/nyxar-n3.wav";
    const TOTAL = 37000;
    const SCORE = [[0, "air"], [300, "sub"], …];

C'est ce contrat que ce module lit. Il lit aussi ses **répliques**
(`const LINES`) : la bande vocale du studio se fabrique à partir d'elles, et
c'est cette même mesure qui revient au film pour allumer ses sous-titres.
"""
from __future__ import annotations

import re

NUM = re.compile(r"^-?\d+(?:\.\d+)?$")


def _value(tok):
    tok = tok.strip()
    if NUM.match(tok):
        return float(tok) if "." in tok else int(tok)
    m = re.match(r'^"(.*)"$', tok)
    if m:
        return m.group(1)
    raise ValueError("valeur illisible dans la partition : %r" % tok)


def _split(body):
    """Découpe le corps d'un cue en respectant les chaînes entre guillemets."""
    out = []
    cur = ""
    quote = False
    for ch in body:
        if ch == '"':
            quote = not quote
            cur += ch
        elif ch == "," and not quote:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def read_film(path):
    """Rend {id, file, total, asset, cues} pour un film HTML."""
    with open(path, encoding="utf-8") as f:
        html = f.read()

    total = int(re.search(r"const TOTAL\s*=\s*(\d+)", html).group(1))
    asset = re.search(r'const ASSET\s*=\s*"([^"]+)"', html).group(1)
    name = re.search(r"<title>([^<]*)</title>", html).group(1).strip().split("—")[0].strip()

    block = re.search(r"const SCORE\s*=\s*\[(.*?)\n\s*\];", html, re.S)
    if not block:
        raise SystemExit("partition introuvable dans " + path)

    cues = []
    for body in re.findall(r"\[([^\[\]]*)\]", block.group(1)):
        vals = [_value(v) for v in _split(body)]
        cues.append((int(vals[0]), str(vals[1]), vals[2:]))
    cues.sort(key=lambda c: c[0])
    if not cues:
        raise SystemExit("partition vide dans " + path)

    return {
        "id": asset.rsplit("/", 1)[-1].rsplit(".", 1)[0],
        "file": path,
        "title": name,
        "total": total,
        "asset": asset,
        "cues": cues,
        "lines": read_lines(path),   # les répliques : c'est la bande vocale qui les suit
    }


LINE = re.compile(
    r"\{\s*t:\s*(\d+)\s*,\s*d:\s*(\d+)\s*,\s*txt:\s*\"((?:[^\"\\]|\\.)*)\"\s*\}")


def read_lines(path):
    """Les répliques d'un film : [{'t', 'd', 'txt'}] dans l'ordre du montage.

    Un film sans réplique (il n'y en a pas ici, mais la question se posera)
    rend une liste vide : le studio n'invente pas de texte.
    """
    with open(path, encoding="utf-8") as f:
        html = f.read()
    block = re.search(r"const LINES\s*=\s*\[(.*?)\n\s*\];", html, re.S)
    if not block:
        return []
    lines = []
    for m in LINE.finditer(block.group(1)):
        txt = m.group(3).replace('\\"', '"').replace("\\\\", "\\")
        lines.append({"t": int(m.group(1)), "d": int(m.group(2)), "txt": txt})
    lines.sort(key=lambda l: l["t"])
    return lines


def matches(cues, other):
    """Deux partitions sont-elles identiques (instants ET voix) ?"""
    if len(cues) != len(other):
        return False
    return all(a[0] == b[0] and a[1] == b[1] for a, b in zip(cues, other))
