#!/usr/bin/env bun
// ============================================================================
// tools/shoot.mjs — vérifie les films sans écran :
//   • capture les instants clés et mesure chaque image (luminosité, teintes)
//   • contrôle les sous-titres (visibles, mot surligné, dans le cadre)
//   • joue vraiment le film : une seule horloge, pause gelée, reprise au bon
//     endroit — c'est le contrôle des bugs de synchronisation du son
//   • rend la partition hors ligne et analyse le son (niveau, silence, écrêtage)
//   • mesure la bande fabriquée par le studio (durée, niveau, trous de silence)
//   • mesure la bande **vocale** du même studio : niveau, et la voix s'entend-elle
//     bien dans chaque fenêtre de réplique annoncée par le plan ?
//   • le grand panel d'assets (`assets/panel.html`) : ouvert pour de vrai, chaque
//     image et chaque source audio vérifiées une par une, filtre exercé, capturé
//   • --ascii : aperçu du film en caractères, par bandes pour les formats verticaux
//   bun run shots                      tous les films + le panel
//   bun tools/shoot.mjs --panel        le panel seul (rapide)
//   bun tools/shoot.mjs astan-city-xi.html
//   bun run look                       aperçu ASCII
//   bun tools/shoot.mjs --ascii --only 3,4 --width 80 --bands 3
//
// Les films sont servis en HTTP (serveur maison, sur un port libre) : c'est le
// seul moyen qu'ils trouvent leur bande, et donc qu'on teste le vrai chemin.
// Le repli sans bande est éprouvé une fois en file:// en fin de parcours.
// ============================================================================
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const argFile = args.find((a) => a.endsWith(".html"));
const PANEL_ONLY = args.includes("--panel");
const FILES = argFile ? [argFile] : PANEL_ONLY ? [] : (await readdir(".")).filter((f) => f.endsWith(".html")).sort();
const ASCII = args.includes("--ascii");
const COLS = args.includes("--width") ? Number(args[args.indexOf("--width") + 1]) : null;
const BANDS_OPT = args.includes("--bands") ? Number(args[args.indexOf("--bands") + 1]) : 0;
const ONLY = args.includes("--only")
  ? args[args.indexOf("--only") + 1].split(",").map((n) => Number(n.trim())).filter(Boolean)
  : null;
// --viewport 390x844,360x640 : audit de mise en page (téléphone, tablette…)
const VIEWS = (args.includes("--viewport") ? args[args.indexOf("--viewport") + 1].split(",") : [])
  .map((s) => /^(\d+)x(\d+)$/.exec(s.trim()))
  .filter(Boolean)
  .map((m) => ({ width: Number(m[1]), height: Number(m[2]) }));
if (args.includes("--viewport") && !VIEWS.length) { console.error("✗ --viewport attend un format comme 390x844"); process.exit(2); }

for (const f of FILES) if (!existsSync(f)) { console.error(`✗ film introuvable : ${f}`); process.exit(1); }

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("✗ Playwright n'est pas installé.\n  bun add -d playwright\n  bunx playwright install --with-deps chromium");
  process.exit(2);
}

const OUT = resolve("tools/shots");
await mkdir(OUT, { recursive: true });
const RAMP = " .:-=+*#%@";

/* ---------------------------------------------- serveur de contrôle (HTTP) */
// Le film réclame sa bande par fetch : il lui faut une origine HTTP. On sert la
// racine du dépôt sur un port libre, sans dépendre du serveur de développement.
const ROOT = resolve(".");
const MIMES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".wav": "audio/wav", ".png": "image/png", ".css": "text/css; charset=utf-8",
  // les icônes du studio sont des SVG : sans ce type, le serveur les envoie en
  // `application/octet-stream`, Chromium refuse de les peindre, et le contrôle
  // les compte comme autant d'images manquantes (naturalWidth = 0)
  ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8",
};
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const full = resolve(join(ROOT, rel));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(full);
    res.writeHead(200, { "Content-Type": MIMES[extname(full).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length, "Cache-Control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404).end("404"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------ le son tient-il jusqu'au bout ? */
// Moyenne des niveaux seconde par seconde sur les deux secondes qui précèdent la
// fin du film : c'est là qu'un lit d'ambiance coupé trop tôt se voit.
function tailRms(perSec, filmSeconds) {
  const end = Math.min(perSec.length, Math.floor(filmSeconds) + 1);
  const from = Math.max(0, Math.floor(filmSeconds - 2.4));
  const slice = perSec.slice(from, Math.max(from + 1, end));
  return slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
}

/* --------------------------------------- mesure d'une bande WAV (sans Python) */
// Le studio annonce ses chiffres ; ici on les recalcule sur le fichier, avec un
// autre langage. Un trou de silence au milieu, c'est le bug « le son se coupe ».
function measureWave(path) {
  let bytes;
  try { bytes = readFileSync(path); } catch { return null; }
  if (bytes.length < 44) return null;
  if (bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WAVE") return null;
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= bytes.length) {
    const id = bytes.toString("latin1", pos, pos + 4);
    const size = bytes.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") fmt = { channels: bytes.readUInt16LE(body + 2), sr: bytes.readUInt32LE(body + 4), bits: bytes.readUInt16LE(body + 14) };
    if (id === "data") data = { body, size: Math.min(size, bytes.length - body) };
    pos = body + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) return null;
  const frames = Math.floor(data.size / (2 * fmt.channels));
  let peak = 0, sum = 0, clipped = 0, run = 0, longest = 0;
  const secs = new Array(Math.max(1, Math.ceil(frames / fmt.sr))).fill(0);
  const counts = new Array(secs.length).fill(0);
  for (let i = 0; i < frames; i++) {
    let v = 0;
    for (let c = 0; c < fmt.channels; c++) v += bytes.readInt16LE(data.body + (i * fmt.channels + c) * 2) / 32768;
    v /= fmt.channels;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sum += v * v;
    const s = Math.min(secs.length - 1, Math.floor(i / fmt.sr));
    secs[s] += v * v;
    counts[s]++;
    if (a < 0.0004) { run++; if (run > longest) longest = run; } else run = 0;
  }
  const perSec = secs.map((v, i) => Math.sqrt(v / Math.max(1, counts[i])));
  return {
    path, sr: fmt.sr, channels: fmt.channels, bytes: bytes.length,
    seconds: frames / fmt.sr, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / Math.max(1, frames)).toFixed(4),
    clipped, silentSeconds: perSec.filter((v) => v < 0.0005).length,
    longestSilence: +(longest / fmt.sr).toFixed(3),
    perSec: perSec.map((v) => +v.toFixed(5)),
  };
}

/* ------------------------------------------------------------------ outils */
function asciiRows(cols, cellAspect) { return Math.max(8, Math.round(cols / cellAspect / 2.1)); }

async function asciiFrame(page, cols, rows, band, bands) {
  const grid = await page.evaluate(({ cols, rows, band, bands }) => {
    const cv = document.getElementById("scene");
    const bh = cv.height / bands;
    const tmp = document.createElement("canvas");
    tmp.width = cols; tmp.height = rows;
    const c = tmp.getContext("2d");
    c.drawImage(cv, 0, band * bh, cv.width, bh, 0, 0, cols, rows);
    const d = c.getImageData(0, 0, cols, rows).data;
    const out = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        row.push(Math.round(((d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255) * 9));
      }
      out.push(row);
    }
    return out;
  }, { cols, rows, band, bands });
  return grid.map((row) => row.map((v) => RAMP[Math.max(0, Math.min(9, v))]).join("")).join("\n");
}

/* ---------------------------------------------------- audit de mise en page */
// Mesure ce que la mesure humaine vérifierait à l'œil : le film dans son cadre,
// aucun texte hors cadre, aucune superposition, des cibles tactiles utilisables.
async function auditLayout(page) {
  return page.evaluate(() => {
    const A = window.MOTION || window.N3;
    const L = A.layout();
    const frame = L.frame;
    const phone = !!A.phone();
    const problems = [];
    const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) *
                            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    const outside = (b, z, slack = 1) => b.x < z.x - slack || b.right > z.right + slack || b.y < z.y - slack || b.bottom > z.bottom + slack;

    // 1. le cadre tient dans la fenêtre
    if (outside(frame, L.stage)) problems.push(`cadre hors de la fenêtre (${frame.w}×${frame.h} dans ${L.stage.w}×${L.stage.h})`);

    // 2. chaque carton visible reste dans le cadre
    for (const c of L.cards) if (outside(c, frame)) problems.push(`« ${c.text} » hors du cadre`);

    // 3. les cartons ne se chevauchent pas
    for (let i = 0; i < L.cards.length; i++) for (let k = i + 1; k < L.cards.length; k++) {
      const a = L.cards[i], b = L.cards[k];
      if (area(a, b) > Math.min(a.w * a.h, b.w * b.h) * .06) problems.push(`chevauchement « ${a.text} » / « ${b.text} »`);
    }

    // 4. aucun carton ne passe sous les sous-titres
    for (const s of L.subs) for (const c of L.cards) {
      if (area(s, c) > 4) problems.push(`« ${c.text} » passe sous le sous-titre`);
      else if (s.y - c.bottom >= 0 && s.y - c.bottom < 4) problems.push(`« ${c.text} » collé au sous-titre`);
    }

    // 5. l'habillage reste dans la fenêtre et ne se chevauche pas
    const bits = [...L.togs, L.prog, ...L.hudTexts];
    for (const b of bits) if (outside(b, L.stage)) problems.push("un élément d'interface sort de la fenêtre");
    for (let i = 0; i < bits.length; i++) for (let k = i + 1; k < bits.length; k++)
      if (area(bits[i], bits[k]) > 4) problems.push("deux éléments d'interface se chevauchent");

    // 6. tailles de texte réellement affichées (le facteur d'échelle compte)
    const textNodes = (host) => [host, ...host.querySelectorAll("*")]
      .filter((n) => (n.textContent || "").trim() && n.children.length === 0);
    const floor = phone ? 12 : 9;
    // on juge la taille stabilisée (ui x fit) : l'instant capturé peut être en pleine entrée
    const all = [...document.querySelectorAll("#frame .card")];
    for (const c of L.cards) {
      const el = all[c.i];
      if (!el) { problems.push(`carton introuvable : « ${c.text} »`); continue; }
      const settled = (c.ui || 1) * (c.fit || 1);
      let min = Infinity, label = "";
      for (const n of textNodes(el)) {
        const s = parseFloat(window.getComputedStyle(n).fontSize) * settled;
        if (s < min) { min = s; label = (n.textContent || "").trim().slice(0, 22); }
      }
      if (min < floor) problems.push(`texte trop petit « ${label} » (${min.toFixed(1)} px)`);
    }
    for (const s of document.querySelectorAll("#frame .subline.show")) {
      const fs = parseFloat(window.getComputedStyle(s).fontSize);
      if (fs < (phone ? 15 : 14)) problems.push(`sous-titre trop petit (${fs.toFixed(1)} px)`);
    }
    for (const el of document.querySelectorAll("#hud .tog, #hudScene, #hudTc")) {
      const fs = parseFloat(window.getComputedStyle(el).fontSize);
      if (fs < (phone ? 11 : 12)) problems.push(`interface trop petite (${fs.toFixed(1)} px)`);
    }

    // 7. cibles tactiles : au moins 40 px de côté sur téléphone
    //    (accueil et fin sont mesurés séparément : un même écran ne montre qu'un jeu de boutons)
    if (phone) {
      const veil = document.getElementById("veil");
      const wasShown = veil.classList.contains("show"), wasEnd = veil.classList.contains("end");
      const tap = (sel, label) => {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const nom = el.textContent.trim() || el.id;
          if (r.width < 1) problems.push(`${label} invisible : « ${nom} »`);
          else if (r.width < 40 || r.height < 40) problems.push(`cible tactile trop petite (${label}) : « ${nom} » (${Math.round(r.width)}×${Math.round(r.height)})`);
        }
      };
      veil.classList.add("show");
      if (wasEnd) veil.classList.remove("end");
      tap("#go", "accueil");
      tap("#hud .tog", "habillage");
      veil.classList.add("end");
      tap("#replay, #closeEnd", "fin");
      if (!wasEnd) veil.classList.remove("end");
      if (!wasShown) veil.classList.remove("show");
    }

    return { phone, frame, cards: L.cards.length, subs: L.subs.length, problems: [...new Set(problems)] };
  });
}

/* ------------------------------------------------------------------ un film */
async function shoot(page, file) {
  const P = [], W = [], F = [];
  const ok = (m) => P.push(m), warn = (m) => W.push(m), bad = (m) => F.push(m);

  const slug = file.replace(/\.html$/, "");
  const dir = `${OUT}/${slug}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const errors = [];
  const onError = (e) => errors.push("pageerror: " + e.message);
  const onConsole = (m) => { if (m.type() === "error") errors.push("console: " + m.text()); };
  page.on("pageerror", onError);
  page.on("console", onConsole);

  await page.goto(`${BASE}/${encodeURIComponent(file)}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!(window.MOTION?.beats || window.N3?.beats), null, { timeout: 8000 });

  const meta = await page.evaluate(() => {
    const A = window.MOTION || window.N3;
    const c = document.getElementById("scene");
    return { duration: A.duration, beats: A.beats, lines: A.lines, scenes: A.scenes, cues: A.cues.length, w: c.width, h: c.height };
  });

  // format du film → format de la fenêtre
  const portrait = meta.h > meta.w;
  const long = 1152;
  const vw = portrait ? Math.round((long * meta.w) / meta.h) : long;
  const vh = portrait ? long : Math.round((long * meta.h) / meta.w);
  await page.setViewportSize({ width: vw, height: vh });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));

  const cols = COLS ?? (portrait ? 76 : 148);
  const bands = BANDS_OPT || (portrait ? 3 : 1);
  const rows = asciiRows(cols, meta.w / (meta.h / bands));
  ok(`format ${meta.w}×${meta.h} (${portrait ? "vertical" : "horizontal"}), fenêtre de contrôle ${vw}×${vh}`);

  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const seek = async (ms) => { await page.evaluate((t) => (window.MOTION || window.N3).seek(t), ms); await settle(); };

  const report = { file, size: [meta.w, meta.h], duration: meta.duration, beats: [], lines: [], audio: null, errors, checks: {} };

  // L'écran d'accueil recouvre le film tant qu'on n'a pas cliqué : on l'écarte
  // pour les captures, sinon les planches de contrôle montrent le carton de
  // départ et non le film (les mesures, elles, n'en dépendent pas).
  await page.evaluate(() => document.getElementById("veil").classList.remove("show"));

  /* instants clés */
  for (const [i, b] of meta.beats.entries()) {
    await seek(b.t);
    const stats = await page.evaluate(() => (window.MOTION || window.N3).frameStats());
    const label = b.label.replace(/^\d+[^\wÀ-ÿ]*/, "");
    const shot = `${String(i + 1).padStart(2, "0")}-${label.replace(/[^\wÀ-ÿ]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`;
    await page.locator("#stage").screenshot({ path: `${dir}/${shot}.png` });
    report.beats.push({ t: b.t, label: b.label, shot, stats });
    if (stats.meanLuma < 0.02 || stats.litRatio < 0.02 || stats.colors < 8) {
      bad(`image ${b.label} (${b.t} ms) : luma=${stats.meanLuma} éclairée=${stats.litRatio} teintes=${stats.colors}`);
    } else {
      ok(`image ${b.label} (${b.t} ms) : luma=${stats.meanLuma}, ${(stats.litRatio * 100).toFixed(0)} % d'image éclairée, ${stats.colors} teintes`);
    }
    if (ASCII && (!ONLY || ONLY.includes(i + 1))) {
      console.log(`\n  ▸ ${String(i + 1).padStart(2, "0")} · ${b.label} — ${b.t} ms`);
      for (let k = 0; k < bands; k++) {
        console.log((await asciiFrame(page, cols, rows, k, bands)).split("\n").map((l) => "  " + l).join("\n"));
        if (bands > 1 && k < bands - 1) console.log("  " + "·".repeat(cols));
      }
    }
  }

  /* sous-titres */
  for (const [i, L] of meta.lines.entries()) {
    // on mesure au milieu de la phrase **telle qu'elle a été prononcée** : la
    // fenêtre du studio (plan) prime sur celle du film, c'est elle qui est jouée
    const w = L.plan || L;
    const at = w.t + w.d * 0.5;
    await seek(at);
    const stats = await page.evaluate(() => (window.MOTION || window.N3).frameStats());
    const box = await page.locator(".subline.show").first().boundingBox().catch(() => null);
    const stageBox = await page.locator("#stage").boundingBox();
    const inside = !!box && box.y > stageBox.y && box.y + box.height < stageBox.y + stageBox.height - 4;
    const words = stats.subtitle?.words ?? 0;
    const onWord = stats.subtitle?.onWord ?? null;
    // le mot que le studio a mesuré à cet instant : c'est celui qui doit être surligné
    const want = L.plan
      ? (L.plan.words.find((x) => at - L.plan.t >= x.t0 && at - L.plan.t < x.t1)?.w ?? null)
      : null;
    report.lines.push({ i, t: L.t, txt: L.txt, words, onWord, inside, want,
      plan: L.plan ? { t: L.plan.t, d: L.plan.d, ms: L.plan.ms, scale: L.plan.scale } : null });
    if (!stats.subtitle) bad(`sous-titre ${i + 1} absent à ${Math.round(at)} ms`);
    else if (words < 4) bad(`sous-titre ${i + 1} trop court (${words} mots)`);
    else if (!onWord) bad(`sous-titre ${i + 1} : aucun mot surligné (le rythme mot à mot ne fonctionne pas)`);
    else if (!inside) bad(`sous-titre ${i + 1} sorti du cadre`);
    else if (want && onWord !== want) bad(`sous-titre ${i + 1} : « ${onWord} » surligné alors que la voix dit « ${want} » à cet instant`);
    else ok(`sous-titre ${i + 1} : « ${onWord} » surligné parmi ${words} mots` +
      (want ? ` — le même mot que la voix mesurée` : ""));
  }

  /* ------------------------------------------ l'habillage de diffusion
     Un film qui se présente comme une émission doit le montrer : bandeau LIVE,
     horloge de match, cartouche du commentateur, compo qui se confirme. On
     vérifie qu'il tient dans le cadre, qu'il suit la voix, et qu'il ne marche
     pas sur les sous-titres — ce que l'œil corrigerait et que l'outil doit voir. */
  if (await page.evaluate(() => !!(window.MOTION || window.N3).overlay)) {
    const probe = async (ms) => {
      await seek(ms);
      return page.evaluate(() => {
        const A = window.MOTION || window.N3;
        const fr = document.getElementById("frame").getBoundingClientRect();
        const box = (sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const r = e.getBoundingClientRect(), s = getComputedStyle(e);
          return { w: Math.round(r.width), h: Math.round(r.height), x: +r.x.toFixed(1), y: +r.y.toFixed(1),
            right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), fs: +parseFloat(s.fontSize).toFixed(1),
            shown: s.display !== "none" && r.width > 0 };
        };
        const sub = document.querySelector(".subline.show");
        const chips = [...document.querySelectorAll("#bugNames span")];
        return {
          frame: { x: +fr.x.toFixed(1), y: +fr.y.toFixed(1), right: +fr.right.toFixed(1), bottom: +fr.bottom.toFixed(1), w: Math.round(fr.width) },
          bug: box(".bug"), chan: box(".chan"), thirdBox: box(".third"),
          clock: A.overlay().clock, onAir: A.overlay().onAir, thirdText: A.overlay().third,
          errata: A.overlay().errata, stamp: A.overlay().stamp,
          errataTotal: A.errata ? A.errata().length : undefined,
          lit: chips.filter((c) => c.classList.contains("on")).length, chips: chips.length,
          sub: sub ? { y: +sub.getBoundingClientRect().y.toFixed(1) } : null,
        };
      });
    };

    // trois instants choisis sur le film lui-même : sur la première réplique,
    // dans le silence entre deux répliques, et près de la fin
    const clockOf = (ms) => {
      const s = Math.floor(ms / 1000);
      return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    };
    const first = meta.lines[0], second = meta.lines[1] ?? { t: meta.duration };
    const atEarly = 1500;
    const atOff = Math.round((first.t + first.d + second.t) / 2);
    // Le dernier instant est pris **dans la dernière réplique** (celle du carton
    // final) : depuis que la voix est mesurée, la phrase ne va plus jusqu'à la
    // toute fin du film, et un contrôle posé à durée−1,2 s ne verrait plus de
    // sous-titre du tout — donc plus rien à comparer au cartouche.
    const lastLine = meta.lines[meta.lines.length - 1];
    const lastWin = lastLine ? (lastLine.plan ? lastLine.plan.d : lastLine.d) : 0;
    const atLate = lastLine ? Math.round(lastLine.t + lastWin * 0.55) : meta.duration - 1200;
    const early = await probe(atEarly);
    const off = await probe(atOff);
    const late = await probe(atLate);
    report.overlay = { atEarly, atOff, atLate, early, off, late };

    const inside = (b, f) => b && b.shown && b.x >= f.x - 1 && b.right <= f.right + 1 && b.y >= f.y - 1 && b.bottom <= f.bottom + 1;
    if (!(inside(early.bug, early.frame) && inside(early.chan, early.frame) && inside(early.thirdBox, early.frame)))
      bad("l'habillage de diffusion sort du cadre");
    else ok(`habillage dans le cadre : bandeau LIVE ${early.bug.w}×${early.bug.h} px (texte ${early.bug.fs} px), chaîne, cartouche du commentateur`);
    const ratio = early.bug.fs / early.frame.w;
    if (ratio < .012) bad(`habillage illisible : ${early.bug.fs} px pour un cadre de ${early.frame.w} px`);
    else ok(`habillage proportionné au cadre (${(ratio * 100).toFixed(1)} % de la largeur)`);
    if (early.clock === clockOf(atEarly) && late.clock === clockOf(atLate))
      ok(`l'horloge de diffusion suit le film (${early.clock} à ${atEarly} ms, ${late.clock} à ${atLate} ms)`);
    else bad(`horloge de diffusion fausse : ${early.clock} à ${atEarly} ms (attendu ${clockOf(atEarly)}), ${late.clock} à ${atLate} ms (attendu ${clockOf(atLate)})`);
    if (early.onAir && !off.onAir)
      ok(`le témoin du micro suit le commentaire (allumé sur la réplique, éteint dans le silence) — ${early.thirdText}`);
    else bad(`le témoin du micro ne suit pas la voix (${atEarly} : ${early.onAir}, ${atOff} : ${off.onAir})`);
    if (late.chips > 0) {
      if (off.lit === 0 && late.lit === late.chips)
        ok(`l'habillage se remplit au fil du commentaire (${off.lit} puis ${late.lit} sur ${late.chips})`);
      else bad(`l'habillage ne suit pas le commentaire (${off.lit} à ${atOff} ms, ${late.lit} à ${atLate} ms sur ${late.chips})`);
    } else ok("l'habillage ne comporte pas de liste progressive");
    // compteur de bévues : il part de zéro, il monte, et le tampon apparaît avec lui
    if (typeof late.errata === "number") {
      if (early.errata === 0 && !early.stamp && late.errata === late.errataTotal && late.errata > 0 && late.stamp)
        ok(`le compteur d'erratums suit les bévues (0 puis ${late.errata} sur ${late.errataTotal}, tampon affiché)`);
      else bad(`le compteur d'erratums ne suit pas les bévues (${early.errata} → ${late.errata} sur ${late.errataTotal}, tampon ${late.stamp})`);
    }
    if (late.sub && late.thirdBox && late.thirdBox.bottom <= late.sub.y + 1)
      ok("le cartouche du commentateur ne marche pas sur les sous-titres");
    else bad("le cartouche du commentateur chevauche les sous-titres");
  }

  /* ------------------------------------------------- le film joué pour de vrai
     C'est ici qu'on attrape les bugs entendus : deux horloges qui dérivent, ou
     une reprise qui relance la bande depuis le début. On lit l'horloge du son et
     celle de l'image séparément, et on les met en face. */
  const api = () => page.evaluate(() => {
    const A = window.MOTION || window.N3;
    return { ...A.audio(), clock: A.clock() };
  });

  const ready = await api();
  report.playback = { ready };
  const assetName = readFileSync(file, "utf8").match(/const ASSET\s*=\s*"([^"]+)"/)?.[1] ?? "(aucune)";
  if (!ready.ok) bad(`le moteur audio n'a pas pu préparer sa bande (${ready.state})`);
  else ok(`bande prête : ${ready.source} de ${ready.buffer} s, niveau ramené à ${ready.trim}× (crête 0,9)`);
  if (ready.source === "bande") ok(`le film joue la bande du studio (${assetName})`);
  else warn(`le film calcule sa partition localement (${ready.source}) : même horloge, mais ce n'est pas la bande du studio`);

  // on repart du début : les captures ont promené la tête de lecture
  await page.evaluate(() => { const A = window.MOTION || window.N3; A.play(); A.startAt(0); });
  await page.waitForTimeout(1500);
  const run = await api();
  report.playback.running = run;
  if (run.state !== "running") bad(`le contexte audio ne tourne pas après le clic (état : ${run.state})`);
  else ok(`la lecture avance vraiment (contexte ${run.state}, ${run.time} ms)`);
  if (Math.abs(run.time - 1500) > 300) bad(`l'horloge du son ne suit pas le temps réel : ${run.time} ms après 1500 ms`);
  else ok(`l'horloge du son suit le temps réel (${run.time} ms en 1500 ms après le top)`);

  // l'image ne peut se redessiner qu'à chaque image : elle retarde la lecture du
  // son d'un tick. Ce qui compte, c'est que ce retard ne grandisse pas — c'est
  // exactement la signature des deux horloges qui dérivaient.
  const lag1 = run.time - run.clock;
  await page.waitForTimeout(1300);
  const later = await api();
  const lag2 = later.time - later.clock;
  report.playback.lag = { lag1: +lag1.toFixed(1), lag2: +lag2.toFixed(1) };
  if (Math.abs(lag2 - lag1) > 40) bad(`l'écart image/son grandit (${lag1.toFixed(1)} → ${lag2.toFixed(1)} ms en 1,3 s) : les deux horloges dérivent`);
  else ok(`aucune dérive : l'image reste à ${lag2.toFixed(1)} ms du son (écart inchangé sur 1,3 s)`);
  if (lag2 > 130) bad(`l'image retarde trop le son (${lag2.toFixed(1)} ms)`);
  else if (lag2 < -20) bad(`l'image avance sur le son (${lag2.toFixed(1)} ms)`);
  else ok(`image et son restent d'accord à moins d'un tick près (${later.clock} ms / ${later.time} ms)`);

  /* ------------------------------------------ la voix du studio, à l'écoute
     Le studio a prononcé les répliques une fois et les a chronométrées : on
     vérifie ici que le film joue **cette** bande-là, sur la même horloge, et que
     la bascule Voix la coupe sans toucher à la musique. */
  const voiceName = readFileSync(file, "utf8").match(/const VOICE_ASSET\s*=\s*"([^"]+)"/)?.[1] ?? "(aucune)";
  const v0 = await page.evaluate(() => (window.MOTION || window.N3).voice());
  report.voice = { ...v0, asset: voiceName };
  if (v0.source !== "studio" || !v0.plan) {
    warn(`aucune bande vocale du studio jouée (${v0.source}) : le film se rabat sur la voix du navigateur`);
  } else {
    ok(`voix du studio chargée : ${v0.lines} répliques mesurées par « ${v0.engine} », bande de ${v0.buffer} s (${voiceName})`);
    // la bande vocale dépasse un peu le film (queue de réverbération) : ce qui compte
    // est qu'elle le couvre, pas qu'elle fasse exactement la même longueur
    if (v0.buffer < meta.duration / 1000 - .4) bad(`la bande vocale est plus courte que le film (${v0.buffer} s pour ${meta.duration / 1000} s)`);
    else ok(`la bande vocale couvre le film (${v0.buffer} s ≥ ${meta.duration / 1000} s)`);
    if (v0.gain < .5) bad(`la voix n'est pas audible pendant la lecture (niveau ${v0.gain})`);
    else ok(`la voix est posée avec la bande (niveau ${v0.gain})`);
    await page.evaluate(() => document.getElementById("togVoice").click());
    await page.waitForTimeout(450);
    const vOff = await page.evaluate(() => (window.MOTION || window.N3).voice());
    await page.evaluate(() => document.getElementById("togVoice").click());
    await page.waitForTimeout(450);
    const vOn = await page.evaluate(() => (window.MOTION || window.N3).voice());
    report.voiceOff = vOff;
    report.voiceBack = vOn;
    if (vOff.gain > .05) bad(`la bascule Voix ne coupe pas la voix (niveau ${vOff.gain})`);
    else ok(`la bascule Voix coupe la voix (niveau ${vOff.gain}), sans toucher à la musique`);
    if (vOn.gain < .5) bad(`la bascule Voix ne rallume pas la voix (niveau ${vOn.gain})`);
    else ok(`la bascule Voix la rallume au bon niveau (${vOn.gain})`);
  }

  // pause : le contexte se gèle, donc son horloge aussi — sans trou ni dérive
  await page.evaluate(() => (window.MOTION || window.N3).pause());
  const p1 = await api();
  await page.waitForTimeout(800);
  const p2 = await api();
  report.playback.paused = { before: p1, after: p2 };
  if (p2.state !== "suspended") bad(`la pause ne gèle pas le contexte audio (état : ${p2.state})`);
  else if (Math.abs(p2.time - p1.time) > 25) bad(`le son continue pendant la pause : ${p1.time} → ${p2.time} ms en 800 ms`);
  else ok(`pause vraiment gelée : le son et son horloge n'avancent plus (${p1.time} → ${p2.time} ms en 800 ms)`);

  // reprise : elle doit repartir d'où elle s'était arrêtée, pas de zéro
  await page.evaluate(() => (window.MOTION || window.N3).play());
  await page.waitForTimeout(1000);
  const r2 = await api();
  report.playback.resumed = r2;
  if (r2.time < p1.time - 10) bad(`la reprise relance la bande depuis le début : ${p1.time} → ${r2.time} ms`);
  else if (Math.abs(r2.time - p1.time - 1000) > 300) bad(`la reprise ne repart pas du bon endroit : ${p1.time} → ${r2.time} ms (attendu ≈ +1000 ms)`);
  else ok(`reprise exactement là où le film s'était arrêté (${p1.time} → ${r2.time} ms, soit +1000 ms)`);
  if (r2.time - r2.clock > 130) bad(`après reprise, image et son se séparent : image ${r2.clock} ms, son ${r2.time} ms`);
  else ok(`après reprise, image et son toujours d'accord (${r2.clock} ms / ${r2.time} ms)`);
  await page.evaluate(() => (window.MOTION || window.N3).pause());

  /* --------------------------------------- la bande, mesurée sur le fichier */
  if (assetName !== "(aucune)") {
    const wave = measureWave(assetName);
    report.wave = wave;
    if (!wave) warn(`pas de bande à mesurer (${assetName}) — le film se rend localement`);
    else {
      ok(`bande mesurée sur le fichier : ${wave.sr} Hz, ${wave.channels} canal(aux), ${wave.seconds.toFixed(1)} s, ${(wave.bytes / 1e6).toFixed(2)} Mo`);
      if (wave.peak < 0.5) bad(`bande trop faible (crête ${wave.peak})`);
      else ok(`niveau de la bande : crête ${wave.peak}, RMS ${wave.rms}`);
      if (wave.longestSilence > 0.6) bad(`trou de silence de ${wave.longestSilence} s dans la bande — c'est le bug « le son se coupe »`);
      else ok(`aucun trou dans la bande (silence continu le plus long : ${wave.longestSilence} s)`);
      // et le son doit tenir jusqu'au dernier carton : un lit d'ambiance qui
      // s'éteint avant la fin s'entend comme un trou, même sans silence franc
      const tail = tailRms(wave.perSec, meta.duration / 1000);
      report.waveTail = +tail.toFixed(5);
      if (tail < 0.02) bad(`la bande s'éteint avant la fin (RMS ${tail.toFixed(4)} sur ses deux dernières secondes)`);
      else ok(`la bande tient jusqu'au dernier carton (RMS ${tail.toFixed(4)} sur ses deux dernières secondes)`);
      if (wave.clipped > 200) bad(`bande saturée (${wave.clipped} échantillons au maximum)`);
      else ok(`bande sans saturation (${wave.clipped} échantillon(s) au maximum)`);
      if (wave.seconds < meta.duration / 1000 - 0.4) bad(`bande plus courte que le film (${wave.seconds.toFixed(1)} s pour ${meta.duration / 1000} s)`);
      else ok(`bande au moins aussi longue que le film (${wave.seconds.toFixed(1)} s ≥ ${meta.duration / 1000} s)`);
    }
  }

  /* ------------------------------- la voix, mesurée sur son fichier aussi */
  if (voiceName !== "(aucune)") {
    const vwave = measureWave(voiceName);
    report.voiceWave = vwave;
    if (!vwave) warn(`pas de bande vocale à mesurer (${voiceName})`);
    else {
      ok(`voix mesurée sur le fichier : ${vwave.sr} Hz, ${vwave.channels} canal(aux), ${vwave.seconds.toFixed(1)} s, ${(vwave.bytes / 1e6).toFixed(2)} Mo`);
      if (vwave.peak < .5) bad(`voix trop faible (crête ${vwave.peak})`);
      else ok(`niveau de la voix : crête ${vwave.peak}, RMS ${vwave.rms}`);
      if (vwave.clipped > 200) bad(`voix saturée (${vwave.clipped} échantillons au maximum)`);
      else ok(`voix sans saturation (${vwave.clipped} échantillon(s) au maximum)`);
      if (vwave.seconds < meta.duration / 1000 - .4) bad(`bande vocale plus courte que le film (${vwave.seconds.toFixed(1)} s pour ${meta.duration / 1000} s)`);
      else ok(`bande vocale au moins aussi longue que le film (${vwave.seconds.toFixed(1)} s)`);
      // La voix doit s'entendre **dans chaque fenêtre annoncée** : c'est ce
      // contrôle qui attrape « le sous-titre s'allume, mais personne ne parle ».
      const silent = [];
      let speech = 0;
      for (const L of meta.lines) {
        const w = L.plan || L;
        const a = Math.max(0, Math.floor(w.t / 1000));
        const b = Math.min(vwave.perSec.length - 1, Math.ceil((w.t + w.d) / 1000));
        let top = 0;
        for (let s = a; s <= b; s++) top = Math.max(top, vwave.perSec[s]);
        if (top < .01) silent.push(L.txt.slice(0, 24));
        speech += w.d / 1000;
      }
      if (silent.length) bad(`silence dans la fenêtre de ${silent.length} réplique(s) : ${silent.join(" / ")}`);
      else ok(`chaque réplique s'entend dans sa fenêtre (${meta.lines.length} fenêtres, mesurées seconde par seconde)`);
      ok(`la voix occupe ${speech.toFixed(1)} s du film (${(speech / (meta.duration / 1000) * 100).toFixed(0)} % du temps)`);
    }
  }

  /* drapeaux : de vrais fichiers, chargés et lisibles par le film */
  // Les drapeaux ne sont plus dessinés dans le code : ce sont des PNG récupérés au
  // CDN par le studio. Un fichier absent se voit tout de suite — la pastille du
  // joueur reste vide — mais un fichier présent peut aussi ne pas être chargé
  // (chemin faux, image abîmée). On demande donc au film ce qu'il a vraiment en
  // main, et on relit chaque fichier pour compter ses couleurs : un drapeau uni
  // n'est pas un drapeau.
  const flags = await page.evaluate(async () => {
    const A = window.MOTION || window.N3;
    if (!A.flags) return null;
    const out = [];
    for (const f of A.flags()) {
      const im = new Image();
      await new Promise((done) => { im.onload = im.onerror = done; im.src = f.file; });
      let colors = 0;
      if (im.naturalWidth) {
        const cv = document.createElement("canvas");
        cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        const g = cv.getContext("2d");
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        const set = new Set();
        for (let i = 0; i < d.length; i += 4 * 31)
          set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4));
        colors = set.size;
      }
      out.push({ ...f, colors });
    }
    return out;
  });
  report.flags = flags;
  if (!flags) ok("ce film n'affiche aucun drapeau");
  else if (!flags.length) bad("le film déclare des drapeaux mais n'en charge aucun");
  else {
    const unloaded = flags.filter((f) => !f.loaded);
    if (unloaded.length) bad(`${unloaded.length} drapeau(x) que le film n'a pas pu lire : ${unloaded.map((f) => f.code).join(", ")}`);
    else ok(`les ${flags.length} drapeaux affichés par le film sont chargés (${flags.map((f) => f.code).join(", ")})`);
    const small = flags.filter((f) => f.loaded && (f.w < 160 || f.h < 100));
    if (small.length) bad(`drapeau(x) trop petit(s) pour la pastille : ${small.map((f) => `${f.code} ${f.w}×${f.h}`).join(", ")}`);
    else if (flags.length) ok(`résolution des fichiers : ${Math.min(...flags.map((f) => f.w))} px de large au minimum (${flags[0].w}×${flags[0].h} pour ${flags[0].code})`);
    const plain = flags.filter((f) => f.loaded && f.colors < 2);
    if (plain.length) bad(`${plain.length} fichier(s) d'une seule couleur (pas un drapeau) : ${plain.map((f) => f.code).join(", ")}`);
    else if (flags.length) ok(`chaque fichier porte un vrai dessin (${Math.min(...flags.map((f) => f.colors))} teintes au minimum, mesurées sur l'image)`);
  }

  /* son */
  const audio = await page.evaluate((ms) => (window.MOTION || window.N3).audioStats(ms / 1000), meta.duration + 800);
  report.audio = audio;
  if (!audio) {
    bad("rendu audio hors ligne impossible (OfflineAudioContext indisponible)");
  } else {
    const spark = audio.perSec.map((s) => " ▁▂▃▄▅▆▇█"[Math.min(8, Math.round(Math.min(8, s.rms * 120)))]).join("");
    console.log(`\n  Niveau sonore seconde par seconde — ${file}\n  ${spark}\n`);
    if (audio.peak < 0.02) bad(`partition quasi muette (crête ${audio.peak})`);
    else ok(`partition audible : crête ${audio.peak}, RMS ${audio.rms}`);
    if (audio.clipped > 200) bad(`écrêtage : ${audio.clipped} échantillons au maximum`);
    else ok(`aucun écrêtage notable (${audio.clipped} échantillons saturés)`);
    if (audio.silentSeconds > 3) bad(`${audio.silentSeconds} s de silence sur ${audio.seconds.toFixed(1)} s`);
    else ok(`musique continue : ${audio.silentSeconds} s de silence sur ${audio.seconds.toFixed(1)} s`);
    // même contrôle sur le rendu local : c'est lui qui joue le film sans réseau
    const tailJs = tailRms(audio.perSec.map((s) => s.rms), meta.duration / 1000);
    report.audioTail = +tailJs.toFixed(5);
    if (tailJs < 0.02) bad(`le rendu local s'éteint avant la fin (RMS ${tailJs.toFixed(4)} sur les deux dernières secondes)`);
    else ok(`le rendu local tient jusqu'au dernier carton (RMS ${tailJs.toFixed(4)} sur les deux dernières secondes)`);
    const quiet = audio.perSec.map((s, i) => (s.rms < 0.004 ? i : null)).filter((v) => v !== null);
    if (quiet.length > 8) warn(`passages très doux aux secondes : ${quiet.join(", ")} — vérifie le mixage`);
  }

  /* mise en page : le film doit rester dans son cadre et son habillage rester lisible */
  report.layout = [];
  for (const v of VIEWS) {
    await page.setViewportSize(v);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await settle();
    const tag = `${v.width}×${v.height}`;
    const frameInfo = await page.evaluate(() => { const f = (window.MOTION || window.N3).layout().frame; return { w: Math.round(f.w), h: Math.round(f.h) }; });
    let issues = 0, cards = 0, mode = "";
    for (const b of meta.beats) {
      await seek(b.t);
      const r = await auditLayout(page);
      cards += r.cards;
      mode = r.phone ? "téléphone" : "bureau";
      issues += r.problems.length;
      for (const p of r.problems) bad(`mise en page ${tag} · ${b.label} — ${p}`);
    }
    report.layout.push({ viewport: tag, beats: meta.beats.length, issues });
    const summary = `mise en page ${tag} (${mode}) : cadre ${frameInfo.w}×${frameInfo.h}, ${meta.beats.length} instants, ${cards} cartons affichés, ${issues} défaut(s)`;
    if (issues) bad(summary); else ok(summary);
  }
  if (VIEWS.length) await page.setViewportSize({ width: vw, height: vh });

  /* erreurs runtime */
  if (errors.length) errors.forEach((e) => bad("erreur runtime — " + e));
  else ok("aucune erreur JavaScript pendant les captures");

  page.off("pageerror", onError);
  page.off("console", onConsole);

  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2), "utf8");
  return { file, slug, dir, P, W, F, report, meta };
}

/* -------------------------------------------- le grand panel d'assets (page) */
// Le panel (`assets/panel.html`) est ce que le studio fabrique mis à plat :
// 77 lecteurs, 46 plaques, quatre films avec bande et voix, un filtre. C'est une
// page du dépôt, donc rien ne la relit jamais : ce contrôle l'ouvre pour de vrai,
// image par image et source par source — un `src` faux ou un script mort ne se
// voit qu'ici. Il photographie aussi la page, aux deux formats.
async function panelCheck(browser) {
  const P = [], W = [], F = [];
  const ok = (m) => P.push(m), warn = (m) => W.push(m), bad = (m) => F.push(m);
  const dir = `${OUT}/panel`;
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const res = await page.goto(`${BASE}/assets/panel.html`, { waitUntil: "load" });
  if (!res || !res.ok()) {
    bad(`le panel ne se charge pas (${res ? res.status() : "aucune réponse"})`);
    await page.close();
    return { file: "assets/panel.html", P, W, F, errors, dir };
  }

  const counts = await page.evaluate(() => ({
    sounds: document.querySelectorAll(".card.snd audio").length,
    films: document.querySelectorAll(".card.film").length,
    bands: document.querySelectorAll('audio[title="bande-son"]').length,
    voices: document.querySelectorAll('audio[title="voix"]').length,
    plates: document.querySelectorAll("figure.plate img").length,
    plateCols: getComputedStyle(document.querySelector(".plates")).gridTemplateColumns.split(" ").length,
    sheet: !!document.querySelector("details.sheet img"),
    sections: document.querySelectorAll("section[data-sec]").length,
    recipes: document.querySelectorAll(".copy").length,
  }));
  ok(`panel ouvert : ${counts.sections} familles, ${counts.sounds} sons jouables, ${counts.recipes} recettes citées`);
  ok(`panel : ${counts.films} films (${counts.bands} bandes, ${counts.voices} voix), ${counts.plates} plaques en ${counts.plateCols} colonne(s)${counts.sheet ? ", planche de contact" : ""}`);
  if (counts.plateCols < 2 && counts.plates > 4) bad(`les plaques s'empilent sur une seule colonne (${counts.plates} plaques)`);
  if (counts.films < 1 || counts.sounds < 20) bad(`le panel est presque vide (${counts.sounds} sons, ${counts.films} films)`);

  /* les images : on force le chargement paresseux, on descend, on attend */
  await page.evaluate(() => new Promise((done) => {
    document.querySelectorAll("img[loading]").forEach((i) => (i.loading = "eager"));
    let y = 0;
    const step = () => {
      window.scrollTo(0, y);
      y += window.innerHeight * .8;
      if (y < document.body.scrollHeight) setTimeout(step, 30); else { window.scrollTo(0, 0); done(); }
    };
    step();
  }));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  const img = await page.evaluate(() => {
    const all = [...document.images];
    return {
      total: all.length,
      broken: all.filter((i) => !i.complete || i.naturalWidth === 0)
        .map((i) => new URL(i.getAttribute("src"), document.baseURI).pathname),
      lazy: all.filter((i) => i.loading !== "eager").length,
    };
  });
  if (img.broken.length) bad(`${img.broken.length} image(s) sans fichier : ${img.broken.slice(0, 4).join(" / ")}`);
  else ok(`les ${img.total} images du panel se sont chargées (aucune coupure)`);

  /* les sources audio : chaque lecteur doit pointer sur un vrai fichier servi.
     On résout les `src` comme le navigateur (par rapport à la page), sinon un
     chemin faux — le bug « la page ne joue rien » — passerait inaperçu. */
  const srcs = await page.evaluate(() => [...new Set([...document.querySelectorAll("audio[src]")]
    .map((a) => new URL(a.getAttribute("src"), document.baseURI).href))]);
  const badSrc = [];
  let bytes = 0;
  for (const src of srcs) {
    const r = await page.request.get(src);
    const type = r.headers()["content-type"] || "";
    if (!r.ok() || !/audio\/(wav|x-wav)|application\/octet-stream/.test(type)) badSrc.push(`${new URL(src).pathname} (${r.status()} ${type})`);
    else bytes += Number(r.headers()["content-length"] || 0);
  }
  if (badSrc.length) bad(`${badSrc.length} source(s) audio muette(s) : ${badSrc.slice(0, 3).join(" / ")}`);
  else ok(`les ${srcs.length} sources audio du panel répondent (${(bytes / 1e6).toFixed(1)} Mo de son vérifié, un par un)`);

  /* le filtre : c'est le geste principal de la page, on l'exerce */
  const probe = "drapeau";
  const before = await page.evaluate(() => document.querySelectorAll("[data-name]:not(.hidden)").length);
  await page.fill("#q", probe);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    shown: document.querySelectorAll("[data-name]:not(.hidden)").length,
    named: [...document.querySelectorAll("[data-name]:not(.hidden)")].every((e) => e.dataset.name.toLowerCase().includes("drapeau")),
    empty: [...document.querySelectorAll("section[data-sec]")].filter((s) => s.classList.contains("hidden")).length,
  }));
  await page.fill("#q", "");
  await page.waitForTimeout(120);
  const back = await page.evaluate(() => document.querySelectorAll("[data-name]:not(.hidden)").length);
  if (!after.shown || after.shown >= before) bad(`le filtre « ${probe} » ne trie rien (${before} → ${after.shown} cartes)`);
  else ok(`le filtre « ${probe} » ne garde que ${after.shown} carte(s) sur ${before}, et masque ${after.empty} famille(s) vide(s)`);
  if (after.shown && !after.named) bad(`le filtre laisse passer des cartes qui ne contiennent pas « ${probe} »`);
  if (back !== before) bad(`vider le filtre ne rend pas toutes les cartes (${back} au lieu de ${before})`);
  else ok(`vider le filtre remet les ${back} cartes en place`);

  /* la page en images, aux deux formats */
  await page.screenshot({ path: `${dir}/panel-bureau.png`, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const phone = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, cols: getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length }));
  if (phone.over > 2) bad(`le panel déborde du cadre en téléphone (${phone.over} px de trop)`);
  else ok(`le panel tient dans 390 px (${phone.cols} colonne(s) de sons, aucun débordement)`);
  await page.screenshot({ path: `${dir}/panel-telephone.png`, fullPage: false });

  if (errors.length) errors.slice(0, 4).forEach((e) => bad("erreur dans le panel — " + e));
  else ok("aucune erreur JavaScript dans le panel");

  page.off("pageerror", () => {});
  await page.close();
  return { file: "assets/panel.html", P, W, F, errors, dir, counts, srcs: srcs.length, img: img.total, bytes };
}

/* --------------------------------------------------------------- exécution */
const browser = await chromium.launch();

/* le repli, sans bande : un film ouvert par double-clic (file://) n'a pas le
   droit de lire son fichier — il doit se rabattre sur son rendu local, garder
   la même horloge, et avancer quand même */
const fallback = !FILES.length ? null : await (async () => {
  const probe = await browser.newPage({ viewport: { width: 900, height: 506 } });
  const errs = [];
  probe.on("pageerror", (e) => errs.push(e.message));
  probe.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await probe.goto(pathToFileURL(resolve(FILES[0])).href, { waitUntil: "load" });
  await probe.waitForFunction(() => !!(window.MOTION?.beats || window.N3?.beats), null, { timeout: 8000 });
  // on attend que le film ait fini de calculer sa partition (ce qu'il fait sans réseau)
  await probe.waitForFunction(() => (window.MOTION || window.N3).audio().ready, null, { timeout: 20000 })
    .catch(() => {});
  const before = await probe.evaluate(() => {
    const A = window.MOTION || window.N3;
    return { ...A.audio(), voice: A.voice() };
  });
  await probe.evaluate(() => (window.MOTION || window.N3).play());
  await probe.waitForTimeout(1200);
  const after = await probe.evaluate(() => {
    const A = window.MOTION || window.N3;
    return { ...A.audio(), clock: A.clock(), voice: A.voice() };
  });
  await probe.close();
  return { file: FILES[0], before, after, errs };
})();

const page = await browser.newPage({ viewport: { width: 1152, height: 648 }, deviceScaleFactor: 1 });
const results = [];
for (const file of FILES) results.push(await shoot(page, file));
const panel = await panelCheck(browser);
await browser.close();
server.close();

/* planches de contrôle */
const figure = (b, slug, folder) => `      <figure><img src="${folder}/${b.shot}.png" alt="${b.label}" />
        <figcaption><b>${b.label}</b> · ${b.t} ms<br /><span>luma ${b.stats.meanLuma} · ${(b.stats.litRatio * 100).toFixed(0)} % éclairé · ${b.stats.colors} teintes · ${b.stats.activeCards} cartons</span></figcaption></figure>`;

const pageCss = `body{margin:0;background:#06080d;color:#f7f4ec;font-family:"Helvetica Neue",system-ui,sans-serif;padding:40px}
 h1{font-size:26px;letter-spacing:-.02em;margin:0 0 6px} h2{font-size:19px;margin:38px 0 14px;color:#f4d68a}
 p.lede{color:rgba(247,244,236,.55);font-size:14px;margin:0 0 26px}
 .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
 figure{margin:0;border:1px solid rgba(247,244,236,.12);border-radius:12px;overflow:hidden;background:#0a0e14}
 img{width:100%;display:block}
 figcaption{padding:10px 12px;font-size:12.5px;font-family:ui-monospace,monospace}
 figcaption span{color:rgba(247,244,236,.5)}
 table{width:100%;border-collapse:collapse;margin-top:22px;font:12px ui-monospace,monospace}
 td,th{border-bottom:1px solid rgba(247,244,236,.1);padding:7px 8px;text-align:left}
 a{color:#f4d68a}`;

for (const r of results) {
  const rows = r.report.beats.map((b) => figure(b, r.slug, r.slug)).join("\n");
  const sheet = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche — ${r.file}</title><style>${pageCss}</style></head><body>
<h1>Planche de contrôle — ${r.file}</h1>
<p class="lede">${r.meta.w}×${r.meta.h} · ${(r.meta.duration / 1000).toFixed(0)} s · son : crête ${r.report.audio?.peak ?? "?"} / RMS ${r.report.audio?.rms ?? "?"} · ${r.report.errors.length} erreur(s) de page</p>
<div class="grid">
${rows}
</div>
<table><tr><th>Réplique</th><th>Voix mesurée</th><th>Mot surligné</th><th>Mot attendu</th><th>Mots</th><th>Dans le cadre</th></tr>
${r.report.lines.map((l) => `<tr><td>${l.txt}</td><td>${l.plan ? (l.plan.ms / 1000).toFixed(2) + " s" : "—"}</td><td>${l.onWord ?? "—"}</td><td>${l.want ?? "—"}</td><td>${l.words}</td><td>${l.inside ? "oui" : "NON"}</td></tr>`).join("\n")}
</table>
</body></html>`;
  await writeFile(`${r.dir}/index.html`, sheet, "utf8");
}
/* la planche du panel : ses deux captures côte à côte, et ce qu'on y a mesuré */
await writeFile(`${OUT}/panel/index.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche — le grand panel</title><style>${pageCss}
 .two{display:grid;gap:16px;grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start}@media(max-width:900px){.two{grid-template-columns:1fr}}</style></head><body>
<h1>Planche de contrôle — ${panel.file}</h1>
<p class="lede">${panel.counts ? `${panel.counts.sounds} sons jouables · ${panel.counts.films} films (${panel.counts.bands} bandes, ${panel.counts.voices} voix) · ${panel.counts.plates} plaques · ${panel.counts.recipes} recettes` : "page non chargée"}</p>
<div class="two">
  <figure><img src="panel-bureau.png" alt="panel bureau" /><figcaption><b>bureau</b> · 1280×960</figcaption></figure>
  <figure><img src="panel-telephone.png" alt="panel téléphone" /><figcaption><b>téléphone</b> · 390×844</figcaption></figure>
</div>
<table><tr><th>Contrôle</th><th>Résultat</th></tr>
${[...panel.P.map((m) => ["✓", m]), ...panel.W.map((m) => ["!", m]), ...panel.F.map((m) => ["✗", m])].map(([k, m]) => `<tr><td>${k}</td><td>${m}</td></tr>`).join("\n")}
</table></body></html>`, "utf8");

await writeFile(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><title>Contrôles</title>
<body style="background:#06080d;color:#f7f4ec;font-family:system-ui;padding:40px">
<h1 style="font-size:24px">Planches de contrôle</h1>
<ul>${results.map((r) => `<li style="margin:6px 0"><a style="color:#f4d68a;font-family:ui-monospace,monospace" href="${r.slug}/index.html">${r.file}</a> — ${r.meta.w}×${r.meta.h}, ${r.meta.duration / 1000} s, ${r.P.length} ✓ / ${r.F.length} ✗</li>`).join("")}
<li style="margin:6px 0"><a style="color:#f4d68a;font-family:ui-monospace,monospace" href="panel/index.html">le grand panel d'assets</a> — ${panel.P.length} ✓ / ${panel.F.length} ✗</li></ul>
</body>`, "utf8");

/* repli file:// — un film sans sa bande doit rester vivant */
let passes = 0, warnings = 0, failures = 0;
if (fallback) {
console.log("");
console.log(`  Repli sans bande (file://) — ${fallback.file}`);
console.log("  " + "─".repeat(64));
{
  const { before, after, errs } = fallback;
  const test = (cond, good, badMsg) => {
    console.log(cond ? `  ✓ ${good}` : `  ✗ ${badMsg}`);
    if (cond) passes++; else failures++;
  };
  test(before.ok && before.source === "rendu ici",
    `sans fichier lisible, le film calcule sa partition (${before.source}, ${before.buffer} s)`,
    `aucune bande disponible : le film reste muet (${before.source}, ${before.state})`);
  test(after.state === "running" && after.clock > 600,
    `le film joue quand même, sur la même horloge (${after.clock} ms, contexte ${after.state})`,
    `le film ne démarre pas sans sa bande (${after.clock} ms, contexte ${after.state})`);
  test(Math.abs(after.time - after.clock) < 130,
    `image et son d'accord aussi dans le repli (${after.clock} ms / ${after.time} ms)`,
    `le repli désynchronise : image ${after.clock} ms, son ${after.time} ms`);
  test(after.voice.source !== "studio",
    `sans bande vocale lisible, le film retombe sur la voix du navigateur (${after.voice.source})`,
    `le film prétend jouer la voix du studio alors qu'il n'a pas pu la lire (${after.voice.source})`);
  test(errs.length === 0, "aucune erreur de page dans le repli", `erreur(s) : ${errs.slice(0, 3).join(" / ")}`);
}
}

/* synthèse */
for (const r of results) {
  console.log("");
  console.log(`  Vérification dynamique — ${r.file}  (${r.meta.w}×${r.meta.h})`);
  console.log("  " + "─".repeat(64));
  r.P.forEach((m) => console.log(`  ✓ ${m}`));
  r.W.forEach((m) => console.log(`  ! ${m}`));
  r.F.forEach((m) => console.log(`  ✗ ${m}`));
  passes += r.P.length; warnings += r.W.length; failures += r.F.length;
}
console.log("");
console.log(`  Vérification dynamique — le grand panel d'assets  (${panel.file})`);
console.log("  " + "─".repeat(64));
panel.P.forEach((m) => console.log(`  ✓ ${m}`));
panel.W.forEach((m) => console.log(`  ! ${m}`));
panel.F.forEach((m) => console.log(`  ✗ ${m}`));
passes += panel.P.length; warnings += panel.W.length; failures += panel.F.length;

console.log("\n  " + "─".repeat(64));
console.log(`  ${results.length} film(s) + le panel · ${passes} réussite(s) · ${warnings} réserve(s) · ${failures} échec(s)`);
console.log(`  Planches et rapports : ${OUT}/index.html\n`);
if (failures) process.exit(1);
console.log("  Films et panel conformes aux contrôles automatiques.");
