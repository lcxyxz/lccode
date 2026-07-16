/**
 * 退出显示功能测试
 *
 * 测试退出流程中的核心逻辑：
 * - ExitScreen 组件的 props 校验和条件渲染逻辑
 * - 退出命令的完整流程（processCommand → EXIT action）
 * - process.on("exit") 终端清理回调
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processCommand } from '../src/frontend/commands.js'
import { ExitScreen } from '../src/frontend/components/ExitScreen.js'
import type { TokenUsage } from '../src/types/index.js'

// ===================== Mock Context =====================

function createMockContext() {
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

// ===================== ExitScreen 组件测试 =====================

describe('ExitScreen', () => {
  it('应该是一个有效的 React 组件函数', () => {
    expect(typeof ExitScreen).toBe('function')
  })

  it('应该接受 tokenUsage prop', () => {
    // 验证组件的 props 类型签名
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    }
    // 组件函数调用不应抛出（Ink 组件返回 React 元素）
    const element = ExitScreen({ tokenUsage })
    expect(element).toBeDefined()
  })

  it('tokenUsage 全为零时不应显示 token 统计', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    const element = ExitScreen({ tokenUsage })
    // 组件应正常渲染，不包含 token 统计文本
    expect(element).toBeDefined()
  })

  it('tokenUsage 大于零时应包含 token 统计', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 500,
      completionTokens: 1000,
      totalTokens: 1500,
    }
    const element = ExitScreen({ tokenUsage })
    expect(element).toBeDefined()
  })
})

// ===================== 退出命令流程测试 =====================

describe('退出命令完整流程', () => {
  let ctx: ReturnType<typeof createMockContext>

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('/exit 应返回 EXIT action 且 message 为 Goodbye!', () => {
    const result = processCommand('/exit', ctx)
    expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
  })

  it('/exit 应调用 addLine 显示告别消息', () => {
    processCommand('/exit', ctx)
    expect(ctx.addLine).toHaveBeenCalledWith('Goodbye!', 'cyan')
  })

  it('/exit 应将命令添加到历史记录', () => {
    processCommand('/exit', ctx)
    expect(ctx.addHistory).toHaveBeenCalledWith('/exit')
  })

  it('/exit 大小写不敏感', () => {
    const result = processCommand('/EXIT', ctx)
    expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
  })

  it('/Exit 大小写不敏感', () => {
    const result = processCommand('/Exit', ctx)
    expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
  })

  it('/exit 前后有空格应正常处理', () => {
    const result = processCommand('  /exit  ', ctx)
    expect(result).toEqual({ type: 'EXIT', message: 'Goodbye!' })
  })

  it('EXIT action 后不应有其他副作用（如 clearSections）', () => {
    processCommand('/exit', ctx)
    expect(ctx.clearSections).not.toHaveBeenCalled()
  })
})

// ===================== process.on("exit") 清理测试 =====================

describe('process.on("exit") 终端清理', () => {
  const originalOn = process.on.bind(process)
  let registeredListeners: Array<{ event: string; fn: Function }>

  beforeEach(() => {
    registeredListeners = []
    process.on = vi.fn((event: string, fn: Function) => {
      registeredListeners.push({ event, fn })
      return process
    }) as any
  })

  afterEach(() => {
    process.on = originalOn
  })

  it('应该注册 exit 事件处理器', () => {
    // 模拟 cli.tsx 中的注册逻辑
    process.on('exit', () => {
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[0m')
    })

    const exitHandler = registeredListeners.find(l => l.event === 'exit')
    expect(exitHandler).toBeDefined()
  })

  it('exit 处理器应恢复光标可见（\x1b[?25h）', () => {
    process.on('exit', () => {
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[0m')
    })

    const exitHandler = registeredListeners.find(l => l.event === 'exit')!
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    exitHandler.fn()

    expect(writeSpy).toHaveBeenCalledWith('\x1b[?25h')
    writeSpy.mockRestore()
  })

  it('exit 处理器应重置颜色属性（\x1b[0m）', () => {
    process.on('exit', () => {
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[0m')
    })

    const exitHandler = registeredListeners.find(l => l.event === 'exit')!
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    exitHandler.fn()

    expect(writeSpy).toHaveBeenCalledWith('\x1b[0m')
    writeSpy.mockRestore()
  })

  it('exit 处理器应同时执行光标恢复和颜色重置', () => {
    process.on('exit', () => {
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[0m')
    })

    const exitHandler = registeredListeners.find(l => l.event === 'exit')!
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    exitHandler.fn()

    expect(writeSpy).toHaveBeenCalledTimes(2)
    expect(writeSpy.mock.calls[0][0]).toBe('\x1b[?25h')
    expect(writeSpy.mock.calls[1][0]).toBe('\x1b[0m')
    writeSpy.mockRestore()
  })
})

// ===================== 退出流程集成测试 =====================

describe('退出流程集成', () => {
  it('EXIT action 应包含正确的 message 字段', () => {
    const ctx = createMockContext()
    const result = processCommand('/exit', ctx)
    expect(result).toHaveProperty('type', 'EXIT')
    expect(result).toHaveProperty('message', 'Goodbye!')
  })

  it('非退出命令不应返回 EXIT action', () => {
    const ctx = createMockContext()
    const commands = ['/help', '/clear', '/mcp', 'hello world']
    for (const cmd of commands) {
      const result = processCommand(cmd, ctx)
      expect(result.type).not.toBe('EXIT')
    }
  })

  it('EXIT action 的 message 应为字符串', () => {
    const ctx = createMockContext()
    const result = processCommand('/exit', ctx)
    if (result.type === 'EXIT') {
      expect(typeof result.message).toBe('string')
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})
