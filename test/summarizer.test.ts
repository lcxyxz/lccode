/**
 * 对话摘要生成器测试
 *
 * 测试 src/agent/memory/summarizer.ts 中的 Summarizer 类：
 * - summarize: 生成对话摘要
 * - getSummary: 获取缓存的摘要
 * - getLastSummarizedIndex: 获取上次摘要的消息索引
 *
 * 使用 mock LLM Provider 来模拟 LLM 调用
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Summarizer } from '../src/agent/memory/summarizer.js'
import type { LLMProvider } from '../src/services/types.js'
import type { ChatMessage } from '../src/services/types.js'

// ===================== Mock Provider =====================

/**
 * 创建一个 mock LLM Provider
 * 可以自定义 chat 方法的返回值
 */
function createMockProvider(responseText = '这是对话摘要') {
  return {
    name: 'mock',
    chat: vi.fn().mockResolvedValue({
      response: responseText,
      thinking: undefined,
      usage: undefined,
    }),
  } as unknown as LLMProvider
}

// ===================== 测试用例 =====================

describe('Summarizer', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let summarizer: Summarizer

  beforeEach(() => {
    mockProvider = createMockProvider()
    summarizer = new Summarizer(mockProvider)
  })

  // ---------- 初始状态测试 ----------

  describe('初始状态', () => {
    /**
     * 初始摘要应该为空字符串
     */
    it('初始摘要应该为空', () => {
      expect(summarizer.getSummary()).toBe('')
    })

    /**
     * 初始摘要索引应该为 0
     */
    it('初始摘要索引应该为 0', () => {
      expect(summarizer.getLastSummarizedIndex()).toBe(0)
    })
  })

  // ---------- summarize 方法测试 ----------

  describe('summarize', () => {
    /**
     * 空消息数组应该返回空字符串，不调用 LLM
     */
    it('空消息应该返回空字符串', async () => {
      const result = await summarizer.summarize([])

      expect(result).toBe('')
      expect(mockProvider.chat).not.toHaveBeenCalled()
    })

    /**
     * 只包含系统消息的消息数组应该返回空字符串
     */
    it('只有系统消息应该返回空字符串', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是助手' },
      ]

      const result = await summarizer.summarize(messages)

      expect(result).toBe('')
      expect(mockProvider.chat).not.toHaveBeenCalled()
    })

    /**
     * 正常的用户和助手对话应该调用 LLM 生成摘要
     */
    it('正常对话应该调用 LLM 生成摘要', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮你的？' },
      ]

      const result = await summarizer.summarize(messages)

      // 应该调用 LLM
      expect(mockProvider.chat).toHaveBeenCalled()
      // 应该返回 LLM 的响应
      expect(result).toBe('这是对话摘要')
      // 摘要应该被缓存
      expect(summarizer.getSummary()).toBe('这是对话摘要')
      // 摘要索引应该更新
      expect(summarizer.getLastSummarizedIndex()).toBe(2)
    })

    /**
     * ToolExeInfo 消息应该被格式化为"工具结果"
     */
    it('应该正确格式化 ToolExeInfo 消息', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '[ToolExeInfo] 工具执行成功' },
        { role: 'assistant', content: '好的' },
      ]

      await summarizer.summarize(messages)

      // 验证发送给 LLM 的消息格式
      const callArgs = (mockProvider.chat as any).mock.calls[0][0]
      const userMessage = callArgs.find((m: any) => m.role === 'user')

      // ToolExeInfo 应该被转换为"工具结果"
      expect(userMessage.content).toContain('工具结果: 工具执行成功')
    })

    /**
     * LLM 调用失败时应该返回空字符串，不影响正常对话
     */
    it('LLM 调用失败时应该返回空字符串', async () => {
      mockProvider.chat = vi.fn().mockRejectedValue(new Error('API 错误'))

      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' },
      ]

      const result = await summarizer.summarize(messages)

      // 应该返回空字符串
      expect(result).toBe('')
      // 摘要缓存不应该被更新
      expect(summarizer.getSummary()).toBe('')
    })

    /**
     * 摘要生成后，lastSummarizedIndex 应该等于消息数组长度
     */
    it('摘要后索引应该等于消息长度', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '消息1' },
        { role: 'assistant', content: '回复1' },
        { role: 'user', content: '消息2' },
        { role: 'assistant', content: '回复2' },
      ]

      await summarizer.summarize(messages)

      expect(summarizer.getLastSummarizedIndex()).toBe(4)
    })
  })

  // ---------- getSummary 测试 ----------

  describe('getSummary', () => {
    /**
     * 多次摘要后应该返回最新的摘要
     */
    it('多次摘要后应该返回最新摘要', async () => {
      // 第一次摘要
      mockProvider.chat = vi.fn().mockResolvedValue({ response: '第一次摘要' })
      await summarizer.summarize([{ role: 'user', content: '1' }])
      expect(summarizer.getSummary()).toBe('第一次摘要')

      // 第二次摘要
      mockProvider.chat = vi.fn().mockResolvedValue({ response: '第二次摘要' })
      await summarizer.summarize([{ role: 'user', content: '2' }])
      expect(summarizer.getSummary()).toBe('第二次摘要')
    })
  })

  // ---------- 消息格式化测试 ----------

  describe('消息格式化', () => {
    /**
     * 助手消息应该以"助手:"前缀格式化
     */
    it('助手消息应该格式化为"助手: ..."', async () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: '你好！' },
      ]

      await summarizer.summarize(messages)

      const callArgs = (mockProvider.chat as any).mock.calls[0][0]
      const userMessage = callArgs.find((m: any) => m.role === 'user')

      expect(userMessage.content).toContain('助手: 你好！')
    })

    /**
     * 普通用户消息应该以"用户:"前缀格式化
     */
    it('用户消息应该格式化为"用户: ..."', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' },
      ]

      await summarizer.summarize(messages)

      const callArgs = (mockProvider.chat as any).mock.calls[0][0]
      const userMessage = callArgs.find((m: any) => m.role === 'user')

      expect(userMessage.content).toContain('用户: 你好')
    })

    /**
     * 多条消息应该用换行符连接
     */
    it('多条消息应该用换行符连接', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '消息1' },
        { role: 'assistant', content: '回复1' },
        { role: 'user', content: '消息2' },
      ]

      await summarizer.summarize(messages)

      const callArgs = (mockProvider.chat as any).mock.calls[0][0]
      const userMessage = callArgs.find((m: any) => m.role === 'user')

      // 应该包含格式化后的对话
      expect(userMessage.content).toContain('用户: 消息1')
      expect(userMessage.content).toContain('助手: 回复1')
      expect(userMessage.content).toContain('用户: 消息2')
    })
  })
})
