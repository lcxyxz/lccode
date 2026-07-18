import { useCallback, useRef } from 'react'
import type { Agent } from '../../agent/agent.js'

interface SkillOutputActions {
  addMessage: (content: string, color?: string) => void
}

export function useSkillCommand(agentRef: React.RefObject<Agent | null>, actions: SkillOutputActions) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handle = useCallback((args: string[]) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: Agent not initialized.', 'yellow')
      return
    }

    const skillManager = agent.getSkillManager()
    const subcmd = args[0]?.toLowerCase()

    // /skill — 列出所有 skill
    if (!subcmd) {
      const list = skillManager.getSkillBriefList()
      if (list.length === 0) {
        actionsRef.current.addMessage(
          'No skills found.\n\nTo add skills, place .md files in .lccode/skills/ directory.\nEach file should have frontmatter:\n\n---\nname: skill-name\ndescription: your skill description\n---\n\n# Your skill instructions here...',
          'yellow'
        )
        return
      }

      let output = 'Skills:\n──────\n'
      for (const item of list) {
        const status = item.active ? '●' : '○'
        const desc = item.description ? ` - ${item.description}` : ''
        output += `  ${item.index}. ${status} ${item.name}${desc}\n`
      }
      output += '\nUsage:\n  /skill           - Show this list\n  /skill 1,2       - Toggle skills by number\n  /skill all       - Enable all skills\n  /skill none      - Disable all skills'
      actionsRef.current.addMessage(output, 'cyan')
      return
    }

    // /skill all — 启用全部
    if (subcmd === 'all') {
      skillManager.enableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All skills enabled.', 'green')
      return
    }

    // /skill none — 禁用全部
    if (subcmd === 'none') {
      skillManager.disableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All skills disabled.', 'yellow')
      return
    }

    // /skill 1,2 — 按编号切换
    const indices = subcmd.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    if (indices.length === 0) {
      actionsRef.current.addMessage('Invalid usage. See /skill for help.', 'yellow')
      return
    }

    for (const idx of indices) {
      const result = skillManager.toggleSkillByIndex(idx - 1)
      if (result) {
        const status = result.enabled ? 'enabled' : 'disabled'
        const color = result.enabled ? 'green' : 'yellow'
        actionsRef.current.addMessage(`Skill "${result.name}" ${status}.`, color)
      } else {
        actionsRef.current.addMessage(`Invalid skill number: ${idx}`, 'yellow')
      }
    }
    agent.refreshToolFilter()
  }, [agentRef])

  return { handleSkillAction: handle }
}
