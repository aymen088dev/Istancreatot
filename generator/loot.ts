import type { LootProfile, MobDef } from './mobs'
import { json } from './minecraft'
import type { GeneratedFile, PackConfig } from './types'

interface Entry {
  type: 'item'
  name: string
  weight: number
  functions?: unknown[]
}

function count(min: number, max: number): unknown[] {
  return [{ function: 'set_count', count: { min, max } }]
}

const RARE_POOL: { id: string; weight: number; min: number; max: number }[] = [
  { id: 'minecraft:diamond', weight: 2, min: 1, max: 1 },
  { id: 'minecraft:gold_ingot', weight: 3, min: 1, max: 2 },
  { id: 'minecraft:emerald', weight: 3, min: 1, max: 3 },
  { id: 'minecraft:obsidian', weight: 1, min: 1, max: 1 },
]

/** Loot table for one mob. Availability filters out disabled custom items. */
export function lootTableFile(
  mob: MobDef,
  cfg: PackConfig,
  availableIds: Set<string>,
): GeneratedFile | null {
  if (mob.loot === 'none') return null
  const ns = cfg.namespace
  const scarce = cfg.mechanics.scarceLoot
  const scale = scarce ? 0.6 : 1
  const w = (n: number) => Math.max(1, Math.round(n * scale))
  const has = (id: string) => availableIds.has(id)
  const item = (name: string) => ({ type: 'item' as const, name, weight: 1 })

  const scraps: Entry[] = []
  const rares: Entry[] = []

  const profile: LootProfile = mob.loot

  if (profile === 'undead' || profile === 'undead_elite') {
    scraps.push(
      { type: 'item', name: 'minecraft:rotten_flesh', weight: w(10), functions: count(1, scarce ? 1 : 2) },
      { type: 'item', name: 'minecraft:bone', weight: w(5) },
      { type: 'item', name: 'minecraft:string', weight: w(4) },
      { type: 'item', name: 'minecraft:iron_nugget', weight: w(3), functions: count(1, 3) },
      { type: 'item', name: 'minecraft:coal', weight: w(2) },
    )
  }
  if (profile === 'undead_elite') {
    scraps.push(
      { type: 'item', name: 'minecraft:iron_ingot', weight: w(3) },
      { type: 'item', name: 'minecraft:gold_nugget', weight: w(3), functions: count(1, 4) },
    )
    if (has('painkiller')) rares.push({ ...item(`${ns}:painkiller`), weight: 3 })
  }
  if (profile === 'beast') {
    scraps.push(
      { type: 'item', name: 'minecraft:leather', weight: w(5), functions: count(1, 2) },
      { type: 'item', name: 'minecraft:bone', weight: w(4) },
      { type: 'item', name: 'minecraft:rotten_flesh', weight: w(6), functions: count(1, 2) },
    )
  }
  if (profile === 'livestock') {
    scraps.push(
      { type: 'item', name: 'minecraft:leather', weight: w(4) },
      { type: 'item', name: 'minecraft:rotten_flesh', weight: w(5), functions: count(1, 2) },
      { type: 'item', name: 'minecraft:bone', weight: w(2) },
    )
  }
  if (profile === 'bird') {
    scraps.push(
      { type: 'item', name: 'minecraft:feather', weight: w(5), functions: count(1, 3) },
      { type: 'item', name: 'minecraft:rotten_flesh', weight: w(3) },
      { type: 'item', name: 'minecraft:chicken', weight: w(2) },
    )
  }
  if (profile === 'human') {
    scraps.push(
      { type: 'item', name: 'minecraft:bread', weight: w(3) },
      { type: 'item', name: 'minecraft:paper', weight: w(3) },
      { type: 'item', name: 'minecraft:iron_ingot', weight: w(2) },
      { type: 'item', name: 'minecraft:string', weight: w(2) },
    )
    if (has('lockpick')) rares.push({ ...item(`${ns}:lockpick`), weight: 2 })
  }
  if (profile === 'military') {
    scraps.push(
      { type: 'item', name: 'minecraft:iron_ingot', weight: w(4), functions: count(1, 2) },
      { type: 'item', name: 'minecraft:gunpowder', weight: w(3), functions: count(1, 2) },
      { type: 'item', name: 'minecraft:copper_ingot', weight: w(3) },
      { type: 'item', name: 'minecraft:iron_nugget', weight: w(4), functions: count(2, 5) },
    )
    if (has('ammo_9mm')) rares.push({ type: 'item', name: `${ns}:ammo_9mm`, weight: 4, functions: count(4, 12) })
    if (has('ammo_556')) rares.push({ type: 'item', name: `${ns}:ammo_556`, weight: 3, functions: count(4, 10) })
    if (has('shells')) rares.push({ type: 'item', name: `${ns}:shells`, weight: 2, functions: count(2, 6) })
    if (has('ammo_308')) rares.push({ type: 'item', name: `${ns}:ammo_308`, weight: 1, functions: count(2, 5) })
  }
  if (profile === 'boss') {
    scraps.push(
      { type: 'item', name: 'minecraft:iron_ingot', weight: w(6), functions: count(3, 8) },
      { type: 'item', name: 'minecraft:gunpowder', weight: w(5), functions: count(3, 6) },
      { type: 'item', name: 'minecraft:gold_ingot', weight: w(4), functions: count(2, 5) },
      { type: 'item', name: 'minecraft:rotten_flesh', weight: w(6), functions: count(2, 6) },
    )
    rares.push(
      { type: 'item', name: 'minecraft:diamond', weight: 8, functions: count(2, 4) },
      { type: 'item', name: 'minecraft:netherite_scrap', weight: 3, functions: count(1, 2) },
      { type: 'item', name: 'minecraft:golden_apple', weight: 4 },
    )
    if (has('medkit')) rares.push({ type: 'item', name: `${ns}:medkit`, weight: 5, functions: count(1, 2) })
    if (has('rockets')) rares.push({ type: 'item', name: `${ns}:rockets`, weight: 3, functions: count(2, 4) })
    if (has('assault_rifle')) rares.push({ type: 'item', name: `${ns}:assault_rifle`, weight: 2 })
    if (has('sniper_rifle')) rares.push({ type: 'item', name: `${ns}:sniper_rifle`, weight: 2 })
    if (has('composite_chestplate')) rares.push({ type: 'item', name: `${ns}:composite_chestplate`, weight: 2 })
    if (has('juggernaut_helmet')) rares.push({ type: 'item', name: `${ns}:juggernaut_helmet`, weight: 2 })
    if (has('ceramic_leggings')) rares.push({ type: 'item', name: `${ns}:ceramic_leggings`, weight: 3 })
  }

  if (scraps.length === 0 && rares.length === 0) return null

  if (has('bandage') && (profile === 'undead' || profile === 'human' || profile === 'military')) {
    scraps.push({ type: 'item', name: `${ns}:bandage`, weight: w(3) })
  }
  if (has('medkit') && profile === 'undead_elite') {
    rares.push({ type: 'item', name: `${ns}:medkit`, weight: 1 })
  }
  if (has('molotov') && profile === 'undead_elite') {
    rares.push({ type: 'item', name: `${ns}:molotov`, weight: 2 })
  }
  if (has('water_clean') && profile === 'human') {
    rares.push({ type: 'item', name: `${ns}:water_clean`, weight: 3 })
  }

  const pools: unknown[] = [{ rolls: scarce ? 1 : { min: 1, max: 2 }, entries: scraps }]

  const rareEntries: Entry[] = [...rares]
  if (profile === 'boss' || profile === 'military' || profile === 'undead_elite') {
    for (const rare of RARE_POOL) {
      rareEntries.push({
        type: 'item',
        name: rare.id,
        weight: rare.weight,
        functions: count(rare.min, rare.max),
      })
    }
  }
  if (rareEntries.length > 0) {
    const pool: Record<string, unknown> = { rolls: { min: 0, max: 1 }, entries: rareEntries }
    // « Butin rare » doit raréfier les trouvailles, pas les supprimer : sans ça
    // l'armure lourde et les diamants ne tombaient jamais.
    if (scarce) pool.conditions = [{ condition: 'random_chance', chance: 0.35 }]
    pools.push(pool)
  }

  return { path: `loot_tables/entities/${mob.id}.json`, content: json({ pools }) }
}
