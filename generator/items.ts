import { json, modernIcon } from './minecraft'
import { shapedRecipe, shapelessRecipe } from './recipes'
import { iconKey, iconPath, type IconSpec } from './textures'
import type { MechanicKey, GeneratedFile, PackConfig } from './types'
import type { ItemIconSpec } from './weapons'

type RecipeDef =
  | { type: 'shaped'; pattern: string[]; key: Record<string, { item: string }>; count: number }
  | { type: 'shapeless'; ingredients: { item: string }[]; count: number }

export interface ItemSpec {
  id: string
  displayName: string
  category: 'items' | 'equipment'
  gate: MechanicKey
  icon: IconSpec
  components: Record<string, unknown>
  recipe?: RecipeDef
  /** Script keyword the generated main.js reacts to on item use. */
  use?: string
}

const DRINK = { 'minecraft:use_animation': 'drink' as const }
const EAT = { 'minecraft:use_animation': 'eat' as const }

function food(nutrition: number, saturation: string, extras: Record<string, unknown> = {}) {
  return {
    'minecraft:food': { nutrition, saturation_modifier: saturation, can_always_eat: true },
    'minecraft:use_modifiers': { use_duration: 1.4, movement_modifier: 0.35 },
    ...extras,
  }
}

export function itemSpecs(cfg: PackConfig): ItemSpec[] {
  const ns = cfg.namespace
  const specs: ItemSpec[] = []

  /* ---------------- médical ---------------- */
  specs.push(
    {
      id: 'bandage',
      displayName: 'Bandage',
      category: 'items',
      gate: 'medkits',
      use: 'bandage',
      icon: { shape: 'bandage', primary: '#f4f4f5', secondary: '#d4d4d8', accent: '#c0392b' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'bandage') },
        'minecraft:max_stack_size': 16,
        ...food(1, 'low', EAT),
      },
      recipe: {
        type: 'shaped',
        pattern: ['PSP'],
        key: { P: { item: 'minecraft:paper' }, S: { item: 'minecraft:string' } },
        count: 3,
      },
    },
    {
      id: 'compress',
      displayName: 'Pansement compressif',
      category: 'items',
      gate: 'medkits',
      use: 'compress',
      icon: { shape: 'bandage', primary: '#fafafa', secondary: '#e4e4e7', accent: '#b91c1c' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'compress') },
        'minecraft:max_stack_size': 12,
        ...food(1, 'low', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: `${ns}:bandage` },
          { item: `${ns}:bandage` },
          { item: 'minecraft:slime_ball' },
        ],
        count: 1,
      },
    },
    {
      id: 'medkit',
      displayName: 'Trousse de soin',
      category: 'items',
      gate: 'medkits',
      use: 'medkit',
      icon: { shape: 'medkit', primary: '#e5e7eb', secondary: '#9ca3af', accent: '#c0392b' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'medkit') },
        'minecraft:max_stack_size': 8,
        ...food(2, 'good', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: `${ns}:compress` },
          { item: `${ns}:bandage` },
          { item: 'minecraft:golden_apple' },
        ],
        count: 1,
      },
    },
    {
      id: 'antiviral',
      displayName: 'Antiviral',
      category: 'items',
      gate: 'medkits',
      use: 'antiviral',
      icon: { shape: 'vial', primary: '#dbeafe', secondary: '#93c5fd', accent: '#1d4ed8' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'antiviral') },
        'minecraft:max_stack_size': 6,
        ...food(1, 'low', DRINK),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:glass_bottle' },
          { item: 'minecraft:glowstone_dust' },
          { item: 'minecraft:nether_wart' },
        ],
        count: 1,
      },
    },
    {
      id: 'adrenaline',
      displayName: 'Adrénaline',
      category: 'items',
      gate: 'medkits',
      use: 'adrenaline',
      icon: { shape: 'syringe', primary: '#fee2e2', secondary: '#fca5a5', accent: '#dc2626' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'adrenaline') },
        'minecraft:max_stack_size': 8,
        ...food(1, 'low', DRINK),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:glass_bottle' },
          { item: 'minecraft:sugar' },
          { item: 'minecraft:blaze_powder' },
        ],
        count: 1,
      },
    },
    {
      id: 'painkiller',
      displayName: 'Antidouleur',
      category: 'items',
      gate: 'medkits',
      use: 'painkiller',
      icon: { shape: 'pill', primary: '#ffffff', secondary: '#e4e4e7', accent: '#a16207' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'painkiller') },
        'minecraft:max_stack_size': 16,
        ...food(1, 'low', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:sugar' },
          { item: 'minecraft:wheat' },
        ],
        count: 2,
      },
    },
    {
      id: 'splint',
      displayName: 'Attelle',
      category: 'items',
      gate: 'medkits',
      use: 'splint',
      icon: { shape: 'bandage', primary: '#d6c7a8', secondary: '#a89878', accent: '#4a3520' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'splint') },
        'minecraft:max_stack_size': 8,
        ...food(1, 'low', EAT),
      },
      recipe: {
        type: 'shaped',
        pattern: ['SS', 'P '],
        key: { S: { item: 'minecraft:stick' }, P: { item: 'minecraft:paper' } },
        count: 1,
      },
    },
  )

  /* ---------------- nourriture & eau ---------------- */
  specs.push(
    {
      id: 'canned_beans',
      displayName: 'Haricots en conserve',
      category: 'items',
      gate: 'thirst',
      use: 'food',
      icon: { shape: 'can', primary: '#94a3b8', secondary: '#cbd5e1', accent: '#65a30d' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'canned_beans') },
        'minecraft:max_stack_size': 16,
        ...food(4, 'normal', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:brown_mushroom' },
          { item: 'minecraft:bowl' },
        ],
        count: 2,
      },
    },
    {
      id: 'canned_meat',
      displayName: 'Viande en conserve',
      category: 'items',
      gate: 'thirst',
      use: 'food',
      icon: { shape: 'can', primary: '#8d99ae', secondary: '#cbd5e1', accent: '#b45309' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'canned_meat') },
        'minecraft:max_stack_size': 16,
        ...food(6, 'good', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:cooked_beef' },
          { item: 'minecraft:bowl' },
        ],
        count: 2,
      },
    },
    {
      id: 'energy_bar',
      displayName: 'Barre énergétique',
      category: 'items',
      gate: 'thirst',
      use: 'food',
      icon: { shape: 'bar', primary: '#a16207', secondary: '#d6a24c', accent: '#fef3c7' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'energy_bar') },
        'minecraft:max_stack_size': 16,
        ...food(3, 'normal', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:wheat' },
          { item: 'minecraft:cocoa_beans' },
          { item: 'minecraft:sugar' },
        ],
        count: 3,
      },
    },
    {
      id: 'ration',
      displayName: 'Ration militaire',
      category: 'items',
      gate: 'thirst',
      use: 'ration',
      icon: { shape: 'box', primary: '#4b5320', secondary: '#7c8a4a', accent: '#d6c7a8' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'ration') },
        'minecraft:max_stack_size': 8,
        ...food(8, 'supernatural', EAT),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: `${ns}:canned_meat` },
          { item: `${ns}:energy_bar` },
          { item: `${ns}:water_clean` },
        ],
        count: 1,
      },
    },
    {
      id: 'water_dirty',
      displayName: 'Eau croupie',
      category: 'items',
      gate: 'thirst',
      use: 'water_dirty',
      icon: { shape: 'bottle', primary: '#8a7c5a', secondary: '#6b5f45', accent: '#bfae86' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'water_dirty') },
        'minecraft:max_stack_size': 16,
        ...food(1, 'low', DRINK),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [{ item: 'minecraft:glass_bottle' }],
        count: 1,
      },
    },
    {
      id: 'water_clean',
      displayName: 'Eau purifiée',
      category: 'items',
      gate: 'thirst',
      use: 'water_clean',
      icon: { shape: 'bottle', primary: '#bfe3f5', secondary: '#8ec9e8', accent: '#e0f2fe' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'water_clean') },
        'minecraft:max_stack_size': 16,
        ...food(2, 'normal', DRINK),
      },
      recipe: {
        type: 'shapeless',
        ingredients: [{ item: `${ns}:water_dirty` }, { item: 'minecraft:coal' }],
        count: 1,
      },
    },
  )

  /* ---------------- projectiles ---------------- */
  specs.push(
    {
      id: 'molotov',
      displayName: 'Cocktail molotov',
      category: 'items',
      gate: 'molotov',
      use: 'molotov',
      icon: { shape: 'bottle', primary: '#b45309', secondary: '#fbbf24', accent: '#f97316' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'molotov') },
        'minecraft:max_stack_size': 16,
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:glass_bottle' },
          { item: 'minecraft:coal' },
          { item: 'minecraft:string' },
        ],
        count: 1,
      },
    },
    {
      id: 'grenade',
      displayName: 'Grenade à fragmentation',
      category: 'items',
      gate: 'molotov',
      use: 'grenade',
      icon: { shape: 'grenade', primary: '#4b5320', secondary: '#7c8a4a', accent: '#c0392b' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'grenade') },
        'minecraft:max_stack_size': 16,
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:gunpowder' },
          { item: 'minecraft:gunpowder' },
          { item: 'minecraft:flint' },
        ],
        count: 2,
      },
    },
    {
      id: 'smoke_grenade',
      displayName: 'Fumigène',
      category: 'items',
      gate: 'molotov',
      use: 'smoke',
      icon: { shape: 'grenade', primary: '#6b7280', secondary: '#9ca3af', accent: '#e5e7eb' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'smoke_grenade') },
        'minecraft:max_stack_size': 16,
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:gunpowder' },
          { item: 'minecraft:sugar' },
          { item: 'minecraft:paper' },
        ],
        count: 2,
      },
    },
  )

  /* ---------------- utilitaires ---------------- */
  specs.push(
    {
      id: 'rattle',
      displayName: 'Hochet',
      category: 'items',
      gate: 'noise',
      use: 'rattle',
      icon: { shape: 'bell', primary: '#b9c0c8', secondary: '#e5e7eb', accent: '#4a3520' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'rattle') },
        'minecraft:max_stack_size': 1,
        'minecraft:use_modifiers': { use_duration: 0.2 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:stick' },
        ],
        count: 1,
      },
    },
    {
      id: 'barricade_kit',
      displayName: 'Kit de barricade',
      category: 'items',
      gate: 'barricades',
      use: 'barricade',
      icon: { shape: 'tool', primary: '#8a6337', secondary: '#b1875a', accent: '#9ca3af' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'barricade_kit') },
        'minecraft:max_stack_size': 16,
        'minecraft:use_modifiers': { use_duration: 0.4 },
      },
      recipe: {
        type: 'shaped',
        pattern: ['PPP', 'PIP'],
        key: { P: { item: 'minecraft:oak_planks' }, I: { item: 'minecraft:iron_ingot' } },
        count: 1,
      },
    },
    {
      id: 'flashlight',
      displayName: 'Lampe torche',
      category: 'equipment',
      gate: 'baseBuilding',
      use: 'flashlight',
      icon: { shape: 'device', primary: '#374151', secondary: '#6b7280', accent: '#fde68a' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'flashlight') },
        'minecraft:max_stack_size': 1,
        'minecraft:hand_equipped': true,
        'minecraft:durability': { max_durability: 400 },
        'minecraft:use_modifiers': { use_duration: 0.2 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:glass' },
          { item: 'minecraft:glowstone_dust' },
        ],
        count: 1,
      },
    },
    {
      id: 'radio',
      displayName: 'Radio de survie',
      category: 'items',
      gate: 'baseBuilding',
      use: 'radio',
      icon: { shape: 'radio', primary: '#3f444a', secondary: '#8d959e', accent: '#22d3ee' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'radio') },
        'minecraft:max_stack_size': 1,
        'minecraft:durability': { max_durability: 200 },
        'minecraft:use_modifiers': { use_duration: 0.6 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:redstone' },
          { item: 'minecraft:copper_ingot' },
        ],
        count: 1,
      },
    },
    {
      id: 'lockpick',
      displayName: 'Crochet',
      category: 'equipment',
      gate: 'baseBuilding',
      use: 'lockpick',
      icon: { shape: 'pick', primary: '#c8ccd2', secondary: '#e5e7eb', accent: '#8a6337' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'lockpick') },
        'minecraft:max_stack_size': 1,
        'minecraft:hand_equipped': true,
        'minecraft:durability': { max_durability: 90 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:iron_nugget' },
        ],
        count: 1,
      },
    },
    {
      id: 'repair_kit',
      displayName: 'Kit de réparation',
      category: 'items',
      gate: 'baseBuilding',
      use: 'repair',
      icon: { shape: 'tool', primary: '#9ca3af', secondary: '#d1d5db', accent: '#b45309' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'repair_kit') },
        'minecraft:max_stack_size': 4,
        'minecraft:use_modifiers': { use_duration: 1.2 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:flint' },
        ],
        count: 1,
      },
    },
    {
      id: 'binoculars',
      displayName: 'Jumelles',
      category: 'equipment',
      gate: 'baseBuilding',
      use: 'binoculars',
      icon: { shape: 'lens', primary: '#2f3640', secondary: '#6b7280', accent: '#7dd3fc' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'binoculars') },
        'minecraft:max_stack_size': 1,
        'minecraft:hand_equipped': true,
        'minecraft:use_modifiers': { use_duration: 0.3 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:glass' },
          { item: 'minecraft:glass' },
          { item: 'minecraft:iron_ingot' },
        ],
        count: 1,
      },
    },
    {
      id: 'decoy',
      displayName: 'Leurre sonore',
      category: 'items',
      gate: 'baseBuilding',
      use: 'decoy',
      icon: { shape: 'box', primary: '#7c4a2c', secondary: '#a9713f', accent: '#e2b451' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'decoy') },
        'minecraft:max_stack_size': 8,
        'minecraft:use_modifiers': { use_duration: 0.4 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:iron_nugget' },
          { item: 'minecraft:note_block' },
        ],
        count: 2,
      },
    },
    {
      id: 'safe_beacon',
      displayName: 'Balise de zone sûre',
      category: 'items',
      gate: 'turrets',
      use: 'beacon',
      icon: { shape: 'beacon', primary: '#2b343a', secondary: '#4b5563', accent: '#7ce0a8' },
      components: {
        'minecraft:icon': { texture: iconKey(ns, 'safe_beacon') },
        'minecraft:max_stack_size': 4,
        'minecraft:use_modifiers': { use_duration: 1 },
      },
      recipe: {
        type: 'shapeless',
        ingredients: [
          { item: 'minecraft:emerald' },
          { item: 'minecraft:glowstone' },
          { item: 'minecraft:iron_ingot' },
          { item: 'minecraft:redstone' },
        ],
        count: 1,
      },
    },
  )

  return specs.filter((spec) => cfg.mechanics[spec.gate])
}

export interface ItemBundle {
  files: GeneratedFile[]
  specs: ItemSpec[]
}

export function itemFiles(cfg: PackConfig): ItemBundle {
  const specs = itemSpecs(cfg)
  const files = specs.map<GeneratedFile>((spec) => ({
    path: `items/${spec.id}.json`,
    content: json({
      format_version: '1.21.0',
      'minecraft:item': {
        description: {
          identifier: `${cfg.namespace}:${spec.id}`,
          menu_category: { category: spec.category },
        },
        components: modernIcon(spec.components),
      },
    }),
  }))
  return { files, specs }
}

export function itemRecipeFiles(cfg: PackConfig): GeneratedFile[] {
  const ns = cfg.namespace
  const files: GeneratedFile[] = []
  for (const spec of itemSpecs(cfg)) {
    const recipe = spec.recipe
    if (!recipe) continue
    if (recipe.type === 'shaped') {
      files.push(
        shapedRecipe(spec.id, ns, recipe.pattern, recipe.key, {
          item: `${ns}:${spec.id}`,
          count: recipe.count,
        }),
      )
    } else {
      files.push(
        shapelessRecipe(spec.id, ns, recipe.ingredients, {
          item: `${ns}:${spec.id}`,
          count: recipe.count,
        }),
      )
    }
  }
  return files
}

export function itemIconSpecs(cfg: PackConfig, customTextures: boolean): ItemIconSpec[] {
  return itemSpecs(cfg).map((spec) => ({
    id: spec.id,
    displayName: spec.displayName,
    textureKey: iconKey(cfg.namespace, spec.id),
    texturePath: customTextures ? iconPath(cfg.namespace, spec.id) : 'textures/items/iron_ingot',
    icon: spec.icon,
  }))
}

export function itemScriptPayload(cfg: PackConfig) {
  const entries: Record<string, string> = {}
  for (const spec of itemSpecs(cfg)) {
    if (spec.use) entries[spec.use] = `${cfg.namespace}:${spec.id}`
  }
  return { items: entries }
}
