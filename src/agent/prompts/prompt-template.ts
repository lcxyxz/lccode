/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表、对话历史和用户问题
 */

import type { ToolRegistry } from '../tools/tool-registry.js'
import type { ChatMessage } from '../../services/types.js'
import { getSystemPrompt, render } from './loader.js'


export interface PromptContext {
  history: ChatMessage[]
  summary?: string
}


/**
 * 格式化对话历史
 */
function formatHistory(history: ChatMessage[]): string {
  if (history.length === 0) return '(无历史对话)'

  return history
    .map(msg => {
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`
      if (msg.role === 'user' && msg.content.startsWith('[ToolExeInfo] ')) {
        return `ToolExeInfo: ${msg.content.slice(14)}`
      }
      if (msg.role === 'user') return `User: ${msg.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}


/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
  ctx: PromptContext,
): string {
  return render(getSystemPrompt(), {
    toolDescriptions: registry.formatToolDescriptions(),
    history: formatHistory(ctx.history),
    summarySection: ctx.summary ? `## 历史摘要\n\n${ctx.summary}` : '',
  })
}
