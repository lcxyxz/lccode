/**
 * 工具注册中心测试
 *
 * 测试 src/agent/tools/tool-registry.ts 中的 ToolRegistry 类：
 * - register: 注册工具
 * - unregister: 注销工具
 * - get: 获取工具
 * - getAll: 获取所有工具
 * - setActiveFilter / getActiveFilter: 工具过滤器
 * - formatToolDescriptions: 生成工具描述文本
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry, type Tool, type ToolResult } from '../src/agent/tools/tool-registry.js'

// ===================== 辅助函数 =====================

/**
 * 创建一个测试用的 mock 工具
 */
function createMockTool(name: string, description = `${name} 工具`): Tool {
  return {
    name,
    description,
    parameters: [
      { name: 'param1', type: 'string', description: '参数1', required: true },
      { name: 'param2', type: 'number', description: '参数2', required: false },
    ],
    execute: async (params): Promise<ToolResult> => ({
      success: true,
      output: `执行 ${name} 完成`,
    }),
  }
}

/**
 * 创建一个 MCP 工具（以 mcp__ 为前缀）
 */
function createMockMcpTool(serverName: string, toolName: string): Tool {
  return createMockTool(`mcp__${serverName}__${toolName}`, `MCP 工具 ${toolName}`)
}

// ===================== 测试用例 =====================

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  // 每个测试前创建新的 registry 实例
  beforeEach(() => {
    registry = new ToolRegistry()
  })

  // ---------- 基本 CRUD 操作 ----------

  describe('register 和 get', () => {
    /**
     * 注册工具后应该能通过 name 获取到
     */
    it('应该注册并获取工具', () => {
      const tool = createMockTool('test_tool')
      registry.register(tool)

      const retrieved = registry.get('test_tool')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('test_tool')
      expect(retrieved?.description).toBe('test_tool 工具')
    })

    /**
     * 获取不存在的工具应该返回 undefined
     */
    it('获取不存在的工具应该返回 undefined', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    /**
     * 同名工具应该被覆盖
     */
    it('重复注册同名工具应该覆盖', () => {
      const tool1 = createMockTool('test_tool', '版本1')
      const tool2 = createMockTool('test_tool', '版本2')

      registry.register(tool1)
      registry.register(tool2)

      const retrieved = registry.get('test_tool')
      expect(retrieved?.description).toBe('版本2')
    })
  })

  describe('unregister', () => {
    /**
     * 注销存在的工具应该返回 true
     */
    it('应该成功注销存在的工具', () => {
      registry.register(createMockTool('test_tool'))
      const result = registry.unregister('test_tool')

      expect(result).toBe(true)
      expect(registry.get('test_tool')).toBeUndefined()
    })

    /**
     * 注销不存在的工具应该返回 false
     */
    it('注销不存在的工具应该返回 false', () => {
      const result = registry.unregister('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('getAll', () => {
    /**
     * 空 registry 应该返回空数组
     */
    it('空 registry 应该返回空数组', () => {
      expect(registry.getAll()).toEqual([])
    })

    /**
     * 应该返回所有已注册的工具
     */
    it('应该返回所有已注册的工具', () => {
      registry.register(createMockTool('tool1'))
      registry.register(createMockTool('tool2'))
      registry.register(createMockTool('tool3'))

      const all = registry.getAll()
      expect(all).toHaveLength(3)
      expect(all.map(t => t.name)).toContain('tool1')
      expect(all.map(t => t.name)).toContain('tool2')
      expect(all.map(t => t.name)).toContain('tool3')
    })
  })

  // ---------- 工具过滤器 ----------

  describe('setActiveFilter / getActiveFilter', () => {
    /**
     * 默认过滤器应该是 null（全部启用）
     */
    it('默认过滤器应该是 null', () => {
      expect(registry.getActiveFilter()).toBeNull()
    })

    /**
     * 设置过滤器后应该能获取到
     */
    it('应该设置和获取过滤器', () => {
      const filter = new Set(['tool1', 'tool2'])
      registry.setActiveFilter(filter)

      expect(registry.getActiveFilter()).toBe(filter)
    })

    /**
     * 设置为 null 应该清除过滤器
     */
    it('设置为 null 应该清除过滤器', () => {
      registry.setActiveFilter(new Set(['tool1']))
      registry.setActiveFilter(null)

      expect(registry.getActiveFilter()).toBeNull()
    })
  })

  // ---------- formatToolDescriptions ----------

  describe('formatToolDescriptions', () => {
    /**
     * 空 registry 应该返回空字符串
     */
    it('空 registry 应该返回空字符串', () => {
      expect(registry.formatToolDescriptions()).toBe('')
    })

    /**
     * 应该正确格式化单个工具的描述
     */
    it('应该正确格式化单个工具', () => {
      registry.register(createMockTool('my_tool', '我的工具'))

      const desc = registry.formatToolDescriptions()
      expect(desc).toContain('my_tool')
      expect(desc).toContain('我的工具')
      // 参数描述也应该包含
      expect(desc).toContain('param1')
      expect(desc).toContain('必填')
      expect(desc).toContain('param2')
      expect(desc).toContain('可选')
    })

    /**
     * 多个工具应该用空行分隔
     */
    it('多个工具应该用空行分隔', () => {
      registry.register(createMockTool('tool1'))
      registry.register(createMockTool('tool2'))

      const desc = registry.formatToolDescriptions()
      // 两个工具之间应该有空行分隔（\n\n）
      expect(desc).toContain('tool1')
      expect(desc).toContain('tool2')
    })

    /**
     * 过滤器为 null 时，所有工具都应该显示
     */
    it('过滤器为 null 时所有工具都应该显示', () => {
      registry.register(createMockTool('tool1'))
      registry.register(createMockMcpTool('server', 'mcp_tool'))

      registry.setActiveFilter(null)
      const desc = registry.formatToolDescriptions()

      expect(desc).toContain('tool1')
      expect(desc).toContain('mcp__server__mcp_tool')
    })

    /**
     * 设置过滤器后，只有过滤器中的 MCP 工具才会显示
     * 内置工具（非 mcp__ 前缀）始终显示
     */
    it('过滤器应该只影响 MCP 工具', () => {
      registry.register(createMockTool('builtin_tool'))
      registry.register(createMockMcpTool('server', 'mcp_tool1'))
      registry.register(createMockMcpTool('server', 'mcp_tool2'))

      // 只启用 mcp_tool1
      registry.setActiveFilter(new Set(['mcp__server__mcp_tool1']))

      const desc = registry.formatToolDescriptions()

      // 内置工具始终显示
      expect(desc).toContain('builtin_tool')
      // 过滤器中的 MCP 工具显示
      expect(desc).toContain('mcp__server__mcp_tool1')
      // 不在过滤器中的 MCP 工具不显示
      expect(desc).not.toContain('mcp__server__mcp_tool2')
    })
  })

  // ---------- 工具执行 ----------

  describe('工具执行', () => {
    /**
     * 通过 registry 获取的工具应该能正确执行
     */
    it('应该通过 registry 执行工具', async () => {
      const tool = createMockTool('test_tool')
      registry.register(tool)

      const retrieved = registry.get('test_tool')!
      const result = await retrieved.execute({ param1: 'hello' })

      expect(result.success).toBe(true)
      expect(result.output).toContain('test_tool')
    })
  })
})
