/**
 * Agent 类测试
 *
 * 测试 src/agent/agent.ts 中的 Agent 类：
 * - processInput: 处理用户输入并生成事件流
 * - 各种 LLM 响应类型的处理：
 *   - final_answer: 最终答案
 *   - tool_call: 工具调用
 *   - need_clarification: 需要澄清
 *   - error: 错误
 * - 思考内容输出
 * - 工具执行结果
 * - 历史管理
 *
 * 使用 vi.mock 模拟外部依赖（LLM Provider、命令执行器、MCP）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===================== Mock 设置 =====================

/**
 * mock 的 chat 方法，用于模拟 LLM 响应
 * 可以在测试中配置返回值
 */
const mockChat = vi.fn()

/**
 * mock 的 executeCommand 方法
 * 默认返回成功结果
 */
const mockExecuteCommand = vi.fn().mockResolvedValue({
  success: true,
  command: 'ls',
  stdout: 'file1.txt\nfile2.txt',
  stderr: '',
})

/**
 * mock 的 writeFile 方法
 * 默认返回成功结果
 */
const mockWriteFile = vi.fn().mockResolvedValue({
  success: true,
  output: '已写入文件',
})

/**
 * mock 的 readFile 方法
 * 默认返回成功结果
 */
const mockReadFile = vi.fn().mockResolvedValue({
  success: true,
  output: '文件内容',
})

// 模拟 LLM 服务
vi.mock('../src/services/index.js', () => ({
  createProvider: vi.fn().mockImplementation(function () {
    return { chat: mockChat, name: 'deepseek' }
  }),
}))

// 模拟命令执行器
vi.mock('../src/services/command-executor.js', () => ({
  executeCommand: mockExecuteCommand,
  getPlatform: vi.fn().mockReturnValue('linux'),
}))

// 模拟 MCP 管理器
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

// ===================== 辅助函数 =====================

/**
 * 创建一个 final_answer 类型的 LLM 响应
 */
function makeFinalAnswer(thought: string, answer: string) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'final_answer', thought, answer }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 tool_call 类型的 LLM 响应
 */
function makeToolCall(thought: string, tool: string, params: Record<string, any>) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'tool_call', thought, tool, params }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 need_clarification 类型的 LLM 响应
 */
function makeClarification(thought: string, question: string, options?: string[]) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'need_clarification', thought, question, options }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 error 类型的 LLM 响应
 */
function makeError(thought: string, error: string) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'error', thought, error }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 收集 agent 产生的所有事件
 */
async function collectEvents(agent: any, query: string) {
  const events: any[] = []
  for await (const event of agent.processInput(query)) {
    events.push(event)
  }
  return events
}

// ===================== 测试用例 =====================

describe('Agent', () => {
  let agent: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { Agent } = await import('../src/agent/agent.js')
    agent = await Agent.create({ apiKey: 'test-key' })
  })

  // ---------- final_answer 处理 ----------

  describe('final_answer 处理', () => {
    /**
     * 应该正确处理最终答案响应
     * 产生 thinking 和 response 事件
     */
    it('应该处理最终答案的响应', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('用户只是打招呼', '你好！有什么可以帮你的？'))

      const events = await collectEvents(agent, '你好')

      // 应该有思考事件
      expect(events.some(e => e.type === 'thinking')).toBe(true)
      // 应该有响应事件，包含答案
      expect(events.some(e => e.type === 'response' && e.content.includes('你好'))).toBe(true)
    })

    /**
     * 响应事件应该只产生一次
     */
    it('应该只产生一个响应事件', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      const events = await collectEvents(agent, 'test')

      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
    })
  })

  // ---------- 系统提示词注入 ----------

  describe('系统提示词注入', () => {
    /**
     * 系统提示词应该包含可用工具列表
     */
    it('应该注入系统提示词到消息中', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      await collectEvents(agent, 'test')

      const callArgs = mockChat.mock.calls[0][0]
      expect(callArgs[0].role).toBe('system')
      expect(callArgs[0].content).toContain('可用工具')
      expect(callArgs[0].content).toContain('lccode_json')
    })
  })

  // ---------- 思考内容输出 ----------

  describe('思考内容输出', () => {
    /**
     * LLM 原生思考应该作为 thinking 事件输出
     */
    it('应该支持思考内容输出', async () => {
      mockChat.mockResolvedValue({
        ...makeFinalAnswer('这是思考过程', '最终答案'),
        thinking: 'LLM 原生思考...',
      })

      const events = await collectEvents(agent, 'test')

      // 应该有 LLM 原生思考事件
      const thinkingEvents = events.filter(e => e.type === 'thinking')
      expect(thinkingEvents.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ---------- 工具调用 ----------

  describe('工具调用', () => {
    /**
     * 应该执行工具调用并返回结果
     * 第一次返回 tool_call，第二次返回 final_answer
     */
    it('应该执行工具调用并返回结果', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户想查看文件', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeFinalAnswer('已获得文件列表', '文件列表：file1.txt, file2.txt'))

      const events = await collectEvents(agent, '查看文件')

      // 应该有命令执行事件
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(1)
      expect(commandEvents[0].metadata?.success).toBe(true)

      // 应该有最终响应
      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
      expect(responseEvents[0].content).toContain('file1.txt')
    })

    /**
     * 工具不存在时应该返回错误消息给 LLM
     */
    it('应该处理工具不存在的情况', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('测试不存在的工具', 'nonexistent', { param: 'value' }))
        .mockResolvedValueOnce(makeFinalAnswer('工具不存在', '工具不存在'))

      const events = await collectEvents(agent, '测试')

      // 不应该有命令执行事件
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(0)
    })

    /**
     * 应该支持文件写入的工具调用
     */
    it('应该支持文件写入的工具调用', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户需要创建文件', 'write_file', { file_path: 'test.txt', content: 'Hello World' }))
        .mockResolvedValueOnce(makeFinalAnswer('文件创建成功', '文件已创建'))

      const events = await collectEvents(agent, '创建文件')

      // 应该有命令执行事件
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(1)
      expect(commandEvents[0].metadata?.success).toBe(true)
    })

    /**
     * 连续多次工具调用应该都被执行
     */
    it('应该支持连续多次工具调用', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('第一步', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeToolCall('第二步', 'execute_command', { command: 'pwd' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', '所有步骤完成'))

      const events = await collectEvents(agent, '多步操作')

      // 应该有两次命令执行事件
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(2)
    })
  })

  // ---------- need_clarification 处理 ----------

  describe('need_clarification 处理', () => {
    /**
     * 应该支持需要澄清的响应
     * 返回的问题应该包含选项
     */
    it('应该支持需要澄清的响应', async () => {
      mockChat.mockResolvedValue(makeClarification('用户请求比较模糊', '请确认你需要哪种操作？', ['查看文件', '执行命令']))

      const events = await collectEvents(agent, '帮我处理一下')

      // 应该有最终响应，包含澄清问题
      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
      expect(responseEvents[0].content).toContain('请确认')
    })

    /**
     * 不带选项的澄清也应该正常处理
     */
    it('应该支持不带选项的澄清', async () => {
      mockChat.mockResolvedValue(makeClarification('需要确认', '请具体说明'))

      const events = await collectEvents(agent, '帮我处理')

      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
    })
  })

  // ---------- error 处理 ----------

  describe('error 处理', () => {
    /**
     * 应该支持错误响应
     * 错误信息应该包含在响应中
     */
    it('应该支持错误响应', async () => {
      mockChat.mockResolvedValue(makeError('发生了错误', '文件不存在'))

      const events = await collectEvents(agent, '测试错误')

      // 应该有最终响应，包含错误信息
      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
      expect(responseEvents[0].content).toContain('错误')
    })
  })

  // ---------- 解析失败重试 ----------

  describe('解析失败重试', () => {
    /**
     * 缺少 thought 字段时应该重试
     * 第一次返回错误格式，第二次返回正确格式
     */
    it('应该拒绝没有 thought 字段的响应并重试', async () => {
      // 第一次返回没有 thought 字段的响应
      mockChat
        .mockResolvedValueOnce({
          response: `<lccode_json>\n${JSON.stringify({ type: 'final_answer', answer: '缺少thought' })}\n</lccode_json>`,
        })
        // 第二次返回正确的响应
        .mockResolvedValueOnce(makeFinalAnswer('修正后', '正确答案'))

      const events = await collectEvents(agent, '测试thought')

      // 应该有重试提示
      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
      expect(responseEvents[0].content).toContain('正确答案')
    })

    /**
     * JSON 语法错误时应该重试
     */
    it('应该处理 JSON 语法错误', async () => {
      mockChat
        .mockResolvedValueOnce({
          response: '<lccode_json>\n{ invalid json }\n</lccode_json>',
        })
        .mockResolvedValueOnce(makeFinalAnswer('修正', 'OK'))

      const events = await collectEvents(agent, 'test')

      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
    })
  })

  // ---------- 历史管理 ----------

  describe('历史管理', () => {
    /**
     * clearHistory 应该清空历史
     */
    it('清空历史后应该重新开始', () => {
      agent.clearHistory()
      expect(agent.chatHistory).toHaveLength(0)
    })

    /**
     * 对话历史应该在多轮对话中累积
     */
    it('对话历史应该在多轮对话中累积', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      await collectEvents(agent, '第一轮')
      await collectEvents(agent, '第二轮')

      // 历史应该包含两轮对话的消息
      expect(agent.chatHistory.length).toBeGreaterThan(0)
    })
  })

  // ---------- Token 使用统计 ----------

  describe('Token 使用统计', () => {
    /**
     * 应该产生 token_usage 事件
     */
    it('应该产生 token_usage 事件', async () => {
      mockChat.mockResolvedValue({
        ...makeFinalAnswer('测试', 'OK'),
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      })

      const events = await collectEvents(agent, 'test')

      // 应该有 token_usage 事件
      const tokenEvents = events.filter(e => e.type === 'token_usage')
      expect(tokenEvents.length).toBe(1)
      expect(tokenEvents[0].usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      })
    })
  })

  // ---------- 取消操作 ----------

  describe('取消操作', () => {
    /**
     * 调用 cancel 应该中止对话
     */
    it('应该支持取消对话', async () => {
      // 模拟一个会花费很长时间的 LLM 调用
      mockChat.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 100)
      }))

      // 启动对话后立即取消
      const gen = agent.processInput('test')
      agent.cancel()

      const events: any[] = []
      for await (const event of gen) {
        events.push(event)
      }

      // 应该有错误事件表示对话已取消
      expect(events.some(e => e.type === 'error' && e.content === '对话已取消')).toBe(true)
    })
  })
})
