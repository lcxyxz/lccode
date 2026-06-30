import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DeepSeekProvider, type ChatMessage } from '../services/llm.js'
import { executeCommand, parseExecTag } from '../services/command-executor.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEBUG_LOG = '/tmp/agent-debug.log'

function debugLog(...lines: string[]) {
  appendFileSync(DEBUG_LOG, lines.join('\n') + '\n')
}

function loadSystemPrompt(): string {
  const promptPath = join(__dirname, '../prompts/system.md')
  return readFileSync(promptPath, 'utf-8').trim()
}

export class Agent {
  private provider: DeepSeekProvider
  private chatHistory: ChatMessage[] = []
  private maxHistory = 20

  constructor(config: AgentConfig) {
    this.provider = new DeepSeekProvider(config)
  }

  async *processInput(query: string): AsyncGenerator<AgentEvent> {
    writeFileSync(DEBUG_LOG, '')
    let round = 0
    this.chatHistory.push({ role: 'user', content: query })

    let llmResult = await this.provider.chat(this.chatHistory)
    debugLog(`=== Round ${round} LLM response:`, llmResult.response)
    if (llmResult.thinking) {
      yield { type: 'thinking', content: llmResult.thinking }
    }

    let parsed = parseExecTag(llmResult.response)
    debugLog(`=== Round ${round} parsed exec:`, JSON.stringify(parsed, null, 2))

    if (parsed && parsed.before) {
      yield { type: 'response', content: parsed.before }
    }

    let maxRounds = 5

    while (parsed && maxRounds-- > 0) {
      round++
      debugLog(`\n=== >>> Round ${round}: executing "${parsed.command}"`)
      const execResult = await executeCommand(parsed.command)
      const rawOutput = execResult.stdout || execResult.stderr || '(无输出)'
      const maxOutputLen = 3000
      const output = rawOutput.length > maxOutputLen
        ? rawOutput.slice(0, maxOutputLen) + `\n... (输出被截断，原始长度 ${rawOutput.length} 字符)`
        : rawOutput
      yield {
        type: 'command',
        content: `$ ${execResult.command}`,
        metadata: {
          command: execResult.command,
          commandOutput: output,
          success: execResult.success,
        },
      }

      const resultMsg = execResult.success
        ? `命令 "${execResult.command}" 执行成功，输出如下：\n\`\`\`\n${output}\n\`\`\``
        : `命令 "${execResult.command}" 执行失败：${execResult.error || execResult.stderr}`

      this.chatHistory.push({ role: 'assistant', content: llmResult.response })
      this.chatHistory.push({ role: 'user', content: resultMsg })

      debugLog(`=== Round ${round} LLM call, history length: ${this.chatHistory.length}`)
      llmResult = await this.provider.chat(this.chatHistory)
      debugLog(`=== Round ${round} LLM response:`, llmResult.response)
      if (llmResult.thinking) {
        debugLog(`=== Round ${round} LLM thinking:`, llmResult.thinking)
        yield { type: 'thinking', content: llmResult.thinking }
      }

      parsed = parseExecTag(llmResult.response)
      debugLog(`=== Round ${round} parsed exec after LLM:`, JSON.stringify(parsed, null, 2))

      if (parsed && parsed.before) {
        yield { type: 'response', content: parsed.before }
      }
    }

    this.pushAssistant(llmResult.response)
    debugLog(`\n=== >>> Round ${round} final response (loop ended, parsed=${JSON.stringify(parsed)}):`, llmResult.response, '\n')
    yield { type: 'response', content: llmResult.response }
  }

  private pushAssistant(content: string) {
    this.chatHistory.push({ role: 'assistant', content: content })
    if (this.chatHistory.length > this.maxHistory) {
      this.chatHistory = this.chatHistory.slice(-this.maxHistory)
    }
  }

  clearHistory() {
    this.chatHistory = []
  }
}
