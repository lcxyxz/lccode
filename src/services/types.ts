import type { ChatMessage, ChatResult } from '../types/shared.js'

export type { ChatMessage }

export interface LLMProvider {
  readonly name: string
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<ChatResult>
}

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}
