# SOURCEPACKS — packs sources du dépôt

Les 8 packs déposés à la racine du dépôt (~192 Mo) servent de **réserve d'assets**.
Le générateur REMNANT écrit tout le reste en JSON/texte ; ce qu'il ne peut pas fabriquer,
il le prend ici :

| Type de fichier | Ce qu'on en fait |
|---|---|
| `.mcstructure` (binaire) | copié dans `BP/structures/`, avec un `features/*.json` + `feature_rules/*.json` généré pour chaque, donc les bâtiments apparaissent vraiment en jeu |
| `.ogg` / `.fsb` | copié dans `RP/sounds/` + `sounds/sound_definitions.json` câblé (`remnant.gunshot`, `remnant.growl`, `remnant.impact`, `remnant.ambience`) et joué par le script |
| **armures** (item + icône + attachable + géométrie + animation + render controller + texture) | **fusionnées** : 345 pièces extraites par `scripts/harvest-armor.ts` dans `public/harvest/donors/`, avec résolution des collisions de chemins, de clés de texture et d'identifiants |

Ni la logique, ni les entités des donneurs ne sont repris : le script du pack est écrit par
REMNANT. Les auteurs sont crédités dans le `LISEZ-MOI.txt` du pack généré.

Deux familles de formats ont dû être réconciliées pendant la fusion :
- le **slot** `armor_head` (True Survival, Aplok) → `slot.armor.head` (format moderne) :
  **84 pièces** normalisées ;
- l'**icône** d'item, qui a trois formes (`"key"`, `{"texture": "key"}`,
  `{"textures": {"default": "key"}}`) ; les clés sont préfixées par le donneur pour
  qu'aucune ne s'écrase (`deadzone_assault_vest_black`) ;
- la **géométrie**, déclarée en `*.geo.json` ou dans `models/**/*.json` nu, et sous trois
  formes d'identifiant (tableau `minecraft:geometry`, objet unique, ou clé racine
  `"geometry.nom"` en legacy 1.10).

Les textures vont du `.png` au `.tga` selon le pack.

---

## Les packs présents

| Clé | Fichier | Auteur | Apporte |
|---|---|---|---|
| `deadzone` | `V1.6.6-1DeadZone.mcaddon` | N_z | 16 structures de ville, 24 sons |
| `true_survival` | `True Survival - Zombie Apocalypse (V0.0.4).mcaddon` | Four Worlds Studios | 16 bâtiments, 13 sons |
| `rza` | `RZA Structures v1.2.21.mcpack` | Raboy13 | 16 structures |
| `aplok_guns` | `Aplok Guns BP-v1.8.8.mcaddon` | Aplok | 2 structures, 18 sons d'armes |
| `project_walker` | `Project-Walker-1.8.13.mcaddon` | GabrielAplok | 16 structures, 24 sons |
| `dyingdayz` | `DyingDayZ.mcaddon` | Communauté | 14 structures, 18 sons |
| `hundred_days` | `zombie_apocalypse.mcaddon` | Spartan Studios | 2 structures, 18 sons |

`UndeadCraft-0.0.4.zip` est un modpack **Java Edition** (CurseForge) : aucun asset Bedrock,
il est ignoré par l'extraction.

---

## Comment ça marche

1. **Extraction** — lit les archives, cure et écrit la bibliothèque :

   ```bash
   bun run sources:extract      # ou : bun run scripts/extract-sources.ts
   ```

   Règles de curation : structures ≤ 400 Ko, max 16 par pack, ≤ 8 Mo au total ;
   sons ≤ 220 Ko, max 6 par événement, ≤ 3 Mo au total. Les noms courts qui entrent en
   collision reçoivent un suffixe de hachage pour qu'aucun fichier n'en écrase un autre.

   Résultat : **82 structures (8 Mo)** et **115 sons (1,9 Mo)** dans `public/sourcepacks/` —
   soit 197 fichiers + un `manifest.json` qui décrit tout (`grep -c '"file":' manifest.json` :
   82 entrées `structures/`, 115 entrées `sounds/`, correspondance 1:1 avec le disque).

2. **Fusion des armures** — extrait les pièces portables et toute leur chaîne de rendu :

   ```bash
   bun run pack:harvest
   ```

3. **Génération** — assemble le tout dans le `.mcaddon` final :

   ```bash
   bun run pack:build            # -> dist-pack/Remnant_Apocalypse.mcaddon
   bun run scripts/verify-pack.ts # contrôle l'artefact produit
   ```

---

## Avertissement de licence

Ces packs appartiennent à leurs auteurs. Le pack généré embarque désormais leurs fichiers
(structures, sons, **et 345 pièces d'armure**) : c'est un usage **personnel / roleplay**,
assumé et autorisé pour ce dépôt.

Ce que ça implique :

1. **Ne pas publier** `dist-pack/Remnant_Apocalypse.mcaddon` ni `public/harvest/` : ce
   serait de la redistribution, et deux de ces packs l'interdisent explicitement
   (Aplok = CC BY-NC-ND, DeadZone = « without MY permission »).
2. Les 8 archives (~192 Mo) sont **dans l'historique Git**. Si tu publies le dépôt,
   envisage Git LFS ou leur retrait.
3. `public/harvest/` est déjà dans le `.gitignore`. Pour revenir à un pack 100 % original,
   vide ce dossier avant `bun run pack:build` : le build le signale et continue.

Le détail des licences trouvées, pack par pack, est dans `ANALYSE-PACKS.md`.
