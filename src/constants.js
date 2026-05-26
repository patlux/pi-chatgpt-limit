export const CHATGPT_BASE_URL = (
  process.env.CHATGPT_BASE_URL || "https://chatgpt.com/backend-api"
).replace(/\/+$/, "")

export const OPENAI_AUTH_CLAIM = "https://api.openai.com/auth"
export const OPENAI_PROFILE_CLAIM = "https://api.openai.com/profile"
export const FIVE_HOUR_SECONDS = 5 * 60 * 60
export const WEEK_SECONDS = 7 * 24 * 60 * 60
export const CONFIG_ENTRY_TYPE = "chatgpt-limit-config"
export const CONFIG_FILE_NAME = "chatgpt-limit.json"

export const DEFAULT_FOOTER_CONFIG = {
  quotaWindow: "weekly",
  displayMode: "used",
}

export const QUOTA_WINDOW_OPTIONS = [
  { label: "Weekly usage (default)", value: "weekly" },
  { label: "5-hour usage", value: "fiveHour" },
  { label: "Both 5-hour and weekly", value: "both" },
  { label: "Hide usage from footer", value: "hidden" },
]

export const DISPLAY_MODE_OPTIONS = [
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
