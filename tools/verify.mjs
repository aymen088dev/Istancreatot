#!/usr/bin/env bun
// ============================================================================
// tools/verify.mjs — vérificateur STATIQUE des films (aucun navigateur requis).
// Sans argument, il contrôle tous les films HTML de la racine du projet.
//   bun run verify
//   bun tools/verify.mjs astan-city-xi.html
// ============================================================================
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const arg = process.argv[2];
const FILES = arg ? [arg] : readdirSync(".").filter((f) => f.endsWith(".html")).sort();

if (!FILES.length) {
  console.error("✗ aucun film HTML trouvé");
  process.exit(1);
}
for (const f of FILES) {
  if (!existsSync(f)) {
    console.error(`✗ fichier introuvable : ${f}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ outils */
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

function section(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  if (a < 0) return "";
  const b = src.indexOf(endMark, a + startMark.length);
  return src.slice(a, b < 0 ? src.length : b);
}

/* --------------------------------------------------------- vérification */
function verify(file) {
  const html = readFileSync(file, "utf8");
  const P = [], W = [], F = [];
  const ok = (m) => P.push(m);
  const warn = (m) => W.push(m);
  const bad = (m) => F.push(m);
  const check = (cond, good, badMsg) => (cond ? ok(good) : bad(badMsg));

  /* 1. autonomie */
  const remote = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
  check(remote.length === 0, "aucune ressource réseau (fichier 100 % autonome)",
    `ressource(s) externe(s) détectée(s) : ${remote.join(", ")}`);
  const leaks = ["src=", "href=", "<img", "<audio", "<video", "<iframe", "@import", "XMLHttpRequest"].filter((t) => html.includes(t));
  check(leaks.length === 0, "aucune balise externe (img, audio, iframe…)",
    `référence(s) suspecte(s) : ${leaks.join(", ")}`);
  // les seules requêtes autorisées sont celles que le film déclare lui-même :
  // sa bande-son, sa bande vocale et le plan de cette voix
  const OWN = ["ASSET", "VOICE_ASSET", "VOICE_PLAN"];
  const fetches = [...html.matchAll(/fetch\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  check(fetches.every((f) => OWN.includes(f)),
    fetches.length ? `${fetches.length} requête(s), toutes vers ses propres fichiers (${[...new Set(fetches)].join(", ")})` : "aucune requête",
    `requête(s) inattendue(s) : ${fetches.filter((f) => !OWN.includes(f)).join(", ")}`);
  const weight = Buffer.byteLength(html);
  check(weight < 220_000, `poids raisonnable (${(weight / 1024).toFixed(0)} ko, un seul fichier)`,
    `fichier trop lourd : ${(weight / 1024).toFixed(0)} ko`);

  /* 2. syntaxe */
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  check(scripts.length === 1, "un seul bloc <script> inline", `${scripts.length} blocs <script> trouvés`);
  if (scripts.length) {
    try { new Function(scripts[0]); ok("syntaxe JavaScript valide"); }
    catch (e) { bad(`erreur de syntaxe JavaScript : ${e.message}`); }
  }

  /* 3. montage */
  const TOTAL = Number(html.match(/const TOTAL\s*=\s*(\d+)/)?.[1] ?? 0);
  check(TOTAL >= 10_000 && TOTAL <= 120_000, `durée annoncée : ${(TOTAL / 1000).toFixed(1)} s`,
    `durée hors bornes : ${TOTAL} ms`);

  const sceneSrc = html.replace(/to:\s*TOTAL/g, `to: ${TOTAL}`);
  const scenes = [...sceneSrc.matchAll(/\{\s*from:\s*(\d+),\s*to:\s*(\d+),\s*name:\s*"([^"]+)",\s*num:\s*"(\d+)"/g)]
    .map((m) => ({ from: +m[1], to: +m[2], name: m[3], num: m[4] }));
  check(scenes.length >= 3, `${scenes.length} scènes déclarées`, "moins de 3 scènes déclarées");
  if (scenes.length) {
    check(scenes[0].from === 0, "les scènes commencent à 0", `la première scène démarre à ${scenes[0].from} ms`);
    const gaps = scenes.filter((s, i) => i > 0 && s.from !== scenes[i - 1].to);
    check(gaps.length === 0, "scènes contiguës (aucun trou, aucun chevauchement)",
      `discontinuité à ${gaps.map((s) => s.name).join(", ")}`);
    check(scenes.at(-1).to === TOTAL, `la dernière scène se termine sur la durée totale (${TOTAL / 1000} s)`,
      `fin de la dernière scène = ${scenes.at(-1).to} ms ≠ ${TOTAL} ms`);
    check(scenes.every((s, i) => +s.num === i + 1), "numérotation des scènes continue", "numéros de scènes incohérents");
  }

  /* 4. répliques */
  // Y a-t-il une bande vocale du studio pour ce film ? Elle change la façon de
  // juger le débit (voir plus bas) : on le sait avant de lire les répliques.
  const voicePlanPath = html.match(/const VOICE_PLAN\s*=\s*"([^"]+)"/)?.[1] ?? null;
  const hasVoice = !!(voicePlanPath && existsSync(voicePlanPath));
  let lines = null;
  try { lines = runInNewContext("(" + extractArray(html, "LINES") + ")"); } catch { /* ignoré */ }
  if (!Array.isArray(lines)) bad("tableau LINES illisible");
  else {
    ok(`${lines.length} répliques (voix + sous-titres)`);
    const overrun = lines.filter((l) => l.t + l.d > TOTAL);
    check(overrun.length === 0, "chaque réplique tient dans la durée du film",
      `réplique(s) qui dépassent : ${overrun.map((l) => l.txt.slice(0, 24)).join(" / ")}`);
    const overlap = lines.filter((l, i) => i > 0 && l.t < lines[i - 1].t + lines[i - 1].d);
    check(overlap.length === 0, "aucune réplique ne se superpose",
      `chevauchement(s) : ${overlap.map((l) => l.txt.slice(0, 24)).join(" / ")}`);
    check(lines.every((l, i) => i === 0 || l.t >= lines[i - 1].t), "répliques dans l'ordre chronologique", "répliques dans le désordre");
    const short = lines.filter((l) => l.txt.split(/\s+/).length < 4);
    check(short.length === 0, "chaque réplique est une phrase complète (≥ 4 mots)",
      `trop courte(s) : ${short.map((l) => l.txt).join(" / ")}`);
    // Le débit : la règle s'est déplacée avec la voix du studio. Avec le moteur du
    // navigateur, on ne pouvait qu'estimer (1,9 mot/s en français, plafond 2,25) et
    // espérer que la phrase tienne dans sa fenêtre. Avec la bande vocale, la fenêtre
    // **est** la durée mesurée : ce proxy ne dit plus rien. Ce qui reste à vérifier,
    // c'est que la phrase est prononçable (section 9, en syllabes par seconde) et que
    // la voix tient dans la fenêtre que le film lui donne (section 9, plan à l'appui).
    if (!hasVoice) {
      const rate = lines.map((l) => l.txt.split(/\s+/).length / (l.d / 1000));
      const top = Math.max(...rate);
      check(rate.every((r) => r <= 2.25),
        `chaque réplique laisse à la voix du navigateur le temps de se dire (max ${top.toFixed(1)} mot/s, plafond 2,25)`,
        `réplique(s) trop rapide(s) pour la voix : ` +
        rate.map((r, i) => (r > 2.25 ? `${lines[i].txt.slice(0, 26)} (${r.toFixed(1)} mot/s)` : null)).filter(Boolean).join(" / "));
    } else {
      ok("le débit se vérifie sur la voix mesurée (section 9), pas sur une estimation");
    }
    const gaps = lines.map((l, i) => (i ? l.t - (lines[i - 1].t + lines[i - 1].d) : Infinity));
    check(gaps.slice(1).every((g) => g >= 0),
      `une respiration entre chaque réplique (min ${Math.min(...gaps.slice(1)) / 1000} s)`,
      "deux répliques se touchent : la voix n'a pas le temps de reprendre son souffle");
  }

  /* 5. partition */
  const VOICE_KEYS = [...section(html, "const VOICES = {", "\n  };").matchAll(/^\s{4}([a-zA-Z][\w]*)\s*:\s*\(ctx, d, at[^)]*\)/gm)].map((m) => m[1]);
  check(VOICE_KEYS.length >= 15, `${VOICE_KEYS.length} sons synthétisés déclarés`, "partition trop pauvre (< 15 sons)");
  let cues = null;
  try { cues = runInNewContext("(" + extractArray(html, "SCORE") + ")"); } catch { /* ignoré */ }
  if (!Array.isArray(cues)) bad("tableau SCORE illisible");
  else {
    ok(`${cues.length} évènements sonores planifiés`);
    check(cues.every((c) => c[0] >= 0 && c[0] <= TOTAL), "tous les sons tombent dans la durée du film",
      `hors bornes : ${cues.filter((c) => c[0] < 0 || c[0] > TOTAL).map((c) => c[1] + "@" + c[0]).join(", ")}`);
    const unknown = [...new Set(cues.filter((c) => !VOICE_KEYS.includes(c[1])).map((c) => c[1]))];
    check(unknown.length === 0, "chaque évènement sonore correspond à un son existant", `son(s) manquant(s) : ${unknown.join(", ")}`);
    const i = cues.findIndex((c, k) => k > 0 && c[0] < cues[k - 1][0]);
    check(i === -1, "partition dans l'ordre chronologique", `partition désordonnée : ${i + 1}ᵉ évènement hors séquence`);
    const unused = VOICE_KEYS.filter((k) => !cues.some((c) => c[1] === k));
    if (unused.length) warn(`sons déclarés mais jamais utilisés : ${unused.join(", ")}`);
    check(cues.filter((c) => c[0] < TOTAL / 3).length >= 4, "le film n'est jamais silencieux au début", "peu de sons sur le premier tiers");
  }

  /* 5 bis. le studio : la bande sait-elle jouer tout ce que le film demande ? */
  // Un son déclaré par le film mais inconnu du studio est absent de la bande :
  // c'est le bug « ce son ne se lance jamais », qui ne s'entend qu'à l'écoute.
  if (RECIPES && Array.isArray(cues)) {
    const missing = [...new Set(cues.map((c) => c[1]))].filter((n) => !RECIPES.includes(n));
    check(RECIPES.length >= 15, `${RECIPES.length} recettes au studio (tools/assets/studio/voices.py)`, "recettes illisibles dans voices.py");
    check(missing.length === 0, "chaque son du film a sa recette au studio : la bande les joue tous",
      `son(s) sans recette au studio — donc muet(s) dans la bande : ${missing.join(", ")}`);
  }

  /* 6. fonctionnalités */
  check(html.includes('id="go"'), "bouton play présent sur l'écran d'accueil", "bouton play manquant");
  check(/new AC\(/.test(html), "AudioContext créé via un constructeur dédié", "aucun AudioContext");
  check(/go"\)\.addEventListener\("click", play\)/.test(html), "le film démarre sur un geste explicite (clic sur play)",
    "le démarrage n'est pas relié au bouton play");
  check(/speechSynthesis/.test(html), "repli vocal via speechSynthesis", "aucune synthèse vocale de secours");
  check(/className = "subline"/.test(html) && /className = "w"/.test(html), "sous-titres mot à mot", "sous-titres absents");
  check(/visibilitychange/.test(html), "mise en pause quand l'onglet passe en arrière-plan", "gestion d'onglet absente");
  check(/window\.(N3|MOTION)\s*=/.test(html), "surface de vérification exposée (window.MOTION / window.N3)",
    "aucune surface de vérification (outils inutilisables)");
  check(/keydown/.test(html), "raccourcis clavier branchés", "aucun raccourci clavier");

  /* 7. le son : une seule horloge, celle de la bande */
  check(/elapsed = Audio\.time\(\)/.test(html),
    "l'image avance sur l'horloge du son (une seule horloge)",
    "l'image n'est pas branchée sur Audio.time()");
  check(!/elapsed\s*=\s*Math\.min\(TOTAL,\s*elapsed\s*\+\s*dt\)/.test(html),
    "l'image n'a plus d'horloge à elle — aucune dérive possible",
    "l'image avance encore sur requestAnimationFrame : deux horloges, donc dérive");
  check(!/ctx\.close\(\)/.test(html),
    "le contexte audio n'est jamais reconstruit — plus de coupure à la reprise",
    "le contexte audio est encore fermé puis recréé : le son repartira du début");
  check(!/Audio\.boot\b/.test(html), "plus de « boot » qui relance la partition à chaque clic",
    "l'ancien Audio.boot() subsiste");
  check(/createBufferSource\(\)/.test(html) && /s\.start\(when, off\)/.test(html),
    "la bande est jouée par une seule source, posée au temps voulu",
    "aucune source unique : le son n'est pas rendu en mémoire puis posé");
  check(/Audio\.pause\(\)/.test(html) && /suspend\(\)/.test(html),
    "la pause gèle le contexte : le son et son horloge s'arrêtent ensemble",
    "la pause ne gèle pas le contexte audio");
  check(/scheduleDucks\(\)/.test(html) && !/duckFor\(/.test(html),
    "l'effacement sous la voix est planifié en temps du film",
    "le ducking est encore déclenché au rythme des images");
  // un lit d'ambiance coupé avant la fin du film s'entend comme un trou : les
  // arrêts écrits en dur doivent donc tomber au moins sur la fin du montage
  const hardStops = [...html.matchAll(/s\.stop\(at \+ (\d+(?:\.\d+)?)\)/g)].map((m) => +m[1]);
  check(hardStops.every((s) => s >= TOTAL / 1000 - .2),
    "aucun son ne s'arrête avant la fin du film (les lits tiennent jusqu'au dernier carton)",
    `son(s) coupé(s) trop tôt : ${hardStops.filter((s) => s < TOTAL / 1000 - .2).map((s) => s + " s").join(", ")} pour un film de ${TOTAL / 1000} s`);

  /* 8. la bande du studio (facultative : sans elle, le film se rend localement) */
  const asset = html.match(/const ASSET\s*=\s*"([^"]+)"/)?.[1];
  let audio = null;
  if (!asset) bad("le film ne déclare pas la bande qu'il attend (const ASSET)");
  else {
    ok(`bande déclarée : ${asset}`);
    const manPath = asset.replace(/\.wav$/, ".json");
    if (!existsSync(manPath)) {
      warn(`aucune bande générée à côté du film — il tourne sur son rendu local ` +
        `(python3 tools/assets/generate.py audio)`);
    } else if (existsSync(asset)) {
      let man = null;
      try { man = JSON.parse(readFileSync(manPath, "utf8")); } catch { man = null; }
      if (!man) bad(`manifeste illisible : ${manPath}`);
      else {
        const stored = man.cues.map((c) => `${c[0]}:${c[1]}`).join(" ");
        const now = (cues ?? []).map((c) => `${c[0]}:${c[1]}`).join(" ");
        check(stored === now, `la bande joue exactement la partition du film (${man.cues.length} cues)`, "la bande a été fabriquée pour une autre partition : il faut la refaire");
        check(man.filmMs === TOTAL, `la bande couvre la durée du film (${man.seconds} s)`, `durée de bande incohérente : ${man.filmMs} ms`);
        const head = readFileSync(asset).subarray(0, 12);
        check(head.toString("latin1").startsWith("RIFF") && head.toString("latin1").includes("WAVE"),
          `bande WAV valide (${(man.bytes / 1e6).toFixed(2)} Mo, crête ${man.peak})`, "la bande n'est pas un WAV lisible");
        check(man.clipped === 0 && man.silentSeconds === 0,
          "bande sans saturation et sans trou de silence",
          `bande douteuse : ${man.clipped} échantillon(s) saturé(s), ${man.silentSeconds} s creuse(s)`);
        audio = man;
      }
    } else bad(`la bande annoncée n'existe pas : ${asset}`);
  }

  /* 9. la voix du studio : prononcée une fois, chronométrée, et jouée par le film
     Le film ne dépend plus d'une voix du navigateur — qui n'existe pas sur toutes
     les machines et ne dure pas le même temps selon l'OS. Il joue une bande
     vocale fabriquée par le studio, et le plan de cette voix lui dit où sont les
     mots. Ici on contrôle que les trois pièces s'accordent encore. */
  const voiceAsset = html.match(/const VOICE_ASSET\s*=\s*"([^"]+)"/)?.[1];
  const voicePlan = html.match(/const VOICE_PLAN\s*=\s*"([^"]+)"/)?.[1];
  let voice = null;
  if (!voiceAsset || !voicePlan) {
    warn("le film ne déclare pas de bande vocale : il parlera avec la voix du navigateur");
  } else {
    ok(`voix déclarée : ${voiceAsset}`);
    check(voicePlan.replace(/\.json$/, ".wav") === voiceAsset,
      "le plan et la bande vocale désignent le même enregistrement",
      `plan et bande vocale désaccordés : ${voicePlan} / ${voiceAsset}`);
    check(/this\.startVoice\(when, off\)/.test(html) && /voiceGain/.test(html),
      "la voix est posée par une seconde source, sur l'horloge de la bande",
      "la voix n'est pas posée sur l'horloge de la bande (startVoice/voiceGain absents)");
    check(/setVoice\(Voice\.on\)/.test(html),
      "la bascule Voix coupe vraiment la bande vocale",
      "la bascule Voix n'est pas reliée au niveau de la voix");
    check(/if \(this\.has\(\)\) return false;/.test(html),
      "la voix du navigateur ne double pas la bande du studio",
      "le moteur du navigateur parle en même temps que la bande vocale");
    check(/L\.plan \? L\.plan\.t :/.test(html),
      "les sous-titres prennent leur fenêtre dans le plan mesuré",
      "les sous-titres n'utilisent pas les durées mesurées par le studio");
    const vManPath = voicePlan;
    if (!existsSync(vManPath)) {
      warn(`aucune bande vocale générée (${vManPath}) — le film parlera avec la voix du navigateur ` +
        `(python3 tools/assets/generate.py voice)`);
    } else if (!existsSync(voiceAsset)) {
      bad(`la bande annoncée n'existe pas : ${voiceAsset}`);
    } else {
      let man = null;
      try { man = JSON.parse(readFileSync(vManPath, "utf8")); } catch { man = null; }
      if (!man || !Array.isArray(man.lines)) bad(`plan vocal illisible : ${vManPath}`);
      else {
        voice = man;
        check(man.filmMs === TOTAL, `le plan vocal décrit bien ce film (${man.filmMs} ms)`,
          `le plan vocal est d'un autre montage : ${man.filmMs} ms ≠ ${TOTAL} ms`);
        check(man.lines.length === (lines?.length ?? -1),
          `les ${man.lines.length} répliques du plan sont celles du film`,
          `le film a ${lines?.length} répliques, le plan en décrit ${man.lines.length}`);
        const moved = man.lines.filter((l, i) => lines?.[i] && l.t !== lines[i].t);
        check(moved.length === 0, "chaque réplique est prononcée à l'instant déclaré par le film",
          `réplique(s) déplacée(s) depuis la fabrication de la voix : ${moved.map((l) => (l.i + 1)).join(", ")} (relancer generate.py voice)`);
        const tight = man.lines.filter((l, i) => lines?.[i] && l.ms > lines[i].d);
        check(tight.length === 0, "la voix tient dans la fenêtre que le film lui donne",
          `fenêtre(s) trop courte(s) pour la voix mesurée : ${tight.map((l) => `${l.i + 1} (${l.ms} ms pour ${lines[l.i].d} ms)`).join(", ")}`);
        const late = man.lines.filter((l) => l.slack < 0);
        check(late.length === 0, "aucune réplique n'empiète sur la suivante (respiration gardée)",
          `réplique(s) qui débordent sur la suivante : ${late.map((l) => l.i + 1).join(", ")}`);
        const wrong = man.lines.filter((l, i) => lines?.[i] &&
          l.txt.replace(/\s+/g, " ").trim() !== lines[i].txt.replace(/\s+/g, " ").trim());
        check(wrong.length === 0, "le texte prononcé est celui du film",
          `texte(s) différent(s) de la voix : réplique(s) ${wrong.map((l) => l.i + 1).join(", ")}`);
        // chaque mot du plan doit correspondre au mot du sous-titre, dans l'ordre
        const badWords = man.lines.filter((l, i) => lines?.[i] &&
          l.words.map((w) => w.w).join(" ") !== lines[i].txt.trim());
        check(badWords.length === 0, "le plan situe chaque mot du sous-titre",
          `mots du plan désaccordés avec le texte : réplique(s) ${badWords.map((l) => l.i + 1).join(", ")}`);
        // Le débit, cette fois sur la voix réelle : en syllabes par seconde, parce
        // que compter les mots pénalise les phrases de mots courts (« Zéro partout,
        // euh non, trois à zéro » : 7 mots, 5,6 syllabes/s, aucun problème). Le
        // plafond de 7,5 syllabes/s est celui d'un commentaire très vif : au-delà,
        // la phrase est un virelangue, et aucune fenêtre ne la rattrape.
        const syll = (t) => (t.match(/[aàâäeéèêëiîïoôöuùûüyÿœæ]+/gi) || []).length;
        const rated = man.lines.map((l) => syll(l.txt) / (l.ms / 1000));
        const fastest = Math.max(...rated);
        check(rated.every((r) => r <= 7.5),
          `chaque réplique est prononçable : la voix va à ${fastest.toFixed(1)} syllabes/s au plus (mesuré)`,
          `réplique(s) trop dense(s) pour être dites : ` +
          man.lines.map((l, i) => (rated[i] > 7.5 ? `${l.txt.slice(0, 26)} (${rated[i].toFixed(1)} syll/s)` : null)).filter(Boolean).join(" / "));
        const head = readFileSync(voiceAsset).subarray(0, 12);
        check(head.toString("latin1").startsWith("RIFF") && head.toString("latin1").includes("WAVE"),
          `bande vocale WAV valide (${(man.bytes / 1e6).toFixed(2)} Mo, crête ${man.peak}, débit moyen ${man.meanRate} mot/s)`,
          "la bande vocale n'est pas un WAV lisible");
        check(man.clipped === 0,
          `voix sans saturation (${man.silentSeconds} seconde(s) creuse, silence de la musique entre les répliques)`,
          `bande vocale saturée : ${man.clipped} échantillon(s)`);
      }
    }
  }

  /* 10. les drapeaux : un vrai fichier par nation affichée */
  // Ils ne sont plus dessinés dans le film : le studio les a récupérés au CDN
  // (des PNG de domaine public) et rangés dans `assets/img/flag-<CODE>.png`. Un
  // code sans fichier, c'est une pastille vide à l'écran — et ça ne se voit qu'à
  // l'image, jamais dans un tableau. On vérifie donc le fichier, sa taille, et que
  // le chemin écrit dans le film mène bien dessus.
  const flagCodes = [...new Set([...html.matchAll(/flag:\s*"([A-Z]{2})"/g)].map((m) => m[1]))];
  const flagTpl = html.match(/const FLAG_SRC\s*=\s*"([^"]+)"/)?.[1] ?? null;
  let flagMeta = null;
  try { flagMeta = JSON.parse(readFileSync("assets/img/flags.json", "utf8")); } catch { flagMeta = null; }
  if (flagCodes.length) {
    const known = new Map((flagMeta?.flags ?? []).map((f) => [f.code, f]));
    const gone = flagCodes.filter((c) => !existsSync(`assets/img/flag-${c}.png`));
    check(gone.length === 0,
      `${flagCodes.length} drapeaux affichés, tous sur le disque (${flagCodes.join(", ")})`,
      `drapeau(x) sans fichier : ${gone.join(", ")} — relancer generate.py fetch`);
    check(!!flagTpl && existsSync(flagTpl + flagCodes[0] + ".png"),
      `le film lit ses drapeaux par le chemin du studio (${flagTpl ?? "?"}<CODE>.png)`,
      `chemin de drapeau inattendu dans le film : ${flagTpl}`);
    const drawn = flagCodes.filter((c) => known.get(c)?.kind === "dessiné");
    const real = flagCodes.length - drawn.length;
    check(real >= 1, `${real} drapeau(x) de nations réelles (récupérés au CDN)` +
      (drawn.length ? `, ${drawn.length} dessiné(s) — nation fictive` : ""),
      "aucun drapeau réel : le film dessinerait ses drapeaux à la main");
    const sizes = flagCodes.map((c) => {
      const p = `assets/img/flag-${c}.png`;
      if (!existsSync(p)) return null;
      const h = readFileSync(p).subarray(16, 24);
      return [h.readUInt32BE(0), h.readUInt32BE(4)];
    }).filter(Boolean);
    const small = sizes.filter((s) => s[0] < 160 || s[1] < 100);
    check(small.length === 0,
      `assez grands pour la pastille du film (${Math.min(...sizes.map((s) => s[0]))} px de large au minimum)`,
      `drapeau(x) trop petit(s) : ${small.map((s) => s.join("×")).join(", ")}`);
  }

  return { file, P, W, F, seconds: TOTAL / 1000, weight, asset, audio, voice };
}

/* ------------------------------------------- ce que le studio sait jouer */
// Un son que le film déclare mais que le studio ne connaît pas est absent de la
// bande : c'est le bug « le son ne se lance jamais », et il ne s'entend qu'à
// l'écoute. On le voit donc ici, dans le fichier de recettes du studio.
const RECIPES = (() => {
  const p = "tools/assets/studio/voices.py";
  if (!existsSync(p)) return null;
  const block = readFileSync(p, "utf8").match(/RECIPES = \{[\s\S]*?\n\}/)?.[0] ?? "";
  return [...block.matchAll(/"([a-zA-Z][\w]*)":/g)].map((m) => m[1]);
})();

/* ------------------------------------------- le studio : banque & grand panel */
// Le grand panel n'est pas une page décorative : chaque son qu'il propose doit
// exister sur le disque, et la banque doit couvrir toutes les recettes du studio.
// Un asset annoncé mais absent, c'est un lecteur qui ne joue rien.
function verifyStudio() {
  const P = [], W = [], F = [];
  const ok = (m) => P.push(m), warn = (m) => W.push(m), bad = (m) => F.push(m);

  const sfxMan = "assets/sfx/manifest.json";
  if (!existsSync(sfxMan)) warn("aucune banque de sons (python3 tools/assets/generate.py sfx)");
  else {
    let man = null;
    try { man = JSON.parse(readFileSync(sfxMan, "utf8")); } catch { man = null; }
    if (!man?.items) bad(`manifeste de banque illisible : ${sfxMan}`);
    else {
      const total = man.items.reduce((s, i) => s + i.seconds, 0);
      ok(`banque de sons : ${man.items.length} fichiers, ${total.toFixed(1)} s de son, ${man.items.length - man.recipes} variantes`);
      const gone = man.items.filter((i) => !existsSync(i.file));
      if (gone.length) bad(`son(s) de la banque manquant(s) : ${gone.slice(0, 6).map((i) => i.file).join(", ")}`);
      else ok("chaque son de la banque existe sur le disque");
      ok(`familles : ${Object.keys(man.familles ?? {}).join(", ")}`);
      if (RECIPES) {
        const covered = new Set(man.items.map((i) => i.name));
        const missing = RECIPES.filter((r) => !covered.has(r));
        if (missing.length) bad(`recette(s) sans fichier dans la banque : ${missing.join(", ")}`);
        else ok(`les ${RECIPES.length} recettes du studio ont leur son dans la banque`);
      }
    }
  }

  // --- les drapeaux : leur provenance est enregistrée, et le fichier sur le disque
  // est encore exactement celui qui a été récupéré (empreinte). C'est ce qui permet
  // de dire d'où vient chaque image, et de repérer celle qu'on aurait retouchée.
  const flagMan = "assets/img/flags.json";
  if (!existsSync(flagMan)) warn("aucun drapeau récupéré (python3 tools/assets/generate.py fetch)");
  else {
    let man = null;
    try { man = JSON.parse(readFileSync(flagMan, "utf8")); } catch { man = null; }
    if (!man?.flags) bad(`manifeste de drapeaux illisible : ${flagMan}`);
    else {
      const cdn = man.flags.filter((f) => f.kind === "cdn");
      ok(`drapeaux : ${man.flags.length} fichiers, ${cdn.length} récupérés au CDN, ` +
        `${man.flags.length - cdn.length} dessiné(s) — ${String(man.licence).split(" — ")[0]}`);
      const drift = man.flags.filter((f) => {
        if (!existsSync(f.file)) return true;
        return createHash("sha256").update(readFileSync(f.file)).digest("hex").slice(0, 16) !== f.sha256;
      });
      if (drift.length) bad(`drapeau(x) absent(s) ou retouché(s) depuis la récupération : ${drift.slice(0, 8).map((f) => f.code).join(", ")}`);
      else ok("chaque drapeau du disque est exactement celui qui a été récupéré (sha256)");
      const noUrl = cdn.filter((f) => !/^https:\/\/flagcdn\.com\/w\d+\/[a-z-]+\.png$/.test(f.url ?? ""));
      if (noUrl.length) bad(`URL de provenance manquante ou inattendue : ${noUrl.map((f) => f.code).join(", ")}`);
      else ok("provenance enregistrée pour chacun (URL du CDN, licence, dimensions)");
    }
  }

  const catPath = "assets/catalog.json", pagePath = "assets/panel.html";
  if (!existsSync(catPath) || !existsSync(pagePath)) {
    warn("aucun grand panel d'assets (python3 tools/assets/generate.py panel)");
  } else {
    let cat = null;
    try { cat = JSON.parse(readFileSync(catPath, "utf8")); } catch { cat = null; }
    if (!cat?.films) bad("catalogue illisible : assets/catalog.json");
    else {
      const page = readFileSync(pagePath, "utf8");
      ok(`panel : ${cat.films.length} films, ${cat.sfx.length} sons, ${cat.plaques.length} plaques`);
      const missing = [...cat.sfx, ...cat.plaques].filter((x) => !existsSync(x.file));
      if (missing.length) bad(`fichier(s) listé(s) par le panel mais absent(s) : ${missing.slice(0, 6).map((x) => x.file).join(", ")}`);
      else ok("chaque fichier listé par le panel existe (sons et plaques)");
      const noFilm = cat.films.filter((f) => !page.includes(f.id));
      if (noFilm.length) bad(`film(s) absent(s) du panel : ${noFilm.map((f) => f.id).join(", ")}`);
      else ok("les films du dépôt sont tous au panel, avec leur bande et leur voix");
      const withVoice = cat.films.filter((f) => f.voice).length;
      ok(`${withVoice}/${cat.films.length} bandes vocales au catalogue`);
      if (withVoice < cat.films.length) warn("un film du panel n'a pas encore sa bande vocale");
      const listed = cat.sfx.filter((s) => page.includes(s.file));
      if (listed.length !== cat.sfx.length) bad(`${cat.sfx.length - listed.length} son(s) du catalogue sans lecteur dans la page`);
      else ok("chaque son de la banque a son lecteur dans la page");
    }
  }
  return { P, W, F };
}

/* ------------------------------------------------------------- exécution */
let failures = 0, warnings = 0, passes = 0;
const results = [];
for (const file of FILES) {
  const r = verify(file);
  results.push(r);
  failures += r.F.length;
  warnings += r.W.length;
  passes += r.P.length;
}

for (const r of results) {
  console.log("");
  console.log(`  Vérification statique — ${r.file}  (${r.seconds} s, ${(r.weight / 1024).toFixed(0)} ko)` +
    (r.audio ? `  +  ${r.asset}  (${(r.audio.bytes / 1e6).toFixed(2)} Mo)` : "") +
    (r.voice ? `  +  voix ${(r.voice.bytes / 1e6).toFixed(2)} Mo` : ""));
  console.log("  " + "─".repeat(64));
  r.P.forEach((m) => console.log(`  ✓ ${m}`));
  r.W.forEach((m) => console.log(`  ! ${m}`));
  r.F.forEach((m) => console.log(`  ✗ ${m}`));
}

const studio = verifyStudio();
passes += studio.P.length; warnings += studio.W.length; failures += studio.F.length;
console.log("");
console.log("  Vérification statique — le studio et son grand panel");
console.log("  " + "─".repeat(64));
studio.P.forEach((m) => console.log(`  ✓ ${m}`));
studio.W.forEach((m) => console.log(`  ! ${m}`));
studio.F.forEach((m) => console.log(`  ✗ ${m}`));

console.log("\n  " + "─".repeat(64));
console.log(`  ${results.length} film(s) + le studio · ${passes} réussite(s) · ${warnings} réserve(s) · ${failures} échec(s)\n`);

if (failures) {
  console.error("  Au moins un film n'est pas publiable en l'état.");
  process.exit(1);
}
console.log("  Contrôles statiques OK — passe aux captures : bun run shots");
