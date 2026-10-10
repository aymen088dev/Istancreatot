import { sourceMap } from './assets'
import type { Intensity, MechanicKey, PackConfig, VariantKey } from './types'

export interface VariantDef {
  key: VariantKey
  name: string
  role: string
  blurb: string
  health: number
  speed: number
  damage: number
  scale: number
  width: number
  height: number
  spawnWeight: number
  herdMin: number
  herdMax: number
  accent: string
  tier: 1 | 2 | 3
  abilities: string[]
}

export const VARIANT_DEFS: VariantDef[] = [
  {
    key: 'walker',
    name: 'Rôdeur',
    role: 'Walker',
    blurb: 'Le troupeau de base. Lent, tenace, il arrive en grand nombre et ne lâche jamais.',
    health: 22,
    speed: 0.2,
    damage: 3,
    scale: 1,
    width: 0.6,
    height: 1.95,
    spawnWeight: 60,
    herdMin: 2,
    herdMax: 4,
    accent: '#84cc16',
    tier: 1,
    abilities: ['Infection par morsure'],
  },
  {
    key: 'runner',
    name: 'Coureur',
    role: 'Runner',
    blurb: 'Frais et affamé. Beaucoup plus rapide qu’un survivant, mais fragile.',
    health: 14,
    speed: 0.33,
    damage: 2.5,
    scale: 0.95,
    width: 0.6,
    height: 1.9,
    spawnWeight: 32,
    herdMin: 1,
    herdMax: 3,
    accent: '#f59e0b',
    tier: 1,
    abilities: ['Sprint permanent'],
  },
  {
    key: 'crawler',
    name: 'Rampant',
    role: 'Crawler',
    blurb: 'Rampe au sol, se glisse sous les barricades et mord les chevilles. Difficile à viser.',
    health: 12,
    speed: 0.13,
    damage: 5,
    scale: 0.6,
    width: 0.6,
    height: 1.1,
    spawnWeight: 18,
    herdMin: 1,
    herdMax: 2,
    accent: '#a3a3a3',
    tier: 1,
    abilities: ['Passe sous les barricades'],
  },
  {
    key: 'leaper',
    name: 'Bondisseur',
    role: 'Leaper',
    blurb: 'Il bondit par-dessus les remparts et retombe sur toi. Les murs seuls ne suffisent plus.',
    health: 18,
    speed: 0.28,
    damage: 4,
    scale: 1,
    width: 0.6,
    height: 1.9,
    spawnWeight: 14,
    herdMin: 1,
    herdMax: 2,
    accent: '#22d3ee',
    tier: 2,
    abilities: ['Saut de 4 blocs'],
  },
  {
    key: 'brute',
    name: 'Brute',
    role: 'Brute',
    blurb: 'Masse osseuse. Énorme réserve de vie, frappe comme un camion, résiste au recul.',
    health: 70,
    speed: 0.17,
    damage: 10,
    scale: 1.4,
    width: 0.9,
    height: 2.4,
    spawnWeight: 8,
    herdMin: 1,
    herdMax: 1,
    accent: '#b91c1c',
    tier: 2,
    abilities: ['Résistance au recul'],
  },
  {
    key: 'bloater',
    name: 'Boursouflé',
    role: 'Bloater',
    blurb: 'Chargé de gaz. Explose à sa mort et souffle tout ce qui traîne autour.',
    health: 34,
    speed: 0.15,
    damage: 4,
    scale: 1.15,
    width: 0.7,
    height: 2.1,
    spawnWeight: 10,
    herdMin: 1,
    herdMax: 2,
    accent: '#65a30d',
    tier: 2,
    abilities: ['Explosion en mourant'],
  },
  {
    key: 'screamer',
    name: 'Hurleur',
    role: 'Screamer',
    blurb: 'Un cri et la horde converge. Priorité absolue : l’abattre avant qu’il ne te repère.',
    health: 26,
    speed: 0.26,
    damage: 2,
    scale: 1,
    width: 0.6,
    height: 1.95,
    spawnWeight: 6,
    herdMin: 1,
    herdMax: 1,
    accent: '#7c3aed',
    tier: 2,
    abilities: ['Appelle la horde'],
  },
  {
    key: 'spitter',
    name: 'Cracheur',
    role: 'Spitter',
    blurb: 'Il t’arrose d’acide à distance. L’arme de siège des infectés.',
    health: 20,
    speed: 0.19,
    damage: 3,
    scale: 1,
    width: 0.6,
    height: 1.95,
    spawnWeight: 8,
    herdMin: 1,
    herdMax: 2,
    accent: '#16a34a',
    tier: 2,
    abilities: ['Jet d’acide à distance'],
  },
  {
    key: 'bomber',
    name: 'Bombeur',
    role: 'Bomber',
    blurb: 'Il lance de la dynamite sur ta base. Les murs deviennent sa cible favorite.',
    health: 24,
    speed: 0.2,
    damage: 3,
    scale: 1.05,
    width: 0.6,
    height: 1.95,
    spawnWeight: 6,
    herdMin: 1,
    herdMax: 2,
    accent: '#dc2626',
    tier: 2,
    abilities: ['Lance de la dynamite'],
  },
  {
    key: 'stalker',
    name: 'Traqueur',
    role: 'Stalker',
    blurb: 'Silencieux, presque invisible la nuit. Il ne te lâche plus une fois qu’il t’a flairé.',
    health: 30,
    speed: 0.3,
    damage: 6,
    scale: 1.05,
    width: 0.6,
    height: 1.95,
    spawnWeight: 5,
    herdMin: 1,
    herdMax: 1,
    accent: '#6b7280',
    tier: 3,
    abilities: ['Invisibilité nocturne', 'Poursuite sans fin'],
  },
  {
    key: 'armored',
    name: 'Cuirassé',
    role: 'Armored',
    blurb: 'Ancien soldat. Les plaques de gilet encaissent la plupart des coups de lame.',
    health: 45,
    speed: 0.18,
    damage: 7,
    scale: 1.1,
    width: 0.7,
    height: 2.05,
    spawnWeight: 6,
    herdMin: 1,
    herdMax: 2,
    accent: '#475569',
    tier: 3,
    abilities: ['Réduction des dégâts 60 %', 'Immunisé aux flèches'],
  },
  {
    key: 'nurse',
    name: 'Infirmière',
    role: 'Nurse',
    blurb: 'Elle soigne les autres infectés. Tant qu’elle vit, la horde ne meurt jamais vraiment.',
    health: 28,
    speed: 0.22,
    damage: 2,
    scale: 1,
    width: 0.6,
    height: 1.95,
    spawnWeight: 4,
    herdMin: 1,
    herdMax: 1,
    accent: '#f472b6',
    tier: 3,
    abilities: ['Soigne les zombies proches'],
  },
  {
    key: 'juggernaut',
    name: 'Colosse',
    role: 'Juggernaut',
    blurb: 'Deux mètres soixante de muscle mort. Il enfonce les portes et ignore tes barricades.',
    health: 120,
    speed: 0.15,
    damage: 14,
    scale: 1.7,
    width: 1.1,
    height: 2.8,
    spawnWeight: 2,
    herdMin: 1,
    herdMax: 1,
    accent: '#7f1d1d',
    tier: 3,
    abilities: ['Casse les blocs', 'Coup de grâce'],
  },
  {
    key: 'hulk',
    name: 'Mastodonte',
    role: 'Hulk',
    blurb: 'Le pire cas de mutation. Presque impossible à tuer sans arme lourde.',
    health: 180,
    speed: 0.13,
    damage: 18,
    scale: 2,
    width: 1.3,
    height: 3.2,
    spawnWeight: 1,
    herdMin: 1,
    herdMax: 1,
    accent: '#450a0a',
    tier: 3,
    abilities: ['Armure épaisse', 'Souffle destructeur'],
  },
  {
    key: 'necromancer',
    name: 'Nécromancien',
    role: 'Necromancer',
    blurb: 'Il relève les cadavres autour de lui. Tuer sans brûler le corps ne sert à rien.',
    health: 60,
    speed: 0.2,
    damage: 5,
    scale: 1.1,
    width: 0.7,
    height: 2.05,
    spawnWeight: 2,
    herdMin: 1,
    herdMax: 1,
    accent: '#4c1d95',
    tier: 3,
    abilities: ['Relève les morts'],
  },
  {
    key: 'alpha',
    name: 'Alpha',
    role: 'Alpha',
    blurb: 'Le meneur. Sa présence accélère et renforce toute la horde autour de lui.',
    health: 90,
    speed: 0.22,
    damage: 9,
    scale: 1.5,
    width: 1,
    height: 2.6,
    spawnWeight: 2,
    herdMin: 1,
    herdMax: 1,
    accent: '#c2410c',
    tier: 3,
    abilities: ['Buff de horde', 'Renforce les alliés'],
  },
]

export const VARIANT_BY_KEY: Record<VariantKey, VariantDef> = Object.fromEntries(
  VARIANT_DEFS.map((d) => [d.key, d]),
) as Record<VariantKey, VariantDef>

export interface MechanicDef {
  key: MechanicKey
  name: string
  blurb: string
  scripted: boolean
  category: 'Combat' | 'Survie' | 'Base' | 'Monde' | 'Équipement'
}

export const MECHANIC_DEFS: MechanicDef[] = [
  {
    key: 'infection',
    name: 'Infection',
    blurb: 'Chaque morsure injecte du poison. Soigne-toi ou meurs lentement.',
    scripted: true,
    category: 'Survie',
  },
  {
    key: 'bleeding',
    name: 'Hémorragie',
    blurb: 'Les griffes ouvrent des plaies qui saignent tant qu’on n’a pas été pansé.',
    scripted: true,
    category: 'Survie',
  },
  {
    key: 'hordeNight',
    name: 'Nuits de horde',
    blurb: 'La menace monte chaque jour. Plus tu survis, plus la nuit est lourde.',
    scripted: true,
    category: 'Monde',
  },
  {
    key: 'bloodMoon',
    name: 'Lune rouge',
    blurb: 'Certaines nuits, le ciel vire au sang : vagues massives et zombies renforcés.',
    scripted: true,
    category: 'Monde',
  },
  {
    key: 'noise',
    name: 'Le bruit attire',
    blurb: 'Le hochet, le générateur et les coups de feu rameutent tout ce qui traîne.',
    scripted: true,
    category: 'Combat',
  },
  {
    key: 'scarceLoot',
    name: 'Butin rare',
    blurb: 'Le loot se raréfie : moins de ressources, plus de choix déchirants.',
    scripted: false,
    category: 'Monde',
  },
  {
    key: 'barricades',
    name: 'Barricades',
    blurb: 'Un kit qui érige d’un coup un rempart de palissades autour de toi.',
    scripted: true,
    category: 'Base',
  },
  {
    key: 'baseBuilding',
    name: 'Construction de base',
    blurb: 'Murs béton, sacs de sable, barbelés, planches clouées : bâtis une vraie base.',
    scripted: false,
    category: 'Base',
  },
  {
    key: 'medkits',
    name: 'Médical complet',
    blurb: 'Bandages, pansements compressifs, trousses, antiviral, adrénaline, attelles.',
    scripted: true,
    category: 'Survie',
  },
  {
    key: 'thirst',
    name: 'Soif',
    blurb: 'Il faut boire. L’eau sale rend malade, l’eau purifiée non.',
    scripted: true,
    category: 'Survie',
  },
  {
    key: 'molotov',
    name: 'Projectiles',
    blurb: 'Cocktails molotov, grenades à fragmentation et fumigènes.',
    scripted: true,
    category: 'Équipement',
  },
  {
    key: 'traps',
    name: 'Pièges',
    blurb: 'Pieux à zombies et mines terrestres : laisse la horde se détruire toute seule.',
    scripted: true,
    category: 'Base',
  },
  {
    key: 'firearms',
    name: 'Armes à feu 3D',
    blurb:
      'Pistolet, PM, fusil à pompe, fusil d’assaut, précision, mitrailleuse et lance-grenades en 3D.',
    scripted: true,
    category: 'Équipement',
  },
  {
    key: 'meleeWeapons',
    name: 'Armes de corps à corps',
    blurb: 'Machette, batte cloutée, hache, katana, masse, pied-de-biche, lance et couteau.',
    scripted: true,
    category: 'Équipement',
  },
  {
    key: 'armor',
    name: 'Armures 3D',
    blurb: 'Quatre sets visibles sur le corps : anti-émeute, tactique, Hazmat et fortune.',
    scripted: true,
    category: 'Équipement',
  },
  {
    key: 'infectedFauna',
    name: 'Faune infectée',
    blurb: 'Chiens, ours, vaches, poules et villageois malades : la campagne devient hostile.',
    scripted: false,
    category: 'Monde',
  },
  {
    key: 'hostiles',
    name: 'Bandits & pillards',
    blurb: 'Des survivants devenus prédateurs, armés. Ils tirent avant de parler.',
    scripted: true,
    category: 'Combat',
  },
  {
    key: 'survivors',
    name: 'PNJ survivants',
    blurb: 'Des PNJ amicaux qui troquent du matériel et se battent contre la horde.',
    scripted: true,
    category: 'Monde',
  },
  {
    key: 'bosses',
    name: 'Boss',
    blurb: 'Titan, Béhémoth et Reine : des affrontements à barre de vie, la nuit.',
    scripted: true,
    category: 'Combat',
  },
  {
    key: 'turrets',
    name: 'Tourelles & générateurs',
    blurb: 'Des tourelles automatiques alimentées par un générateur qui défendent ta base.',
    scripted: true,
    category: 'Base',
  },
  {
    key: 'airdrops',
    name: 'Largages aériens',
    blurb: 'Des caisses de ravitaillement tombent régulièrement avec du bon matériel.',
    scripted: true,
    category: 'Monde',
  },
  {
    key: 'structures',
    name: 'Structures abandonnées',
    blurb: 'Maisons en ruine, checkpoints, hôpitaux, stations-service et camps à piller.',
    scripted: true,
    category: 'Monde',
  },
]

export const MECHANIC_BY_KEY: Record<MechanicKey, MechanicDef> = Object.fromEntries(
  MECHANIC_DEFS.map((d) => [d.key, d]),
) as Record<MechanicKey, MechanicDef>

export const INTENSITY_LABELS: Record<Intensity, { name: string; blurb: string }> = {
  1: { name: 'Survivant', blurb: 'Hordes modérées, répit entre les vagues.' },
  2: { name: 'Vétéran', blurb: 'Pression constante, nuit redoutable.' },
  3: { name: 'Cauchemar', blurb: 'Détection étendue, vagues impitoyables. Aucun répit.' },
}

function variantMap(value: boolean): Record<VariantKey, boolean> {
  return VARIANT_DEFS.reduce(
    (acc, v) => ({ ...acc, [v.key]: value }),
    {} as Record<VariantKey, boolean>,
  )
}

function mechanicMap(value: boolean): Record<MechanicKey, boolean> {
  return MECHANIC_DEFS.reduce(
    (acc, m) => ({ ...acc, [m.key]: value }),
    {} as Record<MechanicKey, boolean>,
  )
}

export const ALL_VARIANTS_ON: Record<VariantKey, boolean> = variantMap(true)
export const ALL_VARIANTS_OFF: Record<VariantKey, boolean> = variantMap(false)
export const ALL_MECHANICS_ON: Record<MechanicKey, boolean> = mechanicMap(true)
export const ALL_MECHANICS_OFF: Record<MechanicKey, boolean> = mechanicMap(false)
export const ALL_SOURCES_ON = sourceMap(true)
export const ALL_SOURCES_OFF = sourceMap(false)

export const DEFAULT_CONFIG: PackConfig = {
  packName: 'Remnant Apocalypse',
  namespace: 'remnant',
  author: 'REMNANT',
  intensity: 2,
  sunImmune: true,
  variants: { ...ALL_VARIANTS_ON },
  mechanics: { ...ALL_MECHANICS_ON },
  sources: { ...ALL_SOURCES_ON },
}

export function enabledVariants(cfg: PackConfig): VariantDef[] {
  return VARIANT_DEFS.filter((d) => cfg.variants[d.key])
}

export function enabledMechanics(cfg: PackConfig): MechanicDef[] {
  return MECHANIC_DEFS.filter((d) => cfg.mechanics[d.key])
}

/** Rough estimate of the tuning knobs derived from the intensity level. */
export function intensityTuning(intensity: Intensity) {
  return {
    1: {
      detect: 24,
      hordeEveryDay: 3,
      maxPerPlayer: 5,
      infectionTicks: 120,
      bleedingTicks: 40,
      bossDay: 12,
      airdropDays: 4,
    },
    2: {
      detect: 30,
      hordeEveryDay: 2,
      maxPerPlayer: 9,
      infectionTicks: 180,
      bleedingTicks: 60,
      bossDay: 8,
      airdropDays: 3,
    },
    3: {
      detect: 40,
      hordeEveryDay: 1,
      maxPerPlayer: 14,
      infectionTicks: 260,
      bleedingTicks: 90,
      bossDay: 5,
      airdropDays: 2,
    },
  }[intensity]
}
