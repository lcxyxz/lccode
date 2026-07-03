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
}

/**
 * 工具注册中心
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private cachedDescriptions: string | null = null
  private _version = 0

  /** 版本号，每次工具变化时递增，用于 prompt 缓存失效判断 */
  get version(): number {
    return this._version
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
    this.cachedDescriptions = null
    this._version++
  }

  unregister(name: string): boolean {
    const deleted = this.tools.delete(name)
    if (deleted) {
      this.cachedDescriptions = null
      this._version++
    }
    return deleted
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 生成工具描述文本，用于注入提示词（带缓存）
   */
  formatToolDescriptions(): string {
    if (this.cachedDescriptions === null) {
      this.cachedDescriptions = this.getAll().map(tool => {
        const params = tool.parameters
          .map(p => `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`)
          .join('\n')
        return `  - ${tool.name}: ${tool.description}\n${params}`
      }).join('\n\n')
    }
    return this.cachedDescriptions
  }
}
