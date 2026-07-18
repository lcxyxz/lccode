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
      const list = skillManager.getSkillList()
      if (list === '(无可用 skill)') {
        actionsRef.current.addMessage(
          'No skills found.\n\nTo add skills, place .md files in .lccode/skills/ directory.\nEach file should have frontmatter:\n\n---\ndescription: your skill description\ntriggers: keyword1, keyword2\n---\n\n# Your skill instructions here...',
          'yellow'
        )
        return
      }

      const activeName = skillManager.getActiveName()
      let output = 'Skills:\n──────\n'
      output += list + '\n\n'
      if (activeName) {
        output += `Active: /skill ${activeName}\n`
        output += 'Use /skill --clear to deactivate.'
      } else {
        output += 'No skill active. Use /skill <name> to activate.'
      }
      actionsRef.current.addMessage(output, 'cyan')
      return
    }

    // /skill --clear — 取消激活
    if (subcmd === '--clear' || subcmd === '-c') {
      skillManager.deactivate()
      actionsRef.current.addMessage('Skill deactivated.', 'yellow')
      return
    }

    // /skill <name> — 激活指定 skill
    const skill = skillManager.activate(subcmd)
    if (!skill) {
      const names = skillManager.getSkillNames().join(', ')
      actionsRef.current.addMessage(
        `Skill "${subcmd}" not found.${names ? ` Available: ${names}` : ''}`,
        'yellow'
      )
      return
    }

    actionsRef.current.addMessage(`Skill activated: ${skill.name}`, 'green')
    if (skill.description) {
      actionsRef.current.addMessage(skill.description, 'cyan')
    }
  }, [agentRef])

  return { handleSkillAction: handle }
}
