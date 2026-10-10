/**
 * Full donor fusion.
 *
 * Where `harvest-armor.ts` + `extract-sources.ts` keep a curated slice, this
 * script keeps *everything*: every file of every donor archive is expanded,
 * deduplicated by content hash, and written into one merged BP + one merged RP.
 *
 * Policy (as requested):
 *   - scope      : absolutely everything, sound banks included
 *   - collisions : rename with the source prefix, then rewrite every reference
 *   - scripts    : each donor's system is isolated under `scripts/<source>/`,
 *                  with one bootstrap entry that loads them defensively
 *
 * Usage: bun run scripts/merge-all.ts [output.mcaddon]
 */
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'
import { parseLooseJson } from '../generator/bedrockJson'

const OUTPUT = process.argv[2] ?? 'dist-pack/Remnant_Fusion_Complete.mcaddon'
const BP = 'Remnant_Fusion_BP'
const RP = 'Remnant_Fusion_RP'

/** Ordered: the first source wins the original path on a conflict. */
const SOURCES = [
  { key: 'aplok', file: 'Aplok Guns BP-v1.8.8.mcaddon' },
  { key: 'deadzone', file: 'V1.6.6-1DeadZone.mcaddon' },
  { key: 'dyingdayz', file: 'DyingDayZ.mcaddon' },
  { key: 'truesurvival', file: 'True Survival - Zombie Apocalypse (V0.0.4).mcaddon' },
  { key: 'walker', file: 'Project-Walker-1.8.13.mcaddon' },
  { key: 'zombieapoc', file: 'zombie_apocalypse.mcaddon' },
  { key: 'rza', file: 'RZA Structures v1.2.21.mcpack' },
] as const

const SIDE_ROOTS = {
  // `animations` / `animation_controllers` are deliberately absent: they are
  // resource-side concepts, so the fallback sends them to the RP. A pack whose
  // manifest was read correctly never relies on this list anyway.
  bp: new Set([
    'items', 'item', 'entities', 'blocks', 'spawn_rules', 'loot_tables', 'recipes',
    'trading', 'scripts', 'functions', 'structures', 'features', 'feature_rules',
    'worldgen',
  ]),
  rp: new Set([
    'textures', 'attachables', 'models', 'entity', 'render_controllers',
    'animations', 'animation_controllers', 'particles', 'sounds', 'ui',
    'materials', 'font', 'texts', 'textures', 'blocks',
  ]),
}

/* ------------------------------ expansion -------------------------------- */

interface Raw {
  source: string
  root: string
  side: 'bp' | 'rp' | '?'
  logical: string
  bytes: Uint8Array
  hash: string
}

interface Flat {
  prefix: string
  path: string
  bytes: Uint8Array
}

/** Declared before `expand` runs: an empty file carries nothing and is skipped. */
let emptySkipped = 0

async function expand(buf: Uint8Array, prefix: string, out: Flat[], depth: number): Promise<void> {
  const zip = await JSZip.loadAsync(buf)
  for (const item of Object.values(zip.files)) {
    if (item.dir) continue
    const bytes = await item.async('uint8array')
    if (bytes.length === 0) {
      emptySkipped++ // an empty file carries nothing and fails the "no empty file" check
      continue
    }
    if (/\.(mcaddon|mcpack|zip)$/i.test(item.name) && depth < 2) {
      await expand(bytes, `${prefix}${item.name}/`, out, depth + 1)
    } else {
      // the accumulated prefix MUST be kept: two nested `.mcpack` containers
      // otherwise both look rooted at `""`, and every file of the second one is
      // attributed to the first container's side.
      out.push({ prefix, path: `${prefix}${item.name}`, bytes })
    }
  }
}

/** `header.modules[].type` decides whether a pack root is BP or RP. */
function sideOfManifest(text: string, root: string): 'bp' | 'rp' | '?' {
  // donor manifests regularly carry `//` or `/* */` comments, so the tolerant
  // reader is used here: a strict JSON.parse would silently misclassify a pack.
  const doc = parseLooseJson<{ modules?: { type?: string }[] }>(text)
  const types = (doc?.modules ?? []).map((m) => String(m.type ?? ''))
  if (types.some((t) => t.includes('resources'))) return 'rp'
  if (types.some((t) => t.includes('data'))) return 'bp'
  // Unreadable manifest: the folder is named after the pack it holds, so its
  // name is the next best evidence.
  if (/bp|behavior/i.test(root)) return 'bp'
  if (/rp|resource/i.test(root)) return 'rp'
  return '?'
}

function sideOfPath(logical: string): 'bp' | 'rp' | '?' {
  const root = logical.split('/')[0]
  if (SIDE_ROOTS.bp.has(root)) return 'bp'
  if (SIDE_ROOTS.rp.has(root)) return 'rp'
  return '?'
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

const raws: Raw[] = []
const scriptEntries: { source: string; entry: string; version: string; minEngine: string }[] = []

for (const source of SOURCES) {
  if (!readdirSync('.').includes(source.file)) {
    console.log(`!! archive absente : ${source.file}`)
    continue
  }
  const flat: Flat[] = []
  await expand(readFileSync(source.file), '', flat, 0)

  // every manifest marks a pack root
  const roots: { root: string; side: 'bp' | 'rp' | '?' }[] = []
  for (const entry of flat) {
    if (!/(^|\/)manifest\.json$/i.test(entry.path)) continue
    const root = entry.path.slice(0, entry.path.length - 'manifest.json'.length)
    const side = sideOfManifest(Buffer.from(entry.bytes).toString('utf8'), root)
    roots.push({ root, side })
    if (side === 'bp') {
      const doc = parseLooseJson<{
        modules?: { type?: string; entry?: string; version?: unknown }[]
        header?: { min_engine_version?: number[] }
      }>(Buffer.from(entry.bytes).toString('utf8'))
      const script = (doc?.modules ?? []).find((m) => String(m.type ?? '').includes('script'))
      if (script?.entry) {
        scriptEntries.push({
          source: source.key,
          entry: script.entry,
          version: Array.isArray(script.version) ? script.version.join('.') : String(script.version ?? '—'),
          minEngine: Array.isArray(doc?.header?.min_engine_version)
            ? doc.header.min_engine_version.join('.')
            : '—',
        })
      }
    }
  }
  roots.sort((a, b) => b.root.length - a.root.length)

  for (const entry of flat) {
    if (/(^|\/)manifest\.json$/i.test(entry.path)) continue
    const match = roots.find((r) => entry.path.startsWith(r.root))
    const logical = match ? entry.path.slice(match.root.length) : entry.path
    const side = match?.side && match.side !== '?' ? match.side : sideOfPath(logical)
    raws.push({
      source: source.key,
      root: match?.root ?? '',
      side,
      logical,
      bytes: entry.bytes,
      hash: sha(entry.bytes),
    })
  }
  console.log(`${source.key.padEnd(13)} ${flat.length} fichiers extraits`)
}

/* --------------------------- dedup + conflicts ---------------------------- */

/** Files that cannot be relocated: the engine loads them by fixed path. */
/**
 * Files the engine loads by a fixed path: they must be merged, never moved.
 *
 * `textures/item_texture.json` is the one that bites hardest: it is a single
 * atlas for the whole pack, so keeping one donor's copy leaves every other
 * donor's items pointing at a key that no longer exists — 705 items without an
 * icon, which is exactly what "the textures do not show" looks like.
 */
const SINGLETONS = new Set([
  'texts/en_US.lang', 'texts/fr_FR.lang', 'texts/languages.json',
  'functions/tick.json',
  'sounds/sound_definitions.json', 'sounds.json',
  'textures/item_texture.json', 'textures/terrain_texture.json',
  'textures/flipbook_textures.json', 'blocks.json', 'biomes_client.json',
])

/**
 * Renames are tracked *per source*, never globally.
 *
 * A global replacement rewrites the other pack's references as well, and when
 * two packs declare the same identifier that turns one declaration into two —
 * the exact duplicate the merge is supposed to remove. Confining a rename to the
 * source it belongs to keeps every other pack's files untouched.
 */
const renamesBySource = new Map<string, Map<string, string>>()
const addSourceRename = (source: string, from: string, to: string): void => {
  if (from === to) return
  const map = renamesBySource.get(source) ?? new Map<string, string>()
  if (!map.has(from)) map.set(from, to)
  renamesBySource.set(source, map)
}

/**
 * A duplicate *inside* one source needs file granularity: only the extra file's
 * declaration moves, so its own references keep resolving to it.
 */
const renamesByFile = new Map<string, Map<string, string>>()
const addFileRename = (outPath: string, from: string, to: string): void => {
  if (from === to) return
  const map = renamesByFile.get(outPath) ?? new Map<string, string>()
  if (!map.has(from)) map.set(from, to)
  renamesByFile.set(outPath, map)
}

const keyOf = (side: 'bp' | 'rp', path: string): string => `${side === 'bp' ? BP : RP}/${path}`
const outSource = new Map<string, string>()

interface Planned {
  side: 'bp' | 'rp'
  path: string
  bytes: Uint8Array
  source: string
  hash: string
}

const planned: Planned[] = []
const pathOwner = new Map<string, { hash: string; source: string }>()
let duplicates = 0
let renamed = 0
let rootDropped = 0

for (const raw of raws) {
  if (raw.side === '?') continue

  // Script trees are relocated wholesale under `scripts/<source>/` further down.
  // Renaming one here would prefix it twice, so this pass leaves them alone.
  if (raw.logical.startsWith('scripts/')) {
    planned.push({ side: raw.side, path: raw.logical, bytes: raw.bytes, source: raw.source, hash: raw.hash })
    continue
  }

  const key = `${raw.side}|${raw.logical}`
  const owner = pathOwner.get(key)

  if (!owner) {
    pathOwner.set(key, { hash: raw.hash, source: raw.source })
    planned.push({ side: raw.side, path: raw.logical, bytes: raw.bytes, source: raw.source, hash: raw.hash })
    continue
  }

  if (owner.hash === raw.hash) {
    duplicates++ // byte-identical: dropped, nothing to rewrite
    continue
  }

  if (SINGLETONS.has(raw.logical)) {
    planned.push({ side: raw.side, path: raw.logical, bytes: raw.bytes, source: raw.source, hash: raw.hash })
    continue
  }

  // same path, different content -> keep both, prefix the newcomer with its source
  const parts = raw.logical.split('/')
  if (parts.length < 2) {
    // a root-level file (pack_icon, sounds.json, ...) has nowhere to move to; the
    // engine also loads several of them by name, so the duplicate is dropped.
    rootDropped++
    continue
  }
  const newPath = `${parts[0]}/${raw.source}/${parts.slice(1).join('/')}`
  addSourceRename(raw.source, raw.logical, newPath)
  const noExt = raw.logical.replace(/\.[^.]+$/, '')
  if (noExt !== raw.logical) addSourceRename(raw.source, noExt, newPath.replace(/\.[^.]+$/, ''))
  planned.push({ side: raw.side, path: newPath, bytes: raw.bytes, source: raw.source, hash: raw.hash })
  renamed++
  console.log(`  conflit ${raw.logical} -> ${newPath} (${raw.source})`)
}

console.log(`\ndoublons identiques retirés : ${duplicates}`)
console.log(`chemins renommés (conflits) : ${renamed}`)
console.log(`fichiers racine en double écartés : ${rootDropped}`)

/* ---------------------------- identifier review --------------------------- */

/**
 * Vanilla identifiers are never touched: `minecraft:` and the geometry names
 * the game itself ships.
 */
const VANILLA_IDS = new Set([
  'minecraft:player', 'geometry.humanoid', 'geometry.humanoid.custom',
  'geometry.humanoid.customSlim', 'geometry.zombie', 'geometry.player',
  'geometry.none', 'geometry.creeper', 'geometry.skeleton', 'geometry.spider',
])

/**
 * `features/`, `feature_rules/`, `biomes/` and `worldgen/` carry identifiers in
 * their own namespace: a block id that happens to equal a feature id is not a
 * clash, and renaming one of them would break the `places_feature` link.
 */
const ID_EXCLUDED = /^(features|feature_rules|biomes|worldgen)\//

interface Decl {
  path: string
  source: string
  side: 'bp' | 'rp'
}

const declFiles = new Map<string, Decl[]>()
for (const item of planned) {
  if (!item.path.endsWith('.json')) continue
  if (ID_EXCLUDED.test(item.path)) continue
  const text = Buffer.from(item.bytes).toString('utf8')
  if (text.length > 400_000) continue
  for (const match of text.matchAll(/"identifier"\s*:\s*"([^"]+)"/g)) {
    const id = match[1]
    if (id.startsWith('minecraft:') || VANILLA_IDS.has(id)) continue
    const list = declFiles.get(id) ?? []
    list.push({ path: item.path, source: item.source, side: item.side })
    declFiles.set(id, list)
  }
}

const renameId = (id: string, source: string, index: number): string => {
  const base = id.includes(':')
    ? `${id.split(':')[0]}:${source}_${id.split(':')[1]}`
    : `${source}_${id}`
  return index === 0 ? base : `${base}_${index}`
}

const sourceOrder: string[] = SOURCES.map((s) => s.key)
let idRenames = 0
for (const [id, decls] of declFiles) {
  const sources = [...new Set(decls.map((d) => d.source))].sort(
    (a, b) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b),
  )
  const winner = sources[0]
  let index = 0

  // (a) other sources declare the same identifier: their whole subtree is
  //     renamed, so their own declarations AND references stay consistent.
  for (const source of sources.slice(1)) {
    addSourceRename(source, id, renameId(id, source, index++))
    idRenames++
  }

  // (b) the winning source declares it more than once on one side: a per-source
  //     rename cannot express that, so only the extra file's declaration moves.
  for (const side of ['bp', 'rp'] as const) {
    const sameSide = decls.filter((d) => d.source === winner && d.side === side)
    for (const extra of sameSide.slice(1)) {
      addFileRename(keyOf(side, extra.path), id, renameId(id, winner, index++))
      idRenames++
    }
  }
}

console.log(`identifiants renommes (collisions) : ${idRenames}`)
console.log(`fichiers vides ecartes : ${emptySkipped}`)

/* ------------------------------- merging ---------------------------------- */

const BP_FIXED = new Set(['manifest.json'])
const out = new Map<string, Uint8Array>() // full path inside the archive -> bytes

function put(side: 'bp' | 'rp', path: string, bytes: Uint8Array): void {
  out.set(`${side === 'bp' ? BP : RP}/${path}`, bytes)
}

const encoder = new TextEncoder()

/** Merge-able singletons keep every source's content instead of losing one. */
const langMerged = new Map<string, string[]>()
const tickValues = new Set<string>()
const soundDefs: Record<string, unknown> = {}
const soundDefSources = new Map<string, string>()
const uiDefs = new Set<string>()
const languages = new Set<string>()
const soundsJson: Record<string, Record<string, unknown>> = {}
const langSide = new Map<string, 'bp' | 'rp'>()

/**
 * Key-by-key merge for the single-path files.
 *
 * First writer wins a key. When two donors really disagree, the newcomer's key is
 * prefixed with its source AND that rename is registered for that source, so the
 * files pointing at it (an item's `minecraft:icon`, a block's texture key) are
 * rewritten to match.
 */
const mergedKeys = new Map<string, Map<string, unknown>>()
const mergedOwner = new Map<string, string>()
const mergeKeys = (file: string, source: string, obj: Record<string, unknown>): void => {
  const data = mergedKeys.get(file) ?? new Map<string, unknown>()
  mergedKeys.set(file, data)
  for (const [key, body] of Object.entries(obj)) {
    const id = `${file}|${key}`
    const owner = mergedOwner.get(id)
    if (owner === undefined) {
      data.set(key, body)
      mergedOwner.set(id, source)
      continue
    }
    if (JSON.stringify(data.get(key)) === JSON.stringify(body)) continue
    const renamed = `${source}_${key}`
    data.set(renamed, body)
    addSourceRename(source, key, renamed)
  }
}
const mergedArrays = new Map<string, unknown[]>()

for (const item of planned) {
  // donor scripts are relocated wholesale further down, never written at their
  // original path: otherwise `scripts/main.js` would exist once per source.
  if (item.side === 'bp' && item.path.startsWith('scripts/')) continue
  if (/\.tsbuildinfo$/i.test(item.path)) continue

  if (item.path === 'texts/languages.json') {
    const doc = parseLooseJson<string[] | { languages?: string[] }>(Buffer.from(item.bytes).toString('utf8'))
    for (const code of Array.isArray(doc) ? doc : doc?.languages ?? []) languages.add(code)
    continue
  }

  if (item.path === 'sounds.json') {
    const doc = parseLooseJson<Record<string, unknown>>(Buffer.from(item.bytes).toString('utf8'))
    if (doc) {
      for (const [category, body] of Object.entries(doc)) {
        if (typeof body !== 'object' || body === null) continue
        const bucket = soundsJson[category] ?? (soundsJson[category] = {})
        for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
          if (bucket[key] === undefined) bucket[key] = value
          else if (JSON.stringify(bucket[key]) !== JSON.stringify(value)) {
            // two packs bind the same entity/event to different sounds: keep both
            // under a source-prefixed key rather than silently losing one.
            bucket[`${item.source}_${key}`] = value
          }
        }
      }
    }
    continue
  }

  if (item.path === 'functions/tick.json') {
    // tolerant reader: a strict JSON.parse silently loses every entry of a
    // donor file that carries comments, and nothing would report the loss
    const doc = parseLooseJson<{ values?: string[] }>(Buffer.from(item.bytes).toString('utf8'))
    for (const v of doc?.values ?? []) tickValues.add(v)
    continue
  }

  if (
    item.path === 'textures/item_texture.json' ||
    item.path === 'textures/terrain_texture.json'
  ) {
    const doc = parseLooseJson<{ texture_data?: Record<string, unknown> }>(
      Buffer.from(item.bytes).toString('utf8'),
    )
    mergeKeys(item.path, item.source, doc?.texture_data ?? {})
    continue
  }

  if (item.path === 'blocks.json' || item.path === 'biomes_client.json') {
    const doc = parseLooseJson<Record<string, unknown>>(Buffer.from(item.bytes).toString('utf8'))
    if (doc) {
      const nest = item.path === 'biomes_client.json' ? 'biomes' : ''
      const body = nest ? ((doc[nest] as Record<string, unknown>) ?? {}) : doc
      // a block whose identifier was renamed for this source needs the same key
      // here, otherwise its textures and sound have no mapping at all
      const own = renamesBySource.get(item.source)
      const final = own
        ? Object.fromEntries(Object.entries(body).map(([k, v]) => [own.get(k) ?? k, v]))
        : body
      mergeKeys(item.path, item.source, final)
    }
    continue
  }

  if (item.path === 'textures/flipbook_textures.json') {
    const doc = parseLooseJson<{ flipbook_textures?: unknown[] }>(
      Buffer.from(item.bytes).toString('utf8'),
    )
    const list = mergedArrays.get(item.path) ?? []
    list.push(...(doc?.flipbook_textures ?? []))
    mergedArrays.set(item.path, list)
    continue
  }

  if (item.path === 'sounds/sound_definitions.json') {
    try {
      const doc = parseLooseJson<{ sound_definitions?: Record<string, unknown> }>(
        Buffer.from(item.bytes).toString('utf8'),
      )!
      for (const [name, body] of Object.entries(doc?.sound_definitions ?? {})) {
        if (soundDefs[name] === undefined) soundDefs[name] = body
        else if (
          soundDefSources.get(name) !== item.source &&
          JSON.stringify(soundDefs[name]) !== JSON.stringify(body)
        ) {
          // Two donors bind one event name to different files. Renaming the event
          // would force a rewrite of every reference, so the sounds are unioned
          // instead: one name, every donor's files.
          const existing = soundDefs[name] as { sounds?: unknown[] }
          const incoming = body as { sounds?: unknown[] }
          const seen = new Set((existing.sounds ?? []).map((s) => JSON.stringify(s)))
          for (const sound of incoming.sounds ?? []) {
            if (seen.has(JSON.stringify(sound))) continue
            existing.sounds = [...(existing.sounds ?? []), sound]
            seen.add(JSON.stringify(sound))
          }
        }
        soundDefSources.set(name, item.source)
      }
    } catch {
      /* ignore */
    }
    continue
  }

  if (/^texts\/.*\.lang$/i.test(item.path)) {
    const lines = langMerged.get(item.path) ?? []
    for (const line of Buffer.from(item.bytes).toString('utf8').split('\n')) {
      if (line.trim().length > 0 && !line.startsWith('#')) lines.push(line)
    }
    langMerged.set(item.path, lines)
    langSide.set(item.path, item.side)
    continue
  }

  if (item.path === 'ui/_ui_defs.json') {
    try {
      const doc = JSON.parse(Buffer.from(item.bytes).toString('utf8'))
      for (const d of doc.ui_defs ?? []) uiDefs.add(d)
    } catch {
      /* ignore */
    }
    continue
  }

  if (item.path === 'pack_icon.png') {
    if (!out.has(`${RP}/pack_icon.png`)) put('rp', 'pack_icon.png', item.bytes)
    continue
  }

  put(item.side, item.path, item.bytes)
  outSource.set(keyOf(item.side, item.path), item.source)
}

if (tickValues.size > 0) {
  put('bp', 'functions/tick.json', encoder.encode(JSON.stringify({ values: [...tickValues] }, null, 2)))
}
for (const [path, lines] of langMerged) {
  // `.lang` files exist on both sides (a BP carries the names of its own items),
  // so the side is remembered per file instead of being assumed.
  const side = langSide.get(path) ?? 'rp'
  const dedup = new Map<string, string>()
  for (const line of lines) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!dedup.has(key)) dedup.set(key, line)
  }
  put(side, path, encoder.encode([...dedup.values()].join('\n') + '\n'))
}
for (const [file, data] of mergedKeys) {
  if (data.size === 0) continue
  if (file === 'biomes_client.json') {
    put('rp', file, encoder.encode(JSON.stringify({ format_version: '1.16.0', biomes: Object.fromEntries(data) }, null, 2)))
  } else if (file === 'blocks.json') {
    put('rp', file, encoder.encode(JSON.stringify({ format_version: '1.21.40', ...Object.fromEntries(data) }, null, 2)))
  } else {
    put('rp', file, encoder.encode(JSON.stringify({ resource_pack_name: 'vanilla', texture_name: file.includes('terrain') ? 'atlas.terrain' : 'atlas.items', texture_data: Object.fromEntries(data) }, null, 2)))
  }
}
for (const [file, list] of mergedArrays) {
  put('rp', file, encoder.encode(JSON.stringify({ resource_pack_name: 'vanilla', flipbook_textures: list }, null, 2)))
}
if (languages.size > 0) {
  put('rp', 'texts/languages.json', encoder.encode(JSON.stringify([...languages], null, 2)))
}
if (Object.keys(soundsJson).length > 0) {
  put('rp', 'sounds.json', encoder.encode(JSON.stringify(soundsJson, null, 2)))
}
if (Object.keys(soundDefs).length > 0) {
  put(
    'rp',
    'sounds/sound_definitions.json',
    encoder.encode(JSON.stringify({ format_version: '1.14.0', sound_definitions: soundDefs }, null, 2)),
  )
}
if (uiDefs.size > 0) {
  put('rp', 'ui/_ui_defs.json', encoder.encode(JSON.stringify({ ui_defs: [...uiDefs] }, null, 2)))
}

/* --------------------------------- scripts -------------------------------- */

/**
 * Every donor script subtree moves wholesale to `scripts/<source>/`, so its
 * relative imports stay valid. One bootstrap entry loads them defensively: a
 * system that needs an API this engine does not expose fails alone.
 */
const scriptFiles: { source: string; rel: string }[] = []
for (const item of planned) {
  if (item.side !== 'bp' || !item.path.startsWith('scripts/')) continue
  const rel = item.path.slice('scripts/'.length)
  const target = `scripts/${item.source}/${rel}`
  put('bp', target, item.bytes)
  outSource.set(keyOf('bp', target), item.source)
  scriptFiles.push({ source: item.source, rel })
}

const systems = scriptEntries
  .filter((entry) => scriptFiles.some((f) => f.source === entry.source))
  // the `scripts/` prefix is stripped when the subtree is relocated
  .map((entry) => ({ ...entry, rel: entry.entry.replace(/^\.\//, '').replace(/^scripts\//, '') }))
const bootstrap = `/**
 * REMNANT — fusion complète : amorçage des systèmes donneurs.
 *
 * Chaque addon garde son code intact dans \`scripts/<source>/\`. Ce fichier les
 * charge un par un : si un système attend une API que ce moteur n'expose pas, il
 * échoue seul et les autres continuent.
 *
 * Systèmes embarqués :
${systems.map((s) => ` *   - ${s.source.padEnd(13)} scripts/${s.source}/${s.rel}  (module demandé ${s.version}, min_engine ${s.minEngine})`).join('\n')}
 */
const SYSTEMS = [
${systems.map((s) => `  ['${s.source}', './${s.source}/${s.rel}'],`).join('\n')}
]

for (const [name, path] of SYSTEMS) {
  try {
    await import(path)
    console.log(\`[fusion] \${name} chargé\`)
  } catch (error) {
    console.warn(\`[fusion] \${name} NON chargé : \${error}\`)
  }
}
`
put('bp', 'scripts/main.js', encoder.encode(bootstrap))

/* --------------------------- reference rewriting -------------------------- */

const jsonPaths = [...out.keys()].filter((p) => p.endsWith('.json') && !p.endsWith('scripts/main.js'))
let rewritten = 0

const applyMap = (text: string, map: Map<string, string> | undefined): string => {
  if (!map) return text
  let out = text
  for (const [from, to] of [...map.entries()].sort((a, b) => b[0].length - a[0].length)) {
    // exact quoted string only: never touches substrings inside other text
    out = out.split(`"${from}"`).join(`"${to}"`)
  }
  return out
}

for (const path of jsonPaths) {
  let text = Buffer.from(out.get(path)!).toString('utf8')
  const before = text

  // a duplicate inside one source is fixed at file level, first
  text = applyMap(text, renamesByFile.get(path))

  // Merged singletons (atlases, sounds, langs, tick) belong to no single source
  // and already hold their final keys. Applying every source's renames to them
  // would rewrite the winner's own keys too, colliding with the renamed copies —
  // that is how Aplok's `bullet_12gauge` disappeared, taking 705 item icons with
  // it. Only a file that belongs to one source receives that source's renames.
  const source = outSource.get(path)
  if (source) text = applyMap(text, renamesBySource.get(source))

  if (text !== before) {
    out.set(path, encoder.encode(text))
    rewritten++
  }
}

/* ------------------------------- manifests -------------------------------- */

const manifest = (side: 'bp' | 'rp', dir: string): string => {
  const header = {
    // literal text, not a `pack.name` key: the donors' lang files are merged into
    // this pack, so a key would resolve to whatever they happen to define
    name: 'Remnant — Fusion Complete',
    description: 'Fusion des 7 addons apocalypse zombie — usage personnel uniquement.',
    uuid: randomUUID(),
    version: [1, 0, 0],
    min_engine_version: [1, 21, 70],
  }
  const modules =
    side === 'bp'
      ? [
          { type: 'data', uuid: randomUUID(), version: [1, 0, 0] },
          { type: 'script', language: 'javascript', uuid: randomUUID(), entry: 'scripts/main.js', version: [1, 17, 0] },
        ]
      : [{ type: 'resources', uuid: randomUUID(), version: [1, 0, 0] }]
  const dependencies =
    side === 'rp'
      ? []
      : [{ uuid: 'PLACEHOLDER', version: [1, 0, 0] }]
  void dir
  return JSON.stringify({ format_version: 2, header, modules, dependencies }, null, 2)
}

// the RP uuid must appear in the BP dependencies
const rpUuid = randomUUID()
const bpManifest = JSON.parse(manifest('bp', BP))
bpManifest.dependencies = [{ uuid: rpUuid, version: [1, 0, 0] }]
const rpManifest = JSON.parse(manifest('rp', RP))
rpManifest.header.uuid = rpUuid

put('bp', 'manifest.json', encoder.encode(JSON.stringify(bpManifest, null, 2)))
put('rp', 'manifest.json', encoder.encode(JSON.stringify(rpManifest, null, 2)))

/* --------------------------------- write --------------------------------- */

const zip = new JSZip()
for (const [path, bytes] of out) zip.file(path, bytes)
const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } })

mkdirSync(OUTPUT.slice(0, OUTPUT.lastIndexOf('/')), { recursive: true })
writeFileSync(OUTPUT, blob)

const mb = (n: number) => (n / 1048576).toFixed(1)
console.log(`\n${OUTPUT}`)
console.log(`  ${out.size} fichiers · ${mb(blob.length)} Mo`)
console.log(`  BP ${[...out.keys()].filter((p) => p.startsWith(BP)).length} · RP ${[...out.keys()].filter((p) => p.startsWith(RP)).length}`)
console.log(`  systèmes de script embarqués : ${systems.length}`)
void BP_FIXED
