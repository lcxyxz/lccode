/**
 * Agent 主逻辑
 * 实现 ReAct（Reasoning + Acting）模式
 */

import { writeFileSync, appendFileSync } from 'node:fs'
import { DeepSeekProvider, type ChatMessage } from '../services/llm.js'
import { ToolRegistry, executeCommandTool } from './tool-registry.js'
import { buildSystemPrompt } from './prompt-template.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'

const DEBUG_LOG = '/tmp/agent-debug.log'

function debugLog(...lines: string[]) {
  appendFileSync(DEBUG_LOG, lines.join('\n') + '\n')
}

// ===================== 响应解析 =====================

interface ParsedAction {
  thought: string
  type: 'tool_call' | 'finish'
  toolName?: string
  params?: Record<string, string>
  answer?: string
}

/**
 * 解析 LLM 响应，提取 Thought 和 Action
 */
function parseLLMResponse(response: string): ParsedAction | null {
  // 提取 Thought
  const thoughtMatch = response.match(/Thought:\s*(.*?)(?=\nAction:)/s)
  const thought = thoughtMatch?.[1]?.trim() || ''

  // 提取 Action
  const actionMatch = response.match(/Action:\s*(.*)/s)
  if (!actionMatch) return null

  const action = actionMatch[1].trim()

  // 解析 ToolCall[tool_name](params)
  const toolCallMatch = action.match(/ToolCall\[(\w+)\]\((.*)\)/)
  if (toolCallMatch) {
    const toolName = toolCallMatch[1]
    const paramsStr = toolCallMatch[2]

    // 解析参数: key="value"
    const params: Record<string, string> = {}
    const paramRegex = /(\w+)="([^"]*)"/g
    let match
    while ((match = paramRegex.exec(paramsStr)) !== null) {
      params[match[1]] = match[2]
    }

    return { thought, type: 'tool_call', toolName, params }
  }

  // 解析 Finish[answer]
  const finishMatch = action.match(/Finish\[(.*)\]/s)
  if (finishMatch) {
    return { thought, type: 'finish', answer: finishMatch[1].trim() }
  }

  return null
}

// ===================== Agent 类 =====================

export class Agent {
  private provider: DeepSeekProvider
  private registry: ToolRegistry
  private chatHistory: ChatMessage[] = []
  private maxHistory = 20

  constructor(config: AgentConfig) {
    this.provider = new DeepSeekProvider(config)
    this.registry = new ToolRegistry()
    this.registry.register(executeCommandTool)
  }

  /**
   * 获取工具注册中心（用于扩展）
   */
  getToolRegistry(): ToolRegistry {
    return this.registry
  }

  /**
   * 构建消息列表
   * @param isFirstRound 是否是第一轮（需要传入原始问题）
   */
  private buildMessages(isFirstRound: boolean): ChatMessage[] {
    const systemPrompt = buildSystemPrompt(this.registry, {
      history: this.chatHistory,
    })
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ]
    // 只在第一轮添加用户问题，后续轮次依赖 chatHistory
    if (isFirstRound && this.chatHistory.length > 0) {
      messages.push(this.chatHistory[0])
    }
    return messages
  }

  /**
   * 将助手消息加入历史
   */
  private pushAssistant(content: string) {
    this.chatHistory.push({ role: 'assistant', content: content })
    if (this.chatHistory.length > this.maxHistory) {
      this.chatHistory = this.chatHistory.slice(-this.maxHistory)
    }
  }

  /**
   * 处理用户输入，返回异步事件流
   */
  async *processInput(query: string): AsyncGenerator<AgentEvent> {
    writeFileSync(DEBUG_LOG, '')
    const maxRounds = 15
    let round = 0
    let isFirstRound = true

    this.chatHistory.push({ role: 'user', content: query })

    while (round < maxRounds) {
      round++
      debugLog(`\n=== Round ${round} ===`)

      // 构建消息并调用 LLM
      const messages = this.buildMessages(isFirstRound)
      const llmResult = await this.provider.chat(messages)
      isFirstRound = false
      debugLog(`LLM response:`, llmResult.response)

      // 输出思考过程（LLM 的原生 thinking）
      if (llmResult.thinking) {
        yield { type: 'thinking', content: llmResult.thinking }
      }

      // 解析响应
      const parsed = parseLLMResponse(llmResult.response)
      debugLog(`Parsed:`, JSON.stringify(parsed, null, 2))

      if (!parsed) {
        // 解析失败，返回原始响应
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: llmResult.response }
        return
      }

      // 输出 Thought
      if (parsed.thought) {
        yield { type: 'thinking', content: parsed.thought }
      }

      // 处理 Finish
      if (parsed.type === 'finish') {
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: parsed.answer || '' }
        return
      }

      // 处理工具调用
      if (parsed.type === 'tool_call' && parsed.toolName) {
        const tool = this.registry.get(parsed.toolName)

        if (!tool) {
          // 工具不存在，告知 LLM
          const errorMsg = `错误：工具 "${parsed.toolName}" 不存在。可用工具：${this.registry.getAll().map(t => t.name).join(', ')}`
          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.chatHistory.push({ role: 'user', content: errorMsg })
          continue
        }

        // 执行工具
        debugLog(`Executing tool: ${parsed.toolName}`, JSON.stringify(parsed.params))
        const result = await tool.execute(parsed.params || {})
        debugLog(`Tool result:`, JSON.stringify(result))

        // 输出工具执行信息
        const commandStr = `${parsed.toolName}(${Object.entries(parsed.params || {}).map(([k, v]) => `${k}="${v}"`).join(', ')})`
        yield {
          type: 'command',
          content: `$ ${commandStr}`,
          metadata: {
            command: commandStr,
            commandOutput: result.output,
            success: result.success,
          },
        }

        // 将执行结果加入对话历史
        const resultMsg = result.success
          ? `工具执行成功，输出如下：\n\`\`\`\n${result.output}\n\`\`\``
          : `工具执行失败：${result.error || result.output}`

        this.chatHistory.push({ role: 'assistant', content: llmResult.response })
        this.chatHistory.push({ role: 'user', content: resultMsg })
      }
    }

    // 达到最大轮次
    yield { type: 'response', content: '任务执行轮次已达上限，请尝试简化问题。' }
  }

  /**
   * 清空对话历史
   */
  clearHistory() {
    this.chatHistory = []
  }
}
