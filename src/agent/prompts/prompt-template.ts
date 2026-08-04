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
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
): string {
  return render(getSystemPrompt(), {
    toolDescriptions: registry.formatToolDescriptions(),
    platformInfo: getPlatformInfo(),
  })
}
