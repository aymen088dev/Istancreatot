import { json } from './minecraft'
import type { GeneratedFile, PackConfig } from './types'

/**
 * Atmospheric fog.
 *
 * Two mechanisms, because they fail in different situations:
 *  1. `biomes_client.json` binds a permanent haze to every biome. It needs no
 *     cheats, so the atmosphere is visible in any world.
 *  2. The script pushes the dramatic fogs (blood moon, horde night, critical
 *     health) with the `/fog` command, which does require cheats, and pops them
 *     again when the condition clears.
 *
 * Distances use `render_distance_type: "render"`, so `fog_start`/`fog_end` are
 * fractions of the render distance and the look holds on any setting.
 */
export interface FogDef {
  key: string
  label: string
  start: number
  end: number
  color: string
  weather: { start: number; end: number; color: string }
  /** Water fog is measured in blocks, so a short fixed range reads as murky. */
  water: { start: number; end: number; color: string }
}

export const FOG_DEFS: FogDef[] = [
  {
    key: 'blood_moon',
    label: 'Lune rouge',
    start: 0.05,
    end: 0.45,
    color: '#4a0d0d',
    weather: { start: 0.05, end: 0.35, color: '#3d0a0a' },
    water: { start: 0, end: 8, color: '#2b0505' },
  },
  {
    key: 'horde_night',
    label: 'Nuit de horde',
    start: 0.12,
    end: 0.6,
    color: '#0f1a12',
    weather: { start: 0.1, end: 0.5, color: '#0d1410' },
    water: { start: 0, end: 14, color: '#0b1a14' },
  },
  {
    key: 'critical',
    label: 'État critique',
    start: 0,
    end: 0.28,
    color: '#3a0a0a',
    weather: { start: 0, end: 0.25, color: '#330808' },
    water: { start: 0, end: 6, color: '#2a0606' },
  },
  {
    key: 'ash',
    label: 'Brume de cendres',
    start: 0.65,
    end: 1,
    color: '#6b6355',
    weather: { start: 0.5, end: 0.9, color: '#5c564c' },
    water: { start: 0, end: 24, color: '#4a5240' },
  },
]

export function fogIdentifier(cfg: PackConfig, key: string): string {
  return `${cfg.namespace}:${key}`
}

/** The id the script pops the fog back off with. */
export function fogLabel(cfg: PackConfig, key: string): string {
  return `${cfg.namespace}:fog_${key}`
}

export function fogFiles(cfg: PackConfig): GeneratedFile[] {
  return FOG_DEFS.map((fog) => ({
    path: `fogs/${fog.key}.json`,
    content: json({
      format_version: '1.16.100',
      'minecraft:fog_settings': {
        description: { identifier: fogIdentifier(cfg, fog.key) },
        distance: {
          air: {
            fog_start: fog.start,
            fog_end: fog.end,
            fog_color: fog.color,
            render_distance_type: 'render',
          },
          weather: {
            fog_start: fog.weather.start,
            fog_end: fog.weather.end,
            fog_color: fog.weather.color,
            render_distance_type: 'render',
          },
          water: {
            fog_start: fog.water.start,
            fog_end: fog.water.end,
            fog_color: fog.water.color,
            render_distance_type: 'fixed',
          },
        },
      },
    }),
  }))
}

/**
 * Permanent haze on every biome. `default` covers anything not listed, so this
 * is what makes the fog visible even with cheats disabled.
 */
export function biomeFogFile(cfg: PackConfig): GeneratedFile {
  return {
    path: 'biomes_client.json',
    content: json({
      biomes: {
        default: { fog_identifier: fogIdentifier(cfg, 'ash') },
      },
    }),
  }
}

/** Fog ids handed to the script, keyed by the situation that triggers them. */
export function fogScriptPayload(cfg: PackConfig): { fogs: Record<string, string>; fogLabels: Record<string, string> } {
  const fogs: Record<string, string> = {}
  const fogLabels: Record<string, string> = {}
  for (const fog of FOG_DEFS) {
    fogs[fog.key] = fogIdentifier(cfg, fog.key)
    fogLabels[fog.key] = fogLabel(cfg, fog.key)
  }
  return { fogs, fogLabels }
}
