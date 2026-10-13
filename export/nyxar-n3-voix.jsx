/* =====================================================================
   NYXAR N3 — SCRIPT VOCAL, pour After Effects.
   Généré depuis nyxar-n3.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1920×1080 de 37 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/nyxar-n3.wav
   (voix « français · Tom (medium) », 6 répliques mesurées sur 6)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "NYXAR N3 — voix · 1920x1080";
var WIDTH = 1920;
var HEIGHT = 1080;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 37;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 113;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 6 répliques. */
var LINES = [
  { t: 0.7, d: 3.886, txt: "Istanbul s'éveille. Et la Nyxar N3 arrive." },
  { t: 7, d: 4.918, txt: "Voici la Nyxar N3, une berline familiale dessinée ici." },
  { t: 15, d: 5.001, txt: "Cinq places, un grand coffre, et quatre virgule huit litres aux cent kilomètres." },
  { t: 22.8, d: 3.673, txt: "Douze mille istancoins : c'est le prix de la N3." },
  { t: 27.9, d: 3.792, txt: "Disponible à Istanbul, en Espagne et au Portugal." },
  { t: 32.4, d: 4.302, txt: "Nyxar N3. La famille d'abord, la route ensuite." },
];

/* La partition du film, en repères : 60 sons. */
var CUES = [
  { t: 0, name: "pad" },
  { t: 0, name: "air" },
  { t: 0.3, name: "sub" },
  { t: 2.2, name: "kick" },
  { t: 4.4, name: "kick" },
  { t: 4.9, name: "riser" },
  { t: 6.5, name: "impact" },
  { t: 6.5, name: "whoosh" },
  { t: 6.85, name: "trace" },
  { t: 7.15, name: "trace" },
  { t: 7.45, name: "trace" },
  { t: 7.75, name: "trace" },
  { t: 8.05, name: "trace" },
  { t: 8.35, name: "trace" },
  { t: 8.65, name: "trace" },
  { t: 8.95, name: "trace" },
  { t: 9, name: "pad" },
  { t: 9.2, name: "chordUp" },
  { t: 10.4, name: "sweep" },
  { t: 11.8, name: "engine" },
  { t: 12.3, name: "ignite" },
  { t: 14.5, name: "whoosh" },
  { t: 14.6, name: "impactSoft" },
  { t: 14.6, name: "pad" },
  { t: 15.3, name: "chip" },
  { t: 16.5, name: "chip" },
  { t: 16.7, name: "door" },
  { t: 17.7, name: "chip" },
  { t: 18.9, name: "chip" },
  { t: 20.1, name: "chip" },
  { t: 22.5, name: "whooshDeep" },
  { t: 22.6, name: "pad" },
  { t: 22.75, name: "coinTick" },
  { t: 23.1, name: "coinTick" },
  { t: 23.4, name: "coinTick" },
  { t: 23.65, name: "coinTick" },
  { t: 23.85, name: "coinTick" },
  { t: 24, name: "coinTick" },
  { t: 24.15, name: "coinTick" },
  { t: 24.28, name: "coinTick" },
  { t: 24.38, name: "coinTick" },
  { t: 24.46, name: "coinTick" },
  { t: 24.72, name: "coinLand" },
  { t: 24.76, name: "chime" },
  { t: 28, name: "whoosh" },
  { t: 28.2, name: "pad" },
  { t: 28.3, name: "shimmer" },
  { t: 28.8, name: "pluck" },
  { t: 29.4, name: "pluck" },
  { t: 30, name: "pluck" },
  { t: 30.35, name: "blip" },
  { t: 30.6, name: "pluck" },
  { t: 31.2, name: "pluck" },
  { t: 31.2, name: "blip" },
  { t: 31.8, name: "pluck" },
  { t: 33, name: "whooshSoft" },
  { t: 33.2, name: "pad" },
  { t: 33.3, name: "resolve" },
  { t: 34.8, name: "sparkle" },
  { t: 36.1, name: "sparkle" },
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
  app.beginUndoGroup("Nyxar N3 — script vocal");
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
  writeLn("Nyxar N3 : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
