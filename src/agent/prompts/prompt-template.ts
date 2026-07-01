/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表、对话历史和用户问题
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { ToolRegistry } from '../tools/tool-registry.js'
import type { ChatMessage } from '../../services/llm.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface PromptContext {
  history: ChatMessage[]
}

/**
 * 加载参考手册（可选，注入到提示词中帮助 LLM 理解格式）
 */
export function loadReferenceManual(): string {
  try {
    const manualPath = join(__dirname, './system.md')
    return readFileSync(manualPath, 'utf-8').trim()
  } catch {
    return ''
  }
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
 * 检查对话历史中是否需要注入 execute_command 限制
 */
function needsCommandRestrictions(history: ChatMessage[]): boolean {
  const recentMessages = history.slice(-6)
  const commandKeywords = ['查看', '执行', '运行', '检查', '搜索', '查找', '列出', '显示']
  return recentMessages.some(msg =>
    msg.role === 'user' && commandKeywords.some(kw => msg.content.includes(kw))
  )
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
  ctx: PromptContext,
): string {
  const toolDescriptions = registry.formatToolDescriptions()
  const history = formatHistory(ctx.history)
  const referenceManual = loadReferenceManual() // 后期有用再加上
  const needsCommandLimit = needsCommandRestrictions(ctx.history)

  const commandLimit = needsCommandLimit ? `
## execute_command 限制
每次只执行一条命令，禁止 && || ; | 连接多条命令` : ''

  return `你是智能助手，可调用工具完成任务。

## 可用工具

${toolDescriptions}${commandLimit}

## 输出格式（必须严格遵守）

每次回应必须包含两部分：

Thought: <你的思考>
Action: <行动>

**Action 只能是以下两种之一：**

1. 调用工具：ToolCall[工具名](参数="值")
2. 结束任务：Finish[最终答案]

## 示例

Thought: 用户想查看文件，执行 ls 命令
Action: ToolCall[execute_command](command="ls -la")

Thought: 已获取结果，直接回答
Action: Finish[当前目录包含：src/, package.json]

Thought: 文件创建成功，告诉用户
Action: Finish[文件已创建成功！]

## 规则

1. 每次回应必须有 Thought: 和 Action:
2. 每次只能调用一个工具
3. 工具执行成功后，如果能回答用户就用 Finish[...] 结束
4. 不要重复执行相同命令
5. 使用中文回答
## 对话历史

${history}

根据对话历史中的最新消息，判断当前状态并决定下一步行动。`
}
