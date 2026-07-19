/**
 * Skill 文件加载器
 * 从 .lccode/skills/ 目录扫描并加载 .md 文件
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Skill } from './types.js'

/** 解析 YAML frontmatter（简化版，提取 name、description 和 triggers） */
function parseFrontmatter(raw: string): { meta: { name?: string; description?: string; triggers?: string[] }; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { meta: {}, body: raw }
  }

  const yamlBlock = match[1]
  const body = match[2]

  const meta: { name?: string; description?: string; triggers?: string[] } = {}

  for (const line of yamlBlock.split('\n')) {
    const nameMatch = line.match(/^name:\s*(.+)$/)
    if (nameMatch) {
      meta.name = nameMatch[1].trim()
      continue
    }

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

/** 递归收集目录下所有 .md 文件路径 */
function collectMdFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath)
      } else if (entry.isDirectory()) {
        results.push(...collectMdFiles(fullPath))
      }
    }
  } catch {
    // 跳过无法读取的目录
  }
  return results
}

/** 从指定目录加载所有 skill 文件（递归扫描子目录） */
function loadSkillsFromDir(dir: string): Skill[] {
  if (!existsSync(dir)) return []

  const mdFiles = collectMdFiles(dir)
  const skills: Skill[] = []

  for (const filePath of mdFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      // 优先用 frontmatter 中的 name 字段
      // 否则：文件名为 SKILL.md 时用父目录名，否则用文件名
      const rel = filePath.slice(dir.length + 1).replace(/\.md$/, '')
      const basename = rel.split('/').pop() || rel
      const fallbackName = basename === 'SKILL'
        ? rel.split('/').slice(0, -1).join('-') || basename
        : rel.replace(/\//g, '-')
      const name = meta.name || fallbackName

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
