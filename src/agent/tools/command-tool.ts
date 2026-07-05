import { executeCommand, getPlatform } from '../../services/command-executor.js'
import type { Tool, ToolResult } from './tool-registry.js'

/**
 * 执行命令工具
 * 注意：危险命令或非白名单命令需要用户确认后才能执行
 */
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: '执行终端命令。每次只执行一条命令，禁止 && || ; | 等连接。如果任务可用 search 或 add_dir 完成，请优先使用它们',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: getPlatform() === 'windows'
        ? '单条Windows命令，如: dir, type file.txt, git status'
        : '单条Linux命令，如: ls -la, cat file.txt, git status',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const force = params._force === true
    const result = await executeCommand(params.command, force)
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
