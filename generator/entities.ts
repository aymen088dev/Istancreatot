import { intensityTuning } from './options'
import { MOB_VISUALS, type MobDef } from './mobs'
import { json } from './minecraft'
import type { GeneratedFile, PackConfig } from './types'

export function entityId(cfg: PackConfig, mob: MobDef): string {
  return `${cfg.namespace}:${mob.id}`
}

/** Box sizes are divided by the scale, which leaves noise like 0.5714285714285715. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Undead groups burn in daylight unless the pack turns that off. */
function isUndead(mob: MobDef): boolean {
  return mob.group === 'zombie' || mob.group === 'boss' || mob.group === 'creature'
}

function families(cfg: PackConfig, mob: MobDef): string[] {
  const ns = cfg.namespace
  if (mob.group === 'zombie') return [`${ns}_zombie`, 'undead', 'monster', 'mob']
  if (mob.group === 'boss') return [`${ns}_zombie`, `${ns}_boss`, 'undead', 'monster', 'mob']
  if (mob.group === 'creature') return [`${ns}_infected`, 'undead', 'monster', 'mob']
  if (mob.group === 'npc') return [`${ns}_npc`, `${ns}_prey`, 'mob']
  return [`${ns}_hostile`, 'monster', 'mob']
}

interface Target {
  filters: Record<string, unknown>
  max_dist: number
}

function targetsFor(cfg: PackConfig, mob: MobDef): Target[] {
  const ns = cfg.namespace
  const tune = intensityTuning(cfg.intensity)
  const out: Target[] = []
  const family = (value: string, dist: number): Target => ({
    filters: { test: 'is_family', subject: 'other', value },
    max_dist: dist,
  })

  if (mob.targetsZombies) {
    out.push(family(`${ns}_zombie`, tune.detect))
    out.push(family('undead', tune.detect))
    return out
  }

  if (mob.hostile) {
    out.push(family('player', tune.detect))
    if (mob.group === 'zombie' || mob.group === 'boss' || mob.group === 'creature') {
      out.push(family('villager', Math.round(tune.detect * 0.7)))
      out.push(family('irongolem', Math.round(tune.detect * 0.6)))
      out.push(family(`${ns}_prey`, tune.detect))
      out.push(family(`${ns}_npc`, tune.detect))
      out.push(family(`${ns}_hostile`, Math.round(tune.detect * 0.8)))
    } else {
      // Bandits also rob survivors and fight the infected.
      out.push(family(`${ns}_npc`, Math.round(tune.detect * 0.8)))
      out.push(family(`${ns}_zombie`, Math.round(tune.detect * 0.8)))
    }
  }

  return out
}

export function behaviorEntityFile(mob: MobDef, cfg: PackConfig): GeneratedFile {
  const id = entityId(cfg, mob)
  const tune = intensityTuning(cfg.intensity)

  const components: Record<string, unknown> = {
    'minecraft:type_family': { family: families(cfg, mob) },
    'minecraft:health': { value: mob.health, max: mob.health },
    'minecraft:movement': { value: mob.speed },
    'minecraft:movement.basic': {},
    'minecraft:jump.static': {},
    'minecraft:navigation.walk': {
      can_path_over_water: true,
      avoid_water: false,
      can_pass_doors: true,
      can_open_doors: false,
    },
    // `minecraft:scale` (behaviour pack) multiplies the *rendered model and the
    // collision box together* — not just the model. Vanilla proves it: the baby
    // zombie pairs `scale: 0.5` with a box of `0.98 x 1.96`, i.e. twice the
    // intended effective size. `mob.width` / `mob.height` below are the size the
    // mob is meant to occupy in the world, so they are divided by the scale here;
    // writing them raw would apply the multiplier twice and give a Colosse a
    // 1.87 x 4.76 hit box instead of 1.1 x 2.8.
    'minecraft:collision_box': {
      width: round(mob.width / mob.scale),
      height: round(mob.height / mob.scale),
    },
    'minecraft:scale': { value: mob.scale },
    'minecraft:physics': {},
    'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: false },
    'minecraft:attack': { damage: mob.damage },
    'minecraft:knockback_resistance': {
      value: mob.group === 'boss' ? 1 : mob.scale >= 1.4 ? 0.75 : 0.1,
    },
    // Without `despawn` a custom mob never leaves the world, so hordes pile up
    // until the whole area is saturated.
    'minecraft:despawn': {
      despawn_from_distance: { min_distance: 44, max_distance: 128 },
    },
    'minecraft:behavior.hurt_by_target': { priority: 1 },
    'minecraft:behavior.random_stroll': { priority: 8, speed_multiplier: 0.6 },
    'minecraft:behavior.look_at_player': { priority: 9, look_distance: 12, probability: 0.4 },
    'minecraft:behavior.random_look_around': { priority: 10 },
  }

  // Stalkers hunt by smell: they keep a target they cannot see.
  const mustSee = mob.id !== 'zombie_stalker'
  const targets = targetsFor(cfg, mob)
  if (targets.length > 0) {
    components['minecraft:behavior.nearest_attackable_target'] = {
      priority: 2,
      must_see: mustSee,
      reselect_targets: true,
      within_radius: tune.detect,
      entity_types: targets,
    }
    components['minecraft:behavior.melee_attack'] = {
      priority: 3,
      speed_multiplier: 1,
      track_target: true,
    }
  }

  if (mob.ranged) {
    components['minecraft:shooter'] = { def: 'minecraft:arrow' }
    components['minecraft:behavior.ranged_attack'] = {
      priority: 4,
      attack_interval_min: mob.group === 'zombie' ? 2.5 : 1.5,
      attack_interval_max: mob.group === 'zombie' ? 4 : 3,
      attack_radius: mob.range ?? 20,
      burst_shots: mob.group === 'zombie' ? 1 : 3,
      burst_interval: 0.4,
      charge_charged_trigger: 0,
      charge_shoot_trigger: 0,
      speed_multiplier: 0.8,
    }
  }

  if (mob.trader) {
    components['minecraft:trade_table'] = {
      display_name: mob.name,
      table: `trading/${mob.id}.json`,
    }
    components['minecraft:behavior.trade_with_player'] = { priority: 2 }
    components['minecraft:nameable'] = {}
  }

  if (mob.loot !== 'none') {
    components['minecraft:loot'] = { table: `loot_tables/entities/${mob.id}.json` }
  }

  const sensors: Record<string, unknown>[] = []
  if (cfg.sunImmune && isUndead(mob)) {
    sensors.push({ cause: 'temperature', deals_damage: false })
  }
  if (mob.arrowProof) {
    sensors.push({ cause: 'projectile', deals_damage: false })
  }
  if (sensors.length > 0) {
    components['minecraft:damage_sensor'] = { triggers: sensors }
  }

  const doc = {
    format_version: '1.16.0',
    'minecraft:entity': {
      description: {
        identifier: id,
        is_spawnable: mob.natural,
        is_summonable: true,
        is_experimental: false,
      },
      component_groups: {},
      components,
      events: {},
    },
  }

  return { path: `entities/${mob.id}.json`, content: json(doc) }
}

export function clientEntityFile(mob: MobDef, cfg: PackConfig): GeneratedFile {
  const id = entityId(cfg, mob)
  const visual = MOB_VISUALS[mob.visual]

  const description: Record<string, unknown> = {
    identifier: id,
    materials: { default: visual.material },
    textures: { default: visual.texture },
    geometry: { default: visual.geometry },
    render_controllers: [visual.render],
  }

  if (mob.natural) {
    description.spawn_egg = { base_color: mob.accent, overlay_color: '#20261c' }
  }

  if (visual.animations === 'humanoid') {
    description.animations = {
      humanoid_base_pose: 'animation.humanoid.base_pose',
      look_at_target: 'animation.humanoid.look_at_target.default',
      move: 'animation.zombie.move',
      attack: 'animation.zombie.attack_bare_hand',
    }
    description.scripts = {
      animate: ['humanoid_base_pose', { move: 'query.modified_move_speed' }, 'look_at_target', 'attack'],
    }
  }

  return {
    path: `entity/${mob.id}.entity.json`,
    content: json({
      format_version: '1.10.0',
      'minecraft:client_entity': { description },
    }),
  }
}

const SUPPLY_TRADE = ['bandage', 'compress', 'water_clean', 'canned_beans', 'energy_bar', 'adrenaline']
const SUPPLY_WANT = ['minecraft:rotten_flesh', 'minecraft:bone', 'minecraft:iron_nugget', 'minecraft:emerald']

/** Villager-style trade table so the survivor NPC can be bartered with. */
export function tradeTableFile(
  mob: MobDef,
  cfg: PackConfig,
  availableIds: Set<string>,
): GeneratedFile {
  const ns = cfg.namespace
  const available = SUPPLY_TRADE.filter((id) => availableIds.has(id))
  const trades = available.map((id, index) => ({
    wants: [
      {
        item: SUPPLY_WANT[index % SUPPLY_WANT.length],
        quantity: 4 + index * 2,
      },
    ],
    gives: [{ item: `${ns}:${id}`, quantity: 1 + (index % 3) }],
  }))

  return {
    path: `trading/${mob.id}.json`,
    content: json({
      tiers: [
        {
          groups: [
            {
              num_to_select: 1,
              trades,
            },
          ],
        },
      ],
    }),
  }
}
