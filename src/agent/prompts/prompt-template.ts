/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表和当前平台信息
 * 对话历史由 messages 消息数组承载，不再注入系统提示词，避免重复计费
 */

import type { ToolRegistry } from '../tools/tool-registry.js'
import { getSystemPrompt, render } from './loader.js'

/**
 * 生成当前平台说明，让模型输出与平台匹配的命令
 */
function getPlatformInfo(): string {
  const os = process.platform

  if (os === 'win32') {
    return [
      'You are running on Windows with cmd.exe as the shell.',
      'Use Windows commands: dir (not ls), type (not cat), echo, cd /d, where (not which).',
      'Use backslash paths (C:\\Users\\...) and %VAR% for environment variables.',
      'Do NOT use POSIX commands or syntax (ls, cat, grep, rm -rf, pwd, sudo, $HOME, / paths).',
    ].join('\n')
  }

  if (os === 'darwin') {
    return [
      'You are running on macOS (zsh/bash as the shell).',
      'Use POSIX commands: ls, cat, grep, pwd, and standard Unix tools.',
      'Use forward-slash paths (/) and $VAR for environment variables.',
    ].join('\n')
  }

  return [
    'You are running on Linux (bash as the shell).',
    'Use POSIX commands: ls, cat, grep, pwd, and standard Unix tools.',
    'Use forward-slash paths (/) and $VAR for environment variables.',
  ].join('\n')
}

/**
 * 生成当前时间信息，让模型感知当前时刻
 * frozenTime 由调用方冻结传入，同一任务内保持固定，避免每轮重建打断前缀缓存
 */
export function createFrozenTimeInfo(): string {
  const now = new Date()
  const fmt = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${fmt(now.getMonth() + 1)}-${fmt(now.getDate())}`
  const time = `${fmt(now.getHours())}:${fmt(now.getMinutes())}:${fmt(now.getSeconds())}`
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  return `The current system time is ${weekday}, ${date} ${time} (timezone: ${tz}).`
}

function getCurrentTimeInfo(frozenTime?: string): string {
  return frozenTime ?? createFrozenTimeInfo()
}

/**
 * 构建系统提示词
 * @param frozenTime 可选的预冻结时间字符串；同一任务内传入相同值可保证提示词前缀稳定
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
  frozenTime?: string,
): string {
  return render(getSystemPrompt(), {
    toolDescriptions: registry.formatToolDescriptions(),
    platformInfo: getPlatformInfo(),
    currentTime: getCurrentTimeInfo(frozenTime),
  })
}
