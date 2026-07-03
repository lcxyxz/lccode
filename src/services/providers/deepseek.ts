/**
 * DeepSeek Provider
 * DeepSeek API (compatible with OpenAI format)
 */

import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { OpenAICompatibleProvider, type ProviderOptions, type StreamState } from './base.js'

interface DeepSeekDelta extends ChatCompletionChunk.Choice.Delta {
  reasoning_content?: string
}

interface DeepSeekChunk extends ChatCompletionChunk {
  choices: Array<ChatCompletionChunk.Choice & { delta: DeepSeekDelta }>
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = 'deepseek'

  constructor(config: { apiKey: string; baseUrl?: string; model?: string }) {
    super(config, {
      baseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-v4-pro',
    })
  }

  protected processChunk(rawChunk: any, state: StreamState): void {
    const chunk = rawChunk as DeepSeekChunk
    const delta = chunk.choices[0]?.delta

    if (delta?.reasoning_content) {
      state.thinking = (state.thinking || '') + delta.reasoning_content
    }
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
