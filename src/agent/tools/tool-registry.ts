/**
 * 工具注册中心
 * 管理所有可用工具的注册、查询和执行
 */

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParameter[]
  execute: (params: Record<string, any>) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  output: string
  error?: string
  diff?: {
    filePath: string
    language: string
    lines: DiffLine[]
  }
}

/** 差异行类型 */
export type DiffLineType = 'added' | 'removed' | 'unchanged'

/** 差异行 */
export interface DiffLine {
  type: DiffLineType
  lineNumber: number
  content: string
}

/**
 * 工具注册中心
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private activeFilter: Set<string> | null = null

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 设置工具过滤器，控制哪些工具出现在提示词中
   * null = 全部启用，Set<string> = 只启用指定工具
   */
  setActiveFilter(names: Set<string> | null): void {
    this.activeFilter = names
  }

  getActiveFilter(): Set<string> | null {
    return this.activeFilter
  }

  /**
   * 生成工具描述文本，用于注入提示词
   * 内置工具始终显示，MCP 工具（mcp__ 前缀）按过滤器控制
   */
  formatToolDescriptions(): string {
    const tools = this.getAll().filter(t => {
      if (this.activeFilter === null) return true
      // 非 MCP 工具始终保留
      if (!t.name.startsWith('mcp__')) return true
      // MCP 工具按过滤器判断
      return this.activeFilter!.has(t.name)
    })
    return tools.map(tool => {
      const params = tool.parameters
        .map(p => `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`)
        .join('\n')
      return `  - ${tool.name}: ${tool.description}\n${params}`
    }).join('\n\n')
  }
}
