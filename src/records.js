/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | undefined}
 */
export function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  return Object.fromEntries(Object.entries(value))
}
