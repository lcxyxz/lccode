import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DeepSeekProvider, type ChatMessage } from '../services/llm.js'
import { executeCommand, parseExecTag } from '../services/command-executor.js'
import type { AgentConfig, AgentEvent } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
    this.chatHistory.push({ role: 'user', content: query })

    const firstResult = await this.provider.chat(this.chatHistory)
    if (firstResult.thinking) {
      yield { type: 'thinking', content: firstResult.thinking }
    }

    const parsed = parseExecTag(firstResult.response)
    if (!parsed) {
      this.pushAssistant(firstResult.response)
      yield { type: 'response', content: firstResult.response }
      return
    }

    const execResult = await executeCommand(parsed.command)
    const output = execResult.stdout || execResult.stderr || '(无输出)'
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

    const secondMessages: ChatMessage[] = [
      ...this.chatHistory,
      { role: 'assistant', content: firstResult.response },
      { role: 'user', content: resultMsg },
    ]

    const secondResult = await this.provider.chat(secondMessages)
    if (secondResult.thinking) {
      yield { type: 'thinking', content: secondResult.thinking }
    }

    this.pushAssistant(secondResult.response)
    yield { type: 'response', content: secondResult.response }
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
