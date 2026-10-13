"""Le grand panel : tout ce que le studio sait produire, sur une seule page.

Un studio qui fabrique 46 recettes de son, 76 fichiers de banque, quatre bandes,
quatre bandes vocales et une trentaine de plaques ne sert à rien si personne ne
peut **entendre** et **voir** ce qu'il y a dedans. Cette page est le catalogue :
elle se régénère depuis les manifestes (`generate.py panel`), elle se joue dans
le navigateur — chaque son a son lecteur, chaque plaque son image, chaque film sa
bande et sa voix — et elle n'a besoin d'aucun service : que des fichiers.

Le catalogue est aussi écrit en JSON (`assets/catalog.json`) : c'est cette liste
qu'un montage ou un outil extérieur peut relire.
"""
from __future__ import annotations

import json
import time

from . import speech as SP
from . import voices as V

#: Les familles de sons dans l'ordre d'affichage du panel.
ORDER = ["nappes & graves", "percussions & impacts", "transitions & mouvements",
         "cordes & cloches", "interface", "mécanique", "stade & foule",
         "studio & micro", "divers"]


def _json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def gather(root, films):
    """Tout ce que le studio a produit : films, bandes, voix, banque, plaques."""
    out = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "films": [], "sfx": []}
    for film in films:
        fid = film["id"]
        band = _json(root / (film["asset"].rsplit(".", 1)[0] + ".json")) if film["asset"] else None
        voice = _json(root / ("assets/voice/%s.json" % fid))
        out["films"].append({
            "id": fid,
            "title": film["title"],
            "file": film["file"].name,
            "total": film["total"],
            "seconds": round(film["total"] / 1000.0, 1),
            "cues": len(film["cues"]),
            "voices": sorted({c[1] for c in film["cues"]}),
            "band": band,
            "voice": voice,
        })
    bank = _json(root / "assets/sfx/manifest.json") or {}
    out["sfx"] = bank.get("items", [])
    out["familles"] = bank.get("familles", {})
    out["plaques"] = (_json(root / "assets/img/manifest.json") or {}).get("plates", [])
    out["contact"] = (_json(root / "assets/img/manifest.json") or {}).get("sheet")
    out["recipes"] = sorted(V.RECIPES)
    out["voiceModels"] = {k: v["label"] for k, v in SP.VOICES.items()}
    return out


# ---------------------------------------------------------------------- la page
def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _kb(n):
    return "%.0f ko" % (n / 1024.0) if n < 1e6 else "%.1f Mo" % (n / 1e6)


def _rel(path):
    """Le chemin d'un fichier, vu depuis la page.

    Les manifestes rangent leurs fichiers en chemin de dépôt (`assets/sfx/air.wav`),
    parce que c'est ce qu'un outil extérieur veut lire. La page, elle, vit dans
    `assets/` : elle doit donc écrire `sfx/air.wav`, sinon chaque lecteur et chaque
    plaque réclame un fichier qui n'existe pas — et la page reste muette et vide.
    """
    p = str(path).replace("\\", "/").lstrip("/")
    return p[len("assets/"):] if p.startswith("assets/") else p


def _sound_card(item):
    dur = item["seconds"]
    return """      <div class="card snd" data-name="%s %s" data-family="%s">
        <div class="top"><b>%s</b><span class="chip">%.2f s</span><span class="chip">%s</span></div>
        <audio controls preload="none" src="%s"></audio>
        <div class="foot"><code>["%s"]</code><span class="dim">%s · %s</span>
          <button class="copy" data-copy='["%s", %d]'>cue</button></div>
      </div>""" % (_esc(item["name"]), _esc(item.get("family", "")), _esc(item.get("family", "")),
                   _esc(item["name"]), dur, _kb(item["bytes"]), _esc(_rel(item["file"])),
                   _esc(item["name"]), _esc(item["file"]), _kb(item["bytes"]), _esc(item["name"]),
                   int(dur * 1000))


def _band_block(f):
    band, voice = f.get("band"), f.get("voice")
    rows = []
    if band:
        rows.append("""          <li><b>bande-son</b> %.1f s · %d sons · crête %.2f · RMS %.3f · %s</li>
""" % (band["seconds"], len(band["cues"]), band["peak"], band["rms"], _kb(band["bytes"])))
    if voice:
        rows.append("""          <li><b>voix</b> %d répliques · %s · débit moyen %.2f mot/s · %s</li>
""" % (len(voice["lines"]), voice["engine"]["label"],
       sum(l["rate"] for l in voice["lines"]) / max(1, len(voice["lines"])), _kb(voice["bytes"])))
    lines = ""
    if voice:
        lines = "\n".join(
            """            <tr><td>%d</td><td>%.2f s</td><td>%.2f</td><td class="txt">%s</td></tr>"""
            % (l["i"] + 1, l["ms"] / 1000.0, l["rate"], _esc(l["txt"]))
            for l in voice["lines"])
    parts = []
    parts.append("""      <article class="card film" data-name="%s %s">
        <header><h3>%s</h3><span class="dim">%s · %s s</span></header>
        <ul class="stats">
%s        </ul>
        <div class="players">
          <audio controls preload="none" src="audio/%s.wav" title="bande-son"></audio>%s
        </div>%s
        <footer><code>bun run dev</code> → <code>%s</code></footer>
      </article>""" % (
        _esc(f["id"]), _esc(f["title"]), _esc(f["title"]), _esc(f["file"]), f["seconds"],
        "".join(rows),
        _esc(f["id"]),
        ('\n          <audio controls preload="none" src="voice/%s.wav" title="voix"></audio>' % _esc(f["id"])) if voice else "",
        ("""
        <details><summary>les répliques mesurées</summary>
          <table><thead><tr><th>#</th><th>voix</th><th>mot/s</th><th>texte</th></tr></thead>
          <tbody>
%s
          </tbody></table>
        </details>""" % lines) if voice else "",
        _esc(f["file"])))
    return "\n".join(parts)


def _plate_card(p):
    return """      <figure class="plate" data-name="%s %s">
        <img loading="lazy" src="%s" alt="%s" />
        <figcaption><b>%s</b><span class="dim">%s · %d×%d · %s</span></figcaption>
      </figure>""" % (_esc(p["name"]), _esc(p.get("use", "")), _esc(_rel(p["file"])), _esc(p["name"]),
                      _esc(p["name"]), _esc(p.get("use", "")), p["w"], p["h"], _kb(p["bytes"]))


CSS = """
  :root{--ink:#f6f3ea;--gold:#f0b64a;--cyan:#5ad6de;--muted:rgba(246,243,234,.55);
    --line:rgba(246,243,234,.13);--panel:rgba(255,255,255,.035)}
  *{box-sizing:border-box}
  body{margin:0;color:var(--ink);background:radial-gradient(120% 80% at 12% 0%,#1c1708,#04070c 55%) fixed;
    font-family:"Helvetica Neue",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1240px;margin:0 auto;padding:44px 22px 96px}
  .brand{font:500 12px ui-monospace,monospace;letter-spacing:.28em;text-transform:uppercase;color:var(--muted)}
  h1{margin:14px 0 6px;font-size:clamp(30px,5vw,52px);letter-spacing:-.03em}
  h1 em{font-style:normal;background:linear-gradient(96deg,var(--gold),var(--cyan));
    -webkit-background-clip:text;background-clip:text;color:transparent}
  h2{margin:54px 0 14px;font-size:20px;letter-spacing:-.01em;display:flex;align-items:baseline;gap:12px}
  h2 span{font:400 12px ui-monospace,monospace;color:var(--muted);letter-spacing:.16em;text-transform:uppercase}
  h3{margin:0;font-size:17px}
  p.lead{margin:0 0 8px;color:var(--muted);font-size:14.5px;line-height:1.7;max-width:88ch}
  .counts{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 6px}
  .count{font:400 12px ui-monospace,monospace;border:1px solid var(--line);border-radius:999px;
    padding:6px 12px;color:var(--muted)}
  .count b{color:var(--gold)}
  nav.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:22px 0 6px}
  nav.tools a{font:400 12px ui-monospace,monospace;color:var(--ink);text-decoration:none;
    border:1px solid var(--line);border-radius:999px;padding:7px 13px;background:var(--panel)}
  nav.tools a:hover{border-color:rgba(246,243,234,.34)}
  input#q{flex:1;min-width:220px;padding:9px 14px;border-radius:999px;border:1px solid var(--line);
    background:rgba(0,0,0,.35);color:var(--ink);font:400 13px ui-monospace,monospace;outline:none}
  input#q:focus{border-color:var(--gold)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:12px}
  .card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px 16px}
  .card .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .card b{font-weight:650}
  .chip{font:400 10.5px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 8px}
  .dim{color:var(--muted);font:400 11.5px ui-monospace,monospace}
  audio{display:block;width:100%;height:34px;margin:10px 0 6px;filter:saturate(.85)}
  .foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  code{font:400 12px ui-monospace,monospace;color:var(--cyan);background:rgba(90,214,222,.08);
    border-radius:6px;padding:2px 6px}
  .copy{margin-left:auto;font:400 11px ui-monospace,monospace;color:var(--ink);cursor:pointer;
    border:1px solid var(--line);background:transparent;border-radius:999px;padding:4px 10px}
  .copy:hover{border-color:var(--gold);color:var(--gold)}
  .film{display:flex;flex-direction:column;gap:8px;padding:18px 18px 14px}
  .film header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .film .stats{margin:0;padding-left:16px;color:var(--muted);font:400 12.5px ui-monospace,monospace;line-height:1.9}
  .film .stats b{color:var(--ink)}
  .players{display:flex;flex-direction:column;gap:2px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font:400 12px ui-monospace,monospace}
  th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--muted);font-weight:400;letter-spacing:.1em;text-transform:uppercase;font-size:10.5px}
  td.txt{font-family:"Helvetica Neue",Inter,system-ui,sans-serif;font-size:12.5px}
  details summary{cursor:pointer;color:var(--muted);font:400 11.5px ui-monospace,monospace;letter-spacing:.08em;
    text-transform:uppercase;margin-top:4px}
  details[open] summary{color:var(--gold)}
  .plates{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:12px}
  details.sheet{margin:8px 0 18px;border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px}
  details.sheet summary{cursor:pointer;font:400 12px ui-monospace,monospace;color:var(--muted);letter-spacing:.06em}
  details.sheet img{display:block;width:100%;margin-top:12px;border-radius:10px;border:1px solid var(--line)}
  .plate{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
  .plate img{display:block;width:100%;height:104px;object-fit:contain;background:
    repeating-conic-gradient(rgba(255,255,255,.045) 0% 25%,transparent 0% 50%) 50%/16px 16px}
  .plate figcaption{padding:8px 10px 10px;display:flex;flex-direction:column;gap:3px}
  footer.page{margin-top:60px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);
    font:400 12px ui-monospace,monospace;line-height:2}
  .hidden{display:none}
"""

JS = """
  var q = document.getElementById('q');
  function filter(){
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll('[data-name]').forEach(function(el){
      el.classList.toggle('hidden', v && el.dataset.name.toLowerCase().indexOf(v) < 0);
    });
    document.querySelectorAll('section[data-sec]').forEach(function(s){
      var n = s.querySelectorAll('[data-name]:not(.hidden)').length;
      s.classList.toggle('hidden', v && n === 0);
    });
  }
  q.addEventListener('input', filter);
  document.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click', function(){
      var t = b.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
        .then(function(){ b.textContent = 'copié'; setTimeout(function(){ b.textContent = 'cue'; }, 1200); })
        .catch(function(){ b.textContent = t; });
    });
  });
"""


def page(cat):
    films = cat["films"]
    sfx = cat["sfx"]
    plates = cat["plaques"]
    n_voice = sum(1 for f in films if f.get("voice"))
    n_speech = sum(len(f["voice"]["lines"]) for f in films if f.get("voice"))

    fams = {f: [s for s in sfx if s.get("family") == f] for f in ORDER}
    fams = {f: xs for f, xs in fams.items() if xs}

    sounds = "\n".join(
        """    <section data-sec data-name="%s">
      <h2>%s <span>%d sons</span></h2>
      <div class="grid">
%s
      </div>
    </section>""" % (_esc(fam), _esc(fam), len(xs), "\n".join(_sound_card(s) for s in xs))
        for fam, xs in fams.items())

    bands = "\n".join(_band_block(f) for f in films)
    plates_html = "\n".join(_plate_card(p) for p in plates)
    sheet = cat.get("contact")
    sheet_html = ("""
  <details class="sheet" open><summary>la planche de contact — les %d plaques d'un coup d'œil</summary>
    <img loading="lazy" src="%s" alt="planche de contact des plaques" />
  </details>""" % (len(plates), _esc(_rel(sheet)))) if sheet else ""

    return """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Studio — le grand panel d'assets</title>
<style>%s</style></head>
<body><div class="wrap">
  <div class="brand">Studio des films · banque d'assets</div>
  <h1>Le grand panel <em>d'assets</em></h1>
  <p class="lead">Tout ce que le studio sait produire, à écouter et à regarder ici : les sons de la
     banque (un lecteur par son, la commande de cue prête à copier), les bandes-son des films, leurs
     bandes vocales avec le débit mesuré réplique par réplique, et les plaques d'images. Rien n'est
     fabriqué à la volée : chaque fichier listé ici existe dans <code>assets/</code>, et la page se
     régénère depuis les manifestes du studio.</p>
  <div class="counts">
    <span class="count"><b>%d</b> sons jouables</span>
    <span class="count"><b>%d</b> films sonorisés</span>
    <span class="count"><b>%d</b> bandes vocales, <b>%d</b> répliques mesurées</span>
    <span class="count"><b>%d</b> plaques d'images</span>
    <span class="count"><b>%d</b> recettes au catalogue</span>
    <span class="count">voix : <b>%s</b></span>
  </div>
  <nav class="tools">
    <input id="q" type="search" placeholder="filtrer : whoosh, foule, drapeau, voix…" />
    <a href="#sons">sons</a><a href="#films">films</a><a href="#images">images</a>
    <a href="catalog.json">catalog.json</a><a href="../">les films</a>
  </nav>

  <h2 id="sons">La banque de sons <span>%d fichiers</span></h2>
  <p class="lead">Chaque recette de <code>studio/voices.py</code> rendue seule, à son niveau de master.
     Les recettes qui lisent le rang du cue (les cordes, les ticks, les pastilles) ont leurs variantes :
     de quoi ne pas répéter deux fois le même son dans un montage.</p>
%s

  <h2 id="films">Les films <span>bande + voix</span></h2>
%s

  <h2 id="images">Les plaques d'images <span>%d fichiers</span></h2>%s
  <div class="plates">
%s
  </div>

  <footer class="page">
    Régénérer : <code>python3 tools/assets/generate.py all</code> — sons, voix, plaques et cette page.<br />
    La voix : <code>python3 tools/assets/generate.py voice --voice %s</code> (moteur piper, modèle téléchargé une fois).<br />
    Contrôles : <code>bun run verify</code> (statique) · <code>bun run shots</code> (captures, lecture, mesure).<br />
    Catalogue : <code>assets/catalog.json</code> — %s
  </footer>
</div>
<script>%s</script>
</body></html>
""" % (CSS, len(sfx), len(films), n_voice, n_speech, len(plates), len(cat["recipes"]),
       ", ".join(sorted(cat["voiceModels"].values())),
       len(sfx), sounds, bands, len(plates), sheet_html, plates_html,
       sorted(SP.VOICES)[0], cat["generated"], JS)


def build(root, films, log=print):
    """Fabrique le panel : (page HTML, catalogue)."""
    cat = gather(root, films)
    log("  catalogue : %d sons, %d films, %d plaques"
        % (len(cat["sfx"]), len(cat["films"]), len(cat["plaques"])))
    return page(cat), cat
