import { useCallback, useRef } from 'react'
import type { Agent } from '../../agent/agent.js'

interface McpOutputActions {
  addMessage: (content: string, color?: string) => void
}

export function useMcpCommand(agentRef: React.RefObject<Agent | null>, actions: McpOutputActions) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handle = useCallback((args: string[]) => {
    const agent = agentRef.current
    if (!agent) {
      actionsRef.current.addMessage('Error: Agent not initialized.', 'yellow')
      return
    }

    const mcpManager = agent.getMcpManager()
    const subcmd = args[0]?.toLowerCase()

    if (!subcmd || subcmd === 'list' || subcmd === 'status') {
      const servers = mcpManager.getServerBriefList()
      if (servers.length === 0) {
        actionsRef.current.addMessage('No MCP servers configured.', 'yellow')
        return
      }

      let output = 'MCP Servers:\n────────────\n'
      servers.forEach((s, i) => {
        const status = s.activeToolCount === s.toolCount ? '✅' : s.activeToolCount > 0 ? '🟡' : '❌'
        const conn = s.connected ? '●' : '○'
        output += `  ${i + 1}. ${status} [${conn}] ${s.name} (${s.activeToolCount}/${s.toolCount} tools)\n`
      })
      output += '\nUsage:\n  /mcp           - Show this list\n  /mcp 1,2       - Toggle servers by number\n  /mcp all       - Enable all servers\n  /mcp none      - Disable all servers'
      actionsRef.current.addMessage(output, 'cyan')
      return
    }

    if (subcmd === 'all') {
      mcpManager.enableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers enabled.', 'green')
      return
    }

    if (subcmd === 'none') {
      mcpManager.disableAll()
      agent.refreshToolFilter()
      actionsRef.current.addMessage('All MCP servers disabled.', 'yellow')
      return
    }

    const numbers = args.join(',').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    if (numbers.length === 0) {
      actionsRef.current.addMessage('Invalid usage. See /mcp for help.', 'yellow')
      return
    }

    const results: string[] = []
    for (const num of numbers) {
      const result = mcpManager.toggleServerByIndex(num - 1)
      if (result) {
        results.push(`${result.server} → ${result.enabled ? 'enabled' : 'disabled'} (${result.toolCount} tools)`)
      } else {
        results.push(`#${num}: invalid server number`)
      }
    }
    agent.refreshToolFilter()
    actionsRef.current.addMessage(results.join('\n'), 'cyan')
  }, [agentRef])

  return { handleMcpAction: handle }
}
