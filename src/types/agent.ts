import type { ProviderType, DiffLine } from './shared.js'

export type { ProviderType }

export interface AgentEvent {
  type: 'thinking' | 'command' | 'response' | 'error' | 'token_usage' | 'diff_preview'
  content: string
  metadata?: {
    command?: string
    commandOutput?: string
    success?: boolean
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  diffPreview?: {
    filePath: string
    language: string
    lines: DiffLine[]
  }
}

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  provider?: ProviderType
}
