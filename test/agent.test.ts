import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  isCommandSafe: vi.fn().mockReturnValue({ safe: true }),
}))

describe('Agent', () => {
  let agent: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { Agent } = await import('../src/agent/agent.js')
    agent = new Agent({ apiKey: 'test-key' })
  })

  it('应该处理直接 Finish 的响应', async () => {
    mockChat.mockResolvedValue({
      response: 'Thought: 用户只是打招呼，不需要执行命令\nAction: Finish[你好！有什么可以帮你的？]',
    })

    const events: any[] = []
    for await (const event of agent.processInput('你好')) {
      events.push(event)
    }

    expect(events.some(e => e.type === 'thinking')).toBe(true)
    expect(events.some(e => e.type === 'response' && e.content.includes('你好'))).toBe(true)
  })

  it('应该注入系统提示词到消息中', async () => {
    mockChat.mockResolvedValue({
      response: 'Thought: 测试\nAction: Finish[OK]',
    })

    for await (const _ of agent.processInput('test')) {
    }

    const callArgs = mockChat.mock.calls[0][0]
    expect(callArgs[0].role).toBe('system')
    expect(callArgs[0].content).toContain('可用工具')
    expect(callArgs[0].content).toContain('ToolCall[')
  })

  it('应该支持思考内容输出', async () => {
    mockChat.mockResolvedValue({
      response: 'Thought: 这是思考过程\nAction: Finish[最终答案]',
      thinking: 'LLM 原生思考...',
    })

    const events: any[] = []
    for await (const event of agent.processInput('test')) {
      events.push(event)
    }

    // 应该有 LLM 原生思考和解析出的思考
    const thinkingEvents = events.filter(e => e.type === 'thinking')
    expect(thinkingEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('应该执行工具调用并返回结果', async () => {
    // 第一次返回工具调用
    mockChat
      .mockResolvedValueOnce({
        response: 'Thought: 用户想查看文件，执行 ls 命令\nAction: ToolCall[execute_command](command="ls")',
      })
      // 第二次返回 Finish
      .mockResolvedValueOnce({
        response: 'Thought: 已获得文件列表\nAction: Finish[文件列表：file1.txt, file2.txt]',
      })

    const events: any[] = []
    for await (const event of agent.processInput('查看文件')) {
      events.push(event)
    }

    // 应该有命令执行事件
    const commandEvents = events.filter(e => e.type === 'command')
    expect(commandEvents.length).toBe(1)
    expect(commandEvents[0].metadata?.success).toBe(true)

    // 应该有最终响应
    const responseEvents = events.filter(e => e.type === 'response')
    expect(responseEvents.length).toBe(1)
    expect(responseEvents[0].content).toContain('file1.txt')
  })

  it('应该处理工具不存在的情况', async () => {
    // 第一次返回不存在的工具
    mockChat
      .mockResolvedValueOnce({
        response: 'Thought: 测试不存在的工具\nAction: ToolCall[nonexistent](param="value")',
      })
      // 第二次返回 Finish
      .mockResolvedValueOnce({
        response: 'Thought: 工具不存在\nAction: Finish[工具不存在]',
      })

    const events: any[] = []
    for await (const event of agent.processInput('测试')) {
      events.push(event)
    }

    // 不应该有命令执行事件
    const commandEvents = events.filter(e => e.type === 'command')
    expect(commandEvents.length).toBe(0)
  })

  it('清空历史后应该重新开始', () => {
    agent.clearHistory()
    expect(agent.chatHistory).toHaveLength(0)
  })
})
