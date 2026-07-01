/**
 * 命令执行模块
 * 安全地执行 Linux 命令并返回结果
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/** 安全命令白名单（仅允许只读命令） */
const SAFE_COMMANDS = [
  'ls', 'pwd', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'echo',
  'ps', 'df', 'du', 'free', 'uname', 'whoami', 'date', 'cal',
  'git', 'git log', 'git diff', 'git status', 'git show',
  'which', 'file', 'stat', 'tree',
]

/** 危险命令黑名单 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf/,
  /sudo\s+rm/,
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\{.*\|.*&\s*\}:/,
  /chmod\s+777/,
  /\|\s*tee\b/,
  />\s*\S+/,           // shell 重定向 >
  />>\s*\S+/,          // 追加重定向 >>
  /<\s*\S+/,           // 输入重定向 <
  /\|\s*(bash|sh)\b/,  // 管道到 shell
]

export interface CommandResult {
  success: boolean
  command: string
  stdout: string
  stderr: string
  error?: string
}

/**
 * 检查命令是否安全
 */
export function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim()

  // 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `危险命令被拦截: ${trimmed}` }
    }
  }

  // 提取主命令
  const parts = trimmed.split(/\s+/)
  const mainCommand = parts[0]

  // 检查白名单
  if (!SAFE_COMMANDS.includes(mainCommand)) {
    return { safe: false, reason: `命令 "${mainCommand}" 不在安全列表中` }
  }

  return { safe: true }
}

/**
 * 执行命令并返回结果
 */
export async function executeCommand(command: string): Promise<CommandResult> {
  const safety = isCommandSafe(command)
  if (!safety.safe) {
    return {
      success: false,
      command,
      stdout: '',
      stderr: '',
      error: safety.reason,
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 10000, // 10 秒超时
      maxBuffer: 1024 * 1024, // 1MB 输出限制
      cwd: process.cwd(),
    })

    return {
      success: true,
      command,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  } catch (error: any) {
    return {
      success: false,
      command,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      error: error.message,
    }
  }
}


