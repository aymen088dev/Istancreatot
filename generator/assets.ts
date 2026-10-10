import { readFileSync } from 'node:fs'

export type SourceKey =
  | 'deadzone'
  | 'true_survival'
  | 'rza'
  | 'aplok_guns'
  | 'project_walker'
  | 'dyingdayz'
  | 'hundred_days'

export interface SourceDef {
  key: SourceKey
  label: string
  author: string
  /** What the import pulls out of this pack. */
  provides: string[]
}

export const SOURCE_DEFS: SourceDef[] = [
  {
    key: 'deadzone',
    label: 'DeadZone',
    author: 'N_z',
    provides: ['Structures de ville', 'Sons de véhicules', 'Ambiance'],
  },
  {
    key: 'true_survival',
    label: 'True Survival [MobBlocks]',
    author: 'Four Worlds Studios',
    provides: ['Bâtiments détaillés', 'Cris d’animaux infectés'],
  },
  {
    key: 'rza',
    label: 'RZA Structures',
    author: 'Raboy13',
    provides: ['Maisons', 'Segments de colonie'],
  },
  {
    key: 'aplok_guns',
    label: 'Aplok Guns',
    author: 'Aplok',
    provides: ['Sons d’armes à feu', 'Mur militaire'],
  },
  {
    key: 'project_walker',
    label: 'Project Walker',
    author: 'GabrielAplok',
    provides: ['Structures abandonnées', 'Impacts'],
  },
  {
    key: 'dyingdayz',
    label: 'DyingDayZ',
    author: 'Communauté',
    provides: ['Bâtiments', 'Ambiance météo'],
  },
  {
    key: 'hundred_days',
    label: 'One Hundred Days Later',
    author: 'Spartan Studios',
    provides: ['Petites structures', 'Sons d’infectés'],
  },
]

export const SOURCE_KEYS: SourceKey[] = SOURCE_DEFS.map((s) => s.key)

export const SOURCE_BY_KEY: Record<SourceKey, SourceDef> = Object.fromEntries(
  SOURCE_DEFS.map((s) => [s.key, s]),
) as Record<SourceKey, SourceDef>

export function sourceMap(value: boolean): Record<SourceKey, boolean> {
  return SOURCE_DEFS.reduce(
    (acc, s) => ({ ...acc, [s.key]: value }),
    {} as Record<SourceKey, boolean>,
  )
}

export interface AssetFile {
  file: string
  name: string
  size: number
}

export interface SourceAssets {
  key: string
  label: string
  structures: AssetFile[]
  sounds: Record<string, AssetFile[]>
  structureBytes: number
  soundBytes: number
  skippedStructures: number
}

export interface AssetManifest {
  generated: string
  note: string
  sources: SourceAssets[]
}

/** Disk path of the extracted donor structures/sounds. */
export const ASSET_ROOT = 'public/sourcepacks'

/** Reads one file from the donor asset root. Returns null when unavailable. */
export type AssetLoader = (path: string) => Promise<Uint8Array | null>

/** Reads assets straight off disk; used by the CLI builders. */
export function diskAssetLoader(root: string): AssetLoader {
  return async (path: string) => {
    try {
      return new Uint8Array(readFileSync(`${root}/${path}`))
    } catch {
      return null
    }
  }
}

export async function loadManifest(loader: AssetLoader): Promise<AssetManifest | null> {
  const bytes = await loader('manifest.json')
  if (!bytes) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as AssetManifest
    if (!parsed || !Array.isArray(parsed.sources)) return null
    return parsed
  } catch {
    return null
  }
}

export function selectedSourceKeys(
  sources: Partial<Record<SourceKey, boolean>> | undefined,
): SourceKey[] {
  if (!sources) return []
  return SOURCE_KEYS.filter((key) => sources[key])
}


