/**
 * 命令执行模块
 * 安全地执行命令并返回结果
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'

const execAsync = promisify(exec)

/** 检测当前操作系统 */
const isWindows = platform() === 'win32'

/** 安全命令白名单（Linux/Windows 通用） */
const SAFE_COMMANDS = [
  'ls', 'pwd', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'echo',
  'ps', 'df', 'du', 'free', 'uname', 'whoami', 'date', 'cal',
  'dir', 'cd', 'type', 'where', 'findstr',
  'tasklist', 'systeminfo', 'hostname', 'time',
  'which', 'file', 'stat', 'tree',
  'git', 'git log', 'git diff', 'git status', 'git show',
  'npm', 'npx', 'yarn', 'pnpm',
]

/** 危险命令模式（Linux/Windows 通用） */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf/,
  /sudo\s+rm/,
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\{.*\|.*&\s*\}:/,
  /chmod\s+777/,
  /rmdir\s+\/s\s+\/q/i,
  /del\s+\/f\s+\/q/i,
  /format\s+[a-z]:/i,
  /rd\s+\/s\s+\/q/i,
  /erase\s+\/f\s+\/q/i,
  />\s*\S+/,
  />>\s*\S+/,
  /<\s*\S+/,
  /\|\s*(bash|sh|cmd|powershell)\b/i,
]

interface CommandResult {
  success: boolean
  command: string
  stdout: string
  stderr: string
  error?: string
}

/**
 * 检查命令是否安全
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim()

  // 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `危险命令被拦截: ${trimmed}` }
    }
  }

  // 提取主命令
  const parts = trimmed.split(/\s+/)
  const mainCommand = parts[0].toLowerCase()

  // 检查白名单
  if (!SAFE_COMMANDS.includes(mainCommand)) {
    return { safe: false, reason: `命令 "${mainCommand}" 不在安全列表中` }
  }

  return { safe: true }
}

/**
 * 获取当前平台信息
 */
export function getPlatform(): 'linux' | 'windows' | 'darwin' {
  const os = platform()
  if (os === 'win32') return 'windows'
  if (os === 'darwin') return 'darwin'
  return 'linux'
}

/**
 * 执行命令并返回结果
 * Windows 下使用 cmd.exe 执行，Linux/Mac 下直接执行
 * @param force 跳过安全检查（用户已确认时使用）
 */
export async function executeCommand(command: string, force: boolean = false): Promise<CommandResult> {
  if (!force) {
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
  }

  try {
    // Windows 下使用 cmd.exe /c 执行命令
    const execCommand = isWindows ? `cmd.exe /c ${command}` : command
    
    const { stdout, stderr } = await execAsync(execCommand, {
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


