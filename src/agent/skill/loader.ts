/**
 * Skill 文件加载器
 * 从 .lccode/skills/ 目录扫描并加载 .md 文件
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Skill } from './types.js'

/** 解析 YAML frontmatter（简化版，只提取 description 和 triggers） */
function parseFrontmatter(raw: string): { meta: { description?: string; triggers?: string[] }; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { meta: {}, body: raw }
  }

  const yamlBlock = match[1]
  const body = match[2]

  const meta: { description?: string; triggers?: string[] } = {}

  for (const line of yamlBlock.split('\n')) {
    const descMatch = line.match(/^description:\s*(.+)$/)
    if (descMatch) {
      meta.description = descMatch[1].trim()
      continue
    }

    const triggersMatch = line.match(/^triggers:\s*(.+)$/)
    if (triggersMatch) {
      meta.triggers = triggersMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      continue
    }
  }

  return { meta, body }
}

/** 从指定目录加载所有 skill 文件 */
function loadSkillsFromDir(dir: string): Skill[] {
  if (!existsSync(dir)) return []

  const skills: Skill[] = []

  let entries: string[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
  } catch {
    return []
  }

  for (const file of entries) {
    const filePath = join(dir, file)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      const name = file.replace(/\.md$/, '')

      skills.push({
        name,
        description: meta.description || '',
        triggers: meta.triggers,
        content: body.trim(),
        filePath,
      })
    } catch {
      // 跳过无法读取或解析的文件
    }
  }

  return skills
}

/** 从项目级和用户级目录加载所有 skill */
export function loadAllSkills(): Skill[] {
  const projectDir = join(process.cwd(), '.lccode', 'skills')
  const userDir = join(homedir(), '.lccode', 'skills')

  const projectSkills = loadSkillsFromDir(projectDir)
  const userSkills = loadSkillsFromDir(userDir)

  // 项目级 skill 优先（同名覆盖用户级）
  const skillMap = new Map<string, Skill>()
  for (const skill of userSkills) {
    skillMap.set(skill.name, skill)
  }
  for (const skill of projectSkills) {
    skillMap.set(skill.name, skill)
  }

  return Array.from(skillMap.values())
}
