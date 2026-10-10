import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'

const ROOT = 'public/sourcepacks'
const MAX_STRUCTURE_BYTES = 400 * 1024
const MAX_STRUCTURES_PER_SOURCE = 16
const MAX_TOTAL_STRUCTURE_BYTES = 8 * 1024 * 1024
const MAX_SOUND_BYTES = 220 * 1024
const MAX_SOUNDS_PER_EVENT = 6
const MAX_TOTAL_SOUND_BYTES = 3 * 1024 * 1024

interface SourceDef {
  key: string
  label: string
  archive: string
}

const SOURCES: SourceDef[] = [
  { key: 'deadzone', label: 'DeadZone (N_z)', archive: 'V1.6.6-1DeadZone.mcaddon' },
  { key: 'true_survival', label: 'True Survival [MobBlocks]', archive: 'True Survival - Zombie Apocalypse (V0.0.4).mcaddon' },
  { key: 'rza', label: "RZA Structures (Raboy13)", archive: 'RZA Structures v1.2.21.mcpack' },
  { key: 'aplok_guns', label: 'Aplok Guns', archive: 'Aplok Guns BP-v1.8.8.mcaddon' },
  { key: 'project_walker', label: 'Project Walker', archive: 'Project-Walker-1.8.13.mcaddon' },
  { key: 'dyingdayz', label: 'DyingDayZ', archive: 'DyingDayZ.mcaddon' },
  { key: 'hundred_days', label: 'One Hundred Days Later', archive: 'zombie_apocalypse.mcaddon' },
]

interface Picked {
  file: string
  name: string
  size: number
}

interface Entry {
  path: string
  size: number
  entry: JSZip.JSZipObject
}

async function collectEntries(buf: Uint8Array, depth: number, acc: Entry[]): Promise<void> {
  const zip = await JSZip.loadAsync(buf)
  for (const item of Object.values(zip.files)) {
    if (item.dir) continue
    if (/\.(mcpack|mcaddon|zip)$/i.test(item.name) && depth < 2) {
      const inner = await item.async('uint8array')
      await collectEntries(inner, depth + 1, acc)
      continue
    }
    const size = (item as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    acc.push({ path: item.name, size, entry: item })
  }
}

const STRUCTURE_KEYWORDS = [
  'house', 'home', 'cabin', 'camp', 'gas', 'station', 'hospital', 'clinic', 'military',
  'checkpoint', 'tower', 'factory', 'shop', 'store', 'school', 'church', 'barn',
  'warehouse', 'bunker', 'police', 'office', 'apartment', 'ruin', 'rubble', 'tent',
  'base', 'outpost', 'lab', 'motel', 'market', 'shelter', 'well', 'caravan', 'car_park',
  'lighthouse', 'building', 'settlement', 'wall',
]

const SOUND_EVENTS: { key: string; keywords: string[] }[] = [
  { key: 'gunshot', keywords: ['shot', 'gun', 'rifle', 'pistol', 'sniper', 'bullet', 'fire', 'shoot', 'shotgun', 'machinegun', 'reload'] },
  { key: 'growl', keywords: ['zombie', 'infected', 'growl', 'groan', 'scream', 'screech', 'undead', 'bite', 'howl'] },
  { key: 'impact', keywords: ['hit', 'impact', 'flesh', 'punch', 'stab', 'slash', 'hurt', 'blood'] },
  { key: 'ambience', keywords: ['ambient', 'wind', 'drone', 'horror', 'dark', 'cave'] },
]

function hash4(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  return h.toString(36).slice(-4)
}

/**
 * Two originals can share a basename (e.g. `animal/hurt1.ogg` and
 * `impact/hurt1.ogg`). Suffix a short hash of the full path so every entry
 * maps to its own output file instead of overwriting a sibling.
 */
function uniqueName(base: string, fullPath: string, used: Set<string>): string {
  let name = base
  if (used.has(name)) name = `${base}_${hash4(fullPath)}`
  let attempt = 1
  while (used.has(name)) name = `${base}_${hash4(fullPath)}${attempt++}`
  used.add(name)
  return name
}

function score(path: string): number {
  const lower = path.toLowerCase()
  let value = 0
  for (const keyword of STRUCTURE_KEYWORDS) {
    if (lower.includes(keyword)) value += 10
  }
  // Prefer the "updated"/named folders over raw rock props.
  if (/rock|bush|tree|grass|flower|ore|prop|decor/i.test(lower)) value -= 25
  return value
}

rmSync(ROOT, { recursive: true, force: true })
mkdirSync(ROOT, { recursive: true })

interface SourceReport {
  key: string
  label: string
  structures: Picked[]
  sounds: Record<string, Picked[]>
  structureBytes: number
  soundBytes: number
  skippedStructures: number
}

let totalStructureBytes = 0
let totalSoundBytes = 0
const reports: SourceReport[] = []

for (const source of SOURCES) {
  let entries: Entry[] = []
  try {
    entries = []
    await collectEntries(readFileSync(source.archive), 0, entries)
  } catch (e) {
    console.log(`!! ${source.archive}: ${(e as Error).message}`)
    continue
  }

  const structures = entries
    .filter((e) => e.path.toLowerCase().endsWith('.mcstructure'))
    .filter((e) => e.size > 0 && e.size <= MAX_STRUCTURE_BYTES)
    .sort((a, b) => score(b.path) - score(a.path) || b.size - a.size)
    .slice(0, MAX_STRUCTURES_PER_SOURCE)

  const picked: Picked[] = []
  const usedStructureNames = new Set<string>()
  let structureBytes = 0
  for (const entry of structures) {
    if (totalStructureBytes + structureBytes + entry.size > MAX_TOTAL_STRUCTURE_BYTES) continue
    const base = entry.path
      .slice(entry.path.lastIndexOf('/') + 1)
      .replace(/\.mcstructure$/i, '')
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .toLowerCase()
    const name = uniqueName(`${source.key}_${base}`, entry.path, usedStructureNames)
    const rel = `structures/${source.key}/${name}.mcstructure`
    const bytes = await entry.entry.async('uint8array')
    const out = `${ROOT}/${rel}`
    mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true })
    writeFileSync(out, bytes)
    structureBytes += bytes.length
    picked.push({ file: rel, name, size: bytes.length })
  }
  totalStructureBytes += structureBytes

  const oggs = entries.filter((e) => {
    const lower = e.path.toLowerCase()
    const isSound = lower.endsWith('.ogg') || lower.endsWith('.fsb')
    return isSound && e.size > 0 && e.size <= MAX_SOUND_BYTES
  })
  const sounds: Record<string, Picked[]> = {}
  const usedSoundNames = new Set<string>()
  let soundBytes = 0
  for (const event of SOUND_EVENTS) {
    const matches = oggs
      .filter((e) => event.keywords.some((k) => e.path.toLowerCase().includes(k)))
      .sort((a, b) => a.size - b.size)
      .slice(0, MAX_SOUNDS_PER_EVENT)
    const list: Picked[] = []
    for (const entry of matches) {
      if (totalSoundBytes + soundBytes + entry.size > MAX_TOTAL_SOUND_BYTES) break
      const ext = entry.path.toLowerCase().endsWith('.fsb') ? 'fsb' : 'ogg'
      const base = entry.path
        .slice(entry.path.lastIndexOf('/') + 1)
        .replace(/\.(ogg|fsb)$/i, '')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .toLowerCase()
      const name = uniqueName(`${source.key}_${event.key}_${base}`, entry.path, usedSoundNames)
      const rel = `sounds/${source.key}/${name}.${ext}`
      const bytes = await entry.entry.async('uint8array')
      const out = `${ROOT}/${rel}`
      mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true })
      writeFileSync(out, bytes)
      soundBytes += bytes.length
      list.push({ file: rel, name, size: bytes.length })
    }
    if (list.length > 0) sounds[event.key] = list
  }
  totalSoundBytes += soundBytes

  const allStructures = entries.filter((e) => e.path.toLowerCase().endsWith('.mcstructure')).length

  reports.push({
    key: source.key,
    label: source.label,
    structures: picked,
    sounds,
    structureBytes,
    soundBytes,
    skippedStructures: allStructures - picked.length,
  })
}

const manifest = {
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Structures et sons extraits des packs sources déposés dans le dépôt. ' +
    'Les fichiers restent la propriété de leurs auteurs.',
  sources: reports.map((r) => ({
    key: r.key,
    label: r.label,
    structures: r.structures,
    sounds: r.sounds,
    structureBytes: r.structureBytes,
    soundBytes: r.soundBytes,
    skippedStructures: r.skippedStructures,
  })),
}

writeFileSync(`${ROOT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

for (const r of reports) {
  const soundCount = Object.values(r.sounds).reduce((s, l) => s + l.length, 0)
  console.log(
    `${r.key}: ${r.structures.length} structures (${(r.structureBytes / 1024).toFixed(0)} Ko, ${r.skippedStructures} écartées) · ${soundCount} sons (${(r.soundBytes / 1024).toFixed(0)} Ko)`,
  )
}
console.log(
  `TOTAL: ${(totalStructureBytes / 1048576).toFixed(1)} Mo structures, ${(totalSoundBytes / 1048576).toFixed(1)} Mo sons`,
)
