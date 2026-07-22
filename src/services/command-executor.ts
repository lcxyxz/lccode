/**
 * 命令执行模块
 * 安全地执行命令并返回结果
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'
import { validateCommand, getWorkspaceRoot } from '../utils/sandbox.js'

const execAsync = promisify(exec)

/** 检测当前操作系统 */
const isWindows = platform() === 'win32'

interface CommandResult {
  success: boolean
  command: string
  stdout: string
  stderr: string
  error?: string
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
    const sandboxCheck = validateCommand(command)
    if (!sandboxCheck.safe) {
      return {
        success: false,
        command,
        stdout: '',
        stderr: '',
        error: `沙箱拦截: ${sandboxCheck.error}`,
      }
    }
  }

  try {
    // Windows 下使用 cmd.exe /c 执行命令
    const execCommand = isWindows ? `cmd.exe /c ${command}` : command

    const { stdout, stderr } = await execAsync(execCommand, {
      timeout: 50000, // 50秒超时
      maxBuffer: 1024 * 1024, // 1MB 输出限制
      cwd: getWorkspaceRoot(), // 强制使用工作区目录
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


