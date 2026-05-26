declare module "@earendil-works/pi-tui" {
  export const Key: {
    up: unknown
    down: unknown
    enter: unknown
    escape: unknown
    ctrl(key: string): unknown
  }

  export function matchesKey(data: unknown, key: unknown): boolean
  export function truncateToWidth(
    text: string,
    width: number,
    ellipsis: string,
  ): string
  export function visibleWidth(text: string): number
}

declare module "@earendil-works/pi-ai" {
  export interface AssistantMessage {
    usage?: {
      input?: number
      output?: number
      cacheRead?: number
      cacheWrite?: number
      cost?: {
        total?: number
      }
    }
  }
}

declare module "@earendil-works/pi-coding-agent" {
  import type { AssistantMessage } from "@earendil-works/pi-ai"

  export interface Theme {
    fg(color: string, text: string): string
    bold(text: string): string
  }

  export interface FooterData {
    getGitBranch(): string | undefined
    getAvailableProviderCount(): number
    onBranchChange(callback: () => void): (() => void) | undefined
  }

  export interface Model {
    id?: string
    provider?: string
    contextWindow?: number
    reasoning?: unknown
  }

  export interface ExtensionContext {
    model?: Model
    getContextUsage():
      | {
          contextWindow?: number
          percent?: number | null
        }
      | undefined
    modelRegistry: {
      isUsingOAuth(model: Model): boolean
      getApiKeyAndHeaders(model: Model): Promise<{
        ok: boolean
        apiKey?: string
      }>
    }
    sessionManager: {
      getBranch(): Array<{
        type?: string
        customType?: string
        data?: unknown
      }>
      getEntries(): Array<{
        type?: string
        message?: {
          role?: string
          usage?: AssistantMessage["usage"]
        }
      }>
      getCwd(): string
      getSessionName(): string | undefined
    }
    ui: {
      setFooter(
        factory: (
          tui: { requestRender(): void },
          theme: Theme,
          footerData: FooterData,
        ) => {
          dispose(): void
          invalidate(): void
          render(width: number): string[]
        },
      ): void
      custom(
        factory: (
          tui: { requestRender(): void },
          theme: Theme,
          keybindings: unknown,
          done: (value: unknown) => void,
        ) => {
          invalidate(): void
          handleInput(data: unknown): void
          render(width: number): string[]
        },
      ): Promise<unknown>
      select(title: string, options: string[]): Promise<string | undefined>
      confirm(title: string, message: string): Promise<boolean>
      notify(message: string, type: string): void
    }
  }
}
