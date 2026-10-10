import { json, uuid } from './minecraft'
import type { PackConfig } from './types'

export interface PackUuids {
  bpHeader: string
  bpData: string
  bpScript: string
  rpHeader: string
  rpResources: string
}

export function makeUuids(): PackUuids {
  return {
    bpHeader: uuid(),
    bpData: uuid(),
    bpScript: uuid(),
    rpHeader: uuid(),
    rpResources: uuid(),
  }
}

// A too-high floor makes the client reject the whole pack: nothing renders at
// all. This is the lowest version that still provides the script module below.
const MIN_ENGINE_VERSION = [1, 21, 60]
// Must stay STABLE (no `-beta` suffix) so the world needs no experiment, and
// must be a version that exists in every game meeting MIN_ENGINE_VERSION.
// Declaring 2.0.0 required 1.21.90 while the manifest advertised 1.21.70, so
// the module resolution failed and the whole script silently never ran.
const SCRIPT_API_VERSION = '1.17.0'

export function behaviorManifest(cfg: PackConfig, ids: PackUuids): string {
  return json({
    format_version: 2,
    header: {
      name: `${cfg.packName} — Comportement`,
      description: `Pack fusionné apocalypse zombie généré avec REMNANT. Auteur : ${cfg.author}.`,
      uuid: ids.bpHeader,
      version: [1, 0, 0],
      min_engine_version: MIN_ENGINE_VERSION,
    },
    modules: [
      { type: 'data', uuid: ids.bpData, version: [1, 0, 0] },
      {
        type: 'script',
        language: 'javascript',
        entry: 'scripts/main.js',
        uuid: ids.bpScript,
        version: [1, 0, 0],
      },
    ],
    dependencies: [
      { uuid: ids.rpHeader, version: [1, 0, 0] },
      { module_name: '@minecraft/server', version: SCRIPT_API_VERSION },
    ],
  })
}

export function resourceManifest(cfg: PackConfig, ids: PackUuids): string {
  return json({
    format_version: 2,
    header: {
      name: `${cfg.packName} — Ressources`,
      description: `Ressources du pack fusionné REMNANT. Auteur : ${cfg.author}.`,
      uuid: ids.rpHeader,
      version: [1, 0, 0],
      min_engine_version: MIN_ENGINE_VERSION,
    },
    modules: [{ type: 'resources', uuid: ids.rpResources, version: [1, 0, 0] }],
  })
}
