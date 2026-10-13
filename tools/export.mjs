#!/usr/bin/env bun
// ============================================================================
// tools/export.mjs — le script vocal d'un film, prêt à importer ailleurs.
//
// Le film tient déjà sa voix et ses sous-titres ; ce que le montage externe
// réclame, c'est la même partition de parole, hors du navigateur :
//
//   export/<film>-voix.jsx   script After Effects (ExtendScript) qui pose les
//                            calques texte horodatés et les repères de son
//   export/<film>-voix.txt   le texte, une réplique par ligne, avec ses temps
//
// Tout est lu dans le film lui-même (TOTAL, LINES, SCORE) : un export ne peut
// donc pas être en retard sur le montage. Relancer l'outil après toute
// modification du film.
//
//   bun run export                       tous les films du dépôt
//   bun tools/export.mjs cs-axium-xi.html
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const wanted = process.argv.slice(2).filter((a) => a.endsWith(".html"));
const FILES = wanted.length
  ? wanted
  : readdirSync(".").filter((f) => f.endsWith(".html")).sort();

for (const f of FILES) {
  if (!existsSync(f)) {
    console.error(`✗ film introuvable : ${f}`);
    process.exit(1);
  }
}

const OUT = "export";
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------- lecture */
// Même extraction que tools/verify.mjs : le film est la seule source.
function extractArray(src, name) {
  let i = src.indexOf(`const ${name}`);
  if (i < 0) return null;
  i = src.indexOf("[", i);
  if (i < 0) return null;
  let depth = 0, str = null, out = "";
  for (; i < src.length; i++) {
    const ch = src[i];
    if (str) {
      out += ch;
      if (ch === "\\") { out += src[++i]; continue; }
      if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { str = ch; out += ch; continue; }
    if (ch === "[") depth++;
    out += ch;
    if (ch === "]") { depth--; if (depth === 0) return out; }
  }
  return null;
}

function readFilm(file) {
  const html = readFileSync(file, "utf8");
  const total = Number(html.match(/const TOTAL\s*=\s*(\d+)/)?.[1] ?? 0);
  const lines = runInNewContext("(" + extractArray(html, "LINES") + ")");
  const cues = runInNewContext("(" + extractArray(html, "SCORE") + ")");
  const size = html.match(/const W = (\d+),\s*H = (\d+)/);
  const mic = html.match(/const MIC = \{ name: "([^"]+)", role: "([^"]+)" \}/);
  // La voix du studio : sa bande est le fichier à importer dans le montage, et
  // son plan porte la durée **réelle** de chaque phrase — c'est cette fenêtre-là
  // que les calques doivent suivre, pas la fenêtre espérée du film.
  const voiceAsset = html.match(/const VOICE_ASSET\s*=\s*"([^"]+)"/)?.[1] ?? null;
  const voicePlan = html.match(/const VOICE_PLAN\s*=\s*"([^"]+)"/)?.[1] ?? null;
  let plan = null;
  if (voicePlan && existsSync(voicePlan)) {
    try { plan = JSON.parse(readFileSync(voicePlan, "utf8")); } catch { plan = null; }
  }
  const measured = (i) => (plan?.lines?.[i] ? plan.lines[i].ms / 1000 : null);
  return {
    file,
    id: file.replace(/\.html$/, ""),
    title: (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? file).split("—")[0].trim(),
    asset: html.match(/const ASSET\s*=\s*"([^"]+)"/)?.[1] ?? null,
    voiceAsset,
    voice: plan?.engine?.label ?? null,
    total,
    w: size ? Number(size[1]) : 1080,
    h: size ? Number(size[2]) : 1920,
    mic: mic ? { name: mic[1], role: mic[2] } : null,
    lines: lines.map((l, i) => ({
      t: l.t / 1000,
      d: measured(i) ?? l.d / 1000,
      window: l.d / 1000,
      measured: measured(i) !== null,
      txt: String(l.txt).replace(/\s+/g, " "),
    })),
    cues: cues.map((c) => ({ t: c[0] / 1000, name: String(c[1]) })),
  };
}

/* --------------------------------------------------------- fabrication */
const es3 = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const num = (n) => (Math.round(n * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "") || "0";

function jsx(film) {
  const L = film.lines
    .map((l) => `  { t: ${num(l.t)}, d: ${num(l.d)}, txt: "${es3(l.txt)}" },`)
    .join("\n");
  const C = film.cues
    .map((c) => `  { t: ${num(c.t)}, name: "${c.name}" },`)
    .join("\n");
  const secs = film.total / 1000;
  return `/* =====================================================================
   ${film.title.toUpperCase()} — SCRIPT VOCAL, pour After Effects.
   Généré depuis ${film.file} par tools/export.mjs (ne pas modifier à la
   main : relancer \`bun run export\` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition ${film.w}×${film.h} de ${num(secs)} s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     ${film.voiceAsset ?? "(aucune voix fabriquée pour ce film)"}${film.voice ? `\n   (voix « ${film.voice} », ${film.lines.filter((l) => l.measured).length} répliques mesurées sur ${film.lines.length})` : ""}
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "${es3(film.title.toUpperCase())} — voix · ${film.w}x${film.h}";
var WIDTH = ${film.w};
var HEIGHT = ${film.h};
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = ${num(secs)};  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = ${Math.round(film.w / 17)};
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). ${film.lines.length} répliques. */
var LINES = [
${L}
];

/* La partition du film, en repères : ${film.cues.length} sons. */
var CUES = [
${C}
];

function findComp(name) {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof CompItem && it.name === name) return it;
  }
  return null;
}

function main() {
  if (!app.project) app.newProject();
  app.beginUndoGroup("${es3(film.title)} — script vocal");
  var made = 0, comp = null;

  comp = findComp(COMP_NAME);
  if (comp && !KEEP_EXISTING) {
    // on repart propre : l'ancienne composition portait sans doute l'ancien montage
    comp.remove();
    comp = null;
  }
  if (!comp) {
    comp = app.project.items.addComp(COMP_NAME, WIDTH, HEIGHT, 1, DURATION, FPS);
    comp.openInViewer();
  }

  var i, layer, src, doc;
  for (i = 0; i < LINES.length; i++) {
    var line = LINES[i];
    layer = comp.layers.addText(line.txt);
    layer.name = pad(i + 1) + " · " + line.txt.substring(0, 28);
    src = layer.property("Source Text");
    doc = src.value;
    doc.resetCharStyle();
    doc.fontSize = FONT_SIZE;
    doc.applyFill = true;
    doc.fillColor = [0.96, 0.90, 0.76];
    doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    src.setValue(doc);
    layer.property("Transform").property("Position").setValue([WIDTH / 2, HEIGHT * SUBTITLE_Y]);
    layer.inPoint = line.t;
    layer.outPoint = Math.min(line.t + line.d, DURATION);
    made++;
  }

  for (i = 0; i < CUES.length; i++) {
    comp.markerProperty.setValueAtTime(CUES[i].t, new MarkerValue(CUES[i].name));
  }

  app.endUndoGroup();
  writeLn("${es3(film.title)} : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \\"" + comp.name + "\\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
`;
}

function txt(film) {
  const head = [
    `${film.title.toUpperCase()} — SCRIPT VOCAL`,
    `Film : ${film.file} · ${num(film.total / 1000)} s · ${film.lines.length} répliques${film.mic ? ` · au micro : ${film.mic.name}` : ""}`,
    film.asset ? `Bande-son : ${film.asset} (${film.cues.length} sons)` : "",
    film.voiceAsset
      ? `Voix à importer : ${film.voiceAsset}${film.voice ? ` (voix « ${film.voice} »)` : ""}`
      : "Voix : aucune bande fabriquée (enregistrer la voix à partir de ces temps)",
    film.lines.some((l) => l.measured)
      ? "Durées : voix mesurée par le studio, phrase par phrase (plan vocal)"
      : "Durées : fenêtres du film (estimation)",
    "",
    "  début    fin   durée   voix    réplique",
    "  ------  ------  -----  ------  --------------------------------------------------------",
  ].filter(Boolean);
  const rows = film.lines.map((l) => {
    const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
    return `  ${fmt(l.t)}  ${fmt(l.t + l.d)}  ${l.d.toFixed(2).padStart(5)}  ` +
      `${(l.measured ? "oui" : "—").padStart(6)}  ${l.txt}`;
  });
  return [...head, ...rows, ""].join("\n");
}

/* ------------------------------------------------------------- écriture */
let lines = 0, cues = 0;
for (const file of FILES) {
  const film = readFilm(file);
  writeFileSync(`${OUT}/${film.id}-voix.jsx`, jsx(film), "utf8");
  writeFileSync(`${OUT}/${film.id}-voix.txt`, txt(film), "utf8");
  lines += film.lines.length;
  cues += film.cues.length;
  console.log(`  ${film.id.padEnd(18)} ${String(film.lines.length).padStart(2)} répliques · ` +
    `${String(film.cues.length).padStart(3)} sons · ${num(film.total / 1000)} s` +
    `  → export/${film.id}-voix.jsx  +  .txt`);
}
console.log(`\n  ${FILES.length} film(s), ${lines} répliques, ${cues} sons exportés dans ${OUT}/`);
