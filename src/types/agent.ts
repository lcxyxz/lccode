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
  /** 发送给 LLM 的历史消息最大估算 token 数（当前轮次消息始终完整保留），默认 12000 */
  maxHistoryTokens?: number
  /** 当前轮次消息（本次用户输入及工具反馈）最大估算 token 数，默认 12000 */
  maxRoundTokens?: number
  /** 当前轮次中超预算的旧工具结果压缩到的最大字符数，默认 1200 */
  compactToolChars?: number
  /** 单条工具执行结果反馈给 LLM 的最大字符数，超出部分截断，默认 20000 */
  maxToolOutputChars?: number
}
