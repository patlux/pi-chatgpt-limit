import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import {
  CONFIG_ENTRY_TYPE,
  CONFIG_FILE_NAME,
  DEFAULT_FOOTER_CONFIG,
  DISPLAY_MODE_OPTIONS,
  QUOTA_WINDOW_OPTIONS,
} from "./constants.js"
import { asRecord } from "./records.js"

export function normalizeFooterConfig(value) {
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

export async function restoreFooterConfig(ctx, state) {
  state.footerConfig =
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

export function describeFooterConfig(footerConfig) {
  const quotaWindow = QUOTA_WINDOW_OPTIONS.find(
    (option) => option.value === footerConfig.quotaWindow,
  )
  const displayMode = DISPLAY_MODE_OPTIONS.find(
    (option) => option.value === footerConfig.displayMode,
  )
  return `${quotaWindow?.label || "Weekly usage"}; ${displayMode?.label || "Used percent"}`
}

export async function saveFooterConfig(state, nextConfig) {
  state.footerConfig = normalizeFooterConfig(nextConfig)
  state.requestRender()
  await writeGlobalFooterConfig(state.footerConfig)
}
