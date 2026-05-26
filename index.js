/**
 * Show ChatGPT Pro/Codex weekly usage percentage inline in pi's footer.
 *
 * Uses ChatGPT's usage endpoint:
 *   GET https://chatgpt.com/backend-api/wham/usage
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui"

const CHATGPT_BASE_URL = (
  process.env.CHATGPT_BASE_URL || "https://chatgpt.com/backend-api"
).replace(/\/+$/, "")
const OPENAI_AUTH_CLAIM = "https://api.openai.com/auth"
const OPENAI_PROFILE_CLAIM = "https://api.openai.com/profile"
const FIVE_HOUR_SECONDS = 5 * 60 * 60
const WEEK_SECONDS = 7 * 24 * 60 * 60
const CONFIG_ENTRY_TYPE = "chatgpt-limit-config"
const CONFIG_FILE_NAME = "chatgpt-limit.json"

const DEFAULT_FOOTER_CONFIG = {
  quotaWindow: "weekly",
  displayMode: "used",
}

const QUOTA_WINDOW_OPTIONS = [
  { label: "Weekly usage (default)", value: "weekly" },
  { label: "5-hour usage", value: "fiveHour" },
  { label: "Both 5-hour and weekly", value: "both" },
  { label: "Hide usage from footer", value: "hidden" },
]

const DISPLAY_MODE_OPTIONS = [
  { label: "Used percent, e.g. W 42%", value: "used" },
  { label: "Used percent with reset, e.g. W 42% · ~2d", value: "compact" },
  { label: "Pace percent with state, e.g. WP 13% (reserve)", value: "pace" },
  { label: "Pace percent, e.g. WP -13%", value: "paceCompact" },
  {
    label: "Pace percent with reset, e.g. WP -13% · ~2d",
    value: "paceResetCompact",
  },
  { label: "Remaining percent, e.g. W 58% left", value: "remaining" },
  {
    label: "Remaining percent with reset, e.g. W 58% left · ~2d",
    value: "remainingCompact",
  },
]

let usageSnapshot
let footerConfig = { ...DEFAULT_FOOTER_CONFIG }
let refreshTimer
let requestRender = () => {}

/** @param {string | undefined} provider */
function isOpenAICodexProvider(provider) {
  return (
    provider === "openai-codex" || /^openai-codex-\d+$/.test(provider || "")
  )
}

/** @param {number} count */
function formatTokens(count) {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1000000) return `${Math.round(count / 1000)}k`
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`
  return `${Math.round(count / 1000000)}M`
}

/** @param {string} token */
function decodeJwtPayload(token) {
  const parts = token.split(".")
  if (parts.length < 2) return {}

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
  } catch {
    return {}
  }
}

/** @param {string} token */
function getTokenMetadata(token) {
  const payload = decodeJwtPayload(token)
  const auth =
    payload && typeof payload === "object"
      ? payload[OPENAI_AUTH_CLAIM]
      : undefined
  const profile =
    payload && typeof payload === "object"
      ? payload[OPENAI_PROFILE_CLAIM]
      : undefined

  return {
    accountId:
      auth && typeof auth.chatgpt_account_id === "string"
        ? auth.chatgpt_account_id
        : undefined,
    planType:
      auth && typeof auth.chatgpt_plan_type === "string"
        ? auth.chatgpt_plan_type
        : undefined,
    email:
      profile && typeof profile.email === "string" ? profile.email : undefined,
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | undefined}
 */
function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  return Object.fromEntries(Object.entries(value))
}

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

/** @param {{ usedPercent: number } | undefined} window */
function formatUsedPercent(window) {
  if (!window) return "?%"
  return `${Math.round(Math.max(0, Math.min(100, window.usedPercent)))}%`
}

/** @param {{ usedPercent: number } | undefined} window */
function formatRemainingPercent(window) {
  if (!window) return "?%"
  return `${Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)))}%`
}

/** @param {number | undefined} resetAt */
function formatResetShort(resetAt) {
  if (!resetAt) return "?"

  const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000))
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)

  if (days > 0) return `~${days}d`
  if (hours > 0) return `~${hours}h`
  return `~${minutes}m`
}

/** @param {number | undefined} resetAt */
function formatResetLong(resetAt) {
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
function formatPacePercent(window) {
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
function formatPacePercentShort(window) {
  const pace = calculatePacePercentValue(window)

  if (isNaN(pace)) return "?%"
  if (pace > 0) return `+${Math.round(pace)}%`
  if (pace < 0) return `${Math.round(pace)}%`
  return "=0%"
}

function normalizeFooterConfig(value) {
  const record = asRecord(value)
  const rawQuotaWindow = record?.quotaWindow
  const quotaWindow =
    typeof rawQuotaWindow === "string" &&
    QUOTA_WINDOW_OPTIONS.some((option) => option.value === rawQuotaWindow)
      ? rawQuotaWindow
      : DEFAULT_FOOTER_CONFIG.quotaWindow

  const rawDisplayMode = record?.displayMode
  const displayMode =
    typeof rawDisplayMode === "string" &&
    DISPLAY_MODE_OPTIONS.some((option) => option.value === rawDisplayMode)
      ? rawDisplayMode
      : DEFAULT_FOOTER_CONFIG.displayMode

  return { quotaWindow, displayMode }
}

function getConfigPath() {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent")
  return join(agentDir, CONFIG_FILE_NAME)
}

async function readGlobalFooterConfig() {
  try {
    return normalizeFooterConfig(
      JSON.parse(await readFile(getConfigPath(), "utf8")),
    )
  } catch {
    return undefined
  }
}

async function writeGlobalFooterConfig(config) {
  const configPath = getConfigPath()
  const tempPath = `${configPath}.${process.pid}.tmp`
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`)
  await rename(tempPath, configPath)
}

async function restoreFooterConfig(ctx) {
  footerConfig =
    (await readGlobalFooterConfig()) || restoreLegacySessionFooterConfig(ctx)
}

function restoreLegacySessionFooterConfig(ctx) {
  let config = { ...DEFAULT_FOOTER_CONFIG }
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === CONFIG_ENTRY_TYPE) {
      config = normalizeFooterConfig(entry.data)
    }
  }
  return config
}

function describeFooterConfig() {
  const quotaWindow = QUOTA_WINDOW_OPTIONS.find(
    (option) => option.value === footerConfig.quotaWindow,
  )
  const displayMode = DISPLAY_MODE_OPTIONS.find(
    (option) => option.value === footerConfig.displayMode,
  )
  return `${quotaWindow?.label || "Weekly usage"}; ${displayMode?.label || "Used percent"}`
}

async function saveFooterConfig(nextConfig) {
  footerConfig = normalizeFooterConfig(nextConfig)
  requestRender()
  await writeGlobalFooterConfig(footerConfig)
}

/** @param {import('@earendil-works/pi-ai').AssistantMessage['usage']} usage */
function addUsage(total, usage) {
  total.input += usage?.input ?? 0
  total.output += usage?.output ?? 0
  total.cacheRead += usage?.cacheRead ?? 0
  total.cacheWrite += usage?.cacheWrite ?? 0
  total.cost += usage?.cost?.total ?? 0
}

function getUsageColor(window) {
  const used = Math.max(0, Math.min(100, window?.usedPercent ?? 0))
  if (used >= 90) return "error"
  if (used >= 80) return "warning"
  return "dim"
}

function formatFooterUsagePart(label, window, theme) {
  if (!window) return undefined

  let text
  if (label === "W" && footerConfig.displayMode.startsWith("pace")) {
    if (footerConfig.displayMode === "pace") {
      text = `WP ${formatPacePercent(window)}`
    } else if (footerConfig.displayMode === "paceCompact") {
      text = `WP ${formatPacePercentShort(window)}`
    } else if (footerConfig.displayMode === "paceResetCompact") {
      text = `WP ${formatPacePercentShort(window)} · ${formatResetShort(window.resetAt)}`
    }
  } else {
    if (footerConfig.displayMode === "remaining") {
      text = `${label} ${formatRemainingPercent(window)} left`
    } else if (footerConfig.displayMode === "remainingCompact") {
      text = `${label} ${formatRemainingPercent(window)} left · ${formatResetShort(window.resetAt)}`
    } else {
      const used = formatUsedPercent(window)
      text =
        footerConfig.displayMode === "compact"
          ? `${label} ${used} · ${formatResetShort(window.resetAt)}`
          : `${label} ${used}`
    }
  }

  return theme.fg(getUsageColor(window), text)
}

function formatFooterUsage(theme) {
  if (footerConfig.quotaWindow === "hidden") return undefined

  const parts = []
  if (
    footerConfig.quotaWindow === "fiveHour" ||
    footerConfig.quotaWindow === "both"
  ) {
    const part = formatFooterUsagePart("5h", usageSnapshot?.fiveHour, theme)
    if (part) parts.push(part)
  }
  if (
    footerConfig.quotaWindow === "weekly" ||
    footerConfig.quotaWindow === "both"
  ) {
    const part = formatFooterUsagePart("W", usageSnapshot?.weekly, theme)
    if (part) parts.push(part)
  }

  return parts.length > 0 ? parts.join(theme.fg("dim", " / ")) : undefined
}

function renderFooter(pi, ctx, footerData, theme, width) {
  const model = ctx.model

  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      addUsage(total, entry.message.usage)
    }
  }

  const contextUsage = ctx.getContextUsage()
  const contextWindow = contextUsage?.contextWindow ?? model?.contextWindow ?? 0
  const contextPercentValue = contextUsage?.percent ?? 0
  const contextPercent =
    contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?"

  let pwd = ctx.sessionManager.getCwd()
  const home = process.env.HOME || process.env.USERPROFILE
  if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`

  const branch = footerData.getGitBranch()
  if (branch) pwd = `${pwd} (${branch})`

  const sessionName = ctx.sessionManager.getSessionName()
  if (sessionName) pwd = `${pwd} • ${sessionName}`

  const statsParts = []
  if (total.input) statsParts.push(`↑${formatTokens(total.input)}`)
  if (total.output) statsParts.push(`↓${formatTokens(total.output)}`)
  if (total.cacheRead) statsParts.push(`R${formatTokens(total.cacheRead)}`)
  if (total.cacheWrite) statsParts.push(`W${formatTokens(total.cacheWrite)}`)

  const usingSubscription = model
    ? ctx.modelRegistry.isUsingOAuth(model)
    : false
  if (total.cost || usingSubscription)
    statsParts.push(
      `$${total.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`,
    )

  const contextDisplay =
    contextPercent === "?"
      ? `?/${formatTokens(contextWindow)}`
      : `${contextPercent}%/${formatTokens(contextWindow)}`
  const contextColored =
    contextPercentValue > 90
      ? theme.fg("error", contextDisplay)
      : contextPercentValue > 70
        ? theme.fg("warning", contextDisplay)
        : contextDisplay
  statsParts.push(contextColored)

  let statsLeft = statsParts.join(" ")
  let statsLeftWidth = visibleWidth(statsLeft)
  if (statsLeftWidth > width) {
    statsLeft = truncateToWidth(statsLeft, width, "...")
    statsLeftWidth = visibleWidth(statsLeft)
  }

  const modelName = model?.id || "no-model"
  let rightSideWithoutProvider = modelName
  if (model?.reasoning) {
    const thinkingLevel = pi.getThinkingLevel ? pi.getThinkingLevel() : "off"
    rightSideWithoutProvider =
      thinkingLevel === "off"
        ? `${modelName} • thinking off`
        : `${modelName} • ${thinkingLevel}`
  }

  if (isOpenAICodexProvider(model?.provider)) {
    const footerUsage = formatFooterUsage(theme)
    if (footerUsage) {
      rightSideWithoutProvider += ` • ${footerUsage}`
    }
  }

  let rightSide = rightSideWithoutProvider
  if (footerData.getAvailableProviderCount() > 1 && model) {
    rightSide = `(${model.provider}) ${rightSideWithoutProvider}`
    if (statsLeftWidth + 2 + visibleWidth(rightSide) > width)
      rightSide = rightSideWithoutProvider
  }

  const rightSideWidth = visibleWidth(rightSide)
  const minPadding = 2
  let statsLine
  if (statsLeftWidth + minPadding + rightSideWidth <= width) {
    statsLine =
      statsLeft +
      " ".repeat(width - statsLeftWidth - rightSideWidth) +
      rightSide
  } else {
    const availableForRight = width - statsLeftWidth - minPadding
    if (availableForRight > 0) {
      const truncatedRight = truncateToWidth(rightSide, availableForRight, "")
      statsLine =
        statsLeft +
        " ".repeat(
          Math.max(0, width - statsLeftWidth - visibleWidth(truncatedRight)),
        ) +
        truncatedRight
    } else {
      statsLine = statsLeft
    }
  }

  const pwdLine = truncateToWidth(
    theme.fg("dim", pwd),
    width,
    theme.fg("dim", "..."),
  )
  const remainder = statsLine.slice(statsLeft.length)
  return [pwdLine, theme.fg("dim", statsLeft) + theme.fg("dim", remainder)]
}

/** @param {import('@earendil-works/pi-coding-agent').ExtensionContext} ctx */
function installFooter(pi, ctx) {
  ctx.ui.setFooter((tui, theme, footerData) => {
    requestRender = () => tui.requestRender()
    const unsub = footerData.onBranchChange(() => tui.requestRender())
    return {
      dispose() {
        unsub?.()
      },
      invalidate() {},
      render(width) {
        return renderFooter(pi, ctx, footerData, theme, width)
      },
    }
  })
}

/** @param {import('@earendil-works/pi-coding-agent').ExtensionContext} ctx */
async function updateUsage(ctx) {
  const model = ctx.model
  if (!isOpenAICodexProvider(model?.provider)) {
    usageSnapshot = undefined
    requestRender()
    return undefined
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model)
  if (!auth.ok || !auth.apiKey) {
    usageSnapshot = undefined
    requestRender()
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
      usageSnapshot = undefined
      requestRender()
      return undefined
    }

    usageSnapshot = parseUsageSnapshot(await response.json())
    if (!usageSnapshot.email && tokenMetadata.email)
      usageSnapshot.email = tokenMetadata.email
    if (!usageSnapshot.planType && tokenMetadata.planType)
      usageSnapshot.planType = tokenMetadata.planType
    requestRender()
    return usageSnapshot
  } catch {
    usageSnapshot = undefined
    requestRender()
    return undefined
  }
}

function buildUsageDetails(snapshot, provider) {
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
  lines.push(`footer: ${describeFooterConfig()}`)
  lines.push(`endpoint: ${CHATGPT_BASE_URL}/wham/usage`)
  return lines
}

async function selectFooterConfigOption(
  ctx,
  title,
  options,
  currentValue,
  preview,
) {
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => option.value === currentValue),
  )
  const originalConfig = { ...footerConfig }

  const selected = await ctx.ui.custom((tui, theme, _keybindings, done) => {
    let selectedIndex = initialIndex

    function applyPreview() {
      preview(options[selectedIndex].value)
      requestRender()
    }

    applyPreview()

    return {
      invalidate() {},
      handleInput(data) {
        if (matchesKey(data, Key.up)) {
          selectedIndex = Math.max(0, selectedIndex - 1)
          applyPreview()
          tui.requestRender()
          return
        }
        if (matchesKey(data, Key.down)) {
          selectedIndex = Math.min(options.length - 1, selectedIndex + 1)
          applyPreview()
          tui.requestRender()
          return
        }
        if (matchesKey(data, Key.enter)) {
          done(options[selectedIndex])
          return
        }
        if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
          done(undefined)
        }
      },
      render(width) {
        const lines = [
          theme.fg("accent", theme.bold(title)),
          theme.fg("dim", "↑↓ preview in footer • enter save • esc cancel"),
          "",
        ]

        for (let index = 0; index < options.length; index++) {
          const option = options[index]
          const isSelected = index === selectedIndex
          const isCurrent = option.value === currentValue
          const prefix = isSelected ? "› " : "  "
          const suffix = isCurrent ? "  current" : ""
          const text = `${prefix}${option.label}${suffix}`
          lines.push(
            truncateToWidth(
              isSelected ? theme.fg("accent", text) : text,
              width,
              "…",
            ),
          )
        }

        return lines.map((line) => truncateToWidth(line, width, "…"))
      },
    }
  })

  if (!selected) {
    footerConfig = originalConfig
    requestRender()
  }

  return selected
}

async function configureQuotaWindow(ctx) {
  const selected = await selectFooterConfigOption(
    ctx,
    "Display which ChatGPT limit in footer?",
    QUOTA_WINDOW_OPTIONS,
    footerConfig.quotaWindow,
    (quotaWindow) => {
      footerConfig = normalizeFooterConfig({ ...footerConfig, quotaWindow })
    },
  )
  if (!selected) return

  await saveFooterConfig({ ...footerConfig, quotaWindow: selected.value })
  ctx.ui.notify(
    selected.value === "hidden"
      ? "ChatGPT footer display: Hide usage from footer (usage hidden)."
      : `ChatGPT footer display: ${selected.label}`,
    "info",
  )
}

async function configureDisplayMode(ctx) {
  const selected = await selectFooterConfigOption(
    ctx,
    "How should the footer value be shown?",
    DISPLAY_MODE_OPTIONS,
    footerConfig.displayMode,
    (displayMode) => {
      footerConfig = normalizeFooterConfig({ ...footerConfig, displayMode })
    },
  )
  if (!selected) return

  await saveFooterConfig({ ...footerConfig, displayMode: selected.value })
  ctx.ui.notify(`ChatGPT footer mode: ${selected.label}`, "info")
}

async function resetFooterConfig(ctx) {
  const confirmed = await ctx.ui.confirm(
    "Reset ChatGPT footer settings?",
    "This restores the default footer display: weekly usage, used percent.",
  )
  if (!confirmed) return

  await saveFooterConfig(DEFAULT_FOOTER_CONFIG)
  ctx.ui.notify("ChatGPT footer settings reset to defaults.", "info")
}

export default function (pi) {
  /** @type {Promise<unknown>} */
  let inFlight = Promise.resolve()

  function queueUpdate(ctx) {
    inFlight = inFlight.catch(() => undefined).then(() => updateUsage(ctx))
    return inFlight
  }

  function queueUpdateInBackground(ctx) {
    void queueUpdate(ctx).catch(() => undefined)
  }

  pi.on("session_start", async (_event, ctx) => {
    await restoreFooterConfig(ctx)
    installFooter(pi, ctx)
    queueUpdateInBackground(ctx)
  })

  pi.on("model_select", (_event, ctx) => queueUpdateInBackground(ctx))
  pi.on("agent_end", (_event, ctx) => queueUpdateInBackground(ctx))

  pi.on("session_shutdown", async () => {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = undefined
    requestRender = () => {}
  })

  pi.registerCommand("chatgpt-limit", {
    description: "Show ChatGPT Codex 5-hour and weekly usage limits",
    handler: async (_args, ctx) => {
      const action = await ctx.ui.select("ChatGPT Codex usage limits", [
        "Show current usage details",
        `Configure footer limit (${describeFooterConfig()})`,
        "Configure footer display mode",
        "Reset footer settings to defaults",
      ])

      if (action === "Configure footer display mode") {
        await configureDisplayMode(ctx)
        return
      }

      if (action === "Reset footer settings to defaults") {
        await resetFooterConfig(ctx)
        return
      }

      if (action?.startsWith("Configure footer limit")) {
        await configureQuotaWindow(ctx)
        return
      }

      if (!action) return

      if (!isOpenAICodexProvider(ctx.model?.provider)) {
        ctx.ui.notify(
          "ChatGPT limits are only available for openai-codex models.",
          "info",
        )
        return
      }

      const snapshot = await queueUpdate(ctx)
      if (!snapshot) {
        ctx.ui.notify("Could not load ChatGPT usage limits.", "warning")
        return
      }

      await ctx.ui.select(
        "ChatGPT Codex usage limits",
        buildUsageDetails(snapshot, ctx.model?.provider),
      )
    },
  })
}
