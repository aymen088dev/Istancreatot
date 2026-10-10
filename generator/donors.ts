import { existsSync, readFileSync } from 'node:fs'
import type { GeneratedFile } from './types'

/**
 * Donor fusion payload.
 *
 * `scripts/harvest-armor.ts` extracts the donor armour (items, icons, worn
 * attachables, geometry, animations, render controllers, self-contained
 * recipes) into `public/harvest/donors/` and describes it in `manifest.json`.
 * This module turns that description back into files for the generated pack.
 */

export interface DonorManifest {
  version: number
  generated: string
  note: string
  sources: {
    key: string
    label: string
    items: number
    files: number
    bytes: number
    modernisedSlots: number
    skipped: string[]
  }[]
  items: {
    identifier: string
    displayName: string
    slot: string
    protection: number
    durability: number
    iconKey: string | null
    iconPath: string | null
    source: string
  }[]
  files: { path: string; side: 'bp' | 'rp' }[]
  itemTextureEntries: Record<string, string>
  lang: Record<string, string>
}

export interface DonorPayload {
  behavior: GeneratedFile[]
  resource: GeneratedFile[]
  itemTextureEntries: Record<string, string>
  lang: Record<string, string>
  items: DonorManifest['items']
  sources: DonorManifest['sources']
  fileCount: number
}

export const DONOR_ROOT = 'public/harvest/donors'

export function emptyDonors(): DonorPayload {
  return {
    behavior: [],
    resource: [],
    itemTextureEntries: {},
    lang: {},
    items: [],
    sources: [],
    fileCount: 0,
  }
}

/** Reads the harvest output from disk. Returns an empty payload when absent. */
export function loadDonors(root = DONOR_ROOT): DonorPayload {
  const manifestPath = `${root}/manifest.json`
  if (!existsSync(manifestPath)) return emptyDonors()

  let manifest: DonorManifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as DonorManifest
  } catch {
    return emptyDonors()
  }
  if (manifest.version !== 2) {
    console.warn(`!! harvest version ${manifest.version} inattendue (2 attendue) — relance \`bun run pack:harvest\``)
    return emptyDonors()
  }

  const payload = emptyDonors()
  payload.itemTextureEntries = manifest.itemTextureEntries ?? {}
  payload.lang = manifest.lang ?? {}
  payload.items = manifest.items ?? []
  payload.sources = manifest.sources ?? []

  for (const entry of manifest.files ?? []) {
    const full = `${root}/${entry.path}`
    if (!existsSync(full)) continue
    const file: GeneratedFile = { path: entry.path, content: readFileSync(full) }
    if (entry.side === 'bp') payload.behavior.push(file)
    else payload.resource.push(file)
    payload.fileCount++
  }

  return payload
}
