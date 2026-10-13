/* =====================================================================
   HEROBRINE — SCRIPT VOCAL, pour After Effects.
   Généré depuis herobrine.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1080×1920 de 42 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/herobrine.wav
   (voix « français · Tom (medium) », 8 répliques mesurées sur 8)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "HEROBRINE — voix · 1080x1920";
var WIDTH = 1080;
var HEIGHT = 1920;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 42;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 64;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 8 répliques. */
var LINES = [
  { t: 0.7, d: 3.853, txt: "Nouveau monde. Survie. Seul, et sans personne." },
  { t: 5.9, d: 3.287, txt: "La nuit tombe, et quelque chose me suit dans le noir." },
  { t: 11.3, d: 3.325, txt: "Mes torches s'éteignent. Mes coffres sont vidés." },
  { t: 16.7, d: 3.626, txt: "Un tunnel droit, creusé dans la pierre, sans porte." },
  { t: 22.1, d: 3.649, txt: "En haut de la colline, une silhouette me regarde." },
  { t: 27.5, d: 2.988, txt: "Deux yeux blancs. Il ne faut jamais le fixer." },
  { t: 32.9, d: 3.072, txt: "Il vient d'entrer dans ma partie. J'ai peur." },
  { t: 37.2, d: 2.78, txt: "Herobrine. Ce monde n'est plus à moi." },
];

/* La partition du film, en repères : 126 sons. */
var CUES = [
  { t: 0, name: "air" },
  { t: 0, name: "crowd" },
  { t: 0, name: "pad" },
  { t: 0.26, name: "door" },
  { t: 0.7, name: "blip" },
  { t: 1.1, name: "jerseyDrop" },
  { t: 1.6, name: "coinTick" },
  { t: 2.05, name: "coinTick" },
  { t: 2.4, name: "coinLand" },
  { t: 2.75, name: "flagPop" },
  { t: 3.1, name: "ignite" },
  { t: 3.4, name: "sweep" },
  { t: 3.9, name: "pluck" },
  { t: 4.3, name: "rateTick" },
  { t: 4.6, name: "rateTick" },
  { t: 4.9, name: "jerseyLand" },
  { t: 5.1, name: "shimmer" },
  { t: 5.4, name: "blip" },
  { t: 5.65, name: "chip" },
  { t: 5.9, name: "jerseyLand" },
  { t: 6.3, name: "pluck" },
  { t: 6.6, name: "whooshSoft" },
  { t: 7.2, name: "hush" },
  { t: 7.35, name: "sub" },
  { t: 7.6, name: "phoneBuzz" },
  { t: 7.9, name: "jerseyLand" },
  { t: 8.3, name: "whooshSoft" },
  { t: 8.5, name: "tom" },
  { t: 8.75, name: "rateTick" },
  { t: 9.1, name: "trace" },
  { t: 9.6, name: "crowdOhh" },
  { t: 10.1, name: "riser" },
  { t: 10.5, name: "ignite" },
  { t: 10.8, name: "sparkle" },
  { t: 11.1, name: "squeak" },
  { t: 11.5, name: "kick" },
  { t: 11.9, name: "whooshDeep" },
  { t: 12.3, name: "chip" },
  { t: 12.6, name: "chip" },
  { t: 12.9, name: "benchTick" },
  { t: 13.2, name: "whistle" },
  { t: 13.6, name: "hush" },
  { t: 14.05, name: "sub" },
  { t: 14.2, name: "whooshDeep" },
  { t: 14.5, name: "jerseyLand" },
  { t: 14.9, name: "jerseyLand" },
  { t: 15.3, name: "rateTick" },
  { t: 15.7, name: "impactSoft" },
  { t: 16.1, name: "trace" },
  { t: 16.5, name: "door" },
  { t: 16.9, name: "blip" },
  { t: 17.3, name: "hush" },
  { t: 17.6, name: "phoneBuzz" },
  { t: 17.9, name: "squeak" },
  { t: 18.3, name: "impactSoft" },
  { t: 18.6, name: "chime" },
  { t: 19, name: "choir" },
  { t: 19.4, name: "plateWipe" },
  { t: 19.8, name: "riser" },
  { t: 20.4, name: "whoosh" },
  { t: 21.1, name: "sub" },
  { t: 21.2, name: "pad" },
  { t: 21.6, name: "hush" },
  { t: 21.9, name: "whistle" },
  { t: 22.4, name: "coinTick" },
  { t: 22.8, name: "tom" },
  { t: 23.2, name: "crowdGasp" },
  { t: 23.6, name: "pluck" },
  { t: 24.1, name: "riser" },
  { t: 24.5, name: "whooshDeep" },
  { t: 24.9, name: "choir" },
  { t: 25.4, name: "stamp" },
  { t: 25.7, name: "sparkle" },
  { t: 26, name: "hush" },
  { t: 26.3, name: "riser" },
  { t: 26.6, name: "micThud" },
  { t: 26.6, name: "impact" },
  { t: 26.9, name: "sweep" },
  { t: 27.2, name: "tada" },
  { t: 27.6, name: "whooshSoft" },
  { t: 28.1, name: "engine" },
  { t: 28.4, name: "kick" },
  { t: 28.7, name: "jerseyLand" },
  { t: 29.1, name: "jerseyLand" },
  { t: 29.4, name: "rateTick" },
  { t: 29.5, name: "jerseyLand" },
  { t: 29.9, name: "jerseyLand" },
  { t: 30.3, name: "jerseyLand" },
  { t: 30.4, name: "crowdOhh" },
  { t: 30.7, name: "jerseyLand" },
  { t: 31.1, name: "jerseyLand" },
  { t: 31.3, name: "riser" },
  { t: 31.5, name: "jerseyLand" },
  { t: 31.9, name: "jerseyLand" },
  { t: 32.1, name: "whistle" },
  { t: 32.3, name: "jerseyLand" },
  { t: 32.5, name: "whoosh" },
  { t: 32.7, name: "jerseyLand" },
  { t: 33.1, name: "jerseyLand" },
  { t: 33.2, name: "crowdGasp" },
  { t: 33.5, name: "jerseyLand" },
  { t: 33.8, name: "phoneBuzz" },
  { t: 33.9, name: "jerseyLand" },
  { t: 34.2, name: "riser" },
  { t: 34.5, name: "whooshDeep" },
  { t: 34.8, name: "sweep" },
  { t: 35.1, name: "whoosh" },
  { t: 35.4, name: "resolve" },
  { t: 35.7, name: "choir" },
  { t: 36, name: "pad" },
  { t: 36.3, name: "chip" },
  { t: 36.6, name: "chip" },
  { t: 36.9, name: "chip" },
  { t: 37.2, name: "blip" },
  { t: 37.5, name: "sparkle" },
  { t: 37.9, name: "pad" },
  { t: 38.2, name: "chime" },
  { t: 38.6, name: "shimmer" },
  { t: 39, name: "coinLand" },
  { t: 39.3, name: "rateTick" },
  { t: 39.7, name: "rateTick" },
  { t: 40.1, name: "rateTick" },
  { t: 40.6, name: "chime" },
  { t: 41, name: "sparkle" },
  { t: 41.4, name: "whistle" },
  { t: 41.8, name: "jerseyDrop" },
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
  app.beginUndoGroup("HEROBRINE — script vocal");
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
  writeLn("HEROBRINE : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
