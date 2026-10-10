/**
 * Verifies a built `.mcaddon`.
 *
 * Checks what a build exit code cannot: unparsable JSON, duplicate zip paths
 * (a later file silently overwrites an earlier one), texture keys pointing at
 * missing files, attachables referencing missing textures or undeclared
 * geometry, donor armour left on the legacy slot format, recipes with
 * ingredients that are not shipped, and every item resolving to an icon.
 *
 * Paths inside a `.mcaddon` are prefixed with `<folder>_BP/` / `<folder>_RP/`,
 * so every lookup is done on the pack-relative path.
 *
 * Usage: bun run scripts/verify-pack.ts [pack.mcaddon]
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import JSZip from 'jszip'
import { geometryIdentifiers, parseLooseJson } from '../generator/bedrockJson'

/**
 * Minimal PNG reader. Checking that a texture file *exists* is not enough: a
 * sheet painted in the wrong UV region is a perfectly valid PNG that renders
 * as nothing, which is exactly how an invisible helmet ships unnoticed.
 */
function readPng(bytes: Uint8Array): { w: number; h: number; alpha: (x: number, y: number) => number } | null {
  const buf = Buffer.from(bytes)
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null
  let off = 8
  let w = 0
  let h = 0
  let depth = 0
  let color = 0
  const idat: Buffer[] = []
  let palette: Buffer | null = null
  let trns: Buffer | null = null
  while (off + 8 <= buf.length) {
    const length = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + length)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      depth = data[8]
      color = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IEND') break
    off += 12 + length
  }
  void palette
  if (depth !== 8) return null
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color as 0 | 2 | 3 | 4 | 6]
  if (!channels) return null
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p++]
    const row = raw.subarray(p, p + stride)
    p += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let v = row[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 255
    }
  }
  return {
    w,
    h,
    alpha: (x, y) => {
      if (color === 6) return out[(y * w + x) * 4 + 3]
      if (color === 3) {
        const index = out[y * w + x]
        return trns && index < trns.length ? trns[index] : 255
      }
      return 255
    },
  }
}

const pack = process.argv[2] ?? 'dist-pack/Remnant_Apocalypse.mcaddon'
const VANILLA_TEXTURE = /^textures\/misc\/enchanted_(item|actor)_glint$/
const VANILLA_GEOMETRY = /^geometry\.humanoid\./

const zip = await JSZip.loadAsync(readFileSync(pack))
const entries = Object.values(zip.files).filter((file) => !file.dir).map((file) => file.name)

const rpPrefix = entries.find((name) => name.includes('_RP/'))?.split('_RP/')[0] + '_RP/'
const bpPrefix = entries.find((name) => name.includes('_BP/'))?.split('_BP/')[0] + '_BP/'
const rel = (name: string) => name.slice(name.indexOf('/') + 1)

const presentRp = new Set(entries.filter((n) => n.startsWith(rpPrefix)).map(rel))
const presentBp = new Set(entries.filter((n) => n.startsWith(bpPrefix)).map(rel))
const hasRp = (path: string) => ['.png', '.tga'].some((ext) => presentRp.has(`${path}${ext}`))

const parsed = new Map<string, unknown>()
const brokenJson: string[] = []
// Bedrock's parser tolerates comments and trailing commas, and some donors (Aplok)
// ship their files with a `/* copyright */` header, so `parseLooseJson` is the
// right reader here. Files that only parse that way are counted and reported: a
// genuinely broken file must never hide behind a tolerated quirk.
const lenientJson: string[] = []
for (const name of entries.filter((n) => n.endsWith('.json'))) {
  const text = await zip.file(name)!.async('string')
  const value = parseLooseJson(text)
  if (value === null) {
    brokenJson.push(`${rel(name)}: illisible`)
    continue
  }
  parsed.set(name, value)
  try {
    JSON.parse(text)
  } catch {
    lenientJson.push(rel(name))
  }
}

let failures = 0
function check(label: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${label}${detail ? ` -> ${detail}` : ''}`)
  if (!ok) failures++
}

console.log(`\n${pack}`)
console.log(`  ${entries.length} fichiers · BP ${presentBp.size} · RP ${presentRp.size}`)

/* ---------------- duplicate paths ---------------- */
const counts = new Map<string, number>()
for (const name of entries) counts.set(name, (counts.get(name) ?? 0) + 1)
const duplicates = [...counts].filter(([, count]) => count > 1).map(([name]) => rel(name))
check('aucun chemin duplique', duplicates.length === 0, duplicates.slice(0, 4).join(', '))

/* ---------------- JSON ---------------- */
const jsonCount = entries.filter((n) => n.endsWith('.json')).length
check(`${jsonCount} JSON lisibles par le jeu`, brokenJson.length === 0, brokenJson.slice(0, 3).join(' | '))
if (lenientJson.length > 0) {
  console.log(
    `        ${lenientJson.length} d'entre eux ne passent que par le lecteur tolerant aux commentaires`,
  )
  console.log(`        (en-tetes de copyright des donneurs, ex. ${lenientJson.slice(0, 2).join(', ')})`)
}

/* ---------------- item_texture ---------------- */
const itemTexture = parsed.get(`${rpPrefix}textures/item_texture.json`) as
  | { texture_data: Record<string, { textures: string | string[] }> }
  | undefined
const textureKeys = new Set(Object.keys(itemTexture?.texture_data ?? {}))
const missingTextures: string[] = []
for (const [key, value] of Object.entries(itemTexture?.texture_data ?? {})) {
  const path = Array.isArray(value.textures) ? value.textures[0] : value.textures
  if (typeof path === 'string' && !hasRp(path)) missingTextures.push(`${key} -> ${path}`)
}
check(`${textureKeys.size} cles item_texture resolues`, missingTextures.length === 0, missingTextures.slice(0, 3).join(' | '))

/* ---------------- declared geometry / animations ---------------- */
// Geometry lives in `*.geo.json` for some packs and in plain `models/**/*.json`
// for others, and uses three different identifier shapes, so derive the declared
// set from the JSON content itself.
const declaredGeometry = new Set<string>()
for (const data of parsed.values()) {
  for (const identifier of geometryIdentifiers(data)) declaredGeometry.add(identifier)
}

/* ---------------- attachables ---------------- */
let textureRefs = 0
let shippedTextures = 0
let vanillaTextures = 0
const brokenTextures: string[] = []
const brokenGeometry: string[] = []
for (const name of entries.filter((n) => n.startsWith(rpPrefix) && n.includes('/attachables/'))) {
  const data = parsed.get(name) as
    | {
        'minecraft:attachable'?: {
          description?: { textures?: Record<string, string>; geometry?: Record<string, string> }
        }
      }
    | undefined
  const description = data?.['minecraft:attachable']?.description
  for (const value of Object.values(description?.textures ?? {})) {
    if (!value.startsWith('textures/')) continue
    textureRefs++
    if (VANILLA_TEXTURE.test(value)) vanillaTextures++
    else if (hasRp(value)) shippedTextures++
    else brokenTextures.push(`${rel(name)} -> ${value}`)
  }
  for (const value of Object.values(description?.geometry ?? {})) {
    if (VANILLA_GEOMETRY.test(value)) continue
    if (!declaredGeometry.has(value)) brokenGeometry.push(`${rel(name)} -> ${value}`)
  }
}
check(
  `${textureRefs} textures d attachables (${shippedTextures} fournies, ${vanillaTextures} vanilla)`,
  brokenTextures.length === 0,
  brokenTextures.slice(0, 4).join(' | '),
)
check(
  `${declaredGeometry.size} geometries declarees, toutes referencees valides`,
  brokenGeometry.length === 0,
  brokenGeometry.slice(0, 4).join(' | '),
)

/* ---------------- items: slots and icons ---------------- */
const identifiers = new Set<string>()
const legacySlots: string[] = []
const missingIconKeys: string[] = []
let wearable = 0

function iconKeyOf(text: string): string | null {
  const flat = /"minecraft:icon"\s*:\s*"([^"]+)"/.exec(text)?.[1]
  if (flat) return flat
  const block = /"minecraft:icon"\s*:\s*\{([\s\S]{0,300}?)\n\s*\}/.exec(text)?.[1]
  if (!block) return null
  return /"texture"\s*:\s*"([^"]+)"/.exec(block)?.[1] ?? /"default"\s*:\s*"([^"]+)"/.exec(block)?.[1] ?? null
}

const itemPaths = entries.filter((n) => n.startsWith(bpPrefix) && n.includes('/items/'))
for (const name of itemPaths) {
  const text = await zip.file(name)!.async('string')
  const data = parsed.get(name) as
    | {
        'minecraft:item'?: {
          description?: { identifier?: string }
          components?: { 'minecraft:wearable'?: { slot?: string }; 'minecraft:icon'?: unknown }
        }
      }
    | undefined
  const item = data?.['minecraft:item']
  const identifier = item?.description?.identifier
  if (identifier) identifiers.add(identifier)

  const slot = item?.components?.['minecraft:wearable']?.slot
  if (slot) {
    wearable++
    if (!slot.startsWith('slot.armor.')) legacySlots.push(`${identifier} -> ${slot}`)
  }

  const key = iconKeyOf(text)
  if (key && !textureKeys.has(key)) missingIconKeys.push(`${identifier ?? rel(name)} -> ${key}`)
}

check(`${itemPaths.length} items · ${wearable} portables en slot.armor.*`, legacySlots.length === 0, legacySlots.slice(0, 4).join(' | '))
check('chaque item pointe vers une icone declaree', missingIconKeys.length === 0, missingIconKeys.slice(0, 4).join(' | '))

// Microsoft marks the flat `texture` property as deprecated on 1.21+; icons
// written that way are the classic "item shows a blank/missing icon" bug.
const deprecatedIcon: string[] = []
for (const name of itemPaths) {
  const text = await zip.file(name)!.async('string')
  if (/"minecraft:icon"\s*:\s*\{\s*"texture"\s*:/.test(text)) deprecatedIcon.push(rel(name))
}
check('aucune icone a la forme depreciee', deprecatedIcon.length === 0, deprecatedIcon.slice(0, 3).join(', '))

/* ---------------- blocks ---------------- */
for (const name of entries.filter((n) => n.startsWith(bpPrefix) && n.includes('/blocks/'))) {
  const data = parsed.get(name) as
    | { 'minecraft:block'?: { description?: { identifier?: string } } }
    | undefined
  const identifier = data?.['minecraft:block']?.description?.identifier
  if (identifier) identifiers.add(identifier)
}

/* ---------------- recipes ---------------- */
const recipePaths = [...presentBp].filter((path) => path.startsWith('recipes/'))
const orphans: string[] = []
for (const path of recipePaths) {
  // Strip the recipe's own identifier and tags, then every remaining namespaced
  // id is an ingredient that must exist somewhere in the pack.
  const raw = JSON.stringify(parsed.get(`${bpPrefix}${path}`) ?? {})
    .replace(/"description":\{[\s\S]*?\}/g, '')
    .replace(/"tags":\[[^\]]*\]/g, '')
  for (const match of raw.matchAll(/"([a-z0-9_]+:[a-z0-9_/]+)"/gi)) {
    const id = match[1]
    if (id.startsWith('minecraft:') || identifiers.has(id)) continue
    orphans.push(`${path.split('/').pop()} -> ${id}`)
  }
}
check(`${recipePaths.length} recettes, ingredients tous presents`, orphans.length === 0, orphans.slice(0, 4).join(' | '))

/* ---------------- script ---------------- */
const scriptBody = await zip.file(`${bpPrefix}scripts/main.js`)!.async('string')
let scriptOk = true
let scriptError = ''
try {
  new Function(scriptBody.replace(/^import .*$/gm, ''))
} catch (error) {
  scriptOk = false
  scriptError = (error as Error).message
}
check(`main.js syntaxe (${(scriptBody.length / 1024).toFixed(0)} Ko)`, scriptOk, scriptError)
check('barres de survie presentes', /setActionBar\(line\)/.test(scriptBody) && /function bar\(/.test(scriptBody))

/* ---------------- imported content ---------------- */
console.log('\n  contenu importe des donneurs :')
for (const [label, pattern] of [
  ['structures .mcstructure', /\.mcstructure$/],
  ['features / regles', /\/feature(_rules)?\//],
  ['sons', /_RP\/sounds\//],
  ['geometries', /\.geo\.json$/],
  ['feuilles d armure (nous)', /models\/armor\/remnant_.*_layer_[12]\./],
] as const) {
  console.log(`    ${label.padEnd(26)} ${entries.filter((n) => pattern.test(n)).length}`)
}

/* ---------------- entity definitions ---------------- */
const behaviorEntities = [...presentBp].filter((path) => path.startsWith('entities/'))
const noDespawn: string[] = []
for (const path of behaviorEntities) {
  const data = parsed.get(`${bpPrefix}${path}`) as
    | { 'minecraft:entity'?: { components?: Record<string, unknown> } }
    | undefined
  const components = data?.['minecraft:entity']?.components
  if (!components) {
    noDespawn.push(`${path} (sans composants)`)
    continue
  }
  if (!('minecraft:despawn' in components)) noDespawn.push(path.split('/').pop() ?? path)
}
check(
  `${behaviorEntities.length} entites, toutes avec minecraft:despawn`,
  noDespawn.length === 0,
  noDespawn.slice(0, 4).join(' | '),
)

/* ---------------- what the mobs actually render with ---------------- */
// Our mobs point at the game's own geometry/render controllers/textures. Those
// identifiers cannot be checked from here: they live inside the client, not in
// this pack. Listing them keeps the assumption visible instead of hidden.
const vanillaVisuals = new Set<string>()
let shippedVisualRefs = 0
for (const name of entries.filter((n) => n.startsWith(rpPrefix) && n.includes('/entity/'))) {
  const data = parsed.get(name) as
    | {
        'minecraft:client_entity'?: {
          description?: { textures?: Record<string, string>; geometry?: Record<string, string>; render_controllers?: string[] }
        }
      }
    | undefined
  const description = data?.['minecraft:client_entity']?.description
  for (const value of Object.values(description?.textures ?? {})) {
    if (hasRp(value)) shippedVisualRefs++
    else vanillaVisuals.add(`texture ${value}`)
  }
  for (const value of Object.values(description?.geometry ?? {})) {
    if (declaredGeometry.has(value)) shippedVisualRefs++
    else vanillaVisuals.add(`geometry ${value}`)
  }
  for (const value of description?.render_controllers ?? []) vanillaVisuals.add(`controller ${value}`)
}
console.log(
  `\n  mobs : ${shippedVisualRefs} references fournies par le pack, ` +
    `${vanillaVisuals.size} identifiants vanilla NON verifiables ici :`,
)
console.log(`    ${[...vanillaVisuals].sort().join('\n    ')}`)

/* ---------------- mob size: model vs hit box ---------------- */
// `minecraft:scale` (behaviour pack) multiplies the rendered model AND the
// collision box, so the numbers written in the file are not the size the mob
// occupies: the effective one is `collision_box * scale`. Vanilla baby zombies
// prove it (box 0.98 x 1.96 with scale 0.5, i.e. twice the intended size).
// Checking the product rather than the raw values is what catches a scale
// applied twice, which is how a Colosse ended up with a 1.87 x 4.76 hit box.
//
// The reference is the model's own height. Every geometry used here is a
// 1.95-block-tall humanoid or shorter (spider, chicken, cow, wolf, bear), so
// `scale * 1.95` is the tallest a mob can possibly render. A hit box up to 25%
// above that is allowed on purpose: keeping a generically-sized box on a
// slightly shrunken mob (the runner) is a legitimate design choice. Beyond 25%
// there is no benign explanation left — a scale applied twice produced 44% to
// 182% overshoot. Bosses are deliberately huge (Titan 2 x 4.5, Behemoth
// 2.5 x 5.5) and are nowhere near the limit.
const HUMAN_MODEL_HEIGHT = 1.95
interface MobBox {
  name: string
  raw: string
  width: number
  height: number
  sane: boolean
}
const mobBoxes: MobBox[] = []
for (const name of entries.filter(
  (n) => n.startsWith(bpPrefix) && /\/entit(y|ies)\//.test(n) && n.endsWith('.json'),
)) {
  const components = (parsed.get(name) as
    | { 'minecraft:entity'?: { components?: Record<string, unknown> } }
    | undefined)?.['minecraft:entity']?.components
  const box = components?.['minecraft:collision_box'] as { width?: number; height?: number } | undefined
  if (typeof box?.width !== 'number' || typeof box?.height !== 'number') continue
  const scale = (components?.['minecraft:scale'] as { value?: number } | undefined)?.value ?? 1
  const width = box.width * scale
  const height = box.height * scale
  const ceiling = scale * HUMAN_MODEL_HEIGHT
  mobBoxes.push({
    name: (name.split('/').pop() ?? name).replace(/\.json$/, ''),
    raw: `${box.width}x${box.height} a l echelle ${scale}`,
    width,
    height,
    sane: height > 0.3 && width > 0.2 && height <= ceiling * 1.25,
  })
}
const insane = mobBoxes.filter((mob) => !mob.sane)
check(
  `${mobBoxes.length} mobs : hit box reelle = collision_box x scale`,
  mobBoxes.length > 0 && insane.length === 0,
  insane.slice(0, 3).map((mob) => `${mob.name} ${mob.width.toFixed(2)}x${mob.height.toFixed(2)}`).join(', '),
)
if (mobBoxes.length > 0) {
  const biggest = [...mobBoxes].sort((a, b) => b.height - a.height).slice(0, 3)
  const smallest = [...mobBoxes].sort((a, b) => a.height - b.height).slice(0, 2)
  console.log(
    `        plus grands : ${biggest.map((m) => `${m.name} ${m.width.toFixed(2)}x${m.height.toFixed(2)}`).join(', ')}`,
  )
  console.log(
    `        plus petits : ${smallest.map((m) => `${m.name} ${m.raw}`).join(', ')}`,
  )
}

/* ---------------- armor sheets: is the content where the model looks? ---------------- */
// The outer head shell (the "hat" region) is what makes a helmet visible. A
// helmet sheet that paints only the inner head block renders as nothing.
const hatSheets: string[] = []
const hatProblems: string[] = []
for (const path of [...presentRp].filter((p) => /^textures\/models\/armor\/.*_layer_1\.png$/.test(p))) {
  hatSheets.push(path)
  const image = readPng(await zip.file(`${rpPrefix}${path}`)!.async('uint8array'))
  if (!image) {
    hatProblems.push(`${path} (illisible)`)
    continue
  }
  if (image.w !== 64 || image.h !== 32) {
    hatProblems.push(`${path} (${image.w}x${image.h}, 64x32 attendu)`)
    continue
  }
  let painted = 0
  for (let y = 0; y < 16; y++) {
    for (let x = 32; x < 64; x++) if (image.alpha(x, y) > 0) painted++
  }
  if (painted === 0) hatProblems.push(`${path} (region hat vide)`)
}
check(
  `${hatSheets.length} feuilles layer_1, region hat peinte (casques visibles)`,
  hatProblems.length === 0,
  hatProblems.slice(0, 3).join(' | '),
)

/* ---------------- fog ---------------- */
const fogPaths = [...presentRp].filter((path) => path.startsWith('fogs/'))
const declaredFogs = new Set<string>()
for (const path of fogPaths) {
  const data = parsed.get(`${rpPrefix}${path}`) as
    | { 'minecraft:fog_settings'?: { description?: { identifier?: string } } }
    | undefined
  const identifier = data?.['minecraft:fog_settings']?.description?.identifier
  if (identifier) declaredFogs.add(identifier)
}
const biomeFog = parsed.get(`${rpPrefix}biomes_client.json`) as
  | { biomes?: Record<string, { fog_identifier?: string }> }
  | undefined
const biomeFogIds = Object.values(biomeFog?.biomes ?? {}).map((entry) => entry.fog_identifier)
const unresolvedFog = biomeFogIds.filter((id) => !id || !declaredFogs.has(id))
check(`${fogPaths.length} brumes declarees`, fogPaths.length > 0, fogPaths.join(', '))
check(
  'biomes_client.json pointe vers une brume existante',
  biomeFogIds.length > 0 && unresolvedFog.length === 0,
  unresolvedFog.join(', '),
)
const scriptKnowsFogs = [...declaredFogs].every((id) => scriptBody.includes(id))
check('le script connait chaque brume', scriptKnowsFogs)
check('le script pousse/retire la brume', /fog @s push/.test(scriptBody) && /fog @s remove/.test(scriptBody))

/* ---------------- manifest / script module pairing ---------------- */
const bpManifest = parsed.get(`${bpPrefix}manifest.json`) as
  | { header?: { min_engine_version?: number[] }; dependencies?: { module_name?: string; version?: string }[] }
  | undefined
const scriptDep = bpManifest?.dependencies?.find((dep) => dep.module_name === '@minecraft/server')
const floor = bpManifest?.header?.min_engine_version ?? []
console.log(
  `\n  manifest : min_engine_version ${floor.join('.')} · @minecraft/server ${scriptDep?.version ?? 'absent'}`,
)
check(
  'module de script declare et non-beta',
  typeof scriptDep?.version === 'string' && !scriptDep.version.includes('-beta'),
  String(scriptDep?.version),
)

console.log(failures === 0 ? '\n  TOUT OK\n' : `\n  ${failures} ECHEC(S)\n`)
process.exit(failures === 0 ? 0 : 1)
