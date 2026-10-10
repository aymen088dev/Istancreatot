/**
 * REMNANT pack builder.
 *
 * Produces the fused `.mcaddon`: our own systems (16 zombie variants, weapons,
 * blocks, 14 original armour sets, survival bars) plus everything harvested from
 * the donor addons (345 armour pieces and their render chains, structures,
 * sounds).
 *
 * The texture generator draws with a 2D canvas; this script installs a minimal
 * pure-JS canvas plus a zlib-backed PNG encoder so the exact same generator
 * modules run headlessly in Node/Bun.
 *
 * Usage: bun run scripts/build-pack.ts [output.mcaddon]
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ASSET_ROOT, diskAssetLoader } from '../generator/assets'
import { buildMcAddon, folderName, normalizeConfig, packSummary } from '../generator/build'
import { DONOR_ROOT, loadDonors } from '../generator/donors'
import { DEFAULT_CONFIG } from '../generator/options'

/* ------------------------------ PNG encoder ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    png.set(part, offset)
    offset += part.length
  }
  return png
}

/* ------------------------------ canvas shim ------------------------------ */

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba {
  const text = String(value).trim()
  if (text.startsWith('#')) {
    const hex = text.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        255,
      ]
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    ]
  }
  const match = /rgba?\(([^)]+)\)/.exec(text)
  if (match) {
    const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()))
    return [parts[0] | 0, parts[1] | 0, parts[2] | 0, Math.round((parts[3] ?? 1) * 255)]
  }
  return [0, 0, 0, 255]
}

class ShimContext {
  fillStyle = '#000000'
  private readonly canvas: ShimCanvas

  constructor(canvas: ShimCanvas) {
    this.canvas = canvas
  }

  private blend(x: number, y: number, color: Rgba): void {
    const data = this.canvas.buffer
    const index = (y * this.canvas.width + x) * 4
    const alpha = color[3] / 255
    if (alpha <= 0) return
    for (let channel = 0; channel < 3; channel++) {
      data[index + channel] = Math.round(color[channel] * alpha + data[index + channel] * (1 - alpha))
    }
    data[index + 3] = Math.round(alpha * 255 + data[index + 3] * (1 - alpha))
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const color = parseColor(this.fillStyle)
    const startX = Math.max(0, Math.floor(x))
    const startY = Math.max(0, Math.floor(y))
    const endX = Math.min(this.canvas.width, Math.floor(x + w))
    const endY = Math.min(this.canvas.height, Math.floor(y + h))
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) this.blend(px, py, color)
    }
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    const startX = Math.max(0, Math.floor(x))
    const startY = Math.max(0, Math.floor(y))
    const endX = Math.min(this.canvas.width, Math.floor(x + w))
    const endY = Math.min(this.canvas.height, Math.floor(y + h))
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const index = (py * this.canvas.width + px) * 4
        this.canvas.buffer.fill(0, index, index + 4)
      }
    }
  }
}

class ShimCanvas {
  width = 0
  height = 0
  buffer = new Uint8Array(0)
  private context: ShimContext | null = null

  getContext(kind: string): ShimContext | null {
    if (kind !== '2d') return null
    if (!this.context) {
      this.buffer = new Uint8Array(this.width * this.height * 4)
      this.context = new ShimContext(this)
    }
    return this.context
  }

  toBlob(callback: (blob: Blob | null) => void): void {
    const png = encodePng(this.width, this.height, this.buffer)
    callback(new Blob([png as unknown as BlobPart], { type: 'image/png' }))
  }
}

;(globalThis as { document?: unknown }).document = {
  createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`unsupported element: ${tag}`)
    return new ShimCanvas()
  },
}

/* -------------------------------- the build ------------------------------- */

const output = process.argv[2] ?? 'dist-pack/remnant.mcaddon'

const donors = loadDonors(DONOR_ROOT)
if (donors.items.length === 0) {
  console.warn('!! aucun donneur fusionné — lance `bun run pack:harvest` d abord')
}

const cfg = normalizeConfig({ ...DEFAULT_CONFIG })

const started = Date.now()
const summary = packSummary(cfg)
const result = await buildMcAddon(cfg, diskAssetLoader(ASSET_ROOT), donors)
const bytes = new Uint8Array(await result.blob.arrayBuffer())

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, bytes)

console.log(`\n${folderName(cfg)}.mcaddon`)
console.log(
  `  ${result.fileCount} fichiers · ${(bytes.length / 1048576).toFixed(2)} Mo · ` +
    `${((Date.now() - started) / 1000).toFixed(1)}s -> ${output}`,
)
console.log(
  `\n  original : ${summary.variants} variantes · ${summary.mobs} créatures · ` +
    `${summary.weapons} armes · ${summary.items} objets · ${summary.armor} pièces d'armure`,
)
console.log(`  donneurs : ${donors.items.length} pièces d'armure fusionnées`)
for (const source of donors.sources) {
  console.log(
    `    ${source.label.padEnd(34)} ${String(source.items).padStart(4)} pièces · ` +
      `${source.modernisedSlots} slots normalisés`,
  )
}
const recipeCount = donors.behavior.filter((file) => file.path.startsWith('recipes/')).length
console.log(`    recettes donneuses utilisables : ${recipeCount}`)
