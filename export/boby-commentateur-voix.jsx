/* =====================================================================
   BOBY — SCRIPT VOCAL, pour After Effects.
   Généré depuis boby-commentateur.html par tools/export.mjs (ne pas modifier à la
   main : relancer `bun run export` après toute retouche du film).

   Ce qu'il fait, dans le projet ouvert :
     • il crée (ou reprend) une composition 1080×1920 de 34 s,
     • il pose un calque texte par réplique, sur sa fenêtre exacte,
     • il pose un repère de composition par son de la partition — de quoi
       recaler la musique et les bruitages sous la voix.

   La voix à importer dans ce montage est la bande du studio :
     assets/voice/boby-commentateur.wav
   (voix « français · Tom (medium) », 8 répliques mesurées sur 8)
   Les durées de calques sont celles de cette voix, pas celles espérées par le film.

   Utilisation : File ▸ Scripts ▸ Run Script File…, puis choisir ce fichier.
   Réglages : les cinq lignes qui suivent.
   ===================================================================== */
var COMP_NAME = "BOBY — voix · 1080x1920";
var WIDTH = 1080;
var HEIGHT = 1920;
var FPS = 25;                 // la composition exportée ; l'image du film, elle, n'a pas de cadence fixe
var DURATION = 34;  // durée du film, en secondes
var SUBTITLE_Y = 0.86;        // hauteur des calques, en fraction de la hauteur
var FONT_SIZE = 64;
var KEEP_EXISTING = false;    // true : ajoute les calques à la composition trouvée

/* Une réplique : instant de départ (s) et durée (s). 8 répliques. */
var LINES = [
  { t: 0.6, d: 3.767, txt: "Bonsoir, bonsoir. Ici Boby, en direct." },
  { t: 5.2, d: 3.152, txt: "Bienvenue sur, euh, sur notre antenne." },
  { t: 10.3, d: 2.483, txt: "Donc ce soir, on commente... quel match." },
  { t: 14.8, d: 3.871, txt: "Comistani. Enfin, Comistini... non, comestible." },
  { t: 19, d: 3.183, txt: "Mikkelsen. Mik... Mike-les-sons, voilà." },
  { t: 23.2, d: 2.925, txt: "Zéro partout, euh non, trois à zéro." },
  { t: 27.4, d: 3.063, txt: "Aïe. J'ai lâché le micro, pardon." },
  { t: 30.8, d: 1.68, txt: "Ce n'est pas moi, c'est le vent." },
];

/* La partition du film, en repères : 71 sons. */
var CUES = [
  { t: 0, name: "pad" },
  { t: 0, name: "crowd" },
  { t: 0, name: "air" },
  { t: 0.3, name: "sub" },
  { t: 0.5, name: "squeak" },
  { t: 0.9, name: "blip" },
  { t: 1.4, name: "tom" },
  { t: 1.9, name: "phoneBuzz" },
  { t: 2.6, name: "kick" },
  { t: 3.1, name: "chip" },
  { t: 3.7, name: "hush" },
  { t: 4.8, name: "riser" },
  { t: 5.2, name: "whoosh" },
  { t: 5.6, name: "pad" },
  { t: 6.1, name: "blip" },
  { t: 6.4, name: "pluck" },
  { t: 7, name: "stamp" },
  { t: 7, name: "whoosh" },
  { t: 7.3, name: "blip" },
  { t: 7.9, name: "chime" },
  { t: 8.4, name: "pluck" },
  { t: 9.2, name: "sparkle" },
  { t: 10.3, name: "whooshSoft" },
  { t: 10.6, name: "chip" },
  { t: 11.2, name: "tom" },
  { t: 11.8, name: "pluck" },
  { t: 12.4, name: "hush" },
  { t: 13.1, name: "riser" },
  { t: 13.5, name: "kick" },
  { t: 13.7, name: "stamp" },
  { t: 13.7, name: "whoosh" },
  { t: 14, name: "blip" },
  { t: 14.2, name: "pad" },
  { t: 14.5, name: "coinLand" },
  { t: 14.8, name: "chip" },
  { t: 15.6, name: "pluck" },
  { t: 16.4, name: "impact" },
  { t: 16.7, name: "coinLand" },
  { t: 17.2, name: "hush" },
  { t: 18.4, name: "coinLand" },
  { t: 18.7, name: "chip" },
  { t: 19, name: "pluck" },
  { t: 20.2, name: "impact" },
  { t: 20.5, name: "coinLand" },
  { t: 21, name: "whooshSoft" },
  { t: 21.5, name: "riser" },
  { t: 21.7, name: "stamp" },
  { t: 21.7, name: "whoosh" },
  { t: 21.9, name: "pad" },
  { t: 22.6, name: "blip" },
  { t: 23.2, name: "pluck" },
  { t: 23.8, name: "chip" },
  { t: 24.6, name: "impact" },
  { t: 24.9, name: "crowdOhh" },
  { t: 25.6, name: "pluck" },
  { t: 26.4, name: "riser" },
  { t: 26.8, name: "whoosh" },
  { t: 27.4, name: "micThud" },
  { t: 27.7, name: "impact" },
  { t: 27.9, name: "crowdGasp" },
  { t: 28.2, name: "crowdOhh" },
  { t: 28.8, name: "tada" },
  { t: 29.2, name: "chime" },
  { t: 29.8, name: "pad" },
  { t: 30.2, name: "sparkle" },
  { t: 30.8, name: "pluck" },
  { t: 31.4, name: "swell" },
  { t: 32, name: "sparkle" },
  { t: 32.6, name: "chime" },
  { t: 33.1, name: "whistle" },
  { t: 33.4, name: "sub" },
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
  app.beginUndoGroup("Boby — script vocal");
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
  writeLn("Boby : " + made + " calque(s) texte posé(s), " + CUES.length +
          " repère(s) de son, composition \"" + comp.name + "\" (" +
          comp.duration.toFixed(2) + " s).");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

main();
