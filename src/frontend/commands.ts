import type { CommandAction, OutputSection } from '../types/index.js'

/**
 * 斜杠命令列表（用于命令提示）
 */
export const SLASH_COMMANDS = ['/exit', '/help', '/clear', '/mcp', '/skill']

/**
 * 内置命令的帮助文本和响应内容
 */
export const COMMANDS: Record<string, string> = {
  help: `Available commands:
  /exit    - Exit the terminal
  /help    - Show this help message
  /clear   - Clear screen
  /mcp     - Manage MCP tools
  /skill   - Manage skills
  `,

}

/**
 * 命令执行回调接口
 */
export interface CommandContext {
  addLine: (content: string, color?: OutputSection['color']) => void
  addHistory: (cmd: string) => void
  clearSections: () => void
}

/**
 * 处理用户输入的命令
 * 不再直接调用 process.exit，而是返回 CommandAction 让调用方执行副作用
 * @param cmd - 用户输入的完整命令字符串
 * @param ctx - 命令执行上下文，提供状态操作回调
 * @returns 命令执行后的动作指令（用于决定是否退出等）
 */
export function processCommand(cmd: string, ctx: CommandContext): CommandAction {
  const trimmed = cmd.trim()
  if (!trimmed) return { type: 'CONTINUE' }

  ctx.addHistory(trimmed)
  ctx.addLine(`$ ${trimmed}`, 'yellow')

  const parts = trimmed.split(/\s+/)
  const command = parts[0].toLowerCase()

  // 处理斜杠命令（如 /exit, /help）
  if (command.startsWith('/')) {
    const slashCmd = command.slice(1)

    if (slashCmd === 'exit') {
      ctx.addLine('Goodbye!', 'cyan')
      return { type: 'EXIT', message: 'Goodbye!' }
    }

    if (slashCmd === 'help') {
      ctx.addLine(COMMANDS['help'], 'magenta')
      return { type: 'CONTINUE' }
    }

    if(slashCmd === "clear") {
      ctx.clearSections()
      return {type:'CONTINUE'}
    }

    if (slashCmd === 'mcp') {
      return { type: 'MCP_ACTION', args: parts.slice(1) }
    }

    if (slashCmd === 'skill') {
      return { type: 'SKILL_ACTION', args: parts.slice(1) }
    }

    ctx.addLine(`bash: ${command}: command not found`, 'white')
    return { type: 'CONTINUE' }
  }

  // 非斜杠命令 → 作为 LLM 查询
  return { type: 'LLM_QUERY', query: trimmed }
}
