export interface AgentEvent {
  type: 'thinking' | 'command' | 'response' | 'error'
  content: string
  metadata?: {
    command?: string
    commandOutput?: string
    success?: boolean
  }
}

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}
