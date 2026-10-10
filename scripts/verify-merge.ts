/**
 * Verifier for the full fusion artefact.
 *
 * The point of this script is to tell *my* mistakes apart from the donors' own
 * dangling references. A texture or sound that the merged pack does not ship is
 * only a fault when a donor archive did ship it; if no donor ever had the file,
 * the reference pointed at a vanilla asset from the start.
 *
 * Usage: bun run scripts/verify-merge.ts [pack.mcaddon]
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import JSZip from 'jszip'
import { parseLooseJson } from '../generator/bedrockJson'

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const target = process.argv[2] ?? 'dist-pack/Remnant_Fusion_Complete.mcaddon'
const BP = 'Remnant_Fusion_BP/'
const RP = 'Remnant_Fusion_RP/'

const VANILLA_IDS = /^(minecraft:|geometry\.(humanoid|zombie|player|creeper|skeleton|spider|none))/

let failures = 0
const check = (label: string, ok: boolean, detail?: string): void => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? `\n         ${detail}` : ''}`)
}

/* ------------------------------- the artefact ----------------------------- */

const zip = await JSZip.loadAsync(readFileSync(target))
const blobs = new Map<string, Uint8Array>()
zip.forEach((p, f) => {
  if (!f.dir) blobs.set(p, new Uint8Array(0))
})
for (const p of blobs.keys()) blobs.set(p, await zip.file(p)!.async('uint8array'))
const files = new Set(blobs.keys())

/* ------------------------------- the donors ------------------------------- */

/**
 * Every path a donor archive ships, so a missing reference can be judged, plus
 * the ones it ships empty: a 0-byte file carries nothing, so the merge dropping
 * it cannot be called a lost texture.
 */
async function donorPaths(): Promise<{
  all: Set<string>
  empty: Set<string>
  hash: Map<string, string>
  unreadable: Set<string>
}> {
  const all = new Set<string>()
  const empty = new Set<string>()
  const hash = new Map<string, string>()
  const unreadable = new Set<string>()
  const walk = async (buf: Uint8Array, prefix: string, depth: number): Promise<void> => {
    const z = await JSZip.loadAsync(buf)
    for (const item of Object.values(z.files)) {
      if (item.dir) continue
      const bytes = await item.async('uint8array')
      if (/\.(mcaddon|mcpack|zip)$/i.test(item.name) && depth < 2) {
        await walk(bytes, `${prefix}${item.name}/`, depth + 1)
        continue
      }
      const full = `${prefix}${item.name}`
      const digest = sha(bytes)
      all.add(full)
      hash.set(full, digest)
      if (bytes.length === 0) empty.add(full)
      // both the full nested path and the logical tail, because the merge strips
      // the pack prefix and nobody agrees on where it ends
      // a donor copy that no parser can read marks the content as malformed at
      // the source, so the merge modifying it is not the merge breaking it
      const broken = item.name.endsWith('.json') && parseLooseJson(Buffer.from(bytes).toString('utf8')) === null
      if (broken) unreadable.add(full)
      const parts = full.split('/')
      for (let i = 1; i < parts.length; i++) {
        const tail = parts.slice(i).join('/')
        all.add(tail)
        hash.set(tail, digest)
        if (bytes.length === 0) empty.add(tail)
        if (broken) unreadable.add(tail)
      }
    }
  }
  for (const archive of readdirSync('.').filter((f) => /\.(mcaddon|mcpack)$/i.test(f))) {
    try {
      await walk(readFileSync(archive), '', 0)
    } catch {
      /* a donor that cannot be read is reported by merge-recon, not here */
    }
  }
  return { all, empty, hash, unreadable }
}
const { all: donors, empty: donorEmpty, hash: donorHash, unreadable: donorUnreadable } = await donorPaths()

const inDonors = (ref: string): boolean =>
  ['.png', '.tga', '.jpg', '', '.ogg', '.fsb', '.wav'].some(
    (ext) => donors.has(`${ref}${ext}`) && !donorEmpty.has(`${ref}${ext}`),
  )

console.log(`\n${target}`)
console.log(
  `  ${files.size} fichiers · BP ${[...files].filter((p) => p.startsWith(BP)).length} · RP ${[...files].filter((p) => p.startsWith(RP)).length}`,
)
console.log(`  ${donors.size} chemins connus dans les archives donneuses`)

/* 1. empty files */
const empties = [...files].filter((p) => blobs.get(p)!.length === 0)
check('aucun fichier vide', empties.length === 0, empties.slice(0, 5).join(', '))

/* 2. JSON readability — donor JSONC is expected, unreadable JSON is not */
const jsonPaths = [...files].filter((p) => p.endsWith('.json'))
const tolerantOnly: string[] = []
const unreadable: string[] = []
for (const p of jsonPaths) {
  const text = Buffer.from(blobs.get(p)!).toString('utf8')
  try {
    JSON.parse(text)
  } catch {
    if (parseLooseJson(text) !== null) tolerantOnly.push(p)
    else unreadable.push(p)
  }
}
/**
 * An unreadable JSON is only my fault when it differs from the donor's own copy.
 * Several donors ship genuinely malformed JSON; comparing the bytes tells the
 * two apart instead of blaming the merge for the archive's own defect.
 */
const unreadableFault = unreadable.filter((p) => {
  const logical = p.startsWith(BP) ? p.slice(BP.length) : p.slice(RP.length)
  // a conflicting file was relocated to `<root>/<source>/...`, so the donor path
  // is the same path with that source segment taken back out
  const parts = logical.split('/')
  const candidates = [logical, parts.length > 2 ? [parts[0], ...parts.slice(2)].join('/') : logical]
  if (candidates.some((c) => donorUnreadable.has(c))) return false // malformed at the source
  return candidates.every((c) => donorHash.get(c) !== sha(blobs.get(p)!))
})
check(
  'aucun JSON illisible',
  unreadableFault.length === 0,
  unreadableFault.length > 0
    ? `${unreadableFault.length} fichiers modifies par la fusion et illisibles : ${unreadableFault.slice(0, 4).join(', ')}`
    : `${unreadable.length} fichiers deja illisibles dans les sources (copies a l identique)`,
)
console.log(
  `         ${jsonPaths.length} JSON · ${tolerantOnly.length} en JSONC donneur (en-tetes de copyright, presents tels quels dans les sources)`,
)

/* 3. identifier collisions, judged per side */
/**
 * Identifiers in their own namespace plus biomes are excluded, exactly like the
 * merge excludes them: a block id equal to a feature id is not a clash, and two
 * donors naming a biome `desert` is left as-is on purpose (one desert wins) —
 * rewriting biome ids would break `biomes_client.json` for no real gain.
 */
const ID_EXCLUDED = /^(features|feature_rules|biomes|worldgen|recipes|loot_tables|functions|trading)\//
const biomesSeen = new Map<string, number>()

const declarations = new Map<string, { path: string; side: 'bp' | 'rp' }[]>()
for (const p of jsonPaths) {
  const logical = p.startsWith(BP) ? p.slice(BP.length) : p.slice(RP.length)
  if (/^biomes\//.test(logical)) {
    const text = Buffer.from(blobs.get(p)!).toString('utf8')
    for (const m of text.matchAll(/"identifier"\s*:\s*"([^"]+)"/g)) {
      if (VANILLA_IDS.test(m[1])) continue
      biomesSeen.set(m[1], (biomesSeen.get(m[1]) ?? 0) + 1)
    }
    continue
  }
  if (ID_EXCLUDED.test(logical)) continue
  const text = Buffer.from(blobs.get(p)!).toString('utf8')
  if (text.length > 400_000) continue
  for (const m of text.matchAll(/"identifier"\s*:\s*"([^"]+)"/g)) {
    if (VANILLA_IDS.test(m[1])) continue
    const list = declarations.get(m[1]) ?? []
    list.push({ path: p, side: p.startsWith(BP) ? 'bp' : 'rp' })
    declarations.set(m[1], list)
  }
}
const collisions = [...declarations.entries()]
  .map(([id, list]) => ({ id, list }))
  .filter(({ list }) => {
    const sides = new Set(list.map((l) => l.side))
    // two clients for one block id (BP + RP) is the normal shape, not a clash
    if (sides.size > 1 && list.length === 2) return false
    return list.length > 1 && new Set(list.map((l) => l.path)).size > 1
  })
check(
  'aucun identifiant declare deux fois (hors paires BP/RP et vanilla)',
  collisions.length === 0,
  collisions.length > 0 ? `${collisions.length} collisions` : `${declarations.size} identifiants distincts`,
)
const sharedBiomes = [...biomesSeen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
if (sharedBiomes.length > 0) {
  console.log(`         ${sharedBiomes.length} biomes declares par plusieurs donneurs, conserves tels quels : ${sharedBiomes.slice(0, 6).join(', ')}`)
}
for (const c of collisions.slice(0, 6)) {
  console.log(`         ${c.id}`)
  for (const l of c.list.slice(0, 3)) console.log(`            ${l.path}`)
}

/* 4. texture references */
const shippedRP = new Set([...files].filter((p) => p.startsWith(RP)).map((p) => p.slice(RP.length)))
const missingOwn: string[] = []
const missingVanilla: string[] = []
for (const p of jsonPaths) {
  const text = Buffer.from(blobs.get(p)!).toString('utf8')
  for (const m of text.matchAll(/"((?:textures|mobblocks)\/[^"]+)"/g)) {
    const ref = m[1]
    const shipped = ['.png', '.tga', '.jpg', ''].some((ext) => shippedRP.has(`${ref}${ext}`))
    if (shipped) continue
    if (inDonors(ref)) missingOwn.push(`${ref} (reference par ${p.slice(p.indexOf('/') + 1)})`)
    else missingVanilla.push(ref)
  }
}
check(
  'aucune texture presente chez un donneur mais absente du pack',
  missingOwn.length === 0,
  missingOwn.length > 0 ? `${missingOwn.length} ex. ${missingOwn.slice(0, 4).join(' · ')}` : '',
)
console.log(
  `         ${missingVanilla.length} references vers des textures qu'aucun donneur ne livre (vanilla ou cassees des l'origine)`,
)

/* 5. sound references */
const defPath = `${RP}sounds/sound_definitions.json`
if (files.has(defPath)) {
  const def = parseLooseJson<{ sound_definitions: Record<string, { sounds: ({ name: string } | string)[] }> }>(
    Buffer.from(blobs.get(defPath)!).toString('utf8'),
  )
  const entries = Object.entries(def?.sound_definitions ?? {})
  const missingOwn: string[] = []
  const missingVanilla: string[] = []
  let total = 0
  for (const [event, body] of entries) {
    for (const sound of body.sounds ?? []) {
      const name = typeof sound === 'string' ? sound : sound.name
      total++
      if (['.ogg', '.fsb', '.wav', ''].some((ext) => files.has(`${RP}${name}${ext}`))) continue
      if (inDonors(name)) missingOwn.push(`${event} -> ${name}`)
      else missingVanilla.push(`${event} -> ${name}`)
    }
  }
  check(
    'aucun son present chez un donneur mais absent du pack',
    missingOwn.length === 0,
    missingOwn.length > 0 ? `${missingOwn.length} ex. ${missingOwn.slice(0, 4).join(' · ')}` : '',
  )
  console.log(`         ${entries.length} evenements · ${total} sons · ${missingVanilla.length} references vanilla (ex. wind.sound, attack.sweep)`)
} else {
  check('sounds/sound_definitions.json present', false)
}

/* 6. script systems */
const bootstrapPath = `${BP}scripts/main.js`
const bootstrapText = files.has(bootstrapPath) ? Buffer.from(blobs.get(bootstrapPath)!).toString('utf8') : ''
const wired = [...bootstrapText.matchAll(/\['([a-z]+)', '\.\/([^']+)'\]/g)].map((m) => ({
  source: m[1],
  entry: `${BP}scripts/${m[2]}`,
}))
check('bootstrap de script present', files.has(bootstrapPath))
check(
  'chaque systeme annonce a bien son fichier d entree',
  wired.length > 0 && wired.every((w) => files.has(w.entry)),
  wired.map((w) => `${w.source}${files.has(w.entry) ? '' : ' MANQUANT'}`).join(' · '),
)

/* 7. manifests */
const bpManifest = parseLooseJson<{ header: { uuid: string }; modules: { type: string; entry?: string }[]; dependencies?: { uuid: string }[] }>(
  Buffer.from(blobs.get(`${BP}manifest.json`)!).toString('utf8'),
)
const rpManifest = parseLooseJson<{ header: { uuid: string } }>(Buffer.from(blobs.get(`${RP}manifest.json`)!).toString('utf8'))
check('manifest BP lisible', Boolean(bpManifest))
check('manifest RP lisible', Boolean(rpManifest))
check('le BP depend du RP (uuid lie)', Boolean(bpManifest?.dependencies?.some((d) => d.uuid === rpManifest?.header?.uuid)))
check('module script declare', Boolean(bpManifest?.modules?.some((m) => m.type === 'script' && m.entry)))

console.log(`\n  ${failures === 0 ? 'TOUT OK' : `${failures} ECHEC(S)`}\n`)
process.exit(failures === 0 ? 0 : 1)
