import JSZip from 'jszip'
import { behaviorEntityFile, clientEntityFile, tradeTableFile } from './entities'
import { spawnRuleFile } from './spawn'
import { lootTableFile } from './loot'
import { itemFiles, itemIconSpecs, itemRecipeFiles } from './items'
import {
  armorAttachableFiles,
  armorItemFiles,
  armorItemSpecs,
  armorRecipeFiles,
  armorTextureJobs,
} from './armor'
import {
  blockFiles,
  blockGeometryFiles,
  blockRecipeFiles,
  blockTextureJobs,
  enabledBlocks,
  terrainTextureData,
} from './blocks'
import { scriptFile, availableItemIds } from './scripts'
import {
  loadManifest,
  selectedSourceKeys,
  sourceMap,
  type AssetLoader,
  type SourceKey,
} from './assets'
import { behaviorManifest, makeUuids, resourceManifest } from './manifests'
import { enabledVariants } from './options'
import { ARMOR_SETS } from './armor'

const ARMOR_SET_COUNT = ARMOR_SETS.length
import { BOSSES, CREATURES, HOSTILES, NPCS, variantToMob, type MobDef } from './mobs'
import { emptyDonors, type DonorPayload } from './donors'
import { biomeFogFile, fogFiles } from './fog'
import { json, sanitizeNamespace } from './minecraft'
import {
  activeAmmo,
  activeWeapons,
  hasFirearms,
  weaponAttachableFiles,
  weaponGeometryFiles,
  weaponItemFiles,
  weaponItemSpecs,
  weaponRecipeFiles,
} from './weapons'
import {
  armorSheet,
  blockTexture,
  canvasAvailable,
  iconKey,
  iconPath,
  itemIcon,
  materialPath,
  weaponTexture,
  type ArmorSheetSpec,
  type BlockTexKind,
  type IconSpec,
  type TexKind,
} from './textures'
import type { BuildResult, GeneratedFile, PackConfig, PackContents } from './types'

export function normalizeConfig(cfg: PackConfig): PackConfig {
  return {
    ...cfg,
    packName: cfg.packName.trim() || 'Remnant Apocalypse',
    namespace: sanitizeNamespace(cfg.namespace || 'remnant'),
    author: cfg.author.trim() || 'Forge REMNANT',
    sources: { ...sourceMap(false), ...(cfg.sources ?? {}) },
  }
}

export function folderName(cfg: PackConfig): string {
  const base = cfg.packName
    .trim()
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
  return base.length > 0 ? base : 'Remnant_Pack'
}

export function enabledMobs(cfg: PackConfig): MobDef[] {
  const list = enabledVariants(cfg).map(variantToMob)
  if (cfg.mechanics.infectedFauna) list.push(...CREATURES)
  if (cfg.mechanics.hostiles) list.push(...HOSTILES)
  if (cfg.mechanics.survivors) list.push(...NPCS)
  if (cfg.mechanics.bosses) list.push(...BOSSES)
  return list
}

interface TexturePlan {
  weapons: Set<TexKind>
  icons: { path: string; icon: IconSpec }[]
  blocks: { path: string; kind: BlockTexKind }[]
  armor: { path: string; spec: ArmorSheetSpec; layer: 'l1' | 'l2' }[]
}

function texturePlan(cfg: PackConfig, customTextures: boolean): TexturePlan {
  const weapons = new Set<TexKind>()
  const icons: TexturePlan['icons'] = []
  const blocks: TexturePlan['blocks'] = []
  const armor: TexturePlan['armor'] = []
  if (!customTextures) return { weapons, icons, blocks, armor }

  for (const weapon of activeWeapons(cfg)) weapons.add(weapon.texKind)
  for (const spec of weaponItemSpecs(cfg, true)) icons.push({ path: spec.texturePath, icon: spec.icon })
  for (const spec of itemIconSpecs(cfg, true)) icons.push({ path: spec.texturePath, icon: spec.icon })
  for (const spec of armorItemSpecs(cfg, true)) icons.push({ path: spec.texturePath, icon: spec.icon })
  for (const job of blockTextureJobs(cfg)) blocks.push({ path: job.path, kind: job.kind })
  for (const job of armorTextureJobs(cfg)) armor.push(job)

  return { weapons, icons, blocks, armor }
}

async function generateTextures(
  cfg: PackConfig,
  customTextures: boolean,
): Promise<{ files: GeneratedFile[]; ok: boolean }> {
  if (!customTextures) return { files: [], ok: false }
  try {
    const plan = texturePlan(cfg, true)
    const files: GeneratedFile[] = []
    for (const kind of plan.weapons) {
      files.push({ path: `${materialPath(cfg.namespace, kind)}.png`, content: await weaponTexture(kind) })
    }
    for (const entry of plan.icons) {
      files.push({ path: `${entry.path}.png`, content: await itemIcon(entry.icon) })
    }
    for (const entry of plan.blocks) {
      files.push({ path: entry.path, content: await blockTexture(entry.kind) })
    }
    for (const job of plan.armor) {
      files.push({ path: job.path, content: await armorSheet(job.spec, job.layer) })
    }
    return { files, ok: true }
  } catch (error) {
    // Swallowing this silently produced a pack with no textures at all.
    console.error('!! textures non générées :', (error as Error).message)
    return { files: [], ok: false }
  }
}

export interface ImportedAssets {
  behavior: GeneratedFile[]
  resource: GeneratedFile[]
  soundEvents: string[]
  structures: number
  sounds: number
}

const MAX_SOUNDS_PER_EVENT = 8

/**
 * Pulls the curated `.mcstructure` and sound files out of the donor packs
 * dropped in the repository. Every structure also gets a feature + feature
 * rule so it actually generates in the world.
 */
export async function importAssets(
  cfg: PackConfig,
  loader: AssetLoader | null,
): Promise<ImportedAssets> {
  const empty: ImportedAssets = { behavior: [], resource: [], soundEvents: [], structures: 0, sounds: 0 }
  if (!loader) return empty
  const keys = selectedSourceKeys(cfg.sources)
  if (keys.length === 0) return empty

  const manifest = await loadManifest(loader)
  if (!manifest) return empty

  const ns = cfg.namespace
  const behavior: GeneratedFile[] = []
  const resource: GeneratedFile[] = []
  const soundDefs: Record<string, { category: string; sounds: { name: string }[] }> = {}
  const usedNames = new Set<string>()
  let structures = 0
  let sounds = 0

  for (const source of manifest.sources) {
    if (!keys.includes(source.key as SourceKey)) continue

    for (const structure of source.structures) {
      const bytes = await loader(structure.file)
      if (!bytes) continue
      const name = `${ns}_${structure.name}`.replace(/[^A-Za-z0-9_]/g, '_')
      if (usedNames.has(name)) continue
      usedNames.add(name)

      behavior.push({ path: `structures/${name}.mcstructure`, content: bytes })
      behavior.push({
        path: `features/${name}.json`,
        content: json({
          format_version: '1.21.10',
          'minecraft:structure_template_feature': {
            description: { identifier: `${ns}:feat_${name}` },
            structure_name: name,
            adjustment_radius: 8,
            facing_direction: 'random',
            constraints: { grounded: {} },
          },
        }),
      })
      behavior.push({
        path: `feature_rules/${name}.json`,
        content: json({
          format_version: '1.13.0',
          'minecraft:feature_rules': {
            description: {
              identifier: `${ns}:rule_${name}`,
              places_feature: `${ns}:feat_${name}`,
            },
            conditions: {
              placement_pass: 'surface_pass',
              'minecraft:biome_filter': [
                { test: 'has_biome_tag', operator: '==', value: 'monster' },
              ],
            },
            distribution: {
              iterations: 1,
              x: { distribution: 'uniform', extent: [0, 15] },
              y: 'query.heightmap(variable.worldx, variable.worldz)',
              z: { distribution: 'uniform', extent: [0, 15] },
            },
          },
        }),
      })
      structures++
    }

    for (const [event, list] of Object.entries(source.sounds)) {
      const bucket =
        soundDefs[event] ??
        (soundDefs[event] = {
          category: event === 'gunshot' ? 'player' : event === 'ambience' ? 'ambient' : 'hostile',
          sounds: [],
        })
      if (bucket.sounds.length >= MAX_SOUNDS_PER_EVENT) continue
      for (const sound of list) {
        if (bucket.sounds.length >= MAX_SOUNDS_PER_EVENT) break
        const bytes = await loader(sound.file)
        if (!bytes) continue
        resource.push({ path: sound.file, content: bytes })
        bucket.sounds.push({ name: sound.file.replace(/\.[^.]+$/, '') })
        sounds++
      }
    }
  }

  const soundEvents = Object.keys(soundDefs).filter((event) => soundDefs[event].sounds.length > 0)
  if (soundEvents.length > 0) {
    resource.push({
      path: 'sounds/sound_definitions.json',
      content: json({
        format_version: '1.14.0',
        sound_definitions: Object.fromEntries(
          soundEvents.map((event) => [`${ns}.${event}`, soundDefs[event]]),
        ),
      }),
    })
  }

  return { behavior, resource, soundEvents, structures, sounds }
}

export interface CollectedPack extends PackContents {
  assets: ImportedAssets
  donors: DonorPayload
}

export async function collectFiles(
  input: PackConfig,
  loader: AssetLoader | null = null,
  donors: DonorPayload = emptyDonors(),
): Promise<CollectedPack> {
  const cfg = normalizeConfig(input)
  const ids = makeUuids()
  const availableIds = availableItemIds(cfg)
  const mobs = enabledMobs(cfg)
  const items = itemFiles(cfg)
  const blocks = enabledBlocks(cfg)

  const customTextures = canvasAvailable()
  const textures = await generateTextures(cfg, customTextures)
  const assets = await importAssets(cfg, loader)

  const spawnRules = mobs.map((m) => spawnRuleFile(m, cfg)).filter((f): f is GeneratedFile => f !== null)
  const lootTables = mobs
    .map((m) => lootTableFile(m, cfg, availableIds))
    .filter((f): f is GeneratedFile => f !== null)
  const tradeFiles = mobs.filter((m) => m.trader).map((m) => tradeTableFile(m, cfg, availableIds))

  const weaponSpecs = weaponItemSpecs(cfg, customTextures)
  const armorSpecs = armorItemSpecs(cfg, customTextures)

  const behavior: GeneratedFile[] = [
    { path: 'manifest.json', content: behaviorManifest(cfg, ids) },
    scriptFile(cfg, availableIds, assets.soundEvents),
    ...mobs.map((m) => behaviorEntityFile(m, cfg)),
    ...spawnRules,
    ...lootTables,
    ...tradeFiles,
    ...items.files,
    ...weaponItemFiles(cfg),
    ...armorItemFiles(cfg),
    ...blockFiles(cfg),
    ...itemRecipeFiles(cfg),
    ...weaponRecipeFiles(cfg),
    ...armorRecipeFiles(cfg),
    ...blockRecipeFiles(cfg),
    ...assets.behavior,
    ...donors.behavior,
  ]

  const langLines: string[] = []
  for (const mob of mobs) langLines.push(`entity.${cfg.namespace}:${mob.id}=${mob.name}`)
  for (const spec of items.specs) langLines.push(`item.${cfg.namespace}:${spec.id}=${spec.displayName}`)
  for (const spec of weaponSpecs) langLines.push(`item.${cfg.namespace}:${spec.id}=${spec.displayName}`)
  for (const spec of armorSpecs) langLines.push(`item.${cfg.namespace}:${spec.id}=${spec.displayName}`)
  for (const block of blocks) {
    langLines.push(`tile.${cfg.namespace}:${block.id}.name=${block.name}`)
    langLines.push(`item.${cfg.namespace}:${block.id}=${block.name}`)
  }
  // Donor items reference donor translation keys, so their names are merged in
  // as plain `item.<identifier>` lines regardless of the donor's key layout.
  for (const [key, value] of Object.entries(donors.lang)) langLines.push(`${key}=${value}`)
  const lang = `${langLines.join('\n')}\n`

  const textureData: Record<string, { textures: string }> = {}
  for (const spec of items.specs) {
    textureData[iconKey(cfg.namespace, spec.id)] = {
      textures: customTextures ? iconPath(cfg.namespace, spec.id) : 'textures/items/iron_ingot',
    }
  }
  for (const spec of weaponSpecs) textureData[spec.textureKey] = { textures: spec.texturePath }
  for (const spec of armorSpecs) textureData[spec.textureKey] = { textures: spec.texturePath }
  // Donor keys are source-prefixed by the harvester, so they cannot clash with
  // ours; ours still win if a name ever does collide.
  for (const [key, value] of Object.entries(donors.itemTextureEntries)) {
    if (!(key in textureData)) textureData[key] = { textures: value }
  }

  const resource: GeneratedFile[] = [
    { path: 'manifest.json', content: resourceManifest(cfg, ids) },
    ...mobs.map((m) => clientEntityFile(m, cfg)),
    ...weaponGeometryFiles(cfg),
    ...weaponAttachableFiles(cfg, customTextures),
    ...armorAttachableFiles(cfg),
    ...blockGeometryFiles(cfg),
    {
      path: 'textures/item_texture.json',
      content: json({
        resource_pack_name: cfg.packName,
        texture_name: 'atlas.items',
        texture_data: textureData,
      }),
    },
    {
      path: 'textures/terrain_texture.json',
      content: json({
        resource_pack_name: cfg.packName,
        texture_name: 'atlas.terrain',
        texture_data: terrainTextureData(cfg),
      }),
    },
    ...fogFiles(cfg),
    biomeFogFile(cfg),
    { path: 'texts/en_US.lang', content: lang },
    { path: 'texts/fr_FR.lang', content: lang },
    ...(textures.ok ? textures.files : []),
    ...assets.resource,
    ...donors.resource,
  ]

  return { behavior, resource, assets, donors }
}

function readme(
  cfg: PackConfig,
  fileCount: number,
  assets: ImportedAssets,
  donors: DonorPayload,
): string {
  const variants = enabledVariants(cfg)
  const weapons = activeWeapons(cfg)
  const firearms = hasFirearms(cfg) ? weapons.filter((w) => w.kind === 'firearm') : []
  const melee = weapons.filter((w) => w.kind === 'melee')
  const blocks = enabledBlocks(cfg)
  const mobs = enabledMobs(cfg)

  return [
    `${cfg.packName}`,
    'Pack modpack complet — apocalypse zombie — Minecraft Bedrock Edition',
    `Auteur : ${cfg.author}`,
    `Généré par REMNANT · ${fileCount} fichiers`,
    '',
    'INSTALLATION',
    '1. Double-clique le fichier .mcaddon (ou ouvre-le avec Minecraft).',
    '2. Dans le monde : Paramètres > Packs de comportement ET Packs de ressources.',
    '3. Active les DEUX packs (ils sont liés).',
    '4. Active « Bêta / Scripts » si ta version le demande (Paramètres du monde > Général).',
    '5. Difficulté : Facile minimum (les zombies n apparaissent pas en Paisible).',
    '',
    'CONTENU',
    `- ${variants.length} variantes de zombies (spawn rules et butin inclus).`,
    `- ${mobs.length} créatures au total (zombies, faune infectée, bandits, PNJ, boss).`,
    melee.length > 0
      ? `- Corps à corps : ${melee.map((w) => w.name).join(', ')}.`
      : '- Aucune arme de corps à corps activée.',
    firearms.length > 0
      ? `- Armes à feu 3D : ${firearms.map((w) => w.name).join(', ')} (+ ${activeAmmo(cfg).length} munitions).`
      : '- Aucune arme à feu activée.',
    `- Armures : ${ARMOR_SET_COUNT} sets complets (4 pièces chacun : casque, plastron, jambières, bottes), de l'armure de fortune à l'exosquelette — visibles sur le corps, avec leurs propres textures.`,
    '- Protection réaliste par palier : fortune 1, cuir 2, Hazmat 2, pompier 3, mailles 3, kevlar 4, anti-émeute 5, NBC 6, porte-plaques 6, SWAT 7, EOD 8, céramique 9, exosquelette 10, composite 10.',
    '- Tenues scellées (Hazmat et NBC) : porter une pièce bloque l infection scriptée.',
    `- Blocs bâtissables : ${blocks.length} (barricades, barbelés, sacs de sable, béton, pieux, mine, caisses, poste médical, générateur, tourelle, balise).`,
    '- Structures à piller : maison en ruine, checkpoint militaire, hôpital, station-service, camp de survivants, ruines urbaines.',
    assets.structures > 0 || assets.sounds > 0
      ? `- Importé des packs déposés dans le dépôt : ${assets.structures} structures .mcstructure et ${assets.sounds} sons (${assets.soundEvents.join(', ') || 'aucun événement sonore'}).`
      : '- Aucun pack source importé pour cette génération.',
    '- Systèmes : infection, hémorragie, soif, énergie, médical complet, nuits de horde, lune rouge, largages, boss, tourelles, pièges.',
    '- Ambiance : brumes (lune rouge, nuit de horde, état critique) et brume de cendres permanente sur tous les biomes.',
    donors.items.length > 0
      ? `- Fusion des addons donneurs : ${donors.items.length} pièces d'armure supplémentaires ` +
        `(${donors.sources.map((s) => `${s.label} ${s.items}`).join(', ')}) avec leurs icônes, ` +
        'leurs modèles portés et leurs recettes quand elles sont réalisables avec le contenu du pack.'
      : '- Aucun donneur fusionné : lance `bun run pack:harvest` avant `bun run pack:build`.',
    '',
    'PREREQUIS',
    '- Bedrock 1.21.60 ou plus recent. Le pack demande ce minimum : sur une version',
    '  inferieure il est refuse en bloc et rien ne s affiche (ni textures, ni mobs).',
    '- AUCUN experiment a activer. Le module de script declare est une version stable.',
    '',
    'SI CA NE S AFFICHE PAS',
    '1. Parametres du monde > Packs de ressources ET Packs de comportement : active les DEUX',
    '   et verifie qu ils ne sont pas ecrases par un autre pack.',
    '2. Active "Jouer avec les brouillards" : la brume de cendres passe par biomes_client.json,',
    '   elle ne demande aucun cheat. Les brumes d ambiance (lune rouge...) passent par le',
    '   script et demandent les CHEATS actifs sur le monde, sinon elles sont ignorees.',
    '3. Ouvre le journal de contenu (Parametres > Createur) et cherche :',
    '   - "requesting invalid module version" -> version du jeu trop ancienne pour le script ;',
    '   - "Failed to load" / "json parse" -> un fichier du pack a un souci, signale-le.',
    '4. Les icones d items passent par textures/item_texture.json. Si tu utilises un pack de',
    '   ressources tiers qui redefinit ce fichier et le charge APRES celui-ci, il efface nos',
    '   icones : remonte REMNANT dans la liste de priorite des packs.',
    '',
    'LES MODELES 3D',
    'Les armes et les armures utilisent le système « attachable » : le modèle 3D apparaît',
    'quand tu tiens l objet ou le portes. Si une pièce semble mal placée, ajuste les valeurs',
    '« pivot » / « origin » dans le fichier attachables/<nom>.json du pack de ressources.',
    '',
    'CREDITS',
    'Les mécaniques sont réimplémentées d après les addons suivants (détail et licences dans',
    'ANALYSE-PACKS.md, à la racine du générateur) :',
    'DeadZone (N_z), True Survival [MobBlocks] (Four Worlds Studios), Zombie Apocalypse MCPE',
    '(FleetMCStudio), Project Walker (GabrielAplok), No Man s Land (Hazelntz), Aplok Guns,',
    'CORDYCEPS (Xaier G), Marvel Zombies (mrnidos), Raboy s Zombie Apocalypse (Raboy13),',
    'One Hundred Days Later (Spartan Studios), Day Zov Core, Rotten Lands (ArborStudios),',
    'Undeadcraft (Axelpvz), Rise and Survive, RR Last Breath.',
    donors.items.length > 0
      ? 'Les pièces d armure des donneurs sont incluses dans ce pack (fusion demandée pour un usage personnel / roleplay).'
      : 'Aucun fichier de ces packs n est redistribué ici : tout est original.',
    'Les mécaniques d armure et de barres de survie (santé, énergie, soif, hémorragie, infection) sont réécrites par REMNANT.',
    '',
  ].join('\n')
}

export async function collectAllFiles(
  input: PackConfig,
  loader: AssetLoader | null = null,
  donors: DonorPayload = emptyDonors(),
): Promise<{ cfg: PackConfig; contents: CollectedPack; readme: string; fileCount: number }> {
  const cfg = normalizeConfig(input)
  const contents = await collectFiles(cfg, loader, donors)
  const fileCount = contents.behavior.length + contents.resource.length + 1
  return { cfg, contents, readme: readme(cfg, fileCount, contents.assets, contents.donors), fileCount }
}

export async function buildMcAddon(
  input: PackConfig,
  loader: AssetLoader | null = null,
  donors: DonorPayload = emptyDonors(),
): Promise<BuildResult> {
  const { cfg, contents, readme: readmeText } = await collectAllFiles(input, loader, donors)
  const folder = folderName(cfg)
  const zip = new JSZip()

  for (const file of contents.behavior) zip.file(`${folder}_BP/${file.path}`, file.content)
  for (const file of contents.resource) zip.file(`${folder}_RP/${file.path}`, file.content)
  zip.file('LISEZ-MOI.txt', readmeText)

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

  return {
    blob,
    fileName: `${folder}.mcaddon`,
    fileCount: contents.behavior.length + contents.resource.length + 1,
    byteSize: blob.size,
  }
}

export interface SummaryGroup {
  label: string
  count: number
}

export interface PackSummary {
  bp: SummaryGroup[]
  rp: SummaryGroup[]
  bpTotal: number
  rpTotal: number
  total: number
  variants: number
  mobs: number
  weapons: number
  ammo: number
  items: number
  armor: number
  blocks: number
  hasFirearms: boolean
}

/** Instant (synchronous) file listing used for the Forge preview. */
export function packSummary(input: PackConfig): PackSummary {
  const cfg = normalizeConfig(input)
  const variants = enabledVariants(cfg)
  const mobs = enabledMobs(cfg)
  const items = itemFiles(cfg)
  const weapons = activeWeapons(cfg)
  const ammo = activeAmmo(cfg)
  const armor = armorItemSpecs(cfg, false)
  const blocks = enabledBlocks(cfg)

  const spawnRules = mobs.filter((m) => spawnRuleFile(m, cfg) !== null).length
  const lootTables = mobs.filter((m) => m.loot !== 'none').length
  const recipes =
    itemRecipeFiles(cfg).length +
    weaponRecipeFiles(cfg).length +
    armorRecipeFiles(cfg).length +
    blockRecipeFiles(cfg).length

  const bp: SummaryGroup[] = [
    { label: 'manifest.json', count: 1 },
    { label: 'scripts/main.js', count: 1 },
    { label: 'entities/', count: mobs.length },
    { label: 'spawn_rules/', count: spawnRules },
    { label: 'loot_tables/', count: lootTables },
    { label: 'items/', count: items.specs.length + weapons.length + ammo.length + armor.length },
    { label: 'blocks/', count: blocks.length },
    { label: 'recipes/', count: recipes },
    { label: 'trading/', count: mobs.filter((m) => m.trader).length },
  ]

  const textureCount = canvasAvailable()
    ? new Set(weapons.map((w) => w.texKind)).size +
      weapons.length +
      ammo.length +
      items.specs.length +
      armor.length +
      armorTextureJobs(cfg).length +
      blocks.length
    : 0

  const rp: SummaryGroup[] = [
    { label: 'manifest.json', count: 1 },
    { label: 'entity/ (client)', count: mobs.length },
    { label: 'models/entity/ (armes 3D)', count: weapons.length },
    { label: 'models/blocks/ (blocs)', count: blocks.length },
    { label: 'attachables/ (armes + armures)', count: weapons.length + armor.length },
    { label: 'models/armor → textures/models/armor/', count: armorTextureJobs(cfg).length },
    { label: 'textures/item_texture.json', count: 1 },
    { label: 'textures/terrain_texture.json', count: 1 },
    { label: 'textures/*.png', count: textureCount },
    { label: 'texts/*.lang', count: 2 },
  ]

  const bpTotal = bp.reduce((sum, g) => sum + g.count, 0)
  const rpTotal = rp.reduce((sum, g) => sum + g.count, 0)

  return {
    bp,
    rp,
    bpTotal,
    rpTotal,
    total: bpTotal + rpTotal + 1,
    variants: variants.length,
    mobs: mobs.length,
    weapons: weapons.length,
    ammo: ammo.length,
    items: items.specs.length,
    armor: armor.length,
    blocks: blocks.length,
    hasFirearms: hasFirearms(cfg),
  }
}

