/**
 * Bedrock JSON quirks.
 *
 * Two things bite when reading real addon files:
 *  - packs ship JSON containing block comments, which `JSON.parse` rejects but
 *    the game accepts;
 *  - geometry identifiers appear in three different shapes across format
 *    versions, and a pack may use more than one.
 */

/** Parse JSON the way the game does, tolerating comments and trailing commas. */
export function parseLooseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    /* fall through to the comment strip */
  }
  try {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'])\/\/[^\n]*/g, '$1')
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(stripped) as T
  } catch {
    return null
  }
}

/**
 * Every geometry identifier a file declares:
 *  1.12+  "minecraft:geometry": [ { "description": { "identifier": "..." } } ]
 *  1.12   "minecraft:geometry": { "description": { "identifier": "..." } }
 *  1.10   "geometry.name": { "bones": [...] }            (top-level key)
 */
export function geometryIdentifiers(data: unknown): string[] {
  if (!data || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  const identifiers: string[] = []

  const geometry = record['minecraft:geometry']
  if (Array.isArray(geometry)) {
    for (const entry of geometry) {
      const identifier = (entry as { description?: { identifier?: string } })?.description?.identifier
      if (typeof identifier === 'string') identifiers.push(identifier)
    }
  } else if (geometry && typeof geometry === 'object') {
    const identifier = (geometry as { description?: { identifier?: string } }).description?.identifier
    if (typeof identifier === 'string') identifiers.push(identifier)
  }

  for (const key of Object.keys(record)) {
    if (key.startsWith('geometry.')) identifiers.push(key)
  }

  return identifiers
}
