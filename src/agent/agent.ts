/**
 * Agent 主逻辑
 * 实现 ReAct（Reasoning + Acting）模式
 */

import { writeFileSync, readFileSync } from 'node:fs'
import { createProvider, type LLMProvider } from '../services/index.js'
import type { ChatMessage } from '../services/types.js'
import { ToolRegistry } from './tools/tool-registry.js'
import { executeCommandTool } from './tools/command-tool.js'
import { readFileTool, writeFileTool, editFileTool, deleteFileTool, deleteDirectoryTool } from './tools/file-tools.js'
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
import { detectLanguage } from '../utils/language.js'
import { Logger, type LoggerConfig, LogLevel } from '../utils/logger.js'

// ===================== Agent 类 =====================

export class Agent {
  private provider: LLMProvider
  private registry: ToolRegistry
  private chatHistory: ChatMessage[] = []
  private maxHistory = 20
  private currentQueryStartIndex = 0
  private logger: Logger

  constructor(config: AgentConfig, loggerConfig?: LoggerConfig) {
    this.provider = createProvider(config)
    this.registry = new ToolRegistry()
    this.logger = new Logger(loggerConfig)
    
    this.registry.register(executeCommandTool)
    this.registry.register(readFileTool)
    this.registry.register(writeFileTool)
    this.registry.register(editFileTool)
    this.registry.register(deleteFileTool)
    this.registry.register(deleteDirectoryTool)
    
    this.logger.clear()
    this.logger.info('Agent initialized')
  }

  getToolRegistry(): ToolRegistry {
    return this.registry
  }

  private buildMessages(): ChatMessage[] {
    const currentMessages = this.chatHistory.slice(this.currentQueryStartIndex)
    const systemPrompt = buildSystemPrompt(this.registry, {
      history: this.chatHistory,
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
    if (this.chatHistory.length > this.maxHistory) {
      const trimmed = this.chatHistory.length - this.maxHistory
      this.chatHistory = this.chatHistory.slice(-this.maxHistory)
      this.currentQueryStartIndex = Math.max(0, this.currentQueryStartIndex - trimmed)
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
    const maxRounds = 15
    const maxParseRetries = 2
    let round = 0
    let parseRetries = 0
    
    this.currentQueryStartIndex = this.chatHistory.length
    this.chatHistory.push({ role: 'user', content: query })

    while (round < maxRounds) {
      round++
      
      this.logger.debug(`\n=== Round ${round} ===`)

      const messages = this.buildMessages()
      this.logger.debug('SystemPrompt:', messages[0].content)

      const llmResult = await this.provider.chat(messages)
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
        yield { type: 'response', content: responseContent }
        this.logger.logConversation(query, responseContent, round)
        return
      }

      // 处理错误
      if (isErrorOutput(output)) {
        const errorContent = `错误：${output.error}`
        this.pushAssistant(llmResult.response)
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

        const execResult = await tool.execute(output.params || {})
        this.logger.debug('Tool result:', JSON.stringify(execResult))

        // 构建命令字符串（隐藏 content 内容）
        const hideContent = output.tool === 'write_file' || output.tool === 'edit_file'
        const commandStr = `${output.tool}(${Object.entries(output.params || {}).map(([k, v]) => {
          const value = (hideContent && k === 'content') ? '...' : v
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

        // 工具执行结果反馈
        const resultMsg = execResult.success
          ? `工具执行成功，输出如下：\n\`\`\`\n${execResult.output}\n\`\`\``
          : `工具执行失败：${execResult.error || execResult.output}`

        this.chatHistory.push({ role: 'assistant', content: llmResult.response })
        this.chatHistory.push({ role: 'user', content: `[ToolExeInfo] ${resultMsg}` })
      }
    }

    const maxRoundsMsg = '任务执行轮次已达上限，请尝试简化问题。'
    yield { type: 'response', content: maxRoundsMsg }
    this.logger.logConversation(query, maxRoundsMsg, maxRounds)
  }

  clearHistory() {
    this.chatHistory = []
  }
}
