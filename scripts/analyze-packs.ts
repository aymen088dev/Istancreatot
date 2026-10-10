import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'

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
      await collectEntries(await item.async('uint8array'), depth + 1, acc)
      continue
    }
    const size = (item as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    acc.push({ path: item.name, size, entry: item })
  }
}

interface ArmorPiece {
  file: string
  identifier: string
  slot: string
  protection: string
  durability: string
  material: string
}

interface PackReport {
  archive: string
  entries: number
  items: number
  entities: number
  blocks: number
  animations: number
  renderControllers: number
  geometry: number
  ui: number
  scripts: { path: string; size: number }[]
  armor: ArmorPiece[]
  armorSets: string[]
  weapons: string[]
  bars: string[]
  barEvidence: string[]
}

const archives = readdirSync('.').filter((f) => /\.(mcaddon|mcpack|zip)$/i.test(f))
const reports: PackReport[] = []

for (const archive of archives) {
  const entries: Entry[] = []
  try {
    await collectEntries(readFileSync(archive), 0, entries)
  } catch (e) {
    console.log(`!! ${archive}: ${(e as Error).message}`)
    continue
  }

  const report: PackReport = {
    archive,
    entries: entries.length,
    items: entries.filter((e) => /\/items\/.*\.json$/i.test(e.path)).length,
    entities: entries.filter((e) => /\/entities\/.*\.json$/i.test(e.path)).length,
    blocks: entries.filter((e) => /\/blocks\/.*\.json$/i.test(e.path)).length,
    animations: entries.filter((e) => /\/animations\/.*\.json$/i.test(e.path)).length,
    renderControllers: entries.filter((e) => /render_controllers\/.*\.json$/i.test(e.path)).length,
    geometry: entries.filter((e) => e.path.endsWith('.geo.json')).length,
    ui: entries.filter((e) => /\/ui\/.*\.json$/i.test(e.path)).length,
    scripts: entries
      .filter((e) => /\.(js|ts)$/i.test(e.path))
      .map((e) => ({ path: e.path, size: e.size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 20),
    armor: [],
    armorSets: [],
    weapons: [],
    bars: [],
    barEvidence: [],
  }

  const seenSets = new Set<string>()
  const seenWeapons = new Set<string>()

  for (const entry of entries) {
    const lower = entry.path.toLowerCase()
    const isJson = lower.endsWith('.json')
    const isScript = /\.(js|ts)$/i.test(lower)

    // ---- armures ----
    if (isJson && /\/items\//.test(lower) && entry.size < 40_000) {
      const text = await entry.entry.async('string')
      if (text.includes('minecraft:wearable')) {
        const id = /"identifier"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? '?'
        const slot = /"slot"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? '?'
        const protection = /"protection"\s*:\s*(\d+)/.exec(text)?.[1] ?? '?'
        const durability = /"max_durability"\s*:\s*(\d+)/.exec(text)?.[1] ?? '?'
        const material = /"repair_items"[\s\S]{0,200}?"items"\s*:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? ''
        report.armor.push({ file: entry.path, identifier: id, slot, protection, durability, material: material.replace(/["\s]/g, '') })
        const set = id.split(':').pop()?.replace(/_(helmet|chestplate|leggings|boots|chest|legs|head|feet)$/, '') ?? id
        if (!seenSets.has(set)) {
          seenSets.add(set)
          report.armorSets.push(set)
        }
      }
    }

    // ---- armes / armes à feu ----
    if (isJson && /\/items\//.test(lower) && entry.size < 40_000) {
      const text = await entry.entry.async('string')
      if (/"(minecraft:damage|minecraft:shooter|minecraft:projectile)"/.test(text)) {
        const id = /"identifier"\s*:\s*"([^"]+)"/.exec(text)?.[1]
        if (id && !seenWeapons.has(id)) {
          seenWeapons.add(id)
          report.weapons.push(id)
        }
      }
    }

    // ---- barres de vie / énergie / HUD ----
    if ((isJson && entry.size < 200_000) || (isScript && entry.size < 500_000)) {
      const text = await entry.entry.async('string')
      const hits: string[] = []
      if (/health_?bar|healthbar/i.test(text)) hits.push('health_bar')
      if (/energy_?bar|energybar|stamina/i.test(text)) hits.push('energy/stamina')
      if (/progress_?bar|progressbar/i.test(text)) hits.push('progress_bar')
      if (/hud_screen|ui\/hud|hud\.json/i.test(text)) hits.push('hud_screen')
      if (/thirst|hydration/i.test(text)) hits.push('thirst')
      if (/hunger|food_?level/i.test(text)) hits.push('hunger')
      if (/temperature|body_?temp/i.test(text)) hits.push('temperature')
      if (/bleeding|blood_?loss/i.test(text)) hits.push('bleeding')
      if (hits.length > 0) {
        for (const hit of hits) if (!report.bars.includes(hit)) report.bars.push(hit)
        if (report.barEvidence.length < 8) report.barEvidence.push(`${entry.path} -> ${hits.join(', ')}`)
      }
    }
  }

  reports.push(report)
}

mkdirSync('analysis', { recursive: true })
writeFileSync('analysis/packs.json', `${JSON.stringify(reports, null, 2)}\n`)

for (const r of reports) {
  console.log(`\n### ${r.archive}`)
  console.log(
    `  entrées ${r.entries} · items ${r.items} · entités ${r.entities} · blocs ${r.blocks} · anim ${r.animations} · render_ctrl ${r.renderControllers} · geo ${r.geometry} · ui ${r.ui}`,
  )
  console.log(`  ARMURES: ${r.armor.length} pièces, ${r.armorSets.length} sets -> ${r.armorSets.slice(0, 14).join(', ')}`)
  console.log(`  ARMES/DOMMAGE: ${r.weapons.length} -> ${r.weapons.slice(0, 12).join(', ')}`)
  console.log(`  BARRES/HUD: ${r.bars.join(', ') || '—'}`)
  if (r.scripts.length > 0) {
    console.log(`  SCRIPTS: ${r.scripts.map((s) => `${s.path.split('/').pop()} (${(s.size / 1024).toFixed(0)}Ko)`).join(', ')}`)
  }
}

console.log('\n=== ARMURES, DÉTAIL ===')
for (const r of reports) {
  for (const a of r.armor) {
    console.log(`${r.archive.split(' ')[0].padEnd(14)} ${a.identifier.padEnd(42)} ${a.slot.padEnd(18)} prot ${a.protection} · dur ${a.durability}`)
  }
}
