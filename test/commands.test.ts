/**
 * 命令处理测试
 *
 * 测试 src/frontend/commands.ts 中的命令处理逻辑：
 * - processCommand: 处理用户输入的命令
 * - 斜杠命令: /exit, /help, /clear, /mcp
 * - 非斜杠命令: 作为 LLM 查询
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processCommand, SLASH_COMMANDS, COMMANDS } from '../src/frontend/commands.js'
import type { CommandContext } from '../src/frontend/commands.js'

// ===================== Mock Context =====================

/**
 * 创建一个 mock 命令上下文
 * 记录所有回调调用，用于验证
 */
function createMockContext(): CommandContext & {
  calls: {
    addLine: Array<[string, string?]>
    addHistory: string[]
    clearSections: number
  }
} {
  const ctx = {
    calls: {
      addLine: [] as Array<[string, string?]>,
      addHistory: [] as string[],
      clearSections: 0,
    },
    addLine: vi.fn((content: string, color?: string) => {
      ctx.calls.addLine.push([content, color])
    }),
    addHistory: vi.fn((cmd: string) => {
      ctx.calls.addHistory.push(cmd)
    }),
    clearSections: vi.fn(() => {
      ctx.calls.clearSections++
    }),
  }
  return ctx
}

// ===================== 测试用例 =====================

describe('processCommand', () => {
  let ctx: ReturnType<typeof createMockContext>

  beforeEach(() => {
    ctx = createMockContext()
  })

  // ---------- 空输入 ----------

  describe('空输入', () => {
    /**
     * 空字符串应该返回 CONTINUE，不执行任何操作
     */
    it('空字符串应该返回 CONTINUE', () => {
      const result = processCommand('', ctx)
      expect(result).toEqual({ type: 'CONTINUE' })
      // 不应该调用任何回调
      expect(ctx.addHistory).not.toHaveBeenCalled()
      expect(ctx.addLine).not.toHaveBeenCalled()
    })

    /**
     * 只有空格的输入也应该被视为空输入
     */
    it('只有空格的输入应该返回 CONTINUE', () => {
      const result = processCommand('   ', ctx)
      expect(result).toEqual({ type: 'CONTINUE' })
    })
  })

  // ---------- /exit 命令 ----------

  describe('/exit 命令', () => {
    /**
     * /exit 应该返回 EXIT 动作
     */
    it('应该返回 EXIT 动作', () => {
      const result = processCommand('/exit', ctx)
      expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
    })

    /**
     * /exit 应该显示告别消息
     */
    it('应该显示告别消息', () => {
      processCommand('/exit', ctx)
      expect(ctx.addLine).toHaveBeenCalledWith('Goodbye!', 'cyan')
    })

    /**
     * /exit 应该将命令添加到历史
     */
    it('应该将命令添加到历史', () => {
      processCommand('/exit', ctx)
      expect(ctx.addHistory).toHaveBeenCalledWith('/exit')
    })
  })

  // ---------- /help 命令 ----------

  describe('/help 命令', () => {
    /**
     * /help 应该返回 CONTINUE 动作
     */
    it('应该返回 CONTINUE 动作', () => {
      const result = processCommand('/help', ctx)
      expect(result).toEqual({ type: 'CONTINUE' })
    })

    /**
     * /help 应该显示帮助文本
     */
    it('应该显示帮助文本', () => {
      processCommand('/help', ctx)
      expect(ctx.addLine).toHaveBeenCalledWith(COMMANDS['help'], 'magenta')
    })

    /**
     * 帮助文本应该包含所有可用命令
     */
    it('帮助文本应该包含所有命令', () => {
      expect(COMMANDS['help']).toContain('/exit')
      expect(COMMANDS['help']).toContain('/help')
      expect(COMMANDS['help']).toContain('/clear')
      expect(COMMANDS['help']).toContain('/mcp')
      expect(COMMANDS['help']).toContain('/skill')
    })
  })

  // ---------- /clear 命令 ----------

  describe('/clear 命令', () => {
    /**
     * /clear 应该返回 CONTINUE 动作
     */
    it('应该返回 CONTINUE 动作', () => {
      const result = processCommand('/clear', ctx)
      expect(result).toEqual({ type: 'CONTINUE' })
    })

    /**
     * /clear 应该调用 clearSections
     */
    it('应该调用 clearSections', () => {
      processCommand('/clear', ctx)
      expect(ctx.clearSections).toHaveBeenCalled()
    })
  })

  // ---------- /mcp 命令 ----------

  describe('/mcp 命令', () => {
    /**
     * /mcp 应该返回 MCP_ACTION 动作
     */
    it('应该返回 MCP_ACTION 动作', () => {
      const result = processCommand('/mcp', ctx)
      expect(result).toEqual({ type: 'MCP_ACTION', args: [] })
    })

    /**
     * /mcp list 应该传递参数
     */
    it('应该传递参数', () => {
      const result = processCommand('/mcp list', ctx)
      expect(result).toEqual({ type: 'MCP_ACTION', args: ['list'] })
    })

    /**
     * /mcp 1,2 应该传递多个参数
     */
    it('应该传递多个参数', () => {
      const result = processCommand('/mcp 1,2', ctx)
      expect(result).toEqual({ type: 'MCP_ACTION', args: ['1,2'] })
    })
  })

  // ---------- 未知斜杠命令 ----------

  describe('未知斜杠命令', () => {
    /**
     * 未知的斜杠命令应该显示"command not found"
     */
    it('应该显示 command not found', () => {
      const result = processCommand('/unknown', ctx)
      expect(result).toEqual({ type: 'CONTINUE' })
      expect(ctx.addLine).toHaveBeenCalledWith('bash: /unknown: command not found', 'white')
    })
  })

  // ---------- 非斜杠命令（LLM 查询） ----------

  describe('非斜杠命令', () => {
    /**
     * 普通文本应该作为 LLM 查询
     */
    it('应该返回 LLM_QUERY 动作', () => {
      const result = processCommand('帮我看看代码', ctx)
      expect(result).toEqual({ type: 'LLM_QUERY', query: '帮我看看代码' })
    })

    /**
     * 应该将命令添加到历史
     */
    it('应该将命令添加到历史', () => {
      processCommand('帮我看看代码', ctx)
      expect(ctx.addHistory).toHaveBeenCalledWith('帮我看看代码')
    })

    /**
     * 应该显示输入的命令
     */
    it('应该显示输入的命令', () => {
      processCommand('帮我看看代码', ctx)
      expect(ctx.addLine).toHaveBeenCalledWith('$ 帮我看看代码', 'yellow')
    })

    /**
     * 命令前后的空格应该被 trim
     */
    it('应该 trim 命令', () => {
      const result = processCommand('  帮我看看代码  ', ctx)
      expect(result).toEqual({ type: 'LLM_QUERY', query: '帮我看看代码' })
    })
  })

  // ---------- 命令大小写不敏感 ----------

  describe('命令大小写', () => {
    /**
     * 斜杠命令应该是大小写不敏感的
     */
    it('EXIT 和 /exit 应该等效', () => {
      const result = processCommand('/EXIT', ctx)
      expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
    })
  })
})

// ===================== 常量测试 =====================

describe('SLASH_COMMANDS', () => {
  /**
   * 斜杠命令列表应该包含所有支持的命令
   */
  it('应该包含所有支持的斜杠命令', () => {
    expect(SLASH_COMMANDS).toContain('/exit')
    expect(SLASH_COMMANDS).toContain('/help')
    expect(SLASH_COMMANDS).toContain('/clear')
    expect(SLASH_COMMANDS).toContain('/mcp')
  })

  /**
   * 斜杠命令应该以 / 开头
   */
  it('所有命令应该以 / 开头', () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.startsWith('/')).toBe(true)
    }
  })
})
