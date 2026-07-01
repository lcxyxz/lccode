import { executeCommand } from '../../services/command-executor.js'
import type { Tool, ToolResult } from '../tool-registry.js'

/**
 * 执行命令工具（只读）
 */
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: '执行一条只读的系统命令用于探索和查询，例如查看文件、搜索内容、检查系统状态。不能用于修改文件。每次只能执行一条简单命令，禁止使用 &&、||、;、| 等连接多条命令。',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '要执行的一条只读命令（禁止用 &&、||、;、| 连接多条命令），例如: ls -la, cat file.txt, git status',
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
