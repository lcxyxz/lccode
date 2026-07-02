/**
 * Mimo Provider
 * Mimo API (OpenAI-compatible format)
 */

import OpenAI from 'openai'
import type { ChatResult, TokenUsage } from '../../types/shared.js'
import type { LLMProvider, ProviderConfig } from '../types.js'

export class MimoProvider implements LLMProvider {
  readonly name = 'mimo'
  private client: OpenAI
  private model: string

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.xiaomimimo.com/v1',
    })
    this.model = config.model || 'mimo-v2.5-pro'
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
      },
      { signal: options?.signal }
    )

    let content = ''
    let usage: TokenUsage | undefined

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
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
    if (usage) {
      result.usage = usage
    }
    return result
  }
}
