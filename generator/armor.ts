import { json } from './minecraft'
import { armorLayerPath, iconKey, iconPath, type ArmorSheetSpec, type IconSpec } from './textures'
import { shapedRecipe } from './recipes'
import type { GeneratedFile, PackConfig } from './types'
import type { ItemIconSpec } from './weapons'

/**
 * Armor roster.
 *
 * The progression is modelled on real protective equipment rather than on
 * vanilla tiers: improvised sheet metal up to a sealed composite exoskeleton.
 * `protection` is Bedrock's per-piece absorption value and climbs the same
 * ladder the donor packs use (1 for clothing up to 10 for the heaviest kit),
 * `durability` follows the material — leather wears out fast, composite barely
 * scratches.
 */
export interface ArmorSetDef {
  key: string
  name: string
  role: string
  blurb: string
  /** 1 = jour 1, 5 = fin de partie. Drives the crafting recipe gate. */
  tier: 1 | 2 | 3 | 4 | 5
  protection: number
  durability: number
  accent: string
  /** Wearing any piece of the set blocks scripted infection. */
  hazmat?: boolean
  material: { item: string; label: string }
  /** Custom generated 64x32 worn-armor sheet. */
  sheet: ArmorSheetSpec
}

const HAZMAT_TRIM = '#facc15'
const NBC_TRIM = '#e2e8f0'

export const ARMOR_SETS: ArmorSetDef[] = [
  {
    key: 'scrap',
    name: 'Armure de fortune',
    role: 'Jour 1',
    blurb: 'Tôles de carrosserie, câbles et sangles cousues sur un blouson. Moche, lourde, mais ça arrête une morsure.',
    tier: 1,
    protection: 1,
    durability: 120,
    accent: '#6b6257',
    material: { item: 'minecraft:iron_nugget', label: 'pépites de fer' },
    sheet: { base: '#6f6152', accent: '#8a6337', trim: '#3b342c', pattern: 'leather' },
  },
  {
    key: 'leather',
    name: 'Veste de cuir renforcée',
    role: 'Civil',
    blurb: 'Cuir épais doublé aux épaules et aux genoux. Ce que portent ceux qui n’ont rien trouvé de mieux.',
    tier: 1,
    protection: 2,
    durability: 150,
    accent: '#7c3f16',
    material: { item: 'minecraft:leather', label: 'cuir' },
    sheet: { base: '#5b3a1c', accent: '#8a5a2b', trim: '#2b1f12', pattern: 'leather' },
  },
  {
    key: 'hazmat',
    name: 'Combinaison Hazmat',
    role: 'Anti-infection',
    blurb: 'Étanche et scellée : tant que tu la portes, une morsure ne t’infecte pas. Elle ne protège presque pas des coups.',
    tier: 2,
    protection: 2,
    durability: 190,
    accent: '#eab308',
    hazmat: true,
    material: { item: 'minecraft:leather', label: 'cuir' },
    sheet: { base: '#d9d24a', accent: '#3f3a12', trim: HAZMAT_TRIM, pattern: 'hazmat' },
  },
  {
    key: 'firefighter',
    name: 'Tenue de pompier',
    role: 'Secours',
    blurb: 'Cuir aluminisé et cagoule. Elle ne craint pas grand-chose des flammes et encaisse bien les coups de barre.',
    tier: 2,
    protection: 3,
    durability: 240,
    accent: '#b91c1c',
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#3a3126', accent: '#c2410c', trim: '#d6d3d1', pattern: 'plates' },
  },
  {
    key: 'chainmail',
    name: 'Cotte de mailles',
    role: 'Lourde',
    blurb: 'Ancienne, récupérée dans un musée ou une quincaillerie. Coupe les lames et les dents, mais pèse une tonne.',
    tier: 2,
    protection: 3,
    durability: 210,
    accent: '#8a9099',
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#75797f', accent: '#a3a8ae', trim: '#3f444a', pattern: 'scales' },
  },
  {
    key: 'kevlar',
    name: 'Gilet pare-balles dissimulé',
    role: 'Police',
    blurb: 'Niveau II sous une chemise. Personne ne le voit, il travaille quand même.',
    tier: 2,
    protection: 4,
    durability: 250,
    accent: '#1e293b',
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#2b3038', accent: '#4b5563', trim: '#171a1f', pattern: 'kevlar' },
  },
  {
    key: 'riot',
    name: 'Tenue anti-émeute',
    role: 'Polyvalente',
    blurb: 'Le premier vrai set. Plastrons, épaulières et protège-tibias : tu encaisses la mêlée sans t’alourdir.',
    tier: 3,
    protection: 5,
    durability: 300,
    accent: '#3b82f6',
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#2f3640', accent: '#3b82f6', trim: '#111827', pattern: 'riot' },
  },
  {
    key: 'nbc',
    name: 'Combinaison NBC lourde',
    role: 'Anti-infection renforcée',
    blurb: 'La version militaire de la Hazmat : mêmes filtres, plus des plaques souples. Le meilleur compromis anti- infection.',
    tier: 3,
    protection: 6,
    durability: 330,
    accent: '#0f766e',
    hazmat: true,
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#c8ccd2', accent: '#0f766e', trim: NBC_TRIM, pattern: 'hazmat' },
  },
  {
    key: 'carrier',
    name: 'Porte-plaques niveau III',
    role: 'Tactique',
    blurb: 'Le standard militaire : porter un gilet et y glisser les plaques. Le meilleur ratio protection/poids du lot.',
    tier: 3,
    protection: 6,
    durability: 360,
    accent: '#4b5320',
    material: { item: 'minecraft:iron_ingot', label: 'lingots de fer' },
    sheet: { base: '#4b5320', accent: '#7c8a4a', trim: '#2a2f12', pattern: 'camo' },
  },
  {
    key: 'swat',
    name: 'Assaut SWAT',
    role: 'Intervention',
    blurb: 'Niveau III+ avec casque balistique et visière. On respire mal, on survit longtemps.',
    tier: 4,
    protection: 7,
    durability: 400,
    accent: '#0f172a',
    material: { item: 'minecraft:diamond', label: 'diamants' },
    sheet: { base: '#1c2026', accent: '#334155', trim: '#0b0e12', pattern: 'kevlar' },
  },
  {
    key: 'eod',
    name: 'Tenue de déminage EOD',
    role: 'Explosions',
    blurb: 'Conçue pour encaisser une mine terrestre à bout portant. La seule qui te laisse survivre à ton propre piège.',
    tier: 4,
    protection: 8,
    durability: 460,
    accent: '#166534',
    material: { item: 'minecraft:diamond', label: 'diamants' },
    sheet: { base: '#3f5326', accent: '#166534', trim: '#1a1f14', pattern: 'heavy' },
  },
  {
    key: 'ceramic',
    name: 'Plaques céramique lourdes',
    role: 'Militaire',
    blurb: 'Niveau IV. La céramique encaisse la balle à ta place et part en miettes — tu rafistoles après chaque fusillade.',
    tier: 4,
    protection: 9,
    durability: 520,
    accent: '#b8a274',
    material: { item: 'minecraft:diamond', label: 'diamants' },
    sheet: { base: '#8d99ae', accent: '#b8a274', trim: '#3d4653', pattern: 'plates' },
  },
  {
    key: 'juggernaut',
    name: 'Exosquelette d’assaut',
    role: 'Endgame',
    blurb: 'Harnais à assistance mécanique. Tu marches plus lentement, mais la horde se casse les dents dessus.',
    tier: 5,
    protection: 10,
    durability: 600,
    accent: '#7f1d1d',
    material: { item: 'minecraft:netherite_ingot', label: 'lingots de netherite' },
    sheet: { base: '#3f3a36', accent: '#7f1d1d', trim: '#8a9099', pattern: 'heavy' },
  },
  {
    key: 'composite',
    name: 'Armure composite expérimentale',
    role: 'Fin de partie',
    blurb: 'Le dernier palier : fibres composites et plaques frittées, assemblées à l’établi d’un labo abandonné.',
    tier: 5,
    protection: 10,
    durability: 700,
    accent: '#6d28d9',
    material: { item: 'minecraft:netherite_ingot', label: 'lingots de netherite' },
    sheet: { base: '#413c52', accent: '#6d28d9', trim: '#c8ccd2', pattern: 'plates' },
  },
]

interface SlotDef {
  suffix: string
  label: string
  slot: string
  /** Enchanting table slot, so each piece accepts the right armor enchants. */
  enchantSlot: 'armor_head' | 'armor_torso' | 'armor_legs' | 'armor_feet'
  group: string
  geometry: string
  layer: 'l1' | 'l2'
  pattern: string[]
  icon: IconSpec
}

const SLOTS: SlotDef[] = [
  {
    suffix: 'helmet',
    label: 'Casque',
    slot: 'slot.armor.head',
    enchantSlot: 'armor_head',
    group: 'itemGroup.name.helmet',
    geometry: 'geometry.humanoid.armor.helmet',
    layer: 'l1',
    pattern: ['XXX', 'X X'],
    icon: { shape: 'armorHead', primary: '#7d858e', secondary: '#b9c0c8', accent: '#3f444a' },
  },
  {
    suffix: 'chestplate',
    label: 'Plastron',
    slot: 'slot.armor.chest',
    enchantSlot: 'armor_torso',
    group: 'itemGroup.name.chestplate',
    geometry: 'geometry.humanoid.armor.chestplate',
    layer: 'l1',
    pattern: ['X X', 'XXX', 'XXX'],
    icon: { shape: 'armorChest', primary: '#7d858e', secondary: '#b9c0c8', accent: '#3f444a' },
  },
  {
    suffix: 'leggings',
    label: 'Jambières',
    slot: 'slot.armor.legs',
    enchantSlot: 'armor_legs',
    group: 'itemGroup.name.leggings',
    geometry: 'geometry.humanoid.armor.leggings',
    layer: 'l2',
    pattern: ['XXX', 'X X', 'X X'],
    icon: { shape: 'armorLegs', primary: '#7d858e', secondary: '#b9c0c8', accent: '#3f444a' },
  },
  {
    suffix: 'boots',
    label: 'Bottes',
    slot: 'slot.armor.feet',
    enchantSlot: 'armor_feet',
    group: 'itemGroup.name.boots',
    geometry: 'geometry.humanoid.armor.boots',
    layer: 'l1',
    pattern: ['X X', 'X X'],
    icon: { shape: 'armorBoots', primary: '#7d858e', secondary: '#b9c0c8', accent: '#3f444a' },
  },
]

export function armorEnabled(cfg: PackConfig): boolean {
  return cfg.mechanics.armor
}

function tintIcon(icon: IconSpec, set: ArmorSetDef): IconSpec {
  return { ...icon, primary: set.sheet.base, secondary: set.accent, accent: set.sheet.trim }
}

export interface ArmorPiece {
  id: string
  displayName: string
  set: ArmorSetDef
  slot: SlotDef
}

export function armorPieces(cfg: PackConfig): ArmorPiece[] {
  if (!armorEnabled(cfg)) return []
  const out: ArmorPiece[] = []
  for (const set of ARMOR_SETS) {
    for (const slot of SLOTS) {
      out.push({
        id: `${set.key}_${slot.suffix}`,
        displayName: `${slot.label} — ${set.name}`,
        set,
        slot,
      })
    }
  }
  return out
}

/** Every generated worn-armor sheet the resource pack needs. */
export function armorTextureJobs(cfg: PackConfig): { path: string; spec: ArmorSheetSpec; layer: 'l1' | 'l2' }[] {
  if (!armorEnabled(cfg)) return []
  const jobs: { path: string; spec: ArmorSheetSpec; layer: 'l1' | 'l2' }[] = []
  for (const set of ARMOR_SETS) {
    for (const layer of ['l1', 'l2'] as const) {
      jobs.push({ path: `${armorLayerPath(cfg.namespace, set.key, layer)}.png`, spec: set.sheet, layer })
    }
  }
  return jobs
}

export function armorAttachableFiles(cfg: PackConfig): GeneratedFile[] {
  return armorPieces(cfg).map((piece) => ({
    path: `attachables/${piece.id}.json`,
    content: json({
      format_version: '1.20.60',
      'minecraft:attachable': {
        description: {
          identifier: `${cfg.namespace}:${piece.id}`,
          materials: {
            default: 'armor',
            enchanted: 'armor_glint',
          },
          textures: {
            default: armorLayerPath(cfg.namespace, piece.set.key, piece.slot.layer),
            enchanted: 'textures/misc/enchanted_item_glint',
          },
          geometry: { default: piece.slot.geometry },
          render_controllers: ['controller.render.armor'],
        },
      },
    }),
  }))
}

export function armorItemFiles(cfg: PackConfig): GeneratedFile[] {
  return armorPieces(cfg).map((piece) => ({
    path: `items/${piece.id}.json`,
    content: json({
      format_version: '1.21.0',
      'minecraft:item': {
        description: {
          identifier: `${cfg.namespace}:${piece.id}`,
          menu_category: { category: 'equipment', group: piece.slot.group },
        },
        components: {
          'minecraft:max_stack_size': 1,
          'minecraft:icon': { textures: { default: iconKey(cfg.namespace, piece.id) } },
          'minecraft:wearable': {
            protection: piece.set.protection,
            slot: piece.slot.slot,
          },
          'minecraft:durability': { max_durability: piece.set.durability },
          'minecraft:repairable': {
            repair_items: [{ items: [piece.set.material.item], repair_amount: 100 }],
          },
          'minecraft:enchantable': { value: 10, slot: piece.slot.enchantSlot },
          'minecraft:tags': { tags: ['minecraft:is_armor'] },
        },
      },
    }),
  }))
}

export function armorRecipeFiles(cfg: PackConfig): GeneratedFile[] {
  return armorPieces(cfg).map((piece) =>
    shapedRecipe(
      piece.id,
      cfg.namespace,
      piece.slot.pattern,
      { X: { item: piece.set.material.item } },
      { item: `${cfg.namespace}:${piece.id}`, count: 1 },
    ),
  )
}

export function armorItemSpecs(cfg: PackConfig, customTextures: boolean): ItemIconSpec[] {
  return armorPieces(cfg).map((piece) => ({
    id: piece.id,
    displayName: piece.displayName,
    textureKey: iconKey(cfg.namespace, piece.id),
    texturePath: customTextures ? iconPath(cfg.namespace, piece.id) : 'textures/items/iron_ingot',
    icon: tintIcon(piece.slot.icon, piece.set),
  }))
}

export function armorScriptPayload(cfg: PackConfig) {
  const hazmat = armorPieces(cfg)
    .filter((p) => p.set.hazmat)
    .map((p) => `${cfg.namespace}:${p.id}`)
  return { armor: armorEnabled(cfg), hazmat, armorPieces: armorPieces(cfg).length }
}
