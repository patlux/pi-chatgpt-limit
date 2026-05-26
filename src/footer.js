import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

import { isOpenAICodexProvider } from "./auth.js"
import {
  formatPacePercent,
  formatPacePercentShort,
  formatRemainingPercent,
  formatResetShort,
  formatTokens,
  formatUsedPercent,
} from "./format.js"

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

function formatFooterUsagePart(state, label, window, theme) {
  if (!window) return undefined

  let text
  if (label === "W" && state.footerConfig.displayMode.startsWith("pace")) {
    if (state.footerConfig.displayMode === "pace") {
      text = `WP ${formatPacePercent(window)}`
    } else if (state.footerConfig.displayMode === "paceCompact") {
      text = `WP ${formatPacePercentShort(window)}`
    } else if (state.footerConfig.displayMode === "paceResetCompact") {
      text = `WP ${formatPacePercentShort(window)} · ${formatResetShort(window.resetAt)}`
    }
  } else {
    if (state.footerConfig.displayMode === "remaining") {
      text = `${label} ${formatRemainingPercent(window)} left`
    } else if (state.footerConfig.displayMode === "remainingCompact") {
      text = `${label} ${formatRemainingPercent(window)} left · ${formatResetShort(window.resetAt)}`
    } else {
      const used = formatUsedPercent(window)
      text =
        state.footerConfig.displayMode === "compact"
          ? `${label} ${used} · ${formatResetShort(window.resetAt)}`
          : `${label} ${used}`
    }
  }

  return theme.fg(getUsageColor(window), text)
}

function formatFooterUsage(state, theme) {
  if (state.footerConfig.quotaWindow === "hidden") return undefined

  const parts = []
  if (
    state.footerConfig.quotaWindow === "fiveHour" ||
    state.footerConfig.quotaWindow === "both"
  ) {
    const part = formatFooterUsagePart(
      state,
      "5h",
      state.usageSnapshot?.fiveHour,
      theme,
    )
    if (part) parts.push(part)
  }
  if (
    state.footerConfig.quotaWindow === "weekly" ||
    state.footerConfig.quotaWindow === "both"
  ) {
    const part = formatFooterUsagePart(
      state,
      "W",
      state.usageSnapshot?.weekly,
      theme,
    )
    if (part) parts.push(part)
  }

  return parts.length > 0 ? parts.join(theme.fg("dim", " / ")) : undefined
}

function renderFooter(pi, ctx, state, footerData, theme, width) {
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
    const footerUsage = formatFooterUsage(state, theme)
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
export function installFooter(pi, ctx, state) {
  ctx.ui.setFooter((tui, theme, footerData) => {
    state.requestRender = () => tui.requestRender()
    const unsub = footerData.onBranchChange(() => tui.requestRender())
    return {
      dispose() {
        unsub?.()
      },
      invalidate() {},
      render(width) {
        return renderFooter(pi, ctx, state, footerData, theme, width)
      },
    }
  })
}
