import { executeCommand, getPlatform } from '../../services/command-executor.js'
import type { Tool, ToolResult } from './tool-registry.js'

/**
 * Execute command tool
 * Note: dangerous or non-whitelisted commands require user confirmation
 */
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: 'Execute a terminal command. One command per call, no && || ; | chaining. Prefer search or add_dir when applicable',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: getPlatform() === 'windows'
        ? 'Single Windows command, e.g. dir, type file.txt, git status'
        : 'Single Linux command, e.g. ls -la, cat file.txt, git status',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const force = params._force === true
    const result = await executeCommand(params.command, force)
    const rawOutput = result.stdout || result.stderr || '(no output)'
    const maxOutputLen = 8000
    const output = rawOutput.length > maxOutputLen
      ? rawOutput.slice(0, maxOutputLen) + `\n... (output truncated, original length ${rawOutput.length} chars)`
      : rawOutput
    return {
      success: result.success,
      output,
      error: result.error,
    }
  },
}
