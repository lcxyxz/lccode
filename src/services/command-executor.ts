/**
 * 命令执行模块
 * 安全地执行 Linux 命令并返回结果
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/** 安全命令白名单 */
const SAFE_COMMANDS = [
  'ls', 'pwd', 'cd', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'echo',
  'ps', 'top', 'df', 'du', 'free', 'uname', 'whoami', 'date', 'cal',
  'git', 'npm', 'node', 'python', 'python3', 'pip', 'npx',
  'curl', 'wget', 'tar', 'zip', 'unzip',
  'mkdir', 'touch', 'cp', 'mv',
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

/**
 * 从 LLM 响应中解析命令
 * 格式: <exec>命令</exec>
 */
export function parseExecTag(text: string): { before: string; command: string; after: string } | null {
  const match = text.match(/^(.*?)<exec>(.*?)<\/exec>(.*)$/s)
  if (!match) return null

  return {
    before: match[1].trim(),
    command: match[2].trim(),
    after: match[3].trim(),
  }
}

/**
 * 检测是否包含 <finish> 标签
 */
export function hasFinishTag(text: string): boolean {
  return /<finish>/.test(text)
}

/**
 * 解析 <finish> 标签内容
 */
export function parseFinishTag(text: string): { before: string; content: string; after: string } | null {
  const match = text.match(/^(.*?)<finish>([\s\S]*?)<\/finish>(.*)$/)
  if (!match) return null

  return {
    before: match[1].trim(),
    content: match[2].trim(),
    after: match[3].trim(),
  }
}
