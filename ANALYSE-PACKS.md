# ANALYSE DES 8 PACKS

Analyse automatisée : chaque archive est ouverte récursivement (y compris les `.mcpack`
imbriqués), puis inventoriée — items, entités, blocs, animations, render controllers,
géométries, fichiers `ui/`, scripts, sons, structures — avec un parsing des composants
`minecraft:wearable` pour les armures et une recherche de motifs « barre de vie / énergie /
soif / faim » dans tous les JSON et scripts.

Chiffres bruts : `analysis/packs.json`.

---

## Verdict par pack

| Pack | Entrées | Items | Entités | Blocs | Pièces portables | Dont protection ≥ 4 | Barres/HUD | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|---|
| **V1.6.6-1DeadZone** (N_z) | 6613 | 764 | 68 | 150 | **227** | ~40 | bleeding, énergie, soif, faim, température, HUD | 🥇 **La mine d'or**, mais 105 pièces sont de la protection 1 |
| **True Survival [MobBlocks]** | 2306 | 389 | 44 | **269** | 74 | ~10 | **énergie/stamina**, soif, faim, barre de progression | 🥈 Gigantesque, mais ses « armures » sont surtout des vêtements |
| **DyingDayZ** | 1805 | 164 | 64 | 34 | 34 | **28** | bleeding, HUD, faim, température, soif | 🥇 **Le meilleur set d'armures cohérent** |
| **Aplok Guns** | 1235 | 159 | 8 | 51 | 10 | **9** | HUD | 🥇 **Les meilleures armures (protection max)** |
| **Project Walker** | 1916 | 86 | 9 | 36 | 0 | 0 | HUD, faim, soif, température, bleeding | Structures + HUD, rien à porter |
| **One Hundred Days Later** | 3405 | 0 | **34** | 15 | 0 | 0 | température, faim | Zombies/traps/landmine scriptés, pas d'armure |
| **RZA Structures** | 43 | 0 | 1 | 0 | 0 | 0 | — | Structures uniquement |
| **UndeadCraft** | 878 | 1 | 0 | 0 | 0 | 0 | — | ❌ **Java Edition (CurseForge), inutilisable en Bedrock** |

---

## ⛔ Blocage juridique : les assets ne sont PAS réutilisables

C'est le point le plus important de l'analyse, et il contredit l'idée « on prend leurs
armures ». Vérification faite dans les fichiers eux-mêmes :

| Pack | Termes trouvés dans l'archive | Redistribution dans un pack publié |
|---|---|---|
| **Aplok Guns** | En-tête sur **434 fichiers** + `LICENSE.md` : « Copyright 2025 <FireWave Interactive>. This work is licensed under the Creative Commons **Attribution-NonCommercial-NoDerivatives 4.0** International License. *You may not use this work for commercial purposes, and you may not alter, transform, or build upon this work.* » | ❌ **Non** — ND interdit les dérivés, NC interdit l'usage commercial |
| **DeadZone** | `DeadZzoneRp/license.txt` : « All Image and code stuff is Copyright, so don't take it, steal it, or **other that without MY permission** » | ❌ **Non** — permission explicite requise |
| **DyingDayZ** | « all stuff here are copyrighted to the right owner (Akiohh /or Menkrep P) » | ❌ **Non** — copyright réservé |
| **True Survival** | Aucune mention de licence dans les 2 306 fichiers | ❌ **Non** — sans licence, le droit d'auteur s'applique par défaut (tous droits réservés) |

**Décision prise :** le pack est destiné à un **roleplay personnel**, pas à une publication.
La fusion embarque donc les 345 pièces (items + icônes + géométries + textures +
attachables), ce qui est un usage privé légitime.

La limite reste la même et il faut la connaître : **ne pas publier** le `.mcaddon` produit
ni `public/harvest/`. Un pack Bedrock se partage fichier par fichier, donc redistribuer ces
assets (même en créditant) ne tient pas — deux des packs l'interdisent explicitement
(Aplok = CC BY-NC-ND, DeadZone = « without MY permission »).

**Ce qui est réimplémenté plutôt que copié :**
- Les **mécaniques** : une barre d'énergie qui se vide en sprintant ou une infection qui se
déclare après morsure sont des *idées*, pas des fichiers. Réécrites de zéro.
- Le **script** du pack, entièrement original (aucun `main.js` de donneur n'est repris).
- Nos **14 sets d'armure**, nos icônes 16×16, nos feuilles d'armure 64×32, nos armes, nos
  blocs, nos entités — en plus des armures donneurs fusionnées.

---

## Ce qui est bon

### 1. Les armures — c'est bien là que ça se joue
**345 pièces portables** au total, et **toutes** ont une protection > 0 :

| Pack | Pièces | Protection 1 | 2-3 | 4-7 | 8-10 | 15-20 |
|---|---:|---:|---:|---:|---:|---:|
| DeadZone | 227 | **105** | 70 | 40 | 10 | 2 (15 et 20) |
| True Survival | 74 | 7 | 26 | 35 | 6 | 0 |
| DyingDayZ | 34 | 0 | 5 | 19 | 9 | 0 |
| Aplok Guns | 10 | 0 | 1 | 5 | **4** | 0 |

- **DeadZone** = le catalogue : 36 torse, 83 tête, 71 jambes, 37 pieds — gilets pare-balles, plaques, stab-vests, ghillie, hazmat, cuir, polaire, jeans, casquettes, masques à gaz. **Mais la moitié est de la protection 1** (cosmétique). Les vraies pièces : `plate_vest_*`, `assault_vest_*`, `tactical_vest_*`, `stab_vest_*`, `ballistic_*`, `chainmail_*`, `hazmat_*_top/bottom`, `gasmask_*`, `police_riot`, `firefighter_*` + deux pièces hors-norme à **protection 15 et 20**.
- **DyingDayZ** = la meilleure **progression** : 34 pièces réparties proprement sur les 4 slots — `swat_armor`, `swat`, `tactical_vest`, `bodyarmor_black/green/tan`, `advanced_vest`, `gas_mask`, `hazmat`, `bulletprof_mask`, `police_vest`. 28 sur 34 sont à protection ≥ 4.
- **Aplok Guns** = le **haut de gamme militaire** : `vest_6b13`, `vest_6b3`, `vest_bnti_gzhelk`, `helmet_6b47`, `helmet_6b47_nvg`, `nvg`, `juggernaut` — 4 pièces à protection 10.
- **True Survival** = 74 pièces, mais ce sont **surtout des vêtements** (casques de vélo, bonnets, pyjamas, maillots de course, chaussons, t-shirts). Protection 1-3 pour la majorité. À garder comme **couche vestimentaire réaliste**, pas comme armure. *(C'est la nuance importante : tu les trouvais bien — elles sont jolies et utiles pour le réalisme, mais elles ne protègent presque pas.)*

### 2. Les barres de vie / énergie / survie
Preuves trouvées :
- **True Survival** : système d'**énergie/stamina** (`items/medical/stamina_brew.json`, `progress_bar`) — le plus lisible du lot.
- **DeadZone** : `stats.js` (9 Ko) + `bleeding_system.js` + `medical.js` + `entities/player/player.json` qui porte **énergie, soif, température, saignement**.
- **DyingDayZ** : `setArmorPoints.js` (un vrai système de points d'armure !), `bleeding` avec `render_controllers/bleed.json`, `ui/hud_screen.json`.
- **Project Walker** : `ui/hud/hud_elements.json` + `hud_screen.json`.
- **Aplok Guns** : `ui/hud_screen.json`.

### 3. Les scripts (le vrai savoir-faire)
- **True Survival** : `vehicles.js` (51 Ko), `structures.js` (27 Ko), `backpacks.js` (19 Ko), `food.js` (19 Ko), `flashlight.js`, `chainsaw.js`, `flamethrower.js`, `legInjury.js`, `gravestones.js`, `crops.js` — de loin la plus grosse base de code.
- **DeadZone** : `blocks.js` (24 Ko), `core_system.js` (22 Ko), `bullet.js` (14 Ko), `gun_type_config.js` (14 Ko), `skins.js`, `backpack.js`, `advancements.js`, `death_message.js`.
- **Aplok Guns** : `data.js` (51 Ko), `bullet-projectile.js` (20 Ko), `attachments.js` (12 Ko), `weapons.js`, `ammo.js` — la référence armes à feu.
- **100 Days** : `bloodmoon_main.js`, `traps.js`, `landmine.js`, `infection.js`, `durability.js`.

### 4. Les autres sources de contenu
- **269 blocs** chez True Survival, **150** chez DeadZone, **51** chez Aplok.
- **189 render controllers / 164 animations / 177 géométries** chez DeadZone, **121 géos / 43 anims** chez DyingDayZ : c'est ce qui donne des armures *visibles* et non des icônes plates.
- **34 entités** chez 100 Days, **68** chez DeadZone, **64** chez DyingDayZ.

---

## Ce qui ne va pas (les pièges réels)

1. **Les HUD sont en conflit frontal.** DeadZone, DyingDayZ, Aplok Guns, Project Walker **écrasent tous `ui/hud_screen.json`**. Un pack ne peut en charger qu'un : fusionner les quatre tels quels donnerait un HUD au hasard, probablement cassé. → Il faut **écrire notre propre HUD** (barres santé/énergie/soif/saignement) au lieu de recopier le leur.
2. **Les entités joueur sont en conflit.** DeadZone, DyingDayZ et Project Walker redéfinissent tous `entities/player/player.json` avec leurs propres stats. Une seule définition peut gagner.
3. **Deux formats de slots d'armure coexistent.** DeadZone et DyingDayZ utilisent le format moderne `slot.armor.head/chest/legs/feet` ; True Survival et Aplok Guns utilisent l'ancien `armor_head / armor_torso / armor_legs / armor_feet`. L'ancien format reste toléré, mais c'est un risque de compatibilité à normaliser avant fusion.
4. **Qualité très inégale chez DeadZone** : 105 pièces sur 227 à protection 1. Tout embarquer ajoute ~105 items quasi inutiles dans l'inventaire créatif.
5. **UndeadCraft est un modpack Java** (`manifest.json`, `overrides/`, `modlist.html`) : **zéro asset Bedrock**. À exclure définitivement.
6. **RZA et 100 Days n'ont aucune armure** — RZA ne fournit que des structures, 100 Days des entités et des pièges.
7. **Bon point sur les identifiants** : les 4 packs à armures utilisent des namespaces **distincts** — `mcpe:` (DeadZone), `hengker:` (DyingDayZ), `mbl_ts:` (True Survival), `trenbankai:` (Aplok). **Aucune collision d'identifiant**, donc les items peuvent réellement cohabiter sans renommage. Les collisions sont uniquement dans les **chemins de fichiers ressources** (textures, géométries, animations) et dans les `ui/` + player entity ci-dessus.

---

## Plan de fusion retenu

| Couche | Décision |
|---|---|
| **Armures** | **Les deux** : nos **14 sets** originaux (fortune → cuir → Hazmat → kevlar II → anti-émeute → mailles → NBC → porte-plaques III → SWAT → EOD → céramique → exosquelette → composite) **plus les 345 pièces des donneurs** fusionnées avec leur chaîne de rendu. Total : **401 pièces portables** |
| **Barres (santé/énergie/soif/saignement)** | **Réécrites par nous**, en action-bar scriptée — impossible de fusionner leurs HUD |
| **Entité joueur** | **La nôtre** (une seule), pas les leurs |
| **Slots d'armure** | Normalisés en `slot.armor.*` |
| **Zombies / variantes / boss** | Déjà faits (16 + 14) |
| **Armes** | Les nôtres (15) ; leurs armes scriptées (Aplok/DeadZone) dépendent de tout leur `core_system` → hors périmètre v1 |
| **Structures** | 82 déjà importées + 6 générées |
| **Sons** | 115 déjà importés |
| **UndeadCraft** | Exclu |

---

## Ce qui a été livré

Le site web a été supprimé : le dépôt est maintenant un **générateur en ligne de commande**.

```bash
bun run sources:extract   # structures + sons des donneurs  -> public/sourcepacks/
bun run pack:harvest      # armures des donneurs              -> public/harvest/donors/
bun run pack:build        # fusion finale                     -> dist-pack/Remnant_Apocalypse.mcaddon
bun run scripts/verify-pack.ts   # contrôle de l'artefact produit
bun run typecheck
```

**1. Armures originales — 14 sets × 4 pièces = 56 items** (`generator/armor.ts`), avec des
feuilles d'armure **générées set par set** (28 PNG 64×32 distincts) au lieu des textures
vanilla fer/diamant/or utilisées avant.

| Palier | Set | Protection | Durabilité | Matériau |
|---|---|---:|---:|---|
| 1 | Armure de fortune | 1 | 120 | pépite de fer |
| 1 | Veste de cuir renforcée | 2 | 150 | cuir |
| 2 | Combinaison Hazmat 🔒 | 2 | 190 | cuir |
| 2 | Tenue de pompier | 3 | 240 | lingot de fer |
| 2 | Cotte de mailles | 3 | 210 | lingot de fer |
| 2 | Gilet pare-balles dissimulé (II) | 4 | 250 | lingot de fer |
| 3 | Tenue anti-émeute | 5 | 300 | lingot de fer |
| 3 | Combinaison NBC lourde 🔒 | 6 | 330 | lingot de fer |
| 3 | Porte-plaques niveau III | 6 | 360 | lingot de fer |
| 4 | Assaut SWAT | 7 | 400 | diamant |
| 4 | Tenue de déminage EOD | 8 | 460 | diamant |
| 4 | Plaques céramique lourdes | 9 | 520 | diamant |
| 5 | Exosquelette d'assaut | 10 | 600 | netherite |
| 5 | Armure composite expérimentale | 10 | 700 | netherite |

🔒 = porter une pièce bloque l'infection scriptée. Les trois meilleurs sets tombent aussi
dans le butin des boss.

**2. Armures des donneurs — les 345 pièces fusionnées.** Extraites par
`scripts/harvest-armor.ts` (`bun run pack:harvest`) avec toute leur chaîne de rendu :

| Donneur | Pièces | Ce que ça apporte |
|---|---:|---|
| DeadZone | 227 | Le catalogue : gilets pare-balles, plaques, stab-vests, ghillie, Hazmat, cuir, polaire, jeans, casquettes, masques à gaz |
| True Survival | 74 | La couche vestimentaire réaliste (casques, bonnets, maillots, chaussons) |
| DyingDayZ | 34 | La meilleure progression cohérente sur les 4 slots |
| Aplok Guns | 10 | Le haut de gamme militaire (juggernaut, 6b13, 6b47, NVG) |
| **Total** | **401** | avec les 56 originales |

Ce que la fusion a dû réconcilier : **84 slots** legacy → `slot.armor.*`, les clés de
texture préfixées par donneur (`deadzone_assault_vest_black`) pour qu'aucune ne s'écrase,
les géométries indexées sous leurs **trois** formes d'identifiant, les textures `.tga`
d'Aplok, et 115 recettes dont les ingrédients existent tous dans le pack (les autres sont
écartées plutôt que cassées).

**3. Barres de survie — adaptées, réécrites** (`generator/scripts.ts`) : une seule barre
d'action affiche `PV`, `EN` (énergie), `EAU` (soif), plus `SANG` et `INF` quand ils sont
actifs. L'énergie se vide en sprintant et bloque le joueur quand elle est à zéro ; la soif
descend avec le temps ; l'hémorragie saigne tant qu'elle n'est pas pansée ; l'infection monte
toute seule jusqu'à l'issue fatale. Les objets agissent dessus (bandage −35 sang… antiviral
purge, ration +45 énergie). L'état est sauvegardé en propriété dynamique, il survit à la
déconnexion. Les quatre HUD des packs sources n'ont pas été copiés : ils se seraient écrasés
mutuellement (voir le piège nº 1).
