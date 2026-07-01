import { executeCommand } from '../../services/command-executor.js'
import type { Tool, ToolResult } from './tool-registry.js'

/**
 * 执行命令工具（只读）
 */
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: '执行只读命令（仅查询，不能修改）。每次只执行一条简单命令，禁止 && || ; | 等连接',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '单条命令，如: ls -la, cat file.txt, git status',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const result = await executeCommand(params.command)
    const rawOutput = result.stdout || result.stderr || '(无输出)'
    const maxOutputLen = 8000
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
