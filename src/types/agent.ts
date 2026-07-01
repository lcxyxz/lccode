export interface AgentEvent {
  type: 'thinking' | 'command' | 'response' | 'error' | 'token_usage'
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
}

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}
