import type { ChatResult } from '../types/shared.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning_content?: string
}

export interface LLMProvider {
  readonly name: string
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<ChatResult>
}

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}
