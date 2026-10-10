import type { MobDef } from './mobs'
import { json } from './minecraft'
import type { GeneratedFile, PackConfig } from './types'

/**
 * Natural spawn rule. Bosses are excluded — the script summons them on horde
 * nights instead. Returns null when the mob never spawns on its own.
 */
export function spawnRuleFile(mob: MobDef, cfg: PackConfig): GeneratedFile | null {
  if (!mob.natural || mob.boss) return null

  const boost = cfg.intensity === 3 ? 1.8 : cfg.intensity === 2 ? 1.25 : 1
  const dangerous = mob.damage >= 8 || mob.group === 'boss'
  const weight = Math.max(1, Math.round((mob.spawnWeight ?? 5) * (dangerous ? boost : 1)))
  const conditions: Record<string, unknown> = {
    'minecraft:spawns_on_surface': {},
    'minecraft:spawns_underground': {},
    'minecraft:brightness_filter': { min: 0, max: mob.nightOnly ? 7 : 15, adjust_for_weather: true },
    'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
    'minecraft:weight': { default: weight },
    'minecraft:herd': { min_size: mob.herdMin ?? 1, max_size: mob.herdMax ?? 1 },
    'minecraft:biome_filter': {
      test: 'has_biome_tag',
      operator: '==',
      value: 'monster',
    },
  }

  const doc = {
    format_version: '1.8.0',
    'minecraft:spawn_rules': {
      description: {
        identifier: `${cfg.namespace}:${mob.id}`,
        population_control: mob.hostile ? 'monster' : 'animal',
      },
      conditions: [conditions],
    },
  }

  return { path: `spawn_rules/${mob.id}.json`, content: json(doc) }
}
