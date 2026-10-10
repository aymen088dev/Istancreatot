import { enabledVariants, intensityTuning } from './options'
import { activeWeapons, weaponScriptPayload } from './weapons'
import { itemSpecs, itemScriptPayload } from './items'
import { blockScriptPayload } from './blocks'
import { armorPieces, armorScriptPayload } from './armor'
import { structureScriptPayload } from './structures'
import { fogScriptPayload } from './fog'
import { BOSSES, CREATURES, HOSTILES, NPCS } from './mobs'
import type { GeneratedFile, PackConfig } from './types'

interface ChestEntry {
  item: string
  min: number
  max: number
}

function chestLoot(cfg: PackConfig, availableIds: Set<string>): Record<string, ChestEntry[]> {
  const ns = cfg.namespace
  const has = (id: string) => availableIds.has(id)
  const loot: Record<string, ChestEntry[]> = {}

  const scrap: ChestEntry[] = [
    { item: 'minecraft:iron_ingot', min: 1, max: 3 },
    { item: 'minecraft:stick', min: 2, max: 5 },
    { item: 'minecraft:coal', min: 1, max: 3 },
    { item: 'minecraft:leather', min: 1, max: 2 },
  ]
  if (has('bandage')) scrap.push({ item: `${ns}:bandage`, min: 1, max: 3 })
  loot.scrap = scrap

  const supply: ChestEntry[] = [
    { item: 'minecraft:bread', min: 2, max: 5 },
    { item: 'minecraft:iron_ingot', min: 2, max: 5 },
    { item: 'minecraft:string', min: 2, max: 6 },
    { item: 'minecraft:torch', min: 4, max: 10 },
  ]
  if (has('canned_beans')) supply.push({ item: `${ns}:canned_beans`, min: 1, max: 3 })
  if (has('canned_meat')) supply.push({ item: `${ns}:canned_meat`, min: 1, max: 2 })
  if (has('water_clean')) supply.push({ item: `${ns}:water_clean`, min: 1, max: 3 })
  if (has('energy_bar')) supply.push({ item: `${ns}:energy_bar`, min: 1, max: 4 })
  loot.supply = supply

  const medical: ChestEntry[] = [
    { item: 'minecraft:paper', min: 2, max: 5 },
    { item: 'minecraft:golden_apple', min: 1, max: 1 },
    { item: 'minecraft:glass_bottle', min: 1, max: 3 },
  ]
  if (has('bandage')) medical.push({ item: `${ns}:bandage`, min: 2, max: 5 })
  if (has('compress')) medical.push({ item: `${ns}:compress`, min: 1, max: 3 })
  if (has('medkit')) medical.push({ item: `${ns}:medkit`, min: 1, max: 2 })
  if (has('antiviral')) medical.push({ item: `${ns}:antiviral`, min: 1, max: 2 })
  if (has('adrenaline')) medical.push({ item: `${ns}:adrenaline`, min: 1, max: 3 })
  if (has('splint')) medical.push({ item: `${ns}:splint`, min: 1, max: 2 })
  loot.medical = medical

  const military: ChestEntry[] = [
    { item: 'minecraft:iron_ingot', min: 3, max: 8 },
    { item: 'minecraft:gunpowder', min: 2, max: 6 },
    { item: 'minecraft:copper_ingot', min: 2, max: 6 },
    { item: 'minecraft:redstone', min: 2, max: 5 },
  ]
  if (has('ammo_9mm')) military.push({ item: `${ns}:ammo_9mm`, min: 8, max: 24 })
  if (has('ammo_556')) military.push({ item: `${ns}:ammo_556`, min: 8, max: 20 })
  if (has('shells')) military.push({ item: `${ns}:shells`, min: 4, max: 12 })
  if (has('ammo_308')) military.push({ item: `${ns}:ammo_308`, min: 3, max: 8 })
  if (has('grenade')) military.push({ item: `${ns}:grenade`, min: 1, max: 3 })
  if (has('riot_helmet')) military.push({ item: `${ns}:riot_helmet`, min: 1, max: 1 })
  loot.military = military

  return loot
}

export function configPayload(
  cfg: PackConfig,
  availableIds: Set<string>,
  soundEvents: string[] = [],
) {
  const tune = intensityTuning(cfg.intensity)
  const id = (suffix: string) => `${cfg.namespace}:${suffix}`
  const zombies = enabledVariants(cfg).map((v) => id(`zombie_${v.key}`))
  const creatures = cfg.mechanics.infectedFauna ? CREATURES.map((m) => id(m.id)) : []
  const hostiles = cfg.mechanics.hostiles ? HOSTILES.map((m) => id(m.id)) : []
  const npcs = cfg.mechanics.survivors ? NPCS.map((m) => id(m.id)) : []
  const bosses = cfg.mechanics.bosses ? BOSSES.map((m) => id(m.id)) : []

  const reductions: Record<string, number> = {}
  for (const v of enabledVariants(cfg)) {
    if (v.key === 'armored') reductions[id('zombie_armored')] = 0.6
    if (v.key === 'hulk') reductions[id('zombie_hulk')] = 0.4
    if (v.key === 'juggernaut') reductions[id('zombie_juggernaut')] = 0.3
  }
  if (cfg.mechanics.bosses) {
    reductions[id('titan')] = 0.35
    reductions[id('behemoth')] = 0.5
  }

  return {
    namespace: cfg.namespace,
    /*** mob pools ***/
    zombies,
    creatures,
    hostiles,
    npcs,
    bosses,
    spawnPool: [...zombies, ...creatures],
    reductions,
    /*** mechanics ***/
    infection: cfg.mechanics.infection,
    bleeding: cfg.mechanics.bleeding,
    hordeNight: cfg.mechanics.hordeNight,
    bloodMoon: cfg.mechanics.bloodMoon,
    noise: cfg.mechanics.noise,
    medkits: cfg.mechanics.medkits,
    thirst: cfg.mechanics.thirst,
    molotov: cfg.mechanics.molotov,
    traps: cfg.mechanics.traps,
    barricades: cfg.mechanics.barricades,
    turrets: cfg.mechanics.turrets,
    airdrops: cfg.mechanics.airdrops,
    buildStructures: cfg.mechanics.structures,
    bossesOn: cfg.mechanics.bosses,
    scarceLoot: cfg.mechanics.scarceLoot,
    sunImmune: cfg.sunImmune,
    /*** tuning ***/
    infectionTicks: tune.infectionTicks,
    bleedingTicks: tune.bleedingTicks,
    hordeEveryDay: tune.hordeEveryDay,
    hordeCap: cfg.intensity === 3 ? 6 : cfg.intensity === 2 ? 4 : 3,
    maxPerPlayer: tune.maxPerPlayer,
    noiseBurst: cfg.intensity === 3 ? 6 : 4,
    screamerBurst: cfg.intensity === 3 ? 8 : 5,
    bossDay: tune.bossDay,
    airdropDays: tune.airdropDays,
    /*** content ***/
    soundEvents,
    items: itemScriptPayload(cfg).items,
    blocks: blockScriptPayload(cfg).blocks,
    hazards: blockScriptPayload(cfg).hazards,
    hazmat: armorScriptPayload(cfg).hazmat,
    chestLoot: chestLoot(cfg, availableIds),
    weaponCount: activeWeapons(cfg).length,
    ...weaponScriptPayload(cfg),
    ...structureScriptPayload(cfg),
    ...fogScriptPayload(cfg),
  }
}

/** Full id of every custom item the pack ships, used to filter loot tables. */
export function availableItemIds(cfg: PackConfig): Set<string> {
  const ids = new Set<string>()
  for (const spec of itemSpecs(cfg)) ids.add(spec.id)
  for (const weapon of activeWeapons(cfg)) ids.add(weapon.id)
  for (const piece of armorPieces(cfg)) ids.add(piece.id)
  return ids
}

const SCRIPT_BODY = String.raw`/* REMNANT - logique scriptee du pack fusionne. Genere automatiquement. */
import { world, system, ItemStack } from "@minecraft/server";

const CFG = __CONFIG__;
const NS = CFG.namespace;
const ZP = NS + ":zombie_";

/* ------------------------------ utilitaires ------------------------------ */

function has(list, id) {
  return !!list && list.indexOf(id) >= 0;
}

function isOurZombie(id) {
  return typeof id === "string" && id.indexOf(ZP) === 0;
}

function isUndeadMob(id) {
  return isOurZombie(id) || has(CFG.creatures, id);
}

function pickVariant() {
  const list = CFG.spawnPool;
  if (!list || list.length === 0) return null;
  return list[(Math.random() * list.length) | 0];
}

function dimByName(name) {
  try {
    if (name === "nether") return world.getDimension("nether");
    if (name === "the_end") return world.getDimension("the_end");
    return world.getDimension("overworld");
  } catch (e) {
    return null;
  }
}

function dimNameOf(entity) {
  try {
    if (entity.dimension && typeof entity.dimension.id === "string") {
      if (entity.dimension.id.indexOf("nether") >= 0) return "nether";
      if (entity.dimension.id.indexOf("end") >= 0) return "the_end";
    }
  } catch (e) {}
  return "overworld";
}

function playEvent(event, player, dim, loc) {
  if (!CFG.soundEvents || CFG.soundEvents.indexOf(event) < 0) return false;
  const id = NS + "." + event;
  try {
    if (player) {
      player.playSound(id);
      return true;
    }
    if (dim && loc) {
      dim.playSound(id, loc);
      return true;
    }
  } catch (e) {}
  return false;
}

function addEffectSafe(entity, name, ticks, amp) {
  const ids = [name, "minecraft:" + name];
  for (let i = 0; i < ids.length; i++) {
    try {
      entity.addEffect(ids[i], ticks, { amplifier: amp });
      return true;
    } catch (e) {}
  }
  return false;
}

function alive(entity) {
  try {
    const hp = entity.getComponent("minecraft:health");
    return !!hp && hp.currentValue > 0;
  } catch (e) {
    return false;
  }
}

function heal(entity, amount) {
  try {
    const hp = entity.getComponent("minecraft:health");
    if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + amount));
  } catch (e) {}
}

function spawnBurst(origin, min, max, count, pool) {
  if (!origin) return;
  let dim;
  let loc;
  try {
    dim = origin.dimension;
    loc = origin.location;
  } catch (e) {
    return;
  }
  if (!dim || !loc) return;
  const list = pool && pool.length > 0 ? pool : CFG.spawnPool;
  if (!list || list.length === 0) return;
  for (let i = 0; i < count; i++) {
    const id = list[(Math.random() * list.length) | 0];
    const ang = Math.random() * Math.PI * 2;
    const dist = min + Math.random() * Math.max(0, max - min);
    try {
      dim.spawnEntity(id, {
        x: loc.x + Math.cos(ang) * dist,
        y: loc.y + 1,
        z: loc.z + Math.sin(ang) * dist,
      });
    } catch (e) {}
  }
  if (Math.random() < 0.35) playEvent("growl", null, dim, loc);
}

function igniteAround(src) {
  let dim;
  let base;
  try {
    dim = src.dimension;
    base = src.location;
  } catch (e) {
    return;
  }
  const r = 3;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r) continue;
      try {
        const b = dim.getBlock({
          x: Math.floor(base.x + dx),
          y: Math.floor(base.y),
          z: Math.floor(base.z + dz),
        });
        if (b && b.isAir) b.setType("minecraft:fire");
      } catch (e) {}
    }
  }
}

function buildBarricade(src) {
  let dim;
  let base;
  try {
    dim = src.dimension;
    base = src.location;
  } catch (e) {
    return;
  }
  const r = 2;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      for (let dy = 0; dy < 2; dy++) {
        try {
          const b = dim.getBlock({
            x: Math.floor(base.x + dx),
            y: Math.floor(base.y) + dy,
            z: Math.floor(base.z + dz),
          });
          if (b && b.isAir) b.setType("minecraft:oak_fence");
        } catch (e) {}
      }
    }
  }
}

/* --------------------------- listes persistantes -------------------------- */

function loadList(key) {
  try {
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== "string" || raw.length === 0) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveList(key, list) {
  try {
    world.setDynamicProperty(key, JSON.stringify(list.slice(-90)));
  } catch (e) {}
}

function key(key) {
  return "remnant_" + NS + "_" + key;
}

function push(keyName, entry) {
  const list = loadList(key(keyName));
  list.push(entry);
  saveList(key(keyName), list);
  return list;
}

function sameCell(entry, block) {
  try {
    return (
      entry.x === block.x &&
      entry.y === block.y &&
      entry.z === block.z &&
      entry.dim === dimOfBlock(block)
    );
  } catch (e) {
    return false;
  }
}

function dimOfBlock(block) {
  try {
    const id = block.dimension.id;
    if (id.indexOf("nether") >= 0) return "nether";
    if (id.indexOf("end") >= 0) return "the_end";
  } catch (e) {}
  return "overworld";
}

function inventoryOf(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    return inv && inv.container ? inv.container : null;
  } catch (e) {
    return null;
  }
}

function giveItem(player, itemId, amount) {
  const container = inventoryOf(player);
  if (!container) return false;
  try {
    const stack = new ItemStack(itemId, amount);
    return container.addItem(stack) === undefined;
  } catch (e) {
    return false;
  }
}

function consumeAmmo(player, ammoId) {
  const c = inventoryOf(player);
  if (!c) return true;
  for (let i = 0; i < c.size; i++) {
    let item;
    try {
      item = c.getItem(i);
    } catch (e) {
      continue;
    }
    if (item && item.typeId === ammoId) {
      try {
        if (item.amount > 1) {
          item.amount -= 1;
          c.setItem(i, item);
        } else {
          c.setItem(i, undefined);
        }
        return true;
      } catch (e) {
        return true;
      }
    }
  }
  return false;
}

function wearsHazmat(player) {
  if (!CFG.hazmat || CFG.hazmat.length === 0) return false;
  try {
    const eq = player.getComponent("minecraft:equippable");
    if (!eq) return false;
    for (let slot = 0; slot < 4; slot++) {
      let item;
      try {
        item = eq.getEquipment(slot);
      } catch (e) {
        continue;
      }
      if (item && has(CFG.hazmat, item.typeId)) return true;
    }
  } catch (e) {}
  return false;
}

function isNight() {
  try {
    const t = world.getTimeOfDay();
    return t < 4000 || t > 13000;
  } catch (e) {
    return false;
  }
}

function dayNumber() {
  try {
    if (typeof world.getDay === "function") return world.getDay();
  } catch (e) {}
  try {
    return Math.floor(world.getAbsoluteTime() / 24000);
  } catch (e) {}
  return 1;
}

/* ------------------------- armes a feu (raycast) ------------------------- */

const lastShot = {};

function tryShoot(player, weapon) {
  let now = 0;
  try {
    now = system.currentTick;
  } catch (e) {}
  const shotKey = String(player.id) + ":" + weapon.id;
  if (lastShot[shotKey] && now - lastShot[shotKey] < weapon.cooldown) return;
  if (weapon.ammo && !consumeAmmo(player, weapon.ammo)) {
    try {
      player.sendMessage("§c[REMNANT] Plus de munitions.");
    } catch (e) {}
    lastShot[shotKey] = now;
    return;
  }
  lastShot[shotKey] = now;

  let hits = [];
  try {
    hits = player.getEntitiesFromViewDirection({ maxDistance: weapon.range });
  } catch (e) {}
  let damaged = false;
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const target = hit && hit.entity ? hit.entity : hit;
    if (!target || target.id === player.id) continue;
    try {
      target.applyDamage(weapon.damage, { cause: "entityAttack", damagingEntity: player });
      damaged = true;
    } catch (e) {}
    break;
  }
  if (weapon.explosive) {
    try {
      player.dimension.createExplosion(player.location, 4, {
        breaksBlocks: false,
        causesFire: false,
      });
    } catch (e) {}
  }
  if (!playEvent("gunshot", player, null, null)) {
    try {
      player.playSound(damaged ? "random.bowhit" : "random.bow");
    } catch (e) {}
  }
}

/* ----------------------- degats, infection, capacites -------------------- */

try {
  world.afterEvents.entityHurt.subscribe(function (ev) {
    try {
      const victim = ev.hurtEntity;
      const attacker = ev.damageSource ? ev.damageSource.damagingEntity : undefined;
      if (!victim) return;

      const reduce = CFG.reductions ? CFG.reductions[victim.typeId] : 0;
      if (reduce && ev.damage > 0) heal(victim, ev.damage * reduce);

      if (!attacker || !isOurZombie(attacker.typeId)) return;
      if (victim.typeId !== "minecraft:player") return;

      if (CFG.infection && !wearsHazmat(victim)) addInfect(victim, 18);
      if (CFG.bleeding) addBleed(victim, 25);

      if (attacker.typeId === ZP + "screamer") spawnBurst(victim, 6, 14, CFG.screamerBurst);
      if (attacker.typeId === ZP + "spitter") addEffectSafe(victim, "nausea", 120, 0);
      if (attacker.typeId === ZP + "juggernaut") addEffectSafe(victim, "weakness", 80, 1);
      if (attacker.typeId === ZP + "hulk") addEffectSafe(victim, "slowness", 60, 1);
    } catch (e) {}
  });
} catch (e) {}

try {
  world.afterEvents.entityDie.subscribe(function (ev) {
    try {
      const dead = ev.deadEntity;
      if (!dead || !isUndeadMob(dead.typeId)) return;
      if (dead.typeId === ZP + "bloater") {
        dead.dimension.createExplosion(dead.location, 3, { breaksBlocks: false, causesFire: false });
      }
      if (dead.typeId === NS + ":behemoth") {
        dead.dimension.createExplosion(dead.location, 6, { breaksBlocks: true, causesFire: true });
        for (const p of world.getAllPlayers()) {
          p.sendMessage("§a[REMNANT]§r Le Béhémoth est tombé.");
        }
      }
      if (dead.typeId === NS + ":titan" || dead.typeId === NS + ":queen") {
        for (const p of world.getAllPlayers()) {
          p.sendMessage("§a[REMNANT]§r Boss éliminé. La horde reflue un instant.");
        }
      }
    } catch (e) {}
  });
} catch (e) {}

/* ------------------------------- objets ---------------------------------- */

function applyBeacon(player) {
  let dim;
  let loc;
  try {
    dim = player.dimension;
    loc = player.location;
  } catch (e) {
    return;
  }
  addEffectSafe(player, "regeneration", 200, 1);
  let mobs = [];
  try {
    mobs = dim.getEntities({ location: loc, maxDistance: 14, families: [NS + "_zombie"] });
  } catch (e) {}
  for (const mob of mobs) {
    try {
      const from = mob.location;
      const dx = from.x - loc.x;
      const dz = from.z - loc.z;
      const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
      mob.teleport({ x: loc.x + (dx / len) * 22, y: loc.y, z: loc.z + (dz / len) * 22 });
    } catch (e) {}
  }
  try {
    player.playSound("beacon.activate");
  } catch (e) {}
  player.sendMessage("§a[REMNANT]§r Zone sûre établie pour un moment.");
}

try {
  world.afterEvents.itemUse.subscribe(function (ev) {
    try {
      const src = ev.source;
      const stack = ev.itemStack;
      if (!src || !stack) return;
      const id = stack.typeId;
      const I = CFG.items || {};

      if (id === I.bandage) {
        addEffectSafe(src, "regeneration", 60, 0);
        treatBleed(src, 35);
      }
      if (id === I.compress) {
        addEffectSafe(src, "regeneration", 100, 0);
        addEffectSafe(src, "instant_health", 1, 0);
        treatBleed(src, 70);
      }
      if (id === I.medkit) {
        addEffectSafe(src, "regeneration", 200, 1);
        addEffectSafe(src, "instant_health", 1, 0);
        treatBleed(src, 100);
        cureInfect(src);
        src.sendMessage("§a[REMNANT]§r Trousse complète : plaies fermées, infection purgée.");
      }
      if (id === I.antiviral) {
        try {
          src.removeEffect("poison");
          src.removeEffect("wither");
          src.removeEffect("nausea");
        } catch (e) {}
        cureInfect(src);
        src.sendMessage("§a[REMNANT]§r Infection purgée.");
      }
      if (id === I.adrenaline) {
        addEffectSafe(src, "speed", 300, 1);
        addEffectSafe(src, "absorption", 200, 1);
        energize(src, 100);
        treatBleed(src, 20);
      }
      if (id === I.painkiller) {
        addEffectSafe(src, "resistance", 400, 0);
        treatBleed(src, 15);
        try {
          src.removeEffect("wither");
        } catch (e) {}
      }
      if (id === I.splint) {
        addEffectSafe(src, "regeneration", 120, 0);
        try {
          src.removeEffect("slowness");
        } catch (e) {}
      }
      if (id === I.water_clean) {
        addEffectSafe(src, "saturation", 120, 1);
        drink(src, 45);
      }
      if (id === I.water_dirty) {
        addEffectSafe(src, "saturation", 60, 0);
        drink(src, 25);
        if (Math.random() < 0.5) addEffectSafe(src, "nausea", 200, 0);
        if (Math.random() < 0.35) addInfect(src, 8);
      }
      if (id === I.ration) {
        addEffectSafe(src, "saturation", 400, 2);
        addEffectSafe(src, "regeneration", 100, 0);
        drink(src, 30);
        energize(src, 45);
      }

      if (id === I.rattle && CFG.noise) spawnBurst(src, 8, 20, CFG.noiseBurst);
      if (id === I.decoy && CFG.noise) {
        spawnBurst(src, 10, 24, CFG.noiseBurst + 2);
        src.sendMessage("§e[REMNANT]§r Le leurre couine. Ils arrivent.");
      }
      if (id === I.molotov) {
        igniteAround(src);
        if (CFG.noise) spawnBurst(src, 8, 18, CFG.noiseBurst);
      }
      if (id === I.grenade) {
        try {
          src.dimension.createExplosion(src.location, 4, { breaksBlocks: false, causesFire: false });
        } catch (e) {}
        playEvent("impact", null, src.dimension, src.location);
      }
      if (id === I.smoke) {
        let mobs = [];
        try {
          mobs = src.dimension.getEntities({
            location: src.location,
            maxDistance: 12,
            families: [NS + "_zombie"],
          });
        } catch (e) {}
        for (const mob of mobs) {
          try {
            mob.teleport({ x: mob.location.x, y: mob.location.y, z: mob.location.z });
          } catch (e) {}
          addEffectSafe(mob, "slowness", 200, 2);
        }
        src.sendMessage("§7[REMNANT]§r Fumigène : la horde perd ta trace.");
      }
      if (id === I.barricade && CFG.barricades) buildBarricade(src);
      if (id === I.beacon) applyBeacon(src);
      if (id === I.flashlight) addEffectSafe(src, "night_vision", 600, 0);
      if (id === I.radio) {
        let players = world.getAllPlayers();
        let closest = null;
        let best = 1e9;
        for (const other of players) {
          if (other.id === src.id) continue;
          try {
            const dx = other.location.x - src.location.x;
            const dz = other.location.z - src.location.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < best) {
              best = d;
              closest = other;
            }
          } catch (e) {}
        }
        if (closest) {
          addEffectSafe(src, "glowing", 200, 0);
          src.sendMessage("§b[REMNANT]§r Signal capté à " + Math.round(best) + " blocs.");
        } else {
          src.sendMessage("§7[REMNANT]§r Aucun signal sur cette fréquence.");
        }
      }
      if (id === I.lockpick) addEffectSafe(src, "haste", 300, 0);
      if (id === I.repair) src.sendMessage("§e[REMNANT]§r Kit de réparation utilisé.");
      if (id === I.binoculars) addEffectSafe(src, "night_vision", 400, 0);

      if (CFG.firearms && CFG.weapons) {
        for (let i = 0; i < CFG.weapons.length; i++) {
          const w = CFG.weapons[i];
          if (w.id === id && w.kind === "firearm") {
            tryShoot(src, w);
            break;
          }
        }
      }
    } catch (e) {}
  });
} catch (e) {}

/* ------------------------- blocs : tourelles, pieges --------------------- */

try {
  world.afterEvents.playerInteractWithBlock.subscribe(function (ev) {
    try {
      const block = ev.block;
      const player = ev.player;
      if (!block || !player) return;
      const id = block.typeId;
      const B = CFG.blocks || {};
      const position = { dim: dimNameOf(player), x: block.x, y: block.y, z: block.z };

      if (id === B.turret) {
        push("turrets", position);
        player.sendMessage("§a[REMNANT]§r Tourelle activée. Alimente-la avec un générateur proche.");
      } else if (id === B.generator) {
        push("generators", position);
        player.sendMessage("§a[REMNANT]§r Générateur en marche.");
      } else if (id === B.beacon_block) {
        push("beacons", position);
        player.sendMessage("§a[REMNANT]§r Balise armée : les infectés seront repoussés.");
      } else if (id === B.mine) {
        push("mines", position);
        player.sendMessage("§c[REMNANT]§r Mine posée et armée.");
      } else if (id === B.ammo_crate) {
        let given = 0;
        const pools = [
          NS + ":ammo_9mm",
          NS + ":ammo_556",
          NS + ":shells",
          NS + ":ammo_308",
          NS + ":rockets",
        ];
        for (const pool of pools) {
          if (CFG.weapons === undefined) break;
          let exists = false;
          for (const w of CFG.weapons) {
            if (w.ammo === pool) exists = true;
          }
          if (!exists) continue;
          if (giveItem(player, pool, 6)) given++;
        }
        player.sendMessage(given > 0 ? "§a[REMNANT]§r Munitions récupérées." : "§c[REMNANT]§r Cette caisse est vide.");
      } else if (id === B.med_station) {
        addEffectSafe(player, "regeneration", 120, 0);
        addEffectSafe(player, "instant_health", 1, 0);
        treatBleed(player, 60);
        player.sendMessage("§a[REMNANT]§r Soins d'urgence appliqués.");
      } else if (id === B.crate) {
        const loot = CFG.chestLoot ? CFG.chestLoot.military : [];
        let taken = 0;
        for (const entry of loot) {
          const amount = entry.min + ((Math.random() * (entry.max - entry.min + 1)) | 0);
          if (giveItem(player, entry.item, amount)) taken++;
        }
        try {
          block.setType("minecraft:air");
        } catch (e) {}
        player.sendMessage("§a[REMNANT]§r Caisse de ravitaillement pillée (" + taken + " lots).");
      }
    } catch (e) {}
  });
} catch (e) {}

/* ---------------------------- barres de survie ---------------------------- */

const STATS = {};
const bossWatch = {};
const STAT_KEY = "remnant_stats_v1";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function statStore(player) {
  let s = STATS[player.id];
  if (s) return s;
  s = null;
  try {
    const raw = player.getDynamicProperty(STAT_KEY);
    if (typeof raw === "string" && raw.length > 0) s = JSON.parse(raw);
  } catch (e) {}
  if (!s || typeof s.energy !== "number") {
    s = { energy: 100, thirst: 100, bleed: 0, infect: 0 };
  }
  STATS[player.id] = s;
  return s;
}

function statSave(player, s) {
  try {
    player.setDynamicProperty(STAT_KEY, JSON.stringify(s));
  } catch (e) {}
}

function addBleed(player, amount) {
  const s = statStore(player);
  s.bleed = clamp(s.bleed + amount, 0, 100);
}

function addInfect(player, amount) {
  const s = statStore(player);
  s.infect = clamp(s.infect + amount, 0, 100);
}

function treatBleed(player, amount) {
  const s = statStore(player);
  s.bleed = clamp(s.bleed - amount, 0, 100);
}

function cureInfect(player) {
  statStore(player).infect = 0;
}

function drink(player, amount) {
  const s = statStore(player);
  s.thirst = clamp(s.thirst + amount, 0, 100);
}

function energize(player, amount) {
  const s = statStore(player);
  s.energy = clamp(s.energy + amount, 0, 100);
}

/** ASCII-only bar so it renders on every Bedrock font, no unicode glyphs. */
function bar(value, max, size) {
  const filled = Math.round((clamp(value, 0, max) / max) * size);
  let out = "";
  for (let i = 0; i < size; i++) out += i < filled ? "|" : ".";
  return "[" + out + "]";
}

function healthOf(player) {
  try {
    const hp = player.getComponent("minecraft:health");
    if (hp) return { current: hp.currentValue, max: hp.effectiveMax };
  } catch (e) {}
  return { current: 20, max: 20 };
}

function isSprinting(player) {
  try {
    if (typeof player.isSprinting === "boolean") return player.isSprinting;
  } catch (e) {}
  try {
    const v = player.getVelocity();
    return v.x * v.x + v.z * v.z > 0.055;
  } catch (e) {}
  return false;
}

function statLine(player) {
  const s = statStore(player);
  const hp = healthOf(player);
  let line =
    "§cPV " + bar(hp.current, hp.max, 6) +
    " §eEN " + bar(s.energy, 100, 6) +
    " §bEAU " + bar(s.thirst, 100, 6);
  if (s.bleed > 0) line += " §4SANG " + bar(s.bleed, 100, 6);
  if (s.infect > 0) line += " §2INF " + bar(s.infect, 100, 6);
  return line;
}

system.runInterval(function () {
  try {
    const players = world.getAllPlayers();
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const s = statStore(player);

      /* énergie : le sprint la vide, le repos la recharge */
      if (isSprinting(player)) s.energy = clamp(s.energy - 0.7, 0, 100);
      else s.energy = clamp(s.energy + 0.4, 0, 100);
      if (s.energy <= 0) {
        addEffectSafe(player, "slowness", 30, 1);
        if (Math.random() < 0.1) {
          try {
            player.sendMessage("§e[REMNANT]§r Plus d'énergie. Reprends ton souffle.");
          } catch (e) {}
        }
      }

      /* soif */
      if (CFG.thirst) {
        s.thirst = clamp(s.thirst - 0.05, 0, 100);
        if (s.thirst < 20 && Math.random() < 0.4) addEffectSafe(player, "hunger", 200, 0);
        if (s.thirst < 8) addEffectSafe(player, "nausea", 120, 0);
      }

      /* hémorragie : se referme lentement, saigne tant qu'elle reste ouverte */
      if (s.bleed > 0) {
        const decay = 100 / Math.max(20, CFG.bleedingTicks / 2);
        s.bleed = clamp(s.bleed - decay, 0, 100);
        if (s.bleed > 40 && Math.random() < 0.35) player.applyDamage(1, { cause: "magic" });
      }

      /* infection : elle monte toute seule jusqu'à te Consumer */
      if (s.infect > 0) {
        const rate = 100 / Math.max(40, CFG.infectionTicks / 2);
        s.infect = clamp(s.infect + rate, 0, 100);
        if (s.infect > 60) addEffectSafe(player, "nausea", 120, 0);
        if (s.infect >= 100) {
          addEffectSafe(player, "wither", 200, 1);
          if (Math.random() < 0.3) {
            player.applyDamage(2, { cause: "magic" });
            try {
              player.sendMessage("§2[REMNANT]§r L'infection gagne du terrain. Trouve un antiviral.");
            } catch (e) {}
          }
        }
      }

      /* affichage : la barre du boss passe devant quand il y en a un */
      let line = statLine(player);
      const boss = bossWatch[player.id];
      if (boss && system.currentTick - boss.at < 260) {
        line =
          "§4" + boss.name + " " + Math.round(boss.hp) + "/" + Math.round(boss.max) + " §r| " + line;
      }
      try {
        player.onScreenDisplay.setActionBar(line);
      } catch (e) {}

      statSave(player, s);
    }
  } catch (e) {}
}, 10);

/* --------------------------- ambiance : brumes --------------------------- */

const FOGS = CFG.fogs || {};
const FOG_LABELS = CFG.fogLabels || {};
const fogState = {};

/** Which fogs the player should currently have pushed. */
function wantedFogs(player, s) {
  const out = [];
  const night = isNight();
  const day = dayNumber();
  if (CFG.bloodMoon && night && day % 7 === 0) out.push("blood_moon");
  else if (CFG.hordeNight && night && day % CFG.hordeEveryDay === 0) out.push("horde_night");
  const hp = healthOf(player);
  if (s.bleed > 60 || hp.current <= 6) out.push("critical");
  return out;
}

/** Returns true only when the command went through, so failures get retried. */
function applyFog(player, key, on) {
  const id = FOGS[key];
  const label = FOG_LABELS[key];
  if (!id || !label) return false;
  try {
    player.runCommand(on ? "fog @s push " + id + " " + label : "fog @s remove " + label);
    return true;
  } catch (e) {
    return false;
  }
}

system.runInterval(function () {
  try {
    const players = world.getAllPlayers();
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const want = wantedFogs(player, statStore(player));
      const current = fogState[player.id] || [];
      const next = [];
      for (let k = 0; k < current.length; k++) {
        if (want.indexOf(current[k]) >= 0) next.push(current[k]);
        else applyFog(player, current[k], false);
      }
      for (let k = 0; k < want.length; k++) {
        if (next.indexOf(want[k]) >= 0) continue;
        if (applyFog(player, want[k], true)) next.push(want[k]);
      }
      fogState[player.id] = next;
    }
  } catch (e) {}
}, 40);

/* --------------------------- boucle principale --------------------------- */

const HAZARDS = CFG.hazards || [];

if (CFG.turrets || CFG.traps || CFG.airdrops || CFG.buildStructures || CFG.bossesOn) {
  system.runInterval(function () {
    try {
      const players = world.getAllPlayers();
      if (players.length === 0) return;

      /* tourelles */
      if (CFG.turrets) {
        const turrets = loadList(key("turrets"));
        const generators = loadList(key("generators"));
        for (const turret of turrets) {
          let powered = false;
          for (const gen of generators) {
            if (gen.dim !== turret.dim) continue;
            const dx = gen.x - turret.x;
            const dy = gen.y - turret.y;
            const dz = gen.z - turret.z;
            if (dx * dx + dy * dy + dz * dz <= 400) powered = true;
          }
          if (!powered) continue;
          const dim = dimByName(turret.dim);
          if (!dim) continue;
          let targets = [];
          try {
            targets = dim.getEntities({
              location: { x: turret.x + 0.5, y: turret.y + 0.5, z: turret.z + 0.5 },
              maxDistance: 14,
              families: [NS + "_zombie"],
            });
          } catch (e) {}
          let fired = 0;
          for (const target of targets) {
            if (fired >= 2) break;
            try {
              target.applyDamage(7, { cause: "entityAttack" });
              fired++;
            } catch (e) {}
          }
          if (fired > 0) {
            try {
              dim.playSound("random.bow", { x: turret.x, y: turret.y, z: turret.z });
            } catch (e) {}
          }
        }
      }

      /* mines et pieges */
      for (const player of players) {
        let dim;
        let loc;
        try {
          dim = player.dimension;
          loc = player.location;
        } catch (e) {
          continue;
        }
        if (CFG.traps) {
          const mines = loadList(key("mines"));
          for (let i = 0; i < mines.length; i++) {
            const mine = mines[i];
            if (mine.dim !== dimNameOf(player)) continue;
            const dx = mine.x + 0.5 - loc.x;
            const dz = mine.z + 0.5 - loc.z;
            const dy = mine.y - loc.y;
            if (dx * dx + dz * dz < 2.2 && Math.abs(dy) < 2) {
              try {
                dim.createExplosion({ x: mine.x + 0.5, y: mine.y + 0.5, z: mine.z + 0.5 }, 3, {
                  breaksBlocks: false,
                  causesFire: false,
                });
              } catch (e) {}
              mines.splice(i, 1);
              saveList(key("mines"), mines);
              break;
            }
          }
        }
        /* blocs blessants (pieux, barbeles) */
        if (HAZARDS.length > 0) {
          try {
            const below = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) - 1, z: Math.floor(loc.z) });
            if (below && has(HAZARDS, below.typeId)) {
              player.applyDamage(2, { cause: "contact" });
            }
          } catch (e) {}
        }
      }

      /* balises de zone sure */
      if (CFG.turrets) {
        const beacons = loadList(key("beacons"));
        for (const beacon of beacons) {
          const dim = dimByName(beacon.dim);
          if (!dim) continue;
          let mobs = [];
          try {
            mobs = dim.getEntities({
              location: { x: beacon.x + 0.5, y: beacon.y + 0.5, z: beacon.z + 0.5 },
              maxDistance: 12,
              families: [NS + "_zombie"],
            });
          } catch (e) {}
          for (const mob of mobs) {
            try {
              const from = mob.location;
              const dx = from.x - (beacon.x + 0.5);
              const dz = from.z - (beacon.z + 0.5);
              const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
              mob.teleport({
                x: beacon.x + 0.5 + (dx / len) * 18,
                y: from.y,
                z: beacon.z + 0.5 + (dz / len) * 18,
              });
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }, 40);
}

/* ------------------------ capacites de la horde -------------------------- */

system.runInterval(function () {
  try {
    const players = world.getAllPlayers();
    if (players.length === 0) return;
    const night = isNight();
    for (const player of players) {
      let near = [];
      try {
        near = player.dimension.getEntities({
          location: player.location,
          maxDistance: 18,
          families: [NS + "_zombie"],
        });
      } catch (e) {
        continue;
      }
      for (const mob of near) {
        if (mob.typeId === ZP + "nurse") {
          healNearby(mob, 3, 8);
        } else if (mob.typeId === ZP + "alpha") {
          buffNearby(mob, 10);
        } else if (mob.typeId === ZP + "necromancer") {
          if (Math.random() < 0.25) spawnBurst(mob, 3, 7, 2, CFG.zombies);
        } else if (mob.typeId === ZP + "stalker" && night) {
          addEffectSafe(mob, "invisibility", 200, 0);
        }
      }
    }
    /* la soif est gérée par la boucle des barres de survie */
  } catch (e) {}
}, 200);

function healNearby(origin, amount, radius) {
  let list = [];
  try {
    list = origin.dimension.getEntities({
      location: origin.location,
      maxDistance: radius,
      families: [NS + "_zombie"],
    });
  } catch (e) {
    return;
  }
  for (const mob of list) {
    if (mob.id === origin.id) continue;
    heal(mob, amount);
  }
}

function buffNearby(origin, radius) {
  let list = [];
  try {
    list = origin.dimension.getEntities({
      location: origin.location,
      maxDistance: radius,
      families: [NS + "_zombie"],
    });
  } catch (e) {
    return;
  }
  for (const mob of list) {
    if (mob.id === origin.id) continue;
    addEffectSafe(mob, "speed", 120, 1);
    addEffectSafe(mob, "strength", 120, 0);
  }
}

/* ---------------------------- nuits de horde ----------------------------- */

if (CFG.hordeNight) {
  try {
    system.runInterval(function () {
      try {
        const t = world.getTimeOfDay();
        if (t < 13000 || t > 23000) return;
        const day = dayNumber();
        const tier = Math.floor(day / CFG.hordeEveryDay) + 1;
        const level = Math.min(tier, CFG.hordeCap);
        const players = world.getAllPlayers();
        for (const p of players) {
          spawnBurst(p, 14, 22 + level * 3, Math.min(CFG.maxPerPlayer, level + 1));
        }
      } catch (e) {}
    }, 400);
  } catch (e) {}
}

/* ------------------------------- lune rouge ------------------------------ */

if (CFG.bloodMoon) {
  try {
    system.runInterval(function () {
      try {
        const t = world.getTimeOfDay();
        if (t < 13000 || t > 23500) return;
        const day = dayNumber();
        if (day % 7 !== 0) return;
        const players = world.getAllPlayers();
        for (const p of players) {
          spawnBurst(p, 12, 26, CFG.maxPerPlayer + 4);
          addEffectSafe(p, "darkness", 200, 0);
          try {
            p.playSound("ambient.cave");
          } catch (e) {}
          p.sendMessage("§c[REMNANT]§r Lune rouge. Ils sont déchaînés cette nuit.");
        }
      } catch (e) {}
    }, 600);
  } catch (e) {}
}

/* ------------------------------- largages -------------------------------- */

if (CFG.airdrops) {
  try {
    system.runInterval(function () {
      try {
        const day = dayNumber();
        if (day % CFG.airdropDays !== 0) return;
        if (world.getTimeOfDay() < 6000 || world.getTimeOfDay() > 10000) return;
        const players = world.getAllPlayers();
        for (const p of players) {
          let dim;
          let loc;
          try {
            dim = p.dimension;
            loc = p.location;
          } catch (e) {
            continue;
          }
          const ang = Math.random() * Math.PI * 2;
          const dist = 20 + Math.random() * 20;
          const x = Math.floor(loc.x + Math.cos(ang) * dist);
          const z = Math.floor(loc.z + Math.sin(ang) * dist);
          for (let y = Math.min(320, Math.floor(loc.y) + 24); y > loc.y - 8; y--) {
            try {
              const b = dim.getBlock({ x, y, z });
              if (b && !b.isAir) {
                dim.setBlockType(NS + ":supply_crate", { x, y: y + 1, z });
                p.sendMessage("§6[REMNANT]§r Largage repéré en " + x + " / " + z + ".");
                try {
                  dim.playSound("random.anvil_land", { x, y, z });
                } catch (e) {}
                break;
              }
            } catch (e) {
              break;
            }
          }
        }
      } catch (e) {}
    }, 1200);
  } catch (e) {}
}

/* ------------------------------- structures ------------------------------ */

const ANCHORS = {};

if (CFG.buildStructures && CFG.structures && CFG.structures.length > 0) {
  system.runInterval(function () {
    try {
      const players = world.getAllPlayers();
      for (const p of players) {
        let loc;
        try {
          loc = p.location;
        } catch (e) {
          continue;
        }
        const previous = ANCHORS[p.id];
        if (previous) {
          const dx = loc.x - previous.x;
          const dz = loc.z - previous.z;
          if (dx * dx + dz * dz < 200 * 200) continue;
        }
        ANCHORS[p.id] = { x: loc.x, z: loc.z };
        if (!previous) continue;
        buildStructure(p, loc);
      }
    } catch (e) {}
  }, 600);
}

function buildStructure(player, loc) {
  const blueprint = CFG.structures[(Math.random() * CFG.structures.length) | 0];
  if (!blueprint) return;
  let dim;
  try {
    dim = player.dimension;
  } catch (e) {
    return;
  }
  const dist = 40 + Math.random() * 30;
  const ang = Math.random() * Math.PI * 2;
  const baseX = Math.floor(loc.x + Math.cos(ang) * dist);
  const baseZ = Math.floor(loc.z + Math.sin(ang) * dist);
  let baseY = Math.floor(loc.y);
  for (let y = Math.min(300, baseY + 20); y > baseY - 20; y--) {
    let block;
    try {
      block = dim.getBlock({ x: baseX, y, z: baseZ });
    } catch (e) {
      return;
    }
    if (block && !block.isAir) {
      baseY = y + 1;
      break;
    }
  }

  const places = blueprint.places || [];
  for (const place of places) {
    try {
      const target = { x: baseX + place.dx, y: baseY + place.dy, z: baseZ + place.dz };
      const existing = dim.getBlock(target);
      if (existing && !existing.isAir) continue;
      dim.setBlockType(place.block, target);
    } catch (e) {}
  }

  const loot = blueprint.loot || [];
  for (const spot of loot) {
    try {
      const target = { x: baseX + spot.dx, y: baseY + spot.dy, z: baseZ + spot.dz };
      const block = dim.getBlock(target);
      if (!block) continue;
      const inventory = block.getComponent("minecraft:inventory");
      if (!inventory || !inventory.container) continue;
      const pool = (CFG.chestLoot && CFG.chestLoot[spot.profile]) || [];
      const container = inventory.container;
      for (let i = 0; i < container.size && i < pool.length; i++) {
        const entry = pool[(Math.random() * pool.length) | 0];
        const amount = entry.min + ((Math.random() * (entry.max - entry.min + 1)) | 0);
        try {
          container.setItem(i, new ItemStack(entry.item, amount));
        } catch (e) {}
      }
    } catch (e) {}
  }

  try {
    player.sendMessage("§6[REMNANT]§r " + blueprint.name + " repéré en " + baseX + " / " + baseZ + ".");
  } catch (e) {}
}

/* --------------------------------- boss ---------------------------------- */

const BOSS_NAMES = {
  titan: "Le Titan",
  behemoth: "Le Béhémoth",
  queen: "La Reine",
};

if (CFG.bossesOn && CFG.bosses.length > 0) {
  system.runInterval(function () {
    try {
      const t = world.getTimeOfDay();
      if (t < 14000 || t > 22000) return;
      const day = dayNumber();
      if (day < CFG.bossDay) return;
      if (day % CFG.bossDay !== 0) return;
      const players = world.getAllPlayers();
      for (const p of players) {
        let aliveBoss = null;
        try {
          const nearby = p.dimension.getEntities({
            location: p.location,
            maxDistance: 90,
            families: [NS + "_boss"],
          });
          if (nearby.length > 0) aliveBoss = nearby[0];
        } catch (e) {}
        if (!aliveBoss) {
          const bossId = CFG.bosses[(Math.random() * CFG.bosses.length) | 0];
          spawnBurst(p, 26, 34, 1, [bossId]);
          const name = BOSS_NAMES[bossId.split(":")[1]] || "Boss";
          p.sendMessage("§4[REMNANT]§r " + name + " est là. Bonne chance.");
          try {
            p.playSound("mob.wither.spawn");
          } catch (e) {}
        } else {
          try {
            const hp = aliveBoss.getComponent("minecraft:health");
            const name = BOSS_NAMES[aliveBoss.typeId.split(":")[1]] || "Boss";
            if (hp) {
              bossWatch[p.id] = {
                name: name,
                hp: hp.currentValue,
                max: hp.effectiveMax,
                at: system.currentTick,
              };
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }, 200);
}

/* ------------------------------ accueil ---------------------------------- */

try {
  world.afterEvents.playerSpawn.subscribe(function (ev) {
    try {
      if (ev.initialSpawn && ev.player) {
        ev.player.sendMessage("§a[REMNANT]§r Apocalypse active. Surveille ta barre : PV, énergie, eau, sang, infection.");
      }
    } catch (e) {}
  });
} catch (e) {}
`

export function scriptFile(
  cfg: PackConfig,
  availableIds: Set<string>,
  soundEvents: string[] = [],
): GeneratedFile {
  const payload = JSON.stringify(configPayload(cfg, availableIds, soundEvents), null, 2)
  return {
    path: 'scripts/main.js',
    content: `${SCRIPT_BODY.replace('__CONFIG__', payload)}\n`,
  }
}
