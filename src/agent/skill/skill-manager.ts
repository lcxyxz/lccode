/**
 * Skill 管理器
 * 负责加载、查询、匹配和管理 skill 的激活状态
 */

import type { Skill } from './types.js'
import { loadAllSkills } from './loader.js'

export class SkillManager {
  private skills: Map<string, Skill> = new Map()
  /** 当前会话激活的 skill 名称 */
  private activeSkillName: string | null = null

  /** 从磁盘加载所有 skill */
  async loadFromDisk(): Promise<void> {
    this.skills.clear()
    const loaded = loadAllSkills()
    for (const skill of loaded) {
      this.skills.set(skill.name, skill)
    }
  }

  /** 获取 skill 数量 */
  get count(): number {
    return this.skills.size
  }

  /** 按名称获取 skill */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /** 获取当前激活的 skill */
  getActive(): Skill | null {
    if (!this.activeSkillName) return null
    return this.skills.get(this.activeSkillName) ?? null
  }

  /** 获取当前激活的 skill 名称 */
  getActiveName(): string | null {
    return this.activeSkillName
  }

  /** 激活一个 skill */
  activate(name: string): Skill | null {
    const skill = this.skills.get(name)
    if (!skill) return null
    this.activeSkillName = name
    return skill
  }

  /** 取消当前激活的 skill */
  deactivate(): void {
    this.activeSkillName = null
  }

  /** 根据用户输入文本自动匹配合适的 skill（基于 triggers 关键词） */
  matchByInput(input: string): Skill | null {
    const lowerInput = input.toLowerCase()
    for (const skill of this.skills.values()) {
      if (!skill.triggers) continue
      for (const trigger of skill.triggers) {
        if (lowerInput.includes(trigger.toLowerCase())) {
          return skill
        }
      }
    }
    return null
  }

  /** 获取所有 skill 的摘要信息（用于 /skill 命令和提示词注入） */
  getSkillList(): string {
    if (this.skills.size === 0) return '(无可用 skill)'

    const lines: string[] = []
    for (const skill of this.skills.values()) {
      const active = skill.name === this.activeSkillName ? ' [已激活]' : ''
      const desc = skill.description ? ` - ${skill.description}` : ''
      const triggers = skill.triggers ? ` (触发词: ${skill.triggers.join(', ')})` : ''
      lines.push(`  /skill ${skill.name}${active}${desc}${triggers}`)
    }
    return lines.join('\n')
  }

  /** 获取所有 skill 名称（用于斜杠命令提示补全） */
  getSkillNames(): string[] {
    return Array.from(this.skills.keys())
  }
}
