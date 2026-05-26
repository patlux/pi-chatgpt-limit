import { DEFAULT_FOOTER_CONFIG } from "./constants.js"
import { registerChatGptLimitCommand } from "./command.js"
import { restoreFooterConfig } from "./config.js"
import { installFooter } from "./footer.js"
import { updateUsage } from "./usage.js"

function createState() {
  return {
    usageSnapshot: undefined,
    footerConfig: { ...DEFAULT_FOOTER_CONFIG },
    refreshTimer: undefined,
    requestRender: () => {},
  }
}

export default function (pi) {
  const state = createState()

  /** @type {Promise<unknown>} */
  let inFlight = Promise.resolve()

  function queueUpdate(ctx) {
    inFlight = inFlight
      .catch(() => undefined)
      .then(() => updateUsage(ctx, state))
    return inFlight
  }

  function queueUpdateInBackground(ctx) {
    queueUpdate(ctx).catch(() => undefined)
  }

  pi.on("session_start", async (_event, ctx) => {
    await restoreFooterConfig(ctx, state)
    installFooter(pi, ctx, state)
    queueUpdateInBackground(ctx)
  })

  pi.on("model_select", (_event, ctx) => queueUpdateInBackground(ctx))
  pi.on("agent_end", (_event, ctx) => queueUpdateInBackground(ctx))

  pi.on("session_shutdown", async () => {
    if (state.refreshTimer) clearInterval(state.refreshTimer)
    state.refreshTimer = undefined
    state.requestRender = () => {}
  })

  registerChatGptLimitCommand(pi, state, queueUpdate)
}
