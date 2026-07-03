import type { ProviderType } from './shared.js'

export type { ProviderType }

export interface AgentEvent {
  type: 'thinking' | 'command' | 'response' | 'error' | 'token_usage' | 'code_preview'
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
  codePreview?: {
    filePath: string
    language: string
    content: string
  }
}

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  provider?: ProviderType
}
