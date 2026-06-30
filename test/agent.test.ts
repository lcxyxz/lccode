import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSystemPrompt } from '../src/agent/agent.js'

const mockChat = vi.fn()

vi.mock('../src/services/llm.js', () => ({
  DeepSeekProvider: vi.fn().mockImplementation(function () {
    return { chat: mockChat }
  }),
}))

vi.mock('../src/services/command-executor.js', () => ({
  executeCommand: vi.fn().mockResolvedValue({
    success: true,
    command: 'ls',
    stdout: 'file1.txt\nfile2.txt',
    stderr: '',
  }),
  parseExecTag: vi.fn(),
}))

describe('loadSystemPrompt', () => {
  it('应该返回系统提示词字符串', () => {
    const prompt = loadSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})

describe('Agent', () => {
  let agent: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { Agent } = await import('../src/agent/agent.js')
    agent = new Agent({ apiKey: 'test-key' })
  })

  it('应该处理简单对话（无命令）', async () => {
    const { parseExecTag } = await import('../src/services/command-executor.js')
    vi.mocked(parseExecTag).mockReturnValue(null)

    mockChat.mockResolvedValue({
      response: '你好！有什么可以帮你的？',
    })

    const events: any[] = []
    for await (const event of agent.processInput('你好')) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('response')
    expect(events[0].content).toBe('你好！有什么可以帮你的？')
  })

  it('应该注入系统提示词到消息中', async () => {
    const { parseExecTag } = await import('../src/services/command-executor.js')
    vi.mocked(parseExecTag).mockReturnValue(null)

    mockChat.mockResolvedValue({
      response: 'OK',
    })

    for await (const _ of agent.processInput('test')) {
    }

    const callArgs = mockChat.mock.calls[0][0]
    expect(callArgs[0].role).toBe('system')
    expect(callArgs[0].content).toContain('智能助手')
  })

  it('应该支持思考内容输出', async () => {
    const { parseExecTag } = await import('../src/services/command-executor.js')
    vi.mocked(parseExecTag).mockReturnValue(null)

    mockChat.mockResolvedValue({
      response: '最终回答',
      thinking: '让我想想...',
    })

    const events: any[] = []
    for await (const event of agent.processInput('test')) {
      events.push(event)
    }

    expect(events[0].type).toBe('thinking')
    expect(events[0].content).toBe('让我想想...')
    expect(events[1].type).toBe('response')
    expect(events[1].content).toBe('最终回答')
  })

  it('清空历史后应该重新开始', () => {
    agent.clearHistory()
    expect(agent.chatHistory).toHaveLength(0)
  })
})
