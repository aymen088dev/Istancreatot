import { json } from './minecraft'
import { shapedRecipe, shapelessRecipe } from './recipes'
import { blockTexKey, blockTexPath, type BlockTexKind } from './textures'
import type { MechanicKey, GeneratedFile, PackConfig } from './types'

type RecipeDef =
  | { type: 'shaped'; pattern: string[]; key: Record<string, { item: string }>; count: number }
  | { type: 'shapeless'; ingredients: { item: string }[]; count: number }

export interface BlockDef {
  id: string
  name: string
  gate: MechanicKey
  tex: BlockTexKind
  /** Script keyword triggered when the player interacts with the block. */
  use?: string
  /** Script keyword: contact damage while standing on the block. */
  hazard?: boolean
  category: 'construction' | 'equipment' | 'nature'
  secondsToDestroy: number
  mapColor: string
  light?: number
  recipe?: RecipeDef
}

export const BLOCKS: BlockDef[] = [
  {
    id: 'barricade_wood',
    name: 'Barricade en bois',
    gate: 'baseBuilding',
    tex: 'planks',
    category: 'construction',
    secondsToDestroy: 1.6,
    mapColor: '#8A6337',
    recipe: {
      type: 'shaped',
      pattern: ['PPP', 'P P'],
      key: { P: { item: 'minecraft:oak_planks' } },
      count: 4,
    },
  },
  {
    id: 'barbed_wire',
    name: 'Barbelés',
    gate: 'baseBuilding',
    tex: 'wire',
    hazard: true,
    category: 'construction',
    secondsToDestroy: 1.2,
    mapColor: '#6B6B6B',
    recipe: {
      type: 'shapeless',
      ingredients: [
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:string' },
      ],
      count: 2,
    },
  },
  {
    id: 'sandbags',
    name: 'Sacs de sable',
    gate: 'baseBuilding',
    tex: 'sandbag',
    category: 'construction',
    secondsToDestroy: 2,
    mapColor: '#B8A274',
    recipe: {
      type: 'shaped',
      pattern: ['SS', 'SS'],
      key: { S: { item: 'minecraft:sand' } },
      count: 4,
    },
  },
  {
    id: 'concrete_wall',
    name: 'Mur de béton',
    gate: 'baseBuilding',
    tex: 'concrete',
    category: 'construction',
    secondsToDestroy: 5,
    mapColor: '#9A9A94',
    recipe: {
      type: 'shaped',
      pattern: ['CCC', 'CGC', 'CCC'],
      key: { C: { item: 'minecraft:stone' }, G: { item: 'minecraft:gravel' } },
      count: 4,
    },
  },
  {
    id: 'boarded_planks',
    name: 'Planches clouées',
    gate: 'baseBuilding',
    tex: 'board',
    category: 'construction',
    secondsToDestroy: 1.4,
    mapColor: '#7D5A33',
    recipe: {
      type: 'shapeless',
      ingredients: [
        { item: 'minecraft:oak_planks' },
        { item: 'minecraft:iron_nugget' },
      ],
      count: 3,
    },
  },
  {
    id: 'spike_trap',
    name: 'Pieux à zombies',
    gate: 'traps',
    tex: 'spike',
    hazard: true,
    category: 'construction',
    secondsToDestroy: 1.8,
    mapColor: '#4A3A28',
    recipe: {
      type: 'shaped',
      pattern: ['S S', 'SSS'],
      key: { S: { item: 'minecraft:stick' } },
      count: 2,
    },
  },
  {
    id: 'landmine',
    name: 'Mine terrestre',
    gate: 'traps',
    tex: 'mine',
    use: 'mine',
    category: 'equipment',
    secondsToDestroy: 0.6,
    mapColor: '#4F5340',
    recipe: {
      type: 'shapeless',
      ingredients: [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:stone_pressure_plate' },
      ],
      count: 1,
    },
  },
  {
    id: 'supply_crate',
    name: 'Caisse de ravitaillement',
    gate: 'airdrops',
    tex: 'crate',
    use: 'crate',
    category: 'equipment',
    secondsToDestroy: 1.2,
    mapColor: '#9C7A45',
  },
  {
    id: 'ammo_crate',
    name: 'Caisse de munitions',
    gate: 'firearms',
    tex: 'ammo',
    use: 'ammo_crate',
    category: 'equipment',
    secondsToDestroy: 1.4,
    mapColor: '#5D5136',
    recipe: {
      type: 'shaped',
      pattern: ['III', 'IGI', 'III'],
      key: { I: { item: 'minecraft:iron_ingot' }, G: { item: 'minecraft:gunpowder' } },
      count: 1,
    },
  },
  {
    id: 'medical_station',
    name: 'Poste médical',
    gate: 'medkits',
    tex: 'medical',
    use: 'med_station',
    category: 'equipment',
    secondsToDestroy: 2,
    mapColor: '#E8E8E8',
    light: 4,
    recipe: {
      type: 'shaped',
      pattern: ['WWW', 'BRB', 'WWW'],
      key: {
        W: { item: 'minecraft:white_wool' },
        B: { item: 'minecraft:glass_bottle' },
        R: { item: 'minecraft:redstone' },
      },
      count: 1,
    },
  },
  {
    id: 'generator',
    name: 'Générateur',
    gate: 'turrets',
    tex: 'generator',
    use: 'generator',
    category: 'equipment',
    secondsToDestroy: 3,
    mapColor: '#5A5F52',
    light: 6,
    recipe: {
      type: 'shaped',
      pattern: ['III', 'RCR', 'III'],
      key: {
        I: { item: 'minecraft:iron_ingot' },
        R: { item: 'minecraft:redstone' },
        C: { item: 'minecraft:coal_block' },
      },
      count: 1,
    },
  },
  {
    id: 'turret',
    name: 'Tourelle automatique',
    gate: 'turrets',
    tex: 'turret',
    use: 'turret',
    category: 'equipment',
    secondsToDestroy: 3.5,
    mapColor: '#6D6F63',
    light: 5,
    recipe: {
      type: 'shaped',
      pattern: ['IRI', 'ICI', 'III'],
      key: {
        I: { item: 'minecraft:iron_ingot' },
        R: { item: 'minecraft:redstone' },
        C: { item: 'minecraft:copper_ingot' },
      },
      count: 1,
    },
  },
  {
    id: 'safe_beacon_block',
    name: 'Balise de zone sûre',
    gate: 'turrets',
    tex: 'beacon',
    use: 'beacon_block',
    category: 'construction',
    secondsToDestroy: 2.5,
    mapColor: '#3D4A52',
    light: 12,
    recipe: {
      type: 'shaped',
      pattern: ['GEG', 'EDE', 'GEG'],
      key: {
        G: { item: 'minecraft:glowstone' },
        E: { item: 'minecraft:emerald' },
        D: { item: 'minecraft:diamond' },
      },
      count: 1,
    },
  },
]

export function enabledBlocks(cfg: PackConfig): BlockDef[] {
  return BLOCKS.filter((b) => cfg.mechanics[b.gate])
}

function blockModelPath(cfg: PackConfig, def: BlockDef): string {
  return `geometry.${cfg.namespace}.${def.id}`
}

export function blockFiles(cfg: PackConfig): GeneratedFile[] {
  return enabledBlocks(cfg).map((def) => ({
    path: `blocks/${def.id}.json`,
    content: json({
      format_version: '1.21.60',
      'minecraft:block': {
        description: {
          identifier: `${cfg.namespace}:${def.id}`,
          menu_category: { category: def.category },
        },
        components: {
          'minecraft:geometry': blockModelPath(cfg, def),
          'minecraft:material_instances': {
            '*': {
              texture: blockTexKey(cfg.namespace, def.id),
              render_method: 'opaque',
            },
          },
          'minecraft:collision_box': { origin: [-8, 0, -8], size: [16, 16, 16] },
          'minecraft:selection_box': { origin: [-8, 0, -8], size: [16, 16, 16] },
          'minecraft:destructible_by_mining': { seconds_to_destroy: def.secondsToDestroy },
          'minecraft:map_color': def.mapColor,
          ...(def.light ? { 'minecraft:light_emission': def.light } : {}),
        },
      },
    }),
  }))
}

export function blockGeometryFiles(cfg: PackConfig): GeneratedFile[] {
  return enabledBlocks(cfg).map((def) => ({
    path: `models/blocks/${def.id}.geo.json`,
    content: json({
      format_version: '1.16.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: blockModelPath(cfg, def),
            texture_width: 16,
            texture_height: 16,
            visible_bounds_width: 2,
            visible_bounds_height: 2,
            visible_bounds_offset: [0, 0.5, 0],
          },
          bones: [
            {
              name: def.id,
              pivot: [0, 0, 0],
              cubes: [{ origin: [-8, 0, -8], size: [16, 16, 16], uv: [0, 0] }],
            },
          ],
        },
      ],
    }),
  }))
}

export function terrainTextureData(cfg: PackConfig): Record<string, { textures: string }> {
  const data: Record<string, { textures: string }> = {}
  for (const def of enabledBlocks(cfg)) {
    data[blockTexKey(cfg.namespace, def.id)] = { textures: blockTexPath(cfg.namespace, def.id) }
  }
  return data
}

export function blockRecipeFiles(cfg: PackConfig): GeneratedFile[] {
  const ns = cfg.namespace
  const files: GeneratedFile[] = []
  for (const def of enabledBlocks(cfg)) {
    const recipe = def.recipe
    if (!recipe) continue
    if (recipe.type === 'shaped') {
      files.push(
        shapedRecipe(def.id, ns, recipe.pattern, recipe.key, {
          item: `${ns}:${def.id}`,
          count: recipe.count,
        }),
      )
    } else {
      files.push(
        shapelessRecipe(def.id, ns, recipe.ingredients, {
          item: `${ns}:${def.id}`,
          count: recipe.count,
        }),
      )
    }
  }
  return files
}

export function blockTextureJobs(cfg: PackConfig): { path: string; kind: BlockTexKind }[] {
  return enabledBlocks(cfg).map((def) => ({
    path: `textures/blocks/${cfg.namespace}_${def.id}.png`,
    kind: def.tex,
  }))
}

export function blockScriptPayload(cfg: PackConfig) {
  const ids: Record<string, string> = {}
  const hazards: string[] = []
  for (const def of enabledBlocks(cfg)) {
    if (def.use) ids[def.use] = `${cfg.namespace}:${def.id}`
    if (def.hazard) hazards.push(`${cfg.namespace}:${def.id}`)
  }
  return { blocks: ids, hazards }
}
