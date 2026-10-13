/* =====================================================================
   ASTAN CITY — SCRIPT VOCAL, pour After Effects.
   Généré depuis astan-city-xi.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1080×1920 de 43.4 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/astan-city-xi.wav
   (voix « français · Tom (medium) », 8 répliques mesurées sur 8)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "ASTAN CITY — voix · 1080x1920";
var WIDTH = 1080;
var HEIGHT = 1920;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 43.4;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 64;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 8 répliques. */
var LINES = [
  { t: 0.6, d: 2.92, txt: "Bonsoir à tous, Léonard Chose au micro." },
  { t: 6.3, d: 3.518, txt: "Astan City dévoile son onze de départ, ce soir." },
  { t: 12.4, d: 1.721, txt: "Et dans les buts, Sako!" },
  { t: 15.8, d: 4.994, txt: "La défense à quatre : Fouhez, Rolberg, Elhussin, Comistani." },
  { t: 21.6, d: 5.927, txt: "Au milieu, Mikkelsen et Belmadi. Devant, Elke, Sholke et Dempsey!" },
  { t: 28.1, d: 1.794, txt: "Et Keytez en pointe!" },
  { t: 31.8, d: 2.788, txt: "Sur le banc, dix remplaçants prêts à entrer." },
  { t: 37.8, d: 3.585, txt: "Astan City, onze de départ : quatre deux trois un." },
];

/* La partition du film, en repères : 119 sons. */
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
  { t: 4.4, name: "kick" },
  { t: 5.2, name: "hush" },
  { t: 5.3, name: "riser" },
  { t: 6, name: "stamp" },
  { t: 6, name: "whoosh" },
  { t: 6.4, name: "blip" },
  { t: 6.8, name: "rateTick" },
  { t: 7, name: "pad" },
  { t: 7.2, name: "rateTick" },
  { t: 7.6, name: "rateTick" },
  { t: 8, name: "rateTick" },
  { t: 8.4, name: "rateTick" },
  { t: 8.8, name: "rateTick" },
  { t: 9.2, name: "tom" },
  { t: 9.7, name: "riser" },
  { t: 10.3, name: "stamp" },
  { t: 10.3, name: "choir" },
  { t: 10.4, name: "whoosh" },
  { t: 11.4, name: "swell" },
  { t: 11.9, name: "whoosh" },
  { t: 12.3, name: "pad" },
  { t: 12.4, name: "blip" },
  { t: 12.4, name: "whoosh" },
  { t: 12.4, name: "whistle" },
  { t: 14, name: "jerseyDrop" },
  { t: 14.3, name: "jerseyLand" },
  { t: 14.5, name: "plateWipe" },
  { t: 14.7, name: "flagPop" },
  { t: 14.9, name: "rateDing" },
  { t: 18.5, name: "jerseyDrop" },
  { t: 18.8, name: "jerseyLand" },
  { t: 18.9, name: "plateWipe" },
  { t: 19.3, name: "jerseyDrop" },
  { t: 19.55, name: "jerseyLand" },
  { t: 19.65, name: "plateWipe" },
  { t: 20.05, name: "jerseyDrop" },
  { t: 20.3, name: "jerseyLand" },
  { t: 20.4, name: "plateWipe" },
  { t: 20.8, name: "jerseyDrop" },
  { t: 21.05, name: "jerseyLand" },
  { t: 21.15, name: "plateWipe" },
  { t: 21.3, name: "flagPop" },
  { t: 21.5, name: "rateDing" },
  { t: 21.7, name: "jerseyDrop" },
  { t: 22, name: "jerseyLand" },
  { t: 22.1, name: "plateWipe" },
  { t: 22.75, name: "jerseyDrop" },
  { t: 23.05, name: "jerseyLand" },
  { t: 23.15, name: "plateWipe" },
  { t: 23.4, name: "blip" },
  { t: 23.7, name: "rateDing" },
  { t: 24.45, name: "jerseyDrop" },
  { t: 24.75, name: "jerseyLand" },
  { t: 24.85, name: "plateWipe" },
  { t: 25.45, name: "jerseyDrop" },
  { t: 25.75, name: "jerseyLand" },
  { t: 25.85, name: "plateWipe" },
  { t: 26.45, name: "jerseyDrop" },
  { t: 26.75, name: "jerseyLand" },
  { t: 26.85, name: "plateWipe" },
  { t: 27, name: "flagPop" },
  { t: 27.2, name: "rateDing" },
  { t: 27.8, name: "blip" },
  { t: 27.9, name: "crowdOhh" },
  { t: 28.5, name: "jerseyDrop" },
  { t: 28.8, name: "jerseyLand" },
  { t: 28.9, name: "plateWipe" },
  { t: 29.1, name: "choir" },
  { t: 29.4, name: "rateDing" },
  { t: 30.4, name: "stamp" },
  { t: 30.5, name: "whoosh" },
  { t: 30.6, name: "tada" },
  { t: 30.8, name: "swell" },
  { t: 31.2, name: "choir" },
  { t: 31.8, name: "blip" },
  { t: 31.9, name: "pad" },
  { t: 32, name: "whooshSoft" },
  { t: 32.5, name: "benchPop" },
  { t: 32.68, name: "benchTick" },
  { t: 32.95, name: "benchPop" },
  { t: 33.13, name: "benchTick" },
  { t: 33.4, name: "benchPop" },
  { t: 33.58, name: "benchTick" },
  { t: 33.85, name: "benchPop" },
  { t: 34.03, name: "benchTick" },
  { t: 34.3, name: "benchPop" },
  { t: 34.48, name: "benchTick" },
  { t: 34.75, name: "benchPop" },
  { t: 34.93, name: "benchTick" },
  { t: 35.2, name: "benchPop" },
  { t: 35.38, name: "benchTick" },
  { t: 35.65, name: "benchPop" },
  { t: 35.83, name: "benchTick" },
  { t: 36.1, name: "benchPop" },
  { t: 36.2, name: "pluck" },
  { t: 36.28, name: "benchTick" },
  { t: 36.55, name: "benchPop" },
  { t: 36.73, name: "benchTick" },
  { t: 37.2, name: "whooshSoft" },
  { t: 37.4, name: "stamp" },
  { t: 37.5, name: "choir" },
  { t: 37.6, name: "crowdOhh" },
  { t: 37.9, name: "swell" },
  { t: 38, name: "pad" },
  { t: 38.3, name: "chime" },
  { t: 39.1, name: "sparkle" },
  { t: 40, name: "pluck" },
  { t: 40.9, name: "pluck" },
  { t: 41.8, name: "sparkle" },
  { t: 42.6, name: "whistle" },
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
  app.beginUndoGroup("Astan City — script vocal");
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
  writeLn("Astan City : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
