/**
 * Agent 主逻辑
 */
import { createProvider, type LLMProvider } from '../services/index.js'
import type { ChatMessage } from '../services/types.js'
import { ToolRegistry } from './tools/tool-registry.js'
import { executeCommandTool } from './tools/command-tool.js'
import { readFileTool, writeFileTool, editFileTool, deleteFileTool, deleteDirectoryTool, searchTool, addDirTool } from './tools/file-tools.js'
import { buildSystemPrompt } from './prompts/prompt-template.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'
import {
  parseLLMOutput,
  isToolCallOutput,
  isFinalAnswerOutput,
  isNeedClarificationOutput,
  isErrorOutput,
  type ParseFailure
} from '../types/llm-output.js'
import { Logger, type LoggerConfig, LogLevel } from '../utils/logger.js'
import { classifyCommand } from '../services/command-executor.js'
import { McpManager } from './mcp/manager.js'
import { Summarizer } from './memory/summarizer.js'

// ===================== Agent 类 =====================

export class Agent {
  private provider: LLMProvider
  private registry: ToolRegistry
  private mcpManager: McpManager
  private summarizer: Summarizer
  private chatHistory: ChatMessage[] = []
  private summaryThreshold = 10
  private currentQueryStartIndex = 0
  private logger: Logger
  private abortController: AbortController | null = null
  private confirmationResolve: ((confirmed: boolean) => void) | null = null

  private constructor(config: AgentConfig, loggerConfig?: LoggerConfig) {
    this.provider = createProvider(config)
    this.registry = new ToolRegistry()
    this.mcpManager = new McpManager()
    this.summarizer = new Summarizer(this.provider)
    this.logger = new Logger(loggerConfig)

    this.registry.register(executeCommandTool)
    this.registry.register(readFileTool)
    this.registry.register(writeFileTool)
    this.registry.register(editFileTool)
    this.registry.register(deleteFileTool)
    this.registry.register(deleteDirectoryTool)
    this.registry.register(searchTool)
    this.registry.register(addDirTool)

    this.logger.clear()
    this.logger.info('Agent initialized')
  }

  static async create(config: AgentConfig, loggerConfig?: LoggerConfig): Promise<Agent> {
    const agent = new Agent(config, loggerConfig)

    try {
      const mcpTools = await agent.mcpManager.loadFromConfig()
      mcpTools.forEach(tool => agent.registry.register(tool))
      agent.refreshToolFilter()
      agent.logger.info(`MCP tools loaded: ${mcpTools.length}`)
    } catch (error) {
      agent.logger.error('Failed to load MCP config:', error)
    }

    return agent
  }

  getToolRegistry(): ToolRegistry {
    return this.registry
  }

  getMcpManager(): McpManager {
    return this.mcpManager
  }

  /**
   * 等待用户确认（用于危险命令）
   */
  private waitForConfirmation(): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmationResolve = resolve
    })
  }

  /**
   * 回复确认结果（由前端调用）
   */
  respondToConfirmation(confirmed: boolean): void {
    this.confirmationResolve?.(confirmed)
    this.confirmationResolve = null
  }

  /** 刷新工具过滤器，将 McpManager 的启用状态同步到 ToolRegistry */
  refreshToolFilter(): void {
    const activeNames = this.mcpManager.getActiveToolNames()
    this.registry.setActiveFilter(activeNames)
  }

  private buildMessages(): ChatMessage[] {
    const currentMessages = this.chatHistory.slice(this.currentQueryStartIndex)
    const summary = this.summarizer.getSummary()
    const systemPrompt = buildSystemPrompt(this.registry, {
      history: this.chatHistory,
      summary,
    })
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ]
    
    for (const msg of currentMessages) {
      messages.push(msg)
    }

    return messages
  }

  private pushAssistant(content: string) {
    this.chatHistory.push({ role: 'assistant', content: content })
  }

  private async checkAndSummarize(): Promise<void> {
    const userMessageCount = this.chatHistory.filter(msg => msg.role === 'user').length
    if (userMessageCount > this.summaryThreshold) {
      this.logger.debug(`User messages (${userMessageCount}) exceed threshold (${this.summaryThreshold}), generating summary...`)
      
      // 对超过阈值的消息进行摘要
      const lastSummarizedIndex = this.summarizer.getLastSummarizedIndex()
      const messagesToSummarize = this.chatHistory.slice(lastSummarizedIndex)
      
      if (messagesToSummarize.length > 0) {
        await this.summarizer.summarize(messagesToSummarize)
        
        // 清除已摘要的消息，只保留最近的几轮对话
        const keepRecent = 4 // 保留最近2轮对话（user+assistant各2条）
        if (this.chatHistory.length > keepRecent) {
          this.chatHistory = this.chatHistory.slice(-keepRecent)
          this.currentQueryStartIndex = 0
        }
        
        this.logger.debug('Summary generated, history trimmed')
      }
    }
  }

  /**
   * 构建解析失败的重试消息
   */
  private buildRetryMessage(failure: ParseFailure): string {
    return `[系统提示] JSON 解析失败

错误信息：${failure.error}

修复提示：
${failure.hint}

请严格按照上述提示重新输出 JSON。`
  }

  async *processInput(query: string): AsyncGenerator<AgentEvent> {
    const maxRounds = 20
    const maxParseRetries = 2
    let round = 0
    let parseRetries = 0
    
    this.currentQueryStartIndex = this.chatHistory.length
    this.chatHistory.push({ role: 'user', content: query })

    this.abortController = new AbortController()

    while (round < maxRounds) {
      round++
      
      this.logger.debug(`\n=== Round ${round} ===`)

      const messages = this.buildMessages()
      this.logger.debug('SystemPrompt:', messages[0].content)

      let llmResult
      try {
        llmResult = await this.provider.chat(messages, { signal: this.abortController.signal })
      } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message?.toLowerCase().includes('abort')) {
          yield { type: 'error', content: '对话已取消' }
          return
        }
        throw error
      }
      this.logger.debug('LLM response:', llmResult.response)

      if (llmResult.thinking) {
        yield { type: 'thinking', content: llmResult.thinking }
      }

      if (llmResult.usage) {
        yield {
          type: 'token_usage',
          content: '',
          usage: llmResult.usage,
        }
      }

      // 解析响应
      const result = parseLLMOutput(llmResult.response)
      this.logger.debug('Parse result:', JSON.stringify(result, null, 2))

      // 解析失败处理
      if (!result.success) {
        parseRetries++
        this.logger.debug(`Parse failed (${result.error}), retry ${parseRetries}/${maxParseRetries}`)

        if (parseRetries <= maxParseRetries) {
          const retryMsg = this.buildRetryMessage(result)
          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.chatHistory.push({ role: 'user', content: retryMsg })
          continue
        }

        // 超过重试次数，返回原始响应
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: llmResult.response }
        return
      }

      // 解析成功，重置计数
      parseRetries = 0
      const output = result.output

      yield { type: 'thinking', content: output.thought }

      // 处理最终答案
      if (isFinalAnswerOutput(output)) {
        this.pushAssistant(llmResult.response)
        await this.checkAndSummarize()
        yield { type: 'response', content: output.answer }
        this.logger.logConversation(query, output.answer, round)
        return
      }

      // 处理需要澄清
      if (isNeedClarificationOutput(output)) {
        let responseContent = output.question
        if (output.options && output.options.length > 0) {
          responseContent += '\n\n选项：\n' + output.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
        }
        this.pushAssistant(llmResult.response)
        await this.checkAndSummarize()
        yield { type: 'response', content: responseContent }
        this.logger.logConversation(query, responseContent, round)
        return
      }

      // 处理错误
      if (isErrorOutput(output)) {
        const errorContent = `错误：${output.error}`
        this.pushAssistant(llmResult.response)
        await this.checkAndSummarize()
        yield { type: 'response', content: errorContent }
        this.logger.logConversation(query, errorContent, round)
        return
      }

      // 处理工具调用
      if (isToolCallOutput(output)) {
        this.logger.debug(`Executing tool: ${output.tool}`, JSON.stringify(output.params))

        const tool = this.registry.get(output.tool)

        if (!tool) {
          const errorMsg = `错误：工具 "${output.tool}" 不存在。可用工具：${this.registry.getAll().map(t => t.name).join(', ')}`
          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.chatHistory.push({ role: 'user', content: `[ToolExeInfo] ${errorMsg}` })
          continue
        }

        // 危险命令确认机制
        if (output.tool === 'execute_command') {
          const command = output.params?.command
          if (command) {
            const risk = classifyCommand(command)
            if (risk !== 'safe') {
              this.logger.debug(`Command requires confirmation: ${command} (risk: ${risk})`)
              yield { type: 'confirmation_request', content: command }
              const confirmed = await this.waitForConfirmation()
              if (!confirmed) {
                this.chatHistory.push({ role: 'assistant', content: llmResult.response })
                this.chatHistory.push({ role: 'user', content: '[ToolExeInfo] 用户拒绝执行该命令' })
                continue
              }
              // 用户已确认，强制执行
              output.params._force = true
            }
          }
        }

        const execResult = await tool.execute(output.params || {})
        this.logger.debug('Tool result:', JSON.stringify(execResult))

        // 构建命令字符串（隐藏 content/old_text/new_text 内容）
        const hideContent = output.tool === 'write_file' || output.tool === 'edit_file'
        const hiddenParams = ['content', 'old_text', 'new_text']
        const commandStr = `${output.tool}(${Object.entries(output.params || {}).map(([k, v]) => {
          const value = (hideContent && hiddenParams.includes(k)) ? '...' : v
          return `${k}="${value}"`
        }).join(', ')})`
        
        yield {
          type: 'command',
          content: `$ ${commandStr}`,
          metadata: {
            command: commandStr,
            commandOutput: execResult.output,
            success: execResult.success,
          },
        }

        // write_file / edit_file 成功后，展示代码预览
        if (execResult.success && (output.tool === 'write_file' || output.tool === 'edit_file')) {
          const filePath = output.params?.file_path
          if (filePath && output.tool === 'edit_file' && execResult.diff) {
            // edit_file 返回差异数据时，展示差异预览
            yield {
              type: 'diff_preview',
              content: '',
              diffPreview: execResult.diff,
            }
          }
        }

        // 工具执行结果反馈
        const resultMsg = execResult.success
          ? `工具执行成功，输出如下：\n\`\`\`\n${execResult.output}\n\`\`\``
          : `工具执行失败：${execResult.error || execResult.output}`

        this.chatHistory.push({ role: 'assistant', content: llmResult.response })
        this.chatHistory.push({ role: 'user', content: `[ToolExeInfo] ${resultMsg}` })

        await this.checkAndSummarize()
      }
    }

    const maxRoundsMsg = '任务执行轮次已达上限，请尝试简化问题。'
    yield { type: 'response', content: maxRoundsMsg }
    this.logger.logConversation(query, maxRoundsMsg, maxRounds)
  }

  cancel() {
    // 取消待确认的命令
    this.confirmationResolve?.(false)
    this.confirmationResolve = null
    this.abortController?.abort()
  }

  clearHistory() {
    this.chatHistory = []
  }

  async disconnect(): Promise<void> {
    await this.mcpManager.disconnectAll()
  }
}