/** 输出区块类型 */
export type SectionType = 'message' | 'command' | 'thinking' | 'response' | 'diff_preview'

/** 差异行类型 */
export type DiffLineType = 'added' | 'removed' | 'unchanged'

/** 差异行 */
export interface DiffLine {
  type: DiffLineType
  lineNumber: number
  content: string
}

/** 输出区块 */
export interface OutputSection {
  id: number
  type: SectionType
  title: string
  content: string
  collapsed: boolean
  color?: 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'gray' | 'red'
  diffPreview?: {
    filePath: string
    language: string
    lines: DiffLine[]
  }
}

/** 命令处理后的动作指令 */
export type CommandAction =
  | { type: 'CONTINUE' }
  | { type: 'EXIT'; message: string }
  | { type: 'LLM_QUERY'; query: string }
  | { type: 'MCP_ACTION'; args: string[] }
  | { type: 'CANCEL' }

/** LLM 请求状态 */
export type LLMStatus = 'idle' | 'loading' | 'done' | 'error'

/** Token 用量 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** LLM 响应结果 */
export interface ChatResult {
  response: string
  thinking?: string
  executedCommand?: string
  commandOutput?: string
  usage?: TokenUsage
}

/** AI 服务提供商类型 */
export type ProviderType = 'deepseek' | 'mimo'

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning_content?: string
}
