/* =====================================================================
   LITEL — SCRIPT VOCAL, pour After Effects.
   Généré depuis litel.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1920×1080 de 40 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/litel.wav
   (voix « français · Tom (medium) », 6 répliques mesurées sur 6)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "LITEL — voix · 1920x1080";
var WIDTH = 1920;
var HEIGHT = 1080;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 40;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 113;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 6 répliques. */
var LINES = [
  { t: 0.9, d: 3.458, txt: "Litel ouvre ses portes : bienvenue dans le magasin." },
  { t: 7.2, d: 3.399, txt: "Des petits prix dans tous les rayons, sans exception." },
  { t: 14.3, d: 3.474, txt: "Cinq istancoins la boîte, et huit pour la deuxième." },
  { t: 21.8, d: 2.645, txt: "Chaque lot est vérifié avant de partir d'ici." },
  { t: 28.7, d: 3.434, txt: "Livraison en vingt-quatre heures, partout dans Istan." },
  { t: 34.7, d: 3.123, txt: "Litel : des petits prix, grande qualité." },
];

/* La partition du film, en repères : 71 sons. */
var CUES = [
  { t: 0, name: "pad" },
  { t: 0, name: "air" },
  { t: 0.3, name: "sub" },
  { t: 1.4, name: "chip" },
  { t: 2.6, name: "kick" },
  { t: 4.2, name: "riser" },
  { t: 5.6, name: "whooshSoft" },
  { t: 5.9, name: "tada" },
  { t: 6.5, name: "impact" },
  { t: 6.6, name: "pad" },
  { t: 6.85, name: "door" },
  { t: 7.3, name: "chime" },
  { t: 7.7, name: "coinTick" },
  { t: 8.1, name: "chip" },
  { t: 8.6, name: "pluck" },
  { t: 9.2, name: "coinTick" },
  { t: 9.7, name: "chip" },
  { t: 10.3, name: "pluck" },
  { t: 10.9, name: "sparkle" },
  { t: 11.6, name: "shimmer" },
  { t: 12.3, name: "pluck" },
  { t: 12.9, name: "chip" },
  { t: 14, name: "whoosh" },
  { t: 14.2, name: "pad" },
  { t: 14.4, name: "coinTick" },
  { t: 14.8, name: "coinTick" },
  { t: 15.1, name: "coinTick" },
  { t: 15.35, name: "coinTick" },
  { t: 15.55, name: "coinTick" },
  { t: 15.75, name: "stamp" },
  { t: 16.2, name: "coinLand" },
  { t: 16.6, name: "chime" },
  { t: 17.4, name: "blip" },
  { t: 18.1, name: "pluck" },
  { t: 18.9, name: "coinTick" },
  { t: 19.5, name: "coinLand" },
  { t: 20.2, name: "sparkle" },
  { t: 20.8, name: "shimmer" },
  { t: 21.5, name: "whooshDeep" },
  { t: 21.7, name: "pad" },
  { t: 22.2, name: "door" },
  { t: 23, name: "chip" },
  { t: 24, name: "trace" },
  { t: 24.4, name: "trace" },
  { t: 24.55, name: "impactSoft" },
  { t: 24.8, name: "trace" },
  { t: 25.2, name: "stamp" },
  { t: 25.8, name: "chime" },
  { t: 26.6, name: "sparkle" },
  { t: 27.4, name: "resolve" },
  { t: 28.1, name: "shimmer" },
  { t: 28.3, name: "sweep" },
  { t: 28.5, name: "whoosh" },
  { t: 28.7, name: "pad" },
  { t: 29.1, name: "engine" },
  { t: 29.8, name: "chip" },
  { t: 30.5, name: "coinLand" },
  { t: 31.2, name: "blip" },
  { t: 31.8, name: "pluck" },
  { t: 32.5, name: "whooshSoft" },
  { t: 33.2, name: "chip" },
  { t: 33.9, name: "pluck" },
  { t: 34.5, name: "swell" },
  { t: 35, name: "whooshSoft" },
  { t: 35.2, name: "pad" },
  { t: 35.4, name: "chordUp" },
  { t: 35.8, name: "resolve" },
  { t: 37, name: "sparkle" },
  { t: 38.4, name: "sparkle" },
  { t: 39.1, name: "chime" },
  { t: 39.6, name: "hush" },
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
  app.beginUndoGroup("Litel — script vocal");
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
  writeLn("Litel : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
