import { json } from './minecraft'
import { iconKey, iconPath, materialPath, type IconSpec, type TexKind } from './textures'
import { shapelessRecipe, shapedRecipe } from './recipes'
import type { GeneratedFile, PackConfig } from './types'

type Vec3 = [number, number, number]

interface Cube {
  origin: Vec3
  size: Vec3
  uv: [number, number]
  pivot?: Vec3
  rotation?: Vec3
}

export interface WeaponDef {
  id: string
  name: string
  kind: 'melee' | 'firearm'
  family: 'Blanc' | 'Lourd' | 'Arme de poing' | 'Automatique' | 'Précision' | 'Soutien' | 'Explosif'
  /** Purely descriptive, used by the docs and the UI. */
  damage: number
  range: number
  cooldownTicks: number
  durability: number
  ammo?: string
  icon: IconSpec
  texKind: TexKind
  cubes: Cube[]
  grip?: Cube
}

/**
 * One weapon per role — no duplicates. Eight melee tools, seven firearms,
 * plus the five ammunition types they consume.
 */
export const WEAPONS: WeaponDef[] = [
  {
    id: 'machete',
    name: 'Machette',
    kind: 'melee',
    family: 'Blanc',
    damage: 7,
    range: 3,
    cooldownTicks: 10,
    durability: 320,
    icon: { shape: 'blade', primary: '#c8ccd2', secondary: '#ffffff', accent: '#5b3a1c' },
    texKind: 'steel',
    cubes: [
      { origin: [-0.5, 0.5, -11], size: [1, 3, 11], uv: [0, 0] },
      { origin: [-1.5, 0.5, -1.5], size: [3, 1, 1.5], uv: [24, 0] },
    ],
    grip: { origin: [-0.75, -3.5, -1], size: [1.5, 4, 2], uv: [32, 16] },
  },
  {
    id: 'nail_bat',
    name: 'Batte cloutée',
    kind: 'melee',
    family: 'Blanc',
    damage: 8,
    range: 3.5,
    cooldownTicks: 14,
    durability: 260,
    icon: { shape: 'blunt', primary: '#8a6337', secondary: '#b1875a', accent: '#4a3520' },
    texKind: 'wood',
    cubes: [
      { origin: [-0.9, 0.5, -9], size: [1.8, 1.8, 9], uv: [0, 0] },
      { origin: [-1.3, 2.2, -9.4], size: [1, 1, 1], uv: [20, 20] },
      { origin: [0.4, 2.2, -3.4], size: [1, 1, 1], uv: [24, 20] },
    ],
    grip: { origin: [-0.7, -3, 0], size: [1.4, 3.6, 1.6], uv: [32, 16] },
  },
  {
    id: 'fire_axe',
    name: 'Hache de pompier',
    kind: 'melee',
    family: 'Lourd',
    damage: 10,
    range: 3,
    cooldownTicks: 18,
    durability: 420,
    icon: { shape: 'axe', primary: '#9aa3ad', secondary: '#ffffff', accent: '#6b4a24' },
    texKind: 'steel',
    cubes: [
      { origin: [-0.6, -4, -1.6], size: [1.2, 10, 1.6], uv: [0, 0] },
      { origin: [-3, 3, -1.6], size: [6, 3, 1.4], uv: [20, 0] },
      { origin: [1.6, 2.6, -1.2], size: [1.6, 1.6, 0.8], uv: [24, 8] },
    ],
    grip: { origin: [-0.8, -8, -1.4], size: [1.6, 4, 1.8], uv: [32, 16] },
  },
  {
    id: 'katana',
    name: 'Katana',
    kind: 'melee',
    family: 'Blanc',
    damage: 9,
    range: 4,
    cooldownTicks: 9,
    durability: 300,
    icon: { shape: 'katana', primary: '#dfe4ea', secondary: '#ffffff', accent: '#1f2937' },
    texKind: 'steel',
    cubes: [
      { origin: [-0.4, 0.8, -14], size: [0.8, 1.4, 14], uv: [0, 4] },
      { origin: [-1.4, 0.6, -2.5], size: [2.8, 0.9, 1], uv: [24, 0] },
    ],
    grip: { origin: [-0.6, -4, -1.4], size: [1.2, 5, 1.6], uv: [32, 16] },
  },
  {
    id: 'crowbar',
    name: 'Pied-de-biche',
    kind: 'melee',
    family: 'Blanc',
    damage: 6,
    range: 3,
    cooldownTicks: 11,
    durability: 500,
    icon: { shape: 'crowbar', primary: '#b23b3b', secondary: '#e07b7b', accent: '#5a6068' },
    texKind: 'scrap',
    cubes: [
      { origin: [-0.6, 0.5, -12], size: [1.2, 1.2, 12], uv: [0, 0] },
      { origin: [-0.6, 1.4, -14], size: [1.2, 2, 2], uv: [20, 0] },
    ],
    grip: { origin: [-0.7, -2.5, -3], size: [1.4, 3, 1.6], uv: [32, 16] },
  },
  {
    id: 'sledgehammer',
    name: 'Masse',
    kind: 'melee',
    family: 'Lourd',
    damage: 14,
    range: 3.2,
    cooldownTicks: 26,
    durability: 600,
    icon: { shape: 'hammer', primary: '#7d858e', secondary: '#b9c0c8', accent: '#6b4a24' },
    texKind: 'steel',
    cubes: [
      { origin: [-0.7, -5, -1.8], size: [1.4, 12, 1.8], uv: [0, 0] },
      { origin: [-3.5, 5, -2.8], size: [7, 3.4, 3.4], uv: [22, 0] },
    ],
    grip: { origin: [-0.9, -10, -1.6], size: [1.8, 4.5, 2], uv: [32, 16] },
  },
  {
    id: 'spear',
    name: 'Lance artisanale',
    kind: 'melee',
    family: 'Blanc',
    damage: 7,
    range: 5.5,
    cooldownTicks: 15,
    durability: 220,
    icon: { shape: 'spear', primary: '#c8ccd2', secondary: '#ffffff', accent: '#6b4a24' },
    texKind: 'wood',
    cubes: [
      { origin: [-0.5, 0.5, -20], size: [1, 1, 20], uv: [0, 2] },
      { origin: [-1.1, -0.4, -24], size: [2.2, 2.8, 4], uv: [20, 0] },
    ],
    grip: { origin: [-0.6, -0.2, 0], size: [1.2, 1.4, 2], uv: [32, 16] },
  },
  {
    id: 'combat_knife',
    name: 'Couteau de combat',
    kind: 'melee',
    family: 'Blanc',
    damage: 5,
    range: 2.4,
    cooldownTicks: 6,
    durability: 240,
    icon: { shape: 'knife', primary: '#c8ccd2', secondary: '#ffffff', accent: '#2f3640' },
    texKind: 'steel',
    cubes: [
      { origin: [-0.3, 0.4, -7], size: [0.6, 1.6, 7], uv: [0, 4] },
      { origin: [-0.4, 1.4, 0], size: [0.8, 0.8, 1], uv: [20, 0] },
    ],
    grip: { origin: [-0.5, -2.2, -1], size: [1, 2.6, 1.4], uv: [32, 16] },
  },
  {
    id: 'pistol',
    name: 'Pistolet',
    kind: 'firearm',
    family: 'Arme de poing',
    damage: 6,
    range: 40,
    cooldownTicks: 8,
    durability: 400,
    ammo: 'ammo_9mm',
    icon: { shape: 'pistol', primary: '#5a6068', secondary: '#9aa3ad', accent: '#4a3520' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1, -0.5, -3], size: [2, 3, 4], uv: [0, 0] },
      { origin: [-0.5, 0, -6], size: [1, 1, 3], uv: [20, 0] },
    ],
    grip: { origin: [-0.9, -4, -1.2], size: [1.8, 3.5, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -12] },
  },
  {
    id: 'smg',
    name: 'Pistolet-mitrailleur',
    kind: 'firearm',
    family: 'Automatique',
    damage: 5,
    range: 34,
    cooldownTicks: 4,
    durability: 420,
    ammo: 'ammo_9mm',
    icon: { shape: 'smg', primary: '#4c525a', secondary: '#98a1ab', accent: '#3a3f45' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1.2, -1, -5], size: [2.4, 3, 7], uv: [0, 0] },
      { origin: [-0.6, -0.4, -9], size: [1.2, 1.2, 4], uv: [24, 0] },
      { origin: [-0.8, -3.4, -3], size: [1.6, 2.6, 3], uv: [0, 20] },
    ],
    grip: { origin: [-0.9, -4, 0.5], size: [1.8, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -8] },
  },
  {
    id: 'shotgun',
    name: 'Fusil à pompe',
    kind: 'firearm',
    family: 'Lourd',
    damage: 16,
    range: 22,
    cooldownTicks: 24,
    durability: 350,
    ammo: 'shells',
    icon: { shape: 'shotgun', primary: '#5a6068', secondary: '#9aa3ad', accent: '#4a3520' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1.5, -1, -5], size: [3, 3, 6], uv: [0, 0] },
      { origin: [-1, -0.5, -13], size: [2, 2, 8], uv: [24, 0] },
      { origin: [-1, -0.5, 1], size: [2, 2, 4], uv: [40, 0] },
    ],
    grip: { origin: [-1, -4, -1], size: [2, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -10] },
  },
  {
    id: 'assault_rifle',
    name: "Fusil d'assaut",
    kind: 'firearm',
    family: 'Automatique',
    damage: 9,
    range: 48,
    cooldownTicks: 5,
    durability: 500,
    ammo: 'ammo_556',
    icon: { shape: 'rifle', primary: '#4c525a', secondary: '#98a1ab', accent: '#3a3f45' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1.5, -1.5, -4], size: [3, 3, 8], uv: [0, 0] },
      { origin: [-0.5, -0.5, -9], size: [1, 1, 5], uv: [24, 0] },
      { origin: [-1, -1, 4], size: [2, 2, 3], uv: [40, 0] },
      { origin: [-1, -3, -3], size: [2, 2, 3], uv: [0, 20] },
    ],
    grip: { origin: [-1, -4, -1], size: [2, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -10] },
  },
  {
    id: 'sniper_rifle',
    name: 'Fusil de précision',
    kind: 'firearm',
    family: 'Précision',
    damage: 26,
    range: 80,
    cooldownTicks: 40,
    durability: 320,
    ammo: 'ammo_308',
    icon: { shape: 'sniper', primary: '#3f444a', secondary: '#8d959e', accent: '#6ee7b7' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1.4, -1.2, -6], size: [2.8, 2.6, 10], uv: [0, 0] },
      { origin: [-0.5, -0.4, -18], size: [1, 1, 12], uv: [24, 0] },
      { origin: [-1, -1.6, 4], size: [2, 2, 4], uv: [40, 0] },
      { origin: [-1.6, 1.6, -4], size: [3.2, 1.4, 5], uv: [0, 22] },
    ],
    grip: { origin: [-0.9, -4, 0], size: [1.8, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -9] },
  },
  {
    id: 'lmg',
    name: 'Mitrailleuse',
    kind: 'firearm',
    family: 'Soutien',
    damage: 11,
    range: 42,
    cooldownTicks: 3,
    durability: 650,
    ammo: 'ammo_556',
    icon: { shape: 'lmg', primary: '#3f444a', secondary: '#8d959e', accent: '#5b3a1c' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-2, -1.6, -5], size: [4, 3.4, 9], uv: [0, 0] },
      { origin: [-0.8, -0.6, -12], size: [1.6, 1.6, 7], uv: [24, 0] },
      { origin: [-1.6, -4.6, -3], size: [3.2, 3, 4], uv: [0, 20] },
      { origin: [-1.2, -1.4, 4], size: [2.4, 2.4, 3], uv: [40, 0] },
    ],
    grip: { origin: [-1.1, -4.4, 1], size: [2.2, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -7] },
  },
  {
    id: 'grenade_launcher',
    name: 'Lance-grenades',
    kind: 'firearm',
    family: 'Explosif',
    damage: 18,
    range: 30,
    cooldownTicks: 45,
    durability: 300,
    ammo: 'rockets',
    icon: { shape: 'launcher', primary: '#4a5040', secondary: '#8d9678', accent: '#c0392b' },
    texKind: 'gunmetal',
    cubes: [
      { origin: [-1.8, -1.8, -5], size: [3.6, 3.6, 9], uv: [0, 0] },
      { origin: [-2.2, -2.2, -13], size: [4.4, 4.4, 8], uv: [0, 11] },
      { origin: [-1, -4.6, -2], size: [2, 3, 3], uv: [0, 20] },
    ],
    grip: { origin: [-1, -4.6, 1], size: [2, 3, 2], uv: [0, 16], pivot: [0, -1, 0], rotation: [0, 0, -8] },
  },
]

export interface AmmoDef {
  id: string
  name: string
  stack: number
  icon: IconSpec
}

export const AMMO: AmmoDef[] = [
  { id: 'ammo_9mm', name: 'Balles 9mm', stack: 64, icon: { shape: 'ammo', primary: '#c9a227', secondary: '#8a6f1a' } },
  { id: 'shells', name: 'Cartouches', stack: 32, icon: { shape: 'shell', primary: '#b23b3b', secondary: '#c9a227', accent: '#5a6068' } },
  { id: 'ammo_556', name: 'Balles 5,56', stack: 64, icon: { shape: 'ammo', primary: '#b9c0c8', secondary: '#6b7280' } },
  { id: 'ammo_308', name: 'Balles .308', stack: 32, icon: { shape: 'ammo', primary: '#c96f27', secondary: '#7a4514' } },
  { id: 'rockets', name: 'Roquettes', stack: 8, icon: { shape: 'rocket', primary: '#6b7050', secondary: '#c0392b', accent: '#8d9678' } },
]

export function hasFirearms(cfg: PackConfig): boolean {
  return cfg.mechanics.firearms
}

export function activeWeapons(cfg: PackConfig): WeaponDef[] {
  const melee = cfg.mechanics.meleeWeapons ? WEAPONS.filter((w) => w.kind === 'melee') : []
  const guns = cfg.mechanics.firearms ? WEAPONS.filter((w) => w.kind === 'firearm') : []
  return [...melee, ...guns]
}

export function activeAmmo(cfg: PackConfig): AmmoDef[] {
  if (!cfg.mechanics.firearms) return []
  const needed = new Set(WEAPONS.filter((w) => w.ammo).map((w) => w.ammo as string))
  return AMMO.filter((a) => needed.has(a.id))
}

/* ------------------------------------------------------------------ *
 * Geometry (.geo.json)
 * ------------------------------------------------------------------ */

function cubeOf(cube: Cube): Record<string, unknown> {
  const out: Record<string, unknown> = { origin: cube.origin, size: cube.size, uv: cube.uv }
  if (cube.pivot) out.pivot = cube.pivot
  if (cube.rotation) out.rotation = cube.rotation
  return out
}

export function weaponGeometryFiles(cfg: PackConfig): GeneratedFile[] {
  return activeWeapons(cfg).map((def) => {
    const bones: unknown[] = [
      {
        name: 'weapon_root',
        pivot: [0, 0, 0],
        binding: 'q.item_slot_to_bone_name(context.item_slot)',
        cubes: def.cubes.map(cubeOf),
      },
    ]
    if (def.grip) {
      const grip = def.grip
      bones.push({
        name: 'grip',
        parent: 'weapon_root',
        pivot: grip.pivot ?? [0, -1, 0],
        cubes: [cubeOf(grip)],
      })
    }
    return {
      path: `models/entity/${def.id}.geo.json`,
      content: json({
        format_version: '1.16.0',
        'minecraft:geometry': [
          {
            description: {
              identifier: `geometry.${cfg.namespace}.${def.id}`,
              texture_width: 64,
              texture_height: 32,
              visible_bounds_width: 4,
              visible_bounds_height: 4,
              visible_bounds_offset: [0, 1, 0],
            },
            bones,
          },
        ],
      }),
    }
  })
}

/* ------------------------------------------------------------------ *
 * Attachables (3D model while held)
 * ------------------------------------------------------------------ */

export function weaponAttachableFiles(cfg: PackConfig, customTextures: boolean): GeneratedFile[] {
  return activeWeapons(cfg).map((def) => ({
    path: `attachables/${def.id}.json`,
    content: json({
      format_version: '1.20.30',
      'minecraft:attachable': {
        description: {
          identifier: `${cfg.namespace}:${def.id}`,
          materials: { default: 'entity', enchanted: 'entity_alphatest_glint' },
          textures: {
            default: customTextures ? materialPath(cfg.namespace, def.texKind) : 'textures/items/iron_ingot',
            enchanted: 'textures/misc/enchanted_item_glint',
          },
          geometry: { default: `geometry.${cfg.namespace}.${def.id}` },
          render_controllers: ['controller.render.item_default'],
        },
      },
    }),
  }))
}

/* ------------------------------------------------------------------ *
 * Items + icon registration
 * ------------------------------------------------------------------ */

export interface ItemIconSpec {
  id: string
  displayName: string
  textureKey: string
  texturePath: string
  icon: IconSpec
}

export function weaponItemSpecs(cfg: PackConfig, customTextures: boolean): ItemIconSpec[] {
  const entries: { id: string; name: string; icon: IconSpec }[] = [
    ...activeWeapons(cfg).map((w) => ({ id: w.id, name: w.name, icon: w.icon })),
    ...activeAmmo(cfg).map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
  ]
  return entries.map((entry) => ({
    id: entry.id,
    displayName: entry.name,
    textureKey: iconKey(cfg.namespace, entry.id),
    texturePath: customTextures ? iconPath(cfg.namespace, entry.id) : 'textures/items/iron_ingot',
    icon: entry.icon,
  }))
}

export function weaponItemFiles(cfg: PackConfig): GeneratedFile[] {
  const files: GeneratedFile[] = activeWeapons(cfg).map((def) => ({
    path: `items/${def.id}.json`,
    content: json({
      format_version: '1.21.0',
      'minecraft:item': {
        description: { identifier: `${cfg.namespace}:${def.id}`, menu_category: { category: 'equipment' } },
        components:
          def.kind === 'melee'
            ? {
                'minecraft:icon': { textures: { default: iconKey(cfg.namespace, def.id) } },
                'minecraft:max_stack_size': 1,
                'minecraft:damage': def.damage,
                'minecraft:durability': { max_durability: def.durability },
                'minecraft:hand_equipped': true,
                'minecraft:enchantable': { value: 14, slot: 'sword' },
                'minecraft:repairable': {
                  repair_items: [{ items: ['minecraft:iron_ingot'], repair_amount: 120 }],
                },
              }
            : {
                'minecraft:icon': { textures: { default: iconKey(cfg.namespace, def.id) } },
                'minecraft:max_stack_size': 1,
                'minecraft:hand_equipped': true,
                'minecraft:durability': { max_durability: def.durability },
                'minecraft:repairable': {
                  repair_items: [{ items: ['minecraft:iron_ingot'], repair_amount: 160 }],
                },
              },
      },
    }),
  }))

  for (const ammo of activeAmmo(cfg)) {
    files.push({
      path: `items/${ammo.id}.json`,
      content: json({
        format_version: '1.21.0',
        'minecraft:item': {
          description: { identifier: `${cfg.namespace}:${ammo.id}`, menu_category: { category: 'equipment' } },
          components: {
            'minecraft:icon': { textures: { default: iconKey(cfg.namespace, ammo.id) } },
            'minecraft:max_stack_size': ammo.stack,
          },
        },
      }),
    })
  }

  return files
}

/* ------------------------------------------------------------------ *
 * Recipes
 * ------------------------------------------------------------------ */

export function weaponRecipeFiles(cfg: PackConfig): GeneratedFile[] {
  const ns = cfg.namespace
  const files: GeneratedFile[] = []
  const ids = new Set(activeWeapons(cfg).map((w) => w.id))

  const shaped = (id: string, pattern: string[], key: Record<string, { item: string }>, count = 1) => {
    files.push(shapedRecipe(id, ns, pattern, key, { item: `${ns}:${id}`, count }))
  }
  const shapeless = (id: string, ingredients: { item: string }[], count = 1) => {
    files.push(shapelessRecipe(id, ns, ingredients, { item: `${ns}:${id}`, count }))
  }

  if (ids.has('machete')) {
    shaped('machete', ['I', 'I', 'S'], { I: { item: 'minecraft:iron_ingot' }, S: { item: 'minecraft:stick' } })
  }
  if (ids.has('nail_bat')) {
    shapeless(
      'nail_bat',
      [
        { item: 'minecraft:stick' },
        { item: 'minecraft:stick' },
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:iron_nugget' },
      ],
    )
  }
  if (ids.has('fire_axe')) {
    shaped('fire_axe', ['II', 'IS', ' S'], { I: { item: 'minecraft:iron_ingot' }, S: { item: 'minecraft:stick' } })
  }
  if (ids.has('katana')) {
    shaped('katana', ['  I', ' I ', 'S  '], { I: { item: 'minecraft:iron_ingot' }, S: { item: 'minecraft:stick' } })
  }
  if (ids.has('crowbar')) {
    shapeless(
      'crowbar',
      [{ item: 'minecraft:iron_ingot' }, { item: 'minecraft:iron_ingot' }, { item: 'minecraft:iron_ingot' }],
    )
  }
  if (ids.has('sledgehammer')) {
    shaped('sledgehammer', ['III', ' S ', ' S '], { I: { item: 'minecraft:iron_block' }, S: { item: 'minecraft:stick' } })
  }
  if (ids.has('spear')) {
    shapeless(
      'spear',
      [{ item: 'minecraft:stick' }, { item: 'minecraft:stick' }, { item: 'minecraft:iron_ingot' }],
    )
  }
  if (ids.has('combat_knife')) {
    shapeless(
      'combat_knife',
      [{ item: 'minecraft:iron_ingot' }, { item: 'minecraft:iron_nugget' }, { item: 'minecraft:stick' }],
    )
  }
  if (ids.has('pistol')) {
    shapeless(
      'pistol',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:stick' },
        { item: 'minecraft:gunpowder' },
      ],
    )
  }
  if (ids.has('smg')) {
    shapeless(
      'smg',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:redstone' },
        { item: 'minecraft:gunpowder' },
      ],
    )
  }
  if (ids.has('shotgun')) {
    shapeless(
      'shotgun',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:stick' },
        { item: 'minecraft:gunpowder' },
      ],
    )
  }
  if (ids.has('assault_rifle')) {
    shapeless(
      'assault_rifle',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:stick' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:redstone' },
      ],
    )
  }
  if (ids.has('sniper_rifle')) {
    shapeless(
      'sniper_rifle',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:glass' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:redstone' },
      ],
    )
  }
  if (ids.has('lmg')) {
    shapeless(
      'lmg',
      [
        { item: 'minecraft:iron_block' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:redstone' },
      ],
    )
  }
  if (ids.has('grenade_launcher')) {
    shapeless(
      'grenade_launcher',
      [
        { item: 'minecraft:iron_block' },
        { item: 'minecraft:iron_block' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:tnt' },
      ],
    )
  }

  const ammoIds = new Set(activeAmmo(cfg).map((a) => a.id))
  if (ammoIds.has('ammo_9mm')) {
    shapeless(
      'ammo_9mm',
      [
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:gunpowder' },
      ],
      8,
    )
  }
  if (ammoIds.has('shells')) {
    shapeless(
      'shells',
      [
        { item: 'minecraft:iron_nugget' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:paper' },
      ],
      4,
    )
  }
  if (ammoIds.has('ammo_556')) {
    shapeless(
      'ammo_556',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:copper_ingot' },
      ],
      8,
    )
  }
  if (ammoIds.has('ammo_308')) {
    shapeless(
      'ammo_308',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:gunpowder' },
      ],
      4,
    )
  }
  if (ammoIds.has('rockets')) {
    shapeless(
      'rockets',
      [
        { item: 'minecraft:iron_ingot' },
        { item: 'minecraft:gunpowder' },
        { item: 'minecraft:tnt' },
      ],
      2,
    )
  }

  return files
}

/* ------------------------------------------------------------------ *
 * Script payload
 * ------------------------------------------------------------------ */

export function weaponScriptPayload(cfg: PackConfig) {
  return {
    firearms: cfg.mechanics.firearms,
    melee: cfg.mechanics.meleeWeapons,
    weapons: activeWeapons(cfg).map((w) => ({
      id: `${cfg.namespace}:${w.id}`,
      kind: w.kind,
      damage: w.damage,
      range: w.range,
      cooldown: w.cooldownTicks,
      durability: w.durability,
      ammo: w.ammo ? `${cfg.namespace}:${w.ammo}` : null,
      explosive: w.id === 'grenade_launcher',
    })),
  }
}
