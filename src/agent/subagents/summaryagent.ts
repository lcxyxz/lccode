/**
 * Summary Agent - 历史上下文摘要压缩
 * 将超预算的旧历史压缩为摘要
 */

import { createProvider, type LLMProvider } from '../../services/index.js'
import type { ChatMessage } from '../../services/types.js'
import type { AgentConfig } from '../../types/index.js'
import type { Agent } from '../agent.js'

export interface SummaryResult {
  success: boolean
  summary: string
  error?: string
}

export interface SummaryOptions {
  signal?: AbortSignal
  /** 摘要输出字数上限 */
  maxWords?: number
}

export class SummaryAgent {
  private provider: LLMProvider

  constructor(config: AgentConfig) {
    this.provider = createProvider(config)
  }

  /** 将消息序列化为摘要输入文本 */
  private formatTranscript(messages: ChatMessage[]): string {
    return messages.map(m => `[${m.role}]\n${m.content}`).join('\n\n')
  }

  /** 对消息列表生成摘要 */
  async summarize(conversation: ChatMessage[], options?: SummaryOptions): Promise<SummaryResult> {
    return this.call(this.formatTranscript(conversation), options)
  }

  private async call(input: string, options?: SummaryOptions): Promise<SummaryResult> {
    const wordLimit = options?.maxWords ?? 600
    const systemPrompt = `You are a conversation summarizer. Summarize the conversation below, preserving only what the assistant needs to continue helping the user:
- User requirements, decisions, preferences and constraints, including the language of the conversation
- File paths, commands and facts established by tool results
- Unfinished tasks or promises made to the user
Write the summary in the same language as the user's messages. Output ONLY plain text, no markdown, no JSON, at most ${wordLimit} words.`

    try {
      const result = await this.provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        { signal: options?.signal }
      )
      const summary = result.response.trim()
      if (!summary) {
        return { success: false, summary: '', error: 'Empty summary response' }
      }
      return { success: true, summary }
    } catch (error: any) {
      // 取消操作向上抛，由调用方统一处理；其余失败转为结构化结果
      if (error?.name === 'AbortError' || error?.message?.toLowerCase().includes('abort')) {
        throw error
      }
      return { success: false, summary: '', error: String(error) }
    }
  }
}

/**
 * summarize_history 工具：与 plan_task 对称。
 * 由大模型主动调用，基于 Agent 的完整旧历史生成摘要，
 * 压缩成功后摘要状态记录到 Agent，供后续轮次复用。
 */
export function createSummaryAgentTool(config: AgentConfig, agent: Agent) {
  return {
    name: 'summarize_history',
    description: 'Summarize the earlier conversation history into a compact summary, preserving key requirements, decisions, file paths and unfinished tasks',
    parameters: [],
    execute: async () => {
      const summaryAgent = new SummaryAgent(config)
      const result = await summaryAgent.summarize(agent.getOldHistory())
      if (result.success) {
        agent.setSummary(result.summary)
        return { success: true, output: result.summary }
      }
      return { success: false, output: '', error: result.error || 'Summary failed' }
    },
  }
}
