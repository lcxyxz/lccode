/**
 * Skill 管理器
 * 仿照 McpManager 模式，管理 skill 的加载、激活状态和工具注册
 */

import type { Skill } from './types.js'
import type { Tool } from '../tools/tool-registry.js'
import { loadAllSkills } from './loader.js'
import { adaptSkillTools } from './skill-adapter.js'

interface SkillStatus {
  name: string
  description: string
  enabled: boolean
}

export class SkillManager {
  private skills: Skill[] = []
  private allTools: Map<string, Tool> = new Map()
  private activeSkills: Set<string> = new Set()

  /** 从磁盘加载所有 skill，默认全部激活 */
  async loadFromDisk(): Promise<void> {
    this.skills = loadAllSkills()
    this.allTools.clear()
    this.activeSkills.clear()

    const tools = adaptSkillTools(this.skills)
    for (const tool of tools) {
      this.allTools.set(tool.name, tool)
      this.activeSkills.add(tool.name)
    }
  }

  /** 获取 skill 数量 */
  get count(): number {
    return this.skills.length
  }

  /** 获取所有已加载的 skill 工具 */
  getAllTools(): Tool[] {
    return Array.from(this.allTools.values())
  }

  /** 获取所有激活的 skill 工具名称 */
  getActiveToolNames(): Set<string> {
    return new Set(this.activeSkills)
  }

  /** 获取所有 skill 状态（含激活情况） */
  getSkillStatus(): SkillStatus[] {
    return this.skills.map(skill => ({
      name: skill.name,
      description: skill.description || '',
      enabled: this.activeSkills.has(`skill__${skill.name}`),
    }))
  }

  /** 获取 skill 简要信息列表（供 /skill 命令展示） */
  getSkillBriefList(): { index: number; name: string; description: string; active: boolean }[] {
    return this.skills.map((skill, i) => ({
      index: i + 1,
      name: skill.name,
      description: skill.description || '',
      active: this.activeSkills.has(`skill__${skill.name}`),
    }))
  }

  /** 按编号切换 skill 的激活/失效 */
  toggleSkillByIndex(index: number): { name: string; enabled: boolean } | null {
    if (index < 0 || index >= this.skills.length) return null
    const skill = this.skills[index]
    const toolName = `skill__${skill.name}`
    const isActive = this.activeSkills.has(toolName)

    if (isActive) {
      this.activeSkills.delete(toolName)
    } else {
      this.activeSkills.add(toolName)
    }

    return { name: skill.name, enabled: !isActive }
  }

  /** 启用所有 skill */
  enableAll(): void {
    for (const tool of this.allTools.keys()) {
      this.activeSkills.add(tool)
    }
  }

  /** 禁用所有 skill */
  disableAll(): void {
    this.activeSkills.clear()
  }
}
