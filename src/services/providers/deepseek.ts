/**
 * DeepSeek Provider
 * DeepSeek API (compatible with OpenAI format)
 */

import OpenAI from 'openai'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { ChatResult, TokenUsage } from '../../types/shared.js'
import type { LLMProvider, ProviderConfig } from '../types.js'

interface DeepSeekDelta extends ChatCompletionChunk.Choice.Delta {
  reasoning_content?: string
}

interface DeepSeekChunk extends ChatCompletionChunk {
  choices: Array<ChatCompletionChunk.Choice & { delta: DeepSeekDelta }>
}

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek'
  private client: OpenAI
  private model: string

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.deepseek.com',
    })
    this.model = config.model || 'deepseek-v4-pro'
  }

  async chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], options?: { signal?: AbortSignal }): Promise<ChatResult> {
    const fullMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
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
