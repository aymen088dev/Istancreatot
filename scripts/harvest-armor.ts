import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { geometryIdentifiers, parseLooseJson } from '../generator/bedrockJson'

/**
 * Donor fusion harvester.
 *
 * Walks every donor archive and extracts each wearable item together with the
 * whole render chain it needs — inventory icon, worn attachable, geometry,
 * animations, render controllers — plus the recipes and display names that make
 * it usable in survival.
 *
 * Three collision classes are resolved, because two packs *will* disagree:
 *  1. resource paths   -> renamed under `<source>/`, JSON references rewritten
 *  2. texture keys     -> prefixed with the source, item icon references rewritten
 *  3. identifier names -> suffixed with the source (geometry/animation/controllers)
 *
 * Legacy `armor_head` style slots are normalised to `slot.armor.*` on the way in.
 *
 * Output: `public/harvest/donors/` + a `manifest.json` describing every file and
 * which side (BP or RP) it belongs to.
 */

const ROOT = 'public/harvest/donors'
const HARVEST_VERSION = 2

const SOURCES = [
  { key: 'aplok_guns', label: 'Aplok Guns', archive: 'Aplok Guns BP-v1.8.8.mcaddon' },
  { key: 'dyingdayz', label: 'DyingDayZ', archive: 'DyingDayZ.mcaddon' },
  { key: 'deadzone', label: 'DeadZone', archive: 'V1.6.6-1DeadZone.mcaddon' },
  { key: 'true_survival', label: 'True Survival', archive: 'True Survival - Zombie Apocalypse (V0.0.4).mcaddon' },
] as const

const KNOWN_ROOTS = [
  'items', 'item', 'textures', 'attachables', 'models', 'entity', 'render_controllers',
  'animations', 'animation_controllers', 'particles', 'sounds', 'ui', 'blocks', 'entities',
  'spawn_rules', 'loot_tables', 'recipes', 'trading', 'scripts', 'functions', 'texts',
  'materials', 'font', 'worldgen',
]

const LEGACY_SLOTS: Record<string, string> = {
  armor_head: 'slot.armor.head',
  armor_torso: 'slot.armor.chest',
  armor_legs: 'slot.armor.legs',
  armor_feet: 'slot.armor.feet',
}

/** Vanilla textures a pack may reference but never ships. */
const VANILLA_OK = /^textures\/misc\/enchanted_(item|actor)_glint$/

interface Entry {
  path: string
  rootless: string
  size: number
  entry: JSZip.JSZipObject
  text?: string
}

/**
 * `minecraft:icon` has three shapes in the wild:
 *   "minecraft:icon": "key"                              (old, flat)
 *   "minecraft:icon": { "texture": "key" }               (flat)
 *   "minecraft:icon": { "textures": { "default": "key" } } (current)
 */
function iconKeyOf(text: string): string | null {
  const flat = /"minecraft:icon"\s*:\s*"([^"]+)"/.exec(text)?.[1]
  if (flat) return flat
  const block = /"minecraft:icon"\s*:\s*\{([\s\S]{0,300}?)\n\s*\}/.exec(text)?.[1]
  if (!block) return null
  const direct = /"texture"\s*:\s*"([^"]+)"/.exec(block)?.[1]
  if (direct) return direct
  return /"default"\s*:\s*"([^"]+)"/.exec(block)?.[1] ?? null
}

export interface HarvestFile {
  path: string
  side: 'bp' | 'rp'
}

export interface HarvestItem {
  identifier: string
  displayName: string
  slot: string
  protection: number
  durability: number
  iconKey: string | null
  iconPath: string | null
  source: string
}

export interface HarvestManifest {
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
  items: HarvestItem[]
  files: HarvestFile[]
  itemTextureEntries: Record<string, string>
  lang: Record<string, string>
}

function stripRoot(path: string): string {
  const parts = path.split('/')
  for (let i = 0; i < parts.length - 1; i++) {
    if (KNOWN_ROOTS.includes(parts[i])) return parts.slice(i).join('/')
  }
  return parts.slice(-2).join('/')
}

async function collect(buf: Uint8Array, depth: number, acc: Entry[]): Promise<void> {
  const zip = await JSZip.loadAsync(buf)
  for (const item of Object.values(zip.files)) {
    if (item.dir) continue
    if (/\.(mcpack|mcaddon|zip)$/i.test(item.name) && depth < 2) {
      await collect(await item.async('uint8array'), depth + 1, acc)
      continue
    }
    const size = (item as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    acc.push({ path: item.name, rootless: stripRoot(item.name), size, entry: item })
  }
}

async function textOf(entry: Entry): Promise<string> {
  if (entry.text === undefined) {
    try {
      entry.text = await entry.entry.async('string')
    } catch {
      entry.text = ''
    }
  }
  return entry.text
}

const claimed = new Map<string, { source: string; bytes: Buffer }>()
const pathRenames = new Map<string, Map<string, string>>()
const identRenames = new Map<string, Map<string, string>>()
const keyRenames = new Map<string, Map<string, string>>()
const identOwner = new Map<string, string>()
const itemTextureEntries: Record<string, string> = {}
const lang: Record<string, string> = {}
const output = new Map<string, Uint8Array>()
let files: HarvestFile[] = []
const items: HarvestItem[] = []
const stats: HarvestManifest['sources'] = []

function bucket(map: Map<string, Map<string, string>>, source: string): Map<string, string> {
  let inner = map.get(source)
  if (!inner) {
    inner = new Map()
    map.set(source, inner)
  }
  return inner
}

/** Reserve an output path, renaming under `<source>/` on a real collision. */
function reserve(path: string, source: string, bytes: Uint8Array): string {
  const existing = claimed.get(path)
  if (!existing) {
    claimed.set(path, { source, bytes: Buffer.from(bytes) })
    return path
  }
  if (existing.bytes.equals(Buffer.from(bytes))) return path
  const slash = path.lastIndexOf('/')
  const renamed = `${path.slice(0, slash)}/${source}/${path.slice(slash + 1)}`
  bucket(pathRenames, source).set(path, renamed)
  if (!claimed.has(renamed)) claimed.set(renamed, { source, bytes: Buffer.from(bytes) })
  return renamed
}

function applyRewrites(text: string, source: string): string {
  let out = text
  for (const [from, to] of bucket(pathRenames, source)) {
    out = out.split(`"${from}"`).join(`"${to}"`)
    out = out.split(`"${from}.png"`).join(`"${to}.png"`)
  }
  for (const [from, to] of bucket(identRenames, source)) out = out.split(`"${from}"`).join(`"${to}"`)
  for (const [from, to] of bucket(keyRenames, source)) out = out.split(`"${from}"`).join(`"${to}"`)
  // Legacy armor slots are normalised to the modern `slot.armor.*` form.
  for (const [legacy, modern] of Object.entries(LEGACY_SLOTS)) {
    out = out.split(`"slot": "${legacy}"`).join(`"slot": "${modern}"`)
  }
  // The flat `texture` property of `minecraft:icon` is deprecated; donor items
  // that still use it are rewritten to the current `textures.default` form so
  // their icons keep rendering on 1.21+.
  out = out.replace(
    /"minecraft:icon"\s*:\s*\{\s*"texture"\s*:\s*"([^"]+)"\s*\}/g,
    '"minecraft:icon": { "textures": { "default": "$1" } }',
  )
  return out
}

function write(path: string, bytes: Uint8Array, side: 'bp' | 'rp', source: string, countBytes: boolean): number {
  if (output.has(path)) return 0
  output.set(path, bytes)
  files.push({ path, side })
  if (!countBytes) return 0
  claimed.set(path, { source, bytes: Buffer.from(bytes) })
  return bytes.length
}

for (const source of SOURCES) {
  const entries: Entry[] = []
  try {
    await collect(readFileSync(source.archive), 0, entries)
  } catch (error) {
    console.log(`!! ${source.archive}: ${(error as Error).message}`)
    continue
  }

  // Textures are referenced without their extension, and Bedrock packs mix
  // `.png` with `.tga` (Aplok ships TGA), so index them by extension-less stem.
  const textureByStem = new Map<string, Entry>()
  for (const entry of entries) {
    if (!/\.(png|tga|jpg|jpeg)$/i.test(entry.rootless)) continue
    const stem = entry.rootless.replace(/\.[^.]+$/, '').toLowerCase()
    if (!textureByStem.has(stem)) textureByStem.set(stem, entry)
  }

  const itemEntries = entries.filter((e) => /^items?\/.*\.json$/i.test(e.rootless))
  const attachables = entries.filter((e) => /^attachables\/.*\.json$/i.test(e.rootless))
  // Two conventions coexist: `*.geo.json` (DeadZone, True Survival, DyingDayZ)
  // and plain `models/**/*.json` with no extension marker at all (Aplok).
  const geos = entries.filter(
    (e) =>
      e.rootless.endsWith('.geo.json') ||
      /^models\//i.test(e.rootless) ||
      /\/models\//i.test(e.rootless),
  )
  const anims = entries.filter((e) => /^animations\/.*\.json$/i.test(e.rootless))
  const controllers = entries.filter((e) => /^render_controllers\/.*\.json$/i.test(e.rootless))
  const recipes = entries.filter((e) => /^recipes\/.*\.json$/i.test(e.rootless))
  const langEntries = entries.filter((e) => /^texts\/.*\.lang$/i.test(e.rootless))
  const itemTextureEntry = entries.find((e) => /item_texture/i.test(e.rootless) && /\.json$/i.test(e.rootless))

  /* ---------------- indexes ---------------- */
  const attachableById = new Map<string, Entry>()
  for (const entry of attachables) {
    const id = /"identifier"\s*:\s*"([^"]+)"/.exec(await textOf(entry))?.[1]
    if (id && !attachableById.has(id)) attachableById.set(id, entry)
  }
  const geometryById = new Map<string, Entry>()
  for (const entry of geos) {
    // A file can declare several geometries across any of the three shapes.
    for (const id of geometryIdentifiers(parseLooseJson(await textOf(entry)))) {
      if (!geometryById.has(id)) geometryById.set(id, entry)
    }
  }
  const animationByName = new Map<string, Entry>()
  for (const entry of anims) {
    const parsed = parseLooseJson<{ animations?: Record<string, unknown> }>(await textOf(entry))
    for (const name of Object.keys(parsed?.animations ?? {})) {
      if (!animationByName.has(name)) animationByName.set(name, entry)
    }
  }
  const controllerByName = new Map<string, Entry>()
  for (const entry of controllers) {
    const parsed = parseLooseJson<{ render_controllers?: Record<string, unknown> }>(await textOf(entry))
    for (const name of Object.keys(parsed?.render_controllers ?? {})) {
      if (!controllerByName.has(name)) controllerByName.set(name, entry)
    }
  }
  const translation = new Map<string, string>()
  for (const entry of langEntries) {
    for (const line of (await textOf(entry)).split(/\r?\n/)) {
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      if (!translation.has(key)) translation.set(key, line.slice(eq + 1))
    }
  }
  const skippedNoTextures: string[] = []
  const declaredTextures = new Map<string, string>()
  if (itemTextureEntry) {
    const parsed = parseLooseJson<{ texture_data?: Record<string, { textures: string | string[] }> }>(
      await textOf(itemTextureEntry),
    )
    for (const [key, value] of Object.entries(parsed?.texture_data ?? {})) {
      const path = Array.isArray(value.textures) ? value.textures[0] : value.textures
      if (typeof path === 'string') declaredTextures.set(key, path.replace(/\.png$/i, ''))
    }
  }
  if (declaredTextures.size === 0) skippedNoTextures.push(source.key)

  /* ---------------- items ---------------- */
  const skipped: string[] = []
  let bytes = 0
  let modernised = 0
  const imported = new Set<string>()

  /** Copy one file, rewriting JSON when it is text. */
  const copy = async (
    entry: Entry,
    isJson: boolean,
    side: 'bp' | 'rp',
    sourceKey: string,
    asPath?: string,
  ): Promise<string> => {
    const target = asPath ?? entry.rootless
    const raw = await entry.entry.async('uint8array')
    if (isJson) {
      const rewritten = applyRewrites(Buffer.from(raw).toString('utf8'), sourceKey)
      const path = reserve(target, sourceKey, new Uint8Array(Buffer.from(rewritten, 'utf8')))
      bytes += write(path, new Uint8Array(Buffer.from(rewritten, 'utf8')), side, sourceKey, true)
      return path
    }
    const path = reserve(target, sourceKey, raw)
    bytes += write(path, raw, side, sourceKey, true)
    return path
  }

  for (const entry of itemEntries) {
    if (entry.size === 0 || entry.size > 80_000) continue
    const raw = await textOf(entry)
    if (!raw.includes('minecraft:wearable')) continue
    const identifier = /"identifier"\s*:\s*"([^"]+)"/.exec(raw)?.[1]
    if (!identifier) continue

    const legacySlot = /"slot"\s*:\s*"(armor_[a-z]+)"/.exec(raw)?.[1]
    if (legacySlot) modernised++
    const protection = Number(/"protection"\s*:\s*(\d+)/.exec(raw)?.[1] ?? 0)
    const slot = legacySlot
      ? LEGACY_SLOTS[legacySlot] ?? legacySlot
      : /"slot"\s*:\s*"(slot\.armor\.[a-z]+)"/.exec(raw)?.[1] ?? '?'
    const durability = Number(/"max_durability"\s*:\s*(\d+)/.exec(raw)?.[1] ?? 0)
    const iconKey = iconKeyOf(raw)

    const displayRaw =
      /"minecraft:display_name"\s*:\s*\{\s*"value"\s*:\s*"([^"]*)"/.exec(raw)?.[1] ??
      /"minecraft:display_name"\s*:\s*"([^"]*)"/.exec(raw)?.[1] ??
      identifier
    const displayName = translation.get(displayRaw) ?? displayRaw
    lang[`item.${identifier}`] = displayName

    // 2. texture keys are source-scoped so two packs can share a key name.
    let finalKey: string | null = null
    if (iconKey) {
      finalKey = `${source.key}_${iconKey}`
      bucket(keyRenames, source.key).set(iconKey, finalKey)
    }

    await copy(entry, true, 'bp', source.key)
    imported.add(identifier)

    let iconPath: string | null = null
    if (iconKey && finalKey) {
      const declared = declaredTextures.get(iconKey)
      const icon = declared ? textureByStem.get(declared.toLowerCase()) : undefined
      if (icon) iconPath = (await copy(icon, false, 'rp', source.key)).replace(/\.[^.]+$/, '')
      else skipped.push(`icône ${identifier}`)
      if (iconPath) itemTextureEntries[finalKey] = iconPath
    } else {
      skipped.push(`icône ${identifier}`)
    }

    const attachable = attachableById.get(identifier)
    if (attachable) {
      const text = await textOf(attachable)
      await copy(attachable, true, 'rp', source.key)

      const texturesBlock = /"textures"\s*:\s*\{([^}]*)\}/.exec(text)
      for (const match of texturesBlock?.[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g) ?? []) {
        const tex = match[2]
        if (!tex.startsWith('textures/') || VANILLA_OK.test(tex)) continue
        const file = textureByStem.get(tex.toLowerCase())
        if (file) await copy(file, false, 'rp', source.key)
        else skipped.push(tex)
      }

      const geometryBlock = /"geometry"\s*:\s*\{([^}]*)\}/.exec(text)
      for (const match of geometryBlock?.[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g) ?? []) {
        const geometry = match[2]
        const file = geometryById.get(geometry)
        if (!file) continue
        const signature = `${source.key}:${file.rootless}`
        const owner = identOwner.get(geometry)
        if (owner && owner !== signature) {
          const renamed = `${geometry}.${source.key}`
          bucket(identRenames, source.key).set(geometry, renamed)
          identOwner.set(renamed, signature)
        } else if (!owner) {
          identOwner.set(geometry, signature)
        }
        await copy(file, true, 'rp', source.key)
      }

      const controllersBlock = /"render_controllers"\s*:\s*\[([^\]]*)\]/.exec(text)
      for (const match of controllersBlock?.[1].matchAll(/"([^"]+)"/g) ?? []) {
        const file = controllerByName.get(match[1])
        if (file) await copy(file, true, 'rp', source.key)
      }

      const animationsBlock = /"animations"\s*:\s*\{([\s\S]*?)\}/.exec(text)
      for (const match of animationsBlock?.[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g) ?? []) {
        const file = animationByName.get(match[2])
        if (file) await copy(file, true, 'rp', source.key)
      }
    } else {
      skipped.push(`attachable ${identifier}`)
    }

    items.push({
      identifier,
      displayName,
      slot,
      protection,
      durability,
      iconKey: finalKey,
      iconPath,
      source: source.key,
    })
  }

  /* ---------------- recipes ---------------- */
  let recipeCount = 0
  for (const entry of recipes) {
    if (entry.size === 0 || entry.size > 40_000) continue
    const text = await textOf(entry)
    if (!/recipe_/.test(text)) continue
    // The recipe's own `description.identifier` and its `tags` are not items, so
    // strip them before scanning every remaining namespaced id. Scanning just a
    // few known keys missed `input` (furnace recipes) and secondary array items.
    const body = text
      .replace(/"description"\s*:\s*\{[\s\S]*?\}/g, '')
      .replace(/"tags"\s*:\s*\[[^\]]*\]/g, '')
    const referenced = new Set<string>()
    for (const match of body.matchAll(/"([a-z0-9_]+:[a-z0-9_/]+)"/gi)) referenced.add(match[1])
    // A recipe only ships if every ingredient it needs is in the pack.
    let selfContained = true
    for (const id of referenced) {
      if (id.startsWith('minecraft:') || imported.has(id)) continue
      selfContained = false
      break
    }
    if (!selfContained) continue
    // Recipe files are discovered by folder scan, so renaming is safe and keeps
    // a donor `bandage.json` from clobbering the one we generate ourselves.
    const base = entry.rootless.split('/').pop() ?? entry.rootless
    await copy(entry, true, 'bp', source.key, `recipes/${source.key}_${base}`)
    recipeCount++
  }

  stats.push({
    key: source.key,
    label: source.label,
    items: items.filter((item) => item.source === source.key).length,
    files: files.length,
    bytes,
    modernisedSlots: modernised,
    skipped: skipped.slice(0, 6),
  })
  if (skippedNoTextures.length > 0) console.log(`   !! aucun item_texture lisible chez ${source.key}`)
  console.log(
    `${source.key}: ${items.filter((i) => i.source === source.key).length} pièces · ` +
      `${recipeCount} recettes · slots normalisés ${modernised} · ${(bytes / 1048576).toFixed(1)} Mo`,
  )
  if (skipped.length > 0) console.log(`   ignoré (échantillon) : ${skipped.slice(0, 4).join(', ')}`)
}

/* ---------------- write everything ---------------- */
rmSync(ROOT, { recursive: true, force: true })
for (const [path, data] of output) {
  const full = `${ROOT}/${path}`
  mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true })
  writeFileSync(full, data)
}

const manifest: HarvestManifest = {
  version: HARVEST_VERSION,
  generated: new Date().toISOString().slice(0, 10),
  note: 'Assets extraits des addons donneurs pour la fusion REMNANT. Usage personnel.',
  sources: stats,
  items,
  files,
  itemTextureEntries,
  lang,
}
mkdirSync(ROOT, { recursive: true })
writeFileSync(`${ROOT}/manifest.json`, `${JSON.stringify(manifest)}\n`)

const totalBytes = [...output.values()].reduce((sum, value) => sum + value.length, 0)
console.log(
  `TOTAL: ${items.length} pièces · ${output.size} fichiers · ${(totalBytes / 1048576).toFixed(1)} Mo · ` +
    `${Object.keys(itemTextureEntries).length} clés de texture · ${Object.keys(lang).length} noms`,
)
