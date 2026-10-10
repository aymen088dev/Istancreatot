/**
 * Deep audit of the fusion.
 *
 * The merge verifier proves nothing was *lost*. This one asks the opposite
 * question: does everything the pack *points at* still resolve? A merged pack
 * breaks in game for one reason above all — a key that lived in one donor's
 * `item_texture.json` while the merged pack kept a different donor's copy.
 *
 * Every miss is judged against the donor archives: a reference that a donor
 * resolved but the fusion does not is a fault of the merge. A reference no donor
 * ever resolved was dangling to begin with.
 *
 * Usage: bun run scripts/audit-merge.ts [pack.mcaddon]
 */
import { readFileSync, readdirSync } from 'node:fs'
import JSZip from 'jszip'
import { geometryIdentifiers, parseLooseJson } from '../generator/bedrockJson'

const target = process.argv[2] ?? 'dist-pack/Remnant_Fusion_Complete.mcaddon'
const BP = 'Remnant_Fusion_BP/'
const RP = 'Remnant_Fusion_RP/'

const VANILLA_GEOMETRY = /^geometry\.(humanoid|zombie|player|creeper|skeleton|spider|none|armor_stand|villager)/

interface Inventory {
  itemTextures: Set<string>
  terrainTextures: Set<string>
  geometries: Set<string>
  renderControllers: Set<string>
  animations: Set<string>
  animationControllers: Set<string>
  soundEvents: Set<string>
  files: Set<string>
}

const emptyInventory = (): Inventory => ({
  itemTextures: new Set(),
  terrainTextures: new Set(),
  geometries: new Set(),
  renderControllers: new Set(),
  animations: new Set(),
  animationControllers: new Set(),
  soundEvents: new Set(),
  files: new Set(),
})

/** Reads one flat list of {path, text} into an inventory. */
function harvest(entries: { path: string; text: string }[], inv: Inventory): void {
  for (const { path, text } of entries) {
    inv.files.add(path)
    const lower = path.toLowerCase()
    const doc = parseLooseJson<Record<string, unknown>>(text)

    if (/textures\/item_texture\.json$/.test(lower)) {
      const data = (doc as { texture_data?: Record<string, unknown> } | null)?.texture_data ?? {}
      for (const key of Object.keys(data)) inv.itemTextures.add(key)
    }
    if (/textures\/terrain_texture\.json$/.test(lower)) {
      const data = (doc as { texture_data?: Record<string, unknown> } | null)?.texture_data ?? {}
      for (const key of Object.keys(data)) inv.terrainTextures.add(key)
    }
    if (/render_controllers\/.+\.json$/.test(lower) && doc) {
      const rc = (doc as { render_controllers?: Record<string, unknown> }).render_controllers ?? {}
      for (const key of Object.keys(rc)) inv.renderControllers.add(key)
    }
    if (/animations\/.+\.json$/.test(lower) && doc) {
      for (const key of Object.keys(doc)) if (key.startsWith('animation.')) inv.animations.add(key)
    }
    if (/animation_controllers\/.+\.json$/.test(lower) && doc) {
      const ac =
        (doc as { animation_controllers?: Record<string, unknown> }).animation_controllers ?? {}
      for (const key of Object.keys(ac)) inv.animationControllers.add(key)
      for (const key of Object.keys(doc)) if (key.startsWith('controller.animation.')) inv.animationControllers.add(key)
    }
    if (/models\/.+\.(geo\.)?json$/.test(lower)) {
      for (const id of geometryIdentifiers(doc)) inv.geometries.add(id)
    }
    if (/sounds\/sound_definitions\.json$/.test(lower)) {
      const defs =
        (doc as { sound_definitions?: Record<string, unknown> } | null)?.sound_definitions ?? {}
      for (const key of Object.keys(defs)) inv.soundEvents.add(key)
    }
  }
}

/* ------------------------------ the fusion -------------------------------- */

const zip = await JSZip.loadAsync(readFileSync(target))
const fusionFiles = new Set<string>()
const fusionText = new Map<string, string>()
zip.forEach((p, f) => {
  if (!f.dir) fusionFiles.add(p)
})
for (const p of fusionFiles) {
  if (!p.endsWith('.json')) continue
  const text = Buffer.from(await zip.file(p)!.async('uint8array')).toString('utf8')
  if (text.length < 2_000_000) fusionText.set(p, text)
}

const fusion = emptyInventory()
harvest([...fusionText.entries()].map(([path, text]) => ({ path, text })), fusion)

/* ------------------------------- the donors ------------------------------- */

/**
 * Donors are inventoried *per archive*, never as one union.
 *
 * A union lies: `bullet_12gauge` exists in three donors but not in the atlas of
 * the donor whose item points at it, so the union makes the merge look guilty for
 * a reference that was already dangling inside that pack.
 */
const donor = emptyInventory()
const perArchive = new Map<string, Inventory>()
const fileArchives = new Map<string, Set<string>>()

const walk = async (buf: Uint8Array, prefix: string, depth: number, archive: string): Promise<void> => {
  const z = await JSZip.loadAsync(buf)
  const inv = perArchive.get(archive) ?? emptyInventory()
  perArchive.set(archive, inv)
  for (const item of Object.values(z.files)) {
    if (item.dir) continue
    const bytes = await item.async('uint8array')
    if (/\.(mcaddon|mcpack|zip)$/i.test(item.name) && depth < 2) {
      await walk(bytes, `${prefix}${item.name}/`, depth + 1, archive)
      continue
    }
    const full = `${prefix}${item.name}`
    const tails = [full, ...full.split('/').slice(1).map((_, i) => full.split('/').slice(i + 1).join('/'))]
    for (const tail of tails) {
      const set = fileArchives.get(tail) ?? new Set<string>()
      set.add(archive)
      fileArchives.set(tail, set)
    }
    inv.files.add(full)
    if (!item.name.endsWith('.json') || bytes.length > 2_000_000) continue
    const text = Buffer.from(bytes).toString('utf8')
    harvest([{ path: item.name, text }], inv)
    harvest([{ path: item.name, text }], donor)
  }
}
for (const archive of readdirSync('.').filter((f) => /\.(mcaddon|mcpack)$/i.test(f))) {
  try {
    await walk(readFileSync(archive), '', 0, archive)
  } catch {
    /* merge-recon reports unreadable archives */
  }
}

/**
 * Was this key resolvable inside the very pack that references it? Only then is
 * the merge responsible for it no longer resolving.
 */
const wasResolvable = (file: string, key: string, field: 'itemTextures' | 'terrainTextures'): boolean => {
  const archives = fileArchives.get(file)
  if (!archives) return false
  for (const archive of archives) {
    if (perArchive.get(archive)?.[field].has(key)) return true
  }
  return false
}

/* ------------------------------- the checks ------------------------------- */

let faults = 0
const report = (label: string, missingOwn: string[], missingVanilla: number, total: number): void => {
  if (missingOwn.length > 0) faults++
  console.log(
    `  ${missingOwn.length === 0 ? 'ok   ' : 'ECHEC'} ${label} (${total} references)` +
      (missingOwn.length > 0 ? ` · ${missingOwn.length} cassées par la fusion` : '') +
      (missingVanilla > 0 ? ` · ${missingVanilla} deja orphelines chez les donneurs` : ''),
  )
  for (const m of missingOwn.slice(0, 6)) console.log(`         ${m}`)
}

console.log(`\n${target}`)

// 1. item icons — the classic merged-pack failure
{
  const missingOwn: string[] = []
  let missingVanilla = 0
  let total = 0
  for (const [path, text] of fusionText) {
    if (!path.startsWith(`${BP}items/`)) continue
    const doc = parseLooseJson<Record<string, unknown>>(text)
    const icon = (doc?.['minecraft:item'] as { components?: Record<string, unknown> } | undefined)
      ?.components?.['minecraft:icon'] as string | { texture?: string } | undefined
    if (icon === undefined) continue
    const key = typeof icon === 'string' ? icon : icon.texture
    if (!key) continue
    total++
    if (fusion.itemTextures.has(key)) continue
    if (wasResolvable(path.slice(BP.length), key, 'itemTextures')) missingOwn.push(`${key} (${path.slice(BP.length)})`)
    else missingVanilla++
  }
  report('icones d items resolues dans item_texture.json', missingOwn, missingVanilla, total)
}

// 2. block texture keys
{
  const missingOwn: string[] = []
  let missingVanilla = 0
  let total = 0
  for (const [path, text] of fusionText) {
    if (!path.startsWith(`${BP}blocks/`)) continue
    const doc = parseLooseJson<Record<string, unknown>>(text)
    const instances = (doc?.['minecraft:block'] as { components?: Record<string, unknown> } | undefined)
      ?.components?.['minecraft:material_instances'] as Record<string, { texture?: string }> | undefined
    if (!instances) continue
    for (const body of Object.values(instances)) {
      if (!body?.texture) continue
      total++
      if (fusion.terrainTextures.has(body.texture)) continue
      if (wasResolvable(path.slice(BP.length), body.texture, 'terrainTextures')) missingOwn.push(`${body.texture} (${path.slice(BP.length)})`)
      else missingVanilla++
    }
  }
  report('textures de blocs resolues dans terrain_texture.json', missingOwn, missingVanilla, total)
}

// 3. client entities
{
  const missingOwn: string[] = []
  let missingVanilla = 0
  let total = 0
  const push = (what: string, path: string): void => {
    if (donor.geometries.has(what) || donor.renderControllers.has(what) || donor.animations.has(what)) missingOwn.push(`${what} (${path.slice(RP.length)})`)
    else missingVanilla++
  }
  for (const [path, text] of fusionText) {
    if (!/^Remnant_Fusion_RP\/entity\/.+\.json$/.test(path)) continue
    const desc = (parseLooseJson<Record<string, { description?: Record<string, unknown> }>>(text)
      ?.['minecraft:client_entity']?.description ?? {}) as Record<string, unknown>
    const geometry = desc.geometry as Record<string, string> | undefined
    for (const id of Object.values(geometry ?? {})) {
      total++
      if (!fusion.geometries.has(id) && !VANILLA_GEOMETRY.test(id)) push(id, path)
    }
    for (const rc of (desc.render_controllers ?? []) as string[]) {
      total++
      if (!fusion.renderControllers.has(rc) && !/^(controller\.render\.(player|arrow|item))/.test(rc)) push(rc, path)
    }
    for (const a of Object.values((desc.animations ?? {}) as Record<string, string>)) {
      total++
      if (!fusion.animations.has(a) && !VANILLA_GEOMETRY.test(a) && !/^animation\.(humanoid|zombie|armor_stand)\./.test(a)) push(a, path)
    }
    for (const entry of (desc.scripts as { animate?: unknown[] } | undefined)?.animate ?? []) {
      const name = typeof entry === 'string' ? entry : Object.keys(entry as object)[0]
      if (!name || !name.includes('animation')) continue
      total++
      if (!fusion.animations.has(name) && !fusion.animationControllers.has(name)) push(name, path)
    }
  }
  report('geometries / render controllers / animations des entites clients', missingOwn, missingVanilla, total)
}

// 4. attachables
{
  const missingOwn: string[] = []
  let missingVanilla = 0
  let total = 0
  for (const [path, text] of fusionText) {
    if (!/^Remnant_Fusion_RP\/attachables\/.+\.json$/.test(path)) continue
    const desc = (parseLooseJson<Record<string, { description?: Record<string, unknown> }>>(text)
      ?.['minecraft:attachable']?.description ?? {}) as Record<string, unknown>
    for (const id of Object.values((desc.geometry ?? {}) as Record<string, string>)) {
      total++
      if (!fusion.geometries.has(id) && !VANILLA_GEOMETRY.test(id)) {
        if (donor.geometries.has(id)) missingOwn.push(`geometry ${id} (${path.slice(RP.length)})`)
        else missingVanilla++
      }
    }
    for (const rc of (desc.render_controllers ?? []) as string[]) {
      total++
      if (!fusion.renderControllers.has(rc)) {
        if (donor.renderControllers.has(rc)) missingOwn.push(`controller ${rc} (${path.slice(RP.length)})`)
        else missingVanilla++
      }
    }
  }
  report('geometries / render controllers des attachables', missingOwn, missingVanilla, total)
}

// 5. tick functions
{
  const tick = fusionText.get(`${BP}functions/tick.json`)
  const values = tick ? (parseLooseJson<{ values?: string[] }>(tick)?.values ?? []) : []
  const missing = values.filter((v) => !fusionFiles.has(`${BP}functions/${v}.mcfunction`))
  report('fonctions de tick resolues', missing, 0, values.length)
  if (missing.length > 0) console.log(`         ${values.length} fonctions listees dans tick.json`)
}

// 6. sounds referenced by sounds.json
{
  const soundsJson = fusionText.get(`${RP}sounds.json`)
  const doc = soundsJson ? parseLooseJson<Record<string, unknown>>(soundsJson) : null
  const referenced = new Set<string>()
  const collect = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.includes('.')) referenced.add(node)
      return
    }
    if (Array.isArray(node)) {
      for (const n of node) collect(n)
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      if (typeof record.sound === 'string') referenced.add(record.sound)
      for (const value of Object.values(record)) collect(value)
    }
  }
  collect(doc)
  const missing = [...referenced].filter((name) => !fusion.soundEvents.has(name))
  const missingOwn = missing.filter((name) => donor.soundEvents.has(name))
  const missingVanilla = missing.length - missingOwn.length
  report('evenements de son de sounds.json declares', missingOwn, missingVanilla, referenced.size)
}

console.log(`\n  ${faults === 0 ? 'AUCUNE REFERENCE CASSEE PAR LA FUSION' : `${faults} FAMILLE(S) DE REFERENCES CASSEES`}\n`)
process.exit(faults === 0 ? 0 : 1)
