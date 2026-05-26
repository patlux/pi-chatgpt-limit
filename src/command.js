import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui"

import {
  DEFAULT_FOOTER_CONFIG,
  DISPLAY_MODE_OPTIONS,
  QUOTA_WINDOW_OPTIONS,
} from "./constants.js"
import {
  describeFooterConfig,
  normalizeFooterConfig,
  saveFooterConfig,
} from "./config.js"
import { isOpenAICodexProvider } from "./auth.js"
import { buildUsageDetails } from "./usage.js"

async function selectFooterConfigOption(
  ctx,
  state,
  title,
  options,
  currentValue,
  preview,
) {
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => option.value === currentValue),
  )
  const originalConfig = { ...state.footerConfig }

  const selected = await ctx.ui.custom((tui, theme, _keybindings, done) => {
    let selectedIndex = initialIndex

    function applyPreview() {
      preview(options[selectedIndex].value)
      state.requestRender()
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
    state.footerConfig = originalConfig
    state.requestRender()
  }

  return selected
}

async function configureQuotaWindow(ctx, state) {
  const selected = await selectFooterConfigOption(
    ctx,
    state,
    "Display which ChatGPT limit in footer?",
    QUOTA_WINDOW_OPTIONS,
    state.footerConfig.quotaWindow,
    (quotaWindow) => {
      state.footerConfig = normalizeFooterConfig({
        ...state.footerConfig,
        quotaWindow,
      })
    },
  )
  if (!selected) return

  await saveFooterConfig(state, {
    ...state.footerConfig,
    quotaWindow: selected.value,
  })
  ctx.ui.notify(
    selected.value === "hidden"
      ? "ChatGPT footer display: Hide usage from footer (usage hidden)."
      : `ChatGPT footer display: ${selected.label}`,
    "info",
  )
}

async function configureDisplayMode(ctx, state) {
  const selected = await selectFooterConfigOption(
    ctx,
    state,
    "How should the footer value be shown?",
    DISPLAY_MODE_OPTIONS,
    state.footerConfig.displayMode,
    (displayMode) => {
      state.footerConfig = normalizeFooterConfig({
        ...state.footerConfig,
        displayMode,
      })
    },
  )
  if (!selected) return

  await saveFooterConfig(state, {
    ...state.footerConfig,
    displayMode: selected.value,
  })
  ctx.ui.notify(`ChatGPT footer mode: ${selected.label}`, "info")
}

async function resetFooterConfig(ctx, state) {
  const confirmed = await ctx.ui.confirm(
    "Reset ChatGPT footer settings?",
    "This restores the default footer display: weekly usage, used percent.",
  )
  if (!confirmed) return

  await saveFooterConfig(state, DEFAULT_FOOTER_CONFIG)
  ctx.ui.notify("ChatGPT footer settings reset to defaults.", "info")
}

export function registerChatGptLimitCommand(pi, state, queueUpdate) {
  pi.registerCommand("chatgpt-limit", {
    description: "Show ChatGPT Codex 5-hour and weekly usage limits",
    handler: async (_args, ctx) => {
      const action = await ctx.ui.select("ChatGPT Codex usage limits", [
        "Show current usage details",
        `Configure footer limit (${describeFooterConfig(state.footerConfig)})`,
        "Configure footer display mode",
        "Reset footer settings to defaults",
      ])

      if (action === "Configure footer display mode") {
        await configureDisplayMode(ctx, state)
        return
      }

      if (action === "Reset footer settings to defaults") {
        await resetFooterConfig(ctx, state)
        return
      }

      if (action?.startsWith("Configure footer limit")) {
        await configureQuotaWindow(ctx, state)
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
        buildUsageDetails(
          snapshot,
          ctx.model?.provider,
          describeFooterConfig(state.footerConfig),
        ),
      )
    },
  })
}
