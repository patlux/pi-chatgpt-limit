/** @param {number} count */
export function formatTokens(count) {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1000000) return `${Math.round(count / 1000)}k`
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`
  return `${Math.round(count / 1000000)}M`
}

/** @param {{ usedPercent: number } | undefined} window */
export function formatUsedPercent(window) {
  if (!window) return "?%"
  return `${Math.round(Math.max(0, Math.min(100, window.usedPercent)))}%`
}

/** @param {{ usedPercent: number } | undefined} window */
export function formatRemainingPercent(window) {
  if (!window) return "?%"
  return `${Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)))}%`
}

/** @param {number | undefined} resetAt */
export function formatResetShort(resetAt) {
  if (!resetAt) return "?"

  const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000))
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)

  if (days > 0) return `~${days}d`
  if (hours > 0) return `~${hours}h`
  return `~${minutes}m`
}

/** @param {number | undefined} resetAt */
export function formatResetLong(resetAt) {
  if (!resetAt) return "unknown"

  const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000))
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60

  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}

/* @param {{ usedPercent: number, windowSeconds: number, resetAt: number } | undefined} window
 * @returns {number} Pace in percentage points (positive = deficit, negative = reserve, 0 = on pace); NaN if not calculable
 */
function calculatePacePercentValue(window) {
  if (!window || !window.resetAt || !window.windowSeconds) return NaN

  const nowSec = Date.now() / 1000
  const resetAtSec = window.resetAt
  const windowSec = window.windowSeconds

  const windowStart = resetAtSec - windowSec
  if (nowSec < windowStart) return NaN

  const elapsedSec = Math.min(windowSec, nowSec - windowStart)
  const elapsedPercent = (elapsedSec / windowSec) * 100

  if (elapsedPercent < 0.1) return NaN

  return window.usedPercent - elapsedPercent
}

/* @param {{ usedPercent: number, windowSeconds: number, resetAt: number } | undefined} window */
export function formatPacePercent(window) {
  const pace = calculatePacePercentValue(window)

  if (isNaN(pace)) {
    if (!window || !window.resetAt || !window.windowSeconds) return "?%"

    const nowSec = Date.now() / 1000
    const windowStart = window.resetAt - window.windowSeconds
    if (nowSec < windowStart) return "?% (not started)"

    return "?% (starting)"
  }

  if (Math.abs(pace) < 0.1) return "0% (on pace)"

  const roundedPace = Math.round(Math.abs(pace))
  return pace > 0 ? `${roundedPace}% (deficit)` : `${roundedPace}% (reserve)`
}

/* @param {{ usedPercent: number, windowSeconds: number, resetAt: number } | undefined} window */
export function formatPacePercentShort(window) {
  const pace = calculatePacePercentValue(window)

  if (isNaN(pace)) return "?%"
  if (pace > 0) return `+${Math.round(pace)}%`
  if (pace < 0) return `${Math.round(pace)}%`
  return "=0%"
}
