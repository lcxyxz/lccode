/**
 * LLM Provider 测试
 *
 * 测试 src/services/providers/ 中的 Provider 实现：
 * - DeepSeekProvider: DeepSeek API 的流式响应处理
 * - createProvider: Provider 工厂函数
 *
 * 使用 vi.mock 模拟 OpenAI 客户端
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '../src/services/types.js'

// ===================== Mock 设置 =====================

/**
 * mock 的 OpenAI chat.completions.create 方法
 */
const mockCreate = vi.fn()

/**
 * 模拟 OpenAI 模块
 * 返回一个 mock 的 OpenAI 类，其 chat.completions.create 是 mock 的
 */
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

// ===================== 辅助函数 =====================

/**
 * 创建一个模拟的流式响应
 * 返回一个可异步迭代的对象，模拟 OpenAI 的流式响应
 */
function createMockStream(chunks: Array<Record<string, any>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
}

// ===================== DeepSeekProvider 测试 =====================

describe('DeepSeekProvider', () => {
  let provider: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { DeepSeekProvider } = await import('../src/services/providers/deepseek.js')
    provider = new DeepSeekProvider({
      apiKey: 'test-key',
      model: 'test-model',
    })
  })

  // ---------- 基本配置 ----------

  describe('基本配置', () => {
    /**
     * Provider name 应该是 'deepseek'
     */
    it('应该有正确的 name', () => {
      expect(provider.name).toBe('deepseek')
    })

    /**
     * 应该使用指定的模型
     */
    it('应该使用指定的模型', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'OK' } }] },
      ]))

      await provider.chat([{ role: 'user', content: 'Hi' }])

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.model).toBe('test-model')
    })
  })

  // ---------- 请求参数 ----------

  describe('请求参数', () => {
    /**
     * 应该正确构造请求参数
     * 包含 model, messages, stream 等
     */
    it('应该正确构造请求参数', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'Hello' } }] },
      ]))

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hi' },
      ]

      await provider.chat(messages)

      // 验证 create 被调用时的参数
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'test-model',
          stream: true,
          stream_options: { include_usage: true },
        }),
        expect.any(Object)
      )
    })

    /**
     * 应该正确传递消息
     */
    it('应该正确传递消息', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'OK' } }] },
      ]))

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helper' },
        { role: 'user', content: 'Hi' },
      ]

      await provider.chat(messages)

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'You are a helper' },
        { role: 'user', content: 'Hi' },
      ])
    })
  })

  // ---------- 流式响应处理 ----------

  describe('流式响应处理', () => {
    /**
     * 应该正确拼接流式响应内容
     */
    it('应该正确处理流式响应', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' World' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.response).toBe('Hello World')
    })

    /**
     * 空响应应该返回空字符串
     */
    it('应该处理空响应', async () => {
      mockCreate.mockResolvedValue(createMockStream([]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.response).toBe('')
    })

    /**
     * 单个 chunk 应该正常处理
     */
    it('应该处理单个 chunk', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'Only one chunk' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.response).toBe('Only one chunk')
    })
  })

  // ---------- reasoning_content 处理 ----------

  describe('reasoning_content 处理', () => {
    /**
     * 应该正确处理包含 reasoning_content 的响应
     * DeepSeek 的思考过程通过 reasoning_content 字段返回
     */
    it('应该处理包含 reasoning_content 的响应', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { reasoning_content: '思考中...' } }] },
        { choices: [{ delta: { content: '最终回答' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.thinking).toBe('思考中...')
      expect(result.response).toBe('最终回答')
    })

    /**
     * 多个 reasoning_content chunk 应该被拼接
     */
    it('应该拼接多个 reasoning_content chunk', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { reasoning_content: '思考1' } }] },
        { choices: [{ delta: { reasoning_content: '思考2' } }] },
        { choices: [{ delta: { content: '回答' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.thinking).toBe('思考1思考2')
      expect(result.response).toBe('回答')
    })

    /**
     * 没有 reasoning_content 时 thinking 应该是 undefined
     */
    it('没有 reasoning_content 时 thinking 应该是 undefined', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: '直接回答' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.thinking).toBeUndefined()
      expect(result.response).toBe('直接回答')
    })
  })

  // ---------- Token 使用统计 ----------

  describe('Token 使用统计', () => {
    /**
     * 应该正确解析 usage 信息
     */
    it('应该正确解析 usage 信息', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'OK' } }] },
        { choices: [], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      })
    })

    /**
     * 没有 usage 时应该返回 undefined
     */
    it('没有 usage 时应该返回 undefined', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'OK' } }] },
      ]))

      const result = await provider.chat([
        { role: 'user', content: 'Hi' },
      ])

      expect(result.usage).toBeUndefined()
    })
  })

  // ---------- AbortSignal 支持 ----------

  describe('AbortSignal 支持', () => {
    /**
     * 应该传递 signal 到 OpenAI 客户端
     */
    it('应该传递 signal 到 OpenAI 客户端', async () => {
      mockCreate.mockResolvedValue(createMockStream([
        { choices: [{ delta: { content: 'OK' } }] },
      ]))

      const controller = new AbortController()
      await provider.chat(
        [{ role: 'user', content: 'Hi' }],
        { signal: controller.signal }
      )

      // 验证 signal 被传递
      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: controller.signal })
      )
    })
  })
})

// ===================== createProvider 测试 =====================

describe('createProvider', () => {
  /**
   * 应该创建 DeepSeek provider
   */
  it('应该创建 DeepSeek provider', async () => {
    const { createProvider } = await import('../src/services/index.js')
    const provider = createProvider({
      apiKey: 'test-key',
      provider: 'deepseek',
    })
    expect(provider.name).toBe('deepseek')
  })

  /**
   * 应该创建 Mimo provider
   */
  it('应该创建 Mimo provider', async () => {
    const { createProvider } = await import('../src/services/index.js')
    const provider = createProvider({
      apiKey: 'test-key',
      provider: 'mimo',
    })
    expect(provider.name).toBe('mimo')
  })

  /**
   * 不指定 provider 时应该默认创建 DeepSeek provider
   */
  it('应该默认创建 DeepSeek provider', async () => {
    const { createProvider } = await import('../src/services/index.js')
    const provider = createProvider({
      apiKey: 'test-key',
    })
    expect(provider.name).toBe('deepseek')
  })

  /**
   * 未知 provider 应该抛出错误
   */
  it('应该对未知 provider 抛出错误', async () => {
    const { createProvider } = await import('../src/services/index.js')
    expect(() => createProvider({
      apiKey: 'test-key',
      provider: 'unknown' as any,
    })).toThrow('Unknown provider: unknown')
  })
})
