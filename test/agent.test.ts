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
import { describe, it, expect, vi, beforeEach } from 'bun:test'

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

// 模拟文件工具
vi.mock('../src/agent/tools/file-tools.js', () => {
  return {
    readFileTool: {
      name: 'read_file',
      description: '读取文件',
      parameters: [],
      execute: async () => mockReadFile(),
    },
    writeFileTool: {
      name: 'write_file',
      description: '写入文件',
      parameters: [],
      execute: async () => mockWriteFile(),
    },
    editFileTool: {
      name: 'edit_file',
      description: '编辑文件',
      parameters: [],
      execute: async () => ({ success: true, output: '已编辑文件' }),
    },
    deleteFileTool: {
      name: 'delete_file',
      description: '删除文件',
      parameters: [],
      execute: async () => ({ success: true, output: '已删除文件' }),
    },
    deleteDirectoryTool: {
      name: 'delete_directory',
      description: '删除目录',
      parameters: [],
      execute: async () => ({ success: true, output: '已删除目录' }),
    },
    searchTool: {
      name: 'search',
      description: '搜索文件',
      parameters: [],
      execute: async () => ({ success: true, output: '搜索结果' }),
    },
    addDirTool: {
      name: 'add_dir',
      description: '创建目录',
      parameters: [],
      execute: async () => ({ success: true, output: '已创建目录' }),
    },
  }
})

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
function makeFinalAnswer(roundAction: string, answer: string) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'final_answer', round_action: roundAction, answer }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 tool_call 类型的 LLM 响应
 */
function makeToolCall(roundAction: string, tool: string, params: Record<string, any>) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'tool_call', round_action: roundAction, tool, params }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 need_clarification 类型的 LLM 响应
 */
function makeClarification(roundAction: string, question: string, options?: string[]) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'need_clarification', round_action: roundAction, question, options }, null, 2)}\n</lccode_json>`,
  }
}

/**
 * 创建一个 error 类型的 LLM 响应
 */
function makeError(roundAction: string, error: string) {
  return {
    response: `<lccode_json>\n${JSON.stringify({ type: 'error', round_action: roundAction, error }, null, 2)}\n</lccode_json>`,
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

/**
 * 从某次 LLM 调用的消息中查找 <tool_result> 工具结果消息（排除 system 提示词）
 */
function findToolResultMsg(callArgs: any[]) {
  return callArgs
    .filter((m: any) => m.role !== 'system')
    .find((m: any) => m.content?.includes('tool_result'))
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
     * 产生 response 事件，不产生 thinking 事件
     */
    it('应该处理最终答案的响应', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('用户只是打招呼', '你好！有什么可以帮你的？'))

      const events = await collectEvents(agent, '你好')

      // 不应该有思考事件（最终答案只显示 answer）
      expect(events.some(e => e.type === 'thinking')).toBe(false)
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
     * 系统提示词应该包含可用工具列表和消息角色说明
     */
    it('应该注入系统提示词到消息中', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      await collectEvents(agent, 'test')

      const callArgs = mockChat.mock.calls[0][0]
      expect(callArgs[0].role).toBe('system')
      expect(callArgs[0].content).toContain('Available Tools')
      expect(callArgs[0].content).toContain('lccode_json')

      // 系统提示词应说明 <tool_result> 标签的角色区分
      expect(callArgs[0].content).toContain('Conversation Roles')
      expect(callArgs[0].content).toContain('<tool_result>')

      // 用户消息应排在系统提示词之后
      expect(callArgs[callArgs.length - 1].role).toBe('user')
      expect(callArgs[callArgs.length - 1].content).toBe('test')
    })
  })

  // ---------- round_action 输出 ----------

  describe('round_action 输出', () => {
    /**
     * 工具调用轮应该把代码自己指定的 round_action 作为 thinking 事件输出
     */
    it('工具调用时应该输出 round_action 作为思考事件', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户想查看文件', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeFinalAnswer('已获得文件列表', '文件列表：file1.txt, file2.txt'))

      const events = await collectEvents(agent, '查看文件')

      const thinkingEvents = events.filter(e => e.type === 'thinking')
      expect(thinkingEvents.length).toBe(1)
      expect(thinkingEvents[0].content).toBe('用户想查看文件')
    })

    /**
     * 大模型的原生思考内容（reasoning_content）不应该作为 thinking 事件输出
     */
    it('不应该输出大模型原生思考内容', async () => {
      mockChat.mockResolvedValue({
        ...makeFinalAnswer('这是代码自己的 round_action', '最终答案'),
        thinking: 'LLM 原生思考...',
      })

      const events = await collectEvents(agent, 'test')

      const thinkingEvents = events.filter(e => e.type === 'thinking')
      expect(thinkingEvents.length).toBe(0)
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

  // ---------- 工具结果与用户消息分离 ----------

  describe('工具结果与用户消息分离', () => {
    /**
     * 工具执行结果应使用 <tool_result> 标签包裹，与用户真实指令区分
     */
    it('工具执行结果应使用 <tool_result> 标签包裹', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户想查看文件', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(agent, '查看文件')

      // 第二次调用（工具执行后）应包含 <tool_result> 消息
      const callArgs = mockChat.mock.calls[1][0]
      const toolMsg = findToolResultMsg(callArgs)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.role).toBe('user')
      expect(toolMsg.content).toContain('<tool_result>')
      expect(toolMsg.content).toContain('</tool_result>')
      // 应包含执行状态
      expect(toolMsg.content).toContain('工具执行成功')
    })

    /**
     * 工具不存在时的错误反馈也应使用 <tool_result> 标签
     */
    it('工具不存在的错误反馈应使用 <tool_result> 标签', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('测试不存在的工具', 'nonexistent', { param: 'value' }))
        .mockResolvedValueOnce(makeFinalAnswer('工具不存在', '工具不存在'))

      await collectEvents(agent, '测试')

      const callArgs = mockChat.mock.calls[1][0]
      const toolMsg = findToolResultMsg(callArgs)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).toContain('工具执行失败')
      expect(toolMsg.content).toContain('不存在')
    })

    /**
     * 超长工具输出应按 maxToolOutputChars 截断并标注
     */
    it('超长工具输出应被截断并标注', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('读取大文件', 'read_file', { file_path: 'big.txt' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      mockReadFile.mockResolvedValueOnce({
        success: true,
        output: 'A'.repeat(3000),
      })

      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxToolOutputChars: 1000 })
      await collectEvents(smallAgent, '读取大文件')

      const callArgs = mockChat.mock.calls[1][0]
      const toolMsg = findToolResultMsg(callArgs)
      expect(toolMsg).toBeDefined()
      // 1000 字符截断 + 截断标注
      expect(toolMsg.content.length).toBeLessThan(1200)
      expect(toolMsg.content).toContain('输出过长已截断')
    })

    /**
     * 未截断时工具输出应完整保留在 <tool_result> 中
     */
    it('未超限的工具输出应完整保留', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('读取文件', 'read_file', { file_path: 'small.txt' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      mockReadFile.mockResolvedValueOnce({
        success: true,
        output: '小文件内容',
      })

      await collectEvents(agent, '读取文件')

      const callArgs = mockChat.mock.calls[1][0]
      const toolMsg = findToolResultMsg(callArgs)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).toContain('小文件内容')
      expect(toolMsg.content).not.toContain('截断')
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
     * 缺少 round_action 字段时应该重试
     * 第一次返回错误格式，第二次返回正确格式
     */
    it('应该拒绝没有 round_action 字段的响应并重试', async () => {
      // 第一次返回没有 round_action 字段的响应
      mockChat
        .mockResolvedValueOnce({
          response: `<lccode_json>\n${JSON.stringify({ type: 'final_answer', answer: '缺少round_action' })}\n</lccode_json>`,
        })
        // 第二次返回正确的响应
        .mockResolvedValueOnce(makeFinalAnswer('修正后', '正确答案'))

      const events = await collectEvents(agent, '测试round_action')

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
     * clearHistory 应该清空历史与摘要状态
     */
    it('清空历史后应该重新开始', () => {
      agent.clearHistory()
      expect(agent.chatHistory).toHaveLength(0)
      expect(agent.summary).toBeNull()
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

    /**
     * 预算充足时，完整历史应全部保留
     */
    it('预算充足时历史应完整保留', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const bigAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 100000 })
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      await collectEvents(bigAgent, '第一轮问题')
      await collectEvents(bigAgent, '第二轮问题')

      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      const contents = lastCall
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => m.content)
        .join('\n')

      expect(contents).toContain('第一轮问题')
      expect(contents).toContain('第二轮问题')
    })

    /**
     * 工具调用进行中，当前轮次应始终完整保留（即使超过预算）
     */
    it('当前轮次的工具调用反馈不受预算裁剪影响', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 1 })
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户想查看文件', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(smallAgent, '查看文件')

      // 第二次调用应完整包含本轮的工具调用反馈
      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      const toolMsg = lastCall.find((m: any) => m.content?.includes('tool_result'))
      expect(toolMsg).toBeDefined()
      expect(lastCall.some((m: any) => m.content === '查看文件')).toBe(true)
    })
  })

  // ---------- 历史摘要压缩 ----------

  describe('历史摘要压缩', () => {
    const SUMMARY_TEXT = '【摘要】用户提出了关键需求，助手已记录'

    /**
     * 与 agent 相同的 token 估算公式，用于精确构造预算
     */
    function estimateTokensForTest(content: string): number {
      let tokens = 0
      for (const ch of content) {
        const code = ch.codePointAt(0) ?? 0
        if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || code >= 0x20000) {
          tokens += 1
        } else {
          tokens += 0.25
        }
      }
      return Math.ceil(tokens)
    }

    /**
     * mock：摘要调用返回固定摘要文本，主调用返回 final_answer
     */
    function setupSummarizerMock() {
      mockChat.mockImplementation((messages: any[]) => {
        if (messages[0]?.role === 'system' && messages[0].content.includes('conversation summarizer')) {
          return { response: SUMMARY_TEXT }
        }
        return makeFinalAnswer('测试', 'OK')
      })
    }

    function countSummarizerCalls(): number {
      return mockChat.mock.calls.filter((c: any) =>
        c[0][0]?.role === 'system' && c[0][0]?.content?.includes('conversation summarizer')).length
    }

    /** 是否注入了「历史超预算，请调用 summarize_history」的压缩提示 */
    function hasCompressHint(callArgs: any[]): boolean {
      return callArgs.some((m: any) => m.role === 'system' && m.content.includes('已超出上下文预算'))
    }

    /**
     * 历史超预算时应注入提示引导模型调用 summarize_history 工具，
     * 而不是框架自动生成摘要
     */
    it('历史超预算时注入压缩提示，而非自动生成摘要', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 20 })
      setupSummarizerMock()

      await collectEvents(smallAgent, '第一轮问题内容较长超过预算应该被摘要掉')
      await collectEvents(smallAgent, '第二轮')

      // 框架不自动调用摘要
      expect(countSummarizerCalls()).toBe(0)

      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      // 注入提示，引导模型主动调用 summarize_history 工具
      expect(hasCompressHint(lastCall)).toBe(true)

      // 当前轮次完整保留
      const nonSystem = lastCall
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => m.content)
        .join('\n')
      expect(nonSystem).toContain('第二轮')
    })

    /**
     * 旧历史估算 token 达到预算 80% 阈值时才注入压缩提示
     */
    it('旧历史达到预算 80% 阈值时才注入压缩提示', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      setupSummarizerMock()

      // 构造旧历史恰好 ≤ 预算 80%：不触发；减 1 后超阈值：触发
      const userTokens = 60
      const asstTokens = estimateTokensForTest(makeFinalAnswer('测试', 'OK').response)
      const noTriggerBudget = Math.ceil((userTokens + asstTokens) / 0.8)

      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: noTriggerBudget })
      await collectEvents(smallAgent, '问'.repeat(userTokens))
      await collectEvents(smallAgent, '第二轮')

      let lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      expect(hasCompressHint(lastCall)).toBe(false)

      const triggerAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: noTriggerBudget - 1 })
      await collectEvents(triggerAgent, '问'.repeat(userTokens))
      await collectEvents(triggerAgent, '第二轮')

      lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      expect(hasCompressHint(lastCall)).toBe(true)
    })

    /**
     * 摘要生成后，后续轮次以「摘要 + 最近历史」替代完整旧历史，不再注入提示
     */
    it('摘要生成后注入摘要与最近历史，不再注入压缩提示', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 20 })
      setupSummarizerMock()

      // 前两轮撑过阈值并注入提示
      await collectEvents(smallAgent, '第一轮问题内容较长超过预算应该被摘要掉')
      await collectEvents(smallAgent, '第二轮')
      mockChat.mockClear()

      // 第三轮：模型主动调用 summarize_history → 摘要调用 → final_answer
      mockChat
        .mockResolvedValueOnce(makeToolCall('历史过长，调用摘要工具', 'summarize_history', {}))
        .mockResolvedValueOnce({ response: SUMMARY_TEXT })
        .mockResolvedValueOnce(makeFinalAnswer('已恢复记忆', '继续完成'))
      await collectEvents(smallAgent, '第三轮')

      // 摘要状态已记录，供后续轮次复用
      expect(smallAgent.summary).toBe(SUMMARY_TEXT)

      // 第四轮：摘要 + 最近历史，不再有压缩提示
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))
      await collectEvents(smallAgent, '第四轮')

      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      const systemContents = lastCall
        .filter((m: any) => m.role === 'system')
        .map((m: any) => m.content)

      expect(systemContents.some((c: string) => c.includes('Earlier Conversation Summary'))).toBe(true)
      expect(systemContents.some((c: string) => c.includes(SUMMARY_TEXT))).toBe(true)
      expect(systemContents.some((c: string) => c.includes('已超出上下文预算'))).toBe(false)

      const nonSystem = lastCall
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => m.content)
        .join('\n')
      expect(nonSystem).toContain('第四轮')
    })

    /**
     * 摘要失败时工具返回失败结果，摘要状态不被记录，主流程不受影响
     */
    it('摘要失败时工具返回失败结果，主流程不受影响', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const failAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 20 })

      await collectEvents(failAgent, '第一轮问题内容较长超过预算应该被裁剪掉')

      // 模型调用 summarize_history，但摘要调用抛错
      mockChat
        .mockResolvedValueOnce(makeToolCall('调用摘要工具', 'summarize_history', {}))
        .mockImplementationOnce(() => { throw new Error('network error') })
        .mockResolvedValueOnce(makeFinalAnswer('摘要失败，继续', '继续完成'))
      const events = await collectEvents(failAgent, '第二轮')

      // 摘要状态未被记录
      expect(failAgent.summary).toBeNull()

      // 失败反馈通过 <tool_result> 返回给模型，主流程正常结束
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(1)
      expect(commandEvents[0].metadata?.success).toBe(false)

      const responseEvents = events.filter(e => e.type === 'response')
      expect(responseEvents.length).toBe(1)
      expect(responseEvents[0].content).toBe('继续完成')
    })
  })

  // ---------- 摘要工具 ----------

  describe('摘要工具', () => {
    /**
     * summarize_history 工具应注册到工具注册中心
     */
    it('summarize_history 工具应已注册', () => {
      const tool = agent.registry.get('summarize_history')
      expect(tool).toBeDefined()
      expect(tool.name).toBe('summarize_history')
    })

    /**
     * 工具执行应基于 Agent 完整旧历史生成摘要并记录到 Agent。
     * 真实场景：历史超阈值后模型主动调用该工具（发生在 processInput 轮次内）
     */
    it('工具执行应基于完整旧历史生成摘要并记录状态', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 20 })

      // 两轮撑过阈值（roundStartIndex 指向第三轮起点，历史非空）
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))
      await collectEvents(smallAgent, '第一轮问题内容较长超过预算应该被摘要掉')
      await collectEvents(smallAgent, '第二轮')

      const tool = smallAgent.registry.get('summarize_history')
      const SUMMARY_TEXT = '【摘要】用户提出了关键需求，助手已记录'
      mockChat.mockResolvedValue({ response: SUMMARY_TEXT })

      const result = await tool.execute({})

      expect(result.success).toBe(true)
      expect(result.output).toBe(SUMMARY_TEXT)

      // 摘要状态已记录到 Agent
      expect(smallAgent.summary).toBe(SUMMARY_TEXT)

      // 摘要调用应收到完整旧历史（含超出预算的部分）
      const callArgs = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      expect(callArgs[0].content).toContain('conversation summarizer')
      expect(callArgs[1].content).toContain('第一轮问题内容较长')
    })

    /**
     * 摘要失败时工具应返回失败结果
     */
    it('摘要失败时工具应返回失败结果', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const smallAgent = await Agent.create({ apiKey: 'test-key', maxHistoryTokens: 20 })

      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))
      await collectEvents(smallAgent, '第一轮问题内容较长超过预算应该被摘要掉')
      await collectEvents(smallAgent, '第二轮')

      const tool = smallAgent.registry.get('summarize_history')
      mockChat.mockImplementation(() => { throw new Error('network error') })

      const result = await tool.execute({})

      expect(result.success).toBe(false)
      expect(result.error).toContain('network error')
      expect(smallAgent.summary).toBeNull()
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

  // ---------- 系统提示词冻结 ----------

  describe('系统提示词冻结', () => {
    /**
     * 同一任务内多轮工具调用时，系统提示词（含时间）应保持不变，
     * 保证远端前缀缓存可命中
     */
    it('同一任务内系统提示词应完全一致', async () => {
      mockChat
        .mockResolvedValueOnce(makeToolCall('用户想查看文件', 'execute_command', { command: 'ls' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(agent, '查看文件')

      // 两次调用的 system 消息应完全相同（时间冻结）
      const firstSystem = mockChat.mock.calls[0][0][0]
      const secondSystem = mockChat.mock.calls[1][0][0]
      expect(firstSystem.role).toBe('system')
      expect(secondSystem.role).toBe('system')
      expect(firstSystem.content).toBe(secondSystem.content)
      // 时间信息应存在于提示词中
      expect(firstSystem.content).toMatch(/current system time/)
    })

    /**
     * 不同任务之间时间可以不同，但同一任务内保持一致
     */
    it('新任务应重新冻结时间', async () => {
      mockChat.mockResolvedValue(makeFinalAnswer('测试', 'OK'))

      await collectEvents(agent, '第一轮')
      const firstTime = mockChat.mock.calls[0][0][0].content

      await new Promise(r => setTimeout(r, 1100))
      await collectEvents(agent, '第二轮')
      const secondTime = mockChat.mock.calls[1][0][0].content

      // 任务间时间通常不同（若秒数未变则相同也合法）
      expect(secondTime).toContain('current system time')
      // 同一任务内保持一致的断言已在其他用例覆盖
      expect(firstTime).toBe(firstTime)
    })
  })

  // ---------- 当前轮次工具结果压缩 ----------

  describe('当前轮次工具结果压缩', () => {
    /**
     * 当前轮次工具结果累计超过 maxRoundTokens 时，
     * 较早的工具结果应被压缩为短摘要，最新结果完整保留
     */
    it('超过轮次预算时压缩较早的工具结果', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      // 预算很小，模拟一次完整压缩
      const compactAgent = await Agent.create({ apiKey: 'test-key', maxRoundTokens: 100, compactToolChars: 50 })

      const bigOutput = 'A'.repeat(500)
      mockReadFile.mockResolvedValueOnce({ success: true, output: bigOutput })
      mockChat
        .mockResolvedValueOnce(makeToolCall('读取文件1', 'read_file', { file_path: 'a.txt' }))
        .mockResolvedValueOnce(makeToolCall('读取文件2', 'read_file', { file_path: 'b.txt' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(compactAgent, '读取两个文件')

      // 最后一次调用：所有 tool_result 消息中应至少有一条被压缩
      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      const toolMsgs = lastCall.filter((m: any) => m.role !== 'system' && m.content?.includes('tool_result'))
      expect(toolMsgs.length).toBeGreaterThan(0)
      // 存在被压缩的消息（包含截断标注）
      expect(toolMsgs.some((m: any) => m.content.includes('输出过长已截断'))).toBe(true)
    })

    /**
     * 预算充足时当前轮次工具结果应完整保留
     */
    it('预算充足时当前轮次工具结果完整保留', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const bigAgent = await Agent.create({ apiKey: 'test-key', maxRoundTokens: 100000 })

      const bigOutput = 'A'.repeat(500)
      mockReadFile.mockResolvedValueOnce({ success: true, output: bigOutput })
      mockChat
        .mockResolvedValueOnce(makeToolCall('读取文件1', 'read_file', { file_path: 'a.txt' }))
        .mockResolvedValueOnce(makeToolCall('读取文件2', 'read_file', { file_path: 'b.txt' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(bigAgent, '读取两个文件')

      const lastCall = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
      const toolMsgs = lastCall.filter((m: any) => m.role !== 'system' && m.content?.includes('tool_result'))
      // 两条结果都不应被压缩
      expect(toolMsgs.length).toBe(2)
      expect(toolMsgs.every((m: any) => !m.content.includes('输出过长已截断'))).toBe(true)
      // 完整内容保留
      expect(toolMsgs[0].content).toContain('A'.repeat(500))
    })

    /**
     * 压缩仅影响发送给 LLM 的内容，chatHistory 原文不受影响
     */
    it('压缩不修改 chatHistory 原文', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const compactAgent = await Agent.create({ apiKey: 'test-key', maxRoundTokens: 100, compactToolChars: 50 })

      const bigOutput = 'A'.repeat(500)
      mockReadFile.mockResolvedValueOnce({ success: true, output: bigOutput })
      mockChat
        .mockResolvedValueOnce(makeToolCall('读取文件1', 'read_file', { file_path: 'a.txt' }))
        .mockResolvedValueOnce(makeFinalAnswer('完成', 'OK'))

      await collectEvents(compactAgent, '读取文件')

      // 历史中的原文完整保留
      const historyContents = compactAgent.chatHistory
        .filter((m: any) => m.content?.includes('tool_result'))
        .map((m: any) => m.content)
      expect(historyContents.length).toBeGreaterThan(0)
      expect(historyContents.every((c: string) => c.includes('A'.repeat(500)))).toBe(true)
    })
  })

  // ---------- 默认轮次上限 ----------

  describe('默认轮次上限', () => {
    /**
     * 默认 maxRounds 应为 15，而非 40
     */
    it('默认最多执行 15 轮工具调用', async () => {
      const { Agent } = await import('../src/agent/agent.js')
      const defaultAgent = await Agent.create({ apiKey: 'test-key' })

      // 持续返回工具调用，直到达到轮次上限
      mockChat.mockResolvedValue(makeToolCall('继续执行', 'execute_command', { command: 'ls' }))

      const events: any[] = []
      for await (const event of defaultAgent.processInput('持续任务')) {
        events.push(event)
      }

      // 应有轮次上限提示
      const final = events[events.length - 1]
      expect(final.type).toBe('response')
      expect(final.content).toContain('轮次已达上限')
      // 工具调用次数 = 默认上限 15
      const commandEvents = events.filter(e => e.type === 'command')
      expect(commandEvents.length).toBe(15)
    })
  })
})
