/**
 * OpenAI Provider
 * OpenAI 官方 API（Chat Completions 接口）
 */

import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { OpenAICompatibleProvider, type StreamState } from './base.js'

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = 'openai'

  constructor(config: { apiKey: string; baseUrl?: string; model?: string }) {
    super(config, {
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
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