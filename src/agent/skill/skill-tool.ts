/**
 * Skill 工具
 * 提供给 LLM 的工具，让它可以主动请求加载某个 skill 的指令
 */

import type { Tool, ToolResult } from '../tools/tool-registry.js'
import type { SkillManager } from './skill-manager.js'

export function createSkillTool(manager: SkillManager): Tool {
  return {
    name: 'use_skill',
    description: '加载并应用一个 skill 的指令，改变你的工作方式来完成特定类型的任务。使用前先用 /skill 查看可用列表',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'skill 名称（不带 /skill 前缀）',
        required: true,
      },
    ],
    execute: async (params): Promise<ToolResult> => {
      const name = params.name
      if (!name) {
        return { success: false, output: '', error: '请提供 skill 名称' }
      }

      const skill = manager.activate(name)
      if (!skill) {
        const available = manager.getSkillNames().join(', ')
        return {
          success: false,
          output: '',
          error: `skill "${name}" 不存在。可用的 skill: ${available || '(无)'}`,
        }
      }

      return {
        success: true,
        output: `已激活 skill: ${name}\n\n${skill.content}`,
      }
    },
  }
}
