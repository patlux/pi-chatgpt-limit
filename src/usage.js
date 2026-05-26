import {
  CHATGPT_BASE_URL,
  FIVE_HOUR_SECONDS,
  WEEK_SECONDS,
} from "./constants.js"
import { getTokenMetadata, isOpenAICodexProvider } from "./auth.js"
import {
  formatPacePercent,
  formatRemainingPercent,
  formatResetLong,
  formatUsedPercent,
} from "./format.js"
import { asRecord } from "./records.js"

/** @param {unknown} value */
function normalizeWindow(value) {
  const record = asRecord(value)
  if (!record) return undefined

  const usedPercent =
    typeof record.used_percent === "number" ? record.used_percent : undefined
  const windowSeconds =
    typeof record.limit_window_seconds === "number"
      ? record.limit_window_seconds
      : undefined
  const resetAt =
    typeof record.reset_at === "number" ? record.reset_at : undefined

  if (usedPercent === undefined || windowSeconds === undefined) return undefined
  return { usedPercent, windowSeconds, resetAt }
}

/** @param {unknown} data */
function parseUsageSnapshot(data) {
  const raw = asRecord(data)
  const rateLimit = asRecord(raw?.rate_limit)
  const windows = [
    normalizeWindow(rateLimit?.primary_window),
    normalizeWindow(rateLimit?.secondary_window),
  ].filter(Boolean)

  return {
    planType: typeof raw?.plan_type === "string" ? raw.plan_type : undefined,
    email: typeof raw?.email === "string" ? raw.email : undefined,
    fiveHour: windows.find(
      (window) => Math.abs(window.windowSeconds - FIVE_HOUR_SECONDS) <= 120,
    ),
    weekly: windows.find(
      (window) => Math.abs(window.windowSeconds - WEEK_SECONDS) <= 120,
    ),
    fetchedAt: Date.now(),
  }
}

/** @param {import('@earendil-works/pi-coding-agent').ExtensionContext} ctx */
export async function updateUsage(ctx, state) {
  const model = ctx.model
  if (!isOpenAICodexProvider(model?.provider)) {
    state.usageSnapshot = undefined
    state.requestRender()
    return undefined
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model)
  if (!auth.ok || !auth.apiKey) {
    state.usageSnapshot = undefined
    state.requestRender()
    return undefined
  }

  const tokenMetadata = getTokenMetadata(auth.apiKey)
  const headers = {
    Authorization: `Bearer ${auth.apiKey}`,
    Accept: "application/json",
    "User-Agent": "pi-chatgpt-weekly-limit",
    ...(tokenMetadata.accountId
      ? { "chatgpt-account-id": tokenMetadata.accountId }
      : {}),
  }

  try {
    const response = await fetch(`${CHATGPT_BASE_URL}/wham/usage`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      state.usageSnapshot = undefined
      state.requestRender()
      return undefined
    }

    state.usageSnapshot = parseUsageSnapshot(await response.json())
    if (!state.usageSnapshot.email && tokenMetadata.email)
      state.usageSnapshot.email = tokenMetadata.email
    if (!state.usageSnapshot.planType && tokenMetadata.planType)
      state.usageSnapshot.planType = tokenMetadata.planType
    state.requestRender()
    return state.usageSnapshot
  } catch {
    state.usageSnapshot = undefined
    state.requestRender()
    return undefined
  }
}

export function buildUsageDetails(snapshot, provider, footerDescription) {
  const lines = []
  lines.push(`provider: ${provider}`)
  lines.push(`plan: ${snapshot?.planType || "unknown"}`)
  if (snapshot?.email) lines.push(`email: ${snapshot.email}`)
  lines.push(
    `5-hour: ${formatUsedPercent(snapshot?.fiveHour)} used, ${formatRemainingPercent(snapshot?.fiveHour)} left, resets ${formatResetLong(snapshot?.fiveHour?.resetAt)}`,
  )
  lines.push(
    `weekly: ${formatUsedPercent(snapshot?.weekly)} used, ${formatRemainingPercent(snapshot?.weekly)} left, resets ${formatResetLong(snapshot?.weekly?.resetAt)}`,
  )
  lines.push(`pace: ${formatPacePercent(snapshot?.weekly)}`)
  if (snapshot?.fetchedAt)
    lines.push(`fetched: ${new Date(snapshot.fetchedAt).toLocaleString()}`)
  lines.push(`footer: ${footerDescription}`)
  lines.push(`endpoint: ${CHATGPT_BASE_URL}/wham/usage`)
  return lines
}
