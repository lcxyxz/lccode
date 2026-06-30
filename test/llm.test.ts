import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '../src/services/llm.js'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }
  }),
}))

describe('DeepSeekProvider', () => {
  let provider: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../src/services/llm.js')
    provider = new mod.DeepSeekProvider({
      apiKey: 'test-key',
      model: 'test-model',
    })
  })

  it('应该正确构造请求参数', async () => {
    mockCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'Hello' } }] }
      },
    })

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
    ]

    await provider.chat(messages)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        stream: true,
      }),
      expect.any(Object)
    )
  })

  it('应该正确处理流式响应', async () => {
    mockCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'Hello' } }] }
        yield { choices: [{ delta: { content: ' World' } }] }
      },
    })

    const result = await provider.chat([
      { role: 'user', content: 'Hi' },
    ])

    expect(result.response).toBe('Hello World')
  })

  it('应该处理包含 reasoning_content 的响应', async () => {
    mockCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { reasoning_content: '思考中...' } }] }
        yield { choices: [{ delta: { content: '最终回答' } }] }
      },
    })

    const result = await provider.chat([
      { role: 'user', content: 'Hi' },
    ])

    expect(result.thinking).toBe('思考中...')
    expect(result.response).toBe('最终回答')
  })

  it('应该支持 system 消息', async () => {
    mockCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'OK' } }] }
      },
    })

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helper' },
      { role: 'user', content: 'Hi' },
    ]

    await provider.chat(messages)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].role).toBe('system')
    expect(callArgs.messages[0].content).toBe('You are a helper')
  })
})
