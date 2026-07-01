/**
 * LLM 服务模块
 * 支持多种模型接口，当前实现 DeepSeek（兼容 OpenAI 格式）
 */

import OpenAI from 'openai'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { ChatResult, TokenUsage } from '../types/index.js'

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
    const fullMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
      ...(m.reasoning_content && { reasoning_content: m.reasoning_content }),
    }))

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: fullMessages,
        temperature: 0,
        stream: true,
        stream_options: { include_usage: true },
      } as OpenAI.ChatCompletionCreateParamsStreaming,
      { signal: options?.signal }
    )

    let reasoningContent = ''
    let content = ''
    let usage: TokenUsage | undefined

    for await (const rawChunk of stream) {
      const chunk = rawChunk as DeepSeekChunk
      const delta = chunk.choices[0]?.delta
      if (delta?.reasoning_content) {
        reasoningContent += delta.reasoning_content
      }
      if (delta?.content) {
        content += delta.content
      }
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        }
      }
    }

    const result: ChatResult = { response: content }
    if (reasoningContent) {
      result.thinking = reasoningContent.trim() || undefined
    }
    if (usage) {
      result.usage = usage
    }
    return result
  }
}
