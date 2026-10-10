/** RFC 4122 v4 UUID for Bedrock pack/module identifiers. */
export function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`
}

/** Turn a free-form namespace into a valid Bedrock identifier namespace. */
export function sanitizeNamespace(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const safe = cleaned.length > 0 ? cleaned : 'remnant'
  return /^[0-9]/.test(safe) ? `x_${safe}` : safe
}

/** Namespaced variant id, e.g. `remnant:zombie_walker`. */
export function zombieId(namespace: string, variant: string): string {
  return `${namespace}:zombie_${variant}`
}

/**
 * Normalises the item icon component.
 *
 * `minecraft:icon` has three shapes and Microsoft marks the flat `texture`
 * property as deprecated, so every component block is rewritten to the current
 * `textures.default` form before it reaches the pack.
 */
export function modernIcon(components: Record<string, unknown>): Record<string, unknown> {
  const icon = components['minecraft:icon']
  if (icon && typeof icon === 'object' && 'texture' in icon) {
    const key = (icon as { texture: unknown }).texture
    return { ...components, 'minecraft:icon': { textures: { default: key } } }
  }
  return components
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
