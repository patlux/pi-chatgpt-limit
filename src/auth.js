import { OPENAI_AUTH_CLAIM, OPENAI_PROFILE_CLAIM } from "./constants.js"

/** @param {string | undefined} provider */
export function isOpenAICodexProvider(provider) {
  return (
    provider === "openai-codex" || /^openai-codex-\d+$/.test(provider || "")
  )
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
export function getTokenMetadata(token) {
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
