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

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 生成工具描述文本，用于注入提示词
   */
  formatToolDescriptions(): string {
    return this.getAll().map(tool => {
      const params = tool.parameters
        .map(p => `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`)
        .join('\n')
      return `  - ${tool.name}: ${tool.description}\n${params}`
    }).join('\n\n')
  }
}

// ===================== 内置工具 =====================

import { executeCommand } from '../services/command-executor.js'

/**
 * 执行命令工具
 */
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: '执行 Linux/Unix 命令并返回输出结果',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '要执行的命令，例如: ls -la, cat file.txt, git status',
      required: true,
    },
  ],
  execute: async (params) => {
    const result = await executeCommand(params.command)
    const rawOutput = result.stdout || result.stderr || '(无输出)'
    const maxOutputLen = 3000
    const output = rawOutput.length > maxOutputLen
      ? rawOutput.slice(0, maxOutputLen) + `\n... (输出被截断，原始长度 ${rawOutput.length} 字符)`
      : rawOutput
    return {
      success: result.success,
      output,
      error: result.error,
    }
  },
}
