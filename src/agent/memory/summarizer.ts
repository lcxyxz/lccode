/**
 * 对话摘要生成器
 * 当对话轮次超过阈值时，调用 LLM 生成摘要并注入到提示词中
 */

import type { ChatMessage } from '../../services/types.js'
import type { LLMProvider } from '../../services/types.js'

const SUMMARIZE_SYSTEM_PROMPT = `你是一个对话摘要助手。请将以下对话历史压缩成简洁的摘要，保留关键信息：
1. 用户的主要需求和目标
2. 已经完成的操作和结果
3. 当前正在进行的任务
4. 重要的上下文信息（文件路径、变量名、错误信息等）

要求：
- 使用中文
- 保持简洁，控制在 500 字以内
- 保留关键技术细节
- 不要包含无关的寒暄或重复内容`

export class Summarizer {
  private provider: LLMProvider
  private summaryCache: string = ''
  private lastSummarizedIndex: number = 0

  constructor(provider: LLMProvider) {
    this.provider = provider
  }

  getSummary(): string {
    return this.summaryCache
  }

  getLastSummarizedIndex(): number {
    return this.lastSummarizedIndex
  }

  async summarize(messages: ChatMessage[]): Promise<string> {
    if (messages.length === 0) {
      return ''
    }

    // 过滤掉系统消息，只处理用户和助手的对话
    const conversationMessages = messages.filter(
      msg => msg.role === 'user' || msg.role === 'assistant'
    )

    if (conversationMessages.length === 0) {
      return ''
    }

    // 格式化对话内容
    const formattedHistory = conversationMessages
      .map(msg => {
        if (msg.role === 'assistant') {
          return `助手: ${msg.content}`
        }
        if (msg.content.startsWith('[ToolExeInfo] ')) {
          return `工具结果: ${msg.content.slice(14)}`
        }
        return `用户: ${msg.content}`
      })
      .join('\n')

    const messagesForSummary: ChatMessage[] = [
      { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
      { role: 'user', content: `请摘要以下对话：\n\n${formattedHistory}` },
    ]

    try {
      const result = await this.provider.chat(messagesForSummary)
      this.summaryCache = result.response
      this.lastSummarizedIndex = messages.length
      return result.response
    } catch (error) {
      console.error('Summarize failed:', error)
      // 摘要失败时返回空字符串，不影响正常对话
      return ''
    }
  }
}
