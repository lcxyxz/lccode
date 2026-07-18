/**
 * Skill 适配器
 * 将 Skill 对象转换为 Tool 对象
 */

import type { Skill } from './types.js'
import type { Tool, ToolResult } from '../tools/tool-registry.js'

export function adaptSkillTools(skills: Skill[]): Tool[] {
  return skills.map(skill => ({
    name: `skill__${skill.name}`,
    description: skill.description || `Skill: ${skill.name}`,
    parameters: [],
    execute: async (): Promise<ToolResult> => ({
      success: true,
      output: skill.content,
    }),
  }))
}
