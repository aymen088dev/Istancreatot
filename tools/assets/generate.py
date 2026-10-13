#!/usr/bin/env python3
"""Le studio : générateur de sons, de voix et d'images pour les films.

    python3 tools/assets/generate.py list
    python3 tools/assets/generate.py audio            # les bandes des films du dépôt
    python3 tools/assets/generate.py audio nyxar-n3.html --sr 44100
    python3 tools/assets/generate.py voice            # les bandes vocales (piper)
    python3 tools/assets/generate.py sfx              # la banque de sons, jouable
    python3 tools/assets/generate.py images --ascii
    python3 tools/assets/generate.py panel            # le grand panel d'assets
    python3 tools/assets/generate.py check            # bandes, voix et images à jour ?
    python3 tools/assets/generate.py all

Les bandes sont écrites à l'endroit exact que le film réclame (son `const
ASSET`), et leur manifeste conserve la partition jouée — c'est ce qui permet de
vérifier plus tard qu'un film n'a pas changé depuis la fabrication de sa bande.
La bande **vocale** suit la même règle : les répliques du film (son `const
LINES`) sont prononcées ici, mesurées, puis posées sur une bande à part, et le
plan rendu au film porte la durée réelle de chaque phrase et de chaque mot.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

# Le studio s'appuie sur les bibliothèques du projet. Autant le dire clairement
# plutôt que d'échouer au milieu d'une bande.
_MISSING = []
for _mod in ("numpy", "scipy", "PIL"):
    try:
        __import__(_mod)
    except ImportError:
        _MISSING.append(_mod)
if _MISSING:
    raise SystemExit(
        "Bibliothèques manquantes : %s\n"
        "    python3 -m pip install -r tools/assets/requirements.txt\n"
        % ", ".join(_MISSING))

import numpy as np                      # noqa: E402

from studio import dialogue as D        # noqa: E402
from studio import flags as FL          # noqa: E402
from studio import github as GH         # noqa: E402
from studio import plates as P          # noqa: E402
from studio import render as R          # noqa: E402
from studio import score as SC          # noqa: E402
from studio import speech as SP         # noqa: E402
from studio import synth as S           # noqa: E402
from studio import voices as V          # noqa: E402
from studio import wav as W             # noqa: E402
from studio import panel as PANEL       # noqa: E402


def films_default():
    """Les films du dépôt : toute page qui déclare une bande (`const ASSET`)."""
    out = []
    for p in sorted(ROOT.glob("*.html")):
        try:
            f = SC.read_film(p)
        except (AttributeError, SystemExit, OSError):
            continue
        out.append(f)
    return out


def do_audio(args):
    films = [SC.read_film(ROOT / a) for a in args.films] if args.films else films_default()
    if not films:
        print("aucun film trouvé (une page qui déclare `const ASSET = …`)")
        return 1
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    for film in films:
        print("%s — %s, %d cues, %d ms"
              % (film["id"], film["title"], len(film["cues"]), film["total"]), flush=True)
        t0 = time.time()
        chans, notes = R.band(film, sr=args.sr, peak=args.peak)
        if notes["unknownVoices"]:
            print("  ! voix inconnue(s) : %s — ajoutez une recette dans studio/voices.py"
                  % ", ".join(notes["unknownVoices"]))
        out = ROOT / film["asset"]
        out.parent.mkdir(parents=True, exist_ok=True)
        W.write(out, chans, args.sr)
        m = S.measure(chans, args.sr)
        manifest = {
            "kind": "audio",
            "id": film["id"],
            "film": str(film["file"]),
            "title": film["title"],
            "asset": film["asset"],
            "sr": args.sr,
            "seconds": round(m["seconds"], 3),
            "filmMs": film["total"],
            "tail": round(m["seconds"] - film["total"] / 1000.0, 3),
            "cues": [[c[0], c[1]] for c in film["cues"]],
            "voices": sorted({c[1] for c in film["cues"]}),
            "bytes": out.stat().st_size,
            "peak": m["peak"],
            "rms": m["rms"],
            "clipped": m["clipped"],
            "silentSeconds": m["silentSeconds"],
            "trim": notes["trim"],
            "rawPeak": notes["rawPeak"],
            "unknownVoices": notes["unknownVoices"],
            "generated": stamp,
            "secondsToBuild": round(time.time() - t0, 1),
        }
        (out.with_suffix(".json")).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                                              encoding="utf-8")
        print("  → %s  %.2f Mo, %.1f s de son, crête %.3f, RMS %.4f, silence %d s, construit en %.1f s"
              % (film["asset"], manifest["bytes"] / 1e6, manifest["seconds"],
                 manifest["peak"], manifest["rms"], manifest["silentSeconds"],
                 manifest["secondsToBuild"]), flush=True)
    return 0


VOICE_DIR = "assets/voice"
SFX_DIR = "assets/sfx"


def do_voice(args):
    """La bande vocale des films : les répliques prononcées ici, une fois pour toutes.

    Le film n'attend plus une voix du navigateur (qui n'existe pas sur toutes les
    machines et ne dure pas le même temps selon l'OS) : il reçoit une bande et le
    plan qui va avec — durée réelle de chaque phrase, débit obtenu, instant de
    chaque mot. C'est ce plan que le film lit pour allumer ses sous-titres.
    """
    films = [SC.read_film(ROOT / a) for a in args.films] if args.films else films_default()
    films = [f for f in films if f.get("lines")]
    if not films:
        print("aucun film avec des répliques (une page qui déclare `const LINES`)")
        return 1
    if not SP.available(args.voice):
        print("le moteur vocal n'est pas installé : la bande vocale ne peut pas être fabriquée")
        print("    python3 -m pip install -r tools/assets/requirements.txt")
        return 1
    log = (lambda s="": print(s, flush=True)) if not args.quiet else (lambda s="": None)
    engine, load_s = SP.loaded(args.voice, log)
    print("voix : %s — moteur chargé en %.1f s" % (SP.VOICES[args.voice]["label"], load_s))
    sp = SP.Speaker(voice=args.voice, sr=args.sr, scale=args.scale, peak=args.peak, log=log)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    bad = 0
    for film in films:
        print("%s — %s, %d répliques" % (film["id"], film["title"], len(film["lines"])), flush=True)
        t0 = time.time()
        track, plan = D.band(film, sp, log=log)
        out = ROOT / VOICE_DIR / (film["id"] + ".wav")
        out.parent.mkdir(parents=True, exist_ok=True)
        W.write(out, D.to_16bit(track), args.sr)
        m = S.measure(D.to_16bit(track), args.sr)
        lines = plan["lines"]
        manifest = {
            "kind": "voice",
            "id": film["id"],
            "film": str(film["file"]),
            "title": film["title"],
            "asset": "%s/%s.wav" % (VOICE_DIR, film["id"]),
            "engine": {"name": "piper", "voice": args.voice,
                       "label": SP.VOICES[args.voice]["label"], "sr": args.sr,
                       "scale": args.scale, "peak": args.peak,
                       "gap": plan["gap"], "pad": plan["pad"]},
            "seconds": round(m["seconds"], 3),
            "filmMs": film["total"],
            "tail": round(m["seconds"] - film["total"] / 1000.0, 3),
            "speechMs": sum(l["ms"] for l in lines),
            "meanRate": round(sum(l["rate"] for l in lines) / max(1, len(lines)), 3),
            "retimed": [l["i"] for l in lines if l["retimed"]],
            "overflow": plan["overflow"],
            "lines": lines,
            "bytes": out.stat().st_size,
            "peak": m["peak"],
            "rms": m["rms"],
            "clipped": m["clipped"],
            "silentSeconds": m["silentSeconds"],
            "generated": stamp,
            "secondsToBuild": round(time.time() - t0, 1),
        }
        (out.with_suffix(".json")).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("  → %s\n    %.2f Mo, %.1f s de voix, %d répliques, %.2f mot/s en moyenne, "
              "crête %.2f, silence %d s, construit en %.1f s"
              % (manifest["asset"], manifest["bytes"] / 1e6, manifest["seconds"], len(lines),
                 manifest["meanRate"], manifest["peak"], manifest["silentSeconds"],
                 manifest["secondsToBuild"]), flush=True)
        if lines:
            tight = min(lines, key=lambda l: l["slack"])
            print("    marge la plus courte : réplique %d, %+d ms ; fenêtre du film %d ms "
                  "pour %d ms de voix"
                  % (tight["i"] + 1, tight["slack"], tight["window"], tight["ms"]), flush=True)
        if plan["overflow"]:
            bad += 1
            print("  ! réplique(s) qui débordent : %s — c'est le montage qui doit bouger"
                  % ", ".join(str(i + 1) for i in plan["overflow"]))
    return 1 if bad else 0


def do_sfx(args):
    """La banque de sons : chaque recette du studio, rendue seule et jouable.

    C'est ce que le grand panel donne à écouter. Une recette qui lit le rang du
    cue (les cordes, les pastilles, les ticks) rend ses variantes : le montage a
    de quoi ne pas répéter le même son deux fois de suite.
    """
    out = ROOT / args.dir
    out.mkdir(parents=True, exist_ok=True)
    stub = {"id": "banque", "file": ROOT, "title": "banque de sons",
            "total": args.total, "asset": "", "cues": [], "lines": []}
    items, familles = [], {}
    for name in sorted(V.RECIPES):
        fn = V.RECIPES[name]
        fam = V.family_of(name)
        count = int(V.VARIATIONS.get(name, 1))
        for v in range(count):
            chans = [np.asarray(fn(args.sr, [v], stub, v), dtype=float)]
            if chans[0].size == 0:
                print("  ! %s ne rend rien" % name)
                continue
            S.finish(chans, args.sr, args.peak)
            file = name + ("" if v == 0 else "-%d" % (v + 1)) + ".wav"
            path = out / file
            W.write(path, chans, args.sr)
            m = S.measure(chans, args.sr)
            items.append({
                "name": name, "variant": v + 1, "family": fam,
                "file": "%s/%s" % (args.dir, file),
                "seconds": round(m["seconds"], 3), "bytes": path.stat().st_size,
                "peak": m["peak"], "rms": m["rms"],
                "pan": V.PAN.get(name, 0.0),
            })
            familles[fam] = familles.get(fam, 0) + 1
    (out / "manifest.json").write_text(json.dumps(
        {"kind": "sfx", "dir": args.dir, "items": items, "familles": familles,
         "recipes": len(V.RECIPES), "sr": args.sr, "peak": args.peak,
         "generated": time.strftime("%Y-%m-%dT%H:%M:%S")},
        indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for fam, n in sorted(familles.items()):
        print("  %-26s %2d sons" % (fam, n))
    total = sum(i["bytes"] for i in items)
    print("  → %d fichiers dans %s (%.1f Mo, %.1f s de son)"
          % (len(items), args.dir, total / 1e6, sum(i["seconds"] for i in items)))
    return 0


def do_panel(args):
    """Le grand panel : la page qui donne à voir et à écouter tout le studio."""
    films = [SC.read_film(ROOT / a) for a in args.films] if args.films else films_default()
    html, cat = PANEL.build(ROOT, films)
    page_path = ROOT / args.out
    page_path.parent.mkdir(parents=True, exist_ok=True)
    page_path.write_text(html, encoding="utf-8")
    cat_path = page_path.parent / "catalog.json"
    cat_path.write_text(json.dumps({**cat, "page": args.out}, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    print("  → %s  %.0f Ko" % (args.out, page_path.stat().st_size / 1024))
    print("  → %s  %.0f Ko" % (cat_path.relative_to(ROOT), cat_path.stat().st_size / 1024))
    return 0


def do_images(args):
    """Les plaques dessinées **et** les drapeaux récupérés, dans un seul catalogue.

    Les drapeaux viennent de `studio/flags.py` : des PNG du CDN (ou le drapeau
    fictif d'Istan, dessiné là-bas). Ils entrent dans la même liste que les
    plaques pour que le panel et la planche de contact n'aient qu'un chemin.
    """
    out = ROOT / args.dir
    out.mkdir(parents=True, exist_ok=True)
    made = []
    plates = []

    # les plaques dessinées par le studio (matières, écussons, maillots…)
    for name, make, use in P.PLATES:
        r = make()
        plates.append((name, r))
        path = out / (name + ".png")
        r.save(path)
        st = r.stats()
        made.append({"name": name, "file": "%s/%s.png" % (args.dir, name), "use": use,
                     "bytes": path.stat().st_size, **st})
        print("  %-18s %4d×%-4d %6.1f ko  luma %.3f" %
              (name, st["w"], st["h"], path.stat().st_size / 1024, st["meanLuma"]), flush=True)

    # les drapeaux : récupérés au CDN (ou dessinés ici, pour Istan)
    for e in FL.entries(ROOT):
        origin = "CDN flagcdn.com" if e["kind"] == "cdn" else "dessiné ici (nation fictive)"
        name = "flag-%s" % e["code"]
        r = FL.raster(ROOT / e["file"])
        plates.append((name, r))
        st = r.stats()
        made.append({"name": name, "file": e["file"],
                     "use": "drapeau %s — %s (%s)" % (e["code"], e["name"], origin),
                     "bytes": e["diskBytes"], "w": e["w"], "h": e["h"],
                     "px": e["w"] * e["h"], "meanLuma": st["meanLuma"],
                     "litRatio": st["litRatio"], "cdn": e.get("cdn"),
                     "url": e.get("url"), "licence": e.get("licence"),
                     "sha256": e.get("sha256")})
        print("  %-18s %4d×%-4d %6.1f ko  %s %s" %
              (name, e["w"], e["h"], e["bytes"] / 1024.0,
               "CDN   " if e["kind"] == "cdn" else "dessiné", e["name"]), flush=True)

    # les icônes récupérées sur GitHub : Lucide, Tabler (SVG) et OpenMoji (PNG)
    for it in GH.entries(ROOT):
        name = "icon-%s" % it["name"]
        path = ROOT / it["file"]
        origin = "%s · %s" % (it["source"].capitalize(), it["licence"].split(" (")[0])
        made.append({"name": name, "file": it["file"],
                     "use": "%s — %s (%s)" % (it["use"], it["name"], origin),
                     "bytes": it["diskBytes"], "w": it["w"], "h": it["h"],
                     "px": it["w"] * it["h"], "repo": it["repo"], "path": it["path"],
                     "url": it["url"], "licence": it["licence"], "sha256": it["sha256"]})
        if not it["vector"]:                      # un PNG entre dans la planche de contact
            plates.append((name, GH.raster(path)))
        print("  %-18s %4d×%-4d %6.1f ko  %s" %
              (name, it["w"], it["h"], it["diskBytes"] / 1024.0, origin), flush=True)

    sheet = P.contact_sheet(plates)
    sheet.save(out / "contact-sheet.png")
    (out / "manifest.json").write_text(json.dumps(
        {"kind": "images", "dir": args.dir, "plates": made,
         "sheet": "%s/contact-sheet.png" % args.dir,
         "generated": time.strftime("%Y-%m-%dT%H:%M:%S")},
        indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("  → %d plaques (dont %d drapeaux et %d icônes GitHub) + planche de contrôle dans %s"
          % (len(made), len(FL.entries(ROOT)), len(GH.entries(ROOT)), args.dir))
    if args.ascii:
        for name, r in plates:
            if args.ascii is not True and name not in args.ascii:
                continue
            print("\n== %s ==" % name)
            print(r.ascii(args.width))
    return 0


def do_fetch(args):
    """Les drapeaux : les vrais récupérés au CDN, celui d'Istan dessiné ici.

    Une fois pour le dépôt, pas une fois par film : les fichiers tombent dans
    `assets/img/flag-<CODE>.png`, exactement le nom que les films et le panel
    réclament. Le film, lui, ne fait aucune requête : il lit un fichier du dépôt.
    """
    print("  drapeaux réels → flagcdn.com (PNG de domaine public), puis Istan")
    entries, problems = FL.fetch(ROOT, force=args.force, timeout=args.timeout)
    cdn = sum(1 for e in entries if e["kind"] == "cdn")
    kept = sum(1 for e in entries if e.get("origin") == "garde")
    saved = sum(e["bytes"] for e in entries)
    print("  → %d drapeaux (%d au CDN%s, %d dessiné) · %.0f ko"
          % (len(entries), cdn, " dont %d gardés" % kept if kept else "",
             len(entries) - cdn, saved / 1024.0))
    print("  → %s — URL, licence et sha256 de chaque fichier"
          % (ROOT / "assets/img/flags.json").relative_to(ROOT))

    print("\n  icônes de commerce → GitHub, servies par jsDelivr (Lucide, Tabler, OpenMoji)")
    icons, iproblems = GH.fetch(ROOT, force=args.force, timeout=args.timeout)
    kept = sum(1 for e in icons if e.get("origin") == "garde")
    print("  → %d icônes (%d vectorielles, %d en couleur)%s"
          % (len(icons), sum(1 for e in icons if e["vector"]),
             sum(1 for e in icons if not e["vector"]),
             " dont %d gardées" % kept if kept else ""))
    print("  → %s — dépôt, chemin, licence et empreinte de chaque fichier"
          % (ROOT / "assets/img/github.json").relative_to(ROOT))

    problems += iproblems
    for p in problems:
        print("  ! %s" % p)
    return 1 if problems else 0


def do_check(args):
    """Les bandes posées à côté des films correspondent-elles aux films d'aujourd'hui ?

    On vérifie les trois bandes du studio — le son, la voix, la banque — et les
    plaques. Une bande vocale dont une réplique ne tient plus dans sa fenêtre est
    déclarée à refaire : le montage a bougé sous la voix, et ça s'entendrait.
    """
    bad = 0
    films = [SC.read_film(ROOT / a) for a in args.films] if args.films else films_default()
    for film in films:
        path = (ROOT / film["asset"]).with_suffix(".json")
        if not path.exists():
            print("  %s : aucune bande (les films tournent sur leur rendu local)" % film["id"])
            continue
        man = json.loads(path.read_text(encoding="utf-8"))
        stored = [(c[0], c[1]) for c in man["cues"]]
        now = [(c[0], c[1]) for c in film["cues"]]
        problems = []
        if stored != now:
            problems.append("partition différente (%d cues contre %d)"
                            % (len(stored), len(now)))
        if man["filmMs"] != film["total"]:
            problems.append("durée différente (%d contre %d)" % (man["filmMs"], film["total"]))
        wav_path = ROOT / film["asset"]
        if not wav_path.exists():
            problems.append("fichier absent")
        else:
            sr, ch, n = W.frames_of(wav_path)
            if abs(n / sr - man["seconds"]) > .01:
                problems.append("durée du fichier différente du manifeste")
            if sr != man["sr"]:
                problems.append("fréquence différente du manifeste")
        if problems:
            bad += 1
            print("  %s : À REFAIRE — %s" % (film["id"], " ; ".join(problems)))
        else:
            print("  %s : à jour (%d cues, %.1f s, %s)"
                  % (film["id"], len(now), man["seconds"], man["generated"]))

    # --- la voix : présente, mesurée sur les mêmes répliques, et qui tient dans son budget
    for film in films:
        lines = film.get("lines") or []
        if not lines:
            continue
        vpath = ROOT / VOICE_DIR / (film["id"] + ".json")
        if not vpath.exists():
            print("  %s : voix absente (le film se rabat sur la voix du navigateur)" % film["id"])
            continue
        man = json.loads(vpath.read_text(encoding="utf-8"))
        problems = []
        if len(man["lines"]) != len(lines):
            problems.append("répliques différentes (%d contre %d)"
                            % (len(man["lines"]), len(lines)))
        else:
            for stored, now_line in zip(man["lines"], lines):
                if stored["t"] != now_line["t"]:
                    problems.append("réplique %d déplacée (%d contre %d)"
                                    % (stored["i"] + 1, stored["t"], now_line["t"]))
                if stored["ms"] > now_line["d"] + 1:
                    problems.append("réplique %d (%d ms) plus longue que sa fenêtre (%d ms)"
                                    % (stored["i"] + 1, stored["ms"], now_line["d"]))
                elif stored["slack"] < 0:
                    problems.append("réplique %d empiète sur la suivante" % (stored["i"] + 1))
        wav_path = ROOT / man["asset"]
        if not wav_path.exists():
            problems.append("fichier absent")
        else:
            sr, ch, n = W.frames_of(wav_path)
            if abs(n / sr - man["seconds"]) > .01:
                problems.append("durée du fichier différente du manifeste")
        if problems:
            bad += 1
            print("  %s : VOIX À REFAIRE — %s" % (film["id"], " ; ".join(problems)))
        else:
            print("  %s : voix à jour (%d répliques, %.1f s, %.2f mot/s, %s)"
                  % (film["id"], len(man["lines"]), man["seconds"], man["meanRate"],
                     man["generated"]))

    sman = ROOT / "assets/sfx/manifest.json"
    if sman.exists():
        man = json.loads(sman.read_text(encoding="utf-8"))
        gone = [i["file"] for i in man["items"] if not (ROOT / i["file"]).exists()]
        print("  banque : %d sons%s" % (len(man["items"]),
              "" if not gone else " — manquants : " + ", ".join(gone[:6])))
        if gone:
            bad += 1

    iman = ROOT / "assets/img/manifest.json"
    if iman.exists():
        man = json.loads(iman.read_text(encoding="utf-8"))
        gone = [p["file"] for p in man["plates"] if not (ROOT / p["file"]).exists()]
        print("  images : %d plaques%s" % (len(man["plates"]),
              "" if not gone else " — manquantes : " + ", ".join(gone)))
        if gone:
            bad += 1

    # --- les drapeaux : un fichier par drapeau annoncé, et rien de demandé qui manque.
    # Un code sans fichier, c'est une vignette vide dans le film : le genre de trou
    # qu'on ne voit qu'à l'écran, et pas dans un tableau de bord.
    fman = FL.manifest(ROOT)
    if not fman:
        print("  drapeaux : aucun manifeste — lancer `generate.py fetch`")
        bad += 1
    else:
        codes = {e["code"]: e for e in fman["flags"]}
        gone = [e["file"] for e in fman["flags"] if not (ROOT / e["file"]).exists()]
        drift = [e["code"] for e in fman["flags"]
                 if (ROOT / e["file"]).exists()
                 and hashlib.sha256((ROOT / e["file"]).read_bytes()).hexdigest()[:16] != e["sha256"]]
        print("  drapeaux : %d fichiers (%d récupérés au CDN, %d dessiné(s))%s"
              % (len(fman["flags"]), sum(1 for e in fman["flags"] if e["kind"] == "cdn"),
                 sum(1 for e in fman["flags"] if e["kind"] != "cdn"),
                 "" if not gone else " — manquants : " + ", ".join(gone[:6])))
        if gone:
            bad += 1
        if drift:
            print("  drapeaux : %d fichier(s) ne sont plus ceux récupérés : %s"
                  % (len(drift), ", ".join(drift[:8])))
            bad += 1
        want = {}
        for page in sorted(ROOT.glob("*.html")):
            for code in re.findall(r'flag:\s*"([A-Z]{2})"', page.read_text(encoding="utf-8")):
                want.setdefault(code, set()).add(page.name)
        missing = sorted(c for c in want if c not in codes)
        print("  drapeaux des films : %d codes%s"
              % (len(want), "" if not missing else " — sans fichier : " + ", ".join(missing)))
        if missing:
            bad += 1

    # --- les icônes récupérées sur GitHub : présentes, intactes, licences en clair
    gman = GH.manifest(ROOT)
    if not gman:
        print("  icônes GitHub : aucun manifeste — lancer `generate.py fetch`")
    else:
        gone = [i["file"] for i in gman["items"] if not (ROOT / i["file"]).exists()]
        drift = [i["name"] for i in gman["items"] if (ROOT / i["file"]).exists()
                 and hashlib.sha256((ROOT / i["file"]).read_bytes()).hexdigest()[:16] != i["sha256"]]
        repos = sorted({i["repo"] for i in gman["items"]})
        print("  icônes GitHub : %d fichiers de %s%s"
              % (len(gman["items"]), ", ".join(repos),
                 "" if not gone else " — manquants : " + ", ".join(gone)))
        if gone:
            bad += 1
        if drift:
            print("  icônes GitHub : %d fichier(s) modifiés depuis la récupération : %s"
                  % (len(drift), ", ".join(drift[:8])))
            bad += 1
        print("  licences : %s" % " · ".join(sorted({i["licence"] for i in gman["items"]})))
    return 1 if bad else 0


def do_list(args):
    films = films_default()
    print("films :")
    for f in films:
        used = sorted({c[1] for c in f["cues"]})
        unknown = [u for u in used if u not in V.RECIPES]
        print("  %-16s %5d ms  %3d cues  %2d voix  bande %s"
              % (f["id"], f["total"], len(f["cues"]), len(used), f["asset"]))
        if unknown:
            print("     voix sans recette : %s" % ", ".join(unknown))
    print("\nvoix du studio (%d sons, %d fichiers avec les variantes) :"
          % (len(V.RECIPES), len(V.RECIPES) + sum(n - 1 for n in V.VARIATIONS.values())))
    for fam, names in V.FAMILIES.items():
        print("  %-26s %s" % (fam, ", ".join(sorted(names))))
    rest = sorted(set(V.RECIPES) - {n for ns in V.FAMILIES.values() for n in ns})
    if rest:
        print("  %-26s %s" % ("sans famille", ", ".join(rest)))
    print("\nvoix parlées (%s) :" % ", ".join(sorted(SP.VOICES)))
    for k, v in sorted(SP.VOICES.items()):
        print("  %-20s %s%s" % (k, v["label"],
              "" if SP.available(k) else "   (modèle à télécharger)"))
    print("\nplaques (%d) :" % len(P.PLATES))
    for name, _m, use in P.PLATES:
        print("  %-18s %s" % (name, use))
    flags = FL.describe(ROOT)
    print("\ndrapeaux (%d) :" % len(flags))
    for line in flags:
        print("  " + line)
    if not flags:
        print("  aucun — lancer `generate.py fetch` (CDN flagcdn.com)")
    icons = GH.describe(ROOT)
    print("\nicônes GitHub (%d) :" % len(icons))
    for line in icons:
        print("  " + line)
    if not icons:
        print("  aucune — lancer `generate.py fetch` (Lucide, Tabler, OpenMoji)")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="generate.py", description="Le studio : sons et images des films.")
    sub = ap.add_subparsers(dest="cmd")

    a = sub.add_parser("audio", help="fabriquer les bandes-son des films")
    a.add_argument("films", nargs="*", help="pages HTML (défaut : tous les films du dépôt)")
    a.add_argument("--sr", type=int, default=S.SR)
    a.add_argument("--peak", type=float, default=.9)
    a.set_defaults(fn=do_audio)

    i = sub.add_parser("images", help="fabriquer les plaques d'images")
    i.add_argument("--dir", default="assets/img")
    i.add_argument("--ascii", nargs="?", const=True, default=None,
                   help="relire les plaques en caractères (ou --ascii grain-tile)")
    i.add_argument("--width", type=int, default=72)
    i.set_defaults(fn=do_images)

    v = sub.add_parser("voice", help="fabriquer les bandes vocales des films (piper)")
    v.add_argument("films", nargs="*", help="pages HTML (défaut : tous les films du dépôt)")
    v.add_argument("--voice", default="fr_FR-tom-medium", help="la voix du studio")
    v.add_argument("--sr", type=int, default=S.SR)
    v.add_argument("--scale", type=float, default=1.08,
                   help="longueur des phonèmes : au-dessus de 1, plus posé")
    v.add_argument("--peak", type=float, default=.9)
    v.add_argument("--quiet", action="store_true", help="ne pas détailler les répliques")
    v.set_defaults(fn=do_voice)

    x = sub.add_parser("sfx", help="rendre la banque de sons, jouable")
    x.add_argument("--dir", default=SFX_DIR)
    x.add_argument("--sr", type=int, default=S.SR)
    x.add_argument("--peak", type=float, default=.9)
    x.add_argument("--total", type=int, default=8000,
                   help="durée des lits (foule, souffle) pour la banque, en ms")
    x.set_defaults(fn=do_sfx)

    f = sub.add_parser("fetch", help="récupérer les drapeaux au CDN (+ celui d'Istan)")
    f.add_argument("--force", action="store_true",
                   help="retélécharger même si le fichier est déjà là")
    f.add_argument("--timeout", type=float, default=20)
    f.set_defaults(fn=do_fetch)

    pn = sub.add_parser("panel", help="écrire le grand panel d'assets")
    pn.add_argument("films", nargs="*")
    pn.add_argument("--out", default="assets/panel.html")
    pn.set_defaults(fn=do_panel)

    c = sub.add_parser("check", help="vérifier que les bandes correspondent aux films")
    c.add_argument("films", nargs="*")
    c.set_defaults(fn=do_check)

    sub.add_parser("list", help="ce que le studio sait faire").set_defaults(fn=do_list)

    allp = sub.add_parser("all", help="audio + voix + banque + images + panel")
    allp.add_argument("films", nargs="*")
    allp.add_argument("--sr", type=int, default=S.SR)
    allp.add_argument("--peak", type=float, default=.9)
    allp.add_argument("--dir", default="assets/img")
    allp.add_argument("--voice", default="fr_FR-tom-medium")
    allp.add_argument("--scale", type=float, default=1.08)
    allp.add_argument("--no-voice", action="store_true",
                      help="sauter la voix (aucun moteur vocal installé)")

    def do_all(args):
        # les bandes d'abord : si l'une échoue, on s'arrête avant d'écrire le reste
        phases = [("bandes-son", lambda: do_audio(args))]
        if not args.no_voice:
            phases.append(("voix", lambda: do_voice(argparse.Namespace(
                films=args.films, voice=args.voice, sr=args.sr, scale=args.scale,
                peak=args.peak, quiet=True))))
        phases += [
            ("banque de sons", lambda: do_sfx(argparse.Namespace(
                dir=SFX_DIR, sr=args.sr, peak=args.peak, total=8000))),
            ("drapeaux", lambda: do_fetch(argparse.Namespace(force=False, timeout=20))),
            ("plaques", lambda: do_images(argparse.Namespace(
                dir=args.dir, ascii=None, width=72))),
            ("panel", lambda: do_panel(argparse.Namespace(films=args.films,
                                                           out="assets/panel.html"))),
        ]
        for name, fn in phases:
            print("\n== %s" % name, flush=True)
            code = fn()
            if code:
                return code
        return 0

    allp.set_defaults(fn=do_all)

    args = ap.parse_args(argv)
    if not getattr(args, "fn", None):
        ap.print_help()
        return 1
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
