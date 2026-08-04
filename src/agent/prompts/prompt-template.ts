/**
 * 提示词模板构建
 * 动态生成系统提示词，注入工具列表
 * 对话历史由 messages 消息数组承载，不再注入系统提示词，避免重复计费
 */

import type { ToolRegistry } from '../tools/tool-registry.js'
import { getSystemPrompt, render } from './loader.js'


/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  registry: ToolRegistry,
): string {
  return render(getSystemPrompt(), {
    toolDescriptions: registry.formatToolDescriptions(),
  })
}
