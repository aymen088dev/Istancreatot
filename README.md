# Six films motion design — et le studio qui les sonorise et les fait parler

Six films, chacun dans **un seul fichier HTML** : image dessinée par code (canvas 2D),
voix **prononcée une fois par le studio** puis jouée comme une bande, sous-titres mot à mot.
Le studio en Python (`tools/assets/`) fabrique le son, la voix et les images :
la bande-son du film, sa partition, la bande vocale et le plan de cette voix, la banque
d'assets. Les films ne décrivent rien deux fois — ils lisent ce que le studio a mesuré.

Trois de ces films sont des **émissions de sport** : habillage de diffusion dans l'image
(LIVE, horloge, cartouche du commentateur) et commentaire au micro. Le script vocal de
chacun s'exporte à part, pour un montage fait ailleurs (`bun run export`), avec la voix
à importer telle quelle.

Le sixième est d'un autre genre : `herobrine.html` est un **film d'horreur vertical vu à
la première personne**, dans un monde de blocs. Pas une image, pas de moteur 3D, pas de
`WebGL` : le monde est projeté et peint cube par cube par le même canvas 2D que les
autres films (le détail est plus bas).

Le studio a son **grand panel d'assets** : `assets/panel.html` — la banque de sons à
écouter, les plaques d'images, les bandes et les voix — servi par la régie et régénérable
par `bun run assets`.

| Film | Format | Durée | Sujet |
| --- | --- | --- | --- |
| `nyxar-n3.html` | 16:9 | 37 s | Publicité **Nyxar N3**, berline familiale à 12 000 istancoins (Istanbul, Espagne, Portugal) |
| `litel.html` | 16:9 | 40 s | Publicité **Litel**, l'épicerie de quartier : l'enseigne s'allume, les rayons, le prix du jour (5 istancoins la boîte), le contrôle qualité, la livraison en 24 h — « des petits prix, grande qualité » |
| `astan-city-xi.html` | 9:16 | 43,4 s | **Astan City**, le onze de départ et le banc, commenté en direct par **Léonard Chose** |
| `cs-axium-xi.html` | 9:16 | 46,2 s | **CS AXIUM**, la composition 4-1-4-1 d'après l'app Istan Creator : onze titulaires notés, drapeaux, postes, brassard et banc de neuf |
| `boby-commentateur.html` | 9:16 | 34 s | **Boby**, commentateur ultra maladroit : premier direct, noms estropiés, score inventé, micro lâché |
| `herobrine.html` | 9:16 | 42 s | **Herobrine**, survie en monde de blocs à la première personne : jour 1, la nuit, un tunnel droit sans porte, deux yeux blancs sur la colline — et le journal du monde qui se vide |

```bash
bun run dev        # http://0.0.0.0:$PORT — la régie, qui liste les films
```

## Herobrine : un monde en blocs dessiné par code

Le film ne charge aucun modèle, aucune texture, aucune image : tout est calculé.

- **Une caméra à la première personne et des cubes.** Chaque cube est décrit par ses
  coordonnées et ses trois dimensions ; ses huit coins sont projetés par une caméra
  pinhole (`yaw` puis `pitch`), les trois faces tournées vers l'œil sont gardées, et
  toutes les faces sont triées **du plus loin au plus près** avant d'être peintes :
  c'est l'algorithme du peintre, et cela suffit à faire lire un monde de blocs.
- **La lumière et la matière.** Le lointain s'efface dans un brouillard de distance,
  les torches posent des halos additifs, et une face proche reçoit des pixels de
  matière (l'herbe, la pierre, les feuilles) — sinon un cube reste un cube.
- **L'interface du joueur** est dessinée de la même façon : réticule, barre d'objets
  de neuf cases avec l'objet tenu (la torche, la pioche, les blocs), vie et faim, et
  le bras qui tient la torche, qui balance quand on marche.
- **Six plans** : jour 1 au soleil carré, la nuit qui tombe, le tunnel droit aux
  torches qui s'éteignent l'une après l'autre, la silhouette sur la colline (qui
  disparaît quand on la fixe), la course sous la pluie, et la carte de fin — un
  chargement de monde qui n'arrive jamais.
- **L'image se dégrade comme une vieille capture** : grain, lignes de balayage,
  pluie, et des bandes décalées (le glitch) quand il est là.
- Le **journal du monde** (les messages des autres joueurs, puis « console : a quitté
  la partie ») est du DOM posé dans le cadre, comme l'habillage des films de sport :
  il est capturé avec l'image, et relu par les outils.

## Le son : une seule horloge

C'est le point qui a été repris de fond en comble, parce que le son se décalait et
« coupait » pour repartir plus loin.

Ce qui n'allait pas :

- **Deux horloges.** L'image avançait sur les horodatages de `requestAnimationFrame`,
  le son sur l'horloge du contexte audio. Chaque image perdue (le pas était écrêté à
  100 ms) creusait l'écart : le son prenait du retard, sans jamais le rattraper.
- **Un contexte reconstruit à chaque reprise.** `play()` appelait un `boot()` qui
  fermait le contexte audio et replanifiait toute la partition depuis zéro : la
  musique repartait du début pendant que l'image restait au milieu du film.

Ce qui se passe maintenant :

1. La partition est **rendue en mémoire** : la bande posée par le studio si elle est
   servie (`assets/audio/<film>.wav`), sinon le même score rendu hors ligne par
   `OfflineAudioContext`. Le niveau est ramené à la même crête dans les deux cas.
2. Une **seule source** (`AudioBufferSourceNode`) joue cette mémoire, posée au temps
   voulu. Le temps du film **est** la position de cette source — `Audio.time()`.
3. La **pause gèle le contexte** (`suspend()`), donc le son et son horloge s'arrêtent
   ensemble ; la **reprise** ne reconstruit rien, elle repart d'où elle s'était
   arrêtée.
4. Le retard de sortie (`outputLatency`) est compensé : l'image montre ce qu'on
   entend, pas ce qui est en train d'être calculé.
5. L'effacement de la musique sous la voix est **planifié en temps du film**, plus
   déclenché au rythme des images.
6. Garde-fou : si le contexte audio ne tourne pas (machine sans sortie sonore),
   le film poursuit sans son plutôt que de se figer — mais il **retente la reprise**
   (et repose la bande au temps courant) avant d'y renoncer, au lieu de rester muet
   jusqu'au rechargement ; et **le premier geste de l'utilisateur relance** un contexte
   que le navigateur aurait gelé (politique de lecture automatique, onglet revenu au
   premier plan, sortie sonore rebranchée).
7. Les **lits d'ambiance tiennent jusqu'à la fin** : la foule et le souffle étaient
   coupés à 38,2 s dans un film de 43,4 s (et la foule du studio ne durait que 6 s),
   ce qui s'entend comme un trou sous les nappes. Le contrôle statique refuse
   désormais tout arrêt écrit en dur avant la fin du film, et la mesure de la bande
   vérifie que le niveau tient sur ses deux dernières secondes.

En `file://` (double-clic), le navigateur refuse `fetch` : le film se rabat sans
erreur sur son rendu local, avec exactement la même horloge.

## La voix : prononcée une fois, mesurée, puis jouée par le film

Les films confiaient leurs répliques au moteur vocal du **navigateur**
(`speechSynthesis`). Deux défauts de fond : la voix n'existe que si la machine en a
une (serveur d'images, navigateur sans pack de langue, téléphone en anglais : aucune),
et elle **change d'une machine à l'autre** — la même phrase dure 2,8 s ici et 3,4 s
ailleurs. On ne pouvait donc rien vérifier : ni le débit, ni la tenue du texte, ni le
montage, qui se calait sur une voix qu'on n'entendait jamais au moment de le fabriquer.

Le studio prononce maintenant les répliques **lui-même**, hors ligne, avec piper —
un moteur neuronal qui tourne sur le processeur (le modèle de 63 Mo se télécharge au
premier usage dans `tools/assets/models/`, jamais dans le dépôt) — et il garde la
voix sous forme de bande, comme il garde la musique :

```bash
bun run assets:voice                    # les bandes vocales des six films
bun run assets:check                    # le montage a-t-il bougé sous la voix ?
```

| Pièce | Ce que c'est |
| --- | --- |
| `assets/voice/<film>.wav` | les répliques du film, prononcées à leurs instants, posées sur une bande à part |
| `assets/voice/<film>.json` | le **plan** : durée réelle de chaque phrase, débit obtenu, et l'instant de chaque mot |

Sans la bande (fichier ouvert en `file://`, studio pas encore passé), le film se rabat
sur le moteur du navigateur, exactement comme avant : rien ne casse.

**Le film a maintenant deux sources sur la même horloge** : la bande-son et la bande
vocale sont posées au même instant, avec le même décalage, et la bascule **Voix** ne
coupe que la seconde (un fondu de 180 ms sur son propre gain). Rien n'a été dupliqué :
c'est le même `AudioContext`, le même `seek()`, la même pause par `suspend()`.

Ce que la mesure apporte, concrètement :

1. **Les fenêtres de répliques sont celles de la voix**, pas une estimation. Le studio
   prononce, chronomètre, et le film déclare cette durée (`d = voix + ~400 ms d'air`).
   Une fenêtre plus courte que la phrase ferait couper le sous-titre — c'est refusé
   par `bun run verify`.
2. **Le mot surligné suit la voix** : le plan porte l'instant de chaque mot (réparti
   selon son poids en syllabes), donc le sous-titre s'allume sur « Istanoix » quand la
   voix dit « Istanoix », pas 200 ms avant. Le contrôle dynamique compare le mot
   surligné au mot mesuré.
3. **Si une phrase ne tient pas dans son budget**, le studio resserre *son* débit (et
   le dit dans le plan) ; s'il ne peut pas, la réplique est marquée en débordement —
   c'est le montage qui doit bouger, pas la voix qui doit bâcler. `generate.py voice`
   sort alors en code d'erreur.

## La voix et le texte : le montage suit la parole

Astan City avait un défaut de fond : la narration était découpée pour **2,5 à 2,6
mots par seconde**, alors que le moteur vocal du navigateur tourne autour de
**1,9 mot/s** en français. Chaque phrase dépassait donc la fin de sa réplique : la
voix continuait, le sous-titre s'éteignait, et le montage — qui révélait les
joueurs à un rythme fixe — prenait l'image de vitesse. (Depuis, la voix est celle du
studio : voir la section précédente.)

Ce qui a été repris :

1. **Le film est re-monté sur la parole** : 43,4 s au lieu de 38 s, chaque réplique
   dimensionnée à son nombre de mots (plafond 2,25 mot/s, vérifié) avec une
   respiration d'au moins 0,4 s avant la suivante.
2. **L'image suit les noms prononcés** : chaque joueur apparaît à l'instant où la
   voix dit son nom (et l'attaque est révélée de gauche à droite, comme la phrase :
   « Elke, Sholke et Dempsey devant »). La partition, les cartons, la caméra du banc
   et le carton final ont été recalés sur ce nouveau découpage.
3. **À l'exécution, le sous-titre suit la voix** : le moteur vocal annonce au film
   quand il commence et quand il finit vraiment (`onstart` / `onend`), et la réplique
   reste affichée tant que la phrase est en cours. Un moteur vocal plus lent que
   prévu ne peut donc plus laisser le texte en arrière.
4. **Le débit est vérifié par un contrôle statique** : au-delà de 2,25 mot/s, la
   fabrication échoue — on ne compte pas sur l'oreille pour s'en apercevoir.

## Le commentaire et l'habillage de diffusion

Astan City n'est plus une simple présentation : c'est une **émission**. Léonard Chose
(son nom vit dans une seule constante du film, `MIC` : changez-la et les cartouches,
l'écran d'accueil et le carton de fin suivent) commente le onze, et l'image porte
l'habillage d'une chaîne :

- un **bandeau LIVE** avec l'horloge du film affichée en temps de match (`00:00` →
  `00:43`), le nom de l'équipe et la formation ;
- un **cartouche de commentateur** (« Léonard Chose · au micro ») dont le témoin
  s'allume rouge quand il parle — et seulement quand il parle ;
- la **compo qui se confirme** : les noms déjà annoncés s'épinglent au fil du film ;
- un **bandeau de chaîne** qui balaie l'image à chaque changement de plan.

Boby a le même habillage, plus deux gags : un tampon **ERRATUM** qui s'abat à chaque
bévue et un **compteur d'erreurs** qui monte sur le graphique des compositions. Le
personnage est dessiné par code (visage, casque mis à l'envers, cravate de travers,
gouttes de sueur, bouche qui s'ouvre sur les syllabes), et son film tient le même
contrat que les autres : une seule horloge, sous-titres mot à mot, bande du studio.

L'habillage est **dans le cadre**, pas dans l'interface du lecteur : il fait donc
partie de l'image, il est capturé avec elle, et il est vérifié par l'outil.

## Le studio : `tools/assets/`

Un générateur de **sons**, de **voix** et d'**images**, appuyé sur de vraies
bibliothèques : **numpy** (signaux, raster, WAV), **scipy** (filtres Butterworth),
**Pillow** (écriture des PNG) et **piper** (voix neuronale, sur le processeur).

```bash
bun run assets:setup       # python3 -m pip install -r tools/assets/requirements.txt
```
python3 tools/assets/generate.py list                 # ce que le studio sait faire
python3 tools/assets/generate.py audio                # les bandes des films du dépôt
python3 tools/assets/generate.py audio nyxar-n3.html --sr 44100
python3 tools/assets/generate.py voice                # les bandes vocales (piper)
python3 tools/assets/generate.py sfx                  # la banque de sons, jouable
python3 tools/assets/generate.py fetch                # les vrais drapeaux (CDN) + les icônes (GitHub)
python3 tools/assets/generate.py images --ascii       # plaques + relecture en caractères
python3 tools/assets/generate.py panel                # le grand panel d'assets
python3 tools/assets/generate.py check                # bandes, voix, banque, images à jour ?
python3 tools/assets/generate.py all
```

Le studio ne recopie pas les partitions : il **lit celle du film** (`const SCORE`,
`const TOTAL`, et la bande que le film réclame dans `const ASSET`). Une bande ne peut
donc pas être en retard sur le montage. Il enregistre à côté du WAV un **manifeste**
(partition jouée, durée, crête, RMS, secondes creuses) : c'est lui qui permet ensuite
de vérifier qu'un film n'a pas changé depuis la fabrication de sa bande.

| Morceau | Rôle |
| --- | --- |
| `studio/synth.py` | oscillateurs balayés (vectorisés), bruits filtrés par Butterworth **dont la coupure balaie par tranches**, FM, cordes pincées, nappes, foule, ligne de retard, master |
| `studio/wav.py` | lecture et écriture WAV 16 bits (numpy) |
| `studio/png.py` | toile raster numpy (dégradés, disques, croix, polygones, grain) et écriture PNG par Pillow |
| `studio/score.py` | lecture de la partition **et des répliques** d'un film HTML |
| `studio/voices.py` | une recette par nom de son (**46 recettes**, dont les voix d'habillage : clameur, stupeur, larsen du micro, micro lâché, téléphone, fanfare), leurs **familles**, leurs variantes et le placement stéréo |
| `studio/speech.py` | le moteur vocal hors ligne (piper) : téléchargement du modèle, nettoyage du silence, normalisation, **poids des mots** et mesure du débit |
| `studio/dialogue.py` | la bande vocale d'un film : une réplique par cue, à son instant, avec resserrage du débit si le budget est trop court |
| `studio/render.py` | le montage sonore : cue par cue, espace, master à la crête visée |
| `studio/panel.py` | le grand panel : il relit tous les manifestes et écrit la page + `assets/catalog.json` |
| `studio/plates.py` | les plaques d'images **dessinées** (matières, ciels, trames, pelouse, tribune, bandeau de score, trois écussons, trois maillots) |
| `studio/flags.py` | les drapeaux des films : **récupérés au CDN** (`https://flagcdn.com/w320/<code>.png`, PNG de domaine public) et rangés dans `assets/img/flag-<CODE>.png`, avec URL, licence, octets et sha256 dans `assets/img/flags.json` ; **Istan**, nation fictive, reste dessiné ici |
| `studio/github.py` | les icônes du magasin : Lucide (ISC) et Tabler (MIT) pour le trait, OpenMoji (CC BY-SA) pour la couleur, récupérées sur GitHub et rangées dans `assets/img/icon-*` avec dépôt, chemin et empreinte |

**Ajouter un son à un futur film** : une recette dans `studio/voices.py` (le nom est
la clé), un cue dans le `SCORE` du film, puis `generate.py audio`. Tout nom inconnu est
signalé à la fabrication plutôt que passé sous silence. Une recette qui lit le rang du
cue (les cordes, les pastilles, les ticks) rend ses **variantes** dans la banque :
**76 fichiers** pour 46 recettes, de quoi ne pas répéter deux fois le même son.

Côté vitesse, les bibliothèques changent tout : une bande de 44 s se fabrique en
**1,5 s** (12 s en pur Python) et les 20 plaques en **3 s** (21 s). Un écho à
rétroaction coûtait 8 s de récursion échantillon par échantillon ; il est
désormais traité par tranches vectorisées, résultat identique.

Les plaques (`assets/img/`) : grain, poussières, vignettes 16:9 et 9:16, ciels d'aube
et de nuit, trame de points, lignes d'écran, hachurage, **pelouse** et **tribune**,
bandeau de score, **trois écussons** et **trois maillots** de club — plus une planche de
contrôle. **18 plaques** dessinées, auxquelles s'ajoutent les **30 drapeaux** et les
**12 icônes** récupérés : **60 fichiers** au panel. Tout se relit en caractères dans le
terminal, comme les films.

Les **drapeaux** ne sont plus dessinés par le studio. Une vignette ronde de 90 px ne
pardonne pas : trois bandes à main levée passent encore pour l'Allemagne ou la France,
mais l'Espagne y perd ses armoiries, le Portugal son écu, le Maroc son étoile à cinq
branches — et l'aigle d'Istan n'y était qu'un pâté. Les **vingt-neuf nations** des
effectifs sont donc **récupérées une fois** au CDN
(`https://flagcdn.com/w320/<code>.png` — des PNG de domaine public, sans clé ni quota) et
rangées dans `assets/img/flag-<CODE>.png` ; `assets/img/flags.json` garde pour chacune
l'URL exacte, la licence, les octets et le **sha256**. Le drapeau **d'Istan**, nation
fictive qu'aucun CDN ne peut servir, reste dessiné par le studio — mais sobre : champ bleu
profond, bande verte à la hampe, croissant et étoile d'or, calés pour rester lisibles
dans le carré que la pastille garde. Un seul chemin pour les films : `flag-<CODE>.png`.

## Le grand panel d'assets

```bash
bun run assets:panel        # écrit assets/panel.html + assets/catalog.json
```

Une banque de 76 sons qu'on ne peut pas écouter ne sert à rien : le panel donne à
**entendre** et à **voir** tout ce que le studio produit, dans une seule page servie
par la régie (`assets/panel.html`, lien depuis l'accueil) :

- **la banque de sons**, rangée par familles (nappes, percussions, transitions, cordes,
  interface, mécanique, stade, studio), un lecteur par fichier, et le cue prêt à copier
  (`["whoosh"]`) pour l'insérer dans un `SCORE` ;
- **les films** : bande-son et bande vocale jouables côte à côte, statistiques mesurées,
  et le tableau des répliques avec leur débit réel ;
- **les plaques d'images** : chaque PNG affiché avec sa taille et son usage, rangé en
  grille, précédé de la **planche de contact** — les 60 fichiers d'un coup d'œil ;
- un **filtre** en haut qui cherche dans tout (nom de son, famille, plaque) et masque
  les familles devenues vides ;
- `assets/catalog.json` : la même liste en JSON, pour un montage ou un outil extérieur.

La page ne contient aucun asset en dur : elle est **régénérée depuis les manifestes**
(`panel`), et `bun run verify` vérifie que chaque fichier qu'elle annonce existe
vraiment — un lecteur qui ne joue rien est un défaut, pas une décoration.

Ces deux contrôles ne suffisent pourtant pas, et c'est ce qui a été mesuré : la page
vit dans `assets/`, alors que les manifestes rangent leurs fichiers en chemin de dépôt
(`assets/sfx/air.wav`). La page recopiait ce chemin tel quel : les **76 lecteurs et les
46 plaques demandaient donc `/assets/assets/…`**, tous en 404 — une page complète,
propre au contrôle statique, et **muette et vide dans le navigateur**. `bun run verify`
ne pouvait pas le voir (les fichiers existent !), la page non plus. C'est le contrôle
dynamique qui l'a attrapé, en ouvrant la page pour de vrai :

```bash
bun run shots:panel          # le panel seul : page ouverte, mesurée, capturée
```

Il résout chaque `src` **comme le navigateur** (par rapport à la page), demande chacune
**des 88 sources audio** une par une, attend le chargement des **61 images**, exerce le
filtre, et photographie le résultat au bureau et au téléphone. Les chemins sont
relatifs depuis (`sfx/air.wav`, `img/…`), la grille des plaques a été rétablie (46
plaques s'empilaient sur une seule colonne), et la planche de contact, jusqu'ici
produite mais invisible, est désormais affichée.

## Le script vocal, exporté pour un montage ailleurs

Le film tient sa voix, ses sous-titres et sa musique ; pour remonter la même chose
dans un logiciel de motion design, `tools/export.mjs` relit **le film lui-même**
(jamais une copie) et écrit deux fichiers par film :

```bash
bun run export                                  # tous les films du dépôt
bun tools/export.mjs cs-axium-xi.html           # un seul film
```

| Fichier | Contenu |
| --- | --- |
| `export/<film>-voix.jsx` | script **After Effects** (ExtendScript) : il crée la composition (1080×1920, durée du film), pose **un calque texte par réplique** sur la durée **mesurée** de la voix, et un **repère de composition par son** de la partition |
| `export/<film>-voix.txt` | le texte horodaté, une réplique par ligne, avec la durée mesurée et le chemin de la bande vocale à importer |

La voix n'est plus à enregistrer : c'est `assets/voice/<film>.wav`, fabriquée par le
studio, et le script d'export reprend ses durées phrase par phrase.

Le `.jsx` s'exécute par *File ▸ Scripts ▸ Run Script File…*. Ses réglages sont en clair
en tête de fichier (`FPS`, `FONT_SIZE`, `SUBTITLE_Y`, `KEEP_EXISTING`) ; la composition
porte le nom du film et se recrée proprement à chaque exécution, si bien qu'un montage
rouvert reprend toujours la dernière version du film.

## Le bouton play et les contrôles

À l'ouverture, un **écran d'accueil avec un gros bouton play** : un seul clic lance
l'image, la musique, la voix et les sous-titres — c'est ce clic qui autorise l'audio,
comme l'exigent les navigateurs. Les bascules **Son** et **Voix** coupent ensuite l'un
ou l'autre en cours de lecture : **Son** éteint tout, **Voix** ne coupe que la voix du
studio (la musique continue, et cesse de s'effacer sous personne). L'indicateur ne se
grise que s'il n'y a **aucune** voix : ni bande du studio, ni voix française dans le
navigateur.

| Action | Commande |
| --- | --- |
| Lecture / pause | clic sur l'image, ou `Espace` |
| Son | bouton **Son**, ou `S` |
| Voix | bouton **Voix**, ou `V` |
| Recommencer | `R` |

L'onglet repassé en arrière-plan met le film en pause — et la reprise reprend
exactement là où le son s'était arrêté.

## L'image d'abord : rien de posé sur le cadre

Le film se regarde. Le texte et l'habillage ne doivent pas manger l'image — deux règles,
appliquées aux six films.

**Aucun aplat sur l'image.** Toute la typographie était posée dans des boîtes opaques —
pastilles, plaques, cartons de sous-titres, bandeau de chaîne. Il n'en reste pas un seul :
les fonds pleins sont retirés, mais **les boîtes gardent exactement leur place** (seule la
peinture disparaît), donc le montage ne bouge pas d'un pixel. La typographie se lit par
son ombre portée et par un filet d'accent, et un voile en dégradé au bas du cadre détache
les sous-titres de n'importe quelle image. Rien n'a été supprimé : l'information est la
même, elle ne cache simplement plus le film. Le voile de vignettage s'est allégé au
centre (là où l'image se regarde) et assombri sur les bords (là où il ne mange rien).

**L'habillage de lecture s'efface pendant la lecture.** La barre de progression, les
bascules Son/Voix, la scène et le temps étaient posés sur l'image en permanence. Trois
secondes sans geste et ils s'effacent (`clean` sur `#stage`, **en opacité** : les boîtes
gardent leur place, rien ne se déplace, et l'audit continue de les mesurer) ; le premier
mouvement de souris, le premier appui ou la moindre touche les ramène. En pause ils
restent : il n'y a plus rien à cacher. Le clic sur ▶ compte comme un geste, et comme son
gestionnaire s'exécute **avant** le nôtre (l'écoute est posée sur `document`), l'horloge
du minuteur est armée avec la lecture déjà lancée — que le film démarre au clic, au doigt
ou à la barre d'espace.

## Les outils de vérification

```bash
bun run verify              # contrôles statiques, aucun navigateur requis
bun run shots               # captures + lecture réelle + mesure des bandes
bun run look                # aperçu du film en caractères, dans le terminal
bun tools/shoot.mjs --ascii --only 4,7 --width 150    # deux instants seulement
```- **`tools/verify.mjs`** — relit les films sans navigateur : autonomie (aucune
  ressource externe, les seules requêtes sont ses propres fichiers),
  syntaxe, scènes contiguës, répliques qui tiennent dans la durée, partition complète et
  chronologique, chaque son appelé existant réellement, **  modèle d'horloge unique**
  (l'image branchée sur `Audio.time()`, aucun contexte reconstruit, pause par
  `suspend()`, ducking planifié), **débit de parole**, **aucun son coupé avant la fin du
  film**, **chaque son du film a sa recette dans le studio** (un son sans recette est
  muet dans la bande : le bug « ce son ne se lance jamais » se voit ici, pas à
  l'oreille), et **cohérence de la bande** : la partition du manifeste doit être
  exactement celle du film (si le montage bouge, la bande est déclarée à refaire).
  **La voix est contrôlée de la même façon** : la bande vocale est déclarée par le film,
  le plan décrit **ce** montage-là (durée du film, nombre de répliques, instants),
  chaque réplique est prononcée **au même instant** que celui du film, la voix **tient
  dans la fenêtre** que le film lui donne, aucune ne marche sur la suivante, le texte
  prononcé est celui du film, le plan situe **chaque mot du sous-titre**, et la phrase
  reste prononçable (plafond 7,5 syllabes/s — mesuré, et non plus estimé en mots par
  seconde : avec la voix du studio, la fenêtre **est** la durée mesurée, donc l'ancien
  proxy ne dit plus rien). Le contrôle vérifie aussi que le **grand panel** n'annonce
  que des fichiers qui existent, et que la **banque couvre toutes les recettes**.
- **`tools/shoot.mjs`** — sert les films en HTTP (port libre, serveur maison : c'est
  le seul moyen qu'ils trouvent leur bande **et leur voix**) et pilote Chromium : les
  instants clés sont
  capturés et mesurés, les sous-titres vérifiés dans le cadre avec un mot surligné —
  **le même mot que la voix mesurée** —, puis **le film est vraiment joué** — l'horloge du son doit suivre le temps réel,
  l'écart image/son ne doit pas grandir, la pause doit geler le contexte, la reprise
  doit repartir du bon endroit. Il mesure enfin la **bande sur le fichier** (durée,
  crête, RMS, plus long trou de silence, et le niveau de ses deux dernières secondes :
  le son ne doit pas s'éteindre avant le dernier carton) et éprouve une fois le
  **repli `file://`**.
  Il éprouve encore la **voix du studio** : la bande vocale est chargée (et c'est bien
  elle qui joue, pas la voix du navigateur), la bascule **Voix** la coupe et la rallume,
  et la bande est **mesurée sur le fichier** — durée, crête, saturation, et surtout :
  **chaque réplique s'entend dans sa fenêtre**, seconde par seconde (« le sous-titre
  s'allume, mais personne ne parle » est un échec, pas un détail).
  Et il finit par le **grand panel d'assets** : la page est ouverte pour de vrai, ses
  images doivent s'être chargées une par une, ses **88 sources audio** sont demandées
  une par une (le chemin résolu comme le navigateur le résout), le filtre est exercé
  (« drapeau » ne garde que les cartes qui contiennent le mot, vider le filtre les
  remet toutes), rien ne doit déborder à 390 px, et la page est photographiée aux deux
  formats.
  `--panel` (ou `bun run shots:panel`) ne fait que ce dernier parcours : une
  trentaine de secondes, pour relire la page après l'avoir touchée.
  Pour les films qui en portent, il contrôle aussi l'**habillage de diffusion** :
  bandeau, chaîne et cartouche dans le cadre, horloge qui suit le film, témoin du
  micro allumé sur la voix et éteint dans les silences, cartouche qui ne marche pas
  sur les sous-titres, compo qui se remplit, compteur d'erratums qui monte.
- **`--viewport`** — l'audit de mise en page (rien hors cadre, aucun chevauchement,
  textes lisibles, cibles tactiles) se juge à la taille où le film est regardé :

```bash
bun tools/shoot.mjs --viewport 390x844                  # téléphone, pour les films 9:16
bun tools/shoot.mjs --viewport 1080x1920                # le 9:16 à sa taille natale
bun tools/shoot.mjs --viewport 1920x1080 nyxar-n3.html  # le 16:9 à sa taille natale
```

- **aperçu ASCII** — le même outil redessine l'image en caractères : utile pour juger
  un cadrage sans écran. Le studio sait faire pareil pour ses plaques.

Playwright est une dépendance de développement : si Chromium manque,

```bash
bun add -d playwright && bunx playwright install --with-deps chromium
```

## Ce qui a été vérifié — et ce qui ne l'a pas été

- **404 contrôles statiques** (6 films + le studio et son panel) passent, sans un échec
  ni une réserve — rejoués **après** la passe « l'image d'abord » et la retouche du
  placement des cartons : c'est le contrôle qui dit que rien n'a bougé du côté du son,
  de la voix, des sous-titres et des cartons. Puis le balayage dynamique a été rejoué
  **film par film**, au téléphone **et** à la taille native : 66 à 78 contrôles par film,
  **0 échec** (le grand panel est revérifié à chaque passage). Le balayage complet
  (`bun run shots` : les six films d'affilée, puis le panel) tient dans une seule
  commande ; chaque film se contrôle aussi seul (`bun tools/shoot.mjs herobrine.html`)
- lecture réelle : l'horloge du son suit le temps réel, l'écart image/son ne grandit pas
  (23,2 ms puis 23,2 ms sur 1,3 s), la pause gèle vraiment le contexte (2 700,8 ms →
  2 700,8 ms en 800 ms), la reprise repart du bon endroit (+1 045 ms) — le repli
  `file://` se comporte pareil, sans une erreur de page. Sur **Herobrine**, mesuré à la
  dernière passe : bande du studio bien celle qui joue (42,8 s, niveau ramené à 1,003×),
  écart image/son 23,2 ms puis 23,2 ms, pause gelée à 3 722,5 ms, reprise +1 000 ms,
  réglages **Son** et **Voix** exercés, et le repli `file://` qui calcule sa partition
  lui-même puis joue quand même (1 147,4 ms après 1,2 s)
- bandes mesurées sur les fichiers : 44,2 s (Astan), 34,8 s (Boby), **47,0 s (CS AXIUM)**,
  40,8 s (Litel) et 37,8 s (Nyxar) à 32 kHz, crête 0,90, **aucun échantillon saturé** et
  **aucun trou de silence** — le silence continu le plus long est passé de 0,421 s
  (Astan) à 0,008 s sur les cinq, parce que le lit d'ambiance va désormais jusqu'au bout
  du film ; le niveau tient sur les deux dernières secondes de chacun (RMS 0,09 à 0,16).
  Le nouveau film suit la même règle : **42,8 s (Herobrine), 126 cues**, crête 0,89,
  RMS 0,18, **aucun échantillon saturé**, plus long silence continu 0,008 s, et
  RMS 0,13 sur ses deux dernières secondes
- **voix du studio** : 45 répliques prononcées, mesurées et posées sur six bandes
  (44,0 / 34,6 / 46,8 / 40,6 / **42,6 (Herobrine)** / 37,6 s, crête 0,90, **aucune
  saturation**), à 32 kHz mono ;
  la voix s'entend **dans chacune des 45 fenêtres annoncées** (mesuré seconde par
  seconde sur le fichier), aucune ne marche sur la suivante, la bascule Voix la coupe
  et la rallume (niveau 0,95 → 0 → 0,95), et le mot surligné par le sous-titre est
  **le mot que le studio a mesuré** à cet instant ; la voix va à 4,2-4,6 syllabes/s au
  plus selon le film (plafond 7,5)
- mise en page, premières passes : **0 défaut** au téléphone (390×844 pour les trois 9:16) **et** à la
  taille natale (1080×1920 et 1920×1080) — c'est cet audit qui avait fait remonter les
  pastilles hors écran d'Astan City (au téléphone) et la mention légale de Nyxar posée
  sous la bande des sous-titres ; les deux causes ont été corrigées dans le film, pas
  dans le contrôle. Le film 16:9 **Litel** a en plus été audité à quatre fenêtres
  (390×844, 360×640, 768×1024, 1280×720) : **0 défaut** partout, ses cartons de
  l'enseigne ayant été replacés pour ne plus passer sous le sous-titre en téléphone, et
  l'habillage de lecture prenant un plancher de 12 px sur une fenêtre étroite. Le film
  **Herobrine** a été audité aux mêmes quatre fenêtres, et **0 défaut** également —
  c'est cet audit qui a fait remonter, et corriger, trois choses : l'habillage de
  lecture (horloge, bascules) qui tombait à 11,7 px puis 8,2 px sur des fenêtres
  étroites, le compteur de torches qui croisait la pastille « Aucune trace » en 360 px,
  et la ligne de crédit finale qui descendait à 9 px dans un cadre de 405 px
- mise en page, **dernière passe** (après « l'image d'abord ») : les six films rejoués au
  téléphone **et** à la taille native — 9:16 à 390×844 puis 1080×1920, 16:9 à 390×844
  puis 1920×1080 : **0 défaut de cadrage partout**, et **aucune erreur de page**. C'est
  cette passe qui a fait remonter un vrai défaut de code, corrigé dans les six films :
  un carton replacé pour le téléphone gardait la place du téléphone après un retour au
  grand écran, parce que la clé du placement téléphone n'existait pas dans la maquette et
  n'était donc jamais réécrite. Le constructeur de cartons retire maintenant ce qu'il a
  posé et que la nouvelle place ne redéfinit pas (mesuré : le titre de la révélation de
  Nyxar repasse bien de 120 px — la place du téléphone — à sa place de maquette, 250 px,
  après 390 → 360 → 1920 px)
- l'habillage qui s'efface a été **vérifié dans le navigateur sur les six films** : clic
  sur ▶ → habillage visible ; 3,6 s sans geste → opacité 0 (`clean`) ; un mouvement de
  souris → 1 ; `Espace` (pause) → 1. Aucune erreur de page. Le cadrage de l'habillage est
  mesuré aux mêmes instants qu'avant (les boîtes n'ont pas bougé)
- **export vocal** : les six films produisent leur `.jsx` et leur `.txt` (45 répliques,
  565 sons au total), les six scripts se relisent sans erreur de syntaxe, et les
  calques y sont posés sur la **durée mesurée** de la voix (45 répliques sur 45), avec le
  chemin de la bande vocale à importer
- **grand panel d'assets**, ouvert dans Chromium : 8 familles, **76 sons jouables**,
  6 films (6 bandes, 6 voix), **60 plaques en 7 colonnes** + la planche de contact,
  **61 images chargées** (aucune coupure) et **88 sources audio vérifiées une par une**
  (55,9 Mo), le filtre qui trie 150 cartes et les remet, aucun débordement à 390 px,
  **aucune erreur JavaScript**. C'est ce contrôle qui a attrapé les 76 lecteurs et les
  plaques en 404 (`/assets/assets/…`) et l'empilement des plaques sur une colonne :
  deux défauts invisibles au contrôle statique, et pourtant définitifs pour l'œil et
  pour l'oreille
- repli `file://` : le film calcule sa partition, la joue, et garde la même horloge
- **ce qui n'a pas pu être vérifié** : le modèle vocal se télécharge au premier usage
  (63 Mo, `tools/assets/models/`, hors dépôt) — sans réseau, il faut le poser à la main ;
  et le `.jsx` d'export se relit sans erreur de syntaxe mais n'a **pas été exécuté dans
  After Effects** (le logiciel n'est pas sur cette machine)
- **la réserve du cadre étroit est levée** : sur une fenêtre de 390 px de large, le cadre
  du 16:9 ne fait que 390×219, et deux cartons de **Nyxar** s'y chevauchaient — le titre
  de la révélation et la pastille d'équipement. Ils ont été replacés **au téléphone
  seulement** (le titre remonte, la pastille descend) : la composition de la maquette ne
  change pas sur grand écran. L'audit rejoué donne **0 défaut** à 390×844, 360×640 et
  1920×1080. Litel, l'autre 16:9, était déjà propre à cette taille — et le reste
- coût de rendu mesuré : **1,3 ms par image** pour le film dessiné (Boby), 0,8 ms pour
  Astan City — l'image ne prend pas l'horloge du son de vitesse

**Ce que je ne peux pas juger** : je n'ai ni oreille ni écran. Les niveaux, les durées,
les débits, les silences, les cadrages et les horloges sont *mesurés* ; le **charme** du
son, le **timbre de la voix** (celle du studio est un français masculin « medium », elle
n'a jamais été écoutée ici) et la **drôlerie** de Boby ne le sont pas. Deux moyens de
relecture sans œil ont servi de béquille : l'aperçu ASCII pour le cadrage, et
`sample(x, y)` (exposé par le film de Boby) pour lire des pixels — c'est ainsi qu'on a
vérifié que la peau, le ciel, la pelouse et le tampon ERRATUM sont bien là où le
dessin les place. Chromium sans écran n'a pas de voix française : les voix n'ont donc
jamais été entendues, seuls leurs débits, fenêtres et sous-titres ont été mesurés.
Ouvrir les films dans Safari ou Chrome pour les écouter.

Produits, marques, prix, effectif, chaîne et commentateurs sont **fictifs** ; tous les
dessins, les sons et les plaques sont originaux et fabriqués ici.
