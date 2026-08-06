/**
 * Agent 主逻辑
 */
import { createProvider, type LLMProvider } from '../services/index.js'
import type { ChatMessage } from '../services/types.js'
import { ToolRegistry } from './tools/tool-registry.js'
import { executeCommandTool } from './tools/command-tool.js'
import { planTool, summaryTool } from './tools/agent-tool.js'
import { readFileTool, writeFileTool, editFileTool, deleteFileTool, deleteDirectoryTool, searchTool, addDirTool } from './tools/file-tools.js'
import { sandboxTool } from './tools/sandbox-tool.js'
import { buildSystemPrompt, createFrozenTimeInfo } from './prompts/prompt-template.js'
import { getRetryMessage, render } from './prompts/loader.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'
import {
  parseLLMOutput,
  isToolCallOutput,
  isFinalAnswerOutput,
  isNeedClarificationOutput,
  isErrorOutput,
  type ParseFailure
} from '../types/llm-output.js'
import { Logger, type LoggerConfig } from '../utils/logger.js'
import { McpManager } from './mcp/manager.js'
import { SkillManager } from './skill/skill-manager.js'

// ===================== Agent 类 =====================

/** 发送给 LLM 的历史消息默认最大估算 token 数 */
const DEFAULT_MAX_HISTORY_TOKENS = 12000
/** 单条工具执行结果反馈给 LLM 的默认最大字符数 */
const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 20000
/** 旧历史估算 token 超过预算的该比例时触发压缩提示 */
const SUMMARY_TRIGGER_RATIO = 0.8
/** 旧历史超预算时注入的提示，引导模型主动调用 summarize_history 工具压缩上下文 */
const SUMMARY_TOOL_HINT = '更早的对话历史已超出上下文预算被截断。如需回忆早期内容（用户需求、已确认的决策、文件路径、已完成的操作），请调用 summarize_history 工具获取完整历史的摘要，再继续当前任务。'
/** 当前轮次消息（本次用户输入及工具反馈）的默认最大估算 token 数 */
const DEFAULT_MAX_ROUND_TOKENS = 12000
/** 当前轮次中较旧工具结果超出预算时压缩到的最大字符数 */
const DEFAULT_COMPACT_TOOL_CHARS = 1200
/** 每次进入对话最多执行工具的轮次 */
const DEFAULT_MAX_ROUNDS = 15

export class Agent {
  private provider: LLMProvider
  private registry: ToolRegistry
  private mcpManager: McpManager
  private skillManager: SkillManager
  private chatHistory: ChatMessage[] = []
  /** 当前轮次起始位置：本轮用户输入及之后的工具调用反馈始终完整保留 */
  private roundStartIndex = 0
  /** 旧历史摘要：null 表示尚未生成 */
  private summary: string | null = null
  /** 本轮开始时刻缓存的时间信息，避免每轮重建系统提示词破坏前缀缓存 */
  private taskStartTime: string | null = null
  private logger: Logger
  private abortController: AbortController | null = null
  private config: AgentConfig

  private constructor(config: AgentConfig, loggerConfig?: LoggerConfig) {
    this.provider = createProvider(config)
    this.config = config
    this.registry = new ToolRegistry()
    this.mcpManager = new McpManager()
    this.skillManager = new SkillManager()
    this.logger = new Logger(loggerConfig)

    this.registerTools(config)

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

    try {
      await agent.skillManager.loadFromDisk()
      const skillTools = agent.skillManager.getAllTools()
      skillTools.forEach(tool => agent.registry.register(tool))
      agent.refreshToolFilter()
      agent.logger.info(`Skills loaded: ${agent.skillManager.count}, tools: ${skillTools.length}`)
    } catch (error) {
      agent.logger.error('Failed to load skills:', error)
    }

    return agent
  }

  private registerTools(config: AgentConfig): void {
    this.registry.register(executeCommandTool)
    this.registry.register(readFileTool)
    this.registry.register(writeFileTool)
    this.registry.register(editFileTool)
    this.registry.register(deleteFileTool)
    this.registry.register(deleteDirectoryTool)
    this.registry.register(searchTool)
    this.registry.register(addDirTool)
    this.registry.register(planTool(config))
    this.registry.register(summaryTool(config, this))
    this.registry.register(sandboxTool)
  }

  getMcpManager(): McpManager {
    return this.mcpManager
  }

  getSkillManager(): SkillManager {
    return this.skillManager
  }

  /** 刷新工具过滤器，将 McpManager 和 SkillManager 的启用状态同步到 ToolRegistry */
  refreshToolFilter(): void {
    const activeNames = new Set<string>()
    for (const name of this.mcpManager.getActiveToolNames()) activeNames.add(name)
    for (const name of this.skillManager.getActiveToolNames()) activeNames.add(name)
    this.registry.setActiveFilter(activeNames)
  }

  /** 估算消息内容的 token 数：中文字符约 1 token/字，其他字符约 4 字符/token */
  private estimateTokens(content: string): number {
    let tokens = 0
    for (const ch of content) {
      const code = ch.codePointAt(0) ?? 0
      if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || code >= 0x20000) {
        tokens += 1
      } else {
        tokens += 0.25
      }
    }
    return Math.ceil(tokens)
  }

  /** 截断超长文本，超出部分用提示标注（仅作用于发送给 LLM 的内容） */
  private truncateForLLM(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    const head = text.slice(0, maxChars)
    return `${head}\n...(输出过长已截断，共 ${text.length} 字符，剩余 ${text.length - maxChars} 字符未展示)`
  }

  /**
   * 压缩当前轮次消息：预算优先给最新消息，
   * 较旧且超预算的工具结果压缩为短摘要，避免随轮次膨胀。
   * 仅影响发送给 LLM 的内容，不影响 chatHistory 原文。
   */
  private compactRound(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    if (messages.length <= 1) return messages
    let used = 0
    const result = messages.map(m => ({ ...m }))
    for (let i = result.length - 1; i >= 0; i--) {
      const content = result[i].content
      const tokens = this.estimateTokens(content)
      if (used + tokens <= maxTokens) {
        used += tokens
        continue
      }
      // 超预算：仅压缩 <tool_result> 旧结果，非工具消息（如用户指令）保持原样
      if (content.includes('<tool_result>')) {
        const compact = this.compactToolResult(content)
        result[i] = { ...result[i], content: compact }
        used += this.estimateTokens(compact)
      } else {
        used += tokens
      }
    }
    return result
  }

  /** 将单条工具结果压缩为短摘要，保留包裹标签 */
  private compactToolResult(content: string): string {
    const maxChars = this.config.compactToolChars ?? DEFAULT_COMPACT_TOOL_CHARS
    const openTag = '<tool_result>'
    const closeTag = '</tool_result>'
    const openIdx = content.indexOf(openTag)
    const closeIdx = content.lastIndexOf(closeTag)
    if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) {
      return this.truncateForLLM(content, maxChars)
    }
    const inner = content.slice(openIdx + openTag.length, closeIdx)
    const compactInner = this.truncateForLLM(inner, maxChars)
    return `${content.slice(0, openIdx)}${openTag}${compactInner}${closeTag}${content.slice(closeIdx + closeTag.length)}`
  }

  /**
   * 构建发送给 LLM 的消息列表。
   * 当前轮次（本次用户输入及后续工具调用反馈）始终完整保留；
   * 旧历史超过阈值时压缩为摘要。
   */
  private buildMessages(): ChatMessage[] {
    const systemPrompt = buildSystemPrompt(this.registry, this.taskStartTime ?? undefined)
    const maxHistoryTokens = this.config.maxHistoryTokens ?? DEFAULT_MAX_HISTORY_TOKENS
    const maxRoundTokens = this.config.maxRoundTokens ?? DEFAULT_MAX_ROUND_TOKENS

    const currentRound = this.compactRound(this.chatHistory.slice(this.roundStartIndex), maxRoundTokens)
    const oldHistory = this.buildOldHistory(maxHistoryTokens)

    return [
      { role: 'system', content: systemPrompt },
      ...oldHistory,
      ...currentRound,
    ]
  }

  /** 摘要消息（system 角色，避免被模型误当成用户指令） */
  private buildSummaryMessage(): ChatMessage {
    return { role: 'system', content: `## Earlier Conversation Summary\n\n${this.summary}` }
  }

  /** 判断是否为用户取消（AbortError） */
  private isAbortError(error: any): boolean {
    return error?.name === 'AbortError' || error?.message?.toLowerCase().includes('abort')
  }

  /**
   * 构建旧历史部分：
   * 估算 token 未超过预算 80% 时原样返回；
   * 超过时截断为预算内最近历史，并注入提示引导模型调用 summarize_history 工具；
   * 已有摘要时以「摘要 + 最近历史」替代完整旧历史。
   */
  private buildOldHistory(maxHistoryTokens: number): ChatMessage[] {
    const oldHistory = this.chatHistory.slice(0, this.roundStartIndex)

    // 未超过阈值，原样发送
    const totalOld = oldHistory.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)
    if (totalOld <= maxHistoryTokens * SUMMARY_TRIGGER_RATIO) {
      return oldHistory
    }

    const budget = Math.floor(maxHistoryTokens * SUMMARY_TRIGGER_RATIO)
    const recent = this.truncateOldHistory(oldHistory, budget)

    // 已有摘要：摘要 + 预算内最近历史
    if (this.summary !== null) {
      return [this.buildSummaryMessage(), ...recent]
    }

    // 无摘要：最近历史 + 提示模型主动调用 summarize_history 工具
    recent.push({ role: 'system', content: SUMMARY_TOOL_HINT })
    return recent
  }

  /**
   * 按 token 预算从尾部截断历史，保留最近的消息。
   * 仅影响发送给 LLM 的内容，不影响 chatHistory 原文。
   */
  private truncateOldHistory(history: ChatMessage[], maxTokens: number): ChatMessage[] {
    const kept: ChatMessage[] = []
    let total = 0
    for (let i = history.length - 1; i >= 0; i--) {
      const tokens = this.estimateTokens(history[i].content)
      if (total + tokens > maxTokens) break
      kept.unshift(history[i])
      total += tokens
    }
    return kept
  }

  /** 完整旧历史（含超预算被截断的部分），供 summarize_history 工具调用 */
  getOldHistory(): ChatMessage[] {
    return this.chatHistory.slice(0, this.roundStartIndex)
  }

  /** 记录摘要结果，供 summarize_history 工具调用 */
  setSummary(summary: string) {
    this.summary = summary
  }

  private pushAssistant(content: string) {
    this.chatHistory.push({ role: 'assistant', content: content })
  }

  /**
   * 推送工具执行结果。
   * 用 <tool_result> 标签包裹，与用户真实指令在结构上区分，
   * 并对超长输出截断，避免单条结果撑爆上下文。
   */
  private pushToolResult(content: string, success: boolean) {
    const maxChars = this.config.maxToolOutputChars ?? DEFAULT_MAX_TOOL_OUTPUT_CHARS
    const statusLine = success ? '工具执行成功，输出如下：' : '工具执行失败：'
    const wrapped = `<tool_result>\n${statusLine}\n${this.truncateForLLM(content, maxChars)}\n</tool_result>`
    this.chatHistory.push({ role: 'user', content: wrapped })
  }

  /**
   * 构建解析失败的重试消息
   */
  private buildRetryMessage(failure: ParseFailure): string {
    return render(getRetryMessage(), {
      error: failure.error,
      hint: failure.hint,
    })
  }

  async *processInput(query: string): AsyncGenerator<AgentEvent> {
    const maxRounds = this.config.maxRounds ?? DEFAULT_MAX_ROUNDS
    const maxParseRetries = this.config.maxParseRetries ?? 5
    let round = 0
    let parseRetries = 0
    
    this.abortController = new AbortController()
    this.roundStartIndex = this.chatHistory.length
    this.taskStartTime = createFrozenTimeInfo()
    this.chatHistory.push({ role: 'user', content: query })

    while (round < maxRounds) {
      round++
      
      this.logger.debug(`\n=== Round ${round} ===`)

      let messages: ChatMessage[]
      let llmResult
      try {
        messages = this.buildMessages()
        this.logger.debug('SystemPrompt:', messages[0].content)
        llmResult = await this.provider.chat(messages, { signal: this.abortController.signal })
      } catch (error: any) {
        if (this.isAbortError(error)) {
          yield { type: 'error', content: '对话已取消' }
          return
        }
        throw error
      }
      this.logger.debug('LLM response:', llmResult.response)

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
        yield { type: 'response', content: llmResult.response, metadata: { round } }
        return
      }

      // 解析成功，重置计数
      parseRetries = 0
      const output = result.output

      // 处理最终答案
      if (isFinalAnswerOutput(output)) {
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: output.answer, metadata: { round } }
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
        yield { type: 'response', content: responseContent, metadata: { round } }
        this.logger.logConversation(query, responseContent, round)
        return
      }

      // 处理错误
      if (isErrorOutput(output)) {
        const errorContent = `错误：${output.error}`
        this.pushAssistant(llmResult.response)
        yield { type: 'response', content: errorContent, metadata: { round } }
        this.logger.logConversation(query, errorContent, round)
        return
      }

      // 处理工具调用
      if (isToolCallOutput(output)) {
        if (output.round_action) {
          yield { type: 'thinking', content: output.round_action, metadata: { round } }
        }

        this.logger.debug(`Executing tool: ${output.tool}`, JSON.stringify(output.params))

        const tool = this.registry.get(output.tool)

        if (!tool) {
          const errorMsg = `错误：工具 "${output.tool}" 不存在。可用工具：${this.registry.getAll().map(t => t.name).join(', ')}`
          this.chatHistory.push({ role: 'assistant', content: llmResult.response })
          this.pushToolResult(errorMsg, false)
          continue
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
            round,
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
              metadata: { round },
              diffPreview: execResult.diff,
            }
          }
        }

        // 工具执行结果反馈（独立推送，方便截断与角色区分）
        this.chatHistory.push({ role: 'assistant', content: llmResult.response })
        this.pushToolResult(execResult.success ? execResult.output : (execResult.error || execResult.output), execResult.success)
      }
    }

    const maxRoundsMsg = '任务执行轮次已达上限，请尝试简化问题。'
    yield { type: 'response', content: maxRoundsMsg }
    this.logger.logConversation(query, maxRoundsMsg, maxRounds)
  }

  cancel() {
    this.abortController?.abort()
  }

  clearHistory() {
    this.chatHistory = []
    this.roundStartIndex = 0
    this.summary = null
    this.taskStartTime = null
  }

  async disconnect(): Promise<void> {
    await this.mcpManager.disconnectAll()
  }
}