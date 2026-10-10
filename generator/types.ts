import type { SourceKey } from './assets'

export type VariantKey =
  | 'walker'
  | 'runner'
  | 'crawler'
  | 'leaper'
  | 'brute'
  | 'bloater'
  | 'screamer'
  | 'spitter'
  | 'bomber'
  | 'stalker'
  | 'armored'
  | 'nurse'
  | 'juggernaut'
  | 'hulk'
  | 'necromancer'
  | 'alpha'

export type MechanicKey =
  | 'infection'
  | 'bleeding'
  | 'hordeNight'
  | 'bloodMoon'
  | 'noise'
  | 'scarceLoot'
  | 'barricades'
  | 'baseBuilding'
  | 'medkits'
  | 'thirst'
  | 'molotov'
  | 'traps'
  | 'firearms'
  | 'meleeWeapons'
  | 'armor'
  | 'infectedFauna'
  | 'hostiles'
  | 'survivors'
  | 'bosses'
  | 'turrets'
  | 'airdrops'
  | 'structures'

/** 1 = survivable, 2 = hard, 3 = nightmare */
export type Intensity = 1 | 2 | 3

export interface PackConfig {
  /** Display name of the fused pack. */
  packName: string
  /** Identifier namespace, e.g. `remnant` -> `remnant:zombie_walker`. */
  namespace: string
  author: string
  intensity: Intensity
  /** Custom zombies ignore sunlight so the apocalypse never "sleeps". */
  sunImmune: boolean
  variants: Record<VariantKey, boolean>
  mechanics: Record<MechanicKey, boolean>
  /** Donor packs whose structures and sounds are imported into the build. */
  sources: Record<SourceKey, boolean>
}

export interface GeneratedFile {
  path: string
  content: string | Uint8Array
}

export interface PackContents {
  behavior: GeneratedFile[]
  resource: GeneratedFile[]
}

export interface BuildResult {
  blob: Blob
  fileName: string
  fileCount: number
  byteSize: number
}
