// Serveur statique minimal, sans dépendance.
// Sert la racine du dépôt (les 5 fichiers HTML autonomes) sur 0.0.0.0:$PORT.
// La page d'accueil est GÉNÉRÉE : aucun fichier HTML supplémentaire n'est ajouté.
import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// resolve() supprime le « / » final que fileURLToPath laisse derrière lui.
const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const IGNORED = new Set(["node_modules", ".git", ".vly-run"]);

/** Extrait window.MOTION (titre, durée, ratio) d'un fichier HTML. */
function motionMeta(html) {
  const block = html.match(/window\.MOTION\s*=\s*\{([\s\S]{0,600}?)\}/);
  if (!block) return null;
  const grab = (key) => {
    const m = block[1].match(new RegExp(key + "\\s*:\\s*(?:\"([^\"]*)\"|'([^']*)'|([^,}\\s]+))"));
    return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
  };
  return { title: grab("title"), duration: grab("duration"), aspect: grab("aspect") };
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Page d'accueil générée : liste les fichiers du dossier. */
async function renderListing(dir, urlPath) {
  const entries = (await readdir(dir, { withFileTypes: true })).filter((e) => !e.name.startsWith(".") && !IGNORED.has(e.name));

  const rows = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const href = join(urlPath, encodeURIComponent(entry.name)).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      rows.push({ href, name: entry.name + "/", kind: "dossier", meta: null });
    } else {
      const isHtml = extname(entry.name).toLowerCase() === ".html";
      let meta = null;
      if (isHtml) {
        try {
          meta = motionMeta(await readFile(join(dir, entry.name), "utf8"));
        } catch {
          meta = null;
        }
      }
      rows.push({ href, name: entry.name, kind: isHtml ? "vidéo motion" : extname(entry.name).slice(1), meta });
    }
  }

  const cards = rows
    .map(({ href, name, kind, meta }) => {
      const chips = [
        kind,
        meta?.aspect ? escapeHtml(meta.aspect) : null,
        meta?.duration ? `≈ ${escapeHtml(meta.duration)} s` : null,
      ]
        .filter(Boolean)
        .map((c) => `<span class="chip">${c}</span>`)
        .join("");
      const isHtml = extname(name).toLowerCase() === ".html";
      return `      <a class="card${isHtml ? "" : " dim"}" href="${href}">
        <span class="name">${escapeHtml(meta?.title || name)}</span>
        <span class="file">${escapeHtml(name)}</span>
        <span class="chips">${chips}</span>
      </a>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>REMNANT · Motion Lab — ${rows.filter((r) => r.name.endsWith(".html")).length} fichiers</title>
<style>
  :root{--bg:#07070b;--ink:#f4f1ea;--muted:rgba(244,241,234,.55);--line:rgba(244,241,234,.12);--gold:#f0b429;--cyan:#3ce0ff}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(120% 90% at 20% 0%,#171208 0%,#07070b 55%);color:var(--ink);
       font-family:"Inter","Helvetica Neue",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh}
  .wrap{max-width:920px;margin:0 auto;padding:56px 24px 80px}
  .brand{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  h1{margin:14px 0 6px;font-size:clamp(30px,5vw,46px);letter-spacing:-.03em;line-height:1.02}
  h1 em{font-style:normal;background:linear-gradient(96deg,var(--gold),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  p.lede{margin:0 0 32px;color:var(--muted);font-size:14.5px;line-height:1.65;max-width:62ch}
  .card{display:flex;flex-direction:column;gap:6px;padding:18px 20px;margin-bottom:10px;text-decoration:none;color:inherit;
        border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);transition:background .25s,border-color .25s,transform .25s}
  .card:hover{background:rgba(255,255,255,.07);border-color:rgba(244,241,234,.26);transform:translateY(-2px)}
  .card.dim{opacity:.62}
  .name{font-weight:650;font-size:16px}
  .file{font-size:12px;color:var(--muted);font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace}
  .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .chip{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:3px 9px}
  footer{margin-top:30px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.7}
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Remnant · Motion Lab</div>
    <h1>5 motion designs <em>HTML5</em> autonomes</h1>
    <p class="lede">Chaque fichier est indépendant : son et voix se déclenchent via l'écran « Démarrer »,
      puis se pilotent avec les bascules <b>Son</b> et <b>Voix</b>. Ouvrage direct dans un nouvel onglet.</p>
${cards}
    <footer>Astuce : ouvre un fichier en plein écran, masque le curseur et capture l'écran en 60 fps.<br>
      Contrôles : Espace = pause · S = son · V = voix · R = recommencer.</footer>
  </div>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const relative = normalize(pathname).replace(/^([/\\])+/, "");

    // on ne sert jamais les fichiers cachés ni le contenu de .git / node_modules
    if (relative.split(/[/\\]/).some((part) => part.startsWith(".") || IGNORED.has(part))) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><meta charset=\"utf-8\"><title>404</title><h1>404</h1>");
      return;
    }

    const filePath = resolve(join(root, relative));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("403 Forbidden");
      return;
    }

    const info = await stat(filePath).catch(() => null);

    if (info && info.isDirectory()) {
      const body = await renderListing(filePath, pathname);
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
      res.end(body);
      return;
    }

    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><meta charset=\"utf-8\"><title>404</title><h1>404</h1>");
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 " + (error?.message || "Server error"));
  }
});

server.listen(port, host, () => {
  console.log(`MOTION LAB → http://${host}:${port}`);
});
