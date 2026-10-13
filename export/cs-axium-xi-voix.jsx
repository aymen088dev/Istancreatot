/* =====================================================================
   CS AXIUM — SCRIPT VOCAL, pour After Effects.
   Généré depuis cs-axium-xi.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1080×1920 de 46.2 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/cs-axium-xi.wav
   (voix « français · Tom (medium) », 9 répliques mesurées sur 9)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "CS AXIUM — voix · 1080x1920";
var WIDTH = 1080;
var HEIGHT = 1920;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 46.2;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 64;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 9 répliques. */
var LINES = [
  { t: 0.6, d: 2.813, txt: "Bonsoir à tous, Léonard Chose au micro." },
  { t: 6.8, d: 4.022, txt: "CS Axiom dévoile sa composition, ce soir." },
  { t: 13, d: 1.821, txt: "Et dans les buts, Haddad!" },
  { t: 16.4, d: 4.559, txt: "La défense : Lot Istanois, Benali, Hernancio, Sanchez." },
  { t: 22.6, d: 2.989, txt: "Mansouri en sentinelle, devant la défense." },
  { t: 26, d: 5.763, txt: "Le Boucher, Gelarza, Von Istanoix, Caruso : ils alimentent l'attaque !" },
  { t: 32.8, d: 1.955, txt: "Et Saidi, en pointe!" },
  { t: 35.6, d: 2.945, txt: "Sur le banc, neuf remplaçants prêts à entrer." },
  { t: 40.8, d: 3.838, txt: "CS Axiom, la composition : quatre un quatre un." },
];

/* La partition du film, en repères : 118 sons. */
var CUES = [
  { t: 0, name: "pad" },
  { t: 0, name: "crowd" },
  { t: 0, name: "air" },
  { t: 0.3, name: "whistle" },
  { t: 0.4, name: "sub" },
  { t: 0.5, name: "squeak" },
  { t: 1.2, name: "tom" },
  { t: 1.9, name: "blip" },
  { t: 2.6, name: "kick" },
  { t: 4.6, name: "kick" },
  { t: 5.6, name: "hush" },
  { t: 5.7, name: "riser" },
  { t: 6.4, name: "stamp" },
  { t: 6.4, name: "whoosh" },
  { t: 6.8, name: "blip" },
  { t: 7.2, name: "pad" },
  { t: 7.4, name: "rateTick" },
  { t: 7.8, name: "rateTick" },
  { t: 8.2, name: "rateTick" },
  { t: 8.6, name: "rateTick" },
  { t: 9, name: "rateTick" },
  { t: 9.2, name: "tom" },
  { t: 9.7, name: "riser" },
  { t: 10.6, name: "stamp" },
  { t: 10.6, name: "choir" },
  { t: 10.7, name: "whoosh" },
  { t: 11.8, name: "swell" },
  { t: 12.3, name: "whoosh" },
  { t: 12.9, name: "pad" },
  { t: 13, name: "blip" },
  { t: 13, name: "whoosh" },
  { t: 13, name: "whistle" },
  { t: 14.6, name: "jerseyDrop" },
  { t: 14.9, name: "jerseyLand" },
  { t: 15.1, name: "plateWipe" },
  { t: 15.3, name: "flagPop" },
  { t: 15.5, name: "rateDing" },
  { t: 18, name: "jerseyDrop" },
  { t: 18.3, name: "jerseyLand" },
  { t: 18.4, name: "plateWipe" },
  { t: 18.9, name: "jerseyDrop" },
  { t: 19.2, name: "jerseyLand" },
  { t: 19.3, name: "plateWipe" },
  { t: 19.8, name: "jerseyDrop" },
  { t: 20.1, name: "jerseyLand" },
  { t: 20.2, name: "plateWipe" },
  { t: 20.7, name: "jerseyDrop" },
  { t: 21, name: "jerseyLand" },
  { t: 21.1, name: "plateWipe" },
  { t: 21.3, name: "flagPop" },
  { t: 21.5, name: "rateDing" },
  { t: 21.6, name: "pad" },
  { t: 21.8, name: "jerseyDrop" },
  { t: 22.1, name: "jerseyLand" },
  { t: 22.2, name: "plateWipe" },
  { t: 22.4, name: "flagPop" },
  { t: 22.6, name: "rateDing" },
  { t: 25.8, name: "jerseyDrop" },
  { t: 26.1, name: "jerseyLand" },
  { t: 26.2, name: "plateWipe" },
  { t: 26.75, name: "jerseyDrop" },
  { t: 27.05, name: "jerseyLand" },
  { t: 27.15, name: "plateWipe" },
  { t: 27.7, name: "jerseyDrop" },
  { t: 28, name: "jerseyLand" },
  { t: 28.1, name: "plateWipe" },
  { t: 28.4, name: "pad" },
  { t: 28.65, name: "jerseyDrop" },
  { t: 28.95, name: "jerseyLand" },
  { t: 29.05, name: "plateWipe" },
  { t: 29.3, name: "flagPop" },
  { t: 29.5, name: "rateDing" },
  { t: 29.7, name: "crowdOhh" },
  { t: 32.9, name: "jerseyDrop" },
  { t: 33.2, name: "jerseyLand" },
  { t: 33.3, name: "plateWipe" },
  { t: 33.5, name: "flagPop" },
  { t: 33.7, name: "rateDing" },
  { t: 34, name: "blip" },
  { t: 34.1, name: "crowdOhh" },
  { t: 34.3, name: "tada" },
  { t: 34.7, name: "choir" },
  { t: 35.6, name: "blip" },
  { t: 35.7, name: "pad" },
  { t: 35.8, name: "whooshSoft" },
  { t: 36.7, name: "benchPop" },
  { t: 36.88, name: "benchTick" },
  { t: 37.13, name: "benchPop" },
  { t: 37.31, name: "benchTick" },
  { t: 37.56, name: "benchPop" },
  { t: 37.74, name: "benchTick" },
  { t: 37.99, name: "benchPop" },
  { t: 38.17, name: "benchTick" },
  { t: 38.42, name: "benchPop" },
  { t: 38.6, name: "benchTick" },
  { t: 38.85, name: "benchPop" },
  { t: 39.03, name: "benchTick" },
  { t: 39.28, name: "benchPop" },
  { t: 39.46, name: "benchTick" },
  { t: 39.71, name: "benchPop" },
  { t: 39.89, name: "benchTick" },
  { t: 40.14, name: "benchPop" },
  { t: 40.24, name: "pluck" },
  { t: 40.32, name: "benchTick" },
  { t: 40.5, name: "stamp" },
  { t: 40.6, name: "whoosh" },
  { t: 41.1, name: "whooshSoft" },
  { t: 41.3, name: "stamp" },
  { t: 41.4, name: "choir" },
  { t: 41.5, name: "crowdOhh" },
  { t: 41.8, name: "swell" },
  { t: 42, name: "pad" },
  { t: 42.3, name: "chime" },
  { t: 43.1, name: "sparkle" },
  { t: 44, name: "pluck" },
  { t: 44.9, name: "pluck" },
  { t: 45.8, name: "sparkle" },
  { t: 46, name: "whistle" },
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
  app.beginUndoGroup("CS AXIUM — script vocal");
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
  writeLn("CS AXIUM : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
