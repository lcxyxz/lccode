/** 输出区块类型 */
export type SectionType = 'message' | 'command' | 'thinking' | 'response'

/** 输出区块 */
export interface OutputSection {
  id: number
  type: SectionType
  title: string
  content: string
  collapsed: boolean
  color?: 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'gray' | 'red'
}

/** 命令处理后的动作指令 */
export type CommandAction =
  | { type: 'CONTINUE' }
  | { type: 'EXIT'; message: string }
  | { type: 'LLM_QUERY'; query: string }

/** LLM 请求状态 */
export type LLMStatus = 'idle' | 'loading' | 'done' | 'error'

/** LLM 响应结果 */
export interface ChatResult {
  response: string
  thinking?: string
  executedCommand?: string
  commandOutput?: string
}
