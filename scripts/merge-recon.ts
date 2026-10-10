/**
 * Reconnaissance for a full donor merge.
 *
 * Walks every donor archive in the repository root, recursively through nested
 * `.mcaddon` / `.mcpack` / `.zip` containers, and reports:
 *
 *   - how many files each archive holds and in which category
 *   - exact duplicates (identical sha256 seen in more than one archive)
 *   - resource-path collisions (same logical path, different content)
 *   - identifier collisions (same `identifier` JSON field in more than one archive)
 *   - each archive's manifest (min_engine_version, script module version)
 *   - the scripts each archive ships
 *
 * Usage: bun run scripts/merge-recon.ts
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'

/** Folders that identify the root of a pack, used to strip the pack prefix. */
const ROOTS = [
  'items', 'item', 'textures', 'attachables', 'models', 'entity', 'entities',
  'render_controllers', 'animations', 'animation_controllers', 'particles',
  'sounds', 'ui', 'blocks', 'spawn_rules', 'loot_tables', 'recipes', 'trading',
  'scripts', 'functions', 'texts', 'materials', 'font', 'worldgen',
  'structures', 'features', 'feature_rules',
]

const BP_ROOTS = new Set([
  'items', 'item', 'entities', 'blocks', 'spawn_rules', 'loot_tables',
  'recipes', 'trading', 'scripts', 'functions', 'structures', 'features',
  'feature_rules', 'worldgen',
])

export interface FileEntry {
  path: string
  logical: string
  side: 'bp' | 'rp' | '?'
  size: number
  hash: string
}

function logicalPath(path: string): string {
  const parts = path.split('/')
  for (let i = 0; i < parts.length; i++) {
    if (ROOTS.includes(parts[i])) return parts.slice(i).join('/')
  }
  return path
}

function sideOf(logical: string): 'bp' | 'rp' | '?' {
  const root = logical.split('/')[0]
  if (BP_ROOTS.has(root)) return 'bp'
  if (ROOTS.includes(root)) return 'rp'
  return '?'
}

async function collect(buf: Uint8Array, depth: number, acc: FileEntry[]): Promise<void> {
  const zip = await JSZip.loadAsync(buf)
  for (const item of Object.values(zip.files)) {
    if (item.dir) continue
    if (/\.(mcpack|mcaddon|zip)$/i.test(item.name) && depth < 2) {
      await collect(await item.async('uint8array'), depth + 1, acc)
      continue
    }
    const bytes = await item.async('uint8array')
    const logical = logicalPath(item.name)
    acc.push({
      path: item.name,
      logical,
      side: sideOf(logical),
      size: bytes.length,
      hash: createHash('sha256').update(bytes).digest('hex'),
    })
  }
}

/** Every `"identifier": "..."` value in a JSON document, without parsing. */
function identifiersIn(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(/"identifier"\s*:\s*"([^"]+)"/g)) out.push(match[1])
  return out
}

const archives = readdirSync('.').filter((f) => /\.(mcaddon|mcpack)$/i.test(f)).sort()

interface ArchiveInfo {
  archive: string
  bytes: number
  entries: FileEntry[]
  manifests: { path: string; minEngine: string; script: string; beta: boolean }[]
  scripts: { path: string; size: number }[]
}

const infos: ArchiveInfo[] = []

for (const archive of archives) {
  const raw = readFileSync(archive)
  const entries: FileEntry[] = []
  try {
    await collect(raw, 0, entries)
  } catch (error) {
    console.log(`!! ${archive}: ${(error as Error).message}`)
    continue
  }

  const manifests: ArchiveInfo['manifests'] = []
  const scripts: ArchiveInfo['scripts'] = []
  const zip = await JSZip.loadAsync(raw)
  const flat: { path: string; get: () => Promise<string> }[] = []
  for (const e of entries) {
    flat.push({ path: e.path, get: async () => '' })
  }
  // Re-read manifests/scripts through the top-level zip walk (paths repeat across
  // nested packs, so we walk again and read the matching entries directly).
  const walk = async (buf: Uint8Array, depth: number): Promise<void> => {
    const z = await JSZip.loadAsync(buf)
    for (const item of Object.values(z.files)) {
      if (item.dir) continue
      if (/\.(mcpack|mcaddon|zip)$/i.test(item.name) && depth < 2) {
        await walk(await item.async('uint8array'), depth + 1)
        continue
      }
      if (/(^|\/)manifest\.json$/i.test(item.name)) {
        try {
          const doc = JSON.parse(await item.async('string'))
          const modules = (doc.modules ?? []) as { type?: string; version?: string | number[] }[]
          const script = modules.find((m) => String(m.type).includes('script'))
          const version = Array.isArray(script?.version) ? script!.version.join('.') : String(script?.version ?? '—')
          manifests.push({
            path: item.name,
            minEngine: Array.isArray(doc.header?.min_engine_version)
              ? doc.header.min_engine_version.join('.')
              : String(doc.min_engine_version ?? '—'),
            script: version,
            beta: /beta/i.test(JSON.stringify(modules)),
          })
        } catch {
          /* tolerate JSONC in donor manifests */
        }
      }
      if (/\.(js|ts)$/i.test(item.name)) {
        scripts.push({ path: item.name, size: (await item.async('uint8array')).length })
      }
    }
  }
  await walk(raw, 0)
  void zip
  void flat

  infos.push({ archive, bytes: raw.length, entries, manifests, scripts })
}

/* ------------------------------- duplicates ------------------------------- */

const byHash = new Map<string, { archive: string; logical: string }[]>()
const byLogical = new Map<string, { archive: string; hash: string; size: number }[]>()
const byIdentifier = new Map<string, Set<string>>()

for (const info of infos) {
  for (const entry of info.entries) {
    const h = byHash.get(entry.hash) ?? []
    h.push({ archive: info.archive, logical: entry.logical })
    byHash.set(entry.hash, h)

    const l = byLogical.get(entry.logical) ?? []
    l.push({ archive: info.archive, hash: entry.hash, size: entry.size })
    byLogical.set(entry.logical, l)
  }
}

// Identifiers need the JSON content; do a second pass over the archives.
for (const info of infos) {
  const raw = readFileSync(info.archive)
  const visit = async (buf: Uint8Array, depth: number): Promise<void> => {
    const z = await JSZip.loadAsync(buf)
    for (const item of Object.values(z.files)) {
      if (item.dir) continue
      if (/\.(mcpack|mcaddon|zip)$/i.test(item.name) && depth < 2) {
        await visit(await item.async('uint8array'), depth + 1)
        continue
      }
      if (!item.name.endsWith('.json')) continue
      const bytes = await item.async('uint8array')
      if (bytes.length > 400_000) continue
      for (const id of identifiersIn(Buffer.from(bytes).toString('utf8'))) {
        const set = byIdentifier.get(id) ?? new Set<string>()
        set.add(info.archive)
        byIdentifier.set(id, set)
      }
    }
  }
  await visit(raw, 0)
}

const dupAcrossArchives = [...byHash.values()].filter(
  (group) => new Set(group.map((g) => g.archive)).size > 1,
)
const dupSameArchive = [...byHash.values()].filter((group) => group.length > 1)
const pathConflicts = [...byLogical.entries()].filter(
  (([, group]) =>
    new Set(group.map((g) => g.hash)).size > 1 && new Set(group.map((g) => g.archive)).size > 1),
)
const idConflicts = [...byIdentifier.entries()].filter(([, set]) => set.size > 1)

/* -------------------------------- reporting ------------------------------- */

const mb = (n: number) => (n / 1048576).toFixed(1)

console.log(`\n=== ${infos.length} archives · ${mb(infos.reduce((a, i) => a + i.bytes, 0))} Mo ===`)
for (const info of infos) {
  const cats = new Map<string, number>()
  let total = 0
  for (const e of info.entries) {
    total += e.size
    cats.set(e.logical.split('/')[0], (cats.get(e.logical.split('/')[0]) ?? 0) + e.size)
  }
  console.log(`\n${info.archive}  —  ${mb(info.bytes)} Mo sur disque · ${info.entries.length} fichiers · ${mb(total)} Mo décompressés`)
  const top = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`   ${top.map(([k, v]) => `${k} ${mb(v)}`).join(' · ')}`)
  for (const m of info.manifests) {
    console.log(`   manifest ${m.path} -> min_engine ${m.minEngine} · script ${m.script}${m.beta ? ' · BETA' : ''}`)
  }
  console.log(`   scripts: ${info.scripts.length === 0 ? '—' : info.scripts.map((s) => `${s.path.split('/').pop()} (${(s.size / 1024).toFixed(0)}Ko)`).join(', ')}`)
}

console.log(`\n=== DOUBLONS ===`)
console.log(`  fichiers identiques presents dans >1 archive : ${dupAcrossArchives.length} groupes`)
console.log(`    soit ${dupAcrossArchives.reduce((a, g) => a + g.length - 1, 0)} fichiers supprimables`)
const dupBytes = dupAcrossArchives.reduce((a, g) => a + g.slice(1).reduce((b, x) => b + (x ? 1 : 0), 0), 0)
console.log(`  doublons internes a une meme archive       : ${dupSameArchive.length} groupes`)
void dupBytes

console.log(`\n=== COLLISIONS DE CHEMINS (meme chemin, contenu different) ===`)
console.log(`  ${pathConflicts.length} chemins en conflit`)
for (const [path, group] of pathConflicts.slice(0, 20)) {
  console.log(`   ${path}`)
  for (const g of group) console.log(`      ${g.archive.padEnd(46)} ${g.hash.slice(0, 8)} ${g.size} o`)
}
if (pathConflicts.length > 20) console.log(`   ... et ${pathConflicts.length - 20} autres`)

console.log(`\n=== COLLISIONS D'IDENTIFIANTS ===`)
console.log(`  ${idConflicts.length} identifiants declares par >1 archive`)
for (const [id, set] of idConflicts.slice(0, 25)) {
  console.log(`   ${id.padEnd(46)} ${[...set].map((a) => a.split(' ')[0]).join(', ')}`)
}
if (idConflicts.length > 25) console.log(`   ... et ${idConflicts.length - 25} autres`)

mkdirSync('analysis', { recursive: true })
writeFileSync(
  'analysis/merge-recon.json',
  `${JSON.stringify(
    {
      archives: infos.map((i) => ({
        archive: i.archive,
        bytes: i.bytes,
        files: i.entries.length,
        manifests: i.manifests,
        scripts: i.scripts,
      })),
      duplicatesAcrossArchives: dupAcrossArchives.length,
      pathConflicts: pathConflicts.map(([path, group]) => ({ path, group })),
      identifierConflicts: idConflicts.map(([id, set]) => ({ id, archives: [...set] })),
    },
    null,
    2,
  )}\n`,
)
console.log(`\n-> analysis/merge-recon.json`)
