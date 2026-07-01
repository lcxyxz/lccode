/**
 * Agent 主逻辑
 * 实现 ReAct（Reasoning + Acting）模式
 */

import { writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import { DeepSeekProvider, type ChatMessage } from '../services/llm.js'
import { ToolRegistry } from './tools/tool-registry.js'
import { executeCommandTool } from './tools/command-tool.js'
import { readFileTool, writeFileTool, editFileTool, deleteFileTool, deleteDirectoryTool } from './tools/file-tools.js'
import { buildSystemPrompt } from './prompts/prompt-template.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'

const DEBUG_LOG = '/tmp/agent-debug.log'

function debugLog(...lines: string[]) {
  appendFileSync(DEBUG_LOG, lines.join('\n') + '\n')
}

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.html': 'html', '.htm': 'html', '.xml': 'xml',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown', '.sql': 'sql', '.sh': 'bash', '.bash': 'bash',
  '.vue': 'html', '.svelte': 'html',
}

function detectLanguage(filePath: string): string {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase()
  return EXTENSION_LANGUAGE[ext] || 'text'
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
 * 解析工具调用参数字符串
 * 支持 key="value" 格式，value 中可包含转义序列
 */
function parseToolParams(paramsStr: string): Record<string, string> {
  const params: Record<string, string> = {}
  let i = 0

  while (i < paramsStr.length) {
    // 跳过空白和逗号
    while (i < paramsStr.length && (paramsStr[i] === ' ' || paramsStr[i] === ',' || paramsStr[i] === '\n' || paramsStr[i] === '\r')) {
      i++
    }

    if (i >= paramsStr.length) break

    // 解析 key
    const keyMatch = paramsStr.slice(i).match(/^(\w+)=/)
    if (!keyMatch) break

    const key = keyMatch[1]
    i += keyMatch[0].length

    // 检查是否是字符串值（以双引号开始）
    if (paramsStr[i] !== '"') break

    i++ // 跳过开始的双引号
    let value = ''
    let escaped = false

    // 逐个字符解析值，处理转义序列
    while (i < paramsStr.length) {
      const char = paramsStr[i]

      if (escaped) {
        // 处理转义序列
        switch (char) {
          case '"': value += '"'; break
          case '\\': value += '\\'; break
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case 'r': value += '\r'; break
          default: value += `\\${char}`; break
        }
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        // 值结束
        i++ // 跳过结束的双引号
        break
      } else {
        value += char
      }

      i++
    }

    params[key] = value
  }

  return params
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

  // 解析 ToolCall[tool_name](params) - 匹配跨行内容
  const toolCallMatch = action.match(/ToolCall\[(\w+)\]\(([\s\S]*)\)/)
  if (toolCallMatch) {
    const toolName = toolCallMatch[1]
    const paramsStr = toolCallMatch[2]

    // 使用健壮的参数解析器
    const params = parseToolParams(paramsStr)

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
  private currentQueryStartIndex = 0

  constructor(config: AgentConfig) {
    this.provider = new DeepSeekProvider(config)
    this.registry = new ToolRegistry()
    this.registry.register(executeCommandTool)
    this.registry.register(readFileTool)
    this.registry.register(writeFileTool)
    this.registry.register(editFileTool)
    this.registry.register(deleteFileTool)
    this.registry.register(deleteDirectoryTool)
  }

  /**
   * 获取工具注册中心（用于扩展）
   */
  getToolRegistry(): ToolRegistry {
    return this.registry
  }

  /**
   * 构建消息列表
   */
  private buildMessages(): ChatMessage[] {
    // 当前查询的消息范围
    const currentMessages = this.chatHistory.slice(this.currentQueryStartIndex)

    // system prompt 中的对话历史包含所有历史记录，让 LLM 有完整上下文
    const systemPrompt = buildSystemPrompt(this.registry, {
      history: this.chatHistory,
    })

    // 打印系统提示词便于调试
    debugLog(`SystemPrompt:`,systemPrompt);
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ]
    // 将当前查询的所有消息（user、assistant、tool result）加入 messages 数组
    // 这样 LLM 能看到完整的对话轮次，而不是只依赖 system prompt 中的历史文本
    for (const msg of currentMessages) {
      messages.push(msg)
    }

    return messages
  }

  /**
   * 将助手消息加入历史
   */
  private pushAssistant(content: string) {
    this.chatHistory.push({ role: 'assistant', content: content })
    if (this.chatHistory.length > this.maxHistory) {
      const trimmed = this.chatHistory.length - this.maxHistory
      this.chatHistory = this.chatHistory.slice(-this.maxHistory)
      this.currentQueryStartIndex = Math.max(0, this.currentQueryStartIndex - trimmed)
    }
  }

  /**
   * 处理用户输入，返回异步事件流
   */
  async *processInput(query: string): AsyncGenerator<AgentEvent> {
    writeFileSync(DEBUG_LOG, '')
    const maxRounds = 15
    const maxParseRetries = 2  // 解析失败最大重试次数
    let round = 0
    let parseRetries = 0  // 解析失败重试计数
    // 记录当前查询在 chatHistory 中的起始位置，隔离不同查询的上下文
    this.currentQueryStartIndex = this.chatHistory.length
    this.chatHistory.push({ role: 'user', content: query })

    while (round < maxRounds) {
      round++
      debugLog(`\n=== Round ${round} ===`)

      // 构建消息并调用 LLM
      const messages = this.buildMessages()
      const llmResult = await this.provider.chat(messages)
      debugLog(`LLM response:`, llmResult.response)

      // 输出思考过程（LLM 的原生 thinking）
      if (llmResult.thinking) {
        yield { type: 'thinking', content: llmResult.thinking }
      }

      // 输出 token 用量
      if (llmResult.usage) {
        yield {
          type: 'token_usage',
          content: '',
          usage: llmResult.usage,
        }
      }

      // 解析响应
      const parsed = parseLLMResponse(llmResult.response)
      debugLog(`Parsed:`, JSON.stringify(parsed, null, 2))

      if (!parsed) {
        parseRetries++

        if (parseRetries <= maxParseRetries) {
          // 解析失败，提示 LLM 使用正确格式并重试
          const retryMsg = `[系统提示] 你的回复格式不正确，无法解析。请必须严格使用以下格式：
Thought: <你的思考>
Action: ToolCall[工具名](参数="值") 或 Finish[你的答案]

即使你只是想直接回答问题，也必须使用：
Thought: 我已完成任务，直接回答用户
Action: Finish[你的答案]

请重新回复，确保包含 "Thought:" 和 "Action:" 前缀。`

          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.chatHistory.push({ role: 'user', content: retryMsg })
          debugLog(`Parse failed, retry ${parseRetries}/${maxParseRetries}`)
          continue
        }

        // 超过重试次数，返回原始响应
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: llmResult.response }
        return
      }

      // 解析成功，重置重试计数
      parseRetries = 0

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
          const errorMsg = `错误：工具 "${parsed.toolName}" 不存在。可用工具：${this.registry.getAll().map(t => t.name).join(', ')}`
          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.chatHistory.push({ role: 'user', content: `[ToolExeInfo] ${errorMsg}` })
          continue
        }

        debugLog(`Executing tool: ${parsed.toolName}`, JSON.stringify(parsed.params))
        const result = await tool.execute(parsed.params || {})
        debugLog(`Tool result:`, JSON.stringify(result))

        // write_file/edit_file 时隐藏 content 内容
        const hideContent = parsed.toolName === 'write_file' || parsed.toolName === 'edit_file'
        const commandStr = `${parsed.toolName}(${Object.entries(parsed.params || {}).map(([k, v]) => {
          const value = (hideContent && k === 'content') ? '...' : v
          return `${k}="${value}"`
        }).join(', ')})`
        yield {
          type: 'command',
          content: `$ ${commandStr}`,
          metadata: {
            command: commandStr,
            commandOutput: result.output,
            success: result.success,
          },
        }

        // write_file / edit_file 成功后，展示代码预览
        if (result.success && (parsed.toolName === 'write_file' || parsed.toolName === 'edit_file')) {
          const filePath = parsed.params?.file_path
          if (filePath) {
            try {
              const fileContent = readFileSync(filePath, 'utf-8')
              yield {
                type: 'code_preview',
                content: '',
                codePreview: {
                  filePath,
                  language: detectLanguage(filePath),
                  content: fileContent,
                },
              }
            } catch {}
          }
        }

        const resultMsg = result.success
          ? `工具执行成功，输出如下：\n\`\`\`\n${result.output}\n\`\`\``
          : `工具执行失败：${result.error || result.output}`

        this.chatHistory.push({ role: 'assistant', content: llmResult.response })
        this.chatHistory.push({ role: 'user', content: `[ToolExeInfo] ${resultMsg}` })
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
