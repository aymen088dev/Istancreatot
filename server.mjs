// Serveur statique minimal (aucune dépendance).
// Sert le dossier du projet sur 0.0.0.0:$PORT et fabrique une page d'accueil
// qui liste les films HTML trouvés, avec leur durée lue dans window.N3.
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const SKIP = new Set(["node_modules", "tools", ".git", "shots"]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",          // la bande-son fabriquée par tools/assets
  ".py": "text/x-python; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",   // le script vocal After Effects de l'export
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Lit <title>, la durée et le nombre de scènes d'un film. */
function readMeta(html, name) {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || name;
  const duration = Number(html.match(/const TOTAL\s*=\s*(\d+)/)?.[1] || 0);
  const scenes = (html.match(/\{\s*from:\s*\d+,\s*to:\s*\d+/g) || []).length;
  return { title, seconds: duration ? Math.round(duration / 1000) : 0, scenes };
}

async function listing(dir, urlPath) {
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => !e.name.startsWith(".") && !SKIP.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cards = [];
  for (const e of entries) {
    const href = join(urlPath, encodeURIComponent(e.name)).replace(/\\/g, "/");
    if (e.isDirectory()) continue;
    const isFilm = extname(e.name).toLowerCase() === ".html";
    let meta = null;
    if (isFilm) {
      try { meta = readMeta(await readFile(join(dir, e.name), "utf8"), e.name); } catch { meta = null; }
    }
    cards.push(`      <a class="card" href="${href}">
        <span class="t">${esc(meta?.title || e.name)}</span>
        <span class="f">${esc(e.name)}</span>
        <span class="chips">${[
          isFilm ? "film" : extname(e.name).slice(1) || "fichier",
          meta?.seconds ? `${meta.seconds} s` : null,
          meta?.scenes ? `${meta.scenes} scènes` : null,
        ].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</span>
      </a>`);
  }

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nyxar N3 — régie</title>
<style>
  :root{--ink:#f7f4ec;--gold:#f0b64a;--muted:rgba(247,244,236,.55);--line:rgba(247,244,236,.13)}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;color:var(--ink);background:radial-gradient(120% 90% at 15% 0%,#1b1608,#03060b 58%);
    font-family:"Helvetica Neue",Inter,system-ui,sans-serif}
  .wrap{max-width:900px;margin:0 auto;padding:56px 24px 80px}
  .brand{font:500 12px ui-monospace,monospace;letter-spacing:.28em;text-transform:uppercase;color:var(--muted)}
  h1{margin:16px 0 8px;font-size:clamp(28px,4.6vw,44px);letter-spacing:-.03em}
  h1 em{font-style:normal;background:linear-gradient(96deg,var(--gold),#5ad6de);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:0 0 30px;color:var(--muted);font-size:14.5px;line-height:1.65;max-width:64ch}
  .card{display:block;padding:18px 20px;margin-bottom:10px;text-decoration:none;color:inherit;border:1px solid var(--line);
    border-radius:14px;background:rgba(255,255,255,.03);transition:background .25s,border-color .25s,transform .25s}
  .card:hover{background:rgba(255,255,255,.07);border-color:rgba(247,244,236,.28);transform:translateY(-2px)}
  .t{display:block;font-weight:650;font-size:16px}
  .f{display:block;font:400 12px ui-monospace,monospace;color:var(--muted);margin-top:4px}
  .chips{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .chip{font:400 10.5px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
    border:1px solid var(--line);border-radius:999px;padding:3px 9px}
  a.panel{color:var(--gold);text-decoration:none;border-bottom:1px solid rgba(240,182,74,.4)}
  a.panel:hover{border-bottom-color:var(--gold)}
  footer{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font:400 12px ui-monospace,monospace;line-height:1.9}
</style></head>
<body><div class="wrap">
  <div class="brand">Nyxar Motor House · régie locale</div>
  <h1>Publicité <em>motion</em> — Nyxar N3</h1>
  <p>Un fichier HTML autonome : image dessinée par code, voix et sous-titres mot à mot. La musique
     <i>et</i> la voix sont jouées par des sources posées par le studio — les bandes de
     <code>assets/audio</code> et <code>assets/voice</code> — et l'image avance sur l'horloge de ces sources :
     une seule horloge, donc aucun décalage. Ouvre le film, puis <b>Espace</b> lecture/pause ·
     <b>S</b> son · <b>V</b> voix · <b>R</b> recommencer.</p>
  <p>Le studio a aussi son <a class="panel" href="assets/panel.html"><b>grand panel d'assets</b></a> —
     la banque de sons à écouter, les plaques d'images, les bandes et les voix de chaque film.</p>
${cards.join("\n")}
  <footer>Studio : <code>bun run assets</code> (bandes + voix + banque + plaques + panel ;
    <code>bun run assets:setup</code> installe numpy, scipy, Pillow et le moteur vocal).<br />
    Vérifications : <code>bun run verify</code> (statique) et <code>bun run shots</code> (captures, lecture réelle, mesure des bandes).</footer>
</div></body></html>`;
}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const rel = normalize(pathname).replace(/^([/\\])+/, "");
    if (rel.split(/[/\\]/).some((p) => p.startsWith("."))) return reply(res, 404, "text/html", "<h1>404</h1>");
    const full = resolve(join(ROOT, rel));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) return reply(res, 403, "text/plain", "403");
    const info = await stat(full).catch(() => null);
    if (info?.isDirectory()) return reply(res, 200, TYPES[".html"], await listing(full, pathname));
    if (!info?.isFile()) return reply(res, 404, "text/html", "<h1>404</h1>");
    const body = await readFile(full);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(full).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (e) {
    reply(res, 500, "text/plain", "500 " + (e?.message || "erreur"));
  }
});

function reply(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type + (type.startsWith("text/") && !type.includes("charset") ? "; charset=utf-8" : "") });
  res.end(body);
}

server.listen(PORT, HOST, () => console.log(`NYXAR N3 → http://${HOST}:${PORT}`));
