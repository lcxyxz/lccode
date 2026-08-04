import type { ProviderType, DiffLine } from './shared.js'

export type { ProviderType }

export interface AgentEvent {
  type: 'thinking' | 'command' | 'response' | 'error' | 'token_usage' | 'diff_preview'
  content: string
  metadata?: {
    /** 轮次编号（1 开始），用于前端按轮分组展示 */
    round?: number
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
  /** 单次输入最多执行几轮工具调用 */
  maxRounds?: number
  /** 解析失败最多重试几次 */
  maxParseRetries?: number
}
