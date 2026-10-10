export type TexKind = 'gunmetal' | 'steel' | 'wood' | 'leather' | 'fabric' | 'scrap'

/* Resource-pack path helpers shared by every item/block module. */
export function iconKey(ns: string, id: string): string {
  return `${ns}_${id}_icon`
}

export function iconPath(ns: string, id: string): string {
  return `textures/items/${ns}_${id}_icon`
}

export function materialPath(ns: string, kind: TexKind): string {
  return `textures/items/${ns}_mat_${kind}`
}

export function blockTexKey(ns: string, id: string): string {
  return `${ns}_${id}`
}

export function blockTexPath(ns: string, id: string): string {
  return `textures/blocks/${ns}_${id}`
}

/** Worn armor sheets live in `textures/models/armor/`, one pair per set. */
export function armorLayerPath(ns: string, key: string, layer: 'l1' | 'l2'): string {
  return `textures/models/armor/${ns}_${key}_layer_${layer === 'l1' ? 1 : 2}`
}

export type BlockTexKind =
  | 'planks'
  | 'wire'
  | 'sandbag'
  | 'concrete'
  | 'board'
  | 'spike'
  | 'mine'
  | 'crate'
  | 'ammo'
  | 'medical'
  | 'generator'
  | 'turret'
  | 'beacon'

export type IconShape =
  | 'blade'
  | 'blunt'
  | 'axe'
  | 'katana'
  | 'crowbar'
  | 'hammer'
  | 'spear'
  | 'knife'
  | 'pistol'
  | 'smg'
  | 'shotgun'
  | 'rifle'
  | 'sniper'
  | 'lmg'
  | 'launcher'
  | 'ammo'
  | 'shell'
  | 'rocket'
  | 'grenade'
  | 'bottle'
  | 'can'
  | 'bar'
  | 'box'
  | 'vial'
  | 'pill'
  | 'syringe'
  | 'medkit'
  | 'bandage'
  | 'device'
  | 'radio'
  | 'pick'
  | 'tool'
  | 'lens'
  | 'bell'
  | 'beacon'
  | 'armorHead'
  | 'armorChest'
  | 'armorLegs'
  | 'armorBoots'

export interface IconSpec {
  shape: IconShape
  primary: string
  secondary: string
  accent?: string
}

export function canvasAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    return !!canvas.getContext('2d')
  } catch {
    return false
  }
}

async function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('toBlob failed')
  return new Uint8Array(await blob.arrayBuffer())
}

function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '')
  const r = Math.min(255, Math.max(0, parseInt(value.slice(0, 2), 16) + amount))
  const g = Math.min(255, Math.max(0, parseInt(value.slice(2, 4), 16) + amount))
  const b = Math.min(255, Math.max(0, parseInt(value.slice(4, 6), 16) + amount))
  return `rgb(${r},${g},${b})`
}

const TEX_BASE: Record<TexKind, string> = {
  gunmetal: '#3c4046',
  steel: '#8a9099',
  wood: '#7a4f24',
  leather: '#4a3520',
  fabric: '#3f4a3a',
  scrap: '#6b6257',
}

const GRIP: Record<TexKind, string> = {
  gunmetal: '#5b3a1c',
  steel: '#5b3a1c',
  wood: '#3b2a16',
  leather: '#2b1f12',
  fabric: '#26301f',
  scrap: '#3b342c',
}

/** 64x32 material sheet sampled by the 3D weapon/armor geometry. */
export async function weaponTexture(kind: TexKind): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  const base = TEX_BASE[kind]
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 64, 32)

  for (let y = 0; y < 32; y++) {
    ctx.fillStyle = shade(base, Math.round(Math.sin(y * 0.6) * 14) + (y < 16 ? 6 : -8))
    ctx.fillRect(0, y, 64, 1)
  }
  // Lower band is sampled by the grip cube UVs.
  const grip = GRIP[kind]
  ctx.fillStyle = grip
  ctx.fillRect(0, 16, 64, 16)
  for (let y = 16; y < 32; y++) {
    ctx.fillStyle = shade(grip, Math.round(Math.sin(y * 1.3) * 12))
    ctx.fillRect(0, y, 64, 1)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let x = 2; x < 64; x += 8) ctx.fillRect(x, 5, 1, 1)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 15, 64, 1)

  return toPng(canvas)
}

export type ArmorPattern = 'plates' | 'scales' | 'leather' | 'hazmat' | 'kevlar' | 'riot' | 'heavy' | 'camo'

export interface ArmorSheetSpec {
  base: string
  accent: string
  trim: string
  pattern: ArmorPattern
}

/**
 * Deterministic pseudo-random in [0,1). Keeps a given armor sheet identical
 * between two builds so the pack is reproducible.
 */
function noise(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

interface ArmorRegion {
  x: number
  y: number
  w: number
  h: number
}

/** Vanilla humanoid armor UV blocks inside a 64x32 sheet. */
const ARMOR_REGIONS: Record<'l1' | 'l2', ArmorRegion[]> = {
  l1: [
    { x: 0, y: 0, w: 32, h: 16 }, // head
    // The outer head shell. Without it the helmet shell is transparent and the
    // helmet renders invisible on the body.
    { x: 32, y: 0, w: 32, h: 16 }, // hat / outer head
    { x: 16, y: 16, w: 24, h: 16 }, // body
    { x: 40, y: 16, w: 16, h: 16 }, // arms
    { x: 0, y: 16, w: 16, h: 16 }, // legs
  ],
  l2: [
    { x: 16, y: 16, w: 24, h: 16 }, // waist
    { x: 0, y: 16, w: 16, h: 16 }, // legs
  ],
}

function paintArmorPattern(
  rect: (x: number, y: number, w: number, h: number, color: string) => void,
  region: ArmorRegion,
  spec: ArmorSheetSpec,
  rng: () => number,
): void {
  const { x, y, w, h } = region
  const dark = shade(spec.base, -34)
  const light = shade(spec.base, 22)

  switch (spec.pattern) {
    case 'plates': {
      for (let py = y + 2; py < y + h - 1; py += 5) {
        rect(x, py, w, 1, dark)
        rect(x, py + 1, w, 1, light)
      }
      for (let px = x + 3; px < x + w - 1; px += 7) rect(px, y, 1, h, shade(spec.base, -12))
      break
    }
    case 'scales': {
      for (let py = y; py < y + h; py += 3) {
        for (let px = x + ((py / 3) % 2 ? 0 : 2); px < x + w; px += 4) {
          rect(px, py, 3, 2, rng() > 0.5 ? light : dark)
        }
      }
      break
    }
    case 'leather': {
      for (let i = 0; i < 60; i++) {
        const px = x + Math.floor(rng() * w)
        const py = y + Math.floor(rng() * h)
        rect(px, py, 1 + Math.floor(rng() * 2), 1, rng() > 0.5 ? dark : light)
      }
      rect(x, y + h - 2, w, 1, dark)
      break
    }
    case 'hazmat': {
      rect(x, y, w, 2, spec.trim)
      rect(x, y + h - 3, w, 2, spec.trim)
      for (let px = x + 4; px < x + w; px += 8) rect(px, y + 2, 2, h - 5, spec.accent)
      break
    }
    case 'kevlar': {
      for (let py = y; py < y + h; py += 2) {
        for (let px = x + ((py / 2) % 2 ? 0 : 1); px < x + w; px += 2) {
          rect(px, py, 1, 1, rng() > 0.55 ? shade(spec.base, 10) : shade(spec.base, -18))
        }
      }
      break
    }
    case 'riot': {
      rect(x, y, w, 1, light)
      rect(x, y + h - 1, w, 1, dark)
      for (let px = x + 2; px < x + w - 2; px += 9) rect(px, y + 2, 4, h - 5, spec.accent)
      for (let py = y + 4; py < y + h - 3; py += 6) rect(x, py, w, 1, shade(spec.base, -20))
      break
    }
    case 'heavy': {
      rect(x, y, w, 3, light)
      rect(x, y + h - 2, w, 2, dark)
      for (let py = y + 3; py < y + h - 2; py += 4) rect(x + 1, py, w - 2, 2, shade(spec.base, -8))
      for (let px = x + 1; px < x + w - 1; px += 6) rect(px, y + 3, 1, h - 5, spec.trim)
      break
    }
    case 'camo': {
      for (let i = 0; i < 26; i++) {
        const px = x + Math.floor(rng() * (w - 3))
        const py = y + Math.floor(rng() * (h - 3))
        const bw = 2 + Math.floor(rng() * 4)
        const bh = 2 + Math.floor(rng() * 3)
        rect(px, py, bw, bh, rng() > 0.5 ? spec.accent : shade(spec.base, -26))
      }
      break
    }
  }
}

/**
 * 64x32 worn-armor sheet. Opaque only over the vanilla armor UV blocks so the
 * body parts the piece does not cover stay invisible, exactly like vanilla.
 */
export async function armorSheet(spec: ArmorSheetSpec, layer: 'l1' | 'l2'): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.clearRect(0, 0, 64, 32)

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  const rng = noise(spec.base.length * 7919 + spec.pattern.length * 104729 + (layer === 'l1' ? 17 : 31))
  for (const region of ARMOR_REGIONS[layer]) {
    rect(region.x, region.y, region.w, region.h, spec.base)
    for (let y = region.y; y < region.y + region.h; y++) {
      rect(region.x, y, region.w, 1, shade(spec.base, Math.round(Math.sin(y * 0.8) * 8)))
    }
    paintArmorPattern(rect, region, spec, rng)
  }

  return toPng(canvas)
}

interface BlockPattern {
  base: string
  draw?: (r: (x: number, y: number, w: number, h: number, color: string) => void) => void
}

const BLOCK_PATTERNS: Record<BlockTexKind, BlockPattern> = {
  planks: {
    base: '#8a6337',
    draw: (r) => {
      for (let y = 0; y < 16; y += 4) r(0, y, 16, 1, '#5f4224')
      for (let y = 0; y < 16; y += 4) r((y / 4) % 2 ? 4 : 11, y, 1, 4, '#6d4c28')
    },
  },
  wire: {
    base: '#6b6b6b',
    draw: (r) => {
      for (let y = 1; y < 16; y += 3) r(0, y, 16, 1, '#9a9a9a')
      for (let y = 2; y < 16; y += 3) r(0, y, 16, 1, '#3f3f3f')
      for (let x = 3; x < 16; x += 6) r(x, 0, 1, 16, '#4a4a4a')
    },
  },
  sandbag: {
    base: '#b8a274',
    draw: (r) => {
      for (let y = 0; y < 16; y += 5) {
        r(0, y, 16, 1, '#8a7549')
        r(y % 10 === 0 ? 7 : 2, y, 1, 5, '#8a7549')
      }
      r(0, 0, 16, 1, '#cfbb90')
    },
  },
  concrete: {
    base: '#9a9a94',
    draw: (r) => {
      for (let i = 0; i < 16; i += 2) {
        r((i * 5) % 14, (i * 3) % 15, 2, 1, '#7d7d78')
        r((i * 7) % 14, (i * 5) % 15, 1, 2, '#ababa5')
      }
      r(0, 15, 16, 1, '#6f6f6a')
    },
  },
  board: {
    base: '#7d5a33',
    draw: (r) => {
      for (let x = 0; x < 16; x += 5) r(x, 0, 1, 16, '#4d3520')
      r(2, 3, 2, 2, '#3a3a3a')
      r(11, 4, 2, 2, '#3a3a3a')
      r(3, 11, 2, 2, '#3a3a3a')
    },
  },
  spike: {
    base: '#4a3a28',
    draw: (r) => {
      for (let x = 1; x < 16; x += 4) {
        r(x, 4, 2, 11, '#c9c2b0')
        r(x, 3, 1, 2, '#e8e2d0')
      }
      r(0, 0, 16, 4, '#3a2c1c')
    },
  },
  mine: {
    base: '#4f5340',
    draw: (r) => {
      r(3, 5, 10, 8, '#3a3d2f')
      r(6, 3, 4, 3, '#8c8c8c')
      r(7, 2, 2, 1, '#c0392b')
      r(4, 6, 2, 1, '#6b7050')
      r(10, 10, 2, 1, '#6b7050')
    },
  },
  crate: {
    base: '#9c7a45',
    draw: (r) => {
      r(0, 0, 16, 2, '#6f5430')
      r(0, 14, 16, 2, '#6f5430')
      r(0, 0, 2, 16, '#6f5430')
      r(14, 0, 2, 16, '#6f5430')
      r(7, 0, 2, 16, '#7d6136')
      r(5, 6, 6, 4, '#4a4a4a')
    },
  },
  ammo: {
    base: '#5d5136',
    draw: (r) => {
      r(0, 0, 16, 2, '#3e3722')
      r(0, 14, 16, 2, '#3e3722')
      for (let x = 2; x < 15; x += 3) {
        r(x, 5, 2, 6, '#c9a227')
        r(x, 4, 2, 1, '#8a6f1a')
      }
    },
  },
  medical: {
    base: '#e8e8e8',
    draw: (r) => {
      r(6, 3, 4, 10, '#c0392b')
      r(3, 6, 10, 4, '#c0392b')
      r(0, 15, 16, 1, '#c4c4c4')
    },
  },
  generator: {
    base: '#5a5f52',
    draw: (r) => {
      r(2, 3, 12, 10, '#474b40')
      r(4, 5, 8, 6, '#2f322a')
      r(9, 11, 4, 1, '#8a8a8a')
      r(2, 2, 12, 1, '#6f7565')
      r(0, 15, 16, 1, '#3a3d34')
    },
  },
  turret: {
    base: '#6d6f63',
    draw: (r) => {
      r(2, 9, 12, 5, '#4f5247')
      r(5, 5, 6, 4, '#3a3d34')
      r(7, 2, 2, 4, '#8f9384')
      r(3, 11, 10, 1, '#2c2f28')
    },
  },
  beacon: {
    base: '#3d4a52',
    draw: (r) => {
      r(3, 8, 10, 7, '#2b343a')
      r(6, 3, 4, 5, '#7ce0a8')
      r(7, 1, 2, 2, '#b9f5d4')
      r(2, 14, 12, 1, '#1f262a')
    },
  },
}

/** 16x16 tiling texture for a custom block. */
export async function blockTexture(kind: BlockTexKind): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  const pattern = BLOCK_PATTERNS[kind]
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  rect(0, 0, 16, 16, pattern.base)
  // Soft vertical shading so the block is not flat.
  for (let y = 0; y < 16; y++) rect(0, y, 16, 1, shade(pattern.base, Math.round(Math.sin(y * 0.7) * 10) - 4))
  pattern.draw?.(rect)

  return toPng(canvas)
}

type Rect = (x: number, y: number, w: number, h: number, color: string) => void

function gunIcon(r: Rect, p: string, s: string, a: string, long: boolean): void {
  r(2, 6, long ? 12 : 9, 3, p)
  r(2, 6, long ? 12 : 9, 1, s)
  r(3, 9, 2, 4, a)
  if (long) {
    r(1, 9, 4, 2, a)
    r(11, 4, 3, 2, s)
    r(6, 9, 2, 3, s)
  } else {
    r(10, 7, 2, 1, s)
  }
}

const ICON_DRAWERS: Record<IconShape, (r: Rect, p: string, s: string, a: string) => void> = {
  blade: (r, p, s, a) => {
    r(8, 1, 2, 10, p)
    r(9, 1, 1, 10, s)
    r(6, 11, 5, 2, a)
    r(7, 13, 2, 2, a)
  },
  blunt: (r, p, s, a) => {
    r(8, 1, 4, 8, p)
    r(8, 1, 1, 8, s)
    r(9, 2, 1, 1, s)
    r(11, 3, 1, 1, s)
    r(7, 9, 3, 6, a)
  },
  axe: (r, p, s, a) => {
    r(7, 3, 3, 12, a)
    r(9, 1, 6, 6, p)
    r(12, 1, 3, 6, s)
    r(10, 2, 1, 4, s)
  },
  katana: (r, p, s, a) => {
    r(3, 12, 11, 2, p)
    r(3, 12, 11, 1, s)
    r(2, 9, 3, 3, a)
    r(1, 11, 1, 5, a)
  },
  crowbar: (r, p, s, a) => {
    r(4, 3, 2, 11, p)
    r(4, 3, 1, 11, s)
    r(5, 2, 4, 2, p)
    r(9, 1, 2, 3, p)
    r(11, 2, 1, 2, s)
    r(3, 13, 4, 2, a)
  },
  hammer: (r, p, s, a) => {
    r(7, 5, 3, 10, a)
    r(3, 2, 11, 5, p)
    r(3, 2, 11, 1, s)
    r(5, 4, 1, 1, s)
    r(11, 4, 1, 1, s)
  },
  spear: (r, p, s, a) => {
    r(2, 13, 11, 2, a)
    r(12, 4, 2, 9, p)
    r(13, 2, 2, 4, s)
    r(14, 5, 1, 3, s)
  },
  knife: (r, p, s, a) => {
    r(8, 2, 3, 8, p)
    r(8, 2, 1, 8, s)
    r(6, 10, 5, 2, a)
    r(7, 12, 2, 3, a)
  },
  pistol: (r, p, s, a) => gunIcon(r, p, s, a, false),
  smg: (r, p, s, a) => {
    gunIcon(r, p, s, a, true)
    r(5, 12, 3, 3, a)
  },
  shotgun: (r, p, s, a) => {
    r(1, 7, 14, 3, p)
    r(1, 7, 14, 1, s)
    r(2, 10, 4, 3, a)
    r(11, 4, 3, 3, s)
  },
  rifle: (r, p, s, a) => {
    gunIcon(r, p, s, a, true)
    r(2, 9, 4, 2, a)
    r(12, 3, 2, 3, s)
  },
  sniper: (r, p, s, a) => {
    r(1, 7, 15, 2, p)
    r(1, 7, 15, 1, s)
    r(2, 10, 4, 3, a)
    r(7, 4, 5, 3, s)
    r(11, 3, 3, 1, s)
  },
  lmg: (r, p, s, a) => {
    gunIcon(r, p, s, a, true)
    r(6, 9, 5, 4, a)
    r(4, 13, 8, 2, s)
  },
  launcher: (r, p, s, a) => {
    r(1, 6, 14, 4, p)
    r(1, 6, 14, 1, s)
    r(12, 10, 3, 4, a)
    r(4, 10, 3, 3, a)
  },
  ammo: (r, p, s, a) => {
    r(4, 4, 3, 8, p)
    r(9, 4, 3, 8, p)
    r(4, 3, 3, 1, s)
    r(9, 3, 3, 1, s)
    r(4, 10, 3, 1, a)
    r(9, 10, 3, 1, a)
  },
  shell: (r, p, s, a) => {
    r(4, 5, 8, 3, p)
    r(4, 8, 8, 4, s)
    r(3, 5, 1, 7, a)
    r(12, 5, 1, 7, a)
  },
  rocket: (r, p, s, a) => {
    r(6, 3, 4, 9, p)
    r(7, 1, 2, 3, s)
    r(5, 12, 2, 3, a)
    r(9, 12, 2, 3, a)
  },
  grenade: (r, p, s, a) => {
    r(4, 5, 8, 9, p)
    r(4, 5, 8, 1, s)
    r(6, 2, 4, 3, a)
    r(7, 1, 2, 1, s)
  },
  bottle: (r, p, s, a) => {
    r(6, 1, 4, 3, a)
    r(4, 4, 8, 10, p)
    r(4, 4, 8, 1, s)
    r(5, 8, 6, 5, s)
  },
  can: (r, p, s, a) => {
    r(3, 3, 10, 11, p)
    r(3, 3, 10, 2, s)
    r(3, 12, 10, 2, a)
    r(5, 6, 6, 4, s)
  },
  bar: (r, p, s, a) => {
    r(2, 5, 12, 7, p)
    r(2, 5, 12, 2, s)
    r(4, 8, 8, 2, a)
  },
  box: (r, p, s, a) => {
    r(2, 3, 12, 11, p)
    r(2, 3, 12, 2, s)
    r(7, 3, 2, 11, a)
    r(3, 6, 10, 1, a)
  },
  vial: (r, p, s, a) => {
    r(6, 1, 4, 2, s)
    r(4, 3, 8, 11, p)
    r(5, 6, 6, 7, a)
  },
  pill: (r, p, s, a) => {
    r(3, 6, 10, 5, p)
    r(3, 6, 5, 5, s)
    r(9, 6, 4, 5, a)
  },
  syringe: (r, p, s, a) => {
    r(3, 5, 9, 3, p)
    r(4, 8, 7, 2, s)
    r(12, 6, 3, 1, a)
    r(2, 4, 2, 5, a)
  },
  medkit: (r, p, s, a) => {
    r(2, 3, 12, 11, p)
    r(2, 3, 12, 2, s)
    r(7, 6, 2, 6, a)
    r(5, 8, 6, 2, a)
  },
  bandage: (r, p, s, a) => {
    r(3, 4, 10, 8, p)
    r(3, 4, 10, 1, s)
    r(6, 6, 4, 4, a)
    r(4, 12, 8, 2, s)
  },
  device: (r, p, s, a) => {
    r(3, 2, 5, 12, p)
    r(3, 2, 5, 2, s)
    r(9, 3, 4, 10, a)
    r(10, 5, 2, 6, s)
  },
  radio: (r, p, s, a) => {
    r(2, 5, 12, 9, p)
    r(2, 5, 12, 2, s)
    r(4, 8, 5, 4, a)
    r(11, 4, 1, 4, s)
  },
  pick: (r, p, s, a) => {
    r(9, 2, 2, 12, a)
    r(4, 2, 8, 2, p)
    r(4, 2, 8, 1, s)
    r(3, 3, 2, 2, p)
    r(12, 3, 2, 2, p)
  },
  tool: (r, p, s, a) => {
    r(4, 4, 8, 8, p)
    r(4, 4, 8, 1, s)
    r(6, 6, 4, 4, a)
    r(12, 8, 3, 2, s)
  },
  lens: (r, p, s, a) => {
    r(3, 5, 6, 6, p)
    r(4, 6, 4, 4, a)
    r(9, 7, 5, 3, s)
    r(6, 9, 3, 4, s)
  },
  bell: (r, p, s, a) => {
    r(5, 3, 6, 2, a)
    r(4, 5, 8, 7, p)
    r(5, 6, 6, 1, s)
    r(7, 12, 2, 2, a)
  },
  beacon: (r, p, s, a) => {
    r(4, 8, 8, 6, p)
    r(7, 3, 2, 5, a)
    r(6, 1, 4, 2, s)
    r(3, 13, 10, 1, s)
  },
  armorHead: (r, p, s, a) => {
    r(3, 3, 10, 8, p)
    r(3, 3, 10, 2, s)
    r(4, 9, 8, 3, a)
    r(5, 5, 2, 2, a)
    r(9, 5, 2, 2, a)
  },
  armorChest: (r, p, s, a) => {
    r(4, 2, 8, 12, p)
    r(4, 2, 8, 2, s)
    r(1, 4, 3, 6, a)
    r(12, 4, 3, 6, a)
  },
  armorLegs: (r, p, s, a) => {
    r(4, 2, 8, 4, s)
    r(4, 5, 3, 9, p)
    r(9, 5, 3, 9, p)
    r(4, 12, 3, 2, a)
    r(9, 12, 3, 2, a)
  },
  armorBoots: (r, p, s, a) => {
    r(3, 8, 4, 6, p)
    r(9, 8, 4, 6, p)
    r(3, 12, 4, 2, s)
    r(9, 12, 4, 2, s)
    r(3, 8, 4, 1, a)
    r(9, 8, 4, 1, a)
  },
}

/** 16x16 inventory icon drawn from a shape + palette. */
export async function itemIcon(spec: IconSpec): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.clearRect(0, 0, 16, 16)
  const rect: Rect = (x, y, w, h, color) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  ICON_DRAWERS[spec.shape](rect, spec.primary, spec.secondary, spec.accent ?? spec.secondary)
  return toPng(canvas)
}
