import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChat = vi.fn()

vi.mock('../src/services/index.js', () => ({
  createProvider: vi.fn().mockImplementation(function () {
    return { chat: mockChat, name: 'deepseek' }
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

vi.mock('../src/agent/mcp/manager.js', () => {
  return {
    McpManager: class MockMcpManager {
      loadFromConfig = vi.fn().mockResolvedValue([])
      disconnectAll = vi.fn().mockResolvedValue(undefined)
      getActiveToolNames = vi.fn().mockReturnValue(new Set())
      getServerBriefList = vi.fn().mockReturnValue([])
      enableAll = vi.fn()
      disableAll = vi.fn()
      toggleServerByIndex = vi.fn().mockReturnValue(null)
    }
  }
})

describe('Agent', () => {
  let agent: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { Agent } = await import('../src/agent/agent.js')
    agent = await Agent.create({ apiKey: 'test-key' })
  })

  it('应该处理最终答案的响应', async () => {
    mockChat.mockResolvedValue({
      response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "用户只是打招呼",\n  "answer": "你好！有什么可以帮你的？"\n}\n</lccode_json>',
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
      response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "测试",\n  "answer": "OK"\n}\n</lccode_json>',
    })

    for await (const _ of agent.processInput('test')) {
    }

    const callArgs = mockChat.mock.calls[0][0]
    expect(callArgs[0].role).toBe('system')
    expect(callArgs[0].content).toContain('可用工具')
    expect(callArgs[0].content).toContain('lccode_json')
  })

  it('应该支持思考内容输出', async () => {
    mockChat.mockResolvedValue({
      response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "这是思考过程",\n  "answer": "最终答案"\n}\n</lccode_json>',
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
        response: '<lccode_json>\n{\n  "type": "tool_call",\n  "thought": "用户想查看文件",\n  "tool": "execute_command",\n  "params": {\n    "command": "ls"\n  }\n}\n</lccode_json>',
      })
      // 第二次返回最终答案
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "已获得文件列表",\n  "answer": "文件列表：file1.txt, file2.txt"\n}\n</lccode_json>',
      })

    const events: any[] = []
    for await (const event of agent.processInput('查看文件')) {
      events.push(event)
    }

    // 应该有命令执行事件（仅首次实际执行）
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
        response: '<lccode_json>\n{\n  "type": "tool_call",\n  "thought": "测试不存在的工具",\n  "tool": "nonexistent",\n  "params": {\n    "param": "value"\n  }\n}\n</lccode_json>',
      })
      // 第二次返回最终答案
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "工具不存在",\n  "answer": "工具不存在"\n}\n</lccode_json>',
      })

    const events: any[] = []
    for await (const event of agent.processInput('测试')) {
      events.push(event)
    }

    // 不应该有命令执行事件
    const commandEvents = events.filter(e => e.type === 'command')
    expect(commandEvents.length).toBe(0)
  })

  it('应该支持文件写入的工具调用', async () => {
    // 第一次返回文件写入的工具调用
    mockChat
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "tool_call",\n  "thought": "用户需要创建文件",\n  "tool": "write_file",\n  "params": {\n    "file_path": "test.txt",\n    "content": "Hello World"\n  }\n}\n</lccode_json>',
      })
      // 第二次返回最终答案
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "文件创建成功",\n  "answer": "文件已创建"\n}\n</lccode_json>',
      })

    const events: any[] = []
    for await (const event of agent.processInput('创建文件')) {
      events.push(event)
    }

    // 应该有命令执行事件
    const commandEvents = events.filter(e => e.type === 'command')
    expect(commandEvents.length).toBe(1)
    expect(commandEvents[0].metadata?.success).toBe(true)
  })

  it('应该支持需要澄清的响应', async () => {
    mockChat.mockResolvedValue({
      response: '<lccode_json>\n{\n  "type": "need_clarification",\n  "thought": "用户请求比较模糊",\n  "question": "请确认你需要哪种操作？",\n  "options": ["查看文件", "执行命令"]\n}\n</lccode_json>',
    })

    const events: any[] = []
    for await (const event of agent.processInput('帮我处理一下')) {
      events.push(event)
    }

    // 应该有最终响应，包含澄清问题
    const responseEvents = events.filter(e => e.type === 'response')
    expect(responseEvents.length).toBe(1)
    expect(responseEvents[0].content).toContain('请确认')
  })

  it('应该支持错误响应', async () => {
    mockChat.mockResolvedValue({
      response: '<lccode_json>\n{\n  "type": "error",\n  "thought": "发生了错误",\n  "error": "文件不存在"\n}\n</lccode_json>',
    })

    const events: any[] = []
    for await (const event of agent.processInput('测试错误')) {
      events.push(event)
    }

    // 应该有最终响应，包含错误信息
    const responseEvents = events.filter(e => e.type === 'response')
    expect(responseEvents.length).toBe(1)
    expect(responseEvents[0].content).toContain('错误')
  })

  it('应该拒绝没有 thought 字段的响应', async () => {
    // 第一次返回没有 thought 字段的响应
    mockChat
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "final_answer",\n  "answer": "缺少thought"\n}\n</lccode_json>',
      })
      // 第二次返回正确的响应
      .mockResolvedValueOnce({
        response: '<lccode_json>\n{\n  "type": "final_answer",\n  "thought": "修正后",\n  "answer": "正确答案"\n}\n</lccode_json>',
      })

    const events: any[] = []
    for await (const event of agent.processInput('测试thought')) {
      events.push(event)
    }

    // 应该有重试提示
    const responseEvents = events.filter(e => e.type === 'response')
    expect(responseEvents.length).toBe(1)
    expect(responseEvents[0].content).toContain('正确答案')
  })

  it('清空历史后应该重新开始', () => {
    agent.clearHistory()
    expect(agent.chatHistory).toHaveLength(0)
  })
})
