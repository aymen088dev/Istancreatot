import type { VariantDef } from './options'

export type MobGroup = 'zombie' | 'creature' | 'human' | 'npc' | 'boss'

/** Vanilla visual used by the client entity file (no binary assets required). */
export type MobVisual = 'zombie' | 'husk' | 'drowned' | 'skeleton' | 'piglin' | 'wolf' | 'bear' | 'cow' | 'chicken' | 'villager' | 'spider'

interface MobVisualDef {
  geometry: string
  texture: string
  render: string
  material: string
  /** Humanoids reuse the zombie animation set, creatures stay static. */
  animations: 'humanoid' | 'none'
}

export const MOB_VISUALS: Record<MobVisual, MobVisualDef> = {
  zombie: {
    geometry: 'geometry.zombie',
    texture: 'textures/entity/zombie/zombie',
    render: 'controller.render.zombie',
    material: 'zombie',
    animations: 'humanoid',
  },
  husk: {
    geometry: 'geometry.husk',
    texture: 'textures/entity/zombie/husk',
    render: 'controller.render.zombie',
    material: 'zombie',
    animations: 'humanoid',
  },
  drowned: {
    geometry: 'geometry.drowned',
    texture: 'textures/entity/zombie/drowned',
    render: 'controller.render.drowned',
    material: 'zombie',
    animations: 'humanoid',
  },
  skeleton: {
    geometry: 'geometry.skeleton',
    texture: 'textures/entity/skeleton/skeleton',
    render: 'controller.render.skeleton',
    material: 'skeleton',
    animations: 'humanoid',
  },
  piglin: {
    geometry: 'geometry.piglin',
    texture: 'textures/entity/piglin/piglin',
    render: 'controller.render.piglin',
    material: 'piglin',
    animations: 'humanoid',
  },
  wolf: {
    geometry: 'geometry.wolf',
    texture: 'textures/entity/wolf/wolf',
    render: 'controller.render.wolf',
    material: 'entity_alphatest',
    animations: 'none',
  },
  bear: {
    geometry: 'geometry.polarbear',
    texture: 'textures/entity/bear/polarbear',
    render: 'controller.render.polarbear',
    material: 'entity_alphatest',
    animations: 'none',
  },
  cow: {
    geometry: 'geometry.cow',
    texture: 'textures/entity/cow/cow',
    render: 'controller.render.cow',
    material: 'entity_alphatest',
    animations: 'none',
  },
  chicken: {
    geometry: 'geometry.chicken',
    texture: 'textures/entity/chicken',
    render: 'controller.render.chicken',
    material: 'entity_alphatest',
    animations: 'none',
  },
  villager: {
    geometry: 'geometry.villager_v2',
    texture: 'textures/entity/villager2/villager',
    render: 'controller.render.villager_v2',
    material: 'entity_alphatest',
    animations: 'none',
  },
  spider: {
    geometry: 'geometry.spider',
    texture: 'textures/entity/spider/spider',
    render: 'controller.render.spider',
    material: 'entity_alphatest',
    animations: 'none',
  },
}

export type LootProfile =
  | 'undead'
  | 'undead_elite'
  | 'beast'
  | 'livestock'
  | 'bird'
  | 'human'
  | 'military'
  | 'boss'
  | 'none'

export interface MobDef {
  /** Identifier suffix, e.g. `infected_dog` -> `<ns>:infected_dog`. */
  id: string
  name: string
  group: MobGroup
  role: string
  health: number
  speed: number
  damage: number
  scale: number
  width: number
  height: number
  accent: string
  visual: MobVisual
  hostile: boolean
  /** Spawns naturally through a spawn rule when true. */
  natural: boolean
  spawnWeight?: number
  herdMin?: number
  herdMax?: number
  loot: LootProfile
  /** Attacks the player from range (script raycast / projectile). */
  ranged?: boolean
  range?: number
  explodeOnDeath?: boolean
  summoner?: boolean
  revive?: boolean
  healer?: boolean
  leader?: boolean
  boss?: boolean
  /** Flat damage reduction 0..1, e.g. armored plating. */
  damageReduction?: number
  /** Immune to ranged/projectile damage. */
  arrowProof?: boolean
  nightOnly?: boolean
  /** Attacks other hostile packs on sight (guards, bandits vs zombies). */
  targetsZombies?: boolean
  /** Trades with the player on interaction. */
  trader?: boolean
  blurb: string
}

export const CREATURES: MobDef[] = [
  {
    id: 'infected_dog',
    name: 'Chien infecté',
    group: 'creature',
    role: 'Meute',
    health: 18,
    speed: 0.34,
    damage: 4,
    scale: 0.8,
    width: 0.6,
    height: 0.85,
    accent: '#a16207',
    visual: 'wolf',
    hostile: true,
    natural: true,
    spawnWeight: 24,
    herdMin: 2,
    herdMax: 4,
    loot: 'beast',
    blurb: 'Rapide, en meute, il encercle et mord les jambes.',
  },
  {
    id: 'infected_bear',
    name: 'Ours infecté',
    group: 'creature',
    role: 'Prédateur',
    health: 55,
    speed: 0.22,
    damage: 9,
    scale: 1.1,
    width: 1.2,
    height: 1.5,
    accent: '#78350f',
    visual: 'bear',
    hostile: true,
    natural: true,
    spawnWeight: 8,
    herdMin: 1,
    herdMax: 1,
    loot: 'beast',
    blurb: 'Une masse qui traverse les taillis et encaisse sans broncher.',
  },
  {
    id: 'infected_cow',
    name: 'Vache infectée',
    group: 'creature',
    role: 'Bétail',
    health: 30,
    speed: 0.18,
    damage: 4,
    scale: 1,
    width: 0.9,
    height: 1.4,
    accent: '#57534e',
    visual: 'cow',
    hostile: true,
    natural: true,
    spawnWeight: 12,
    herdMin: 2,
    herdMax: 3,
    loot: 'livestock',
    blurb: 'Lente mais increvable, elle bloque les couloirs.',
  },
  {
    id: 'infected_chicken',
    name: 'Poule infectée',
    group: 'creature',
    role: 'Nuée',
    health: 8,
    speed: 0.2,
    damage: 2,
    scale: 0.7,
    width: 0.4,
    height: 0.7,
    accent: '#ca8a04',
    visual: 'chicken',
    hostile: true,
    natural: true,
    spawnWeight: 14,
    herdMin: 3,
    herdMax: 5,
    loot: 'bird',
    blurb: 'Ridicule seule, dangereuse par dix.',
  },
  {
    id: 'infected_villager',
    name: 'Villageois infecté',
    group: 'creature',
    role: 'Converti',
    health: 24,
    speed: 0.24,
    damage: 3,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#15803d',
    visual: 'villager',
    hostile: true,
    natural: true,
    spawnWeight: 12,
    herdMin: 1,
    herdMax: 2,
    loot: 'undead',
    blurb: 'Le village est tombé. Il en reste des traces.',
  },
  {
    id: 'infected_swarm',
    name: 'Nuée grouillante',
    group: 'creature',
    role: 'Essaim',
    health: 14,
    speed: 0.3,
    damage: 3,
    scale: 0.9,
    width: 1.4,
    height: 0.9,
    accent: '#4d7c0f',
    visual: 'spider',
    hostile: true,
    natural: true,
    spawnWeight: 8,
    herdMin: 2,
    herdMax: 4,
    loot: 'beast',
    blurb: 'Sort des caves et des silos à grains.',
  },
]

export const HOSTILES: MobDef[] = [
  {
    id: 'bandit',
    name: 'Bandit',
    group: 'human',
    role: 'Pillard',
    health: 24,
    speed: 0.27,
    damage: 6,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#b45309',
    visual: 'zombie',
    hostile: true,
    natural: true,
    spawnWeight: 6,
    herdMin: 1,
    herdMax: 3,
    loot: 'human',
    blurb: 'Il ne veut pas ta mort, juste tout ce que tu portes.',
  },
  {
    id: 'raider',
    name: 'Pillard armé',
    group: 'human',
    role: 'Tireur',
    health: 28,
    speed: 0.26,
    damage: 7,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#9a3412',
    visual: 'husk',
    hostile: true,
    natural: true,
    spawnWeight: 5,
    herdMin: 1,
    herdMax: 2,
    loot: 'military',
    ranged: true,
    range: 34,
    blurb: 'Il tire une rafale puis recule. Ne reste pas à découvert.',
  },
  {
    id: 'sniper',
    name: 'Sniper',
    group: 'human',
    role: 'Tireur d’élite',
    health: 20,
    speed: 0.22,
    damage: 12,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#0f766e',
    visual: 'skeleton',
    hostile: true,
    natural: true,
    spawnWeight: 3,
    herdMin: 1,
    herdMax: 1,
    loot: 'military',
    ranged: true,
    range: 60,
    nightOnly: false,
    blurb: 'Perché, patient. Un coup, un mort.',
  },
]

export const NPCS: MobDef[] = [
  {
    id: 'survivor',
    name: 'Survivant',
    group: 'npc',
    role: 'Marchand',
    health: 30,
    speed: 0.22,
    damage: 2,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#0891b2',
    visual: 'villager',
    hostile: false,
    natural: true,
    spawnWeight: 6,
    herdMin: 1,
    herdMax: 2,
    loot: 'human',
    trader: true,
    blurb: 'Il troque du matériel contre ce que tu ramasses. Interagis avec lui.',
  },
  {
    id: 'guard',
    name: 'Garde du camp',
    group: 'npc',
    role: 'Milice',
    health: 40,
    speed: 0.26,
    damage: 7,
    scale: 1,
    width: 0.6,
    height: 1.95,
    accent: '#0369a1',
    visual: 'villager',
    hostile: false,
    natural: true,
    spawnWeight: 4,
    herdMin: 1,
    herdMax: 2,
    loot: 'military',
    ranged: true,
    range: 26,
    targetsZombies: true,
    blurb: 'Il défend le camp et abat les infectés à vue.',
  },
]

export const BOSSES: MobDef[] = [
  {
    id: 'titan',
    name: 'Le Titan',
    group: 'boss',
    role: 'Boss',
    health: 400,
    speed: 0.2,
    damage: 22,
    scale: 3,
    width: 2,
    height: 4.5,
    accent: '#991b1b',
    visual: 'zombie',
    hostile: true,
    natural: false,
    loot: 'boss',
    boss: true,
    damageReduction: 0.35,
    summoner: true,
    blurb: 'Trois étages de chair morte. Il brise les remparts et appelle sa cour.',
  },
  {
    id: 'behemoth',
    name: 'Le Béhémoth',
    group: 'boss',
    role: 'Boss',
    health: 600,
    speed: 0.16,
    damage: 30,
    scale: 4,
    width: 2.5,
    height: 5.5,
    accent: '#7f1d1d',
    visual: 'husk',
    hostile: true,
    natural: false,
    loot: 'boss',
    boss: true,
    damageReduction: 0.5,
    explodeOnDeath: true,
    blurb: 'Un char d’assaut organique. Meurs loin de lui.',
  },
  {
    id: 'queen',
    name: 'La Reine',
    group: 'boss',
    role: 'Boss',
    health: 300,
    speed: 0.24,
    damage: 16,
    scale: 2.4,
    width: 1.6,
    height: 3.6,
    accent: '#6d28d9',
    visual: 'piglin',
    hostile: true,
    natural: false,
    loot: 'boss',
    boss: true,
    summoner: true,
    healer: true,
    blurb: 'Elle impose la ruche : elle pond la horde et recolle ses sujets.',
  },
]

export const ALL_EXTRA_MOBS: MobDef[] = [...CREATURES, ...HOSTILES, ...NPCS, ...BOSSES]

export const MOB_BY_ID: Record<string, MobDef> = Object.fromEntries(
  ALL_EXTRA_MOBS.map((m) => [m.id, m]),
)

/** Adapt a zombie variant definition to the shared mob shape. */
export function variantToMob(def: VariantDef): MobDef {
  return {
    id: `zombie_${def.key}`,
    name: def.name,
    group: 'zombie',
    role: def.role,
    health: def.health,
    speed: def.speed,
    damage: def.damage,
    scale: def.scale,
    width: def.width,
    height: def.height,
    accent: def.accent,
    visual: 'zombie',
    hostile: true,
    natural: true,
    spawnWeight: def.spawnWeight,
    herdMin: def.herdMin,
    herdMax: def.herdMax,
    loot: def.tier === 1 ? 'undead' : 'undead_elite',
    ranged: def.key === 'spitter',
    range: 22,
    explodeOnDeath: def.key === 'bloater',
    summoner: def.key === 'screamer' || def.key === 'necromancer',
    revive: def.key === 'necromancer',
    healer: def.key === 'nurse',
    leader: def.key === 'alpha',
    damageReduction:
      def.key === 'armored' ? 0.6 : def.key === 'hulk' ? 0.4 : def.key === 'juggernaut' ? 0.3 : 0,
    arrowProof: def.key === 'armored',
    blurb: def.blurb,
  }
}
