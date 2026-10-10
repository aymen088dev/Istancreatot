import type { PackConfig } from './types'

export interface BlockPlacement {
  dx: number
  dy: number
  dz: number
  block: string
}

export interface LootSpot {
  dx: number
  dy: number
  dz: number
  profile: 'supply' | 'military' | 'medical' | 'scrap'
}

export interface StructureBlueprint {
  id: string
  name: string
  places: BlockPlacement[]
  loot: LootSpot[]
}

/** Deterministic pseudo-random so a blueprint is stable between generations. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function add(list: BlockPlacement[], dx: number, dy: number, dz: number, block: string): void {
  list.push({ dx, dy, dz, block })
}

interface ShellOptions {
  w: number
  d: number
  h: number
  wall: string
  floor: string
  roof: string
  /** 0 = intact, 1 = completely ruined. */
  ruin?: number
  /** Which wall gets the doorway: '+x' | '-x' | '+z' | '-z'. */
  door?: '+x' | '-x' | '+z' | '-z'
  windows?: boolean
}

/** Hollow rectangular building: floor, four walls (with a door and windows) and a roof. */
function shell(opts: ShellOptions): BlockPlacement[] {
  const { w, d, h, wall, floor, roof, ruin = 0, door = '+z', windows = true } = opts
  const out: BlockPlacement[] = []
  let seed = 7

  const fromX = -Math.floor(w / 2)
  const fromZ = -Math.floor(d / 2)
  const toX = fromX + w - 1
  const toZ = fromZ + d - 1

  for (let x = fromX; x <= toX; x++) {
    for (let z = fromZ; z <= toZ; z++) {
      if (noise(seed++) < 0.12 * ruin) continue
      add(out, x, 0, z, floor)
    }
  }

  for (let y = 1; y <= h; y++) {
    for (let x = fromX; x <= toX; x++) {
      for (let z = fromZ; z <= toZ; z++) {
        const edgeX = x === fromX || x === toX
        const edgeZ = z === fromZ || z === toZ
        if (!edgeX && !edgeZ) continue

        // Doorway: a two-block-high opening in the middle of the chosen wall.
        if (y <= 2) {
          const midX = Math.floor((fromX + toX) / 2)
          const midZ = Math.floor((fromZ + toZ) / 2)
          if (door === '+z' && z === toZ && x === midX) continue
          if (door === '-z' && z === fromZ && x === midX) continue
          if (door === '+x' && x === toX && z === midZ) continue
          if (door === '-x' && x === fromX && z === midZ) continue
        }

        // Windows on the upper rows.
        if (windows && y === h && (x + z) % 3 === 0) continue

        if (ruin > 0 && noise(seed++) < ruin * 0.45) continue
        add(out, x, y, z, wall)
      }
    }
  }

  for (let x = fromX; x <= toX; x++) {
    for (let z = fromZ; z <= toZ; z++) {
      if (ruin > 0 && noise(seed++) < ruin * 0.6) continue
      add(out, x, h + 1, z, roof)
    }
  }

  return out
}

export function buildBlueprints(cfg: PackConfig): StructureBlueprint[] {
  const ns = cfg.namespace
  const blueprints: StructureBlueprint[] = []

  // Maison en ruine — le pillage d'entrée de jeu.
  {
    const places = shell({ w: 9, d: 9, h: 3, wall: 'minecraft:oak_planks', floor: 'minecraft:cobblestone', roof: 'minecraft:oak_planks', ruin: 0.7 })
    add(places, 2, 1, 2, 'minecraft:crafting_table')
    add(places, -2, 1, 2, 'minecraft:furnace')
    add(places, 3, 1, -3, 'minecraft:bookshelf')
    add(places, -3, 1, -3, 'minecraft:cauldron')
    add(places, 0, 1, 0, 'minecraft:chest')
    add(places, 1, 1, 3, 'minecraft:torch')
    add(places, -3, 1, 1, `${ns}:boarded_planks`)
    blueprints.push({
      id: 'ruined_house',
      name: 'Maison en ruine',
      places,
      loot: [{ dx: 0, dy: 1, dz: 0, profile: 'scrap' }],
    })
  }

  // Checkpoint militaire — armes et munitions.
  {
    const places = shell({ w: 13, d: 9, h: 3, wall: `${ns}:concrete_wall`, floor: 'minecraft:stone', roof: 'minecraft:stone', ruin: 0.15, door: '+z' })
    for (let x = -6; x <= 6; x++) add(places, x, 1, 4, `${ns}:sandbags`)
    for (let x = -6; x <= 6; x += 2) add(places, x, 1, 5, `${ns}:barbed_wire`)
    for (let z = -4; z <= 4; z += 2) add(places, 6, 1, z, `${ns}:barbed_wire`)
    add(places, -4, 1, 0, 'minecraft:chest')
    add(places, 4, 1, 0, 'minecraft:chest')
    add(places, 0, 1, -3, `${ns}:ammo_crate`)
    add(places, -2, 1, -3, 'minecraft:iron_bars')
    add(places, 2, 1, -3, 'minecraft:iron_bars')
    blueprints.push({
      id: 'military_checkpoint',
      name: 'Checkpoint militaire',
      places,
      loot: [
        { dx: -4, dy: 1, dz: 0, profile: 'military' },
        { dx: 4, dy: 1, dz: 0, profile: 'military' },
      ],
    })
  }

  // Hôpital — matériel médical.
  {
    const places = shell({ w: 11, d: 11, h: 4, wall: 'minecraft:stone_bricks', floor: 'minecraft:white_wool', roof: 'minecraft:stone_bricks', ruin: 0.25 })
    for (const x of [-3, 0, 3]) {
      for (const z of [-3, 0, 3]) {
        add(places, x, 1, z, 'minecraft:white_wool')
        add(places, x, 2, z, 'minecraft:white_wool')
      }
    }
    add(places, 2, 1, -2, `${ns}:medical_station`)
    add(places, -2, 1, -2, 'minecraft:cauldron')
    add(places, 0, 1, 0, 'minecraft:chest')
    add(places, 4, 1, 4, 'minecraft:chest')
    add(places, -4, 1, -4, `minecraft:glass`)
    blueprints.push({
      id: 'hospital',
      name: 'Hôpital de campagne',
      places,
      loot: [
        { dx: 0, dy: 1, dz: 0, profile: 'medical' },
        { dx: 4, dy: 1, dz: 4, profile: 'medical' },
      ],
    })
  }

  // Station-service — générateur et carburant.
  {
    const places = shell({ w: 9, d: 7, h: 3, wall: 'minecraft:stone', floor: 'minecraft:gravel', roof: 'minecraft:iron_block', ruin: 0.2 })
    for (let x = -4; x <= 4; x++) add(places, x, 4, 3, 'minecraft:iron_block')
    for (let z = 2; z <= 4; z++) add(places, -4, 4, z, 'minecraft:iron_block')
    add(places, 0, 1, 0, `${ns}:generator`)
    add(places, 3, 1, -2, 'minecraft:chest')
    add(places, -3, 1, -2, 'minecraft:furnace')
    add(places, 0, 1, 2, 'minecraft:campfire')
    blueprints.push({
      id: 'gas_station',
      name: 'Station-service',
      places,
      loot: [{ dx: 3, dy: 1, dz: -2, profile: 'supply' }],
    })
  }

  // Camp de survivants — PNJ, tourelle, caisses.
  {
    const places = shell({ w: 11, d: 9, h: 2, wall: 'minecraft:oak_fence', floor: 'minecraft:gravel', roof: 'minecraft:white_wool', ruin: 0.1, windows: false })
    add(places, 0, 1, 0, 'minecraft:campfire')
    add(places, 2, 1, 2, `${ns}:supply_crate`)
    add(places, -2, 1, 2, `${ns}:supply_crate`)
    add(places, 3, 1, -3, `${ns}:turret`)
    add(places, -3, 1, -3, `${ns}:turret`)
    add(places, 0, 1, -3, 'minecraft:chest')
    add(places, 4, 1, 0, 'minecraft:crafting_table')
    add(places, -4, 1, 0, `${ns}:medical_station`)
    blueprints.push({
      id: 'survivor_camp',
      name: 'Camp de survivants',
      places,
      loot: [{ dx: 0, dy: 1, dz: -3, profile: 'supply' }],
    })
  }

  // Ruines urbaines — le gros donjon de pillage.
  {
    const places = shell({ w: 13, d: 13, h: 5, wall: 'minecraft:stone_bricks', floor: 'minecraft:mossy_cobblestone', roof: 'minecraft:stone', ruin: 0.55 })
    add(places, 0, 1, 0, 'minecraft:chest')
    add(places, 3, 1, 3, 'minecraft:chest')
    add(places, -3, 1, -3, 'minecraft:chest')
    add(places, 2, 1, -4, `${ns}:spike_trap`)
    add(places, -2, 1, 4, `${ns}:spike_trap`)
    add(places, 4, 1, 0, `${ns}:boarded_planks`)
    add(places, -4, 1, 0, `${ns}:boarded_planks`)
    for (let i = 0; i < 12; i++) {
      const x = Math.round((noise(i * 3.1) - 0.5) * 10)
      const z = Math.round((noise(i * 7.7) - 0.5) * 10)
      add(places, x, 6, z, 'minecraft:cobblestone')
    }
    blueprints.push({
      id: 'city_ruins',
      name: 'Ruines urbaines',
      places,
      loot: [
        { dx: 0, dy: 1, dz: 0, profile: 'supply' },
        { dx: 3, dy: 1, dz: 3, profile: 'military' },
        { dx: -3, dy: 1, dz: -3, profile: 'medical' },
      ],
    })
  }

  return blueprints
}

export function structureScriptPayload(cfg: PackConfig) {
  if (!cfg.mechanics.structures) return { structures: [] as StructureBlueprint[] }
  return { structures: buildBlueprints(cfg) }
}
