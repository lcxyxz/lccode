/**
 * Mimo Provider
 * Mimo API (OpenAI-compatible format)
 */

import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { OpenAICompatibleProvider, type StreamState } from './base.js'

export class MimoProvider extends OpenAICompatibleProvider {
  readonly name = 'mimo'

  constructor(config: { apiKey: string; baseUrl?: string; model?: string }) {
    super(config, {
      baseUrl: 'https://api.xiaomimimo.com/v1',
      defaultModel: 'mimo-v2.5-pro',
    })
  }

  protected processChunk(rawChunk: any, state: StreamState): void {
    const chunk = rawChunk as ChatCompletionChunk
    const delta = chunk.choices[0]?.delta

    if (delta?.content) {
      state.content += delta.content
    }
    if (chunk.usage) {
      state.usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      }
    }
  }
}
