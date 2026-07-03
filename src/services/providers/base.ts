/**
 * OpenAI-compatible Provider 基类
 * 封装所有 OpenAI 兼容 API 的公共逻辑
 */

import OpenAI from 'openai'
import type { ChatResult, TokenUsage } from '../../types/shared.js'
import type { LLMProvider, ProviderConfig } from '../types.js'

export interface ProviderOptions {
  baseUrl: string
  defaultModel: string
}

export abstract class OpenAICompatibleProvider implements LLMProvider {
  readonly abstract name: string
  protected client: OpenAI
  protected model: string

  constructor(config: ProviderConfig, options: ProviderOptions) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || options.baseUrl,
    })
    this.model = config.model || options.defaultModel
  }

  protected abstract processChunk(chunk: any, state: StreamState): void

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

    const state: StreamState = {
      content: '',
      usage: undefined,
    }

    for await (const chunk of stream) {
      this.processChunk(chunk, state)
    }

    const result: ChatResult = { response: state.content }
    if (state.thinking) {
      result.thinking = state.thinking.trim() || undefined
    }
    if (state.usage) {
      result.usage = state.usage
    }
    return result
  }
}

export interface StreamState {
  content: string
  thinking?: string
  usage?: TokenUsage
}
