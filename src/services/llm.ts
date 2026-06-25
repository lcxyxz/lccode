/**
 * LLM 服务模块
 * 支持多种模型接口，当前实现 DeepSeek（兼容 OpenAI 格式）
 * 支持深度思考模型（如 DeepSeek）的思考过程展示
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import OpenAI from 'openai'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { ChatResult } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadSystemPrompt(): string {
  const promptPath = join(__dirname, '../prompts/system.md')
  return readFileSync(promptPath, 'utf-8').trim()
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning_content?: string
}

export interface DeepSeekConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}

interface DeepSeekDelta extends ChatCompletionChunk.Choice.Delta {
  reasoning_content?: string
}

interface DeepSeekChunk extends ChatCompletionChunk {
  choices: Array<ChatCompletionChunk.Choice & { delta: DeepSeekDelta }>
}

export class DeepSeekProvider {
  readonly name = 'deepseek'
  private client: OpenAI
  private model: string

  constructor(config: DeepSeekConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.deepseek.com',
    })
    this.model = config.model || 'deepseek-v4-pro'
  }

  async chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<ChatResult> {
    const systemPrompt = loadSystemPrompt()
    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
        ...(m.reasoning_content && { reasoning_content: m.reasoning_content }),
      })),
    ]

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: fullMessages,
        stream: true,
        reasoning_effort: 'high',
      } as OpenAI.ChatCompletionCreateParamsStreaming,
      { signal: options?.signal }
    )

    let reasoningContent = ''
    let content = ''

    for await (const rawChunk of stream) {
      const chunk = rawChunk as DeepSeekChunk
      const delta = chunk.choices[0]?.delta
      if (delta?.reasoning_content) {
        reasoningContent += delta.reasoning_content
      } else if (delta?.content) {
        content += delta.content
      }
    }

    if (reasoningContent) {
      return {
        response: content,
        thinking: reasoningContent.trim() || undefined,
      }
    }

    return { response: content }
  }
}
