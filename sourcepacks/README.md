# sourcepacks/

Ce dossier n'est plus le point de dépôt : les packs sources sont **à la racine du dépôt**
(`V1.6.6-1DeadZone.mcaddon`, `True Survival - …mcaddon`, `RZA Structures …mcpack`, etc.).

Pour (re)générer la bibliothèque d'assets importée par le générateur :

```bash
bun run sources:extract
```

Cela écrit `public/sourcepacks/` :

```
public/sourcepacks/
├── manifest.json          # description de tout ce qui est importable
├── structures/<pack>/…    # .mcstructure copiés tels quels
└── sounds/<pack>/…        # .ogg / .fsb copiés tels quels
```

`bun run pack:build` lit ce manifeste et embarque les assets dans le `.mcaddon` généré, en
ajoutant pour chaque structure un `features/*.json` + `feature_rules/*.json` afin qu'elle
apparaisse réellement dans le monde.

Les **armures** des donneurs ne viennent pas d'ici mais de `public/harvest/donors/`
(`bun run pack:harvest`), qui gère la chaîne de rendu complète.

Voir `../SOURCEPACKS.md` pour le détail et l'avertissement de licence.
