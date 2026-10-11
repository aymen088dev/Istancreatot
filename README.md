# REMNANT · Motion Lab

Cinq **fichiers HTML séparés**, chacun totalement autonome : un seul fichier, aucune dépendance,
aucune requête réseau, aucun fichier audio. Chaque animation tourne en boucle et embarque
**un son et une voix** que l'on active depuis l'écran d'accueil.

| # | Fichier | Format | Durée | Thème d'animation |
|---|---------|--------|-------|-------------------|
| 1 | `01-pub-remnant.html` | 16:9 (1920×1080) | 26 s | **Cinéma or & encre** — typographie cinétique, projecteur, poussière, carte de fin |
| 2 | `02-tiktok-neutron.html` | 9:16 (1080×1920) | 30 s | **Néon spatial** — warp, glitchs, sous-titres, mascotte Biby (boule bleue corail) |
| 3 | `03-tiktok-trou-noir.html` | 9:16 (1080×1920) | 30 s | **Distorsion gravitationnelle** — lentille, disque d'accrétion, spaghettification |
| 4 | `04-pub-voxel.html` | 16:9 (1920×1080) | 24 s | **Voxel / cyber survie** — ville isométrique qui se construit, CRT, HUD monospace |
| 5 | `05-ident-remnant.html` | 1:1 (1080×1080) | 12 s | **Bauhaus géométrique** — formes primaires qui s'assemblent, noir / papier / rouge |

## Son et voix

Aucun navigateur n'autorise l'audio avant une interaction : chaque fichier ouvre donc sur un
**écran d'accueil** avec un bouton **« Démarrer »**. L'animation reste en pause derrière, et c'est
ce clic — et lui seul — qui crée l'`AudioContext`. **Aucun son ne peut sortir avant.**

Une fois lancé, deux bascules sont disponibles en haut de la scène :

- **Son** — effets 100 % synthétisés en Web Audio (whoosh, tick, impact, riser, blip, nappe
  d'ambiance), déclenchés sur les évènements de la timeline. Coupé, le contexte audio est
  suspendu (aucun CPU gaspillé).
- **Voix** — narration en français via `speechSynthesis`, une phrase par beat, avec une voix
  `fr-FR` si le navigateur en propose une. Si le moteur vocal est absent ou sans voix, la bascule
  reste silencieuse **sans jamais lever d'erreur**.

Les deux sont **désactivées par défaut**.

## Contrôles

| Touche | Action |
|--------|--------|
| `Espace` | lecture / pause (démarre aussi depuis l'écran d'accueil) |
| `S` | bascule le son |
| `V` | bascule la voix |
| `R` | recommencer depuis le début |

Un clic sur la scène met aussi en lecture/pause.

## Lancer

Ouvrir un fichier directement (double-clic, `file://`) suffit : ils sont autonomes.
Pour les parcourir depuis un serveur :

```bash
bun run dev     # sert le dépôt sur 0.0.0.0:$PORT (3000 par défaut)
```

La page d'accueil est **générée par le serveur** (liste des fichiers + métadonnées lues dans
chaque `window.MOTION`) : elle n'ajoute aucun fichier HTML au dépôt, qui en compte donc exactement cinq.

## Enregistrer

Ouvre le fichier en plein écran, masque le curseur et capture l'écran en 60 fps. Les formats sont
déjà calibrés : 16:9, 9:16 et 1:1.

## Notes techniques

- Horloge unique `requestAnimationFrame` avec un `render(t)` **déterministe** : tout l'état visuel
  dérive de `t`, ce qui rend la timeline scrubbable et robuste au passage en arrière-plan
  (delta borné à 0,25 s).
- `window.MOTION` expose `{ id, title, duration, aspect }` pour chaque fichier.
- Mise à l'échelle : scène de dimension exacte, `translate(-50%,-50%) scale(k)`, recalculée au
  redimensionnement — la composition reste entièrement cadrée et centrée à toutes les tailles.
- Maximum ~3 flashs/seconde.
