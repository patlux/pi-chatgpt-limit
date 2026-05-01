/**
 * Show ChatGPT Pro/Codex weekly usage percentage inline in pi's footer.
 *
 * Uses ChatGPT's usage endpoint:
 *   GET https://chatgpt.com/backend-api/wham/usage
 */

import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

const CHATGPT_BASE_URL = (process.env.CHATGPT_BASE_URL || "https://chatgpt.com/backend-api").replace(/\/+$/, "");
const OPENAI_AUTH_CLAIM = "https://api.openai.com/auth";
const OPENAI_PROFILE_CLAIM = "https://api.openai.com/profile";
const FIVE_HOUR_SECONDS = 5 * 60 * 60;
const WEEK_SECONDS = 7 * 24 * 60 * 60;

let usageSnapshot;
let refreshTimer;
let requestRender = () => {};

/** @param {string | undefined} provider */
function isOpenAICodexProvider(provider) {
  return provider === "openai-codex" || /^openai-codex-\d+$/.test(provider || "");
}

/** @param {number} count */
function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

/** @param {string} token */
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return {};

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/** @param {string} token */
function getTokenMetadata(token) {
  const payload = decodeJwtPayload(token);
  const auth = payload && typeof payload === "object" ? payload[OPENAI_AUTH_CLAIM] : undefined;
  const profile = payload && typeof payload === "object" ? payload[OPENAI_PROFILE_CLAIM] : undefined;

  return {
    accountId: auth && typeof auth.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined,
    planType: auth && typeof auth.chatgpt_plan_type === "string" ? auth.chatgpt_plan_type : undefined,
    email: profile && typeof profile.email === "string" ? profile.email : undefined,
  };
}

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

/** @param {unknown} value */
function normalizeWindow(value) {
  const record = asRecord(value);
  if (!record) return undefined;

  const usedPercent = typeof record.used_percent === "number" ? record.used_percent : undefined;
  const windowSeconds = typeof record.limit_window_seconds === "number" ? record.limit_window_seconds : undefined;
  const resetAt = typeof record.reset_at === "number" ? record.reset_at : undefined;

  if (usedPercent === undefined || windowSeconds === undefined) return undefined;
  return { usedPercent, windowSeconds, resetAt };
}

/** @param {unknown} data */
function parseUsageSnapshot(data) {
  const raw = asRecord(data);
  const rateLimit = asRecord(raw?.rate_limit);
  const windows = [
    normalizeWindow(rateLimit?.primary_window),
    normalizeWindow(rateLimit?.secondary_window),
  ].filter(Boolean);

  return {
    planType: typeof raw?.plan_type === "string" ? raw.plan_type : undefined,
    email: typeof raw?.email === "string" ? raw.email : undefined,
    fiveHour: windows.find((window) => Math.abs(window.windowSeconds - FIVE_HOUR_SECONDS) <= 120),
    weekly: windows.find((window) => Math.abs(window.windowSeconds - WEEK_SECONDS) <= 120),
    fetchedAt: Date.now(),
  };
}

/** @param {{ usedPercent: number } | undefined} window */
function formatUsedPercent(window) {
  if (!window) return "?%";
  return `${Math.round(Math.max(0, Math.min(100, window.usedPercent)))}%`;
}

/** @param {{ usedPercent: number } | undefined} window */
function formatRemainingPercent(window) {
  if (!window) return "?%";
  return `${Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)))}%`;
}

/** @param {number | undefined} resetAt */
function formatResetShort(resetAt) {
  if (!resetAt) return "?";

  const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000));
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);

  if (days > 0) return `~${days}d`;
  if (hours > 0) return `~${hours}h`;
  return `~${minutes}m`;
}

/** @param {number | undefined} resetAt */
function formatResetLong(resetAt) {
  if (!resetAt) return "unknown";

  const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000));
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

/** @param {import('@mariozechner/pi-ai').AssistantMessage['usage']} usage */
function addUsage(total, usage) {
  total.input += usage?.input ?? 0;
  total.output += usage?.output ?? 0;
  total.cacheRead += usage?.cacheRead ?? 0;
  total.cacheWrite += usage?.cacheWrite ?? 0;
  total.cost += usage?.cost?.total ?? 0;
}

export default function () {}
